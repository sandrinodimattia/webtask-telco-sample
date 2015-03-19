var http       = require('http');
var express    = require('express');
var jwt        = require('express-jwt');
var app        = express();
var nconf      = require('nconf');
var bodyParser = require('body-parser');

// Load configuration.
nconf.argv()
   .env()
   .file({ file: 'config.json' });

// Fake database search.
var findHomeId = function(country, customerNumber, personalId) {
	var home_id_database = {
		'United States_12345_EUGENIOP123': 'HID54321',
		'Argentina_67890_MATIASW456': 'HID09876',
		'Belgium_11111_SANDRINOD789': 'HID11111'
	};
	
	var searchKey = country + '_' + customerNumber + '_' + personalId;
	return home_id_database[searchKey];
};

// Configure authentication.
var authenticate = jwt({
  secret: new Buffer(nconf.get('AUTH0_CLIENT_SECRET'), 'base64'),
  audience: nconf.get('AUTH0_CLIENT_ID')
});

// Configure Express.
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Create routes.
var router = express.Router();
router.post('/home_id/validate', authenticate, function(req, res) {
	var home_id = findHomeId(req.body.country, 
		req.body.customerNumber, req.body.personalId);
	if (home_id)
    	return res.json({ home_id: home_id });
    return res.status(404).json({ error: 'Could not find home_id.'});
});
app.use('/api', router);

// Return a clean error.
app.use(function (err, req, res, next) {
  if (err.name === 'UnauthorizedError') {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

// Start server.
var port = process.env.PORT || 5000;
http.createServer(app).listen(port, function (err) {
  console.log('Listening on http://localhost:' + port);
});