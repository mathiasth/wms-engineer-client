var conf        = require('./_config.js'), 
    func        = require('./functions.js'),
    connection  = require('monk')(conf.app.DbHost + '/' + conf.app.DbName),
    express     = require('express'),
    io          = require('socket.io'),
    jade        = require('jade'),
    connect     = require('connect'),
    Db          = require('mongodb').Db,
    Server      = require('mongodb').Server,
    DbConfig    = new Server(conf.app.DbHost, conf.app.DbPort, {auto_reconnect: true, native_parser: true, safe:true}),
    db          = new Db(conf.app.DbName, DbConfig, {})
    mStore      = require('connect-mongodb'),
    mongoStore  = new mStore({db: db, reapInterval: 60000}),
    cookie      = require('cookie'),
    Appts       = connection.get('appointments'),
    Sess        = connection.get('sessions'),
    http        = require('http'),
    https       = require('https'),
    CronJob     = require('cron').CronJob,
    moment      = require('moment'),
    flash       = require('connect-flash'),
    winston     = require('winston'),
    sprintf     = require('sprintf').sprintf;

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

var logStream = {
  write: function(message, encoding){
    l.debug(func.trim(message));
  }
};

var app = express();

// set custom collection index
Appts.index(conf.logic.taskIdentifier, { unique: true });

app.configure('development', function() {
  //keep the order! 
  app.use(express.logger({ 
    format: ':remote-addr \x1b[1m:method\x1b[0m \x1b[33m:url\x1b[0m :response-time ms',
    stream: logStream 
  }));
  app.use(express.bodyParser());  
  app.use(express.cookieParser(conf.app.sessionSecret));
  app.use(express.session({ store: mongoStore }));
  app.use(flash());
  app.use(app.router);
  app.use(express.static(__dirname + '/static'));
  app.use(express.errorHandler({
    dumpExceptions: true,
    showStack: true
  }));
});

app.configure('production', function() {
  //keep the order! 
  app.use(express.logger());
  app.use(express.bodyParser());  
  app.use(express.cookieParser(conf.app.sessionSecret));
  app.use(express.session({ store: MemStore({ reapInterval: 6000 * 10 }) }));
  app.use(app.router);
  app.use(express.static(__dirname + '/static'));
  app.use(express.errorHandler({
    dumpExceptions: false,
    showStack: false
  }));
});

app.set('views', __dirname + '/pages');
app.set('view engine', 'jade');

app.post('/authenticate', function(req, res){
  func.authenticate(req.body.username, req.body.password, function(error, engineerid) {
    if (error) {
      req.flash('error',error);
      res.redirect('/login');
    } else {
      l.info(sprintf('A service agent was successfully authenticated: %s', engineerid));
      // regenerating session on login helps to prevent session fixation
      req.session.regenerate(function() {
        req.session.user = req.body.username.toLowerCase();
        req.session.engineerid = engineerid.toString();
        req.session.viewedDay = func.getDayOffset();
        res.redirect('/');
      });
    }
  });
});

app.get('/', requiresLogin, function(req, res) {
  var locals = {
    user: req.session.user,
    id: req.session.engineerid,
    webSocketTarget: conf.app.localProtocolHandler + '://' + conf.app.host + ':' + conf.app.port,
    scheduleProperties: func.objectPropertiesToArray(false),
    statusProperty: conf.logic.statusProperty,
    taskIdentifier: conf.logic.taskIdentifier,
    assignmentStart: conf.logic.assignmentStart,
    assignmentFinish: conf.logic.assignmentFinish,
    daysOffset: func.getDayOffset()
  };
  res.render('index', locals);
});

app.get('/login', function(req, res) {
  var locals = {
    postTarget: conf.app.localProtocolHandler + '://' + conf.app.host + ':' + conf.app.port + '/authenticate',
    message: req.flash('error')
  };
  res.render('login', locals);
});

app.get('/logout', function (req, res) {
  req.session.destroy(function() {
    res.render('logout');
  });
});

function requiresLogin(req, res, next) {
  if( req.session.user ) {
    next();
  } else {
    res.redirect('/login');
  }
};

function EchoWelcome(server) {
  var address = server.address();
  l.info(sprintf('Application listening on %s:%s', address.address, address.port));
  l.info(sprintf('Using connect %s, Express %s, Jade %s', connect.version, express.version, jade.version));
  l.info(sprintf('SSL: App: %s, App->WFM: %s, WFM->App: %s', conf.app.useSecureConnection, conf.dispatch.useSecureConnection, conf.dispatch.useSecureLocalInterface));
};

