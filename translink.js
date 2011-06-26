var http = require('http')
  , qs = require('querystring')
  , $ = require('jquery')
  , _ = require('underscore')
  , locations = undefined
  , translinkTimezoneOffset = -600 // Brisbane/Australia
  , aliases = {
    'Airport Domestic': 'Domestic Airport'
  , 'Airport International': 'International Airport'
  };

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

exports.getLocations = function(callback) {
  // fetch all the citytrain network locations from the Queensland Rail web site
  var getLocationsFromTransLink = function(callback) {
    // get the list of locations from the Queensland Rail web site, because 
    // the TransLink site doesn't seem to list them (except in PDF timetables)
    var options = {
      host: 'www.queenslandrail.com.au',
      port: 80,
      path: '/AllStations/Pages/AllStations.aspx',
      method: 'GET'
    };

    var request = http.request(options, function(response) {
      var body = '';
      response.setEncoding('utf8');
      
      // append chunked data to the response body
      response.on('data', function(data) {
        body += data;
      });
      
      // parse the response body to build the list of locations
      response.on('end', function() {
        // start with an empty array
        locations = [];
        
        $(body).find('select option').each(function() {
          // there's only one <select> tag on the page, which
          // are the network locations, build an array from
          // each one
          locations.push($(this).attr('value').trim());
        });
        
        // because the http request/response is asynchronous,
        // if there's a callback let's call it now passing
        // the locations
        if (callback) callback(locations);
      });
    });
    request.end();
    
    // automatically refresh all the locations from every day
    var oneDay = 24 * 60 * 60 * 1000;
    setInterval(getLocationsFromTransLink, oneDay);
  };

  if (callback) {
    // use the cached locations list if it exists, otherwise
    // fetch them from the web site and cache them for a day
    if (locations) {
      callback(locations);
    } else {
      getLocationsFromTransLink(callback);
    }
  }
};

exports.getJourneys = function(origin, destination, departDate, limit, callback) {
  
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
      , TimeSearchMode: 'LeaveAfter'
      , SearchDate: ('' + departDate.toTimezone(translinkTimezoneOffset).getFullYear() + '-' + (departDate.toTimezone(translinkTimezoneOffset).getMonth() + 1) + '-' + departDate.toTimezone(translinkTimezoneOffset).getDate())
      , SearchHour: departDate.toTimezone(translinkTimezoneOffset).getHours() <= 12 ? departDate.toTimezone(translinkTimezoneOffset).getHours() : departDate.toTimezone(translinkTimezoneOffset).getHours() - 12
      , SearchMinute: departDate.toTimezone(translinkTimezoneOffset).getMinutes()
      , TimeMeridiem: departDate.toTimezone(translinkTimezoneOffset).getHours() < 12 ? 'AM' : 'PM'
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
                departDate = new Date(departDate.midnight().fromTimezone(translinkTimezoneOffset).getTime() + (24 * 60 * 60 * 1000))                
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