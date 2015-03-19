function (user, context, callback) {

  if (context.clientName !== 'Telco Mobile')
    return callback(null, user, context);

  // Supported scopes with the location of the sources.
  var supported_scopes = {
    home_id: function (ectx) {
      ectx.webtask_url = configuration.webtaks_code_base_url + 'home_id.js';
      ectx.crm_api_token = createTokenForCRM();
    },
    mobile_id: function (ectx) {
      ectx.webtask_url = configuration.webtaks_code_base_url + 'mobile_id.js';
      ectx.twilio_auth_token = configuration.twilio_auth_token;
      ectx.twilio_account_sid = configuration.twilio_account_sid;
      ectx.twilio_number = configuration.twilio_number;
    }
  };

  // Did we request a profile scope?
  // Does the user need to complete the profile?
  var profileScopeName = getProfileScope();
  if (profileScopeName && !user[profileScopeName]) {
    
    // Generate a web task token.
    var scopeConfig = supported_scopes[profileScopeName];
    issueWebTaskToken(scopeConfig, user, function(err, response, wt_token) {
      if (err) 
        return callback(new Error(err));
      
      // Store WebTask Url in JWT.
      user.complete_profile_url = 
        configuration.webtask_run_base_url + wt_token;
      
      return callback(null, user, context);
    });
    
  } else {
    return callback(null, user, context);
  }





  /*
   * Boilerplate Code
   */


  // Helper to find one of the configured scopes (home_id, mobile_id, ...)
  function getProfileScope() {
    var requestScope = context.request.query.scope || 
        context.request.body.scope;
    var scopes = requestScope.split(' ');
    var required_scope = _.find(scopes, function(scope) {
      return supported_scopes[scope];
    });
    return required_scope;
  }

  // Helper to generate a webtask token.
  function issueWebTaskToken(ectxCb, current_user, cb) {
    var ectx = {
      auth0_api_token: configuration.auth0_api_token
    };
    ectxCb(ectx);


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
        ectx: ectx
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
      issuer: 'https://sandrino-dv.auth0.com'
    };

    return jwt.sign(api_user, 
       new Buffer(configuration.telco_crm_api_client_secret, 'base64'), options); 
  }
}
