'user strict';

var mongoose = require('mongoose')
  , Schema = mongoose.Schema;

var UserSchema = new Schema({
  openid:String,
  unionid:String,
  info:{
    nickname:String,
    telephone:Number,
    sex:Number,
    province:String,
    city:String,
    country:String,
    headimgurl:String,
    language:String,
    remark:String,//微信公号备注
    privilege:[]
  },
  token:{
    access:String,
    refresh:String,
    expires:Number
  },
  time: {
    create:{
      type: Date,
      default: Date.now
    },
    update:Date,
    subscribe:Date//关注时间
  },
  status: {
    verify: {
      type:Boolean,
      default:true
    },
    subscribe:Number//是否关注
  },
  pubno: {
    type: Schema.ObjectId,
    ref: 'WechatComponentPublic',
  },
  appid: String,//公众号
  component_appid:[],//第三方应用
  role:{
    client:{//手机客户端扫码角色
      type:Boolean,
      default:false
    }
  }
});

UserSchema.index({'openid': 1}, {unique: true});

UserSchema.virtual('name').get(function(){
  return this.info.name || this.info.nickname;
});
//UserSchema.virtual('nickname').get(function(){
//  return this.info.nickname;
//});
UserSchema.virtual('telephone').get(function(){
  return this.info.telephone;
});
UserSchema.virtual('headimgurl').get(function(){
  return this.info.headimgurl;
});
UserSchema.set('toJSON', {
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
module.exports = mongoose.model('User',UserSchema);
