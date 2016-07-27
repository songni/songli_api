"use strict";

var root = '../',
    pathMd = root + 'models/',
    _ = require("lodash"),
    optionsOauth2 = {
        baseUrl: 'https://api.weixin.qq.com/sns/oauth2/component/',
        method: 'POST',
        json: true
    },
    WechatMsg = require(pathMd + "wechat.msg.model"),
    WebotMdl = require(pathMd + "webot.model"),
    config = require(root + 'config/environment'),
    wechat = require(root + 'middlewares/wechat.mw'),
    wecom = require(root + 'middlewares/wecom.mw'),
    wemsg = require(root + 'middlewares/wemsg.mw'),
    webot = require(root + 'middlewares/webot.mw'),
    giftMw = require(root + 'middlewares/gift.mw'),
    parser = require('xml2json'),
    WXBizMsgCrypt = require('wechat-crypto'),
    getRawBody = require('raw-body'),
    randomstring = require("randomstring"),
    S = require('string'),
    mongoose = require('mongoose'),
    ObjectID = mongoose.Types.ObjectId,
    pmx = require('pmx'),
    log = require('../services/logging').getLogger('webot.controller');

exports.deal = function*(next) {
    var query = this.query;
    var timestamp = query.timestamp;
    var nonce = query.nonce;
    var echostr = query.echostr;
    var method = this.method;

    if (!_.includes(['GET', 'POST'], method)) {
        this.status = 401;
        this.body = 'Not Implemented';
        return;
    }
    var component = this.component;
    var cryptor = new WXBizMsgCrypt(component.token, component.encodingAESKey, component.appid);
    if (method === 'GET') {
        if (query.msg_signature !== cryptor.getSignature(timestamp, nonce, echostr)) {
            this.status = 401;
            this.body = 'Invalid signature';
            return;
        }
        var decrypted = cryptor.decrypt(echostr);
        this.body = decrypted.message;
        return;
    }
    var xml = yield getRawBody(this.req, {
        length: this.length,
        limit: '1mb',
        encoding: this.charset
    });
    var result = yield webot.parseXML(xml);
    if (!result || !result.xml) {
        console.error('[webot]: POST方法XML空');
        this.status = 401;
        this.body = 'XML Empty';
        return;
    }
    var formated = webot.formatMessage(result.xml);

    var encryptMessage = formated.Encrypt;
    if (query.msg_signature !== cryptor.getSignature(timestamp, nonce, encryptMessage)) {
        console.error('[webot]: POST方法签名错误');
        this.status = 401;
        this.body = 'Invalid signature';
        return;
    }
    var decryptedXML = cryptor.decrypt(encryptMessage);
    var messageWrapXml = decryptedXML.message;
    if (messageWrapXml === '') {
        console.error('[webot]: POST方法XML错误');
        this.status = 401;
        this.body = 'Invalid signature';
        return;
    }
    var decodedXML = yield webot.parseXML(messageWrapXml);
    formated = webot.formatMessage(decodedXML.xml);
    this.weixin = formated;
    if (this.sessionStore) {
        this.wxSessionId = formated.FromUserName;
        this.wxsession = yield this.sessionStore.get(this.wxSessionId);
        if (!this.wxsession) {
            this.wxsession = {};
            this.wxsession.cookie = this.session.cookie;
        }
    }
    yield next;
    if (this.sessionStore) {
        if (!this.wxsession) {
            if (this.wxSessionId) {
                yield this.sessionStore.destroy(this.wxSessionId);
            }
        } else {
            yield this.sessionStore.set(this.wxSessionId, this.wxsession);
        }
    }
    if (this.body === '') return;
    var replyMessageXml = webot.reply(this.body, formated.ToUserName, formated.FromUserName);
    var wrap = {};
    wrap.encrypt = cryptor.encrypt(replyMessageXml);
    wrap.nonce = parseInt((Math.random() * 100000000000), 10);
    wrap.timestamp = new Date().getTime();
    wrap.signature = cryptor.getSignature(wrap.timestamp, wrap.nonce, wrap.encrypt);
    this.body = webot.encryptWrap(wrap);
    this.type = 'application/xml';
};

