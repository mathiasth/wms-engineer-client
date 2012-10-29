var cu         = require('./platform-dependent/auth.checkuser.js'),
    cp         = require('./platform-dependent/auth.checkpass.js'),
    gs         = require('./platform-dependent/getschedule.js'),
    pm         = require('./platform-dependent/processmessage.js'),
    sm         = require('./platform-dependent/sendmessage.js'),
    conf       = require('./_config.js'),
    http       = require('http'),
    moment     = require('moment'),
    winston    = require('winston')
    sprintf    = require('sprintf').sprintf;

var l = new (winston.Logger)({
  levels: {
    all: 0,
    debug: 1,
    info: 2,
    warn: 3,
    error: 4
  },
  transports: [
    new (winston.transports.Console)({
      timestamp: function() {
        return moment().format('YYYY-MM-DDTHH:mm:ss');
      },
      level: conf.app.logLevel
    })
  ]
});

/*
  function authenticate(username, password, callback)
  IN: username - reference to the database appointments collection
  IN: password - technical ID of the session requesting a schedule
  OUT: Callback(error, engineerid)

  Calls the platform dependent functions cp.checkPassword and cu.checkUsername.
  * checkPassword verifies the vadility of the combination of (username) and (password)
    against e.g. an LDAP directory. Returns true or false.
  *  checkUsername verifies if the username is known in the dispatching solution and returns,
    if found, his engineer id.
  
  checkPassword is considered to be cheaper than checkUsername, that is why it is called first.
*/

function authenticate(username, password, callback) {
  cp.checkPassword(username, password, l, function(error, status) {
    if (error) {
      l.error(sprintf('function authenticate(%s) - checkPassword: %s', username, error));
      callback(error, false);
    } else {
      // Successful password check, now check for user in dispatching solution
      // cu.checkUsername() returns identification (e.g. ID value) for an engineer
      l.debug(sprintf('function authenticate - checkPassword for %s.', username));
      cu.checkUsername(username, l, function(error, engineerid) {
        if (error) {
          l.error(sprintf('function authenticate - checkUsername: %s', error));
          callback(error, false);
        } else {
          l.debug(sprintf('function authenticate - checkUsername for %s', username));
          callback(null, engineerid);
        }
      });
    }
  });
};

/*
  function getScheduleData(Appts, sessionID, dayOffset, callback)
  IN: Appts - reference to the database appointments collection
  IN: sessionID - technical ID of the session requesting a schedule
  IN: dayOffset - relative day for which the schedule is being requested
  OUT: Callback(error, compactSchedule)

  Calls the platform dependent function gs.getScheduleData, that requests the schedule for
  the engineer behind (sessionID). Expects it to return an object literal in the format:

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

  Property values of the received schedule are converted to database-compatible types and saved.
  The schedule for the engineer is getting compiled and returned to the caller, that sends it
  to the engineer.
*/

function getScheduleData(Appts, sessionID, dayOffset, callback) {
  mongoStore.get(sessionID, function(error, sessiondata) {
    l.debug('function getScheduleData: requesting schedule for session: ', sessiondata);
    if (error) {
      l.error(sprintf('function getScheduleData: mongoStore.get has failed: %s', error));
      callback(error, undefined);
    } else {
      gs.getScheduleData(sessiondata.engineerid, dayOffset, l, function(error, scheduledata) {
        if (error) {
          l.error(sprintf('function getScheduleData: gs.getScheduleData has failed: %s', error));
          callback(error, undefined);
        } else {
          l.all(sprintf('function getScheduleDataSuccess: gs.getScheduleData(%s) has returned with %s', sessiondata.engineerid, JSON.stringify(scheduledata)));
          // save schedule in database
          initiallySaveScheduleData(Appts, sessiondata.engineerid, scheduledata, function(error, status) {
            if (error) {
              l.error(sprintf('function getScheduleData: initiallySaveScheduleData for %s has failed with %s', sessiondata.engineerid, error));
              callback(error, undefined);
            } else {
              // prepare schedule compact view
              l.all(sprintf('function getScheduleDataSuccess: initiallySaveScheduleData(%s) has returned with %s.', sessiondata.engineerid, status));
              PrepareScheduleViewForEngineerIDs(Appts, [sessiondata.engineerid], dayOffset, function(error, compactSchedule) {
                if (error) {
                  l.error(sprintf('function getScheduleData: PrepareScheduleViewForEngineerIDs(%s) has failed: %s', sessiondata.engineerid, error));
                  callback(error, undefined);
                } else {
                  // back to app.js
                  l.all(sprintf('function getScheduleDataSuccess: PrepareScheduleViewForEngineerIDs has returned a schedule: %s', JSON.stringify(compactSchedule)));
                  callback(false, compactSchedule[sessiondata.engineerid]);
                }
              });
            }
          });
        }
      });
    }
  });
}

/*
  function initiallySaveScheduleData(Appts, engineerid, schedule, callback)
  IN: Appts - reference to the database appointments collection
  IN: engineerid - the id of the engineer the (schedule) belongs to
  IN: schedule - object literal containing the schedule for an engineer (unordered)
  OUT: Callback(error, boolean status)

  Stores the initial schedule of an engineer to the database. Removes any existing appointment
  for the engineer in the beginning. Uses recursion for inserting the appointments to avoid
  EventLoop trouble.
*/

function initiallySaveScheduleData(Appts, engineerid, schedule, callback) {
  // save the initial schedule in db.appointments. Remove all possibly existing appointments for the ressource
  Appts.remove({'_assignedTo': engineerid});
  var appointmentsToSave = new Array;
  var saveError = '';
  for (var assignmentNumber in schedule) {
    if (schedule.hasOwnProperty(assignmentNumber)) {
      var appointment = schedule[assignmentNumber];
      var formattedAppointment = convertAppointmentDatatypes(appointment, 'db');
      formattedAppointment['_assignedTo'] = engineerid;
      appointmentsToSave.push(formattedAppointment);
    }
  }

  function InsertAppointmentsToDatabase(i) {
    if (i < appointmentsToSave.length) {
      Appts.insert(appointmentsToSave[i], function(error, document) {
        if (error) {
          l.error(sprintf('function InsertAppointmentsToDatabase: Database operation has failed: %s', error));
          saveError = error;
        } else {
          InsertAppointmentsToDatabase(i+1);
        }
      });
    } else {
      // the complete schedule has been added to the database. callback positively to proceed.
      if (saveError) {
        l.error(sprintf('function InsertAppointmentsToDatabase: Saving initial schedule failed: %s', saveError));
        callback(saveError, false);
      } else {
        l.debug(sprintf('function InsertAppointmentsToDatabaseSuccess: Saved schedule for %s to database.', engineerid));
        callback(undefined, true);
      }
    }
  }
  if (appointmentsToSave.length > 0) {
    InsertAppointmentsToDatabase(0);
  } else {
    // schedule is empty, positive callback to proceed.
    l.debug(sprintf('function InsertAppointmentsToDatabaseSuccess: Empty schedule for %s.', engineerid));
    callback(undefined, true);
  }
}

/*
  function ProcessIncomingMessage(Appts, Sess, sio, req, callback)
  IN: Appts - reference to the database appointments collection
  IN: Sess - reference to the database session collection
  IN: sio - reference to the socket object
  IN: req - the raw HTTP(s) request received from the dispatching solution
  OUT: Callback(error, HTTP response)

  Processes all integration messages received from the dispatching solution. Those may only be
  of the kind
  - appointment create
  - appointment update
  - appointment delete
  Calls the platform dependent function "ProcessMessage", which processes the proprietary content
  of (req.body). Expects an object literal to be returned with the following structure (example):

  appointmentObject = {
    "properties": {
      "property1": "value1",
      "property2": "value2",
      "propertyN": "valueN",
    },
    "action": one of ['create','update','delete']
  }

  Updates the appointment collection with the received information.
  Generates the needed socket events to keep all engineers and their sessions updated.
*/

