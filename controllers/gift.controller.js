"use strict";

var _ = require("lodash"),
    mongoose = require('mongoose'),
    ObjectID = mongoose.Types.ObjectId,
    root = '../',
    pathMd = root + 'models/',
    Gift = require(pathMd + 'gift.model'),
    GiftOrderReceiver = require(pathMd + 'gift.order.receiver.model'),
    GiftOrder = require(pathMd + 'gift.order.model'),
    config = require(root + 'config/environment'),
    pathMw = root + 'middlewares/',
    wepay = require(pathMw + 'wepay.mw'),
    wechat = require(pathMw + 'wechat.mw'),
    wemsg = require(pathMw + 'wemsg.mw'),
    giftMw = require(pathMw + 'gift.mw'),
    moment = require('moment'),
    fs = require('fs'),
    path = require('path'),
    Q = require('q'),
    JSZip = require('jszip'),
    nodeExcel = require('excel-export'),
    log = require('../services/logging').getLogger('gift.controller');

exports.post = function*(next) {
    let body = this.request.body;
    let base = body.fields;
    if (!base.name) {
        this.status = 406;
        this.body = {
            errmsg: '未填写盒子名称！'
        };
        return;
    }
    let cover = "";
    if (body.files && body.files.cover) {
        let oldPath = body.files.cover.path;
        log.info('old path', oldPath);
        cover = '/' + require('moment')().format('YYYY-M') + '/' + 'gift-' + require('crypto').randomBytes(8).toString('hex') + '.jpg';
        let newPath = '/mnt/photo/photo' + cover;
        log.info('new path', newPath);
        require('mv')(oldPath, newPath, function(err) {
            if (err) throw err;
        });
    }
    let gift = new Gift();
    gift.pubno = this.pubno;
    gift.info.name = base.name;
    gift.info.poetry = base.poetry ? base.poetry : '';
    gift.info.lead = base.lead ? base.lead : '';
    gift.info.detail = base.detail ? base.detail : '';
    if (base.price > 0) gift.info.price = base.price;
    if (cover) gift.info.cover = cover;
    yield gift.save(function(err) {
        console.error(err);
    });
    this.body = {
        message: '发布礼物成功!',
        id: gift.id
    };
};
exports.update = function*(next) {
    if (this.gift.num.pay > 0) {
        this.status = 406;
        this.body = {
            errmsg: '已有订单生成不能修改！'
        };
        return;
    }
    let body = this.request.body;
    let base = body.fields;
    let cover = "";
    if (body.files && body.files.cover) {
        let oldPath = body.files.cover.path;
        cover = '/' + require('moment')().format('YYYY-M') + '/' + 'gift-' + require('crypto').randomBytes(8).toString('hex') + '.jpg';
        let newPath = '/mnt/photo/photo' + cover;
        require('mv')(oldPath, newPath, function(err) {
            if (err) throw err;
        });
    }
    var gift = this.gift;
    if (base.name) gift.info.name = base.name;
    if (base.poetry) gift.info.poetry = base.poetry;
    if (base.lead) gift.info.lead = base.lead;
    if (base.detail) gift.info.detail = base.detail;
    if (base.price > 0) gift.info.price = base.price;
    if (cover) gift.info.cover = cover;
    yield gift.save();
    this.body = {
        message: '修改礼物成功！'
    };
};
exports.condition = function*(next) {
    var condition = _.isUndefined(this.condition) ? {} : this.condition;
    condition.pubno = this.pubno.id;
    if (!_.isUndefined(this.query.online) && this.query.online !== '') {
        condition['status.online'] = this.query.online;
    }
    if (this.from === 'client') {
        condition['status.online'] = true;
    }
    this.condition = condition;
    yield next;
};
exports.count = function*(next) {
    this.count = yield Gift.count(this.condition).exec();
    yield next;
};
exports.count_show = function*(next) {
    this.body = this.count;
};
exports.list = function*(next) {
    var page = _.parseInt(this.query.page),
        limit = _.parseInt(this.query.limit);

    if (_.isNaN(page)) page = 1;
    if (_.isNaN(limit)) limit = 10;
    if (limit <= 0) limit = 10;
    if (limit > 200) limit = 200;
    if (page < 0) page = 1;
    if (page > 100) page = 100;
    var skip = limit * (page - 1);

    var gifts;
    if (this.from === 'client') {
        gifts = yield Gift.find(this.condition, 'id info.name info.cover info.price')
            .limit(limit)
            .skip(skip)
            .sort('-_id')
            .exec();
        this.body = [this.count, gifts];
    }
    if (this.from === 'merchant') {
        gifts = yield Gift.find(this.condition, 'id info time status.online num')
            .limit(limit)
            .skip(skip)
            .sort('-_id')
            .exec();
        this.body = gifts;
    }
    return;
};
exports.gift = function*(id, next) {
    if (!ObjectID.isValid(id)) {
        this.status = 406;
        this.body = {
            errmsg: '订单ID错误!'
        };
        return;
    }
    let fieldsPubno = '',
        fields = '';
    if (this.from === 'client') {
        fields += ' info pubno num.order num.receivers num.pay status.online';
        fieldsPubno += ' id authorizer_info.head_img authorizer_info.nick_name';
    }
    let gift = yield Gift.findById(id, fields)
        .populate('pubno', fieldsPubno)
        .exec();
    if (!gift) {
        this.status = 404;
        this.body = {
            errmsg: '查找订单失败'
        }
        return;
    }
    if (this.pubno.id !== gift.pubno.id) {
        this.status = 406;
        this.body = {
            errmsg: '无权查看该公众号订单'
        }
        return;
    }
    this.gift = gift;
    yield next;
}
exports.get = function*(next) {

    this.body = this.gift;
};
exports.offshelf = function*(next) {
    this.gift.status.online = false;
    this.gift.save();
    this.body = {
        message: '成功设置！'
    };
};
exports.order = function*(next) {
    if (this.gift.status.online === false) {
        this.status = 406;
        this.body = {
            errmsg: '礼物已经下架！'
        }
        return;
    }
    let pfx = "./data/cert_" + this.pubno.appid + ".p12";
    if (!fs.existsSync(pfx)) {
        this.status = 406;
        this.body = {
            errmsg: '商家暂未完成支付配置'
        };
        return;
    }
    let body = this.request.body;
    let giftorder = new GiftOrder();
    giftorder.pubno = this.pubno;
    giftorder.sender = this.user;
    giftorder.gift = this.gift;
    giftorder.receiver = {
        name: body.name,
        address: body.address,
        telephone: body.telephone,
        serverId: body.serverId
    };
    yield giftorder.save(function(err) {
        console.error(err);
    });
    this.giftorder = giftorder;
    yield next;
    let count_order = yield GiftOrder.count({
        gift: this.gift
    }).exec();
    this.gift.num.order = count_order;
    yield this.gift.save(function(err) {
        if (err) console.error('gift_order', err);
    });
    yield wechat.media_get(body.serverId, this.pubno, 'amr');
};
exports.preorder = function*(next) {
    let body = this.request.body;
    if (this.gift.status.online === false) {
        this.status = 406;
        this.body = {
            errmsg: '礼物已经下架！'
        }
        return;
    }
    let pfx = "./data/cert_" + this.pubno.appid + ".p12";
    if (!fs.existsSync(pfx)) {
        this.status = 406;
        this.body = {
            errmsg: '商家暂未完成支付配置'
        };
        return;
    }
    // check body in v1
    // if(!body.name || !body.serverId){
    //   this.status = 406;
    //   this.body = {errmsg : '请确认你要送的人,还有你的声音'};
    //   return;
    // }
    // check body in v1 end


    // check body for v2
    if (!body.capacity || !body.serverId) {
        this.status = 406;
        this.body = {
            errmsg: '请确认你要送几个人,还有你的声音'
        };
        return;
    }

    let giftorder = new GiftOrder();
    giftorder.serverId = body.serverId; // 存储声音卡片
    giftorder.pubno = this.pubno;
    giftorder.sender = this.user;
    giftorder.gift = this.gift;
    giftorder.capacity = body.capacity;


    // giftorder.receiver = {
    //     name: body.name || '',
    //     address: body.address ? body.address : '',
    //     telephone: body.telephone ? body.telephone : '',
    //     serverId: body.serverId
    // };

    giftorder.receivers = []; // #12 收货人
    // 单人送单人
    if (body.capacity == 1) {
        let receiver = new GiftOrderReceiver();
        receiver.name = body.name || '';
        receiver.address = body.address || '';
        receiver.telephone = body.telephone || '';
        receiver.serverId = body.serverId;
        receiver.fillinDate = new Date();
        receiver = yield receiver.save(function(err) {
            if (err) log.error(err);
        });
        giftorder.receivers.push(receiver._id);
    }

    yield giftorder.save(function(err) {
        if (err) console.error('礼物:保存订单错误', err);
    });


    this.giftorder = giftorder;

    let start = moment().startOf('day');
    let end = moment().endOf('day');
    let condition = {
        'time.add': {
            $gte: start,
            $lt: end
        }
    };
    let order = yield GiftOrder.findOne(condition).sort({
        serial: -1
    }).exec();
    let serial = moment().format('YYYYMMDD') * 10000;
    if (order && order.serial) {
        serial = order.serial;
    }
    if (!this.giftorder.serial) {
        this.giftorder.serial = serial + 1;
        yield this.giftorder.save(function(err) {
            if (err) console.error(err);
        });
    }

    log.info('preorder: ' + JSON.stringify(this.giftorder));

    yield next;

    let count_order = yield GiftOrder.count({
        gift: this.gift
    }).exec();
    // 多少人（次）通过该礼物送出祝福
    this.gift.num.order = count_order;
    // 礼物已经送出了多少份
    this.gift.num.receivers = this.gift.num.receivers + this.giftorder.capacity;
    yield this.gift.save(function(err) {
        if (err) console.error('礼物:统计数据保存错误', err);
    });
    yield wechat.media_get(body.serverId, this.pubno, 'amr');
};
exports.pay_sign = function*(next) {
    var order = this.giftorder;
    var gift = this.gift;
    let params = {
        attach: '微信支付礼物盒子',
        body: '支付礼物盒子[' + gift.info.name.substring(0, 10) + ']',
        detail: '礼物盒子:' + gift.info.name,
        notify_url: config.api.url + "/wechat/pay/notify/gift",
        openid: this.user.openid,
        out_trade_no: order.id,
        spbill_create_ip: this.request.ip,
        // set payment fee for multi receivers
        total_fee: gift.info.price * 100 * this.giftorder.capacity,
        trade_type: 'JSAPI'
    };
    let unifiedorder = yield wepay.unifiedorder(params, this.pubno.id);
    if (unifiedorder.errcode) {
        this.status = 406;
        this.body = unifiedorder;
        return;
    }
    var state = 'order.detail.one2one-address';
    if (order.capacity > 1) state = 'order.detail.one2many-address';
    let sign = yield wepay.sign(unifiedorder.prepay_id, order.id, this.pubno, state);
    this.body = sign;
    yield next;
};
exports.generate_serial = function*(next) {
    yield giftMw.generate_card(this.giftorder);
};
exports.check_out_trade_no = function*(next) {
    let data = this.notify_data;
    let out_trade_no = data.out_trade_no;
    if (!out_trade_no || !ObjectID.isValid(out_trade_no)) {
        this.log.info({
            out_trade_no: out_trade_no
        }, '微信支付通知：商户订单号错误');
        this.body = 'fail';
        return;
    }
    let giftorder = yield GiftOrder.findById(new ObjectID(out_trade_no))
        .populate('pubno')
        .populate('gift')
        .populate('sender')
        .populate('receivers')
        .exec();

    if (!giftorder) {
        this.log.error({
            out_trade_no: out_trade_no
        }, '微信支付通知：订单不存在');
        this.body = 'fail';
        return;
    }
    giftorder.logger = this.logger;

    yield giftorder.save(function(err) {
        if (err) console.error('保存支付订单错误', err);
    });

    if (giftorder.status.pay === true) {
        this.log.info({
            out_trade_no: out_trade_no
        }, '微信支付通知：订单已经支付过！');
        this.body = 'success';
        return;
    }

    this.giftorder = giftorder;
    yield next;
};
exports.pay = function*(next) {
    var data = this.notify_data;
    this.log.info({
        data: data
    }, '礼物微信支付异步通知：支付成功！');
    let giftorder = this.giftorder;
    giftorder.status.pay = true;
    giftorder.time.pay = moment(data.time_end, 'YYYYMMDDHHmmss');
    giftorder.wepay = {
        trade_no: data.transaction_id
    };
    yield giftorder.save(function(err) {
        if (err) console.error('gift_order_pay', err);
    });
    let msg = yield wemsg.gift(giftorder);
    let gift = giftorder.gift;
    // 减少查询次数，直接在原来基础上，加1
    // let count_pay = yield GiftOrder.count({
    //     gift: gift,
    //     'status.pay': true
    // }).exec();
    gift.num.pay = gift.num.pay + 1;
    gift.save(function(err) {
        if (err) console.error('gift_pay', err);
    });

    this.body = '<xml>' + '<return_code><![CDATA[SUCCESS]]></return_code>' + '<return_msg><![CDATA[OK]]></return_msg>' + '</xml>';
    let info = yield giftMw.generate_card_wx(giftorder);
};
exports.order_condition = function*(next) {
    var condition = _.isUndefined(this.condition) ? {} : this.condition;
    condition.pubno = this.pubno.id;
    if (this.query.gift) {
        condition.gift = this.query.gift;
    }
    if (!_.isUndefined(this.query.pay) && this.query.pay !== '') {
        condition['status.pay'] = this.query.pay;
    }
    // 一送多情况下，shipping都是针对子订单而言的
    // 这个导出语音码则针对的是订单，所以去掉过滤条件
    // https://github.com/arrking/songni/issues/182
    // if (!_.isUndefined(this.query.shipping) && this.query.shipping !== '') {
    //     condition['status.shipping'] = this.query.shipping;
    // }
    if (this.from === 'client') {
        condition['status.pay'] = true;
    }
    if (this.query.my) {
        if (!this.user) {
            this.status = 401;
            this.body = {
                errmsg: '请登录'
            };
            return;
        }
        condition.sender = this.user.id;
    }
    this.condition = condition;
    yield next;
};
exports.order_count = function*(next) {
    this.count = yield GiftOrder.count(this.condition).exec();
    yield next;
};
exports.order_count_show = function*(next) {
    this.body = this.count;
};
exports.order_list = function*(next) {
    var page = _.parseInt(this.query.page),
        limit = _.parseInt(this.query.limit);

    if (_.isNaN(page)) page = 1;
    if (_.isNaN(limit)) limit = 10;
    if (limit <= 0) limit = 10;
    if (limit > 200) limit = 200;
    if (page < 0) page = 1;
    if (page > 100) page = 100;
    var skip = limit * (page - 1);

    var giftorders;
    if (this.from === 'client') {
        var fields = 'time.add sender gift receivers capacity';
        var receiverFields = 'name'
        if (this.query.my) {
            receiverFields += ' express status';
        }

        giftorders = yield GiftOrder.find(this.condition, fields)
            .populate('sender', 'info.nickname info.headimgurl')
            .populate('gift', 'info.name info.cover info.price')
            .populate('receivers', receiverFields)
            .limit(limit)
            .skip(skip)
            .sort('-_id')
            .exec();
        this.body = [this.count, giftorders];
    }
    if (this.from === 'merchant') {
        giftorders = yield GiftOrder.find(this.condition, 'serial gift sender time.add status.pay capacity receivers')
            .populate('sender', 'info.nickname info.headimgurl')
            .populate('gift', 'info.name info.price')
            .populate('receivers', 'id fillinDate userOpenId consignee status express')
            .limit(limit)
            .skip(skip)
            .sort('-_id')
            .exec();
        this.body = giftorders;
    }
    log.debug('query giftorders', this.body);
    return;
};
exports.giftorder = function*(id, next) {
    if (!ObjectID.isValid(id)) {
        this.status = 406;
        this.body = {
            errmsg: '订单ID错误!'
        };
        return;
    }
    let fields = 'serial sender receiver.name receiver.consignee receiver.serverId time.add status.pay status.read status.shipping pubno gift receivers capacity';
    let fieldsGift = 'num info.name info.price info.cover';
    let fieldsSender = 'openid info.nickname info.headimgurl';
    let fieldsPubno = '';
    let fieldsReceiver = 'userOpenId name consignee telephone address status fillinDate headimgurl';
    if (this.from === 'client') {
        fields = 'sender receiver.name receiver.consignee receiver.serverId status.pay status.read status.shipping pubno gift time express receivers capacity';
        fieldsGift = 'num.pay info.name info.price info.cover';
        fieldsSender = 'openid info.nickname info.headimgurl';
        fieldsReceiver = 'userOpenId name consignee telephone address status fillinDate headimgurl';
    }
    let giftorder = yield GiftOrder.findById(id, fields)
        .populate('sender', fieldsSender)
        .populate('gift', fieldsGift)
        .populate('pubno', fieldsPubno)
        .populate('receivers', fieldsReceiver)
        .exec();
    if (!giftorder) {
        this.status = 404;
        this.body = {
            errmsg: '查找订单失败'
        }
        return;
    }
    if (this.pubno.id !== giftorder.pubno.id.toString()) {
        this.status = 406;
        this.body = {
            errmsg: '无权查看该公众号订单'
        }
        return;
    }
    this.giftorder = giftorder;
    yield next;
};

