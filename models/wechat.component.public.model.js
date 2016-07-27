'use strict';

var mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , Mixed = Schema.Types.Mixed
  ;
/*
verify_type_info: 授权方认证类型，-1代表未认证，0代表微信认证，1代表新浪微博认证，2代表腾讯微博认证，3代表已资质认证通过但还未通过名称认证，4代表已资质认证通过、还未通过名称认证，但通过了新浪微博认证，5代表已资质认证通过、还未通过名称认证，但通过了腾讯微博认证
service_type_info:  授权方公众号类型，0代表订阅号，1代表由历史老帐号升级后的订阅号，2代表服务号
func_info:  公众号授权给开发者的权限集列表（请注意，当出现用户已经将消息与菜单权限集授权给了某个第三方，再授权给另一个第三方时，由于该权限集是互斥的，后一个第三方的授权将去除此权限集，开发者可以在返回的func_info信息中验证这一点，避免信息遗漏），1到9分别代表：
消息与菜单权限集
用户管理权限集
帐号管理权限集
网页授权权限集
微信小店权限集
多客服权限集
业务通知权限集
微信卡券权限集
微信扫一扫权限集
*/
var WechatComponentPublicSchema = new Schema({
  appid:String,//授权方appid
  component_appid:String,//第三方appid
  component:{
    type: Schema.ObjectId,
    ref: 'Component'
  },
  authorizer_info:{
    nick_name: String,//授权方昵称
    user_name: String,//授权方公众号的原始ID,如：gh_eb5e3a772040
    alias: String,//授权方公众号所设置的微信号，可能为空
    qrcode_url: String,//二维码图片的URL，开发者最好自行也进行保存
    head_img: String,//授权方头像
    verify_type_info: {
       id: Number
    },
    service_type_info: {
       id: Number
    },
  },
  token:{
    access:String,
    refresh:String,
    expires:Date
  },
  func_info:[Mixed],//授权信息
  merchant:{//本地商家信息
    type: Schema.ObjectId,
    ref: 'Merchant'
  },
  pay:{//支付参数
    mch_id:String,//微信支付分配的商户号
    key:String,//API签名密钥
    pfx:{//https加密文件
      type:Boolean,
      default:false
    }
  },
  time: {
    create:{
      type: Date,
      default: Date.now
    },
    update:Date,
    unauthorized:Date//取消授权时间
  },
  status: {//审批状态
    verify: {//是否蜘蛛工社认证
      type:Boolean,
      default:false
    },
    authorization:{//公号是否授权
      type:Boolean,
      default:true
    },
    tips:{//首页推荐
      type:Boolean,
      default:false
    }
  },
  num: {
    access:{type:Number,default:0},
    commodity:{type:Number,default:0},
    group:{type:Number,default:0},
    partaker:{type:Number,default:0},
    pay:{type:Number,default:0},
    gift:{type:Number,default:0},//礼物
    gift_order:{type:Number,default:0},//礼物订单
    gift_pay:{type:Number,default:0}//礼物支付
  },
  money: {
    prepay:{type:Number,default:0},//预付
    repay:{type:Number,default:0},//补款
    gift:{type:Number,default:0},//礼物
    amount:{type:Number,default:0}//总额
  }
});

WechatComponentPublicSchema.index({'appid': 1,'component_appid':1}, {unique: true});
WechatComponentPublicSchema.virtual('nick_name').get(function(){
  return this.authorizer_info.nick_name;
});
WechatComponentPublicSchema.virtual('head_img').get(function(){
  return this.authorizer_info.head_img;
});
WechatComponentPublicSchema.virtual('service_type_info').get(function(){
  let service_type_info;
  switch(this.authorizer_info.service_type_info.id){
    case 0:
      service_type_info = '订阅号';
      break;
    case 1:
      service_type_info = '由历史老帐号升级后的订阅号';
      break;
    case 2:
      service_type_info = '服务号';
      break;
    default:
      service_type_info = '未知';
  }
  return service_type_info;
});
WechatComponentPublicSchema.virtual('verify_type_info').get(function(){
  let verify_type_info;
  switch(this.authorizer_info.verify_type_info.id){
    case -1:
      verify_type_info = '未认证';
      break;
    case 0:
      verify_type_info = '微信认证';
      break;
    case 1:
      verify_type_info = '新浪微博认证';
      break;
    case 2:
      verify_type_info = '腾讯微博认证';
      break;
    case 3:
      verify_type_info = '资质认证通过但还未通过名称认证';
      break;
    case 4:
      verify_type_info = '资质认证通过、还未通过名称认证，但通过了新浪微博认证';
      break;
    case 5:
      verify_type_info = '资质认证通过、还未通过名称认证，但通过了腾讯微博认证';
      break;
    default:
      verify_type_info = '未知';
  }
  return verify_type_info;
});
WechatComponentPublicSchema.virtual('user_name').get(function(){
  return this.authorizer_info.user_name;
});
WechatComponentPublicSchema.virtual('alias').get(function(){
  return this.authorizer_info.alias;
});
WechatComponentPublicSchema.virtual('qrcode_url').get(function(){
  return this.authorizer_info.qrcode_url;
});
WechatComponentPublicSchema.virtual('time_login').get(function(){
  return this.time.update;
});
WechatComponentPublicSchema.virtual('wxVerify').get(function(){
  return this.authorizer_info.verify_type_info.id<0?false:true;
});
WechatComponentPublicSchema.virtual('verify').get(function(){
  return this.status.verify;
});
WechatComponentPublicSchema.virtual('amount').get(function(){
  return this.money.prepay+this.money.repay+this.money.gift;
});
WechatComponentPublicSchema.set('toJSON', {
  getters: true,
  virtuals: true,
  transform: function(doc, ret, options) {
    options.hide = options.hide || '_id __v authorizer_info func_info pay time status token money';
    if (options.hide) {
      options.hide.split(' ').forEach(function (prop) {
        delete ret[prop];
      });
    }
  }
});

module.exports = mongoose.model('WechatComponentPublic', WechatComponentPublicSchema);
