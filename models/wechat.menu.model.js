'use strict';

var mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , Mixed = Schema.Types.Mixed
  , _ = require('lodash')
  ;

var WechatMenuSchema = new Schema({
  content:{
    type:Mixed,
    required: '菜单不能为空！'
  },
  pubno: {
    type: Schema.ObjectId,
    ref: 'WechatComponentPublic',
  },
  time: {
    type: Date,
    default: Date.now
  }
});

WechatMenuSchema.set('toJSON', {
  getters: true,
  virtuals: true,
  transform: function(doc, ret, options) {
    options.hide = options.hide || '_id __v pubno';
    if (options.hide) {
      options.hide.split(' ').forEach(function (prop) {
        delete ret[prop];
      });
    }
  }
});

WechatMenuSchema.statics.getCurr = function*(pubno) {
  return yield this.findOne({pubno: pubno},null,{sort:{_id:-1}}).exec();
};

module.exports = mongoose.model('WechatMenu', WechatMenuSchema);
