'use strict';

var co = require('co')
  , _ = require('lodash')
  , request = require('koa-request')
  , xml2js = require('xml2js')
  , xml2json = require('xml2json')
  , root = '../'
  , pathMd = root+'models/'
  , Pubno = require(pathMd+'wechat.component.public.model')
  , config = require(root+'config/environment')
  , Sign = require('./sign.js')
  , fs = require('fs')
  ;

exports.unifiedorder = co.wrap(function*(params,pubno){
  return yield api_call('unifiedorder', params, pubno);
});  
exports.orderquery = co.wrap(function*(out_trade_no,pubno){
  let params = {
    out_trade_no:out_trade_no
  };
  return yield api_call('orderquery', params, pubno);
});
exports.refund = co.wrap(function*(out_trade_no,out_refund_no,total_fee,refund_fee,pubno){
  let params = {
    out_trade_no:out_trade_no,//商户订单号
    out_refund_no:out_refund_no,//退款单号
    total_fee:total_fee,//总金额,单位为分整数
    refund_fee:refund_fee,//退款金额,单位为分整数
  };
  return yield api_call('refund', params, pubno);
});
exports.transfers = co.wrap(function*(partner_trade_no,openid,amount,desc,pubno){
  let params = {
    partner_trade_no:partner_trade_no,//商户订单号
    openid:openid,
    check_name:'NO_CHECK',
    amount:amount,//企业付款金额，单位为分
    desc:require('emojione').toShort(desc),//企业付款描述信息
    spbill_create_ip:'182.92.217.107',//'182.92.216.36'
  };
  return yield api_call('transfers', params, pubno);
});
exports.gettransferinfo = co.wrap(function*(partner_trade_no,pubno){
  let params = {
    partner_trade_no:partner_trade_no
  };
  return yield api_call('gettransferinfo', params, pubno);
});
var api_call = co.wrap(function*(uri, params, pubno){
  pubno = yield Pubno.findById(pubno).exec();
  let pay = pubno.pay;
  if(!pay.mch_id || !pay.key){
    return {
      errcode:406,
      errmsg:'公号暂未开通支付功能'
    };
  }
  let appid = pubno.appid;
  let pfx = require('path').normalize(__dirname + '/../data/cert_'+appid+'.p12');
  if(!require('fs').existsSync(pfx)){
    return {
      errcode:406,
      errmsg:'公号暂未上传API证书'
    };
  }
  let baseUrl = 'https://api.mch.weixin.qq.com/pay/';
  if(uri === 'refund'){
    baseUrl = 'https://api.mch.weixin.qq.com/secapi/pay/';
    params.op_user_id = pubno.pay.mch_id;////操作员帐号, 默认为商户号
  }
  if(uri === 'transfers'){
    baseUrl = 'https://api.mch.weixin.qq.com/mmpaymkttransfers/promotion/';
  }
  if(uri === 'gettransferinfo'){
    baseUrl = 'https://api.mch.weixin.qq.com/mmpaymkttransfers/';
  }
  let key = pubno.pay.key;
  if(uri === 'transfers'){
    params.mchid = pubno.pay.mch_id;
    params.mch_appid = pubno.appid;
  }else{
    params.mch_id = pubno.pay.mch_id;
    params.appid = pubno.appid;
  }
  params.nonce_str = Sign.genNonceStr();
  params.sign = Sign.genWkey(params,key,'MD5');
  let builder = new xml2js.Builder();
  let xml = builder.buildObject({xml:params});
  let request_options = {
    baseUrl : baseUrl,
    method : 'POST',
    uri : uri,
    body: xml
  };
  if(uri === 'refund' || uri === 'transfers' || uri === 'gettransferinfo'){
    let p12Path = require('path').dirname(__dirname)+'/data/cert_'+pubno.appid+'.p12';
    request_options.agentOptions = {
      pfx : fs.readFileSync(p12Path),
      passphrase : pubno.pay.mch_id
    };
  }
  let response = yield request(request_options);
  let parser_options = {
    object: true,
    reversible: false,
    coerce: false,//转换数字格式
    sanitize: true,
    trim: true,
    arrayNotation: false
  };
  let result = xml2json.toJson(response.body,parser_options);
  result = result.xml;
  if(result.return_code === 'FAIL'){
    return {
      errcode:result.return_code,
      errmsg:result.return_msg
    };
  }
  if(result.result_code === 'FAIL'){
    return {
      errcode:result.err_code,
      errmsg:result.err_code_des
    };
  }
  if(uri === 'refund' || uri === 'transfers' || uri === 'gettransferinfo'){
    return result;
  }
  let remote_sign = result['sign'];
  delete result['sign'];
  if(uri === 'transfers' || uri === 'gettransferinfo'){
    delete result['device_info'];
    delete result['return_msg'];
  }
  let local_sign = Sign.genWkey(result,key,'MD5',false);
  if(local_sign !== remote_sign){
    return {
      errcode:'Wrong Sign',
      errmsg:'签名错误'
    };
  }
  return result;
});

exports.sign = co.wrap(function*(prepay_id,target_id,pubno,state){
  let timestamp = Sign.genTimeStamp();
  let nonceStr = Sign.genNonceStr();
  let packageStr = "prepay_id="+prepay_id;
  let params = {
    appId:pubno.appid,
    timeStamp:timestamp,
    nonceStr:nonceStr,
    signType:'MD5',
    package:packageStr
  };
  let pay = pubno.pay;
  let paySign = Sign.genWkey(params,pay.key,'MD5',false);
  let signArr = {
    timestamp:timestamp,
    nonceStr:nonceStr,
    package:packageStr,
    signType:'MD5',
    paySign:paySign,
    id:target_id,
    state:state
  };
  return signArr;
});  
