var express = require('express')
  , site = require('./site')
  , app = module.exports = express.createServer();

// configuration
app.configure(function() {
  app.set('views', __dirname + '/views')
  app.set('view engine', 'jade')
  app.use(express.bodyParser())
  app.use(express.methodOverride())
  app.use(express.compiler({ src: __dirname + '/public', enable: ['less'] }))
  app.use(app.router)
  app.use(express.logger());
})

app.configure('development', function() {
  app.use(express.static(__dirname + '/public'))
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }))
})

app.configure('production', function() {
  var oneYear = 31557600000;
  app.use(express.static(__dirname + '/public', { maxAge : oneYear }))
  app.use(express.errorHandler())
})

// routes
app.get('/', site.index);
app.get('/cache.manifest', site.manifest);
app.get('/data/locations.json', site.locations);
app.get('/data/:origin/:destination.json', site.journeys);

// boot the app
if (!module.parent) {
  app.listen(process.env.PORT || 3000)
  console.log("Express server listening on port %d", app.address().port)
}