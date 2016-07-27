'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

//微信预支付交易会话标识
var WechatPrepaySchema = new Schema({
  partaker: {
    type : Schema.ObjectId,
    ref  : 'Partaker',
    required: '订单号为空！'
  },
  prepay_id: {
    type:String,
    required:'预支付交易会话标识为空！'
  },
  expires: { 
    type: Date,
    default: Date.now,
    expires: 60*60*2 //默认两小时过期
  }
});

WechatPrepaySchema.index({partaker:1}, {unique: true});

WechatPrepaySchema.set('toJSON', {
  getters: true,
  virtuals: true,
  transform: function(doc, ret, options) {
    options.hide = options.hide || '_id __v';
    if (options.hide) {
      options.hide.split(' ').forEach(function (prop) {
        delete ret[prop];
      });
    }
  }
});

module.exports = mongoose.model('WechatPrepay', WechatPrepaySchema);
