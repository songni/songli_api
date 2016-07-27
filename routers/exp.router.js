'use strict';

var root = '../'
  , pathCtrl = root+'controllers/'
  , express = require(pathCtrl+'exp.controller')
  ;
  
module.exports = function(Router){
  var router = new Router();
  router.get('/company', express.company);
  return router;
};
