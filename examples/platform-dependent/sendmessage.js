/*
  Platform dependent module for sending integration messages to the dispatching solution.
  Those messages contain updates to appointments, caused by status transitions initiated by engineers
  using the webclient.

  Must implement a function sendIntegrationMessage(appointment, callback):
  
  IN: appointment - The body of a HTTP(s) post request
  OUT: Callback(error, http(s) post result)

  appointment = {
    "property1": "value1",
    "property2": "value2",
    "propertyN": "valueN"
  }

  This example module covers the functionality send SXP messages to the "Service 
  Optimization Server" as part of the ClickSoftware product suite (http://www.clicksoftware.com).

*/

var config = require('../_config.js'),
        fs = require('fs'),
      func = require('../functions.js'),
   sprintf = require('sprintf').sprintf;

function sendIntegrationMessage(appointment, callback) {
  fs.readFile(__dirname+'/SXPMultipleOperations.xml', function (error, xmldata) {
    if( error ) {
      console.log('getschedule: ' + error);
    } else {
      // remove all read only fields, all but appt-start/finish, status && identifier && number
      delete appointment['_assignedTo'];
      var propertiesToKeep = [
        config.logic.statusProperty,
        config.logic.assignmentStart,
        config.logic.assignmentFinish,
        config.logic.taskIdentifier,
        'Number'
      ];
      for (var propertyName in appointment) {
        if (appointment.hasOwnProperty(propertyName)) {
          var isAttributeToKeep = (propertiesToKeep.indexOf(propertyName) !== -1);
          
          var isReadOnlyAttribute = (config.logic.objectProperties[propertyName].readOnly);
          if (!isAttributeToKeep && isReadOnlyAttribute) {
            delete appointment[propertyName];
          }
        }
      }
      // convert data types to correct values
      appointment = func.convertAppointmentDatatypes(appointment, 'integrationmessage');
      // create needed xml structures
      // first: Assignment
      var assXML = '';
      assXML += '<Assignment>\n';
      for (var propertyName in appointment) {
        if (appointment.hasOwnProperty(propertyName)) {
          var isAssignmentAttribute = (config.logic.objectProperties[propertyName].belongsToObject === "Assignment");
          if (isAssignmentAttribute) {
            assXML += sprintf('<%s>%s</%s>\n', propertyName, appointment[propertyName], propertyName);
          }
        }
      }
      // need to add the appointment identifier manually...
      assXML += '<Task>';
      assXML += sprintf('<%s>%s</%s>\n', config.logic.taskIdentifier, appointment[config.logic.taskIdentifier], config.logic.taskIdentifier);
      assXML += sprintf('<%s>%s</%s>\n', 'Number', appointment['Number'], 'Number');
      assXML += '</Task>';
      assXML += '</Assignment>';

      // last: Task
      var taskXML = '';
      taskXML += '<Task>\n';
      for (var propertyName in appointment) {
        if (appointment.hasOwnProperty(propertyName)) {
          var isAssignmentAttribute = (config.logic.objectProperties[propertyName].belongsToObject === "Task");
          if (isAssignmentAttribute) {
            taskXML += sprintf('<%s>%s</%s>\n', propertyName, appointment[propertyName], propertyName);
          }
        }
      }
      taskXML += '</Task>';      

      // modify message template
      xmldata = xmldata.toString();
      if( xmldata.indexOf('%assignmentProperties%') != -1 ) xmldata = xmldata.replace('%assignmentProperties%', assXML);
      if( xmldata.indexOf('%taskProperties%') != -1 ) xmldata = xmldata.replace('%taskProperties%', taskXML);
      // post the prepared message to the dispatching solution
      func.post(config.dispatch.postopts, xmldata, function(error, result) {
        if( error ) {
          callback('Unable to send an update message to the dispatching solution: ' + error, false);
        } else {
          callback(false, result);
        }
      });
    }
  });
};

exports.sendIntegrationMessage = sendIntegrationMessage;