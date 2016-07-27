"use strict";

var root = '../'
  , pathMd = root+'models/'
  , Pubno = require(pathMd+'wechat.component.public.model')
  , User = require(pathMd+"user.model")
  , WechatMenu = require(pathMd+"wechat.menu.model")
  , WechatReply = require(pathMd+"wechat.autoreply.model")
  , Ticket = require(pathMd+"ticket.model")
  , pathMw = root+'middlewares/'
  , wechat = require(pathMw+'wechat.mw')
  , wecom = require(pathMw+'wecom.mw')
  , _ = require("lodash")
  , request = require('koa-request')
  , querystring = require('querystring')
  , optionsOauth2 = {
      baseUrl : 'https://api.weixin.qq.com/sns/oauth2/component/',
      method : 'POST',
      json : true
    }
  , config = require('../config/environment')
  , Sign = require('../middlewares/sign.js')
  , xml2json = require('xml2json')
  , pmx = require('pmx')
  , log = require('../services/logging').getLogger('wechat.controller')
  ;

/**
 * [*check_verify description]
 * @param {Function} next          [description]
 * @yield {[type]}   [description]
 */
exports.check_verify = function*(next){
  if(this.pubno){
    if(!this.pubno.status.verify){
      this.status = 406;
      this.body = {errmsg:'公号尚未验证不能使用'};
      return;
    }
  }
  yield next;
};

