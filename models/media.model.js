'use strict';

var mongoose = require('mongoose')
  , Schema   = mongoose.Schema
  ;
  
var MediaSchema = new Schema({
  media_id: {
    type: String,
    require: '媒体不能为空！'
  },
  filename:String,
  io:String,//download,upload
  type:{
    type:String,
    default:'image'//图片（image）、语音（voice）、视频（video）和缩略图（thumb）
  },
  pubno: { //公号
    type: Schema.ObjectId,
    ref: 'WechatComponentPublic',
    required: '公号必须填写！'
  },
  time: {
    type: Date,
    default: Date.now
  },
});
MediaSchema.set('toJSON', {
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
module.exports = mongoose.model('Media', MediaSchema);
