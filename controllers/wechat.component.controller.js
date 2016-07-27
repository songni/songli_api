"use strict";

var root = '../',
    pathMd = root + 'models/',
    ComTicket = require(pathMd + "wechat.component.ticket.model"),
    ComAccessToken = require(pathMd + "wechat.component.access_token.model"),
    Pubno = require(pathMd + "wechat.component.public.model"),
    User = require(pathMd + "user.model"),
    Component = require(pathMd + 'component.model'),
    wecom = require(root + 'middlewares/wecom.mw'),
    wechat = require(root + 'middlewares/wechat.mw'),
    _ = require("lodash"),
    request = require('koa-request'),
    moment = require('moment'),
    parser = require('xml2json'),
    WXBizMsgCrypt = require('wechat-crypto'),
    config = require('../config/environment'),
    optionsRes = {
        baseUrl: 'https://api.weixin.qq.com/cgi-bin/component/',
        method: 'POST',
        json: true
    };

exports.callback = function*(next) {
    var signature = this.query.signature;
    var timestamp = this.query.timestamp;
    var nonce = this.query.nonce;
    var encrypt_type = this.query.encrypt_type;
    var msg_signature = this.query.msg_signature;
    var cryptor = new WXBizMsgCrypt(
        this.component.token,
        this.component.encodingAESKey,
        this.component.appid
    );
    var getRawBody = require('raw-body');
    var buffer = yield getRawBody(this.req, {
        length: this.length,
        limit: '1mb',
        encoding: this.charset
    })
    var options = {
        object: true,
        reversible: false,
        coerce: false, //转换数字格式
        sanitize: true,
        trim: true,
        arrayNotation: false
    };
    var json = parser.toJson(buffer.toString(), options);
    var encrypt = json.xml.Encrypt;
    var getSignature = cryptor.getSignature(timestamp, nonce, encrypt);
    if (getSignature !== msg_signature) {
        this.body = 'failure';
        return;
    }
    var decrypted = cryptor.decrypt(encrypt);
    var obj = parser.toJson(decrypted.message, {
        object: true,
        sanitize: false
    });
    this.msg = obj.xml;
    if (_.isEmpty(this.msg)) {
        this.body = 'failure';
        return;
    }
    yield next;
};
exports.component_verify_ticket = function*(next) {
    if (this.msg.InfoType !== 'component_verify_ticket') {
        yield next;
    }
    let msg = this.msg;
    let ticket = yield ComTicket.findOne({
        AppId: msg.AppId
    }).exec();
    if (!ticket) {
        ticket = new ComTicket();
        ticket.AppId = msg.AppId;
    }
    ticket.CreateTime = new Date(msg.CreateTime * 1000);
    ticket.ticket = msg.ComponentVerifyTicket;
    yield ticket.save(function(err) {
        if (err) console.error(err);
    });

    this.body = 'success';
};
exports.unauthorized = function*(next) {
    let msg = this.msg;
    if (!msg.AuthorizerAppid) {
        this.body = 'failure';
        return;
    }
    yield Pubno.update({
        appid: msg.AuthorizerAppid,
        component_appid: msg.Appid
    }, {
        'status.authorization': false,
        'time.unauthorized': Date.now()
    });
    this.body = 'success';
};
exports.access_token = function*(next) {
    //todo remove
    console.warn(`[control-flow] enter wechat component controller, method is access_token`);
    console.warn(require('util').inspect(this.component));
    let ticket = yield ComTicket.findOne({
        AppId: this.component.appid
    }).exec();
    console.warn(`ticket is ${ticket}`);
    if (!ticket) {
        this.status = 406;
        this.body = {
            errmsg: '微信后台推送的ticket不存在！'
        };
        return;
    }
    let token = yield ComAccessToken.findOne({
        appid: this.component.appid
    }).exec();
    console.warn(`token is ${token}`);
    if (token) {
        this.component_access_token = token.token;
        yield next;
        return;
    }
    let options = {
        uri: "api_component_token",
        body: {
            "component_appid": this.component.appid,
            "component_appsecret": this.component.secret,
            "component_verify_ticket": ticket.ticket
        }
    };
    console.warn(`request token`);
    options = _.assign(optionsRes, options);
    let response = yield request(options);
    let body = response.body;
    if (body.errcode) {
        this.status = 401;
        this.body = body;
        return;
    }
    token = new ComAccessToken({
        appid: this.component.appid,
        token: body.component_access_token,
        expires_in: body.expires_in
    });
    console.warn(`token is ${token}`);
    yield token.save();
    this.component_access_token = body.component_access_token;
    yield next;
};
exports.pre_auth_code = function*(next) {
    //todo remove
    console.warn(`[control-flow] enter wechat component controller, method is pre_auth_code`);
    let options = {
        uri: "api_create_preauthcode",
        qs: {
            component_access_token: this.component_access_token
        },
        body: {
            "component_appid": this.component.appid
        }
    };
    options = _.assign(optionsRes, options);
    let response = yield request(options);
    let body = response.body;
    if (!body) {
        this.status = 401;
        this.body = {
            errmsg: '无法读取微信服务器信息！'
        };
        return;
    }
    if (body.errcode) {
        this.status = 401;
        this.body = body;
        return;
    }
    console.warn(`pre_auth_code is ${body.pre_auth_code}`);
    this.pre_auth_code = response.body.pre_auth_code;
    yield next;
};
exports.login_page = function*(next) {
    //todo remove
    console.warn(`[control-flow] enter wechat component controller, method is login_page`);
    let redirect_uri = this.header.origin;
    if (this.query.referer) {
        redirect_uri += this.query.referer;
    }
    console.warn(`redirect_uri is ${redirect_uri}`);
    var link = 'https://mp.weixin.qq.com/cgi-bin/componentloginpage?' + 'component_appid=' + this.component.appid + '&pre_auth_code=' + this.pre_auth_code + '&redirect_uri=' + redirect_uri;
    this.body = {
        link: link
    };
};
exports.api_query_auth = function*(next) {
    let pubno = yield wecom.api_query_auth(this.query.auth_code, this.component.appid);
    if (pubno.errcode) {
        this.status = 406;
        this.body = pubno;
        return;
    }
    this.pubno = pubno;
    yield next;
    /**
     * FIXME
     * https://github.com/arrking/songni/issues/165
     * Not sure the impact of this comment out
     * But it may fix a tmp problem
     */
    // yield wechat.get_autoreply(pubno);
    // yield wechat.menu(this.pubno);
};

