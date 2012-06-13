// monkey patch some prototype extensions
require('./extensions');

// libraries
var translink = require('./translink')
  , moment = require('moment');

// exports
exports.index = function(req, res, next) {
  res.render('index', {
    title: 'MyCitytrain'
  });
};

exports.locations = function(req, res, next) {
  var sendResponse = function(err, locations) {
    if (err) {
      res.send(500, err); // something went wrong :-(
    } else {
      var array = [];
      for (var property in locations) {
        if (locations.hasOwnProperty(property)) {
          array.push(property);
        }
      }

      var oneWeek = 604800;
      // let the client cache the response for a week
      res.header('Cache-Control', 'public; max-age=' + oneWeek);
      res.send(array);
    }
  };

  translink.locations(sendResponse);
};

exports.journeys = function(req, res, next) {
  var after, limit,
      origin = req.params.origin.unescape().toTitleCase(),
      destination = req.params.destination.unescape().toTitleCase();

  if (req.query.after) after = moment(JSON.parse(req.query.after));
  if (req.query.limit) limit = parseInt(req.query.limit, 10);

  var sendResponse = function(err, journeys) {
    if (err) {
      res.send(500, err); // something went wrong :-(
    } else {
      res.send(journeys);
    }
  };

  translink.journeys(origin, destination, after, limit, sendResponse);
};

exports.boot = function() {
  translink.boot();
}
