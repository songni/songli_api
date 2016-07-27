'use strict';

var moment = require('moment')
  , co = require('co')
  , assert = require('assert')
  // , mongoose = require('mongoose')
  , _ = require('lodash')
  , request = require('koa-request')
  , root = '../'
  , pathMd = root+'models/'
  , ComTicket = require(pathMd+"wechat.component.ticket.model")
  , ComAccessToken = require(pathMd+"wechat.component.access_token.model")
  , Pubno = require(pathMd+"wechat.component.public.model")
  , Component = require(pathMd+'component.model')
  , config = require('../config/environment')
  ;

exports.api_component_tokens = co.wrap(function*(){
  let components = yield Component.find({'status.status':1}).exec();
  for(let i in components){
    let component = components[i];
    yield ComAccessToken.findOneAndRemove({appid:component.appid});
    yield this.api_component_token(component.appid);
  }
});
exports.api_component_token = co.wrap(function*(appid){
  let component = yield Component.findOne({appid:appid}).exec();
  if(!component) return {errcode:1404,errmsg:'第三方不存在'};
  let token = yield ComAccessToken.findOne({appid:component.appid});
  if(token&&token.token) {
    return token.token; 
  }
  
  var ticket = yield ComTicket.findOne({AppId:component.appid}).exec();
  if(!ticket) {
    let error = {errcode:'unexists',errmsg:'微信后台推送的ticket不存在！',comid:component.appid};
    console.error(error);
    return error;
  }
  let options = {
    uri : 'https://api.weixin.qq.com/cgi-bin/component/api_component_token',
    method : 'POST',
    json : true,
    body: {
      "component_appid":component.appid,
      "component_appsecret":component.secret,
      "component_verify_ticket":ticket.ticket
    }
  };
  let response = yield request(options);
  let body = response.body;
  if(body&&body.errcode) {
    body.name = '获取第三方平台令牌';
    console.error('[第三方]:',options, body);
    return body;
  }
  token = new ComAccessToken();
  token.appid = component.appid;
  token.token = body.component_access_token;
  token.expires_in = body.expires_in;
  yield token.save();
  return token.token;
});
exports.api_authorizer_token = co.wrap(function*(pubno){
  if(pubno.token&&pubno.token.access&&pubno.token.expires>Date.now()){
    return pubno.token.access;
  }
  let token = yield this.api_component_token(pubno.component_appid);
  if(!token){
    let errmsg = {errcode:406,errmsg:'获取component_token空'};
    console.error(errmsg);
    return errmsg;
  }
  if(token&&token.errcode) {
    token.name = '获取公号授权令牌';
    console.error('[第三方]:',token);
    return token;
  }
  let options = {
    uri : "https://api.weixin.qq.com/cgi-bin/component/api_authorizer_token",
    method : 'POST',
    qs : {component_access_token : token},
    json : true,
    body: {
      component_appid: pubno.component_appid,
      authorizer_appid: pubno.appid,
      authorizer_refresh_token:pubno.token.refresh
    }
  };
  let response = yield request(options);
  let body = response.body;
  if(!body){
    let msg = {name:'获取公号授权令牌',errcode:9404,errmsg:'无法连接api'};
    console.error('[第三方]:',msg);
    return msg;
  }
  if(body&&body.errcode){
    body.name = '获取公号授权令牌';
    if(body.errcode == '61003'){
      body.errmsg = pubno.authorizer_info.nick_name+'已经取消对91拼团的授权!';
    }
    console.error('[第三方]:',body);
    return body;
  }
  pubno.token = {
    access:body.authorizer_access_token,
    refresh:body.authorizer_refresh_token,
    expires:moment().add(body.expires_in-600,'s')
  };
  yield pubno.save();
  return pubno.token.access;
});
exports.get_token_by_username = co.wrap(function*(ToUserName,component_appid){
  let condition = {
        'authorizer_info.user_name':ToUserName,
        'component_appid':component_appid
      };
  let pubno = yield Pubno.findOne(condition).exec();
  if(!pubno || !pubno.token){
    let errmsg = {errcode:9404,errmsg:'公号不存在',name:'通过user_name获取公号授权令牌'};
    console.error(errmsg);
    return errmsg;
  }
  if(pubno.token.expires>Date.now()){
    return pubno.token.access;
  }
  return yield this.api_authorizer_token(pubno);
});
exports.api_query_auth = co.wrap(function *(query_auth_code,appid){
  let token = yield this.api_component_token(appid);
  if(token.errcode) return token;
  let options = {
    uri : 'https://api.weixin.qq.com/cgi-bin/component/api_query_auth',
    method : 'POST',
    json: true,
    qs : {component_access_token : token},
    body: {
      "component_appid":appid,
      "authorization_code":query_auth_code
    }
  };
  let response = yield request(options);
  let body = response.body;
  if(!body){
    return {name:'使用授权码换取公众号的授权信息',errcode:9404,errmsg:'无法连接api'};
  }
  if(body&&body.errcode) {
    body.name = "使用授权码换取公众号的授权信息";
    return body;
  }
  let info = body.authorization_info;
  let pubno = yield Pubno.findOne({appid:info.authorizer_appid,component_appid:appid}).exec();
  if(!pubno){
    pubno = new Pubno();
    pubno.appid = info.authorizer_appid;
    pubno.component_appid = appid;
    pubno.component = yield Component.findOne({appid:appid}).exec();
  }
  pubno.token = {
    access:info.authorizer_access_token,
    refresh:info.authorizer_refresh_token,
    expires:moment().add(info.expires_in,'s')
  };
  pubno.func_info     = info.func_info;
  pubno.time.update   = Date.now();
  yield pubno.save();
  return pubno
});
exports.update = co.wrap(function*(id){
  let pubno = yield Pubno.findById(id).exec();
  if(!pubno){
    let msg = {errcode:406,errmsg:'公号不存在'};
    console.error(msg);
    return msg;
  }
  let token = yield this.api_component_token(pubno.component_appid);
  if(token.errcode) return token;
  let options = {
    uri : "api_get_authorizer_info",
    qs : {
      component_access_token : token
    },
    body: {
      "component_appid":  pubno.component_appid,
      "authorizer_appid": pubno.appid
    }
  };
  let optionsRes = {
      baseUrl : 'https://api.weixin.qq.com/cgi-bin/component/',
      method : 'POST',
      json : true
    }
  options = _.assign(optionsRes,options);
  let response = yield request(options);
  let body = response.body;
  if(!body){
    return {name:'更新公号信息',errcode:9404,errmsg:'无法连接api'};
  }
  if(body.errcode) {
    body.name = '更新公号信息';
    this.body = body;
    return;
  }
  if(body.authorizer_info)
    pubno.authorizer_info = body.authorizer_info;
  if(body.authorization_info.func_info)
    pubno.func_info = body.authorization_info.func_info;
  yield pubno.save();
  return pubno;
});
exports.update_empty_info = co.wrap(function*(){
  let pubnos = yield Pubno.find({authorizer_info:{$exists:false}}).exec();
  let info = {
    name:'更新公号空信息',
    msg:[]
  }
  for(let i in pubnos){
    let pubno = pubnos[i];
    info.msg.push(yield this.update(pubno.id));
  }
  return info;
});
exports.access_count = co.wrap(function*(pubno){
  yield Pubno.findByIdAndUpdate(pubno,{$inc:{'num.access':1}});
});
