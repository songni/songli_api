'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var WechatComponentTicketSchema = new Schema({
  AppId: String,
  CreateTime:Date,
  ticket: String,
});

WechatComponentTicketSchema.index({'AppId': 1}, {unique: true});

WechatComponentTicketSchema.set('toJSON', {
  getters: true,
  virtuals: true,
  transform: function(doc, ret, options) {
    options.hide = options.hide || '_id __v';
    if (options.hide) {
      options.hide.split(' ').forEach(function (prop) {
        delete ret[prop];
      });
    }
  }
});

module.exports = mongoose.model('WechatComponentTicket', WechatComponentTicketSchema);
