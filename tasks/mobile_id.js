return function(context, req, res) {
	console.log('User:', context.data.user);
	console.log('Body:', context.body);
	console.log('Url:', req.url);
	console.log('Method:', req.method);

	// View renderer.
	var renderProfileView = function(errors, messages) {
		res.writeHead(200, {
			'Content-Type': 'text/html'
		});
		res.end(require('ejs').render(profileView.stringify(), {
			user: JSON.parse(context.data.user),
			mobilePhoneNumber: (context.body != null ? context.body.mobilePhoneNumber : ''),
			verificationCode: (context.body != null ? context.body.verificationCode : ''),
			url: req.url,
			errors: errors,
			messages: messages
		}));
	};

	async.series([
		/*
		 * Basic request validation.
		 */
		function(callback) {
			if (!context.data.user) {
				res.writeHead(403);
				res.end('User not authenticated');
				return callback(true);
			}
			if (req.method !== 'POST' && req.method !== 'GET') {
				res.writeHead(404);
				res.end('Page not found');
				return callback(true);
			}
			return callback();
		},

		/*
		 * 1. GET: Render View.
		 */
		function(callback) {
			if (req.method === 'GET') {
				console.log('Rendering the view.');

				renderProfileView();
				return callback(true);
			}
			return callback();
		},

		/* 
		 * 2. POST starts here. Validate input.
		 */
		function(callback) {
			var errors = validateProfileView(context.body);
			if (errors.length) {
				console.log('Validation error.');

				return callback(errors);
			}
			return callback();
		},

		/* 
		 * 3. If user clicked the SMS button, generate the verification code and store in Auth0.
		 */
		function(callback) {
			if (context.body.action !== 'sms')
				return callback();

			var verificationCode = Math.floor(Math.random() * 90000) + 10000;
			console.log('Generating SMS verification code:', verificationCode);

			persistVerificationCode(context.data.auth0_api_token, JSON.parse(context.data.user).user_id, verificationCode, context.body.mobilePhoneNumber, function(err) {
				if (err) {
					return callback(err);
				}

				context.data.verification_code = verificationCode;
				console.log('Verification code persisted.');
				return callback();
			});
		},

		/* 
		 * 4. If user clicked the SMS button, send the verification code using Twilio.
		 */
		function(callback) {
			if (context.body.action !== 'sms')
				return callback();

			console.log('Sending SMS with Twilio:', context.body.mobilePhoneNumber);

			sendTwilioSMS(context.data.twilio_auth_token, context.data.twilio_account_sid, context.data.twilio_number,
				context.body.mobilePhoneNumber, 'Your verification code: ' + context.data.verification_code, function(err) {
					if (err) {
						return callback(err);
					}

					console.log('Done. SMS sent from ' + context.data.twilio_number + ' to ' + context.body.mobilePhoneNumber + '.');

					var messages = [];
					messages.push('SMS sent to ' + context.body.mobilePhoneNumber);
					renderProfileView(null, messages);
					return callback(true);
				});
		},

		/* 
		 * 5. If user clicked submit, load the verification code from the user's profile in Auth0.
		 *    Then validate the verification code.
		 */
		function(callback) {
			console.log('Loading verification code. User code: ' + context.body.verificationCode);

			loadVerificationCode(context.data.auth0_api_token, JSON.parse(context.data.user).user_id, function(err, verification_code, phone_number) {
				if (err) {
					return callback(err);
				}

				if (context.body.verificationCode != verification_code) {
					console.log('Invalid verification code. Server code: ' + verification_code);
					return callback(new Error('Invalid verification code.'));
				} else if (context.body.mobilePhoneNumber != phone_number) {
					console.log('Invalid verification number. Server number: ' + phone_number);
					return callback(new Error('Invalid verification number. Server number: ' + phone_number));
				}

				return callback();
			});
		},

		/* 
		 * 6. If user clicked submit, persiste the mobile_id in the user's Auth0 profile and close the Web View.
		 */
		function(callback) {
			var mobileId = 'MID' + context.body.mobilePhoneNumber.replace(/\D/g, '');;
			console.log('Persisting mobile_id: ' + mobileId);

			persistMobileId(context.data.auth0_api_token, JSON.parse(context.data.user).user_id, mobileId, function(err) {
				if (err) {
					return callback(err);
				}

				console.log('mobile_id persisted.');

				res.writeHead(301, {
					Location: 'http://webview.close'
				});
				res.end();
				return callback(true);
			});
		},
	], function(err) {
		if (Array.isArray(err)) {
			return renderProfileView(err);
		}
		if (typeof err === 'object') {
			var errors = [];
			errors.push(err.message || err);
			return renderProfileView(errors);
		}
	});
}

