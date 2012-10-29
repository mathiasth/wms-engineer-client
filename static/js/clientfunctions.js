/*
  Library of helper functions for engineer's web client.
*/

/*
  function ShowFlashMessage
  
  Generates HTML code for displaying flash messages.
  
  IN: type, type of the message to be shown
  IN: text, the text to display inside the flash message
  IN: permanent, true or false. Shows or hides the close button.

*/
function ShowFlashMessage(type, text, permanent) {
  var knownTypes = ['info', 'success', 'error'];
  var permanentCode = '';

  if (!permanent) {
    permanentCode = '<a class="close" data-dismiss="alert">×</a>';
  }
  
  if (text === undefined || text === '') {
    return '<div class="alert alert-error">' + permanentCode + 'Flash message text needs to be supplied!</div>';
  }
  
  var gotKnownType = (knownTypes.indexOf(type) !== -1);
  
  if (gotKnownType) {
    return '<div class="alert alert-' + type + '">' + permanentCode + text + '</div>';
  } else {
    return '<div class="alert alert-error">' + permanentCode + 'Flash message type is unknown! Use one of ' + knownTypes + '</div>';
  }
}

/*
  function GenerateStatusesPulldown
  
  Generates HTML code for the button dropdown. Relies on bootstrap.
  
  IN: statusWithTransition, possible status transitions for the appointment
  IN: functionalTaskID, the appointment identifier

*/

function GenerateStatusesPulldown(statusWithTransition, functionalTaskID) {
  var hasTransitions = (statusWithTransition.transitions !== -1);
  var htmlCode = '';
  
  htmlCode += '<div class="btn-group">';
  if (statusWithTransition.taskIsEditable) {
    if (hasTransitions) {
      htmlCode += '<a class="btn btn-primary"><i class="icon-pencil icon-white"></i> ' + statusWithTransition['value'] + '</a>';
      htmlCode += '<a class="btn btn-primary dropdown-toggle" data-toggle="dropdown"><span class="caret"></span></a>';
      htmlCode += '<ul class="dropdown-menu">';
      for (var transition in statusWithTransition.transitions) {
        var link = 'edit/' + functionalTaskID + '/'+ statusWithTransition.transitions[transition];
        htmlCode += '<li><a href="#transitionModal" id="modalOpen" data-action="' + link + '" data-toggle="modal"><i class="icon-share-alt"></i> to '+ statusWithTransition.transitions[transition] + '</a></li>';
      }
    } else {
      htmlCode += '<a class="btn btn-success disabled"><i class="icon-thumbs-up icon-white"></i> ' + statusWithTransition['value'] + '</a>';

    }
  } else {
    if (hasTransitions) {
      htmlCode += '<a class="btn btn-inverse disabled"><i class="icon-exclamation-sign icon-white"></i> ' + statusWithTransition['value'] + '</a>';
    } else {
      htmlCode += '<a class="btn btn-success disabled"><i class="icon-thumbs-up icon-white"></i> ' + statusWithTransition['value'] + '</a>';
    }
  }
  return htmlCode;
}

/*
  function GenerateModalContent
  
  Generates HTML code for the modal dialog content. Dynamic form creation. 
  
  IN: appointment, possible status transitions for the appointment
  IN: readonly, boolean, show "view" form or "edit" form

*/

function GenerateModalContent(appointment, readonly) {
  var gC = '';
  var inputDisabled = 'readonly="readonly"';
  var checkboxDisabled = 'disabled="disabled"';
  var checkboxIsChecked = 'checked="checked"';
  
  gC += '<form class="form-horizontal" id="appointmentForm">';
  gC += '<legend>Appointment details</legend>';
  
  appointment = FormatDataForPresentation(appointment);

  for (var propertyName in appointment) {

    var fieldState = '';
    var checkboxState = '';
    var checkboxReadonly = '';
    var maxlength = '';

    if (appointment.hasOwnProperty(propertyName)) {
      var property = appointment[propertyName];

      gC += '<div class="control-group">';
      gC += sprintf('<label class="control-label" for="input%s">%s</label>', propertyName, property['displayName']);
      gC += '<div class="controls">';

      if (!readonly) {
        if (property['readOnly']) {
          fieldState = inputDisabled;
          checkboxReadonly = checkboxDisabled;
        }
        switch (property['type']) {
          case 'datetime':
            gC += sprintf('<input type="text" name="%s" id="input%s" value="%s" %s>', propertyName, propertyName, property['value'], fieldState);
            break;
          case 'duration':
            gC += sprintf('<input type="text" name="%s" id="input%s" value="%s" %s>', propertyName, propertyName, property['value'], fieldState);
            break;
          case 'string':
            if (!property['readOnly']) {
              maxlength = sprintf('maxlength="%s"', property['maxlength']);
              var rows = GetTextAreaSize(property['value'], true, property['maxlength']);
            } else {
              var rows = GetTextAreaSize(property['value'], false);
            }
            gC += sprintf('<textarea name="%s" id="input%s" rows="%s" %s %s>%s</textarea>', propertyName, propertyName, rows, fieldState, maxlength, property['value']);
            break;
          case 'number':
            gC += sprintf('<input type="number" name="%s" id="input%s" value="%s" %s>', propertyName, propertyName, property['value'], fieldState);
            break;
          case 'boolean':
            if (property['value'] === true) {
              var checkboxState = checkboxIsChecked;
            }
            gC += sprintf('<input type="checkbox" name="%s" id="input%s" value="true" %s %s>', propertyName, propertyName,  checkboxReadonly, checkboxState);
            break;
        }
      } else {
        if (['string','number'].indexOf(property['type']) !== -1) {
          var rows = GetTextAreaSize(property['value'], false);
          gC += sprintf('<textarea id="input%s" name="%s" rows="%s" %s>%s</textarea>', propertyName, propertyName, rows, inputDisabled, property['value']);
        } else if (property['type'] === 'boolean') {
          if (property['value'] === true) {
            var checkboxState = checkboxIsChecked;
          }
          gC += sprintf('<input type="checkbox" name="%s" id="input%s" value="true" %s %s>', propertyName, propertyName,  checkboxDisabled, checkboxState);
        } else if (['datetime','duration'].indexOf(property['type']) !== -1) {
          gC += sprintf('<input type="text" name="%s" id="input%s" value="%s" %s>', propertyName, propertyName, property['value'], inputDisabled);
        }
      }
      gC += '</div>';
      gC += '</div>';
    }
  }
  gC += '</form>';

  return gC;
}

