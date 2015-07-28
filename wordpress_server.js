if (typeof Wordpress === 'undefined') {
  Wordpress = {};
}


Oauth.registerService('wordpress', 2, null, function(query) {

  var response = getTokenResponse(query);
  var identity = getIdentity(response.access_token);

  if (identity.ID) {
    identity.id = identity.ID;
    identity =_.omit(identity, 'ID');
  }

  var serviceData = _.extend(identity, {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    expiresAt: (+new Date) + (1000 * response.expires_in)
  });

  return {
    serviceData: serviceData
    // DFL TODO: Filter serviceData (whitelist) & move into options?
    //, options: {
    //  profile: { name: identity.display_name },
    //  services: { wordpress: identity }
    //}
  };
});


// Example response:
//
//  { access_token: '95d2a32b4cd184cde4faa3c1z0d502e7a5204cd6',
//    expires_in: 3600,
//    token_type: 'Bearer',
//    scope: 'basic',
//    refresh_token: '90921134bad1965018f8ea9ce896z64e13068381' }
//

var getTokenResponse = function (query) {
  var config = ServiceConfiguration.configurations.findOne({service: 'wordpress'});

  if (!config)
    throw new ServiceConfiguration.ConfigError();

  var response;
  try {
    var options = _.extend(Wordpress.httpOptions(), {
      params: {
        code: query.code,
        client_id: config.clientId,
        redirect_uri: OAuth._redirectUri('wordpress', config),
        client_secret: OAuth.openSecret(config.secret),
        grant_type: 'authorization_code'
      }});
    response = HTTP.post( Wordpress.authServer() + '/oauth/token/', options);

    if (response.error) // if the http response was an error
      throw response.error;
    if (typeof response.content === 'string')
      response.content = JSON.parse(response.content);
    if (response.content.error)
      throw response.content;
  } catch (err) {
    throw _.extend(new Error("Failed to complete OAuth handshake with Wordpress. " + err.message),
      {response: err.response});
  }
  return response.content;
};


// Example response:
//
//  { ID: '1',
//    user_login: 'user',
//    user_nicename: 'user',
//    user_email: 'you@example.com',
//    user_registered: '2015-01-01 01:00:00',
//    user_status: '0',
//    display_name: 'user',
//    email: 'you@example.com' }
//

var getIdentity = function (accessToken) {
  try {
    var options =  _.extend(Wordpress.httpOptions(),{ params: {access_token: accessToken} });
    return HTTP.get(Wordpress.authServer() + '/oauth/me/', options).data;
  } catch (err) {
    throw _.extend(new Error("Failed to fetch identity from remote service. " + err.message),
      {response: err.response});
  }
};


Wordpress.retrieveCredential = function(credentialToken, credentialSecret) {
  return Oauth.retrieveCredential(credentialToken, credentialSecret);
};


Wordpress.httpOptions = function () {
  if (Meteor.settings.wp_oauth_accept_invalid_certs) {
    return { npmRequestOptions : { rejectUnauthorized: false } };
  }
  return {};
}