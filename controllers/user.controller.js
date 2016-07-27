"use strict";

var root = '../'
  , pathMd = root+'models/'
  , User = require(pathMd+"user.model")
  , _ = require("lodash")
  , mongoose  = require('mongoose')
  , ObjectID = mongoose.Types.ObjectId
  , pathMw = root+'middlewares/'
  , wechat = require(pathMw+'wechat.mw')
  ;
  
exports.get = function*(id, next){
  if(!ObjectID.isValid(id)){
    this.status = 406;
    this.body = {errmsg:'用户ID错误!'};
    return;
  }
  this.user = yield User.findById(id).exec();
  if(!this.user){
    this.status = 406;
    this.body = {errmsg:'用户不存在!'};
    return;
  }
  yield next;
};
exports.sign_out = function*(next){
  this.token.remove();
  this.body = {message:'退出成功！'};
};