exports.message = function*() {
    var msg = this.weixin;
    var evt = msg.Event;
    let FromUserName = msg.FromUserName;
    let ToUserName = msg.ToUserName;
    let Content = msg.Content;
    if (_.includes(Content, 'QUERY_AUTH_CODE:')) {
        let query_auth_code = Content.replace('QUERY_AUTH_CODE:', '');
        let pubno = yield wecom.api_query_auth(query_auth_code, this.component.appid);
        if (pubno.errcode) console.error(pubno);
        console.info('QUERY_AUTH_CODE', pubno.token.access);
    };
    this.wxsession.user = null;
    let user = this.wxsession.user;
    if (!user) {
        user = yield wechat.get_userinfo(FromUserName, ToUserName, this.component.appid);
        this.wxsession.user = user;
    }
    let name = user.name;
    let content = '';
    switch (msg.MsgType) {
        case 'text':
            if (ToUserName === 'gh_3c884a361561') {
                if (_.includes(Content, 'TESTCOMPONENT_MSG_TYPE_TEXT')) {
                    content = 'TESTCOMPONENT_MSG_TYPE_TEXT_callback';
                } else {
                    content = '';
                    let query_auth_code = Content.replace('QUERY_AUTH_CODE:', '');
                    let cstm_msg = yield wemsg.cstm_issue(
                        FromUserName,
                        ToUserName,
                        query_auth_code,
                        this.component.appid
                    );
                }
                break;
            }
            break;
        case 'image':
            break;
        case 'voice':
            break;
        case 'video':
            break;
        case 'shortvideo':
            break;
        case 'location':
            break;
        case 'link':
            break;
        case 'event':
            if (ToUserName === 'gh_3c884a361561') {
                content = msg.Event + 'from_callback';
                break;
            }
            switch (msg.Event.toLowerCase()) {
                case 'subscribe':
                    yield wemsg.send_failure(ToUserName);
                    if (msg.EventKey) {
                        if (this.component.appid === config.wechat.component.appId) {
                            let arrEK = msg.EventKey.split('_');
                            if (arrEK[1] === 'gift' && ObjectID.isValid(arrEK[2])) {
                                yield giftMw.subscribe(FromUserName, ToUserName, arrEK[2], this.component.appid, this.pubno.id, name);
                            }
                        }
                    } else {
                        let reply = yield wechat.get_autoreply(this.pubno);
                        if (reply && reply.add_friend_autoreply_info) {
                            this.body = reply.add_friend_autoreply_info;
                            return;
                        } else {
                            content = name + ',欢迎访问' + this.pubno.authorizer_info.nick_name + '!';
                        }
                    }
                    break;
                case 'unsubscribe':
                    break;
                case 'scan':
                    if (this.component.appid === config.wechat.component.appId) {
                        let arrEK = msg.EventKey.split('_');
                        if (arrEK[0] === 'gift' && ObjectID.isValid(arrEK[1])) {
                            yield giftMw.send_voice(FromUserName, ToUserName, arrEK[1], this.component.appid);
                        }
                    }
                    break;
                case 'location':
                    content = '';
                    break;
                case 'click':
                    if (this.component.appid === config.wechat.component.appId) {
                        if (msg.EventKey === 'my_gift') {
                            var media = yield giftMw.get_my(user);
                            if (media.errcode) {
                                this.body = {
                                    content: media.errmsg,
                                    type: 'text'
                                };
                            } else {
                                this.body = {
                                    type: "voice",
                                    content: {
                                        mediaId: media.media_id
                                    }
                                };
                                return;
                            }
                        }
                    }
                    break;
                case 'view':
                    break;
                case 'scancode_push':
                    break;
                case 'scancode_waitmsg':
                    if (!user.role.client) {
                        content = name + ',您还不是管理员！';
                        break;
                    }
                    var result = yield groupMw.trade(msg.ScanCodeInfo.ScanResult, 1, user.id);
                    if (typeof result === 'object') {
                        this.body = [result];
                    } else {
                        this.body = result;
                    }
                    return;
                    break;
                case 'pic_sysphoto':
                    break;
                case 'pic_photo_or_album':
                    break;
                case 'pic_weixin':
                    break;
                case 'location_select':
                    break;
                case 'media_id':
                    break;
                case 'view_limited':
                    break;
            }
            break;
    };
    if (content)
        this.body = {
            content: content,
            type: 'text'
        };
    else
        this.body = "";
};
