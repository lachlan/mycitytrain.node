var translink = require('./translink');

exports.index = function(req, res, next) {
  res.render('index', {
    title: 'MyCitytrain'
  });
};

exports.locations = function(req, res, next) {
  var sendResponse = function(locations) {
    var oneWeek = 604800;
    // let the client cache the response for a week
    res.header('Cache-Control', 'public; max-age=' + oneWeek);
    res.send(locations);
  };
  
  translink.getLocations(sendResponse);
};

exports.journeys = function(req, res, next, callback) {
  var departDate = undefined,
      limit = undefined,
      origin = req.params.origin.unescape().toTitleCase(),
      destination = req.params.destination.unescape().toTitleCase();

  if (req.query.after) departDate = Date.parse(req.query.after);
  
  if (!callback) {
    callback = function(err, journeys) {
      if (err) {
        res.send(500, err); // something went wrong :-(    
      } else {
        res.send(journeys);
      }
    };
  }

  translink.getJourneys(origin, destination, departDate, callback);
};

exports.journeys_DEPRECATED = function(req, res, next) {
  var callback = function(err, journeys) {
    if (err) {
      res.send(500, err); // something went wrong :-(    
    } else {
      var old = [];
      for(var i = 0; i < journeys.length; i++) {
        old.push([journeys[i].origin.datetime, journeys[i].destination.datetime]);
      }
      res.send(old);
    }
  };

  exports.journeys(req, res, callback);
};