/*
  Platform dependent module for sending integration messages to the dispatching solution.
  Those messages contain updates to appointments, caused by status transitions initiated by engineers
  using the webclient.

  Must implement a function sendIntegrationMessage(appointment, callback):
  
  IN: appointment - appointment after update
  OUT: Callback(error, http(s) post result)

  appointment = {
    "property1": "value1",
    "property2": "value2",
    "propertyN": "valueN"
  }

  This example module is here to define the place from which an outgoing message to a WFM-system should be sent. The message will update the appointment in the external system. appointment needs to be converted to some kind of structure the external system can work with.

*/

var config = require('../_config.js'),
        fs = require('fs'),
  libxmljs = require('libxmljs'),
      func = require('../functions.js'),
   sprintf = require('sprintf').sprintf;

function sendIntegrationMessage(appointment, callback) {
  console.log('Just imagine that an integration message has been sent, containing every detail or just parts of the following data, maybe also in a converted way: %s', JSON.stringify(appointment));
  callback(false, 'Success');
};

exports.sendIntegrationMessage = sendIntegrationMessage;