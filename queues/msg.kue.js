'use strict';
//处理消息
let Document = require('../models/document.model')
  , log = require('bunyan').createLogger({name: 'crontabs'})
  , co = require('co')
  , request = require('koa-request')
  , datetime = require('../middlewares/datetime')
  , groupMw = require('../middlewares/group.mw')
  ;

var ejs = require('ejs');//请使用1.0.0版本
ejs.open = '{{';
ejs.close = '}}';

//获取消息内容

exports.Message = co.wrap(function*(msg_type, orderid, nickname, extra){
  let document = yield Document.findOne({type:msg_type,'status.status':1}).exec();
  if(!document) throw '找不到文档';
  return document.document;
});

//获取订单消息
exports.Order = co.wrap(function*(partaker){
  let message = yield this.Message('sms4'+partaker.commodity.status.paytype);
  let pubno = partaker.pubno;
  // 系统二维码链接
  //let qrcode_url = yield this.ShortUrl('http://'+partaker.pubno.appid+'.wx.91pintuan.com/qrcode/'+partaker.id);
  // 微信二维码链接
  let commodity = partaker.commodity;
  let group = partaker.group;
  let qrcode_url = '';
  if(commodity.status.qrcode){
    qrcode_url  = '验证二维码:';
    qrcode_url += yield this.ShortUrl(yield groupMw.qrcode_url(partaker.id,pubno));
  }
  return ejs.render(message, {
    colonel:group.address.name,
    orderid:partaker.id,
    url:qrcode_url,
    extra:commodity.info.sms?commodity.info.sms:''
  });
});

//阶梯团短信
//1.成团
exports.LadderPrepay = co.wrap(function*(partaker){
  let message = yield this.Message('sms4ladder_prepay');
  return ejs.render(message, {
    colonel:partaker.group.address.name,
    url:yield this.ShortUrl('http://'+partaker.pubno.appid+'.wx.91pintuan.com/group/'+partaker.group.id),
  });
});
//2.支付后
exports.LadderPay = co.wrap(function*(order){
  let message = yield this.Message('sms4ladder_pay');
  let pubno = order.pubno;
  // 系统二维码链接
  //let qrcode_url = yield this.ShortUrl('http://'+order.pubno.appid+'.wx.91pintuan.com/qrcode/'+partaker.id);
  // 微信二维码链接
  let commodity = order.commodity;
  let group = order.group;
  let partaker = order.partaker;
  let qrcode_url = '';
  if(commodity.status.qrcode){
    qrcode_url  = '验证二维码:';
    qrcode_url += yield this.ShortUrl(yield groupMw.qrcode_url(partaker.id,pubno));
  }
  return ejs.render(message, {
    colonel:group.address.name,
    orderid:partaker.id,
    url:qrcode_url,
    extra:commodity.info.sms?commodity.info.sms:''
  });
});
//获取红包消息
exports.redPacket = co.wrap(function*(group,count){
  let msg_type = group.commodity.status.model === 'share'?'sms4group_redpacket4share':'sms4group_redpacket';
  let message = yield this.Message(msg_type);
  return ejs.render(message, {
    commodity:group.commodity.info.name,
    club:group.pubno.authorizer_info.nick_name,
    count:count,
    url:yield this.ShortUrl("http://"+group.pubno.appid+".wx.91pintuan.com/user/redpacket")
  });
});

//退款短信
exports.drawBack = co.wrap(function*(partaker){
  let message = yield this.Message('sms4group_drawback');
  return ejs.render(message, {
    colonel:partaker.group.address.name,
    url:yield this.ShortUrl("http://"+partaker.pubno.appid+".wx.91pintuan.com/user/drawback")
  });
});

//通知团长有人参加新团
exports.noticeGroup = co.wrap(function*(partaker){
  let diffDate = datetime.diff(partaker.group.time.end);
  return '您好！'+partaker.address.name+'参加了您发起的'+partaker.commodity.info.name+'拼团'+
         '，离拼团结束还有'+diffDate+'，继续加油哦！';
});
//拼团满通知组织者
exports.noticeGroupFull = co.wrap(function*(partaker){
  let diffDate = datetime.diff(partaker.group.time.end);
  return '您发起的'+partaker.commodity.info.name+'拼团已达成团人数，'+
         '离拼团结束还有'+diffDate+'，还可继续邀请好友参加哦！';
});
//拼团满通知商家发
exports.noticeMerchant = co.wrap(function*(){
  let message = yield this.Message('sms4merchant');
  return message;
});
//取得短连接
exports.ShortUrl = co.wrap(function*(url){
  let options = {
    url:'https://api.weibo.com/2/short_url/shorten.json',
    qs:{'source':1464940076,'url_long':url},
    method: 'GET',
    json:true
  };
  let response = yield request(options);
  let url_short = url;
  if(response.body.urls)
    url_short = response.body.urls[0].url_short;
  return url_short;
});
