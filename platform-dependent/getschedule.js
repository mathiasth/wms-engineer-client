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

  Positive callback (i.e. without error) must be called in case of an empty schedule.

  This example module covers the steps to receive a schedule from the "Service Optimization Server" as
  part of the ClickSoftware product suite (http://www.clicksoftware.com).
*/

var config = require('../_config.js'),
      func = require('../functions.js');

var scheduleDB = {};
scheduleDB = {
  '10002': {
    0: {
      'Start': '2012-09-01T09:00:00',
      'Finish': '2012-09-01T09:45:00',
      'ID': 'A|00001',
      'Status': 'Dispatched',
      'TaskType': 'Remote Support',
      'Customer': 'Parker, Peter',
      'Comment': 'Reports "Web unavailable" error'
    }, 
    1: {
      'Start': '2012-09-01T12:50:00',
      'Finish': '2012-09-01T13:05:00',
      'ID': 'A|00002',
      'Status': 'Dispatched',
      'TaskType': 'Hardware Support',
      'Customer': 'Wayne, Bruce',
      'Comment': 'Batmobile engine stutters when driving upside-down'
    }
  }
};

function getScheduleData(engineerid, dayOffset, l, callback) {
  var foundSchedule = false;
  for (var engineer in scheduleDB) {
    if (scheduleDB.hasOwnProperty(engineer) && engineerid === engineer) {
      foundSchedule = true;
      var engineersSchedule = scheduleDB[engineer];
      if (func.ObjectWithProperties(engineersSchedule)) {
        callback(false, engineersSchedule);
        break;        
      } else {
        // empty schedule
        callback(false,{});
      }
    }
  }
  if (!foundSchedule) {
    // engineer not found
    callback('Engineer not found.', false);
  }
};


exports.getScheduleData = getScheduleData;