exports.api_get_authorizer_info = function*(next) {
    let pubno = this.token.pubno;
    if (_.isEmpty(pubno)) {
        this.status = 404;
        this.body = {
            errmsg: '公号不存在！'
        };
        return;
    }
    if (pubno.authorizer_info.user_name && pubno.token.expires > Date.now()) {
        this.body = pubno;
        return;
    }
    let options = {
        uri: "api_get_authorizer_info",
        qs: {
            component_access_token: this.component_access_token
        },
        body: {
            "component_appid": this.component.appid,
            "authorizer_appid": pubno.appid
        }
    };
    options = _.assign(optionsRes, options);
    let response = yield request(options);
    let body = response.body;
    if (body.errcode) {
        this.status = 401;
        this.body = body;
        return;
    }
    if (body.authorizer_info)
        pubno.authorizer_info = body.authorizer_info;
    if (body.authorization_info && body.authorization_info.func_info)
        pubno.func_info = body.authorization_info.func_info;
    yield pubno.save(function(err) {
        if (err) console.error(err);
    });
    this.body = pubno;
};
exports.api_get_authorizer_option = function*(next) {
    let pubno = this.token.pubno;
    let option_name = this.query.option_name ? this.query.option_name : 'voice_recognize';
    let options = {
        uri: "api_get_authorizer_option",
        qs: {
            component_access_token: this.component_access_token
        },
        body: {
            component_appid: this.component.appid,
            authorizer_appid: pubno.appid,
            option_name: option_name
        }
    };
    options = _.assign(optionsRes, options);
    let response = yield request(options);
    this.body = response.body;
};
exports.api_set_authorizer_option = function*(next) {
    let pubno = this.token.pubno;
    let option_name = this.request.body.option_name ? this.query.option_name : 'voice_recognize';
    let option_value = this.request.body.option_value ? this.query.option_value : 1;
    let options = {
        uri: "api_set_authorizer_option",
        qs: {
            component_access_token: this.component_access_token
        },
        body: {
            component_appid: this.component.appid,
            authorizer_appid: pubno.appid,
            option_name: option_name,
            option_value: option_value
        }
    };
    options = _.assign(optionsRes, options);
    let response = yield request(options);
    this.body = response.body;
};
exports.api_authorizer_token = function*(next) {
    let pubno = this.pubno;
    if (pubno.token.expires > Date.now()) {
        this.access_token = pubno.token.access;
        yield next;
        return;
    }
    let options = {
        uri: "api_authorizer_token",
        qs: {
            component_access_token: this.component_access_token
        },
        body: {
            component_appid: this.component.appid,
            authorizer_appid: pubno.appid,
            authorizer_refresh_token: pubno.token.refresh
        }
    };
    options = _.assign(optionsRes, options);
    let response = yield request(options);
    let body = response.body;
    if (body.errcode) {
        this.status = 406;
        this.body = body;
        return;
    }
    pubno.token = {
        access: body.authorizer_access_token,
        refresh: body.authorizer_refresh_token,
        expires: moment().add(body.expires_in, 's')
    };
    yield pubno.save();
    this.access_token = pubno.token.access;
    yield next;
};
exports.set_component_gift = function*(next) { //送你
    this.component = yield Component.findOne({
        appid: config.wechat.component.appId
    }).exec();
    yield next;
};
