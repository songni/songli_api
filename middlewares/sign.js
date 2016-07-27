//签名函数

var md5 = require('md5');
var sha1 = require('sha1');
var _ = require('lodash');

var signTypes = {MD5: md5,SHA1: sha1};

//生成签名
//支付md5,jssdk sha1
exports.generate = function (params, signType) {
  signType = signType || "MD5";
  var string = this.toQueryString(params);
  //console.log(string);
  var sign = signTypes[signType](string).toUpperCase();
  return sign;
};
exports.genWkey = function (params, key, signType,lower) {
  signType = signType || "MD5";
  var string = this.toQueryString(params,lower);
  string += '&key='+key;
  //console.log(string);
  return signTypes[signType](string).toUpperCase();
};
//序列化参数
exports.toQueryString = function (object,lower) {
	var lower = _.isUndefined(lower)?true:lower;
  return Object.keys(object).filter(function (key) {
    return object[key] !== undefined && object[key] !== '';
  }).sort().map(function (key) {
  	var val = object[key];
  	if(lower) var key = key.toLowerCase();
    return key + "=" + val;
  }).join("&");
};
//生成时间戳
exports.genTimeStamp = function () {
  return parseInt(+new Date() / 1000, 10) + "";
};
//生成随机数
exports.genNonceStr = function (length) {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var maxPos = chars.length;
  var nonce = "";
  var i;
  for (i = 0; i < (length || 32); i++) {
    nonce += chars.charAt(Math.floor(Math.random() * maxPos));
  }
  return nonce;
};
