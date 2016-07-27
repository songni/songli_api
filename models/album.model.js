'use strict';

var mongoose  = require('mongoose')
  , Schema    = mongoose.Schema
  , ObjectId  = mongoose.Types.ObjectId
  ;
    
var AlbumSchema = new Schema({
  info: {
    file_path:String,
    file_name:String,
    file_size:Number,
    file_type:String
  },
  pubno: {
    type: Schema.ObjectId,
    ref: 'WechatComponentPublic',
    required: '管理用户为空！'
  },
  status: {
    status: {
      type:Number,
      enum:[0,1], //0删除1正常
      default: 1
    },
    cover: {
      type:Number,
      enum:[0,1], //0非1是
      default: 0
    }
  },
  time: {
    add: {
      type:Date,
      default:Date.now
    }
  },
  sort:{
    type:Number,
    default:0
  }
});

AlbumSchema.set('toJSON', {
  getters: true,
  virtuals: true,
  transform: function(doc, ret, options) {
    options.hide = options.hide || '_id __v info time status pubno';
    if (options.hide) {
      options.hide.split(' ').forEach(function (prop) {
        delete ret[prop];
      });
    }
  }
});

module.exports = mongoose.model('Album', AlbumSchema);
