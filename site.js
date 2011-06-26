var translink = require('./translink');

exports.index = function(req, res) {
  res.render('index', {
    title: 'MyCitytrain'
  });
};

exports.manifest = function(req, res) {
  // horrible but quick hack to return an HTML cache 
  // manifest with the correct mime type
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
}

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
  var departDate = undefined
    , limit = undefined
    , origin = req.params.origin.unescape().toTitleCase()
    , destination = req.params.destination.unescape().toTitleCase();

  if (req.query.after) departDate = Date.parse(req.query.after);
  if (req.query.limit) limit = parseInt(req.query.limit, 10);
  
  var sendResponse = function(journeys) {
    if (journeys) {
      // cache the response until the first journey in the list departs
      var now = new Date();
      var firstDeparting = new Date(journeys[0][0]);
      var maxAge = (parseInt((firstDeparting.getTime() - now.getTime()) / 60000, 10) - 1) * 60;
      if (maxAge > 0) res.header('Cache-Control', 'public; max-age=' + maxAge);
      res.send(journeys);
    } else {
      res.send(500); // something went wrong :-(      
    }
  };
  
  translink.getJourneys(origin, destination, departDate, limit, sendResponse);
};