function ProcessIncomingMessage(Appts, Sess, sio, req, callback) {
  var affectedEngineers = new Array;
  var query = {};
  
  l.all(sprintf('function ProcessIncomingMessage: Received an incoming message from dispatching system: %s', req));
  pm.ProcessMessage(req, function(error, appointmentObject) {
    if (error) {
      l.error(sprintf('function ProcessIncomingMessage: pm.ProcessMessage has returned %s', error));
      callback(error, false)
      // callback with error
    } else {
      l.all(sprintf('function ProcessIncomingMessageSuccess: pm.ProcessMessage has returned an appointment: %s', JSON.stringify(appointmentObject)));
      // got appointmentObject with action to take, convert data types
      appointmentObject.properties = convertAppointmentDatatypes(appointmentObject.properties, 'db');
      affectedEngineers.push(appointmentObject.properties['_assignedTo']);
      switch (appointmentObject.action) {
        case 'create':
          // check for an active user session for the engineer that the appointment is assigned to
          // ignore the message when there is no session
          GetSessionsByEngineerIDs(affectedEngineers, Sess, function (error, sessionIds) {
            if (error) {
               l.error(sprintf('function ProcessIncomingMessage: CREATE: GetSessionsByEngineerIDs(%s) has failed: %s', affectedEngineers, error));
               callback(error, false);
            } else {
              l.all('function ProcessIncomingMessage: Incoming message affects these sessions: ', sessionIds);
              var haveSessionForEngineersAppointment = (sessionIds.length > 0);
              if (haveSessionForEngineersAppointment) {
                Appts.insert(appointmentObject.properties, function(error, document) {
                  if (error) {
                    l.error(sprintf('function ProcessIncomingMessage: Inserting the appointment ---(%s)--- has failed: %s', JSON.stringify(appointmentObject.properties), error));
                    callback(error, pm.GenerateResponseMessage(false, appointmentObject.action));
                  } else {
                    l.all('function ProcessIncomingMessage: Successfully inserted appointment to database.');
                    // send new schedule (1)
                    PrepareScheduleViewForEngineerIDs(Appts, affectedEngineers, getDayOffset(), function(error, compactSchedule) {
                      if (error) {
                        l.error(sprintf('function ProcessIncomingMessage: PrepareScheduleViewForEngineerIDs(%s) has failed with: %s', affectedEngineers, error));
                        callback(error, pm.GenerateResponseMessage(false, appointmentObject.action));
                      } else {
                        l.all(sprintf('function ProcessIncomingMessage: PrepareScheduleViewForEngineerIDs has returned a schedule to be sent to %s:', affectedEngineers), compactSchedule);
                        for (var sessionIndex in sessionIds.sessionID) {
                          l.debug(sprintf('function ProcessIncomingMessageSuccess: Need to send a new schedule to engineer %s because of appointment %s.', sessionIds.engineerID[sessionIndex], appointmentObject.properties[conf.logic.taskIdentifier]));
                          sio.sockets.in(sessionIds.sessionID[sessionIndex]).emit('sendschedule', compactSchedule[sessionIds.engineerID[sessionIndex]]);
                        }
                      }
                    });
                    // Incoming message has been successfully processed. Send positive feedback.
                    callback(undefined, pm.GenerateResponseMessage(true, appointmentObject.action));
                  }
                });
              } else {
                // the message has been ignored because there is no active user session for the assigned engineer. Send a successful response to the dispatching solution either.
                l.debug(sprintf('function ProcessIncomingMessage: Message for task %s has been ignored, because there was no affected active user session.', appointmentObject.properties[conf.logic.taskIdentifier]));
                callback(undefined, pm.GenerateResponseMessage(true, appointmentObject.action));
              }
            } // end if from error handling of GetSessionsByEngineerIDs
          });
          break;
          
        case 'update':
          // find out whether the appointment already existed and if a second engineer will need a schedule update
          query[conf.logic.taskIdentifier] = appointmentObject.properties[conf.logic.taskIdentifier];
          l.all('function ProcessIncomingMessage: UPDATE: Getting old appointment from DB with query:', query);
          Appts.findOne(query, function(error, oldAppointment) {
            if (error) {
              l.error(sprintf('function ProcessIncomingMessage: UPDATE: Failed to fetch old appointment: %s', error));
              callback(error, pm.GenerateResponseMessage(false, appointmentObject.action));
            } else if (oldAppointment !== null) {
              // already having the old version of the appointment
              // check if there is a session for the assigned engineer of the new appiontment. If not, delete the appointment.
              GetSessionsByEngineerIDs(affectedEngineers, Sess, function (error, sessionIds) {
                if (error) {
                  l.error(sprintf('function ProcessIncomingMessage: UPDATE: GetSessionsByEngineerIDs(%s) has failed: %s', affectedEngineers, error));
                  callback(error, false);
                } else {
                  if (sessionIds.length !== 0) {
                    // have an active session for the new engineer, update the appointment.
                    var secondEngineerAffected = (affectedEngineers[0] !== oldAppointment['_assignedTo']);
                    if (secondEngineerAffected) {
                      affectedEngineers.push(oldAppointment._assignedTo);
                    }
                    Appts.updateById(oldAppointment._id, appointmentObject.properties, function(error, updatedCount) {
                      if (error) {
                        l.error(sprintf('function ProcessIncomingMessage: UPDATE: Appointment db update has failed: %s', error), appointmentObject.properties);
                        callback(error, pm.GenerateResponseMessage(false, appointmentObject.action));
                      } else {
                        // Update in DB successful. We know that the new engineer is connected to the system. Find out whether there is someone else to notify.
                        l.all(sprintf('function ProcessIncomingMessage: UPDATE: Appointment %s has been updated successfully in database.', oldAppointment[conf.logic.taskIdentifier]));
                        GetSessionsByEngineerIDs(affectedEngineers, Sess, function (error, sessionIds) {
                          if (error) {
                            callback(error, pm.GenerateResponseMessage(false, appointmentObject.action));
                          } else if (sessionIds.length !== 0) {
                            l.all('function ProcessIncomingMessage: UPDATE: Incoming message affects these sessions: ', sessionIds);
                            // send new schedule (x)
                            PrepareScheduleViewForEngineerIDs(Appts, sessionIds.engineerID, getDayOffset(), function(error, compactSchedule) {
                              if (error) {
                                l.error(sprintf('function ProcessIncomingMessage: PrepareScheduleViewForEngineerIDs(%s) has failed with: %s', affectedEngineers, error));
                                callback(error, pm.GenerateResponseMessage(false, appointmentObject.action));
                              } else {
                                for (var sessionIndex in sessionIds.sessionID) {
                                  l.debug(sprintf('function ProcessIncomingMessageSuccess: Need to send a new schedule to engineer %s because of appointment %s.', sessionIds.engineerID[sessionIndex], oldAppointment[conf.logic.taskIdentifier]));
                                  sio.sockets.in(sessionIds.sessionID[sessionIndex]).emit('sendschedule', compactSchedule[sessionIds.engineerID[sessionIndex]]);
                                }
                              }
                            });
                            callback(undefined, pm.GenerateResponseMessage(true, appointmentObject.action));
                          } else if (sessionIds.length === 0) {
                            l.all(sprintf('function ProcessIncomingMessage: UPDATE: Did not find any active user session to update because of appointment %s', oldAppointment[conf.logic.taskIdentifier]));
                            callback(undefined, pm.GenerateResponseMessage(true, appointmentObject.action));
                          }
                        });
                      }
                    });
                  } else if (sessionIds.length === 0) {
                    // don't have an active session for the new engineer, delete the appointment and notify the old engineer (if there is one). the query stays the same, just the operation changes to "remove".
                    l.all(sprintf('function ProcessIncomingMessage: UPDATE: Going to delete appointment %s because the assigned engineer is offline. Query is:', oldAppointment[conf.logic.taskIdentifier]), query);
                    Appts.remove(query, function(error) {
                      if (error) {
                        l.error(sprintf('function ProcessIncomingMessage: db error when removing appointment %s: %s', oldAppointment[conf.logic.taskIdentifier], error));
                        callback(error, pm.GenerateResponseMessage(false, appointmentObject.action));
                      } else {
                        l.debug(sprintf('function ProcessIncomingMessage: UPDATE: Appointment %s has been removed from db.', oldAppointment[conf.logic.taskIdentifier]));
                        // look for a session for the old assigned engineer. if there is one, resend schedule
                        GetSessionsByEngineerIDs([oldAppointment._assignedTo], Sess, function (error, sessionIds) {
                          if (error) {
                            l.error(sprintf('function ProcessIncomingMessage: UPDATE: GetSessionsByEngineerIDs(%s) has failed: %s', [oldAppointment._assignedTo], error));
                            callback(error, pm.GenerateResponseMessage(false, appointmentObject.action));
                          } else if (sessionIds.length === 1) {
                            l.all('function ProcessIncomingMessage: UPDATE: Incoming message affects these sessions: ', sessionIds);
                            // send new schedule (1, old)
                            PrepareScheduleViewForEngineerIDs(Appts, sessionIds.engineerID, getDayOffset(), function(error, compactSchedule) {
                              if (error) {
                                l.error(sprintf('function ProcessIncomingMessage: PrepareScheduleViewForEngineerIDs(%s) has failed with: %s', sessionIds.engineerID, error));
                                callback(error, pm.GenerateResponseMessage(false, appointmentObject.action));
                              } else {
                                // multiple logins, meaning the same engineer might be connected with two or more different sessionids at the same time.
                                for (var sessionIndex in sessionIds.sessionID) {
                                  l.debug(sprintf('function ProcessIncomingMessageSuccess: Need to send a new schedule to engineer %s because of appointment %s.', sessionIds.engineerID[sessionIndex], oldAppointment[conf.logic.taskIdentifier]));
                                  sio.sockets.in(sessionIds.sessionID[sessionIndex]).emit('sendschedule', compactSchedule[sessionIds.engineerID[sessionIndex]]);
                                }
                              }
                            });
                            callback(undefined, pm.GenerateResponseMessage(true, appointmentObject.action));
                          } else if (sessionIds.length !== 1) {
                            // there was no session for the old engineer, nothing to do here. just send positive response to the dispatching solution.
                            callback(undefined, pm.GenerateResponseMessage(true, appointmentObject.action));
                          }
                        });
                      }
                    });
                  }
                } // end if from error handling of GetSessionsByEngineerIDs
              });
            } else if (oldAppointment === null) {
              // there is no old version of the appointment. need to create it, if the new assigned engineer has an active user session.
              l.all(sprintf('function ProcessIncomingMessage: UPDATE: No old version of appointment %s found, need to create it in case of the assigned engineer being online.', appointmentObject.properties[conf.logic.taskIdentifier]));
              GetSessionsByEngineerIDs(affectedEngineers, Sess, function (error, sessionIds) {
                if (error) {
                  l.error(sprintf('function ProcessIncomingMessage: UPDATE: GetSessionsByEngineerIDs(%s) has failed: %s', affectedEngineers, error));
                  callback(error, pm.GenerateResponseMessage(false, appointmentObject.action));
                } else if (sessionIds.length !== 0) {
                  l.all('function ProcessIncomingMessage: UPDATE: Incoming message affects these sessions: ', sessionIds);
                  // have an active user session for that appointment, insert it
                  Appts.insert(appointmentObject.properties, function(error, document) {
                    if (error) {
                      l.error(sprintf('function ProcessIncomingMessage: Inserting the appointment ---(%s)--- has failed: %s', JSON.stringify(appointmentObject.properties), error));
                      callback(error, pm.GenerateResponseMessage(false, appointmentObject.action));
                    } else {
                      l.debug('function ProcessIncomingMessage: Successfully inserted appointment to database.');
                      // send new schedule (1)
                      PrepareScheduleViewForEngineerIDs(Appts, sessionIds.engineerID, getDayOffset(), function(error, compactSchedule) {
                        if (error) {
                          l.error(sprintf('function ProcessIncomingMessage: PrepareScheduleViewForEngineerIDs(%s) has failed with: %s', sessionIds.engineerID, error));
                          callback(error, pm.GenerateResponseMessage(false, appointmentObject.action));
                        } else {
                          // multiple logins, meaning the same engineer might be connected with two or more different sessionids at the same time.
                          for (var sessionIndex in sessionIds.sessionID) {
                            l.debug(sprintf('function ProcessIncomingMessageSuccess: Need to send a new schedule to engineer %s because of appointment %s.', sessionIds.engineerID[sessionIndex], appointmentObject.properties[conf.logic.taskIdentifier]));
                            sio.sockets.in(sessionIds.sessionID[sessionIndex]).emit('sendschedule', compactSchedule[sessionIds.engineerID[sessionIndex]]);
                          }
                        }
                      });
                      callback(undefined, pm.GenerateResponseMessage(true, appointmentObject.action));
                    }
                  });
                } else if (sessionIds.length === 0) {
                  // don't have an active user session for that appointment, ignore
                  l.debug(sprintf('function ProcessIncomingMessage: UPDATE: %s is offline, ignoring message for appointment %s.', affectedEngineers, appointmentObject.properties[conf.logic.taskIdentifier]));
                  callback(undefined, pm.GenerateResponseMessage(true, appointmentObject.action));
                }
              });
            }
          });
          break;
          
        case 'delete':
          query[conf.logic.taskIdentifier] = appointmentObject.properties[conf.logic.taskIdentifier];
          l.all('function ProcessIncomingMessage: DELETE: Removing appointment from db with query:', query);
          Appts.remove(query, function(error, deletedCount) {
            if (error) {
              l.error(sprintf('function ProcessIncomingMessage: DELETE: Removing appointment %s from database failed: %s', appointmentObject.properties[conf.logic.taskIdentifier], error));
              callback(error, pm.GenerateResponseMessage(false, appointmentObject.action));
            } else {
              l.debug(sprintf('function ProcessIncomingMessage: DELETE: Appointment %s has been deleted from the db.', appointmentObject.properties[conf.logic.taskIdentifier]));
              GetSessionsByEngineerIDs(affectedEngineers, Sess, function (error, sessionIds) {
                if (error) {
                  l.error(sprintf('function ProcessIncomingMessage: DELETE: GetSessionsByEngineerIDs(%s) has failed: %s', affectedEngineers, error));
                  callback(error, pm.GenerateResponseMessage(false, appointmentObject.action));
                } else if (sessionIds.length !== 0) {
                  l.all('function ProcessIncomingMessage: DELETE: Incoming message affects these sessions: ', sessionIds);
                  // found an active user session for the deleted appointment. notify the user.
                  PrepareScheduleViewForEngineerIDs(Appts, sessionIds.engineerID, getDayOffset(), function(error, compactSchedule) {
                    if (error) {
                      l.error(sprintf('function ProcessIncomingMessage: DELETE: PrepareScheduleViewForEngineerIDs(%s) has failed with: %s', sessionIds.engineerID, error));
                      callback(error, pm.GenerateResponseMessage(false, appointmentObject.action))
                    } else {
                      // multiple logins, meaning the same engineer might be connected with two or more different sessionids at the same time.
                      for (var sessionIndex in sessionIds.sessionID) {
                        l.debug(sprintf('function ProcessIncomingMessageSuccess: DELETE: Need to send a new schedule to engineer %s because of appointment %s.', sessionIds.engineerID[sessionIndex], appointmentObject.properties[conf.logic.taskIdentifier]));
                        sio.sockets.in(sessionIds.sessionID[sessionIndex]).emit('sendschedule', compactSchedule[sessionIds.engineerID[sessionIndex]]);
                      }
                    }
                  });
                  callback(undefined, pm.GenerateResponseMessage(true, appointmentObject.action));
                } else if (sessionIds.length === 0) {
                  // assigned engineer is not connected anymore. deleted the appointment anyway.
                  callback(undefined, pm.GenerateResponseMessage(true, appointmentObject.action));
                }
              });
            }
          });
          break;
      }
    }
  });
}

