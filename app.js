
/**
 * Module dependencies.
 */

var express = require('express')
  , http = require('http')
  , jsdom = require('jsdom')
  , qs = require('querystring')
  
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
  app.use(express.logger({ format: ':method :uri' }));
  
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

Date.prototype.midnight = function() {
  var d = new Date(this.getTime());
  d.setHours(0)
  d.setMinutes(0)
  d.setSeconds(0)
  d.setMilliseconds(0)
  return d;
}

Date.prototype.parseTime = function(timeString) {
  timeString ? timeString = timeString.trim() : ''
  var fromDate = this.midnight()
  if (timeString.match(/\+$/)) fromDate = fromDate.setDate(fromDate.getDate() + 1);  // after midnight so add 1 day

  var matches = timeString.match(/(\d{1,2})\.(\d{1,2})(am|pm)/i)
  if (matches) {
    var hours = parseInt(matches[1])
      , minutes = parseInt(matches[2])
      , meridiem = matches[3]
    
    if (meridiem.toLowerCase() == 'pm') hours += 12  
    fromDate.setHours(hours);
    fromDate.setMinutes(minutes);
  }
  return fromDate;
}

var fetchJourneys = function(origin, destination, departDate, limit, callback) {
  if (departDate) {
    departDate = new Date(departDate.getTime() + (1000 * 60)) // add a minute to the departDate to only fetch journeys departing after that date
  } else {  
    departDate = new Date();
  }
  if (!limit) limit = 5;
  
  var host = 'jp.translink.com.au'
    , port = 80
    , data = qs.encode({
        FromStation: origin
      , ToStation: destination
      , TimeSearchMode: 'DepartAt'
      , SearchDate: ('' + departDate.getFullYear() + '-' + (departDate.getMonth() + 1) + '-' + departDate.getDate())
      , SearchHour: departDate.getHours() <= 12 ? departDate.getHours() : departDate.getHours() - 12
      , SearchMinute: departDate.getMinutes()
      , TimeMeridiem: departDate.getHours() <= 12 ? 'AM' : 'PM'
      })

  // post form to translink web site to get a list of journeys
  var request = http.request({
    host: host
  , port: port
  , path: '/travel-information/journey-planner/train-planner'
  , method: 'POST'
  , headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  }
  , function(response) {
    response.on('end', function() {
      if (response.statusCode == 302) {
        // redirect expected from translink
        http.get({
          host: host
        , port: port
        , path: response.headers['location']
        , method: 'GET'
        , headers: { cookie: response.headers['set-cookie'] }
        }, function(res) {
          res.setEncoding('utf8')
          var body = ''
          res.on('data', function(data) {
            body += data
          }).on('end', function() {
            if (res.statusCode == 200) {
              var journeys = []
              jsdom.env(body, ['http://code.jquery.com/jquery-1.5.min.js'], function(errors, window) {
                // parse page which contains a select element that includes all the location names
                window.$('#optionsTable tbody tr').each(function() {
                  var tds = window.$(this).find('td.timetd')               
                  if (tds.length >= 2) {
                    var departTime = departDate.parseTime(window.$(tds[0]).html()).getTime()
                      , arriveTime = departDate.parseTime(window.$(tds[1]).html()).getTime()
                    journeys.push([departTime, arriveTime])
                  }
                })
                if (journeys.length === 0) {
                  departDate = new Date(departDate.midnight().getTime() + (24 * 60 * 60 * 1000))
                } else {
                  departDate = new Date(journeys[journeys.length - 1][0])
                }
                if (journeys.length < limit) {
                  // go get some more journeys from translink until we've reached the requested limit
                  fetchJourneys(origin, destination, departDate, limit - journeys.length, function(results) {
                    callback(journeys.concat(results))
                  })
                } else {
                  journeys.length = limit // truncate array to required limit
                  callback(journeys)
                }
              })
            } else {
              callback()
            }
          })
        })
      } else {
        // unexpected response from translink
        callback()
      }
    })
  })
  request.write(data)
  request.end()
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
  var departDate = undefined
    , limit = undefined
  if (req.query.after) {
    departDate = new Date(parseInt(req.query.after))
  }
  if (req.query.limit) {
    limit = parseInt(req.query.limit)
  }
  fetchJourneys(req.params.origin, req.params.destination, departDate, limit, function(journeys) {
    if (journeys) {
      // cache the response until the first journey in the list departs
      var now = new Date()
      var firstDeparting = new Date(journeys[0][0])
      res.header('Cache-Control', 'public; max-age=' + parseInt((firstDeparting - now) / 1000)) 
      res.send(journeys)
    } else {
      res.send(500) // something went wrong :-(      
    }
  })
})

// Only listen on $ node app.js
if (!module.parent) {
  // pre-cache locations
  fetchLocations()
  app.listen(80)
  console.log("Express server listening on port %d", app.address().port)
}