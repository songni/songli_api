'user strict';

//访问令牌
var mongoose = require('mongoose')
  , Schema = mongoose.Schema
  ;
  
var TokenSchema = new Schema({
  pubno: { //公众号
    type: Schema.ObjectId,
    ref: 'WechatComponentPublic'
  },
  component: { //第三方
    type: Schema.ObjectId,
    ref: 'Component'
  },
  user: { //微信用户
    type: Schema.ObjectId,
    ref: 'User'
  },
  expires: { 
    type: Date,
    default: Date.now,
    expires: 60*60*24*30
  }
});

module.exports = mongoose.model('Token', TokenSchema);