/*
  function GetSessionsByEngineerIDs(engineerids, Sess, callback)
  IN: engineerids - an array of engineer ids
  IN: Sess - reference to the database session collection
  OUT: Callback(error,foundSessions) - object literal containing arrays of session ids and engineer ids

  Finds the session ids to given engineer ids. Used to create the link between engineers 
  (sent by the dispatching solution) and user sessions in the browser. Why sub arrays and not
  sub documents? There is no fixed order in documents. In contrast to that, arrays have a fixed order.

  foundSessions = {
    sessionID: ["RNnWruvg2Gga9WCHtq7loa/q", "6UqLUb9bnZwvX1hSQIPUg>Od"],
    engineerID: ["10007", "10009"],
    length: 2
  }
*/

function GetSessionsByEngineerIDs(engineerids, Sess, callback) {
  var now = moment().subtract('hours', 4);
  var query = {};
  var i = 0;
  var resultCount = 0;
  var foundSessions = {};
  
  foundSessions['sessionID'] = new Array;
  foundSessions['engineerID'] = new Array;
  
  l.all(sprintf('function GetSessionsByEngineerIDs: Looking for user sessions for engineer ids %s', engineerids));

  Sess.find(query, function (error, sessions) {
    if (error) {
      l.error(sprintf('function GetSessionsByEngineerIDs: db.find has returned with: ', error));
      callback(error, false);
    } else {
      while (i < sessions.length) {
        var session = JSON.parse(sessions[i]['session']);
        var isActiveSession = (session.engineerid !== undefined);
        if (isActiveSession) {
          var isEngineerIDInSession = (engineerids.indexOf(session.engineerid) !== -1);
          if (isEngineerIDInSession) {
            foundSessions['sessionID'].push(sessions[i]['_id']);
            foundSessions['engineerID'].push(session.engineerid);
            resultCount++;
          }
        }
        i++;
      }
      foundSessions['length'] = resultCount;
      l.all(sprintf('function GetSessionsByEngineerIDsSuccess: Returning %s sessions for %s.', resultCount, engineerids));
      callback(undefined, foundSessions);
    }
  });
}

