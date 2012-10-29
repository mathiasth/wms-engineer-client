/*
  Platform dependent module for checking the authorization of the user trying to logon to the engineer
  webclient. Having a valid username and password is only one part of the process. This module makes sure
  whether the user is allowed to access the dispatching solution with the role "engineer".

  Must implement a function checkUsername(loginName, l, callback):
  
  IN: loginName
  IN: l - reference to a custom winston logger
  OUT: Callback(error, string engineer id)

  Check if (loginName) is a valid user in the dispatching solution. If no, return an error and false 
  for engineer id. If yes, return no error and the engineer's id.

  This example module contains a simple db of user names, that are said to have access to the WFM-system.
*/
var config = require('../_config.js');
var knownEngineers = {};
knownEngineers = {
  '10001': 'paul',
  '10002': 'peter'
};


function checkUsername(loginName, l, callback) {
  var userMatch = false;
  for (var i in knownEngineers) {
    if (knownEngineers.hasOwnProperty(i)) {
      userMatch = (loginName === knownEngineers[i]);
      if (userMatch) {
        callback(false, i);
        break;
      }
    }
  }
  if (!userMatch) {
    callback('Engineer is not administered in dispatching solution.', false);
  }
};

exports.checkUsername = checkUsername;
