'use strict';

var root = '../',
    pathCtrl = root + 'controllers/',
    gift = require(pathCtrl + 'gift.controller'),
    wechat = require(pathCtrl + 'wechat.controller');

module.exports = function(Router) {
    var router = new Router();
    router.use('/', wechat.check_verify);
    router.post('/', gift.post);
    router.get('/', gift.condition, gift.list);
    router.get('/count', gift.condition, gift.count, gift.count_show);
    //订单列表
    router.get('/order', gift.order_condition, gift.order_list);
    //礼物
    router.param('id', gift.gift);
    router.put('/:id', gift.update);
    router.put('/:id/offshelf', gift.offshelf);
    router.get('/:id', gift.get);
    //订单
    router.get('/order/count', gift.order_condition, gift.order_count, gift.order_count_show);
    router.get('/order/export/orders', gift.order_condition, gift.export_order);
    router.get('/order/export/cards', gift.order_condition, gift.export_card);
    router.param('orderId', gift.giftorder);
    router.param('receiverId', gift.receiver);
    router.get('/order/:orderId', gift.order_detail);
    /**
     * refactor APIs for v2
     * https://github.com/arrking/songni/issues/82
     * https://github.com/arrking/songni/issues/87
     */
    router.put('/order/:orderId', gift.shipping_all); // 一键发货
    router.put('/order/:orderId/:receiverId', gift.shipping_one); // 一键发货

    router.get('/qrcode/:orderId', gift.qrcode);
    router.get('/order/export/card/:orderId', gift.out_card);
    router.get('/wx_qrcode/:orderId', gift.wx_qrcode);
    return router;
};