/*
  function post(target, body, callback)
  IN: target - source status
  IN: body - destination status
  OUT: Callback(error,buffer)

  Carries out an HTTP(S) post request to (target) with (body) and returns the 
  response to the caller on request completion.
*/

function post(target, body, callback) {
  var buffer = '';
  
  function ProcessResponse(res) {
    res.setEncoding('utf8');
    res.on('data', function (chunk) {
      // get all chunks together
      buffer += chunk;
    });
    res.on('end', function () {
      // return the complete response to the caller
      callback(false,buffer);
    });
  }

  if (conf.dispatch.useSecureConnection) {
    var req = https.request(target, function(res) {
      ProcessResponse(res);
    });
  } else {
    var req = http.request(target, function(res) {
      ProcessResponse(res);
    });
  }

  req.on('error', function(e) {
    callback(e.message,undefined);
  });

  // write data to request body
  req.write(body);
  req.end(); 
};

/*
  function isStatusTransitionValid(fromStatus, toStatus)
  IN: fromStatus - source status
  IN: toStatus - destination status
  OUT: boolean

  Checks the vadility of the requested status transition.
*/

function isStatusTransitionValid(fromStatus, toStatus) {
  for (var entry in conf.logic.stateDiagram) {
    if (conf.logic.stateDiagram.hasOwnProperty(entry)) {
      var transition = conf.logic.stateDiagram[entry];
      for (var element in transition) {
        if (transition.hasOwnProperty(element) && transition.name === fromStatus) {
          var destinationStatuses = transition.allowedTransitions;
          for (var destinationStatus in destinationStatuses) {
            if (destinationStatuses.hasOwnProperty(destinationStatus) && destinationStatuses[destinationStatus] == toStatus ) {
              return true;
            }
          }
        }
      }
    }
  }
  return false;
}

/*
  function GetPossibleDestinationStatuses(fromStatus)
  IN: fromStatus - the status to request the destination statuses for
  OUT: an array of destination statuses

  Determines the possible destination statuses for fromStatus from the configuration.
*/

function GetPossibleDestinationStatuses(fromStatus) {
  for (var entry in conf.logic.stateDiagram) {
    if (conf.logic.stateDiagram.hasOwnProperty(entry)) {
      var status = conf.logic.stateDiagram[entry];
      if (status.hasOwnProperty('name') && status.name === fromStatus) {
        // check if there are any possible transitions
        if (ObjectWithProperties(status.allowedTransitions)) {
          // return the possible transitions for fromStatus as array
          var transitionArray = new Array;
          for (var transition in status.allowedTransitions) {
            transitionArray.push(status.allowedTransitions[transition]);
          }
          return transitionArray;
        } else {
          return -1;
        }
      }
    }
  }
  // in case of configuration problems return an error
  return -1;
}

/*
  function GetStatusDetail(requestedStatus, requestedDetail)
  IN: requestedStatus - the status to request a detail for
  IN: requestedDetail - the requested detail
  OUT: value of the requested detail

  Extracts the property value of a certain status subdocument from the configuration.
*/

function GetStatusDetail(requestedStatus, requestedDetail) {
  for (var entry in conf.logic.stateDiagram) {
    if (conf.logic.stateDiagram.hasOwnProperty(entry)) {
      var currentStatus = conf.logic.stateDiagram[entry];
      if (currentStatus.hasOwnProperty('name') && currentStatus.name === requestedStatus) {
        if (currentStatus.hasOwnProperty(requestedDetail)) {
          return currentStatus[requestedDetail];
        }
      }
    }
  }
  l.error(sprintf('function GetStatusDetail: Unknown error for status %s and requested detail %s', requestedStatus, requestedDetail));
  return undefined;
}

/*
  function stateDiagramToArray()
  OUT: array of status names

  Creates an array of the configured status names.
*/

function stateDiagramToArray() {
  var stateArray = [];
  for( var stateNumber in conf.logic.stateDiagram ) {
    if( conf.logic.stateDiagram.hasOwnProperty(stateNumber) ) {
      var state = conf.logic.stateDiagram[stateNumber];
      stateArray.push(state.name);
    }
  }
  return stateArray;
}

/*
  function objectPropertiesToArray(includeInvisible)
  IN: includeInvisible - boolean, include invisible (in the schedule view) properties?
  OUT: array of property names

  Creates an array of the configured appointment object properties.
*/

function objectPropertiesToArray(includeInvisible) {
  var propertiesArray = [];
  for( var propertyName in conf.logic.objectProperties ) {
    if( conf.logic.objectProperties.hasOwnProperty(propertyName) ) {
      var property = conf.logic.objectProperties[propertyName];
      if( includeInvisible == false ) {
        if( property.displayInSchedule == true) {
          propertiesArray.push(property.propertyName);
        }
      } else {
        propertiesArray.push(property.propertyName);
      }
    }
  }
  return propertiesArray;
}