/**
 * Get receiver by id
 * @param {[type]}   id            [description]
 * @param {Function} next          [description]
 * @yield {[type]}   [description]
 */
exports.receiver = function*(id, next) {
    if (!ObjectID.isValid(id)) {
        this.status = 406;
        this.body = {
            errmsg: '收礼人ID错误!'
        };
        return;
    }

    let receiver = yield GiftOrderReceiver.findById(id).exec();
    log.debug('get receiver', JSON.stringify(receiver));
    if (!receiver) {
        this.status = 404;
        this.body = {
            errmsg: '查找收礼人失败'
        }
        return;
    }
    this.receiver = receiver;
    yield next;
}

exports.order_detail = function*(next) {
    let giftorder = this.giftorder;
    this.body = giftorder;
};
exports.get_order = function*(next) {
    let giftorder = this.giftorder;
    if (this.query.from && this.query.from === 'scan' && giftorder.status.read === false) {
        giftorder.status.read = true;
        giftorder.save();
        let msg = yield wemsg.gift_read(giftorder);
    }
    this.body = {
        order: this.giftorder,
        media: this.media
    };
};
exports.get_order_detail = function*(next) {
    let giftorder = this.giftorder;
    if (this.query.from && this.query.from === 'scan' && giftorder.status.read === false) {
        giftorder.status.read = true;
        giftorder.save();
        let msg = yield wemsg.gift_read(giftorder);
    }
    this.body = giftorder;
};
exports.qrcode = function*(next) {
    var url = 'http://' + this.pubno.appid + '.' + config.domain.client + '/order/' + this.giftorder.id + '/listen';
    var QRCode = require('qrcode');
    QRCode.toDataURL(url, function(err, src) {
        this.body = src;
    });
};
/**
 * 一键发货 
 * https://github.com/arrking/songni/issues/82
 * https://github.com/arrking/songni/issues/87
 * @param {Function} next          [description]
 * @yield {[type]}   [description]
 */
