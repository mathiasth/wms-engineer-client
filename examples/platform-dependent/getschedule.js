/*
  Platform dependent module for receiving an initial schedule for a specific user.
  Must implement and export a function "getScheduleData", accepting three parameters:

  IN: engineerid - the user to request the schedule for
  IN: dayOffset - relative day for which the schedule is being requested
  IN: l - reference to a custom winston logger

  OUT: Callback(error, schedule)

  This module needs to perform all necessary steps to get from the input data (engineerid, dayOffset)
  to a schedule for the engineer. Needs to return a JS object literal with the following structure:

  scheduledata = {
    "0": {
      "property1": "value1",
      "property2": "value2",
      "propertyN": "valueN",
    },
    "1": {
      "property1": "value1",
      "property2": "value2",
      "propertyN": "valueN",
    },
    "n": { ... }
  }

  This example module covers the steps to receive a schedule from the "Service Optimization Server" as
  part of the ClickSoftware product suite (http://www.clicksoftware.com).
*/

var config = require('../_config.js'),
        fs = require('fs'),
  libxmljs = require('libxmljs'),
      func = require('../functions.js');

function getScheduleData(engineerid, dayOffset, l, callback) {
  fs.readFile(__dirname+'/SXPEngineerGetSchedule.xml', function (error, xmldata) {
    if (error) {
      l.error('function gs.getScheduleData: Error reading message template from disk: ' + error);
    } else {
      // prepare data for message template modification
      // --dates
      var beginInterval, endInterval, dateHelper = new Date;
      dateHelper.setDate(dateHelper.getDate() + dayOffset);
      dateHelper = dateHelper.getFullYear() + '-' + (+dateHelper.getMonth() + 1) + '-' + dateHelper.getDate();
      beginInterval = dateHelper + 'T00:00:00';
      endInterval = dateHelper + 'T23:59:59';
      // --requested properties
      // --what is needed: <Item>PropertyName1</Item>\n<Item>PropertyName2</Item>
      var assignmentRequestedProperties = '', 
          taskRequestedProperties = '';
      for( var businessobjectNumber in config.logic.objectProperties ) {
        if( config.logic.objectProperties.hasOwnProperty(businessobjectNumber) ) {
          var property = config.logic.objectProperties[businessobjectNumber];
          if( property.belongsToObject == 'Assignment' ) {
            assignmentRequestedProperties += '\n<Item>' + property.propertyName + '</Item>';
          }
          if( property.belongsToObject == 'Task' ) {
            taskRequestedProperties += '\n<Item>' + property.propertyName + '</Item>';
          }
        }
      }
      // modify message template
      xmldata = xmldata.toString();
      if( xmldata.indexOf('%engineerid%') != -1 ) xmldata = xmldata.replace('%engineerid%', engineerid);
      if( xmldata.indexOf('%starttime%') != -1 ) xmldata = xmldata.replace('%starttime%', beginInterval);
      if( xmldata.indexOf('%finishtime%') != -1 ) xmldata = xmldata.replace('%finishtime%', endInterval);
      if( xmldata.indexOf('%taskRequestedProperties%') != -1 ) xmldata = xmldata.replace('%taskRequestedProperties%', taskRequestedProperties);
      if( xmldata.indexOf('%assignmentRequestedProperties%') != -1 ) xmldata = xmldata.replace('%assignmentRequestedProperties%', assignmentRequestedProperties);

      // post message to dispatching solution that requests the schedule
      l.debug('function gs.getScheduleData: About to post the following message to the dispatching solution: ' + xmldata);
      func.post(config.dispatch.postopts, xmldata, function(error,postRes) {
        if (error) {
          l.error('function gs.getScheduleData: Unable to retrieve schedule: ' + error);
        } else {
          var scheduledata = parseSchedule(postRes);
          // create clean schedule: skip tasks in statuses not mentioned in configuration
          var statesArray = func.stateDiagramToArray();
          var cleanedSchedule = {};
          var i = 0;
          for (var appointmentNumber in scheduledata) {
            if (scheduledata.hasOwnProperty(appointmentNumber)) {
              var appointment = scheduledata[appointmentNumber];
              var isValidStatus = (statesArray.indexOf(appointment[config.logic.statusProperty]) !== -1);
              if (isValidStatus) {
                cleanedSchedule[i] = scheduledata[appointmentNumber];
                i++;
              }
            }
          }
          callback(undefined, cleanedSchedule);
        }
      });
    }
  });
};

// function: parseSchedule
// Parse XML response and convert it to a JS object literal.
function parseSchedule(xmlSchedule) {
  var scheduledata = {}, 
      i = 0,
      appointment;

  // check if there is any <Appointment> in the response
  xmlDoc = libxmljs.parseXmlString(xmlSchedule);
  appointments = xmlDoc.find("/SXPEngineerGetScheduleResult/Appointments/Appointment");
  // loop through <Appointment> occurences
  while( i < appointments.length ) {
    scheduledata[i] = {};
    appointment = libxmljs.parseXmlString(appointments[i].toString());
    for( var propertyNumber in config.logic.objectProperties ) {
      if( config.logic.objectProperties.hasOwnProperty(propertyNumber) ) {
        var property = config.logic.objectProperties[propertyNumber];
        var propertyValue = appointment.get("/Appointment/" + property.belongsToObject + "/" + property.propertyName).text();
        scheduledata[i][property.propertyName] = propertyValue;
      }
    }
    i++;
  }
  return scheduledata;
};

exports.getScheduleData = getScheduleData;