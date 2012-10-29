function PresentSchedule(config) {
  var haveSchedule = false;
  var socket = io.connect();
  
  socket.on('connect', function() {
    if( haveSchedule == false ) {
      socket.emit('getInitialSchedule');
      $('#loadingProgress').css('visibility', 'visible');
    }
  });

  socket.on('schedulePullRequest', function() {
    socket.emit('getUpdatedSchedule');
    $('#loadingProgress').css('visibility', 'visible');
  });

  socket.on('information', function(message) {
    alert(message);
  });

  socket.on('disconnect', function() {
    $('#scheduleTable').hide();
    $('#transitionModal').modal('hide');
    $('#messages').empty();
    $('#fixedMessage').html(ShowFlashMessage('error', 'Server connection is lost. Will retry to reconnect automatically in order to get a fresh schedule for you.', true));
  });

  socket.on('connect_failed', function() {
    $('#scheduleTable').hide();
    $('#transitionModal').modal('hide');
    $('#messages').empty();
    $('#fixedMessage').html(ShowFlashMessage('error', 'Server connection is lost. Will retry to reconnect automatically in order to get a fresh schedule for you.', true));
  });

  socket.on('reconnect', function() {
    $('#loadingProgress').css('visibility', 'visible');
    $('#scheduleTable').show();
    $('#fixedMessage').empty();
    $('#messages').html(ShowFlashMessage('info', 'The connection has been restored, you are viewing your current schedule.', false));
    socket.emit('getUpdatedSchedule');
  });

  socket.on('error', function() {
    $('#scheduleTable').hide();
    $('#transitionModal').modal('hide');
    $('#fixedMessage').html(ShowFlashMessage('error', 'Unknown erroneous situation.', true));
  });

  socket.on('sendschedule', function(schedule) {
    $('#loadingProgress').css('visibility', 'hidden');

    $('#scheduleTableAppointments').empty();
    var taskcount = 0;
    var tablerow = '';
    for (var appointmentKey in schedule){
      if (schedule.hasOwnProperty(appointmentKey)) {
        var functionalTaskID = '';
        haveSchedule = true;
        taskcount++;
        // Format dates to the defined formats
        var appointment = FormatDataForPresentation(schedule[appointmentKey]);
        functionalTaskID = schedule[appointmentKey][config.taskIdentifier].value;
        var tablerow = '<tr><td>' + taskcount + '</td>';
        for (var attribute in appointment) {
          if (appointment.hasOwnProperty(attribute)) {
            // special treatment for the status property
            if (attribute === config.statusProperty) {
              // generate pulldown menu
              htmlCode = GenerateStatusesPulldown(appointment[attribute], functionalTaskID);
              tablerow += '<td>' + htmlCode + '</td>';
            } else {
              tablerow += '<td>' + appointment[attribute].value + '</td>';
            }
          }
        }
        // add the view button in a seperate column
        tablerow += sprintf('<td><a href="#transitionModal" data-action="show/%s" class="btn" id="modalOpen" data-toggle="modal"><i class="icon-search"></i></a></td>', functionalTaskID);
        tablerow += '</tr>';
        $('#scheduleTableAppointments').append(tablerow);
      }
    }
    if (taskcount === 0) {
      $('#scheduleTable').hide();
      $('#fixedMessage').html(ShowFlashMessage('info', 'Your schedule is currently empty. New tasks will be displayed automatically.', true));
    } else {
      $('#fixedMessage').empty();
      $('#scheduleTable').show();
      // bind the click-event to each status transition of each task
      $('a[id|="modalOpen"]').click(function(event) {
        event.preventDefault();
        var actionLink = $(this).attr("data-action");
        RequestAndSetModalContent(socket, config, actionLink);
      });
    }
  });
}

