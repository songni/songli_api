'use strict';

var mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , Mixed = Schema.Types.Mixed
  ;

var QrcodeSchema = new Schema({
  request:{//请求参数。
    action_name:String,//二维码类型，QR_SCENE为临时,QR_LIMIT_SCENE为永久,QR_LIMIT_STR_SCENE为永久的字符串参数值 
    action_info: {
      scene: {
        scene_id: Number,//场景值ID，临时二维码时为32位非0整型，永久二维码时最大值为100000（目前参数只支持1--100000）
        scene_str:String//场景值ID（字符串形式的ID），字符串类型，长度限制为1到64，仅永久二维码支持此字段
      }
    },
    expire_seconds:Number//该二维码有效时间，以秒为单位。 最大不超过604800（即7天）。
  },
  response:{//返回参数
    ticket:String,//获取的二维码ticket，凭借此ticket可以在有效时间内换取二维码。
    expire_seconds:Number,//二维码的有效时间，以秒为单位。最大不超过1800。
    url:String//二维码图片解析后的地址，开发者可根据该地址自行生成需要的二维码图片    
  },
  create_time: {//创建时间
    type: Date,
    default: Date.now,
    //expires: 60*60*2
  },
  pubno: {//公号信息
    type: Schema.ObjectId,
    ref: 'WechatComponentPublic',
    required: '公号为空！'
  }
});

QrcodeSchema.set('toJSON', {
  getters: true,
  virtuals: true,
  transform: function(doc, ret, options) {
    options.hide = options.hide || '_id __v';
    if (options.hide) {
      options.hide.split(' ').forEach(function (prop) {
        delete ret[prop];
      });
    }
  }
});

module.exports = mongoose.model('Qrcode', QrcodeSchema);
