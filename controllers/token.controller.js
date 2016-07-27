"use strict";

var root = '../'
  , pathMd = root+'models/'
  , Token = require(pathMd+"token.model")
  , Pubno = require(pathMd+"wechat.component.public.model")
  , User = require(pathMd+"user.model")
  , _ = require("lodash")
  , wecom = require(root+'middlewares/wecom.mw')
  ;

exports.component = function *(next){
  console.log('微信公众账号登录!');
  if(!this.pubno){
    this.status=406;
    this.errmsg = '公号为空';
    return;
  }
  var pubno = this.pubno;
  // support multi laptops login meanwhile
  // https://github.com/arrking/songni/issues/98
  // let token = yield Token.findOne({component:this.component, pubno:pubno}).exec();
  // if(token) yield token.remove();
  let token = new Token();
  token.pubno = pubno;
  token.component = this.component;
  yield token.save();
  this.body = {token:token.id};
};

exports.user = function *(next){
  let user = this.user;
  let token = yield Token.findOne({user:user}).exec();
  if(token) yield token.remove();
  token = new Token();
  token.user = user;
  yield token.save();
  this.body = {token:token.id};
};

exports.merchant = function *(next){
  let merchant = this.merchant;
  if(!merchant.pubno){
    this.status=406;
    this.errmsg = '公号为空';
    return;
  }
  var pubno = merchant.pubno;
  let token = yield Token.findOne({component:this.component, pubno:pubno}).exec();
  if(token) yield token.remove();
  token = new Token();
  token.pubno = pubno;
  token.component = this.component;
  yield token.save();
  this.body = {token:token.id};
};

exports.experience = function *(next){
  if(this.from === 'merchant'){
    let uid = this.query.uid;
    let pubno = '5553bf863f25f2770c080a02';
    if(process.env.NODE_ENV === 'development'){
      pubno = '564eb9ae83ba88982f8b4569';
    }
    this.pubno = yield Pubno.findById(pubno).exec();
  }
  if(this.from === 'client'){
    let uid = this.query.uid;
    let user = '5555900067f3b06e09ace3d4';
    if(process.env.NODE_ENV === 'development'){
      user = '564ecd4183ba88982f8b456b';
    }
    this.user = yield User.findById(user).exec();
  }
  yield next;
}
