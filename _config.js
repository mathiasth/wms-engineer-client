var fs = require('fs');

var config = {};

config.dispatch = {};
config.mongo = {};
config.auth = {};
config.app = {};
config.logic = {};

// information about the dispatching solution to connect to
config.dispatch.host = '192.168.0.1';
config.dispatch.port = 8080;
config.dispatch.useSecureConnection = false;
config.dispatch.path = '/SO/IntegrationServices/sxpint.aspx';
config.dispatch.httpUser = 'httpuser';
config.dispatch.httpPass = '8765.de';
config.dispatch.localInterfacePort = 8001;
config.dispatch.useSecureLocalInterface = false;
config.dispatch.sslOptions = {
  //key: fs.readFileSync('cert-key.pem'),
  //cert: fs.readFileSync('cert-cert.pem'),
  requestCert: false,
  rejectUnauthorized: false,
  passphrase: "passwort"
};

// the ldap service to authenticate the user against
config.auth.host = '192.168.0.1';
config.auth.port = 3389;
config.auth.protocol = 'ldap';
config.auth.adminDn = 'CN=Administrator,CN=Users,DC=yourDomain,DC=com';
config.auth.adminPass = 'passwordOfAdmin';
config.auth.nameProp = 'sAMAccountName';
config.auth.searchBase = 'CN=Users,DC=yourDomain,DC=com';

// general application configuration
config.app.port = 8000;
config.app.host = '192.168.0.1';
config.app.useSecureConnection = false;
config.app.localProtocolHandler = (config.app.useSecureConnection) ? 'https' : 'http';
config.app.sslOptions = {
  //key: fs.readFileSync('cert-key.pem'),
  //cert: fs.readFileSync('cert-cert.pem'),
  requestCert: false,
  rejectUnauthorized: false,
  passphrase: "passwort"
};
config.app.sessionSecret = 'j4Tov2d3YDp92J2DdCiZMaLSOJRq';
config.app.DbHost = '127.0.0.1';
config.app.DbPort = 27017;
config.app.DbName = 'test';
config.app.logLevel = 'info' // one of ['all','debug','info','warn','error']


// fake a date: set to false if no fake, else 'yyyy-mm-ddT00:00:00', e.g. '2011-01-03'
config.logic.fakedate = '2012-09-01T00:00:00';

// Dripfeed: define the companies way of completing tasks.
// true: enabled. Only allow the engineer to work on the next task in line.
// false: disabled. Let the engineer decide on which task to work next.
config.logic.dripfeed = true;

/* set the application's state diagram, i.e. define the states and corresponding 
   transitions. A task in a state not defined here will not be shown anywhere in 
   the client, but may exist within the database.
   isComplete: set true for any status which is an end-state for a task, i.e. for
     which the engineer is required to supply start and finish time (time sheets)
*/

config.logic.stateDiagram = {
  0: {
    name: 'Dispatched',
    allowedTransitions: {
      0: 'Working',
      1: 'Declined'
    },
    isComplete: false
  },
  1: {
    name: 'Declined',
    allowedTransitions: {},
    isComplete: false
  },
  2: {
    name: 'Working',
    allowedTransitions: {
      0: 'Done',
      1: 'Partially done'
    },
    isComplete: false
  },
  3: {
    name: 'Done',
    allowedTransitions: {},
    isComplete: true
  },
  4: {
    name: 'Partially done',
    allowedTransitions: {},
    isComplete: true
  }
}

/* Define the object properties to be requested from the dispatching solution.
   Date masks for type 'duration' to be taken from http://momentjs.com/docs/#/parsing/string-format/
   type 'datetime', sourceformat 'iso' for any ISO-8601 date string up to "YYYY-MM-DDTHH:mm:ss z"
   type 'datetime': target format needs a blank between date and time, date MUST precede time.
*/
config.logic.objectProperties = {
  'Start': {
    propertyName: 'Start',
    belongsToObject: 'Task',
    displayName: 'Begin',
    readOnly: true,
    propertyType: {
      type: 'datetime',
      toFormat: 'DD.MM.YYYY HH:mm',
      validateRegexp: "^(0[1-9]|[12][0-9]|3[01])\\.(0[1-9]|1[012])\\.(19|20)\\d\\d\\s(2[0-3]|[01][0-9]):[0-5][0-9]$",
      sourceFormat: 'iso'
    },
    displayInSchedule: true
  },
  'Finish': {
    propertyName: 'Finish',
    belongsToObject: 'Task',
    displayName: 'End',
    readOnly: true,
    propertyType: {
      type: 'datetime',
      toFormat: 'DD.MM.YYYY HH:mm',
      validateRegexp: "^(0[1-9]|[12][0-9]|3[01])\\.(0[1-9]|1[012])\\.(19|20)\\d\\d\\s(2[0-3]|[01][0-9]):[0-5][0-9]$",
      sourceFormat: 'iso'
    },
    displayInSchedule: true
  },
  'ID': {
    propertyName: 'ID',
    belongsToObject: 'Task',
    displayName: 'ApptID',
    readOnly: true,
    propertyType: {
      type: 'string'
    },
    displayInSchedule: true
  },
  'Status': {
    propertyName: 'Status',
    belongsToObject: 'Task',
    displayName: 'Status',
    readOnly: true,
    propertyType: {
      type: 'string',
      xPathExtension: 'Name'
    },
    displayInSchedule: true
  },
  'TaskType': {
    propertyName: 'TaskType',
    belongsToObject: 'Task',
    displayName: 'Type',
    readOnly: true,
    propertyType: {
      type: 'string',
      xPathExtension: 'Name'
    },
    displayInSchedule: true
  },
  'Customer': {
    propertyName: 'Customer',
    belongsToObject: 'Task',
    displayName: 'Customer',
    readOnly: true,
    propertyType: {
      type: 'string'
    },
    displayInSchedule: true
  },
  'Comment': {
    propertyName: 'Comment',
    belongsToObject: 'Task',
    displayName: 'Notes',
    readOnly: false,
    propertyType: {
      type: 'string',
      maxlength: 64
    },
    displayInSchedule: false
  }
};

// Define the property name that holds the status information. This is the name as it appears in the integration messages.
config.logic.statusProperty = 'Status';
// Define the property name that holds the assignments start time. This is the name as it appears in the integration messages. The engineers schedules will be sorted by this property in ascending order.
config.logic.assignmentStart = 'Start';
// Define the property name that holds the assignments finish time. This is the name as it appears in the integration messages.
config.logic.assignmentFinish = 'Finish';
// Define the property that identifies a task. Must be unique in the dispatching solution.
config.logic.taskIdentifier = 'ID';


// POST options object literal
config.dispatch.postopts = {
  host: config.dispatch.host,
  port: config.dispatch.port,
  path: config.dispatch.path,
  method: 'POST',
  auth: config.dispatch.httpUser+':'+config.dispatch.httpPass
};

module.exports = config;
