var xml2js = require('xml2js');
var ejs = require('../nosy_modules/ejs');
ejs.compileDebug = true;
ejs.debug = true;

exports.parseXML = function (xml) {
  return function (done) {
    xml2js.parseString(xml, {trim: true}, done);
  };
};

/*!
 * 将xml2js解析出来的对象转换成直接可访问的对象
 */
function formatMessage(result) {
  var message = {};
  if (typeof result === 'object') {
    for (var key in result) {
      if (!(result[key] instanceof Array) || result[key].length === 0) {
        continue;
      }
      if (result[key].length === 1) {
        var val = result[key][0];
        if (typeof val === 'object') {
          message[key] = formatMessage(val);
        } else {
          message[key] = (val || '').trim();
        }
      } else {
        message[key] = [];
        result[key].forEach(function (item) {
          message[key].push(formatMessage(item));
        });
      }
    }
  }
  return message;
};

exports.formatMessage = formatMessage;
/*!
 * 将内容回复给微信的封装方法
 */
exports.reply = function (content, fromUsername, toUsername) {
  var info = {};
  var type = 'text';
  info.content = content || '';
  if (Array.isArray(content)) {
    type = 'news';
  } else if (typeof content === 'object') {
    if (content.hasOwnProperty('type')) {
      if (content.type === 'customerService') {
        return reply2CustomerService(fromUsername, toUsername, content.kfAccount);
      }
      type = content.type;
      info.content = content.content;
    } else {
      type = 'music';
    }
  }
  info.msgType = type;
  info.createTime = new Date().getTime();
  info.toUsername = toUsername;
  info.fromUsername = fromUsername;
  return compiled(info);
};

/*!
 * 响应模版
 */
var tpl = ['<xml>',
    '<ToUserName><![CDATA[<%- toUsername %>]]></ToUserName>',
    '<FromUserName><![CDATA[<%- fromUsername %>]]></FromUserName>',
    '<CreateTime><%- createTime %></CreateTime>',
    '<MsgType><![CDATA[<%- msgType %>]]></MsgType>',
  '<% if (msgType === "news") { %>',
    '<ArticleCount><%- content.length %></ArticleCount>',
    '<Articles>',
    '<% content.forEach(function(item) { %>',
      '<item>',
        '<Title><![CDATA[<%- item.title %>]]></Title>',
        '<Description><![CDATA[<%- item.description %>]]></Description>',
        '<PicUrl><![CDATA[<%- item.picUrl || item.picurl || item.pic %>]]></PicUrl>',
        '<Url><![CDATA[<%- item.url %>]]></Url>',
      '</item>',
    '<% }); %>',
    '</Articles>',
  '<% } else if (msgType === "music") { %>',
    '<Music>',
      '<Title><![CDATA[<%- content.title %>]]></Title>',
      '<Description><![CDATA[<%- content.description %>]]></Description>',
      '<MusicUrl><![CDATA[<%- content.musicUrl || content.url %>]]></MusicUrl>',
      '<HQMusicUrl><![CDATA[<%- content.hqMusicUrl || content.hqUrl %>]]></HQMusicUrl>',
    '</Music>',
  '<% } else if (msgType === "voice") { %>',
    '<Voice>',
      '<MediaId><![CDATA[<%- content.mediaId %>]]></MediaId>',
    '</Voice>',
  '<% } else if (msgType === "image") { %>',
    '<Image>',
      '<MediaId><![CDATA[<%- content.mediaId %>]]></MediaId>',
    '</Image>',
  '<% } else if (msgType === "video") { %>',
    '<Video>',
      '<MediaId><![CDATA[<%- content.mediaId %>]]></MediaId>',
      '<Title><![CDATA[<%- content.title %>]]></Title>',
      '<Description><![CDATA[<%- content.description %>]]></Description>',
    '</Video>',
  '<% } else if (msgType === "transfer_customer_service") { %>',
    '<% if (content && content.kfAccount) { %>',
      '<TransInfo>',
        '<KfAccount><![CDATA[<%- content.kfAccount %>]]></KfAccount>',
      '</TransInfo>',
    '<% } %>',
  '<% } else { %>',
    '<Content><![CDATA[<%- content %>]]></Content>',
  '<% } %>',
  '</xml>'].join('');

/*!
 * 编译过后的模版
 */
var compiled = ejs.compile(tpl);

var wrapTpl = '<xml>' +
  '<Encrypt><![CDATA[<%- encrypt %>]]></Encrypt>' +
  '<MsgSignature><![CDATA[<%- signature %>]]></MsgSignature>' +
  '<TimeStamp><%- timestamp %></TimeStamp>' +
  '<Nonce><![CDATA[<%- nonce %>]]></Nonce>' +
'</xml>';

exports.encryptWrap = ejs.compile(wrapTpl);

var reply2CustomerService = function (fromUsername, toUsername, kfAccount) {
  var info = {};
  info.msgType = 'transfer_customer_service';
  info.createTime = new Date().getTime();
  info.toUsername = toUsername;
  info.fromUsername = fromUsername;
  info.content = {};
  if (typeof kfAccount === 'string') {
    info.content.kfAccount = kfAccount;
  }
  return compiled(info);
};
