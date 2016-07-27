'use strict';

var root = '../'
  , pathCtrl = root+'controllers/'
  , user = require(pathCtrl+'user.controller')
  ;
  
module.exports = function(Router){
  var router = new Router();
  router.param('id', user.get);
  return router;
};