exports.shipping_all = function*(next) {

    var body = this.request.body;
    var order = this.giftorder;

    let gift = this.giftorder.gift;
    let promises = [];

    for (let i = 0; i < order.receivers.length; i++) {
        let deferred = Q.defer();

        let receiver = order.receivers[i];
        receiver.status.shipping = true;
        receiver.save(function(err) {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve();
                // incremental gift deliveries
                gift.num.delivery++;
                gift.save(function(err) {
                    if (err) console.error('gift_save_in_order_err', err);
                });
            }
        });

        promises.push(deferred);
    }
    var that = this;
    yield Q.allSettled(promises)
        .then(function(results) {
            if (_.some(results, function(val, index) {
                    return val.state !== "fulfilled"
                })) {
                // some promise is rejected.
                that.status = 406;
                that.body = {
                    message: '设置失败！'
                };
                log.error('shipping_all get rejected result', results);
            } else {
                log.debug('shipping_all success!')
                that.body = {
                    message: '成功设置！'
                };
            }
        });
};

/**
 * 单个发货
 * https://github.com/arrking/songni/issues/82
 * https://github.com/arrking/songni/issues/87
 * @param {Function} next          [description]
 * @yield {[type]}   [description]
 */
exports.shipping_one = function*(next) {
    var body = this.request.body;
    var order = this.giftorder;
    var receiver = this.receiver;
    let express = body.express;

    if (express) {
        receiver.express = express;
    }
    receiver.status.shipping = true;
    receiver.status.shipping_date = new Date();
    receiver.save(function(err) {
        if (err) console.error('giftorder_receiver_save_err', err);
    });
    this.body = {
        message: '成功设置！'
    };
    // 增加礼物的售出件数
    let gift = this.giftorder.gift;
    gift.num.delivery++;
    gift.save(function(err) {
        if (err) console.error('gift_save_in_order_err', err);
    });

    // 向送礼人和收礼人通知订单消息！
    if (express && express.company && express.company.name && express.no) {
        yield wemsg.gift_express_sender(order, express, receiver);
        // 停止向收礼人通知发货信息，保持礼物的神秘性
        // if (receiver.userOpenId) {
        //     yield wemsg.gift_express_receiver(order, express, receiver);
        // }
    }
};
exports.upload = function*(next) {
    let dir = '/mnt/photo/media/' + require('moment')(this.giftorder.time.add).format('YYYY-M') + '/';
    let file = dir + this.giftorder.serverId + '.amr';
    let data = yield wechat.media_upload(file, this.pubno, 'voice');
    if (data.errcode) {
        this.status = 406;
        this.body = data;
        return
    }
    this.media = data;
    yield next;
};
exports.get_order_media = function*(next) {
    this.body = this.media;
    yield next;
};
exports.reader = function*(next) {
    this.giftorder.reader = this.user;
    this.giftorder.status.pushed = false;
    this.giftorder.save(function(err) {
        if (err) console.error('giftorder.reader_error', err);
    });
};
exports.media = function*(next) {
    let body = this.request.body;
};
exports.export_order = function*(next) {
    var page = _.parseInt(this.query.page),
        limit = _.parseInt(this.query.limit);

    if (_.isNaN(page)) page = 1;
    if (_.isNaN(limit)) limit = 10;
    if (limit <= 0) limit = 10;
    if (limit > 200) limit = 200;
    if (page < 0) page = 1;
    if (page > 100) page = 100;
    var skip = limit * (page - 1);

    let giftorders = yield GiftOrder.find(this.condition, 'serial gift sender capacity receivers')
        .populate('sender', 'info.nickname')
        .populate('gift', 'info.name info.price time.add')
        .populate('receivers', 'name consignee telephone address fillinDate status express')
        .limit(limit)
        .skip(skip)
        .sort('-_id')
        .exec();


    var conf = {};
    conf.stylesXmlFile = "styles.xml";
    conf.cols = [{
        caption: '序列号',
        type: 'string',
        width: 15
    }, {
        caption: '礼品名称',
        type: 'string',
        width: 20

    }, {
        caption: '送礼人姓名',
        type: 'string',
        width: 15
    }, {
        caption: '收礼人姓名',
        type: 'string',
        width: 15
    }, {
        caption: '收礼人地址',
        type: 'string',
        width: 20
    }, {
        caption: '收礼人手机号',
        type: 'string',
        width: 15
    }, {
        caption: '下单时间',
        type: 'date',
        width: 15,
        beforeCellWrite: function() {
            var originDate = new Date(Date.UTC(1899, 11, 30));
            return function(row, cellData, eOpt) {
                if (cellData === null) {
                    eOpt.cellType = 'string';
                    return 'N/A';
                } else
                    return (cellData - originDate) / (24 * 60 * 60 * 1000);
            }
        }()
    }, {
        caption: '领取时间',
        type: 'date',
        width: 15,
        beforeCellWrite: function() {
            var originDate = new Date(Date.UTC(1899, 11, 30));
            return function(row, cellData, eOpt) {
                if (cellData === null) {
                    eOpt.cellType = 'string';
                    return 'N/A';
                } else
                    return (cellData - originDate) / (24 * 60 * 60 * 1000);
            }
        }()
    }, {
        caption: '物流公司',
        type: 'string',
        width: 15
    }, {
        caption: '物流单号',
        type: 'string',
        width: 15
    }];
    var rows = [];
    giftorders.forEach(function(order) {
        if (!(order.receivers && order.receivers.length)) return;
        order.receivers.forEach(function(receiver) {
            if (receiver.status.shipping) return;
            if (!receiver.consignee) return;
            if (!receiver.telephone) return;
            rows.push([
                order.serial,
                order.gift.info.name,
                order.sender.info.nickname,
                receiver.consignee,
                receiver.address,
                receiver.telephone,
                order.gift.time.add,
                receiver.fillinDate,
                '', ''
            ]);
        });
    });
    conf.rows = rows;
    var result = nodeExcel.execute(conf);
    result = new Buffer(result, 'binary');
    this.type = 'xlsx';
    this.attachment('Orders.xlsx');
    this.body = result;
    return;
};
exports.export_card = function*(next) {
    var page = _.parseInt(this.query.page),
        limit = _.parseInt(this.query.limit),
        ext = this.query.ext;

    if (_.isNaN(page)) page = 1;
    if (_.isNaN(limit)) limit = 10;
    if (limit <= 0) limit = 10;
    if (limit > 200) limit = 200;
    if (page < 0) page = 1;
    if (page > 100) page = 100;
    let skip = limit * (page - 1);

    let giftorders = yield GiftOrder.find(this.condition, 'serial receiver sender time.add status.pay status.shipping')
        .populate('sender', 'info.nickname info.headimgurl')
        .limit(limit)
        .skip(skip)
        .sort('-_id')
        .exec();
    var zip = new JSZip();

    for (let i in giftorders) {
        let order = giftorders[i];
        let dir = '/mnt/photo/images/gift/qrcode/' + moment(order.time.add).format('YYYY-M') + '/';
        let file = dir + order.serial + '.png';
        if (ext) {
            file = dir + order.serial + '_' + ext + '.png';
        }
        if (fs.existsSync(file)) {
            log.debug('export_card', file);
            zip.file(order.serial + '.png', fs.readFileSync(file), {
                binary: true
            });
        }
    }
    var buffer = zip.generate({
        type: "nodebuffer"
    });
    this.body = buffer;
};
exports.out_card = function*(next) {
    let ext = this.query.ext;
    let order = this.giftorder;
    let dir = '/mnt/photo/images/gift/qrcode/' + moment(order.time.add).format('YYYY-M') + '/';
    let file = dir + order.serial + '.png';
    if (ext) {
        file = dir + order.serial + '_' + ext + '.png';
    }
    let extname = path.extname;

    if (fs.existsSync(file)) {
        this.type = extname(file);
        this.body = fs.createReadStream(file);
    } else {
        this.status = 406;
        this.body = {
            errmsg: '暂未生成卡片，请稍候再试！'
        };
        yield giftMw.generate_card(this.giftorder);
        if (ext) {
            yield giftMw.generate_card_wx(this.giftorder);
        }
    }
};
exports.wx_qrcode = function*(next) {
    let qrcode = yield wechat.qrcode_permanent_str(this.giftorder.id, this.pubno);
    if (qrcode.errmsg) {
        this.status = 406;
        this.body = qrcode;
        return;
    }
    this.body = qrcode.response.ticket;
};
exports.save_address = function*(next) {
    var body = this.request.body;
    var giftorder = this.giftorder;

    // 送单人
    if (giftorder.capacity == 1) {
        if (giftorder.receivers[0].consignee) {
            this.status = 406;
            this.body = {
                errmsg: '收货地址已经填写'
            };
            return;
        }
        if (!body.consignee || !body.address || !body.telephone) {
            this.status = 406;
            this.body = {
                errmsg: '收货信息填写不全'
            };
            return;
        }

        let receiver = yield GiftOrderReceiver.findById(giftorder.receivers[0]._id).exec();
        receiver.consignee = body.consignee ? body.consignee : giftorder.receivers[0].name;
        receiver.address = body.address;
        receiver.telephone = body.telephone;
        receiver.fillinDate = new Date();
        if (this.user._id !== giftorder.sender._id) {
            receiver.userOpenId = this.user.openid;
            receiver.headimgurl = this.user.info.headimgurl;
        }

        yield receiver.save(function(err) {
            if (err) log.error('礼物:保存地址错误, p1', err);
        });

        giftorder.agenter = this.user;
        yield giftorder.save(function(err) {
            if (err) log.error('礼物:保存地址错误, p2', err);
        });

        // https://github.com/arrking/songni/issues/151
        // 通知送礼人，收礼人的信息
        if (this.user._id !== giftorder.sender._id) {
            yield wemsg.gift_express_fillin(giftorder, receiver);
        }

        this.body = {
            rc: 4,
            message: '保存地址成功!'
        };
    } else {
        // first check if the receiver info is saved.
        if (_.some(giftorder.receivers, (val, index) => {
                return val.userOpenId == this.user.openid ? true : false;
            })) {
            this.body = {
                rc: 1,
                message: '该收礼人已经被保存，放弃修改。'
            }
        } else if (giftorder.receivers.length >= giftorder.capacity) {
            this.body = {
                rc: 2,
                message: '抢晚了，全部礼品已经有主。'
            }
        } else {
            // 可以保存！
            if (!body.consignee || !body.address || !body.telephone) {
                this.status = 406;
                this.body = {
                    rc: 3,
                    errmsg: '收货信息填写不全'
                };
                return;
            }


            let receiver = new GiftOrderReceiver();
            // yield GiftOrderReceiver.findById(giftorder.receivers[0]._id).exec();
            receiver.consignee = body.consignee ? body.consignee : giftorder.receivers[0].name;
            receiver.address = body.address;
            receiver.telephone = body.telephone;
            receiver.fillinDate = new Date();
            if (this.user._id !== giftorder.sender._id) {
                receiver.userOpenId = this.user.openid;
                receiver.headimgurl = this.user.info.headimgurl;
            }

            receiver = yield receiver.save(function(err) {
                if (err) log.error('礼物:保存地址错误, p1', err);
            });

            giftorder.agenter = this.user;
            // maybe can not save ?
            giftorder.receivers.push(receiver._id);
            yield giftorder.save(function(err) {
                if (err) log.error('礼物:保存地址错误, p2', err);
            });

            // https://github.com/arrking/songni/issues/151
            // 通知送礼人，收礼人的信息
            if (this.user._id !== giftorder.sender._id) {
                yield wemsg.gift_express_fillin(giftorder, receiver);
            }
            this.body = {
                rc: 4,
                message: '保存地址成功!'
            };
        }
    }
};