/*
 * Update the user's profile.
 */
function persistVerificationCode(auth0_token, user_id, verificationCode, phoneNumber, callback) {
	var auth0_url = 'https://login.auth0.com/api/v2/users/' + user_id;
	console.log(auth0_url);

	request.patch({
		url: auth0_url,
		headers: {
			'Authorization': 'Bearer ' + auth0_token,
			'Content-Type': 'application/json'
		},
		json: {
			app_metadata: {
				mobile_id_verification_number: phoneNumber,
				mobile_id_verification_code: verificationCode,
				mobile_id_verification_code_created: new Date()
			}
		}
	}, function(error, res, body) {
		console.log('Auth0 Response:', body);

		if (error)
			return callback(new Error('Auth0: ' + JSON.stringify(error)));
		if (res.statusCode !== 200)
			return callback(new Error('Auth0: Error updating user. HTTP status ' + res.statusCode));
		if (!body || typeof body !== 'object')
			return callback(new Error('Auth0: Error updating user. Invalid response body.'));
		return callback();
	});
}

/*
 * Get the verification code from the user's profile.
 */
function loadVerificationCode(auth0_token, user_id, callback) {
	var auth0_url = 'https://login.auth0.com/api/v2/users/' + user_id;
	console.log(auth0_url);

	request.get({
		url: auth0_url,
		headers: {
			'Authorization': 'Bearer ' + auth0_token,
			'Content-Type': 'application/json'
		}
	}, function(error, res, body) {
		console.log('Auth0 Response:', body);

		if (error)
			return callback(new Error('Auth0: ' + JSON.stringify(error)));
		if (res.statusCode !== 200)
			return callback(new Error('Auth0: Error retrieving verification code. HTTP status ' + res.statusCode));
		body = JSON.parse(body);
		if (!body || typeof body !== 'object')
			return callback(new Error('Auth0: Error retrieving verification code. Invalid response body.'));
		if (!body.app_metadata || !body.app_metadata.mobile_id_verification_code)
			return callback(new Error('Auth0: Error verification code missing.'));
		if (!body.app_metadata || !body.app_metadata.mobile_id_verification_number)
			return callback(new Error('Auth0: Error verification number missing.'));
		return callback(null, body.app_metadata.mobile_id_verification_code, body.app_metadata.mobile_id_verification_number);
	});
}

/*
 * Update the user's profile.
 */
function persistMobileId(auth0_token, user_id, mobile_id, callback) {
	var auth0_url = 'https://login.auth0.com/api/v2/users/' + user_id;
	console.log(auth0_url);

	request.patch({
		url: auth0_url,
		headers: {
			'Authorization': 'Bearer ' + auth0_token,
			'Content-Type': 'application/json'
		},
		json: {
			app_metadata: {
				mobile_id: mobile_id
			}
		}
	}, function(error, res, body) {
		console.log('Auth0 Response:', body);

		if (error)
			return callback(new Error('Auth0: ' + JSON.stringify(error)));
		if (res.statusCode !== 200)
			return callback(new Error('Auth0: Error updating user. HTTP status ' + res.statusCode));
		if (!body || typeof body !== 'object')
			return callback(new Error('Auth0: Error updating user. Invalid response body.'));
		return callback();
	});
}

/*
 * Send Twilio SMS.
 */
