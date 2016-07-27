'use strict';


var mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , config = require('../config/environment')
  ;

var MerchantSchema = new Schema({
  info: {
    name: {
      type: String,
      trim: true,
      required: '名称不能为空！'
    },
    linkman: {
      type: String,
      trim: true,
      required: '联系人不能为空！'
    },
    telephone :  {
      type: String,
      trim: true,
      required:  '手机号不能为空！'
    },
    phone :  {
      type: String,
      trim: true
    },
    wechat: {
      type: String,
      trim: true,
    },
    wechat_link: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
      required: '地址不能为空！'
    },
    detail: {
      type: String,
      trim: true
    }
  },
  pubno:{
    type: Schema.ObjectId,
    ref: 'WechatComponentPublic'
  },
  component:{
    type: Schema.ObjectId,
    ref: 'Component'
  },
  permission:{
    type:[String],
    default:['group']
  },
  time: {
    created: {//创建时间
      type: Date,
      default: Date.now
    },
    modified: {//修改时间
      type: Date,
      default: Date.now
    },
    approval: {//审批时间
      type: Date
    },
    verify: {//通过时间
      type: Date
    },
    reject: {//驳回时间
      type: Date
    },
    test: {//测试时间
      type: Date
    },
    vip_start: {//正式商家开始时间
      type: Date
    },
    vip_end: {//正式商家结束时间
      type: Date
    }
  },
  status: {
    status: {//1 已审批 0 未审批
      type:Number,
      default:0
    },
    role:{//首页推荐
      type:String,
      default:'test'//test:测试商家,vip:正式商家
    },
    tips:{//首页推荐
      type:Boolean,
      default:false
    }
  },
  files:[],
  secret_key: {
    type: String,
    default:''
  }, //调用密匙
  remark:String //商家管理备注
});

MerchantSchema.virtual('name').get(function(){
  return this.info.name;
});
MerchantSchema.virtual('linkman').get(function(){
  return this.info.linkman;
});
MerchantSchema.virtual('telephone').get(function(){
  return this.info.telephone;
});
MerchantSchema.virtual('phone').get(function(){
  return this.info.phone;
});
MerchantSchema.virtual('wechat').get(function(){
  return this.info.wechat;
});
MerchantSchema.virtual('address').get(function(){
  return this.info.address;
});
MerchantSchema.virtual('detail').get(function(){
  return this.info.detail;
});
MerchantSchema.set('toJSON', {
  getters: true,
  virtuals: true,
  transform: function(doc, ret, options) {
    if (options.hide) {
      options.hide.split(' ').forEach(function (prop) {
        delete ret[prop];
      });
    }
    delete ret['_id'],delete ret['__v'];
  }
});
/**
* 验证
*/
MerchantSchema.path('info.name').validate(function(name) {
  let length = name.length;
  return length>0&&length<21;
}, '名称不能超过20个字');

MerchantSchema.path('info.linkman').validate(function(linkman) {
  let length = linkman.length;
  return length>0&&length<21;
}, '联系人不能超过20个字');

MerchantSchema.path('info.telephone').validate(function(telephone) {
  let pattern = config.regulars.telephone;
  return pattern.test(telephone);
}, '手机号不符合规则');


MerchantSchema.path('info.phone').validate(function(phone) {
  let length = phone.length;
  return length>=0&&length<50;
}, '联系电话不能超过50个字');

MerchantSchema.path('info.wechat').validate(function(wechat) {
  let length = wechat.length;
  return length>=0&&length<50;
}, '微信号不能超过50个字');

MerchantSchema.path('info.address').validate(function(address) {
  let length = address.length;
  return length>0&&length<255;
}, '地址不能超过255个字');

MerchantSchema.path('info.detail').validate(function(detail) {
  let length = detail.length;
  return length>0&&length<5000;
}, '介绍不能超过5000个字');

MerchantSchema.statics.load = function(id, cb) {
  this.findOne({
    _id: id
  }).populate('user', 'id info name').exec(cb);
};
MerchantSchema.statics.getByUsername = function(name, cb) {
  this.findOne({
    'info.name': name
  },'id info.name')
    .exec(cb);
};
module.exports = mongoose.model('Merchant', MerchantSchema);
