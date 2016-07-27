"use strict";

var _ = require("lodash")
  , mongoose  = require('mongoose')
  , ObjectID = mongoose.Types.ObjectId

  , root = '../'
  , config = require(root+ 'config/environment')
  , pathMd = root+'models/'
  , PrepayMdl = require(pathMd+'wechat.prepay.model')
  , pathMw = root+'middlewares/'
  , Sign = require(pathMw+'sign')
  , jobsCreator = require(pathMw+'jobs.creator')
  , wepay =  require(pathMw+'wepay.mw')
  
  , request = require('koa-request')
  , querystring = require('querystring')
  , options = {
      baseUrl : 'https://api.mch.weixin.qq.com/pay/',
      method : 'POST',
      //json : true
    }
  , fs = require('fs')
  , xml2js = require('xml2js')
  , parser = require('xml2json')
  , Promise = require("bluebird")
  , fs = require('fs')
  ;

exports.config = function*(next){
  let payModule = this.payModule?this.payModule:'group';
  let appid = this.pubno.appid;
  let pay = this.pubno.pay;
  if(!pay.mch_id || !pay.key){
    this.status = 406;
    this.body = {errmsg : '公号暂未开通支付功能'};
    return;
  }
  let pfx = "./data/cert_"+appid+".p12";
  if(!fs.existsSync(pfx)){
    this.status = 406;
    this.body = {errmsg : '请上传API证书'};
    return;
  }
  var params = {
    mchId: pay.mch_id,
    partnerKey: pay.key,
    appId: appid,
    notifyUrl: config.api.url+"/wechat/pay/notify/"+payModule,
    pfx: fs.readFileSync(pfx)
  };
  this.config = params;
  yield next;
};

exports.unifiedorder = function * (next) {
  let prepay = yield PrepayMdl.findOne({partaker:this.partaker}).exec();//有效期两小时
  if(prepay){
    this.prepay_id = prepay.prepay_id;
    yield next;
    return;
  }
  var partaker  = this.partaker;
  var group     = this.group;
  var comm      = this.commodity;
  let total_fee = Math.ceil(comm.prepay*100)
  if(comm.model === 'ladder'){
    total_fee   = Math.ceil(comm.ladder.prepay*100);
  }
  let body = this.request.body;
  let params = {
    appid:this.pubno.appid,
    attach:'微信支付拼团',
    body:'预支付参加['+group.user.info.nickname.substring(0,10)+']发布的拼团',
    detail:'商品:'+comm.info.name,
    mch_id:this.config.mchId,
    notify_url:this.config.notifyUrl,
    openid:this.user.openid,
    out_trade_no:partaker.id,
    spbill_create_ip:this.request.ip,
    total_fee:total_fee,
    trade_type:'JSAPI',
    nonce_str:Sign.genNonceStr()
  };
  let sign = Sign.genWkey(params,this.config.partnerKey,'MD5');
  params.sign = sign;
  var builder = new xml2js.Builder();
  var xml = builder.buildObject({xml:params});
  let wp_options = {
    uri : "unifiedorder",
    body: xml
  };
  options = _.assign(options,wp_options);
  let response = yield request(options);
  let result = JSON.parse(parser.toJson(response.body));
  result = result.xml;
  if(result.return_code === 'FAIL'){
    this.status = 406;
    this.body = {
      errcode:result.return_code,
      errmsg:result.return_msg
    };
    return;
  }
  if(result.result_code === 'FAIL'){
    this.status = 406;
    this.body = {
      errcode:result.err_code,
      errmsg:result.err_code_des
    };
    //已经支付验单
    if(result.err_code === 'ORDERPAID'){
      jobsCreator.deal_order_check(partaker.id,this.pubno.id);
    }
    return;
  }
  this.prepay_id = result.prepay_id;
  prepay = new PrepayMdl({
    partaker:this.partaker,
    prepay_id:this.prepay_id
  });
  yield prepay.save();
  yield next;
};

exports.sign = function*(next){
  let timestamp = Sign.genTimeStamp();
  let nonceStr = Sign.genNonceStr();
  let packageStr = "prepay_id="+this.prepay_id;
  let params = {
    appId:this.pubno.appid,
    timeStamp:timestamp,
    nonceStr:nonceStr,
    signType:'MD5',
    package:packageStr
  };
  let paySign = Sign.genWkey(params,this.config.partnerKey,'MD5',false);
  let signArr = {
    timestamp:timestamp,
    nonceStr:nonceStr,
    package:packageStr,
    signType:'MD5',
    paySign:paySign,
    gid:this.group.id,
    id:this.group.id,
    state:'group.info'
  };
  this.log.info({sign:signArr},'支付签名');
  this.body = signArr;
};


exports.notify_check_sign = function*(next){
  var data = this.notify_data;
  let remote_sign = data['sign'];
  delete data['sign'];
  let local_sign = Sign.genWkey(this.notify_data,this.config.partnerKey,'MD5',false);
  if(local_sign !== remote_sign){
    this.body = 'fail';
    return;  
  };
  yield next;
};

exports.notify_check_data = function*(next){
  var data = this.notify_data;
  if(data.return_code === 'FAIL'){
    this.body = 'fail';
    return;
  };
  if(data.result_code === 'FAIL'){
    this.body = 'fail';
    return;
  };
  yield next;
};
