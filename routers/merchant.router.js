'use strict';

var merchant = require('../controllers/merchant.controller');
var token = require('../controllers/token.controller');
  
module.exports = function(Router){
  var router = new Router();
  router.get('/', merchant.get);
  router.post('/', merchant.post);
  router.put('/:id', merchant.edit);
  router.post('/upload', merchant.upload);
  return router;
};
