'use strict';

// 音频文件
var mongoose = require('mongoose')
, Schema = mongoose.Schema
;
   
var VoiceSchema = new Schema({
  info: {
    file_path: String,
    file_name: String,
    file_type: String,
    file_length: String
  },
  mediaId: {
    type: String,
    require: '音频Id不能为空!'
  },
  time: {
    add: {
      type:Date,
      default:Date.now
    }
  }
});

module.exports = mongoose.model('Voice', VoiceSchema);
