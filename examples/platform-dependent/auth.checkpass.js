/*
  Platform dependent module for validating the password of the user, who is trying to logon to
  the engineer web client.

  Must implement a function checkPassword(username, password, l, callback):
  
  IN: username
  IN: password
  IN: l - reference to a custom winston logger
  OUT: Callback(error, boolean status of authentication)

  This example module covers the functionality to authenticate a user against an active directory service
  of Microsoft Windows Server 2008 using the LDAP protocol.

*/

var config = require('../_config.js');

function checkPassword(username, password, l, callback) {
  var LdapAuth = require('ldapauth');
  var options = {
    url: config.auth.protocol+'://'+config.auth.host+':'+config.auth.port,
    adminDn: config.auth.adminDn,
    adminPassword: config.auth.adminPass,
    searchBase: config.auth.searchBase,
    searchFilter: '('+config.auth.nameProp+'={{username}})'
  };

  if (password == '') {
    callback('You need to supply a password for the authentication.', false);
  } else {
    var auth = new LdapAuth(options);
    auth.authenticate(username, password, function(error, user) {
  	  if (error) {
	    l.error('function cp.checkPassword: ' + error);
      // security: Return same error messages to user for various error scenarios. No details to attackers.
	    var isErrorReturned = (error.toString().indexOf('InvalidCredentialsError') > -1 || error.toString().indexOf('no such user') > -1);
      if (isErrorReturned) {
	      callback('Invalid username or bad password, access is denied.', false);
        } else {
	      callback(error, false);
        }
      } else {
        callback(false, true); 
      }
    });
  }
};

exports.checkPassword = checkPassword;