exports.menu = function*(next){
  if(this.going){
    yield next;
  }
  let body = this.request.body;
  let options = {
    uri : "menu/create",
    body: body
  };
  options = _.assign(this.wx_options,options);
  let response = yield request(options);
  if(response.body.errcode === 42001){
    yield next;
    options.qs.access_token = this.access_token;
    response = yield request(options);
  }
  this.body = response.body;
};
exports.login_page = function*(next){
  console.warn('fdjsaiofjdsoaifjdiosjfoiajfoidsajfiowfjoas')
  let redirect_uri = this.header.referer;
  if(this.query.referer){
    redirect_uri = this.header.origin+this.query.referer;
  }
  let queryObj = {
    appid:this.appid,
    redirect_uri:redirect_uri,
    response_type:'code',
    scope:'snsapi_userinfo',
    state:'songni',
    component_appid:this.component.appid
  };
  let query = querystring.stringify(queryObj);
  let link = 'https://open.weixin.qq.com/connect/oauth2/authorize?'+query+'#wechat_redirect';
  this.body = {link:link};
};
exports.access_token = function*(next){
  console.warn('$$$$$$$$$$$$$$$$$$$')
  let options = {
    baseUrl : 'https://api.weixin.qq.com/sns/oauth2/component/',
    method : 'POST',
    json : true,
    uri : "access_token",
    qs : {
      appid : this.appid,
      code: this.query.code,
      grant_type:'authorization_code',
      component_appid:this.component.appid,
      component_access_token:this.component_access_token
    }
  };
  let response = yield request(options);
  let body = response.body;
  console.warn('!!!!!!!!!!!!!!!!')
  console.warn(body);
  if(body.errcode){
    this.status = 406;
    body.name = '获取用户令牌错误';
    this.body = body;
    pmx.emit('api:oauth2:access_token', {options:options,body:body});
    return;
  }
  let user = yield User.findOne({openid:body.openid}).exec();
  if(!user){
    user = new User();
    user.openid = body.openid;
    user.unionid = body.unionid;
    user.appid = this.appid;
    user.component_appid = [this.component.appid];
  }
  user.token = {
    access:body.access_token,
    refresh:body.refresh_token,
    expires:body.expires_in
  };
  user.appid = this.appid;
  user.component_appid.addToSet(this.component.appid);
  yield user.save(function(err) {if(err) log.error(err);});
  this.user = user;
  yield next;
};
exports.refresh_token = function*(next){
  let options = {
    uri : "refresh_token",
    qs : {
      appid : this.appid,
      grant_type:'refresh_token',
      component_appid:this.component.appid,
      omponent_access_token:this.pubno.access_token,
      refresh_token:this.user.refresh_token
    }
  };
  options = _.assign(optionsOauth2,options);
  let response = yield request(options);
  this.body = response.body;
}
exports.get_userinfo = function*(next){
  let user = this.token.user;
  if(user.info.nickname){
    this.body = user;
    return;
  }
  let options = {
    baseUrl: "https://api.weixin.qq.com/sns/",
    uri : "userinfo",
    qs : {
      access_token : user.token.access,
      openid: user.openid,
      lang: "zh_CN"
    },
    json:true
  };
  let response = yield request(options);
  let body = response.body;
  if(!body){
    this.status = 406;
    this.body = {errcode:9404,errmsg:'远程读取用户信息失败'};;
    return;
  }
  if(body&&body.errcode){
    this.status = 406;
    this.body = body;
    return;
  }
  user.info.nickname = body.nickname;
  user.info.sex = body.sex;
  user.info.province = body.province;
  user.info.city = body.city;
  user.info.country = body.country;
  user.info.headimgurl = body.headimgurl;
  user.info.privilege = body.privilege;
  user.info.language = body.language;
  yield user.save(function(err) {if(err) log.error(err);});
  this.body = user;
};
exports.option = function*(next){
  this.access_token = yield wecom.api_authorizer_token(this.pubno);
  if(!this.access_token){
    let errmsg = {errcode:9404, errmsg:'无法获取微信访问令牌'}
    this.status = 406;
    this.body = errmsg;
    return;
  }
  if(this.access_token&&this.access_token.errcode){
    if(this.access_token.errcode == '45009'){
      this.access_token.errmsg = '由于微信调用限制，请明天再试';
      this.status = 200;
      this.body = this.access_token;
      return;
    }
    this.status = 406;
    this.body = this.access_token;
    return;
  }
  this.option = {
    baseUrl : 'https://api.weixin.qq.com/cgi-bin/',
    method : 'POST',
    json : true,
    qs : {
      access_token : this.access_token
    }
  };
  yield next; 
};
exports.ticket = function*(next){
  let type = this.query.type;
  let appid = this.pubno.appid;
  if(!_.includes(['jsapi'],type)){
    this.status = 406;
    this.body = {errmsg:'类型错误'};
    return;    
  }
  let ticket = yield Ticket.findOne({appid:appid,type:type}).exec();
  if(ticket){
    this.ticket = ticket.ticket;
    yield next;
    return;
  }
  let options = {
    uri : "ticket/getticket",
    method: 'GET',
    qs : {
      access_token : this.access_token,
      type: type
    }
  };
  options = _.assign(this.option,options);
  let response = yield request(options);
  let body = response.body;
  if(!body){
    this.status = 406;
    this.body = {errmsg:'微信服务器忙!'};
    return;
  }
  if(body&&body.errcode){
    this.status = 406;
    this.body = body;
    return;
  }
  this.ticket = body.ticket;
  yield next;
  ticket = new Ticket({
    appid:appid,
    ticket:this.ticket,
    type:type
  });
  yield ticket.save();
};
exports.sign_jssdk = function*(next){
  let appId = this.pubno.appid;
  let timeStamp = Sign.genTimeStamp();
  let nonceStr = Sign.genNonceStr();
  let params = {
    jsapi_ticket:this.ticket,
    nonceStr:nonceStr,
    timeStamp:timeStamp,
    url:this.query.url
  };
  let sign = Sign.generate(params,'SHA1');
  this.body =  {
    appId:this.pubno.appid,
    timestamp:timeStamp,
    nonceStr:nonceStr,
    signature:sign,
  };
};
exports.get_menu = function*(next){
  var menu = yield WechatMenu.getCurr(this.pubno.id);
  if(!menu){
    menu = config.menu[this.component.appid];
    menu = JSON.stringify(menu);
    menu = menu.replace(new RegExp(/(\$APPID\$)/g),this.pubno.appid);
    menu = {content: JSON.parse(menu)};
  }
  this.body = menu;
};
exports.create_menu = function*(next){
  var menu = new WechatMenu({content:this.request.body});
  menu.pubno = this.token.pubno;
  yield menu.save();
  this.body = {message:'保存成功！',menus:menu.content};
};
exports.set_menu = function*(next){
  let response = yield wechat.menu(this.pubno);
  if(response.errcode){
    this.status = 406;
    this.body = response;
    return;
  }
  this.body = {message:'设置成功！',response:response};
};
exports.tm_set_industry = function*(){
  let options = {
    uri : "template/api_set_industry",
    body: {"industry_id1":"1","industry_id2":"4"}
  };
  options = _.assign(this.option,options);
  let response = yield request(options);
  this.body = response.body;
};
exports.tm_get_id = function*(){
  let options = {
    uri : "template/api_add_template",
    body: {"template_id_short":"TM00483"}
  };
  options = _.assign(this.option,options);
  let response = yield request(options);
  this.body = response.body;
};
exports.tm_send = function*(next){
  let body =     {
        "touser":"oVambs056nIFtR86F8F-Sv2X2SP0",
        "template_id":"PfkaZS9A2Zn8lJFkVzni88qPBAOqrRk_-gA_tvUI7oU",
        "url":"http://weixin.qq.com/download",
        "topcolor":"#FF0000",
        "data":{
           "Pingou_Action":{
             "value":"发起",
             "color":"#173177"
           },
           "Pingou_ProductName": {
               "value":"大栗子便宜卖",
               "color":"#173177"
           },
           "Weixin_ID":{
               "value":"小王",
               "color":"#173177"
           },
           "Remark": {
               "value":"赶紧邀请小伙伴们加入，享受成团优惠价！",
               "color":"#173177"
           }
        }
      };
  let options = {
    uri : "message/template/send",
    body: body
  };
  options = _.assign(this.option,options);
  let response = yield request(options);
  this.body = response.body;
};
exports.sign_address = function*(next){
  let appId = this.pubno.appid;
  let url = this.query.url?this.query.url:'http://'+appId+'.'+this.component.redirect_uri;
  let timeStamp = Sign.genTimeStamp();
  let nonceStr = Sign.genNonceStr();
  let params = {
    appId:appId,
    url:url,
    timeStamp:timeStamp,
    nonceStr:nonceStr,
    accessToken:this.user.token.access
  };
  let sign = Sign.generate(params,'SHA1');
  this.body =  {
    appId:appId,
    url:url,
    timeStamp:timeStamp,
    nonceStr:nonceStr,
    addrSign:sign.toLowerCase()
  };
};

