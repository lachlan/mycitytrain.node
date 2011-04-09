var express = require('express')
//  , http = require('http')
  , jsdom = require('jsdom')
  , request = require('request')
  , querystring = require('querystring')
  , restler = require('restler')
  
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
  request({ uri: 'http://www.queenslandrail.com.au/AllStations/Pages/AllStations.aspx' }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      locations = []
      jsdom.env(body, ['http://code.jquery.com/jquery-1.5.min.js'], function(errors, window) {
        // parse page which contains a select element that includes all the location names
        window.$('select option').each(function() {
          locations.push(window.$(this).attr('value').trim())
        })
        if (callback) callback(locations)
      })
    }
  })
  // fetch the locations again in a day
  setInterval(fetchLocations, 60 * 60 * 24 * 1000)
}

var fetchJourneys = function(origin, destination, departDate, limit, callback) {
  if (!departDate) departDate = new Date();
  if (!limit) limit = 5;
  
  var url = 'http://jp.translink.com.au/travel-information/journey-planner/train-planner'
  var options = {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  , data: querystring.encode({
      FromStation: origin
    , ToStation: destination
    , TimeSearchMode: 'DepartAt'
    , SearchDate: ('' + departDate.getFullYear() + '-' + (departDate.getMonth() + 1) + '-' + departDate.getDate())
    , SearchHour: departDate.getHours() <= 12 ? departDate.getHours() : departDate.getHours() - 12
    , SearchMinute: departDate.getMinutes()
    , TimeMeridiem: departDate.getHours() <= 12 ? 'AM' : 'PM'
    })
  }
  
  restler.post(url, options).on('complete', function(data, response) {
    console.log('response: ' + response)
    console.log('data: ' + data)
    callback(data)
  })
  
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
  fetchJourneys(req.params.origin, req.params.destination, new Date(), 5, function(journeys) {
    res.send(journeys)
  })
})

// Only listen on $ node app.js

if (!module.parent) {
  // pre-cache locations
  fetchLocations()
  app.listen(80)
  console.log("Express server listening on port %d", app.address().port)
}
