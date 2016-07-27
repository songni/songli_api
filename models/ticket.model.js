'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var TicketSchema = new Schema({
  appid: String,
  type:String,
  ticket: String,
  expires: { 
    type: Date,
    default: Date.now,
    expires: 60*60*2 //默认两小时过期
  }
});

TicketSchema.index({appid:1,type:1}, {unique: true});

TicketSchema.set('toJSON', {
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

module.exports = mongoose.model('Ticket', TicketSchema);