/*
  function PrepareScheduleViewForEngineerIDs(Appts, engineerids, dayOffset, callback)
  IN: Appts - Reference to the appointments database collection
  IN: engineerids - an array of engineer ids to prepare the schedules for
  IN: dayOffset - relative day for which the schedule is getting compiled
  OUT: Callback(error, compactSchedule)

  Compiles the current schedule for one or more engineers and returns a complex object
  literal to the calling method.
*/

function PrepareScheduleViewForEngineerIDs(Appts, engineerids, dayOffset, callback) {
  // compiles the schedule view and includes only visible attributes and appointments into overview.
  var compactSchedule = {};
  // why making i an array? because a separate counter is needed for each service agent.
  var i = new Array;
  var statesArray = stateDiagramToArray();
  var oneDay = 1000*60*60*24;
  var today = new Date;
  var assignmentsDate = 0;
  var query = {};
  var queryOptions = {};
  var EngineerIDsInResult = new Array;
                    
  // calculate the date to fetch the assignments for, beginning of the day
  assignmentsDate = Number(today.setUTCHours(0,0,0,0)) - Math.abs(oneDay * dayOffset);
  // build the query, necessary like this for dynamic field names
  query['_assignedTo'] = { $in : engineerids };
  query[conf.logic.assignmentStart] = { $gte: assignmentsDate, $lt: (assignmentsDate + oneDay) };
  queryOptions['sort'] = [[conf.logic.assignmentStart,'asc']];
  // db query, get engineers appointments
  l.all(sprintf('function PrepareScheduleViewForEngineerIDs: About to fetch appointments for %s with query: %s', engineerids, JSON.stringify(query)));
  Appts.find(query, queryOptions, function(error, appointments) {
    if (error) {
      l.error(sprintf('function PrepareScheduleViewForEngineerIDs: Fetching appointments has failed: %s', error));
      callback(error, false);
    } else {
      // iterate results
      for (var appointmentNumber in appointments) {
        if (appointments.hasOwnProperty(appointmentNumber)) {
          // get first appointment
          var rawAppointment = appointments[appointmentNumber];
          // make sure that appointment's status is configured to be shown in client
          if (statesArray.indexOf(rawAppointment[conf.logic.statusProperty]) !== -1) {
            // convert the appointment data to user compatible types
            var appointment = convertAppointmentDatatypes(rawAppointment, 'user');
            // check if the assigned engineer is already covered by result set. If not, expand the result literal with a section for that engineer. there may be multiple engineerids involved when updating an appointment's assigned engineer.
            if (EngineerIDsInResult.indexOf(appointment['_assignedTo']) === -1) {
              compactSchedule[appointment['_assignedTo']] = new Array;
              EngineerIDsInResult.push(appointment['_assignedTo']);
              // need to save following variable per engineer, because there might be two engineerids involved
              EngineerIDsInResult[appointment['_assignedTo']] = {};
              EngineerIDsInResult[appointment['_assignedTo']].foundEditableTaskDF = false;
              i[appointment['_assignedTo']] = 0;
            }
            // initialize final schedule object literal
            compactSchedule[appointment['_assignedTo']][i[appointment['_assignedTo']]] = {};
            var singleScheduleAppointment = {};
            // iterate appointment properties
            for (propertyName in appointment) {
              // check existence of properties and their definition within the configuration
              if (appointment.hasOwnProperty(propertyName) && conf.logic.objectProperties.hasOwnProperty(propertyName)) {
                var propertyValue = appointment[propertyName];
                // select the visible attributes only and give special attention to the status property (add the possible transitions as array)
                var isVisibleAndNotStatusProperty = (conf.logic.objectProperties[propertyName].displayInSchedule == true &&
                    conf.logic.objectProperties[propertyName].propertyName !== conf.logic.statusProperty);
                var isVisibleAndStatusProperty = (conf.logic.objectProperties[propertyName].displayInSchedule == true &&
                    conf.logic.objectProperties[propertyName].propertyName === conf.logic.statusProperty);
                if (isVisibleAndNotStatusProperty) {
                  singleScheduleAppointment[propertyName] = propertyValue;
                } else if (isVisibleAndStatusProperty) {
                  var statusLiteral = {};
                  statusLiteral['type'] = 'string';
                  statusLiteral['value'] = propertyValue;
                  statusLiteral['transitions'] = GetPossibleDestinationStatuses(propertyValue);
                  // decide whether the current task is writeable or not. consider drip feed configuration.
                  var taskIsEditable = (
                    (GetPossibleDestinationStatuses(propertyValue) !== -1 
                    && EngineerIDsInResult[appointment['_assignedTo']].foundEditableTaskDF === false
                    && conf.logic.dripfeed === true)
                    ||
                    (GetPossibleDestinationStatuses(propertyValue) !== -1
                    && conf.logic.dripfeed === false));
                  if (taskIsEditable && conf.logic.dripfeed) {
                    EngineerIDsInResult[appointment['_assignedTo']].foundEditableTaskDF = true;
                  }
                  statusLiteral['taskIsEditable'] = taskIsEditable;
                  singleScheduleAppointment[propertyName] = statusLiteral;
                }
              }
            }
            singleScheduleAppointment = AddTypesToAppointment(singleScheduleAppointment);
            compactSchedule[appointment['_assignedTo']][i[appointment['_assignedTo']]] = singleScheduleAppointment;
            i[appointment['_assignedTo']]++;
          }
        }
      }
      // callback positively, regardless whether there are appointments or not. An empty schedule is possible!
      callback(undefined, compactSchedule);
    }
  });
}

/*
  function StatusTransitionFromEngineer
  IN: Reference to the appointments database collection
  IN: the engineer to check the edit permission for
  IN: Payload of statusTransition event: the edited appointment
  OUT: Callback(error, status[true,false])

  Invoked on incoming status transition from engineer web client.
  - fetch appointment (old state) from database
  - is the old appointment writeable?
  - is the received status transition allowed?
  - detect attribute value changes and abort on forbidden changes (readonly attributes)
  - appointment start & finish are usually readonly. not on status change to a status with isComplete==true
*/

