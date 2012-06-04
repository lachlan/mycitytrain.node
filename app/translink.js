var http = require('http'),
    $ = require('jquery'),
    _ = require('underscore'),
    Browser = require('zombie'),
    moment = require('moment'),
    locations = undefined,
    translinkTimezoneOffset = -600, // Brisbane/Australia
    aliases = {
      'Airport Domestic': 'Domestic Airport',
      'Airport International': 'International Airport'
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
  return this.replace(/([\w&`'ëí"ì.@:\/\{\(\[<>_]+-? *)/g, function(match, p1, index, title) {
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
  var date = new Date(this);
  if (_(targetOffset).isNumber()) date.setMinutes(date.getMinutes() + (date.getTimezoneOffset() - targetOffset));
  return date;
}

Date.prototype.fromTimezone = function(sourceOffset) {
  var date = new Date(this);
  if (_(sourceOffset).isNumber()) date.setMinutes(date.getMinutes() + (sourceOffset - date.getTimezoneOffset()));
  return date;
}

Date.prototype.midnight = function() {
  var date = new Date(this);
  date.setHours(0);
  date.setMinutes(0);
  date.setSeconds(0);
  date.setMilliseconds(0);
  return date;
}

Date.prototype.parseTime = function(timeString) {
  var date = new Date(this);
  if (_(timeString).isString())
    timeString.trim();
  else
    timeString = '';

  var matches = timeString.match(/(\d{1,2})\.(\d{1,2})(am|pm)/i);
  if (matches) {
    var hours = parseInt(matches[1], 10),
        minutes = parseInt(matches[2], 10),
        meridiem = matches[3].toLowerCase();
        
    if (meridiem === 'am' && hours === 12) 
      hours = 0; // if translink returns 12am, so set the hour to 0
    else if (meridiem === 'pm' && hours < 12) 
      hours += 12;
      
    if (meridiem === 'am' && date.getHours() >= 12)
      date.setDate(date.getDate() + 1);  // after midnight so add 1 day

    date.setHours(hours);
    date.setMinutes(minutes);
    date.setSeconds(0);
    date.setMilliseconds(0);
  }
  return date;
}

Date.__original_parse__ = Date.parse;

Date.parse = function(other) {
  var date = new Date();
  if (_(other).isNumber()) {
    date.setTime(other);
  } else if (_(other).isDate()) {
    date = other;
  } else if (_(other).isString()){
    var matches = other.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}).(\d{3})(Z)/);  // ISO8601 datetime string
    if (matches) {
      var year = parseInt(matches[1], 10),
          month = parseInt(matches[2], 10),
          day = parseInt(matches[3], 10),
          hours = parseInt(matches[4], 10),
          minutes = parseInt(matches[5], 10),
          seconds = parseInt(matches[6], 10),
          milliseconds = parseInt(matches[7], 10);
        
      date = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds, milliseconds));
    } else {
      date = Date.__original_parse__(other);
    }
  } else {
    date = Date.__original_parse__(other);
  }
  return date;
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

var getJourneys = function(origin, destination, departDate, callback) {
  if (_(departDate).isDate()) {
    departDate = moment(departDate);
  } else {
    departDate = moment();
  }
  
  // add a minute to the departDate to only fetch journeys departing after that date
  departDate.add("minutes", 1);

  // round to the next nearest 5 minute mark, because that's all the translink journey planner supports
  var remainder = departDate.minutes() % 5;
  if (remainder > 0) departDate.add("minutes", 5 - remainder);

  // convert to translink timezone
  var translinkDate = moment(departDate.toDate().toTimezone(translinkTimezoneOffset));

  var journeys = [];
  var platformPattern = new RegExp("^(.+)(\\d+)");
  var browser = new Browser({ debug: true, runScripts: false });

  console.info("Search: " + origin + '..' + destination + ' > ' + departDate.format());

  browser.visit("http://jp.translink.com.au/travel-information/journey-planner", function (err) {
    if (browser.success) {
      browser.fill("Start", origin + " Station")
        .fill("End", destination + " Station")
        .choose("TimeSearchMode", "LeaveAfter")
        .check("TransportModes", "Train")
        .uncheck("TransportModes", "Bus")
        .uncheck("TransportModes", "Ferry")
        .select("SearchDate", translinkDate.format('D/MM/YYYY') + ' 12:00:00 AM')
        .select("SearchHour", translinkDate.format('h'))
        .select("SearchMinute", translinkDate.format('m'))
        .select("TimeMeridiem", translinkDate.format('a'))
        .pressButton("Find journey", function(err) {
          if (browser.success) { 
            var html = $(browser.body);
            var times = html.find('.itinerary .train .option-detail li > b');
            if (times.length >= 2) {
              var departTime = moment(translinkDate.format('YYYY-MM-DD') + ' ' + times.eq(0).text() + ' +10:00', 'YYYY-MM-DD h:mma Z');
              var arriveTime = moment(translinkDate.format('YYYY-MM-DD') + ' ' + times.eq(1).text() + ' +10:00', 'YYYY-MM-DD h:mma Z');
              console.info("Journey: departing " + origin + ' ' + departTime.format() + ' arriving ' + destination + ' ' + arriveTime.format());

              journeys.push({
                origin: {
                  station: origin,
                  platform: parseInt(html.find('.itinerary .train .option-detail li > a').eq(0).text().replace(platformPattern, "$2"), 10),
                  datetime: moment(departTime).toDate()
                },
                destination: {
                  station: destination,
                  platform: parseInt(html.find('.itinerary .train .option-detail li > a').eq(1).text().replace(platformPattern, "$2"), 10),
                  datetime: moment(arriveTime).toDate()
                },
              });
            }

            callback(journeys.length === 0 ? new Error("Journey not found") : undefined, journeys);
          } else {
            callback(err, journeys);
          }
        });
    } else {
      callback(err, journeys);
    }
  });
}

exports.getJourneys = getJourneys;
