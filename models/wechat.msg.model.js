'user strict';

var mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , Mixed = Schema.Types.Mixed
  ;
  
var WechatMsgSchema = new Schema({
  pubno: { //公众号
    type: Schema.ObjectId,
    ref: 'WechatComponentPublic'
  },
  content: Mixed,
  expires: { 
    type: Date,
    default: Date.now,
    expires: 60*60*24*365
  }
});

module.exports = mongoose.model('WechatMsg', WechatMsgSchema);