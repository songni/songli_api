'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    moment = require('moment');

var GiftOrderSchema = new Schema({
    serial: { //序列号
        type: Number,
        //default:moment().format('YYYYMMDD')*10000
    },
    sender: {
        type: Schema.ObjectId,
        ref: 'User',
        required: '发送者必须填写！'
    },
    agenter: { //地址代理人,可能自己,对方,或者无
        type: Schema.ObjectId,
        ref: 'User'
    },
    capacity: { // 订单的容量
        type: Number,
        default: 1
    },
    receivers: [{
        type: Schema.ObjectId,
        ref: 'GiftOrderReceiver'
    }],
    serverId: { // 声音卡片
        type: String,
        required: '必须有声音卡片！'
    },
    receiver: {
        name: String, //接受者名字
        consignee: String, //收货人
        telephone: String, //收货人电话
        address: String, //收货人地址
        serverId: String, //临时可用,由于微信只能村三天,先测试用
    },
    reader: { // 阅读者
        type: Schema.ObjectId,
        ref: 'User'
    },
    voice: {
        type: Schema.ObjectId,
        ref: 'Voice',
        //required: '声音必须填写！'
    },
    gift: { //礼物盒子
        type: Schema.ObjectId,
        ref: 'Gift',
        required: '礼物盒子必须填写！'
    },
    pubno: { //公号
        type: Schema.ObjectId,
        ref: 'WechatComponentPublic',
        required: '公号必须填写！'
    },
    time: {
        add: {
            type: Date,
            default: Date.now
        },
        pay: Date
    },
    status: {
        pay: { //支付
            type: Boolean,
            default: false
        }
    },
    logger: { //交易通知日志
        type: Schema.ObjectId,
        ref: 'Logger',
    },
    wepay: { //微支付
        trade_no: String
    },
    express: {
        no: String, //快递单号
        company: { //快递公司
            id: String,
            name: String
        }
    }
});
GiftOrderSchema.path('serial').index({
    unique: true,
    sparse: true
});
GiftOrderSchema.path('express.no').validate(function(express) {
    return express.length <= 100;
}, '快递单号最长100.');
GiftOrderSchema.set('toJSON', {
    getters: true,
    virtuals: true,
    transform: function(doc, ret, options) {
        if (options.hide) {
            options.hide.split(' ').forEach(function(prop) {
                delete ret[prop];
            });
        }
        delete ret['_id'], delete ret['__v'];
    }
});
module.exports = mongoose.model('GiftOrder', GiftOrderSchema);