exports.pay = function*(next){

};
exports.notify = function*(next){
  var getRawBody = require('raw-body');
  var buffer = yield getRawBody(this.req, {
    length: this.length,
    limit: '1mb',
    encoding: this.charset
  });
  var options = {
    object: true,
    reversible: false,
    coerce: false,//转换数字格式
    sanitize: true,
    trim: true,
    arrayNotation: false
  };
  var json = xml2json.toJson(buffer.toString(),options);
  log.info( ">> get notify data "+ JSON.stringify(json.xml));
  this.notify_data = json.xml;
  this.pubno = yield Pubno.findOne({appid:this.notify_data.appid,component_appid:this.component.appid}).exec();
  yield next;
};
exports.shorturl = function*(next){
  let long_url = this.request.body.url;
  let options = {
    uri : "shorturl",
    body: {"action":"1","long_url":long_url}
  };
  options = _.assign(this.option,options);
  let response = yield request(options);
  this.body = response.body;
};
exports.short_url = function*(next){
  if(!this.query.url){
    this.status = 416;
    this.body = {errmsg:'请传递长链接！'};
    return ;
  }
  let url_long = this.query.url;
  let url_short = url_long;
  let options = {
    url:'https://api.weibo.com/2/short_url/shorten.json',
    qs:{'source':1464940076,'url_long':url_long},
    method: 'GET',
    json:true
  };
  let response = yield request(options);
  if(response.body.urls){
    var body = response.body.urls[0];
  }
  if(body&&body.url_short){
    url_short = body.url_short;
  }
  this.body = url_short;
};
exports.get_pay = function*(next){
  let pay = this.pubno.pay; 
  this.body = {
    mch_id:pay.mch_id?pay.mch_id:"",
    key:""
  };
};
exports.post_pay = function*(next){
  let body = this.request.body;
  let base = body.fields;
  if(!base.mch_id || !base.key){
    this.status = 406;
    this.body = {errmsg:'设置微信支付参数不全！'};
    return;
  }
  if(body.files&&body.files.pfx){
    let oldPath = body.files.pfx.path;
    let newPath = require('path').dirname(__dirname)+'/data/cert_'+this.pubno.appid+'.p12';
    log.info("save p12 certs: mv " + oldPath +  " " + newPath);
    require('mv')(oldPath,newPath,function(err){
      if(err) throw err;
    });
    this.pubno.pay.pfx = true;
  }
  this.pubno.pay.mch_id = base.mch_id;
  this.pubno.pay.key = base.key;
  this.pubno.save();
  this.body = {message:'设置成功'}
};
exports.qrcode = function*(next){
  let scene_id    = this.query.scene_id;
  let qrcode = "";
  if(Number.isInteger(scene_id)){
    qrcode = yield wechat.qrcode_permanent(scene_id,this.pubno);
  } else {
    qrcode = yield wechat.qrcode_permanent_str(scene_id,this.pubno);
  }
  if(qrcode.errmsg) {
    this.status = 406;
    this.body = qrcode;
    return;
  }
  this.body = qrcode.response.ticket;
};
exports.get_reply = function*(next){
  var reply = yield WechatReply.getCurr(this.pubno);
  if(!reply) reply = new WechatReply({pubno:this.pubno});
  this.body = [reply];
};
exports.update_reply = function*(next){
  let body = this.request.body;
  var reply = yield WechatReply.getCurr(this.pubno.id);
  if(!reply) reply = new WechatReply({pubno:this.pubno});
  reply.content = body.content;
  reply.update = Date.now();
  yield reply.save(function(err){if(err) log.error(err);});
  this.body = {message:'保存成功！'};
};