function StatusTransitionFromEngineer(Appts, engineerid, newAppointment, callback) {
  var query = {};
  var doNotUpdate = false;

  var taskIdentifier = newAppointment[conf.logic.taskIdentifier]

  query[conf.logic.taskIdentifier] = taskIdentifier;
  
  Appts.findOne(query, function(error, oldAppointment) {
    if (error) {
      l.error(sprintf('function StatusTransitionFromEngineer: Fetching old appointment from database failed with error: %s. Query was: %s', error, JSON.stringify(query)));
      callback(error, false);
    } else {
      var haveOldAppointment = (oldAppointment !== null);
      if (haveOldAppointment) {
        // format the data to have the same types than the appt received from the web client
        oldAppointment = convertAppointmentDatatypes(oldAppointment, 'user');
        IsTaskEditable(Appts, taskIdentifier, engineerid, function(error, editable) {
          if (error) {
            l.error(sprintf('function StatusTransitionFromEngineer: IsTaskEditable(%s, %s) returned with an error: %s', taskIdentifier, engineerid, error));
            callback(error, false);
          } else {
            l.debug(sprintf('function StatusTransitionFromEngineer: IsTaskEditable(%s, %s) has returned with %s.', taskIdentifier, engineerid, editable));
            if (editable) {
              // check status transition validity
              var oldStatus = oldAppointment[conf.logic.statusProperty];
              var newStatus = newAppointment[conf.logic.statusProperty];
              var isValidTransition = isStatusTransitionValid(oldStatus, newStatus);
              l.debug(sprintf('function StatusTransitionFromEngineer (%s): isStatusTransitionValid(%s, %s) has returned with %s.', taskIdentifier, oldStatus, newStatus, isValidTransition));
              if (isValidTransition) {
                for (propertyName in newAppointment) {
                  // skip the check for the status attribute, transition vadility has already been checked
                  var isStatusAttribute = (propertyName === conf.logic.statusProperty);
                  if (isStatusAttribute) {
                    continue;
                  }
                  // check for property existence and if the same property is available on appointment in db
                  if (newAppointment.hasOwnProperty(propertyName) && oldAppointment.hasOwnProperty(propertyName)) {
                    var isValueChanged = (oldAppointment[propertyName] !== newAppointment[propertyName]);
                    var isReadonlyProperty = (conf.logic.objectProperties[propertyName].readOnly);
                    l.debug(sprintf('function StatusTransitionFromEngineer (%s): Checking property %s. isValueChanged: old "%s" vs new "%s", isReadonlyProperty: %s.', taskIdentifier, propertyName, oldAppointment[propertyName], newAppointment[propertyName], isReadonlyProperty));
                    if (isValueChanged && isReadonlyProperty) {
                      // a read only property has been changed. is fine for app start/finish on completion and for the status property.
                      var newStatusIsOneOfComplete = (GetStatusDetail(newStatus,'isComplete'));
                      var attributeIsStartOrFinish = (propertyName === conf.logic.assignmentStart || propertyName === conf.logic.assignmentFinish);
                      if (!newStatusIsOneOfComplete && attributeIsStartOrFinish) {
                        // the properties value has changed but it is readonly, so this is forbidden.
                        l.warn(sprintf('function StatusTransitionFromEngineerWarning (%s): Possible fraud detected. Property %s must not be changed as it is readonly (%s). Old value: %s, new value: %s. Status transition has been aborted.', taskIdentifier, propertyName, isReadonlyProperty, oldAppointment[propertyName], newAppointment[propertyName]));
                        callback('A readonly-property must not be modified. Transition aborted.', false);
                        doNotUpdate = true;
                        break;
                      }
                    } else if (isValueChanged && !isReadonlyProperty) {
                      // property may be modified, check for an optional maxlength attribute and if length is obeyed
                      if (conf.logic.objectProperties[propertyName].propertyType.hasOwnProperty(maxlength)) {
                        var maxlength = conf.logic.objectProperties[propertyName].propertyType.maxlength;
                        if (newAppointment[propertyName].length > maxlength) {
                          callback('The content length of the ' + propertyName + '-attribute is restricted to ' + maxlength + ' characters. Transition aborted.', false);
                          doNotUpdate = true;
                          break;
                        } else {
                          // still everything ok at this point. appt has been found, is editable, status transition is valid, no read only property has been changed, length is valid.
                          // do nothing, all checks passed successfully.
                        }
                      } else {
                        // there is no maxlength attribute, so everything is still fine.
                        // do nothing, all checks passed successfully.
                      }
                    }
                  } else {
                    // updated appointment has an unknown structure, reject the update
                    l.warn(sprintf('function StatusTransitionFromEngineerWarning (%s): Unknown appointment structure received. Property %s is not configured.', taskIdentifier, propertyName));
                    callback('There was an error during the update, no data has been modified.', false);
                    doNotUpdate = true;
                    break;
                  }
                }
                // a last very obvious check: is assignmentFinish > assignmentStart?
                var appointmentStart = moment.utc(newAppointment[conf.logic.assignmentStart]).valueOf();
                var appointmentFinish = moment.utc(newAppointment[conf.logic.assignmentFinish]).valueOf();
                var datesOK = (appointmentFinish > appointmentStart);
                if (datesOK && !doNotUpdate) {
                  // looping through all properties has finished, no violation has been detected.
                  // the transition is valid. update the database and send a positive feedback.
                  newAppointment = convertAppointmentDatatypes(newAppointment, 'update');
                  newAppointment['_assignedTo'] = engineerid;
                  Appts.updateById(oldAppointment._id, newAppointment, function(error, updatedCount) {
                    if (error) {
                      l.error(sprintf('function StatusTransitionFromEngineerError (%s): Appointment update in db has failed with error: %s', taskIdentifier, error));
                      callback(error, false);
                    } else {
                      if (updatedCount !== 1) {
                        l.error(sprintf('function StatusTransitionFromEngineerError (%s): Appointment could not be found in the database when updating.', taskIdentifier));
                        callback('Appointment could not be found in database when updating.', false);
                      } else {
                        l.debug(sprintf('function StatusTransitionFromEngineerSuccess (%s): Status transition has been successfully processed.', taskIdentifier));
                        callback(false,true);
                      }
                    }
                  });
                  // generate an integration message to the dispatching solution.
                  sm.sendIntegrationMessage(newAppointment, function(error, state) {
                    if (error) {
                      l.error(sprintf('function StatusTransitionFromEngineerWarning (%s): Failed to send integration message: %s', taskIdentifier, error));
                    } else {
                      l.debug(sprintf('function StatusTransitionFromEngineer: sendIntegrationMessage has returned %s', state));
                    }
                  });
                } else {
                  l.debug(sprintf('function StatusTransitionFromEngineer (%s): Invalid dates have been entered by %s: Start (%s) must not be after finish (%s).', taskIdentifier, engineerid, newAppointment[conf.logic.assignmentStart], newAppointment[conf.logic.assignmentFinish]));
                  callback('Appointment finish is before appointment start, transaction aborted.', false);
                }
              }
            }
          }
        });
      } else {
        // old appointment could not be found in the database, reject the update
        l.warn(sprintf('function StatusTransitionFromEngineerWarning (%s): Appointment could not be found in database. Check status diagram in dispatching solution for invalid transitions.', taskIdentifier));
        callback('There was an error during the update, no data has been modified.', false);
      }
    }
  });
}

/*
  function IsTaskEditable(Appts, taskIdentifier, engineerid)
  IN: Reference to the appointments database collection
  IN: the identifier of the task to check
  IN: the engineer to check the edit permission for
  OUT: Callback(error, status[true,false])

  Checks if a particular task is editable by the engineer. Fetches the complete 
  set of saved appointments for the engineer (data is bound to session, not
  permanent) from the database for checking. Takes into account the dripfeed configuration.

  Certain rules apply if dripfeed mode is enabled on application level:
  * The engineer may only edit his "next" appointment.
    What is the "next" appointment?
  * First appointment in a status with possible transitions after 0..n appointments in status with isComplete === true
  All appointments after this "next" appointment are not editable.
  So, for enabled dripfeed mode, the engineers complete schedule has to be checked.
*/

