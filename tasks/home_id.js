return function(context, req, res) {
  console.log('Context:', context);
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

        res.redirect('telco-close://localhost');
        return callback();
      });
    },

    function(callback) {
      // Render VIEW
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
    return callback(body.access_token);
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
  <meta name="viewport" content="initial-scale = 1.0,maximum-scale = 1.0" />
  <title>Complete Profile: home_id</title>
  <link rel="stylesheet" href="//bootswatch.com/paper/bootstrap.min.css" media="screen">
</head>
<body style="margin-top: 60px;">
  <div class="navbar navbar-default navbar-fixed-top">
    <div class="container">
      <div class="navbar-header">
        <div class="navbar-brand">Complete Profile</div>
      </div>
    </div>
  </div>

  <div class="container">
    <div class="row">
      <div class="col-lg-6">
        <div class="well">
          <form class="form-horizontal" method="POST">
            <fieldset>
              <legend>Hi <%- user.name || user.email %>, we just to know a little more about you...</legend>
              <div class="form-group">
                <label for="country" class="col-lg-4 control-label">Countries</label>
                <div class="col-lg-8">
                  <select class="form-control" id="country" name="country">
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
              </div>
              <div class="form-group">
                <label for="customerNumber" class="col-lg-4 control-label">Customer Number</label>
                <div class="col-lg-8">
                  <input type="text" class="form-control" id="customerNumber" name="customerNumber" value="<%- customerNumber %>" placeholder="Customer Number"></div>
              </div>
              <div class="form-group">
                <label for="personalId" class="col-lg-4 control-label">Personal ID</label>
                <div class="col-lg-8">
                  <input type="text" class="form-control" id="personalId" name="personalId" value="<%- personalId %>" placeholder="Personal Id"></div>
              </div>

              <% if (errors && errors.length) { %>
              <div class="alert alert-danger" style="margin-bottom: 0px;">
                <% errors.forEach(function(error){ %>
                <p><span class="glyphicon glyphicon-remove-circle" aria-hidden="true"></span> 
                  <%= error %>
                </p>
                <% }) %>
              </div>
              <% } %>
            </div>

            <div class="form-group">
              <div class="col-lg-12">
                <a class="btn btn-warning" href="http://telco/cancel">Cancel</a>
                <button type="submit" class="btn btn-primary">Submit</button>
              </div>
            </div>
          </fieldset>
        </form>

        <pre style="margin-top: 80px;">User ID: <%- user.user_id %></pre>
      </div>
    </div>
  </div>
</div>
</body>
<script src="//code.jquery.com/jquery-1.11.2.min.js"></script>
<script type="text/javascript">
$(function() {
  $("#country").val('<%- country %>');
});
</script>
</html>
*/
}