'use strict';

var root = '../'
  , pathCtrl = root+'controllers/'
  , gift = require(pathCtrl+'gift.controller')
  ;
  
module.exports = function(Router){
  var router = new Router();
  //列表
  router.get('/',
    gift.condition, 
    gift.count,
    gift.list
  );
  //礼物
  router.param('id',gift.gift);
  //更新
  router.put('/:id',gift.update);
  //获取礼物
  router.get('/:id', gift.get);
  //预定1
  router.post('/:id', 
    gift.order, 
    gift.pay_sign,
    gift.generate_serial
  );
  //预定2
  router.post('/:id/preorder',
    gift.preorder, 
    gift.pay_sign,
    gift.generate_serial
  );
  //获取订单
  router.param('orderId',gift.giftorder);
  router.get('/order/:orderId', gift.upload, gift.get_order);
  router.get('/order/:orderId/detail', gift.get_order_detail);
  router.get('/order/:orderId/media',
    gift.upload,
    gift.get_order_media,
    gift.reader
  );
  //保存地址
  router.post('/order/:orderId/address', gift.save_address);
  //订单列表
  router.get('/order/list/s', 
    gift.order_condition,
    gift.order_count,
    gift.order_list
  );
  return router;
};
