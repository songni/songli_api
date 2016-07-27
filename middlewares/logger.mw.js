'use strict';

var co = require('co');
var Logger = require('../models/logger.model');
exports.write = co.wrap(function*(type,content){
  var logger = new Logger({type:type,content:content});
  yield logger.save();
});