function sendTwilioSMS(twilio_auth_token, twilio_account_sid, twilio_number, destination, message, callback) {
	request({
		url: 'https://api.twilio.com/2010-04-01/Accounts/' + twilio_account_sid + '/Messages',
		method: 'POST',
		auth: {
			user: twilio_account_sid,
			pass: twilio_auth_token
		},
		form: {
			From: twilio_number,
			To: destination,
			Body: message
		}
	}, function(error, res, body) {
		console.log('Twilio Response:', body);

		if (error)
			return callback(new Error('Twilio: ' + JSON.stringify(error)));
		if (res.statusCode !== 200 && res.statusCode !== 201)
			return callback(new Error('Twilio: Error sending SMS. HTTP status ' + res.statusCode));
		return callback();
	});
}

/*
 * Validate the body for required fields.
 */
function validateProfileView(body) {
	var errors = [];
	if (!body.mobilePhoneNumber)
		errors.push('The Mobile Phone Number is a required field.');
	if (body.action !== 'sms' && !body.verificationCode)
		errors.push('The Verification Code is a required field.');
	return errors;
}

/*
 * The profile view containing the fields the user must complete.
 */
function profileView() {
	/*
<html>
<head>
  <meta name="viewport" content="initial-scale=1.0">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black">
  <script src="//code.jquery.com/jquery-1.9.1.min.js"></script>
  <script src="//code.jquery.com/mobile/1.3.1/jquery.mobile-1.3.1.min.js"></script>
  <link rel="stylesheet" href="//raw.githubusercontent.com/driftyco/graphite/master/generated/slate/jquery.mobile-1.3.1.css" media="screen"></head>
<body style="margin-top: 60px;">
  <div data-role="page">
    <form class="form-horizontal" method="POST" id="form" style="margin: 0px;">
      <input type="hidden" id="action" name="action" value="submit" />
      <div data-role="content">
        <p>
          Hi <strong><%- user.name || user.email %></strong>, we just need to know a little more about you...
        </p>
        <div data-role="fieldcontain">
          <label for="mobilePhoneNumber">Mobile Phone Number</label>
          <input type="text" name="mobilePhoneNumber" id="mobilePhoneNumber" value="<%- mobilePhoneNumber %>" /></div>
        <div data-role="fieldcontain">
          <label for="verificationCode">Verification Code</label>
          <input type="text" name="verificationCode" id="verificationCode" value="<%- verificationCode %>" /></div>
      </div>
      <% if (errors && errors.length) { %>
      <div class="ui-body ui-corner-all">
        <div style="color: red;">
          <% errors.forEach(function(error){ %>
          <p>
            <%= error %>
          </p>
          <% }) %>
        </div>
      </div>
      <% } %>
      <% if (messages && messages.length) { %>
      <div class="ui-body ui-corner-all">
        <div>
          <ul>
          <% messages.forEach(function(msg){ %>
          <li>
            <em><%= msg %></em>
          </li>
          <% }) %>
          </ul>
        </div>
      </div>
      <% } %>
      <div data-role="footer" data-position="fixed" data-fullscreen="true">
        <div data-role="navbar">
          <ul>
            <li>
              <a href="http://webview.cancel" data-icon="refresh">Cancel</a>
            </li>
            <li>
              <a id="sms" href="javascript:document.getElementById('form').submit()" data-icon="check">Send SMS</a>
            </li>
            <li>
              <a id="submit" href="javascript:document.getElementById('form').submit()" data-icon="check">Submit</a>
            </li>
          </ul>
        </div>
      </div>
    </form>
  </div>
</body>
  <script type="text/javascript">
$(function() {
  $( document ).on( "click", "#sms", function() {
	$('#action').val('sms');

    var $this = $(this);
    $.mobile.loading( "show", {
            text: "Sending SMS...",
            textVisible: true,
            theme: 'a'
    });
  })

  $( document ).on( "click", "#submit", function() {
    var $this = $(this);
    $.mobile.loading( "show", {
            text: "",
            textVisible: true,
            theme: 'a'
    });
  })
});
</script>
</html>
*/
}