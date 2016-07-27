'use strict';

var mongoose = require('mongoose')
  , Schema = mongoose.Schema
  ;

var WechatIpSchema = new Schema({
  ip_list: [] ,
  time: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('WechatIp', WechatIpSchema);