function RequestAndSetModalContent(socket, config, action) {
  var actionArray = action.split('/');
  var action = actionArray[0];
  var appointmentID = actionArray[1];
  switch (action) {
    case 'show':
      socket.emit('getAppointmentDetails',appointmentID, function(error, appointment) {
        if (error) {
          $('#modal-body').html(error);
          $('#modal-header h3').text('Error');
          $('#modalButtonSave').css('display', 'none');    
        } else {
          var modalContent = GenerateModalContent(appointment, true);
          $('#modal-body').html(modalContent);
          $('#modal-header h3').text('Viewing details of ' + appointmentID);
          $('#modalButtonSave').css('display', 'none');
        }
      });
      break;
    case 'edit':
      var destinationStatus = actionArray[2];
      socket.emit('getAppointmentDetails',appointmentID, function(error, appointment) {
        if (error) {
          alert(error);
        } else {
          // update status to destination status
          appointment[config.statusProperty]['value'] = destinationStatus;
          var modalContent = GenerateModalContent(appointment, false);
          $('#modal-body').html(modalContent);
          $('#modal-body legend').text('Transition to ' + destinationStatus);
          $('#modal-header h3').text('Edit appointment ' + appointmentID);
          $('#modalButtonSave').css('display', 'inline');
          socket.emit('isStatusComplete',destinationStatus, function(error, isComplete) {
            if (error) {
              alert(error);
              $('#transitionModal').modal('hide');
              socket.emit('getUpdatedSchedule');
              $('#loadingProgress').css('visibility', 'visible');
            } else {
              if (isComplete) {
                $('#modal-header h3').text('Finishing appointment ' + appointmentID);
                // on transition to a final appointment status, make appointmentstart and finish writeable.
                var inputIDAppointmentStart = "input" + config.assignmentStart;
                var inputIDAppointmentFinish = "input" + config.assignmentFinish;
                $('#' + inputIDAppointmentStart).removeAttr('readonly');
                $('#' + inputIDAppointmentFinish).removeAttr("readonly");
                $('label[for="' + inputIDAppointmentStart + '"]').css('font-weight','bold');
                $('label[for="' + inputIDAppointmentFinish + '"]').css('font-weight','bold');
                AddRegExpValidationRules(appointment);
                $('#appointmentForm').validate();
              }
            }
          });
          $('#modalButtonSave').click(function(event) {
            event.preventDefault;
            var isFormInvalid = ($('input[class*="error"]').size() > 0);
            if (isFormInvalid) {
              // select an input with error class
              $('input[class*="error"]').focus();
            } else {
              var serializedForm = ReformatSerializedForm($('#appointmentForm').serializeArray());
              var returnAppointment = FormatDataForTransmission(appointment, serializedForm);
              socket.emit('statusTransition',returnAppointment, function(error, status) {
                if (error) {
                  alert(error);
                } else {
                  $('#transitionModal').modal('hide');
                  socket.emit('getUpdatedSchedule');
                  $('#messages').html(ShowFlashMessage('success', 'The appointment <strong>' + appointmentID + '</strong> has been updated successfully to the new status <strong>"' + destinationStatus + '"</strong>.', false));
                }
              });
            }
          });
        }
      });
      break;
  }
  $('#modalButtonClose').click(function(event) {
    event.preventDefault();
    $('#transitionModal').modal('hide');
  });
  $('#transitionModal').on('hidden', function () {
    // unbind the click event on received click. Skipping the unbind would create more and more bindings as the function gets called each time a status transition is being initiated. In conclusion, this would lead to many received click events on only one "real" click.
    $('#modalButtonSave').unbind('click');
    $('#modalButtonClose').unbind('click');
    $('#modal-body').empty();
  });
}

function AddRegExpValidationRules(appointment) {
  var opts = {};
  opts.rules = {};
  var validationMethods = [];
  for (var propertyName in appointment) {
    if (appointment.hasOwnProperty(propertyName)) {
      var property = appointment[propertyName];
      for (var subAttribute in property) {
        var isRegExpPattern = (property.hasOwnProperty(subAttribute) && subAttribute === "validateRegexp");
        if (isRegExpPattern) {
          var name = 'pattern' + propertyName;
          var pattern = property[subAttribute];
          var re = new RegExp(pattern);
          var message = 'Wrong format, use ' + property['mask'] + '.';
          validationMethods.push(new RegExs(name, re, message, propertyName));
        }
      }
    }
  }
  for (i in validationMethods) {
    (function(validationMethod) {
      $.validator.addMethod(validationMethod.exprName,
        function(value, element) {
          return this.optional(element) || validationMethod.expr.test(value);
        },
        function(value, element) { return validationMethod.exprVM; }
      );
      $('#input' + validationMethod.exprAttr).attr('class','required ' + validationMethod.exprName);
    })(validationMethods[i]);
  }
}

function RegExs(exprName, expr, exprVM, exprAttr) {
    this.exprName = exprName;
    this.expr = expr;
    this.exprVM = exprVM;
    this.exprAttr = exprAttr;
}