'use strict';

var mongoose = require('mongoose')
  , Schema = mongoose.Schema
  ;

var WechatTempSchema = new Schema({
  template_id: String ,
  template_id_short:String,
  pubno:{
    type: Schema.ObjectId,
    ref: 'WechatComponentPublic',  
  },
  time: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('WechatTemp', WechatTempSchema);
