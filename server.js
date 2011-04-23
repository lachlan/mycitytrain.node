var express = require('express')
  , http = require('http')
  , qs = require('querystring')
  , $ = require('jquery')
  , _ = require('underscore')
  
var app = module.exports = express.createServer()
  , locations = undefined
  , translinkTimezoneOffset = -600 // Brisbane/Australia
  , aliases = {
    'Airport Domestic': 'Domestic Airport'
  , 'Airport International': 'International Airport'
  }

app.configure(function() {
  app.set('views', __dirname + '/views')
  app.set('view engine', 'jade')
  app.use(express.bodyParser())
  app.use(express.methodOverride())
  app.use(express.compiler({ src: __dirname + '/public', enable: ['less'] }))
  app.use(app.router)
  app.use(express.logger({ format: ':method :uri' }));
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

var fetchLocations = function(callback) {
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
      locations = []
      $(body).find('select option').each(function() {
          locations.push($(this).attr('value').trim())
      })
      if (callback) callback(locations)
    })
  })
  request.end()
  
  // fetch the locations again in a day
  setInterval(fetchLocations, 24 * 60 * 60 * 1000)
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

/* To Title Case 1.1.1
 * David Gouch <http://individed.com>
 * 23 May 2008
 * License: http://individed.com/code/to-title-case/license.txt
 *
 * In response to John Gruber's call for a Javascript version of his script: 
 * http://daringfireball.net/2008/05/title_case
 */
