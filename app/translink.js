// monkey patch some prototype extensions
require('./extensions');

// libraries
var http = require('http'),
    url = require('url'),
    $ = require('jquery'),
    request = require('request'),
    async = require('async'),
    moment = require('moment');

// globals
var $host = 'mobile.jp.translink.com.au',
    $concurrency = 5,
    $timezone = 10; // +10 hours
    $locations = null,
    $timeout = 60000,
    $aliases = {
      'Airport Domestic': 'Domestic Airport',
      'Airport International': 'International Airport'
    };

// configuration
http.globalAgent.maxSockets = 50;
process.setMaxListeners(100);

// exports
exports.locations = function(callback) {
  if ($locations) {
    if (callback) callback(null, $locations);
  } else {
    // use the disk-cache until while waiting for the locations to be cached from
    // translink site
    callback(null, require('./locations').locations);
  }
};

exports.journeys = function(origin, destination, after, limit, callback) {
  exports.locations(function(err, locations) {
    if (err) {
      callback(err);
    } else {
      getJourneys(locations, origin, destination, after, limit, callback);
    }
  });
}

exports.boot = function() {
  cacheLocations();
}

// private functions
var cacheLocations = function(callback) {
  getLocations(function(err, locations) {
    if (!err) $locations = locations;
    if (callback) callback(err, $locations);
  });

  // keep the locations up to date by fetching them again tomorrow
  var oneDay = 24 * 60 * 60 * 1000;
  setTimeout(cacheLocations, oneDay);
}

var getLocations = function(callback) {
  var href = 'http://' + $host + '/travel-information/network-information/stops-and-stations/train-stations';

  var req = http.get(url.parse(href), function(res) {
    var body = '';
    res.setEncoding('utf8');

    // append chunked data to the response body
    res.on('data', function(data) {
      body += data;
    });

    res.on('end', function() {
      console.log("TransLink: fetching all locations");
      processLocations(body, callback);
    });
  });

  req.setTimeout($timeout);

  req.on('error', function(err) {
    callback(err);
  });
}

var processLocations = function(body, callback) {
  var locations = {};

  var queue = async.queue(function(href, callback) {
    var options = url.parse(href);
    options.host = $host;

    // get the name from the end of the url
    var name = options.path.match(new RegExp("/([^/]+)$"))[1].unescape().replace(" station", "").toTitleCase();
    locations[name] = { href: url.format(options), platforms: [] };

    var req = http.get(options, function(res) {
      var body = '';
      res.setEncoding('utf8');

      // append chunked data to the response body
      res.on('data', function(data) {
        body += data;
      });

      res.on('end', function() {
        console.log("TransLink: fetching platforms for " + name);
        processPlatforms(body, locations[name].platforms, callback);
      });
    });

    req.setTimeout($timeout);

    req.on('error', function(err) {
      callback(err);
    });
  }, $concurrency);

  queue.drain = function() {
    callback(null, locations);
  }

  $(body).find('.content p > a').each(function() {
    queue.push($(this).attr('href'));
  });
}

var processPlatforms = function(body, platforms, callback) {
  $(body).find('.content ul > li > a').each(function() {
    var pattern = new RegExp("\\d+$");
    var text = $(this).text();
    var href = $(this).attr('href');
    if (href.match(pattern) && text.match(pattern)) {
      platforms.push({
        id: href.match(pattern)[0],
        name: text.match(pattern)[0]
      });
    }
  });
  callback();
}

var parseTranslinkTime = function(date, time) {
  return moment(moment(date).utc().add("hours", $timezone).format('YYYY-MM-DD') + ' ' + time + ' +10:00', 'YYYY-MM-DD h:mma Z');
}

var getJourneys = function(locations, origin, destination, after, limit, callback) {
  if (!after) after = moment();
  if (!limit) limit = 5;

  var journeys = [];

  var queue = async.queue(processJourneys, $concurrency);

  queue.drain = function() {
    var returnResults = function(err, results) {
      if (err) {
        callback(err);
      } else {
        async.sortBy(results, function(item, callback) {
          // sort by depart time
          callback(null, item[1]);
        }, function(err, results) {
          results.length = limit;
          callback(null, results);
        });
      }
    }

    if (journeys.length < limit) {
      // if we didn't find enough journeys, try the next day
      var date = parseTranslinkTime(moment(after).sod().add('days', 1), '0:00am');
      console.log("TransLink: Try journeys after " + date.format() + " because journeys.length " + journeys.length + " < limit " + limit);
      getJourneys(locations, origin, destination, date, limit - journeys.length, function(error, result) {
        returnResults(error, journeys.concat(result))
      });
    } else {
      returnResults(null, journeys);
    }
  }

  if (origin === destination) {
    callback(new Error("Illegal journey: " + origin + " to " + destination));
  } else if (locations.hasOwnProperty(origin) && locations.hasOwnProperty(destination)) {
    var date = moment(after).utc().add('hours', $timezone).format('YYYY-MM-DD');

    for (var i = 0; i < locations[origin].platforms.length; i++) {
      for (var j = 0; j < locations[destination].platforms.length; j++) {
        queue.push({
          href: 'http://' + $host + '/travel-information/network-information/stop-to-stop/' + locations[origin].platforms[i].id + '/' + locations[destination].platforms[j].id + '/' + date,
          after: moment(after),
          journeys: journeys,
          origin: {
            station: origin,
            platform: locations[origin].platforms[i]
          },
          destination: {
            station: destination,
            platform: locations[destination].platforms[j]
          }
        });
      }
    }
  } else if (locations.hasOwnProperty(origin)) {
    callback(new Error("Unknown location: " + destination));
  } else {
    callback(new Error("Unknown location: " + origin));
  }
}

var processJourneys = function(task, callback) {
  request.get({ url: task.href, timeout: $timeout }, function(err, response, body) {
    console.log("TransLink: searching for journeys from " + task.origin.station + "#" + task.origin.platform.name + " to " + task.destination.station + "#" + task.destination.platform.name + " departing after " + task.after.format());
    if (!err && response.statusCode == 200) {

      $(body).find('.content-table tbody tr').each(function(index) {
        var depart_td = $(this).find('td').eq(0).text().trim();
        var arrive_td = $(this).find('td').eq(1).text().trim();

        var tomorrow = moment(task.after).add('days', 1).format('dddd');
        var depart, arrive;

        if (depart_td.indexOf(tomorrow) === -1) {
          depart = parseTranslinkTime(task.after, depart_td);

          if (arrive_td.indexOf(tomorrow) === -1) {
            arrive = parseTranslinkTime(task.after, arrive_td);
          } else {
            // arrives after midnight
            arrive = parseTranslinkTime(moment(task.after).add('days', 1), arrive_td);
          }

          console.log("TransLink: journey found " + task.origin.station + "#" + task.origin.platform.name + " " + depart.format() + " to " + task.destination.station + "#" + task.destination.platform.name  + " " + arrive.format());

          if (depart.toDate() > task.after.toDate()) {
            // smallest on-the-wire representation of a journey
            task.journeys.push([
              parseInt(task.origin.platform.name, 10),
              depart.unix() / 60,
              parseInt(task.destination.platform.name, 10),
              arrive.unix() / 60
            ]);
          }
        }
      });
    } else {
      console.error(err ? JSON.stringify(err) : "response.statusCode = " + response.statusCode);
    }
    callback(err);
  });
}
