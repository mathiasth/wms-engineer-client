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
  libxmljs = require('libxmljs'),
      func = require('../functions.js'),
   sprintf = require('sprintf').sprintf;

function sendIntegrationMessage(appointment, callback) {
  console.log('Just imagine that an integration message has been sent, containing every detail or just parts of the following data, maybe also in a converted way: %s', JSON.stringify(appointment));
  callback(false, 'Success');
};

exports.sendIntegrationMessage = sendIntegrationMessage;