function IsTaskEditable(Appts, taskIdentifier, engineerid, callback) {
  var query = {};
  var result = {};
  var isCurrentAndEditable = false;
  var taskIsEditable = false;
  var foundPrevAppointmentInEndState = true;

  if (conf.logic.dripfeed === true) {
    query['_assignedTo'] = engineerid;
    l.all(sprintf('function IsTaskEditable(%s, %s): Checking if appointment is writeable, querying database with query: %s', taskIdentifier, engineerid, JSON.stringify(query)));
    Appts.find(query, function(error, appointments) {
      if (error) {
        l.error(sprintf('function IsTaskEditable(%s, %s): Fetching appointments from database has failed with error: %s.', taskIdentifier, engineerid, error));
        callback(error, false);
      } else {
        l.all(sprintf('function IsTaskEditable(%s, %s): database has returned %s appointments.', taskIdentifier, engineerid, appointments.length));
        if (appointments.length > 0) {
          // create a data structure that is compatible with function SortSchedules()
          result[engineerid] = appointments;
          result = SortSchedules(result);
          sortedAppts = result[engineerid];
          for (var appointmentNumber in sortedAppts) {
            if (sortedAppts.hasOwnProperty(appointmentNumber)) {
              // process the schedule until the requested task has been found
              var appointment = sortedAppts[appointmentNumber];
              var isRequestedTask = (appointment[conf.logic.taskIdentifier] === taskIdentifier);
              if (isRequestedTask) {
                if (GetPossibleDestinationStatuses(appointment[conf.logic.statusProperty]) !== -1) {
                  isCurrentAndEditable = true;
                  // break the loop, found the answer.
                  break;
                }
              } else {
                // not reached the requested task yet. see whether the currently processed task is in an end state. if it is not, maybe someone tries to fool the application.
                foundPrevAppointmentInEndState = (GetPossibleDestinationStatuses(appointment[conf.logic.statusProperty]) === -1);
                if (!foundPrevAppointmentInEndState) {
                  callback('Appointment ' + taskIdentifier + ' must not be modified. Transaction aborted.',false);
                  break;
                }
              }
            }
          }
          l.all(sprintf('function IsTaskEditable(%s, %s): Appointment is writeable: %s', taskIdentifier, engineerid, isCurrentAndEditable));
          if (isCurrentAndEditable) {
            callback(false,true);
          } else {
            callback(false,false);
          }
        } else {
          // no task in the result set, so it doesn't belong to the engineer
          callback('Schedule is empty, appointment may not be modified.', false);
        }
      }
    });
  } else {
    query[conf.logic.taskIdentifier] = taskIdentifier;
    l.all(sprintf('function IsTaskEditable(%s, %s): Checking if appointment is writeable, querying database with query: %s', taskIdentifier, engineerid, JSON.stringify(query)));
    Appts.findOne(query, function(error, appointment) {
      if (error) {
        l.error(sprintf('function IsTaskEditableError(%s, %s): Fetching appointments from database has failed with error: %s.', taskIdentifier, engineerid, error));
        callback(error,false);
      } else {
        if (appointment !== null) {
          // check whether the task belongs to the engineer
          if (appointment['_assignedTo'] === engineerid) {
            taskIsEditable = (GetPossibleDestinationStatuses(appointment[conf.logic.statusProperty]) !== -1);
          }
          l.all(sprintf('function IsTaskEditable(%s, %s): Appointment is writeable: %s', taskIdentifier, engineerid, taskIsEditable));
          callback(false, taskIsEditable);
        } else {
          l.all(sprintf('function IsTaskEditable(%s, %s): Appointment not found in db.', taskIdentifier, engineerid));
          callback(false, false);
        }
      }
    });
  }
}

/*
  function formatValue(propertyName, propertyValue, purpose)
  IN: propertyName - The name of a property defined in the configuration
  IN: propertyValue - The value of the property with propertyName
  IN: purpose - one of ['db','user','update']
  OUT: propertyValue (converted)

  Converts a property value depending on the purpose.
*/

function formatValue(propertyName, propertyValue, purpose) {
  // Formats property values according to the configuration.
  // parameter 'purpose' defines whether the data is intended to be saved to database or presented to the user. That influences the target format.
  // purpose may have the values 'db' or 'user'.
  // 'db': convert from 'conf.logic.objectProperties.<propName>.propertyType.sourceFormat' to database compatible type.
  // 'user': convert from database compatible type to 'conf.logic.objectProperties.<propName>.propertyType.toFormat'.
  if( conf.logic.objectProperties.hasOwnProperty(propertyName) ) {
    var type = conf.logic.objectProperties[propertyName].propertyType.type;
    switch (type) {
      case 'datetime': 
        var sourceFormat = conf.logic.objectProperties[propertyName].propertyType.sourceFormat;
        var toFormat = conf.logic.objectProperties[propertyName].propertyType.toFormat;
        switch (purpose) {
          case 'db':
            switch ( sourceFormat ) {
              case 'iso':
                var dateValue = moment.utc(propertyValue);
                var formattedval = dateValue.valueOf();
                return formattedval;
                break;
            }
          case 'user':
            
            var dateValue = moment.utc(propertyValue);
            var formattedval = dateValue.format('YYYY-MM-DDTHH:mm:ss');
            return formattedval;
            break;
          case 'update':
            var dateValue = moment.utc(propertyValue);
            var formattedval = dateValue.valueOf();
            return formattedval;
            break;
          case 'integrationmessage':
            var dateValue = moment.utc(propertyValue);
            var formattedval = dateValue.format('YYYY-MM-DDTHH:mm:ss');
            return formattedval;
            break;
        }
        break;
      case 'string': 
        return propertyValue;
        break;
      case 'duration': 
        var sourceFormat = conf.logic.objectProperties[propertyName].propertyType.sourceFormat;
        var toFormat = conf.logic.objectProperties[propertyName].propertyType.toFormat;
        switch (purpose) {
          case 'db':
            switch (sourceFormat) {
              case 'milliseconds':
                return propertyValue;
                break;
              case 'seconds':
                var dateValue = moment.utc(0);
                dateValue.add('s',propertyValue);
                var formattedval = dateValue.valueOf();
                return formattedval;
                break;
              case 'minutes':
                var dateValue = moment.utc(0);
                dateValue.add('m',propertyValue);
                var formattedval = dateValue.valueOf();
                return formattedval;
                break;
              case 'hours':
                var dateValue = moment.utc(0);
                dateValue.add('h',propertyValue);
                var formattedval = dateValue.valueOf();
                return formattedval;
                break;
            }
          case 'user':
            var dateValue = moment.utc(propertyValue);
            var formattedval = dateValue.format('YYYY-MM-DDTHH:mm:ss');
            return formattedval;
            break;
          case 'update':
            var dateValue = moment.utc(propertyValue);
            var formattedval = dateValue.valueOf();
            return formattedval;
            break;
          case 'integrationmessage':
            switch (sourceFormat) {
              case 'milliseconds':
                var dateValue = moment.utc(propertyValue);
                formattedval = dateValue.valueOf();
                return formattedval;
                break;
              case 'seconds':
                var dateValue = moment.utc(propertyValue);
                formattedval = dateValue.valueOf();
                formattedval = Math.ceil(formattedval / 1000);
                return formattedval;
                break;
              case 'minutes':
                var dateValue = moment.utc(propertyValue);
                formattedval = dateValue.valueOf();
                formattedval = Math.ceil(formattedval / 1000 / 60);
                return formattedval;
                break;
              case 'hours':
                var dateValue = moment.utc(propertyValue);
                formattedval = dateValue.valueOf();
                formattedval = Math.ceil(formattedval / 1000 / 60 / 60);
                return formattedval;
                break;
            }
            break;
        } // end switch purpose
        break; // duration type
      case 'boolean': 
        if (propertyValue == 1) {
          return true;
        } else if (propertyValue == 0) {
          return false;
        } else {
          return propertyValue;
        }
        break;
    }
  } else {
    return false;
  }
  return propertyValue;
}

/*
  function convertAppointmentDatatypes(appointment, purpose)
  IN: appointment - an appointment object literal
  IN: purpose - one of ['db','user','update']
  OUT: appointment (values formatted according to (purpose))

  Wrapper for function formatValue. Goes through the properties of (appointment) and
  formats the value of each in case it is not of type string or number.

*/

function convertAppointmentDatatypes(appointment, purpose) {
  // Normalizes data types (e.g. datetime to timestamp in ms, duration to milliseconds) for database storage or user presentation, depending on purpose
  for (var propertyName in appointment) {
    var isKnownProperty = (appointment.hasOwnProperty(propertyName) && conf.logic.objectProperties.hasOwnProperty(propertyName));
    if (isKnownProperty) {
      var isStringOrNumber = (['string', 'number'].indexOf(conf.logic.objectProperties[propertyName].propertyType.type) !== -1);
      var propertyValue = appointment[propertyName];
      if (!isStringOrNumber) {
        // substitute property value with db type
        appointment[propertyName] = formatValue(propertyName, propertyValue, purpose);
        l.debug(sprintf('function convertAppointmentDatatypes: Converted value of %s from "%s" to "%s".', propertyName, propertyValue, appointment[propertyName]));
      } 
    }
  }
  return appointment;
}

