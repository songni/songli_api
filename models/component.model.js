'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var ComponentSchema = new Schema({
  name:{
    type:String,
    required: '名称为空！'
  },
  appid:{
    type:String,
    required: 'appid为空！'
  },
  secret:{
    type:String,
    required: 'secret为空！'
  },
  token:{//标示
    type:String,
    required: '公众号消息校验Token为空！'
  },
  encodingAESKey:{
    type:String,
    required: '请输公众号消息加解密Key为空！'
  },
  redirect_uri:{
    type:String,
    default:'wx.91pintuan.com',
    required: '请输公众号回调地址为空！'
  },
  redirect_uri_client:{
    type:String,
    default:'wx.91pintuan.com',
    //required: '请输公众号客户端回调地址为空！'
  },
  time: {
    create:{
      type: Date,
      default: Date.now(),
    },
    modify:{
      type: Date,
    }
  },
  status: {
    status:{
      type: Number,
      default:1//0删除１未删除
    }
  }
});

ComponentSchema.set('toJSON', {
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


module.exports = mongoose.model('Component', ComponentSchema);
