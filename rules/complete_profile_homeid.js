function (user, context, callback) {
  
  if (context.clientName !== 'Telco Mobile')
    return callback(null, user, context);
  
  
  // Helper to generate a webtask token.
  function webTaskIssueToken(url, current_user, crmToken, cb) {
    request.post({
      url: 'https://sandbox.it.auth0.com/api/tokens/issue',
      headers: {
        "Authorization": "Bearer " + configuration.webtasks_token,
        "Content-type": "application/json"
      },
      json: {
        pctx: {
          webtask_pb: 1,
          webtask_no_cache: 1, // TODO: Remove for production.
          user: JSON.stringify({
            user_id: user.user_id,
            name: user.name,
            email: user.email
          }),
          country: context.request.geoip ? 
          (context.request.geoip.country_name || context.request.geoip.country) : null
        },
        ectx: {
          webtask_url: url,
          crm_api_token: crmToken,
          auth0_api_token: configuration.auth0_api_token
        }
      },
      timeout: 2500
    }, cb);
  }

  // Create a token for the Telco CRM.
  function createTokenForCRM() {
    var api_user = {
      user_id: user.user_id,
      email: user.email,
      name: user.name
    };

    var options = {
      subject: user.id,
      expiresInMinutes: 60,
      audience: configuration.telco_crm_api_client_id,
      issuer: 'https://{your auth0 account}.auth0.com'
    };

    return jwt.sign(api_user, 
      new Buffer(configuration.telco_crm_api_client_secret, 'base64'), options); 
  }

  // Supported scopes with the location of the sources.
  var base_webtask_url = 
      'https://raw.githubusercontent.com/sandrinodimattia/webtask-telco-sample/master/tasks/';
  var supported_scopes = {
    home_id: base_webtask_url + 'home_id.js',
    sms_id: base_webtask_url + 'sms_id.js'
  };

  // Did we request a profile scope?
  var requestScope = context.request.query.scope || 
      context.request.body.scope;
  var scopes = requestScope.split(' ');
  var required_scope = _.find(scopes, function(scope) {
    return supported_scopes[scope];
  });

  // Does the user need to complete the profile?
  if (required_scope && !user[required_scope]) {
    var url = supported_scopes[required_scope];
    var crmToken = createTokenForCRM();
    
    webTaskIssueToken(url, user, crmToken, function(err, response, body) {
      if (err) return callback(new Error(err));
      user.complete_profile_url = 
        "https://sandbox.it.auth0.com/api/run/telco-poc?key=" + body;
      return callback(null, user, context);
    });
  } else {
    return callback(null, user, context);
  }
}