/*
  function getAppointmentDetails(appointmentIdentifier, engineerid, Appts, callback)
  
  IN: the identifier of the appointment to get the details for
  IN: the requesting engineer's id
  IN: Reference to the appointments database collection
  OUT: Callback(error, formattedAppointment)

  Is being called from the socket event "getAppointmentDetails". Fetches
  the requested appointment from the database and returns an enriched appointment
  literal (using AddTypesToAppointment) to the webclient.

*/

function getAppointmentDetails(appointmentIdentifier, engineerid, Appts, callback) {
  var appointment = {};
  var query = {};

  // find out whether the enginer is allowed to view the requested appointment
  query[conf.logic.taskIdentifier] = appointmentIdentifier;
  l.all(sprintf('function getAppointmentDetails(%s, %s): Fetching appointment details from db using the query: %s', appointmentIdentifier, engineerid, JSON.stringify(query)));
  Appts.findOne(query, function(error, appointment) {
    if (error) {
      l.error(sprintf('function getAppointmentDetails(%s, %s): Fetching appointments from database has failed with error: %s.', appointmentIdentifier, engineerid, error));
      callback(error, false);
    } else {
      if (appointment !== null) {
        var engineerIsAssigned = (appointment['_assignedTo'] === engineerid);
        if (engineerIsAssigned) {
          var formattedAppointment = convertAppointmentDatatypes(appointment, 'user');
          /* clean up the object, delete properties:
             _id: no need to publish database id over network
             _assignedTo: appointment is scheduled to engineer, so it is obvious
          */
          delete appointment['_id'];
          delete appointment['_assignedTo'];
          // enrich object with property types, to not have to redefine the configuration in the web client
          formattedAppointment = AddTypesToAppointment(formattedAppointment);
          l.all(sprintf('function getAppointmentDetails(%s, %s): Returning appointment: %s', JSON.stringify(formattedAppointment)));
          callback(false, formattedAppointment);
        } else {
          // engineer is not assigned to the requested task, not allowed to view it.
          l.error(sprintf('function getAppointmentDetails(%s, %s): The engineer is not assigned to the assignment and thus is not allowed to view its details.', appointmentIdentifier, engineerid));
          callback('You are not assigned to appointment ' + appointmentIdentifier, false);
        }
      } else {
        l.error(sprintf('function getAppointmentDetails(%s, %s): Appointment could not be found in the database.', appointmentIdentifier, engineerid));
        callback('Error, appointment ' + appointmentIdentifier + ' could not be found.', false);
      }
    }
  });
}


/*
  function AddTypesToAppointment(appointmentIdentifier, engineerid, Appts, callback)
  
  IN: the appointment object literal to add the types to (basically just with many property:value items)
  OUT: appointmentWithTypes

*/

function AddTypesToAppointment(appointment) {
  l.all(sprintf('function AddTypesToAppointment: Processing appointment: %s', JSON.stringify(appointment)));
  var appointmentWithTypes = {};
  for (var propertyName in appointment) {
    if (appointment.hasOwnProperty(propertyName)) {
      var propertyValue = appointment[propertyName];
      if (typeof propertyValue == "object") {
        appointmentWithTypes[propertyName] = propertyValue;
      } else {
        appointmentWithTypes[propertyName] = {};
        appointmentWithTypes[propertyName]['type'] = conf.logic.objectProperties[propertyName].propertyType.type;
        appointmentWithTypes[propertyName]['displayName'] = conf.logic.objectProperties[propertyName].displayName;
        appointmentWithTypes[propertyName]['readOnly'] = conf.logic.objectProperties[propertyName].readOnly;
        var isEditableString = (appointmentWithTypes[propertyName]['type'] === 'string' && appointmentWithTypes[propertyName]['readOnly'] === false);
        if (isEditableString) {
          appointmentWithTypes[propertyName]['maxlength'] = conf.logic.objectProperties[propertyName].propertyType.maxlength;
        }
        var isDateTime = (['datetime','duration'].indexOf(appointmentWithTypes[propertyName]['type']) !== -1);
        if (isDateTime) {
          appointmentWithTypes[propertyName]['mask'] = conf.logic.objectProperties[propertyName].propertyType.toFormat;
          appointmentWithTypes[propertyName]['validateRegexp'] = conf.logic.objectProperties[propertyName].propertyType.validateRegexp;
        }
        appointmentWithTypes[propertyName]['value'] = propertyValue;
      }
    }
  }
  l.all(sprintf('function AddTypesToAppointment: Returning appointment with types: %s', JSON.stringify(appointmentWithTypes)));
  return appointmentWithTypes;
}

/*
  function getDayOffset()
  
  Calculates the relative date for all operations. If conf.logic.fakeDate is set, it will be considered.

  OUT: (int) dayOffset
*/

// 
function getDayOffset() {
  var today = new Date();
  var dayOffset = 0;
  if( conf.logic.fakedate != false ) {
    var fake = new Date(Date.parse(conf.logic.fakedate));
    var offset = fake.getTime() - today.getTime();
    dayOffset = Math.ceil(offset/1000/60/60/24);
  }
  return dayOffset;
}

/* function SortSchedules
  IN: scheduleObject - JS Object literal containing the schedules for one or more engineers
  Note on the structure of scheduleObject: Object literal --> subdocuments, one for each engineerID --> array of appointments
  OUT: scheduleObject (sorted by appointment start for each engineer)
*/
function SortSchedules(scheduleObject) {
  for (var engineerID in scheduleObject) {
    if (scheduleObject.hasOwnProperty(engineerID)) {
      var scheduleArray = scheduleObject[engineerID];
      scheduleArray.sort(SortArrayOfObjectsByAppointmentStart);
      scheduleObject[engineerID] = scheduleArray;
      return scheduleObject;
    }
  }
}

/* function SortArrayOfObjectsByAppointmentStart(a, b)
  Sort function for array.sort(), used in SortSchedules().
*/

function SortArrayOfObjectsByAppointmentStart(a, b) {
  if (a[conf.logic.assignmentStart] < b[conf.logic.assignmentStart]) {
    return -1;
  }
  if (a[conf.logic.assignmentStart] > b[conf.logic.assignmentStart]) {
    return 1;
  }
  return 0;
}

/* function ObjectWithProperties(obj)
  IN: obj - any object literal
  
  Finds out if obj has any properties.
*/

function ObjectWithProperties(obj) {
  for (var prop in obj) {
    if (obj.hasOwnProperty(prop)) {
      return true;
    }
  }
  return false;
}

/* function trim(message)
  IN: message - string
  
  Removes whitespaces, tabs, new lines from message.
*/

function trim(message) {
  return message.replace(/^\s+|\s+$/g, '');
};

exports.authenticate = authenticate;
exports.post = post;
exports.getScheduleData = getScheduleData;
exports.isStatusTransitionValid = isStatusTransitionValid;
exports.objectPropertiesToArray = objectPropertiesToArray;
exports.getDayOffset = getDayOffset;
exports.ProcessIncomingMessage = ProcessIncomingMessage;
exports.stateDiagramToArray = stateDiagramToArray;
exports.getAppointmentDetails = getAppointmentDetails;
exports.GetStatusDetail = GetStatusDetail;
exports.StatusTransitionFromEngineer = StatusTransitionFromEngineer;
exports.PrepareScheduleViewForEngineerIDs = PrepareScheduleViewForEngineerIDs;
exports.convertAppointmentDatatypes = convertAppointmentDatatypes;
exports.GetSessionsByEngineerIDs = GetSessionsByEngineerIDs;
exports.ObjectWithProperties = ObjectWithProperties;
exports.trim = trim;