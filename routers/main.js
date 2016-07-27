'use strict';

module.exports = function(Router){
  var router = new Router();
  router.get('/', function *() {
    yield this.body = {code:1000,message:'91拼团'};
  });
  return router;
};
