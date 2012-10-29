/*
  Platform dependent module for checking the authorization of the user trying to logon to the engineer
  webclient. Having a valid username and password is only part of the process. This module makes sure
  whether the user is allowed to access the dispatching solution.

  Must implement a function checkUsername(loginName, l, callback):
  
  IN: loginName
  IN: l - reference to a custom winston logger
  OUT: Callback(error, string engineer id)

  Check if (loginName) is a valid user in the dispatching solution. If no, return an error and false 
  for engineer id. If yes, return no error and the engineer's id.

  This example module covers the functionality authorize a user against the Service Optimization Server as part of the ClickSoftware product suite (http://www.clicksoftware.com).
*/
var config = require('../_config.js'),
        fs = require('fs'),
  libxmljs = require('libxmljs'),
      func = require('../functions.js');

var xmlDoc, result, lowerCaseLoginName;

var engineer = {
  xml: '',
  loginName: '',
  active: '',
  engineerid: '',
};

function checkUsername(loginName, l, callback) {
  fs.readFile(__dirname+'/auth.getengineers.xml', function (error, xmldata) {
    if (error) {
      l.error('function cp.checkUsername: error reading message template from disk: ' + error);
    } else {
      // request a list of all registered engineers
      func.post(config.dispatch.postopts, xmldata, function(error,postRes) {
        if (error) {
          l.error('function cp.checkUsername: error receiving list of engineers: ' + error);
        } else {
          //have response, convert, search for user & check for active = 1
          lowerCaseLoginName = loginName.toLowerCase();
          xmlDoc = libxmljs.parseXmlString(postRes);
          // find login name in xml structure, get engineer element and then extract values
          // libxmljs uses libxml2, which does not support xpath 2.0 queries, therefore translate()
          // search could be done with 1 big query in the large document. better performance with more queries on a tiny document.
          engineer.xml = xmlDoc.find("/SXPServerGetObjectsResult/Objects/Engineer[translate(LoginName, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')='" + lowerCaseLoginName + "']");
          if( engineer.xml != 0 ) {
            engineer.xml = libxmljs.parseXmlString(engineer.xml);
            engineer.loginName = engineer.xml.find("/Engineer/LoginName/text()");
            engineer.active = engineer.xml.find("/Engineer/Active/text()");
            engineer.engineerid = engineer.xml.find("/Engineer/ID/text()");
            if( engineer.active == '1' ) {
              callback(false, engineer.engineerid);
            } else {
              callback('Your account is marked inactive within the dispatching solution. Please consult your support team.', false);
            }
          } else {
            callback('Invalid username or password, access is denied.', false);
          }
        }
      });
    }
  });
};

exports.checkUsername = checkUsername;
