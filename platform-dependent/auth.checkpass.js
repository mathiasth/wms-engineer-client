/*
  Platform dependent module for validating the password of the user, who is trying to logon to
  the engineer web client.

  Must implement a function checkPassword(username, password, l, callback):
  
  IN: username
  IN: password
  IN: l - reference to a custom winston logger
  OUT: Callback(error, boolean status of authentication)

  This example module covers contains a simple user db for demonstration purposes only.

*/

var config = require('../_config.js');
var userDB = {};

userDB = {
  0: {
    username: 'mathias',
    password: 'test12'
  },
  1: {
    username: 'peter',
    password: 'peterspass'
  }
};

function checkPassword(username, password, l, callback) {
  var foundUsername = false;
  for (var i in userDB)  {
    if (userDB.hasOwnProperty(i)) {
      foundUsername = (userDB[i].username === username);
      if (foundUsername) {
        var passwordMatch = (userDB[i].password === password);
        if (passwordMatch) {
          callback(false, true);
          break;
        } else {
          callback('Password mismatch.', false);
          break;
        }
      }
    }
  }
  if (!foundUsername) {
    callback('User not found.', false);
  }
}

exports.checkPassword = checkPassword;
