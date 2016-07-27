'use strict';

let root = '../'
  , pathMd = root+'models/'
  , expcom = require('../config/express.company')
  ;

exports.company = function*(next){
  this.body = expcom;
};
