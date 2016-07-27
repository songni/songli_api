'use strict';

var mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , Mixed = Schema.Types.Mixed
  , _ = require('lodash')
  ;
// 匹配的关键词
var KeywordSchema = new Schema({
    type: {
      type:String,
      default:'text'
    },
    //  匹配模式，contain代表消息中含有该关键词即可，equal表示消息内容必须和关键词严格相同
    match_mode: {
      type:String,
      default:'contain'
    },
    content: String
});
//图文消息的信息
var NewsSchema = new Schema({
  title:String,// 图文消息的标题
  digest:String,//  摘要
  author:String,//  作者
  show_cover:Number,//  是否显示封面，0为不显示，1为显示
  cover_url:String,// 封面图片的URL
  content_url:String,// 正文的URL
  source_url:String,//  原文的URL，若置空则无查看原文入口
});
//回复内容
var ReplySchema = new Schema({
      type: {
        type:String,
        default:'text'
      },
      content:String,
      news_info:[NewsSchema]
});


var KeywordAutoreplySchema = new Schema({
  //  规则名称
  rule_name:String,
  // 创建时间
  create_time:Number,
  //  回复模式，reply_all代表全部回复，random_one代表随机回复其中一条
  reply_mode:{type:String,default:'reply_all'},
  // 匹配的关键词列表
  keyword_list_info:[KeywordSchema],
  //回复内容列表
  reply_list_info:[ReplySchema],
});
var AutoReplySchema = new Schema({
  //content:{type:Mixed,required: '回复内容不能为空！'},
  content:{
    //关注后自动回复是否开启，0代表未开启，1代表开启
    is_add_friend_reply_open:{type:Number,default:1},
    //消息自动回复是否开启，0代表未开启，1代表开启
    is_autoreply_open:{type:Number,default:1},
    //关注后自动回复的信息
    add_friend_autoreply_info:{
      //自动回复的类型。关注后自动回复和消息自动回复的类型仅支持文本（text）、图片（img）、语音（voice）、视频（video），关键词自动回复则还多了图文消息（news）
      type:{type:String,default:'text'},
      //对于文本类型，content是文本内容，对于图文、图片、语音、视频类型，content是mediaID
      content:{type:String,default:''},
    },
    //消息自动回复的信息
    message_default_autoreply_info:{
      type:String,
      content:String
    },
    //关键词自动回复的信息
    keyword_autoreply_info:{
      list:[KeywordAutoreplySchema]
    }
  },
  pubno: {
    type: Schema.ObjectId,
    ref: 'WechatComponentPublic',
  },
  time: {
    update:Date,
    create:{
      type: Date,
      default: Date.now
    }
  }
});

AutoReplySchema.set('toJSON', {
  getters: true,
  virtuals: true,
  transform: function(doc, ret, options) {
    options.hide = options.hide || '_id __v pubno';
    if (options.hide) {
      options.hide.split(' ').forEach(function (prop) {
        delete ret[prop];
      });
    }
  }
});
AutoReplySchema.index({'pubno': 1}, {unique: true});

AutoReplySchema.statics.getCurr = function*(pubno) {
  return yield this.findOne({pubno: pubno}).exec();
};

module.exports = mongoose.model('WechatAutoReply', AutoReplySchema);
