var express = require('express'),
    app = require('./app'),
    mime = require('mime'), 
    server = module.exports = express.createServer();

// configuration
mime.define({'text/cache-manifest': ['manifest']});

server.configure(function() {
  server.set('views', __dirname + '/views');
  server.set('view engine', 'jade');
  server.use(express.bodyParser());
  server.use(express.methodOverride());
  server.use(express.compiler({ src: __dirname + '/public', enable: ['less'] }));
  server.use(server.router);
  server.use(express.logger());
});

server.configure('development', function() {
  server.use(express.static(__dirname + '/public'));
  server.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

server.configure('production', function() {
  var oneYear = 31557600000;
  server.use(express.static(__dirname + '/public', { maxAge : oneYear }));
  server.use(express.errorHandler());
});

// routes
server.get('/', app.index);
server.get('/api/locations.json', app.locations);
server.get('/api/:origin/:destination.json', app.journeys);

// boot the app
if (!module.parent) {
  server.listen(process.env.PORT || 3000);
  console.log("Express server listening on port %d", server.address().port);
}
