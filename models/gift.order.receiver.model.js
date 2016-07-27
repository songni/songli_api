'use strict';
/**
 * the gift receivers
 * referenced in gift.order.model
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    moment = require('moment');

var GiftOrderReceiverSchema = new Schema({
    userOpenId: String, // 用户的Wechat OpenId，存储在users collection中
    name: String, //接受者名字
    consignee: String, //收货人
    telephone: String, //收货人电话
    address: String, //收货人地址
    serverId: String, //临时可用,由于微信只能村三天,先测试用
    fillinDate: Date, // 收礼人填写地址，姓名，手机号的时间
    headimgurl: String, // 收礼人的头像，从微信API获得
    status: {
        shipping: { //发货
            type: Boolean,
            default: false
        },
        shipping_date: {
            type: Date, // 发货时间
            required: false
        },
        read: { //是否查看
            type: Boolean,
            default: false
        },
        read_date: {
            type: Date, // 发货时间
            required: false
        },
        pushed: { //是否推送
            type: Boolean,
            default: false
        }
    },
    express: {
        no: String, //快递单号
        company: { //快递公司
            id: String,
            name: String
        }
    }
});

GiftOrderReceiverSchema.path('express.no').validate(function(express) {
    return express.length <= 100;
}, '快递单号最长100.');
GiftOrderReceiverSchema.set('toJSON', {
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

module.exports = mongoose.model('GiftOrderReceiver', GiftOrderReceiverSchema);
