/*
  Platform dependent module for processing incoming integration messages from the dispatching solution.
  Must implement and export two functions:
  
  * function ProcessMessage(message, callback)

    IN: message - The body of a HTTP(s) post request
    OUT: Callback(error, appointmentObject)

    appointmentObject = {
      "properties": {
        "property1": "value1",
        "property2": "value2",
        "propertyN": "valueN",
      },
      "action": one of ['create','update','delete']
    }

  * function GenerateResponseMessage(success, action)

    IN: success - boolean, create successful response or with error
    IN: action - one of ['create','update','delete'], may be needed to generate correct message

  This example module covers the functionality to process incoming SXP messages from the "Service 
  Optimization Server" as part of the ClickSoftware product suite (http://www.clicksoftware.com).

  Required properties: Create & Update: all from config.logic.objectProperties
                       Delete: just config.logic.taskIdentifier & engineer identifier
*/

var config = require('../_config.js'),
  libxmljs = require('libxmljs'),
      func = require('../functions.js');

var knownMessages = new Array('AppointmentCreate','AppointmentUpdate','AppointmentDelete');

function ProcessMessage(message, callback) {
  var messageType = '';
  var appointmentObject = {};
  
  xmlDoc = libxmljs.parseXmlString(message);
  messageType = xmlDoc.root().name();
  var isCreate = (messageType === knownMessages[0]);
  var isUpdate = (messageType === knownMessages[1]);
  var isDelete = (messageType === knownMessages[2]);
  if (isCreate) {
    appointmentObject = ParseProperties(xmlDoc);
    if (appointmentObject !== false) {
      appointmentObject['action'] = 'create';
      console.log(appointmentObject);
      callback(undefined,appointmentObject);
    } else {
      callback('Integration message without engineer ID, processing not possible.', false);
    }
  } else if (isUpdate) {
    appointmentObject = ParseProperties(xmlDoc);
    if (appointmentObject !== false) {
      appointmentObject['action'] = 'update';
      callback(undefined,appointmentObject);
    } else {
      callback('Integration message without engineer ID, processing not possible.', false);
    }
  } else if (isDelete) {
    appointmentObject = ParseProperties(xmlDoc);
    if (appointmentObject !== false) {
      appointmentObject['action'] = 'delete';
      callback(undefined,appointmentObject);
    } else {
      callback('Integration message without engineer ID, processing not possible.', false);
    }
  } else {
    callback('Unknown message type received: ' + messageType, undefined);
  }
}

/*
  function GenerateResponseMessage
  IN: success (boolean)
      action (string)
  DESC: Generates response message for the incoming message depending on the success parameter which is getting set by the application.
*/

function GenerateResponseMessage(success, action) {
  var messagetype;
  switch (action) {
    case 'create':
      messagetype = knownMessages[0];
      break;
    case 'update':
      messagetype = knownMessages[1];
      break;
    case 'delete':
      messagetype = knownMessages[2];
      break;
  }
  if (success) {
    return '<' + messagetype + 'Result Status="1" />';
  } else {
    return '<' + messagetype + 'Result Status="2" />';
  }
}

// function: ParseProperties
// Parse message XML and convert it to a simple JS object
function ParseProperties(xmlDoc) {
  var appointmentObject = {};
  appointmentObject.properties = {};
  var messageType = '';
  var xpath = '';
  var childNode = {};

  messageType = xmlDoc.root().name();
  
  var childNode = xmlDoc.get("/" + messageType + "/Engineer");

  if (typeof childNode !== 'undefined') {
    appointmentObject.properties['_assignedTo'] = childNode.text();

    // get each configured property out of the XML
    for( var propertyNumber in config.logic.objectProperties ) {
      if( config.logic.objectProperties.hasOwnProperty(propertyNumber) ) {
        var property = config.logic.objectProperties[propertyNumber];
        xpath = "/" + messageType + "/" + property.belongsToObject + "/" + property.propertyName;
        var propertyFoundInMessage = ((xmlDoc.find(xpath)).length != 0);
        if (propertyFoundInMessage) {
          var propertyValue = xmlDoc.get(xpath).text();
          appointmentObject.properties[property.propertyName] = propertyValue;
        }
      }
    }
    return appointmentObject;    
  }
  else {
    return false;
  }
};

exports.ProcessMessage = ProcessMessage;
exports.GenerateResponseMessage = GenerateResponseMessage;