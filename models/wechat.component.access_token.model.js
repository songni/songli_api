'user strict';

//第三方访问令牌
var mongoose = require('mongoose')
  , Schema = mongoose.Schema
  ;
  
var WechatComponentAccessTokenSchema = new Schema({
  appid: String,
  token: String,
  expires_in:Number,
  expires: { 
    type: Date,
    default: Date.now,
    expires: 7000
  }
});

WechatComponentAccessTokenSchema.index({appid:1}, {unique: true});

module.exports = mongoose.model('WechatComponentAccessToken', WechatComponentAccessTokenSchema);