String.prototype.toTitleCase = function() {
  return this.replace(/([\w&`'‘’"“.@:\/\{\(\[<>_]+-? *)/g, function(match, p1, index, title) {
    if (index > 0 && title.charAt(index - 2) !== ":" && match.search(/^(a(nd?|s|t)?|b(ut|y)|en|for|i[fn]|o[fnr]|t(he|o)|vs?\.?|via)[ \-]/i) > -1)
      return match.toLowerCase();
    if (title.substring(index - 1, index + 1).search(/['"_{(\[]/) > -1)
      return match.charAt(0) + match.charAt(1).toUpperCase() + match.substr(2);
    if (match.substr(1).search(/[A-Z]+|&|[\w]+[._][\w]+/) > -1 || title.substring(index - 1, index + 1).search(/[\])}]/) > -1)
      return match;
    return match.charAt(0).toUpperCase() + match.substr(1);
  });
};

String.prototype.escape = function() {
  return escape(this.replace(/\s/g, '-'));
}

String.prototype.unescape = function() {
  return unescape(this).replace(/[-_]/g, ' ');
}

Date.prototype.toTimezone = function(targetOffset) {
  var date = new Date(this)
  if (_(targetOffset).isNumber()) date.setMinutes(date.getMinutes() + (date.getTimezoneOffset() - targetOffset))
  return date;
}

Date.prototype.fromTimezone = function(sourceOffset) {
  var date = new Date(this)
  if (_(sourceOffset).isNumber()) date.setMinutes(date.getMinutes() + (sourceOffset - date.getTimezoneOffset()))
  return date;
}

Date.prototype.midnight = function() {
  var date = new Date(this)
  date.setHours(0)
  date.setMinutes(0)
  date.setSeconds(0)
  date.setMilliseconds(0)
  return date;
}

Date.prototype.parseTime = function(timeString) {
  var date = new Date(this)
  if (_(timeString).isString())
    timeString.trim()
  else
    timeString = ''

  var matches = timeString.match(/(\d{1,2})\.(\d{1,2})(am|pm)/i)
  if (matches) {
    var hours = parseInt(matches[1], 10)
      , minutes = parseInt(matches[2], 10)
      , meridiem = matches[3].toLowerCase()
        
    if (meridiem === 'am' && hours === 12) 
      hours = 0 // if translink returns 12am, so set the hour to 0
    else if (meridiem === 'pm' && hours < 12) 
      hours += 12
      
    if (meridiem === 'am' && date.getHours() >= 12)
      date.setDate(date.getDate() + 1);  // after midnight so add 1 day

    date.setHours(hours)
    date.setMinutes(minutes)
    date.setSeconds(0)
    date.setMilliseconds(0)
  }
  return date;
}

Date.__original_parse__ = Date.parse;
Date.parse = function(other) {
  var date = new Date()
  if (_(other).isNumber()) {
    date.setTime(other)
  } else if (_(other).isDate()) {
    date = other
  } else if (_(other).isString()){
    var matches = other.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}).(\d{3})(Z)/)  // ISO8601 datetime string
    if (matches) {
      var year = parseInt(matches[1], 10)
        , month = parseInt(matches[2], 10)
        , day = parseInt(matches[3], 10)
        , hours = parseInt(matches[4], 10)
        , minutes = parseInt(matches[5], 10)
        , seconds = parseInt(matches[6], 10)
        , milliseconds = parseInt(matches[7], 10)
        
      date = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds, milliseconds))
    } else {
      date = Date.__original_parse__(other);
    }
  } else {
    date = Date.__original_parse__(other);
  }
  return date
}

var fetchJourneys = function(origin, destination, departDate, limit, callback) {
  
  if (!_(departDate).isDate()) {
    departDate = new Date()    
  }
  
  // add a minute to the departDate to only fetch journeys departing after that date
  departDate.setMinutes(departDate.getMinutes() + 1)
  
  if (!_(limit).isNumber() || limit < 0) {
    // default to how many results translink return in a single search
    limit = 4 
  } else {
    // otherwise just make sure we've got an integer
    limit = Math.floor(limit) 
  }
    
  var host = 'jp.translink.com.au'
    , port = 80
    , data = qs.encode({
        FromStation: origin
      , ToStation: destination
      , TimeSearchMode: 'DepartAt'
      , SearchDate: ('' + departDate.toTimezone(translinkTimezoneOffset).getFullYear() + '-' + (departDate.toTimezone(translinkTimezoneOffset).getMonth() + 1) + '-' + departDate.toTimezone(translinkTimezoneOffset).getDate())
      , SearchHour: departDate.toTimezone(translinkTimezoneOffset).getHours() <= 12 ? departDate.toTimezone(translinkTimezoneOffset).getHours() : departDate.toTimezone(translinkTimezoneOffset).getHours() - 12
      , SearchMinute: departDate.toTimezone(translinkTimezoneOffset).getMinutes()
      , TimeMeridiem: departDate.toTimezone(translinkTimezoneOffset).getHours() < 12 ? 'AM' : 'PM'
      })

  console.log('request data = ' + data)

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
          })
          res.on('end', function() {            
            if (res.statusCode == 200) {
              var journeys = []
              $(body).find('#optionsTable tbody tr').each(function() {                
                var tds = $(this).find('td.timetd')                
                if (tds.length >= 2) {
                  var departTime = departDate.parseTime($(tds[0]).html().trim()).fromTimezone(translinkTimezoneOffset)
                    , arriveTime = departDate.parseTime($(tds[1]).html().trim()).fromTimezone(translinkTimezoneOffset)
                  journeys.push([departTime, arriveTime])
                }
              })
              if (journeys.length === 0) {
                // if no journeys then try the next day from midnight 
                departDate = new Date(departDate.midnight().toTimezone(translinkTimezoneOffset).getTime() + (24 * 60 * 60 * 1000))                
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
  var oneYear = 31557600000;
  res.header('Cache-Control', 'public; max-age=' + oneYear)
  res.render('index', {
    title: 'MyCitytrain'
  })
})

app.get('/cache.manifest', function(req, res) {
  // horrible but quick hack to return an HTML cache manifest with the correct mime type
  var manifest = "CACHE MANIFEST\n\
# version 0.0.13\n\
/\n\
/favicon.ico\n\
/images/apple-touch-icon-114x114.png\n\
/images/apple-touch-icon-72x72.png\n\
/images/apple-touch-icon-57x57.png\n\
/images/background_4x1.png\n\
/images/drop_shadow_1x10.png\n\
/images/sprites.png\n\
/images/startup-320x460.png\n\
/scripts/app.js\n\
/styles/app.css\n\
/styles/effects.css\n\
\n\
NETWORK:\n\
/data"

  res.header('Content-Type', 'text/cache-manifest');
  res.end(manifest);
})


app.get('/data/locations.json', function(req, res) {
  getLocations(function(locations) {
    var oneWeek = 604800;
    res.header('Cache-Control', 'public; max-age=' + oneWeek) // let the client cache the response for a week
    res.send(locations)
  })
})

app.get('/data/:origin/:destination.json', function(req, res) {
  var departDate = undefined
    , limit = undefined
    , origin = req.params.origin.unescape().toTitleCase()
    , destination = req.params.destination.unescape().toTitleCase()

  if (req.query.after) {
    departDate = Date.parse(req.query.after)
    console.log('after = ' + req.query.after)
  }
  if (req.query.limit) {
    limit = parseInt(req.query.limit, 10)
    console.log('limit = ' + limit)
  }
  
  fetchJourneys(aliases[origin] || origin, aliases[destination] || destination, departDate, limit, function(journeys) {
    if (journeys) {
      // cache the response until the first journey in the list departs
      var now = new Date()
      var firstDeparting = new Date(journeys[0][0])
      var maxAge = parseInt((firstDeparting.getTime() - now.getTime()) / 1000, 10) - 59
      if (maxAge < 0) maxAge = 0
      res.header('Cache-Control', 'public; max-age=' + maxAge) 
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
  app.listen(process.env.PORT || 3000)
  console.log("Express server listening on port %d", app.address().port)
}