if (conf.app.useSecureConnection) {
  var server = https.createServer(conf.app.sslOptions, app).listen(conf.app.port, function() {
    EchoWelcome(server);
  });  
} else {
  var server = http.createServer(app).listen(conf.app.port, function() {
    EchoWelcome(server);
  });
}

/*
  Interface section
  No express application here, just plain core node modules.
*/

function ProcessRequest(req, res) {
  if (req.method == 'POST' && req.url === '/DispatchInterface') {  
    var buffer = '';
    req.on('data', function(chunk) {
      // receive the complete request
      buffer += chunk;
    });
    req.on('end', function () {
      // process the request
      func.ProcessIncomingMessage(Appts, Sess, sio, buffer, function(error,response) {
        if (error) {
          l.error(sprintf('app.js: Error from ProcessIncomingMessage: %s', error));
          res.writeHead(200, { 'content-type': 'text/plain' });
          res.end(error);
        } else {
          l.all(sprintf('app.js: ProcessIncomingMessage: %s', response));
          res.writeHead(200, {
            'Content-Length': response.length,
            'Content-Type': 'text/plain'}
          );
          res.end(response);
        }
      });
    });
  }
  if (req.method == 'GET' && req.url === '/DispatchInterface') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('Interface ready.');
  }
  if (req.url !== '/DispatchInterface') {
    res.writeHead(401, { 'content-type': 'text/plain' });
    res.end('Not found.');
  }
}

if (conf.dispatch.useSecureLocalInterface) {
  var iface = https.createServer(conf.dispatch.sslOptions, function(req, res) {
    ProcessRequest(req, res);
  });
} else {
  var iface = http.createServer(function(req, res) {
    ProcessRequest(req, res);
  });
}

iface.listen(conf.dispatch.localInterfacePort);

/*
  Socket section
*/


var sio = io.listen(server);

sio.enable('browser client minification');
sio.enable('browser client etag');
sio.enable('browser client gzip');

// 0: error, 1 warn, 2 info, 3 debug
sio.set('log level', 1);

sio.set('authorization', function(data, callback) {
  // check for a cookie within the header
  if (data.headers.cookie) {
    data.cookie = cookie.parse(data.headers.cookie);
    data.sessionID = data.cookie['connect.sid'].split('.')[0].split(':')[1];
    /* find the session document from the database and look, whether a 'user'
       key is present. in this case, the session's user has already been 
       authenticated to the application and his corresponding session will also 
       be authorized for socket.io access */
    mongoStore.get(data.sessionID, function(error, sessiondata) {
      if (error) {
        callback(error, false);
      } else {
        var haveIdentifiedUser = sessiondata.hasOwnProperty('user');
        if (haveIdentifiedUser) {
          // acceppt the incoming connection
          callback(false, true);
        } else {
          callback('Authorization declined.', false) ;
        }      
      }
    })
  } else {
    callback('Authorization declined.', false) ;
  }
});

