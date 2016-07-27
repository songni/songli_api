'user strict';

//微信通知消息日志
var mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , Mixed = Schema.Types.Mixed
  ;
var WebotSchema = new Schema({
  content: Mixed, //日志内容
  pubno: { //公号
    type: Schema.ObjectId,
    ref: 'WechatComponentPublic',
    required: '公号必须填写！'
  },
  component: {
    type: Schema.ObjectId,
    ref: 'Component',
    required: '第三方必须填写！'
  },
  expires: { 
    type: Date,
    default: Date.now,
    expires: 60*60*24*30 //一个月过期
  }
});

WebotSchema.set('toJSON', {
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

module.exports = mongoose.model('Webot', WebotSchema);
