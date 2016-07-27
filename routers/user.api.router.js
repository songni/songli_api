'use strict';

var root = '../'
  , pathCtrl = root+'controllers/'
  , user = require(pathCtrl+'user.controller')
  ;
  
module.exports = function(Router){
  var router = new Router();
  router.post('/sign/out', user.sign_out);
  return router;
};
