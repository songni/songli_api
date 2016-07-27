'use strict';

var root = '../'
  , pathCtrl = root+'controllers/'
  , mchntCtrl = require(pathCtrl+'merchant.controller')
  ;
  
module.exports = function(Router){
  var router = new Router();
  router.get('/', mchntCtrl.get);
  return router;
};
