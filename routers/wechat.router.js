'use strict';

var root = '../'
  , pathCtrl  = root+'controllers/'
  , wxCpCtrl  = require(pathCtrl+'wechat.component.controller')
  , tokenCtrl = require(pathCtrl+'token.controller')
  , wxCtrl = require(pathCtrl+'wechat.controller')
  , wbCtrl = require(pathCtrl+'webot.controller')
  , wpCtrl = require(pathCtrl+'wepay.controller')
  , giftCtrl = require(pathCtrl+'gift.controller')
  , config   = require(root+'config/environment')
  ;

module.exports = function(Router){
  var router = new Router();
  router.get('/component',
    function*(next){
      console.warn('fdsioajfojeoiwjfoiewajfoiewjafoiejwaoifejwaoi')
      yield next;
    }
    , wxCpCtrl.access_token
    , wxCpCtrl.pre_auth_code
    , wxCpCtrl.login_page
  );
  router.post('/component/callback'
    , wxCpCtrl.callback
    , wxCpCtrl.component_verify_ticket
    , wxCpCtrl.unauthorized
  );
  router.post('/component/token', wxCpCtrl.component_verify_ticket);
  router.get('/component/auth'
    , wxCpCtrl.api_query_auth
    , tokenCtrl.component
  );
  router.get('/experience'
    , tokenCtrl.experience
    , tokenCtrl.component
  );
  router.get('/component/auth/info'
    , wxCpCtrl.access_token
    , wxCpCtrl.api_get_authorizer_info
  );
  router.get('/component/auth/option'
    , wxCpCtrl.access_token
    , wxCpCtrl.api_get_authorizer_option
  );
  router.post('/component/auth/option'
    , wxCpCtrl.access_token
    , wxCpCtrl.api_set_authorizer_option
  );
  router.get('/menu', wxCtrl.get_menu);
  router.patch('/menu', wxCtrl.create_menu);
  router.put('/menu', wxCtrl.set_menu);
  router.get('/shorturl'
    , wxCpCtrl.access_token
    , wxCpCtrl.api_authorizer_token
    , wxCtrl.option
    , wxCtrl.shorturl
  );

  router.post('/callback', wbCtrl.deal, wbCtrl.message);
  router.post('/pay/notify/gift'
    , wxCpCtrl.set_component_gift
    , wxCtrl.notify
    , giftCtrl.check_out_trade_no
    , wpCtrl.config
    , wpCtrl.notify_check_sign
    , wpCtrl.notify_check_data
    , giftCtrl.pay
  );
  router.get('/short/url', wxCtrl.short_url);
  router.get('/pay'　, wxCtrl.get_pay);
  router.post('/pay'　, wxCtrl.post_pay);
  router.get('/qrcode',wxCtrl.qrcode);
  router.get('/reply', wxCtrl.get_reply);
  router.put('/reply/:id', wxCtrl.update_reply);
  return router;
};
