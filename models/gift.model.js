'use strict';

var mongoose = require('mongoose')
  , Schema   = mongoose.Schema
  ;
  
var GiftSchema = new Schema({
  info: {
    name: {
      type: String,
      require: '名称不能为空！'
    },
    price: {
      type: Number,
      default: 0
    },
    cover: {
      type: String,
      require: '封面不能为空！'
    },
    poetry:{
      type: String,
      require: '诗词不能为空！'
    },
    lead:{
      type: String,
      require: '导语不能为空！'
    },
    detail:String,
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
    end: Date
  },
  num: {
    // 订单数
    order:{
      type:Number,
      default:0
    },
    // 子订单数
    receivers:{
      type:Number,
      default:0
    },
    pay:{
      type:Number,
      default:0
    },
    delivery:{
      type:Number,
      default:0
    }
  },
  status: {
    online: {
      type: Boolean,
      default: true
    }
  }
});
GiftSchema.set('toJSON', {
  getters: true,
  virtuals: true,
  transform: function(doc, ret, options) {
    if (options.hide) {
      options.hide.split(' ').forEach(function (prop) {
        delete ret[prop];
      });
    }
    delete ret['_id'],delete ret['__v'];
  }
});
module.exports = mongoose.model('Gift', GiftSchema);
