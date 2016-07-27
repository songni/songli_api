"use strict";

var root = '../'
  , pathMd = root+'models/'
  , Merchant = require(pathMd+"merchant.model")
  , _ = require("lodash")
  , mongoose  = require('mongoose')
  , ObjectID = mongoose.Types.ObjectId
  ;

exports.get = function *(next){
  let pubno = this.pubno;
  let merchant = yield Merchant.findById(pubno.merchant)
                        .populate('pubno','appid authorizer_info.nick_name authorizer_info.head_img')
                        .exec();
  if(!merchant) {
    this.body = {};
    if(this.from === 'client'){
      this.body = {errcode:9404,errmsg:'该公众号尚未申请商户信息！',appid:this.pubno.appid};
      this.status = 406;
      console.error(this.body);
    }
    return;
  }
  if(merchant.status.status !== 1){
    if(this.from === 'client'){
      this.body = {errcode:9404,errmsg:'该公众号商户信息尚未被审批！',appid:this.pubno.appid};
      this.status = 406;
      console.error(this.body);
      return;
    }
  }
  this.body = merchant; 
};
exports.post = function *(next){
  let pubno = this.pubno;
  let merchant = pubno.merchant;
  if(merchant){
    this.status = 406;
    this.body = {errmsg:'已经申请过！'};
    return;
  }
  let body = this.request.body;
  let newData = {
    info:{
      name: body.info.name,
      address:body.info.address,
      detail:body.info.detail,
      linkman:body.info.linkman,
      telephone:body.info.telephone,
      phone:body.info.phone
    },
    pubno:pubno,
    component:this.component
  };
  var mcht = new Merchant(newData);
  yield mcht.save(function(err){if(err) console.error('商家:申请:错误',err);});
  pubno.merchant = mcht;
  yield pubno.save(function(err){if(err) console.error('商家:申请:错误',err);});
  this.body = {message:'申请成功'}
};
exports.edit = function *(next){
  let pubno = this.pubno;
  let merchant = yield Merchant.findById(pubno.merchant).exec();
  if(!merchant){
    this.status = 406;
    this.body = {errmsg:'还未申请！'};
    return;
  }
  let body = this.request.body;
  merchant.info.name = body.info.name;
  merchant.info.address = body.info.address;
  merchant.info.detail = body.info.detail;
  merchant.info.linkman = body.info.linkman;
  merchant.info.telephone = body.info.telephone;
  merchant.info.phone = body.info.phone;
  merchant.time.modified = Date.now();
  yield merchant.save(function(err){if(err) console.error('商家:修改:错误',err);});
  this.body = {message:'修改成功！'};
};
exports.upload = function *(next){
  let pubno = this.pubno;
  if(!pubno.merchant){
    this.status = 406;
    this.body = {errmsg:'请先申请商家！'};
    return;
  }
  if(pubno.status.verify){
    this.status = 406;
    this.body = {errmsg:'商家已审批不能修改！'};
    return;
  }
  let body = this.request.body;
  if(_.isUndefined(body.files) || _.isUndefined(body.files.file)){
    this.status = 404;
    this.body = {errmsg:'暂无上传图片'};
    return;
  }
  let file     = body.files.file;
  let path     = require('path');
  let oldPath  = file.path;
  let basename = path.basename(oldPath);
  let photo    = '/'+require('moment')().format('YYYY-M')+'/'+basename
  let newPath  = '/mnt/photo/photo'+photo;
  require('mv')(oldPath, newPath, function(err){
    if(err) throw err;
  });
  
  let merchant = yield Merchant.findById(pubno.merchant).exec();
  merchant.files.push(photo);
  yield merchant.save(function(err){if(err) console.error('商家:上传:错误',err);});
  this.body = {message:'上传成功！'};
};

exports.merchant = function*(id, next) {
  if(!ObjectID.isValid(id)){
    this.status = 406;
    this.body = {errmsg:'商户ID错误!'};
    return;
  }

  let merchant = yield Merchant.findById(id)
                      .populate('pubno')
                      .exec();
  if(!merchant){
    this.status = 404;
    this.body = {errmsg:'查找商户失败'}
    return;
  }

  this.merchant  = merchant;
  yield next;
};
