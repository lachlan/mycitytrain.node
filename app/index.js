var translink = require('./translink');

exports.index = function(req, res) {
  res.render('index', {
    title: 'MyCitytrain'
  });
};

exports.locations = function(req, res) {
  var sendResponse = function(locations) {
    var oneWeek = 604800;
    // let the client cache the response for a week
    res.header('Cache-Control', 'public; max-age=' + oneWeek);
    res.send(locations);
  };
  
  translink.getLocations(sendResponse);
};

exports.journeys = function(req, res) {
  var departDate = undefined,
      limit = undefined,
      origin = req.params.origin.unescape().toTitleCase(),
      destination = req.params.destination.unescape().toTitleCase();

  if (req.query.after) departDate = Date.parse(req.query.after);
  if (req.query.limit) limit = parseInt(req.query.limit, 10);
  
  var sendResponse = function(journeys) {
    if (journeys) {
      res.send(journeys);
    } else {
      res.send(500); // something went wrong :-(      
    }
  };
  
  translink.getJourneys(origin, destination, departDate, limit, sendResponse);
};