function GetTextAreaSize(content, maximize, maxlength) {
  if (maximize && typeof maxlength !== 'undefined') {
    var rows = Math.ceil(maxlength / 24);
    if (rows < 1) { 
      rows = 1;
    }
  } else {
    var rows = Math.ceil(content.length / 24);
    if (rows < 1) { 
      rows = 1;
    }
    var numberOfNewLinesInString = (content.split('\n').length);
    if (numberOfNewLinesInString > rows) {
      rows = numberOfNewLinesInString;
    }
  }
  return rows;
}


/*
  function FormatDataForPresentation(appointment)

  Convert datatypes of an appointment that has been sent by the backend (contains all helping attributes).
  IN: appointment literal, e.g.

  {
    "Start": {
      "type": "datetime",
      "displayName": "Begin",
      "readOnly": true,
      "mask": "dd.MM.yyyy HH:mm",
      "validateRegexp": "^(0[1-9]|[12][0-9]|3[01])\\.(0[1-9]|1[012])\\.(19|20)\\d\\d\\s(2[0-3]|[01][0-9]):[0-5][0-9]$",
      "value": "2011-01-03T08:27:00.000Z"
    },
    "Finish": {
      "type": "datetime",
      "displayName": "End",
      "readOnly": true,
      "mask": "dd.MM.yyyy HH:mm",
      "validateRegexp": "^(0[1-9]|[12][0-9]|3[01])\\.(0[1-9]|1[012])\\.(19|20)\\d\\d\\s(2[0-3]|[01][0-9]):[0-5][0-9]$",
      "value": "2011-01-03T08:57:00.000Z"
    }
    {...}
  }

  returns: edited appointment literal, for structure see IN, "value" converted to meet "mask".
*/
function FormatDataForPresentation(appointment) {
  for (var propertyName in appointment) {
    if (appointment.hasOwnProperty(propertyName)) {
      var property = appointment[propertyName];
      for (var subAttribute in property) {
        if (property.hasOwnProperty(subAttribute)) {
          if (subAttribute === 'mask') {
            var datetime = moment.utc(property['value']);
            appointment[propertyName]['value'] = datetime.format(property['mask']);
          }
        }
      }
    }
  }
  return appointment;
}


/*
  function FormatDataForTransmission(originalAppointment, serializedForm)

  Convert datatypes of the serializedForm object literal for transmission to the backend.
  IN: originalAppointment (appointment literal, for structure see function FormatDataForPresentation)
  IN: serializedForm, e.g.

  [{
    "name": "Start",
    "value": "03.01.2011 09:27"
  },
  {
  "name": "Finish",
  "value": "03.01.2011 09:57"
  },
  {...}]

  returns: edited serializedForm, for structure see IN(serializedForm), dates converted to ISO strings.
*/

function FormatDataForTransmission(originalAppointment, serializedForm) {
  for (var propertyName in originalAppointment) {
    if (originalAppointment.hasOwnProperty(propertyName)) {
      var property = originalAppointment[propertyName];
      for (var subAttribute in property) {
        if (property.hasOwnProperty(subAttribute)) {
          if (subAttribute === 'mask') {
            var datetime = moment.utc(serializedForm[propertyName], property['mask']);
            if (property['type'] === 'duration') {
              datetime.add('y',1970);
            }              
            serializedForm[propertyName] = datetime.format('YYYY-MM-DDTHH:mm:ss');
          }
        }
      }
    }
  }
  return serializedForm;
}


/*
  function ReformatSerializedForm(serializedForm)

  Convert

  [{
    "name": "Start",
    "value": "03.01.2011 09:27"
  },
  {
  "name": "Finish",
  "value": "03.01.2011 09:57"
  },
  {...}]

  to

  {
  "Start": "03.01.2011 09:27",
  "Finish": "03.01.2011 09:57",
  ...
  }
*/

function ReformatSerializedForm(serializedForm) {
  var updatedAppointment = {};
  for (var property in serializedForm) {
    updatedAppointment[serializedForm[property]['name']] = serializedForm[property]['value'];
  }
  return updatedAppointment;
}