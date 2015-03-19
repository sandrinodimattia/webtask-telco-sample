return function(context, req, res) {
  console.log('User:', context.data.user);
  console.log('Body:', context.body);
  console.log('Url:', req.url);
  console.log('Method:', req.method);

  // View renderer.
  var renderProfileView = function(errors) {
    res.writeHead(200, {
      'Content-Type': 'text/html'
    });
    res.end(require('ejs').render(profileView.stringify(), {
      user: JSON.parse(context.data.user),
      country: context.data.country || (context.body != null ? context.body.country : ''),
      customerNumber: (context.body != null ? context.body.customerNumber : ''),
      personalId: (context.body != null ? context.body.personalId : ''),
      url: req.url,
      errors: errors
    }));
  };

  async.series([

    function(callback) {
      if (!context.data.user) {
        console.log('Unauthorized.');

        res.writeHead(403);
        res.end('User not authenticated');
        return callback(true);
      }
      return callback();
    },

    function(callback) {
      if (req.method !== 'POST' && req.method !== 'GET') {
        console.log('Invalid VERB');

        res.writeHead(404);
        res.end('Page not found');
        return callback(true);
      }
      return callback();
    },

    function(callback) {
      if (req.method === 'GET') {
        console.log('Rendering the view.');

        renderProfileView();
        return callback(true);
      }
      return callback();
    },

    function(callback) {
      var errors = validateProfileView(context.body);
      if (errors.length) {
        console.log('Validation error.');

        return callback(errors);
      }
      return callback();
    },

    function(callback) {
      console.log('Searching for home_id');

      findHomeId(context.data.crm_api_token, context.body, function(err, home_id) {
        if (err) {
          return callback(err);
        }

        context.data.home_id = home_id;
        console.log('Found Home ID: ' + home_id);
        return callback();
      });
    },

    function(callback) {
      console.log('Updating user in auth0');

      updateUserProfile(context.data.auth0_api_token, JSON.parse(context.data.user).user_id, context.data.home_id, function(err, home_id) {
        if (err) {
          return callback(err);
        }

        console.log('Done. Redirecting to close url.');

        res.writeHead(301, {Location: 'http://webview.close'});
        res.end();
        return callback(true);
      });
    }
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
 * Call out to the "CRM" to get the home_id
 */
function findHomeId(crm_api_token, data, callback) {
  request.post({
    headers: {
      'Authorization': 'Bearer ' + crm_api_token,
      'Content-Type': 'application/json'
    },
    url: 'http://telco-profile-api.azurewebsites.net/api/home_id/validate',
    json: {
      country: data.country,
      personalId: data.personalId,
      customerNumber: data.customerNumber
    }
  }, function(error, res, body) {
    console.log('CRM Response:', body);

    if (error)
      return callback(new Error('CRM: ' + JSON.stringify(error)));
    if (res.statusCode !== 200)
      return callback(new Error('CRM: ' + (body.error || 'Error obtaining Home ID. HTTP status ' + ares.statusCode)));
    if (!body || typeof body !== 'object' || typeof body.home_id !== 'string')
      return callback(new Error('CRM: Error obtaining home id. Invalid response body.'));
    return callback(null, body.home_id);
  });
}

/*
 * Update the user's profile.
 */
function updateUserProfile(auth0_token, user_id, home_id, callback) {
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
        home_id: home_id
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
 * Validate the body for required fields.
 */
function validateProfileView(body) {
  var errors = [];
  if (!body.country)
    errors.push('The Country is a required field.');
  if (!body.customerNumber)
    errors.push('The Customer Number is a required field.');
  if (!body.personalId)
    errors.push('The Personal ID number is a required field.');
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
      <div data-role="content">
        <p>
          Hi <strong><%- user.name || user.email %></strong>, we just need to know a little more about you...
        </p>
        <div data-role="fieldcontain">
          <label for="country" class="select">Country</label>
          <select name="country" id="country">
            <option>Guatemala</option>
            <option>El Salvador</option>
            <option>Honduras</option>
            <option>Paraguay</option>
            <option>Bolivia</option>
            <option>Colombia</option>
            <option>United States</option>
            <option>Argentina</option>
            <option>Belgium</option>
          </select>
        </div>
        <div data-role="fieldcontain">
          <label for="customerNumber">Customer Number</label>
          <input type="text" name="customerNumber" id="customerNumber" value="<%- customerNumber %>" /></div>
        <div data-role="fieldcontain">
          <label for="personalId">Personal ID</label>
          <input type="text" name="personalId" id="personalId" value="<%- personalId %>" /></div>
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
      <div data-role="footer" data-position="fixed" data-fullscreen="true">
        <div data-role="navbar">
          <ul>
            <li>
              <a href="http://webview.cancel" data-icon="refresh">Cancel</a>
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
  $("#country").val('<%- country %>');
  $("#country").selectmenu('refresh');
  $( document ).on( "click", "#submit", function() {
    var $this = $( this ),
        theme = $.mobile.loader.prototype.options.theme,
        msgText = $.mobile.loader.prototype.options.text,
        textVisible = $.mobile.loader.prototype.options.textVisible,
        textonly = !!$this.jqmData( "textonly" );
        html = $this.jqmData( "html" ) || "";
    $.mobile.loading( "show", {
            text: msgText,
            textVisible: textVisible,
            theme: theme,
            textonly: textonly,
            html: html
    });
  })
});
</script>
</html>
*/
}