sio.sockets.on('connection', function (socket) {
  l.debug(sprintf('A socket with connect.sid = %s connected!', socket.handshake.sessionID));

  // create a room for that connection
  socket.join(socket.handshake.sessionID);

  socket.on('getInitialSchedule', function() {
    l.debug('RECEIVED EVENT getInitialSchedule.');
    func.getScheduleData(Appts, socket.handshake.sessionID, func.getDayOffset(), function(error, scheduledata) {
      socket.emit('sendschedule', scheduledata);
    });
  });

  socket.on('getAppointmentDetails', function(appointmentIdentifier, callback) {
    l.debug('RECEIVED EVENT getAppointmentDetails.');
    mongoStore.get(socket.handshake.sessionID, function(error, sessiondata) {
      if (error) {
        l.error(sprintf('EVENT getAppointmentDetailsError: %s', error));
      } else {
        console.log
        func.getAppointmentDetails(appointmentIdentifier, sessiondata.engineerid, Appts, function(error, appointmentData) {
          if (error) {
            callback(error, false);
          } else {
            l.debug('EVENT getAppointmentDetails:', appointmentData);
            callback(false, appointmentData);
          }
        });        
      }
    });
  });

  socket.on('isStatusComplete', function(status, callback) {
    l.debug('RECEIVED EVENT isStatusComplete.');
    var isComplete = func.GetStatusDetail(status, 'isComplete');
    if (isComplete !== undefined) {
      l.all(sprintf('EVENT isStatusComplete: Is status %s complete? %s', status, isComplete));
      callback(false, isComplete);
    } else {
      l.error('EVENT: isStatusCompleteError, func.GetStatusDetail returned undefined.');
      callback('Request failed.', isComplete);
    }
  });

  socket.on('statusTransition', function(appointment, callback) {
    l.debug('RECEIVED EVENT statusTransition.');
    mongoStore.get(socket.handshake.sessionID, function(error, sessiondata) {
      if (error) {
        l.error(sprintf('EVENT statusTransitionError: %s', error));
      } else {
        func.StatusTransitionFromEngineer(Appts, sessiondata.engineerid, appointment, function(error, status) {
          if (error) {
            l.error(sprintf('EVENT statusTransitionError: %s', error));
            callback(error, false);
          } else {
            l.debug(sprintf('EVENT statusTransition: Successful status transition by %s. ', socket.handshake.sessionID));
            callback(false, true);
            // look for other sessions of the same engineer that need to get updated
            func.GetSessionsByEngineerIDs([sessiondata.engineerid], Sess, function(error, sessions) {
              for (var i in sessions.sessionID) {
                var isTriggeringSession = (sessions.sessionID[i] === socket.handshake.sessionID);
                if (!isTriggeringSession) {
                  // another session has been found, notify the session to pull a new schedule
                  sio.sockets.in(sessions.sessionID[i]).emit('schedulePullRequest');
                }
              }
            });
          }
        });
      }
    });
  });

  socket.on('getUpdatedSchedule', function() {
    l.debug('RECEIVED EVENT getUpdatedSchedule.');
    mongoStore.get(socket.handshake.sessionID, function(error, sessiondata) {
      if (error) {
        l.error(sprintf('EVENT getUpdatedScheduleError: ', error));
      } else {
        func.PrepareScheduleViewForEngineerIDs(Appts, [sessiondata.engineerid], func.getDayOffset(), function(error, scheduledata) {
          if (error) {
            sio.sockets.in(socket.handshake.sessionID).emit('information', error);
            l.error(sprintf('EVENT getUpdatedScheduleError: ', error));
          } else {
            socket.emit('sendschedule', scheduledata[sessiondata.engineerid]);
            l.all(sprintf('Request for a schedule by %s:', socket.handshake.sessionID), scheduledata[sessiondata.engineerid]);
          }
        });        
      }
    });
  });
  
  socket.on('disconnect', function(data) {
    l.debug('RECEIVED EVENT disconnect.');
  });
});

/*
  Misc section
*/

new CronJob('00 00 * * * *', function() {
  var oneDay = 1000*60*60*24;
  var olderThan = moment().startOf('day').subtract('days', 2);
  var begin = olderThan.valueOf();

  Sess.find({}, function(error, documents) {
    function DeleteSession(documentNumber) {
      var document = documents[documentNumber];
      var session = JSON.parse(document.session);
      var isInactiveSession = (!session.hasOwnProperty('user'));
      var isOldSession = (session.hasOwnProperty('lastAccess') && session.lastAccess < begin);
      if (isInactiveSession || isOldSession) {
        mongoStore.destroy(document['_id'], function(error) {
          if (error) {
            l.error(sprintf('CRON: Session purge error, aborting: %s).', error));
          } else {
            if (documentNumber < (documents.length - 1)) {
              DeleteSession(documentNumber + 1);
            }
          }
        });
      }
      if (documentNumber < (documents.length - 1)) {
        DeleteSession(documentNumber + 1);
      }
    }
    l.info(sprintf('CRON: About to delete the old/inactive sessions out of %s total sessions within the database. ', documents.length));
    if (documents.length > 0) {
      DeleteSession(0);
    }
  });

  if (conf.logic.fakedate === false) {
    var query = {};
    query[conf.logic.assignmentStart] = { $gte: begin, $lt: (begin + oneDay) };
    Appts.remove(query, function(error) {
      if (error) {
        l.error(sprintf('CRON: Error when purging old assignments (between %s and %s).', olderThan.format(), begin, (begin + oneDay)));
      } else {
        l.info(sprintf('CRON: Successfully purged assignments older than %s.', olderThan.format()));
      }
    });
  } else {
    l.info('CRON: conf.logic.fakedate is set, skipping assignments deletion.');
  }
}, null, true);