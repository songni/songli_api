'use strict';

var root = '../'
  , pathCtrl = root+'controllers/'
  , album = require(pathCtrl+'album.controller')
  ;

module.exports = function(Router){
  var router = new Router();
  router.post('/up', album.upload);
  return router;
};
