'user strict';

//模板消息日志
var mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , Mixed = Schema.Types.Mixed
  ;
var WemsgSchema = new Schema({
  msgid:Number,
  errcode:Number,
  errmsg:String,
  content: Mixed, //日志内容
  pubno: String,
  component: String,
  expires: { 
    type: Date,
    default: Date.now,
    expires: 60*60*24*30 //一个月过期
  }
});

//WemsgSchema.index({'msgid': 1}, {unique: true});

WemsgSchema.set('toJSON', {
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

module.exports = mongoose.model('Wemsg', WemsgSchema);
