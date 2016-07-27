'use strict';

var root = '../'
  , pathCtrl = root+'controllers/'
  , wxCpCtrl = require(pathCtrl+'wechat.component.controller')
  , tokenCtrl = require(pathCtrl+'token.controller')
  , wxCtrl = require(pathCtrl+'wechat.controller')
  , wpCtrl = require(pathCtrl+'wepay.controller')
  ;

module.exports = function(Router){
  var router = new Router();
  router.get('/client',wxCtrl.login_page);
  router.get('/token'
    , wxCpCtrl.access_token
    , wxCtrl.access_token
    , tokenCtrl.user
  );
  router.get('/experience'
    , tokenCtrl.experience
    , tokenCtrl.user
  );
  router.get('/userinfo'
    , wxCpCtrl.access_token
    , wxCtrl.get_userinfo
  );  
  router.get('/sign/address'
    , wxCpCtrl.access_token
    , wxCtrl.access_token
    , wxCtrl.sign_address
  );
  router.get('/sign/jssdk'
    , wxCtrl.option
    , wxCtrl.ticket
    , wxCtrl.sign_jssdk
  );
  return router;
};
