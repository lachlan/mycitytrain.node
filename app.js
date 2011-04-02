
/**
 * Module dependencies.
 */

var express = require('express')
  , http = require('http')
  , jsdom = require('jsdom')
  
var app = module.exports = express.createServer()

// Configuration

app.configure(function() {
  app.set('views', __dirname + '/views')
  app.set('view engine', 'jade')
  app.use(express.bodyParser())
  app.use(express.methodOverride())
  app.use(express.compiler({ src: __dirname + '/public', enable: ['less'] }))
  app.use(app.router)
  app.use(express.static(__dirname + '/public'))
})

app.configure('development', function() {
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }))
})

app.configure('production', function() {
  app.use(express.errorHandler())
})

var locations = undefined

var fetchLocations = function(callback) {
  locations = []
  
  var options = {
        host: 'www.queenslandrail.com.au',
        port: 80,
        path: '/AllStations/Pages/AllStations.aspx',
        method: 'GET'
      }

  var request = http.request(options, function(response) {
    response.setEncoding('utf8')
    var body = ''
    response.on('data', function(data) {
      body += data
    })
    response.on('end', function() {
      jsdom.env(body, ['http://code.jquery.com/jquery-1.5.min.js'], function(errors, window) {
        // parse page which contains a select element that includes all the location names
        window.$('select option').each(function() {
          locations.push(window.$(this).attr('value').trim())
        })
        if (callback) callback(locations)
      })
    })
  })
  request.end()
  
  // fetch the locations again in a day
  setInterval(fetchLocations, 60 * 60 * 24 * 1000)
}

var getLocations = function(callback) {
  if (callback) {
    if (locations) {
      callback(locations)
    } else {
      fetchLocations(callback)
    }
  }
}

// Routes

app.get('/', function(req, res) {
  res.render('index', {
    title: 'MyCitytrain'
  })
})

app.get('/data/locations.json', function(req, res) {
  getLocations(function(locations) {
    res.header('Cache-Control', 'public; max-age=604800') // let the client cache the response for a week
    res.send(locations)
  })
})

app.get('/data/:origin/:destination.json', function(req, res) {
  res.send([[1,2]])
})

// Only listen on $ node app.js

if (!module.parent) {
  // pre-cache locations
  fetchLocations()
  app.listen(3000)
  console.log("Express server listening on port %d", app.address().port)
}
