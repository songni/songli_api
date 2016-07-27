'use strict'
/*
 * @ref https://github.com/jchannon/koa-statelessauth
 * @author:Nosy
 */
var minimatch = require('minimatch'),
    mdPath = '../models/',
    mdToken = require(mdPath + 'token.model'),
    mdPubno = require(mdPath + 'wechat.component.public.model'),
    Component = require(mdPath + 'component.model'),
    mongoose = require('mongoose'),
    ObjectID = mongoose.Types.ObjectId,
    _ = require('lodash'),
    pmx = require('pmx'),
    root = '../',
    config = require(root + 'config/environment'),
    log = require('../services/logging').getLogger('middlewares/auth');

module.exports = function(ignorePaths) {
    return function*(next) {
        let token = this.get("Authorization");
        this.from = this.get("X-API-From");
        this.appid = this.get("X-APPID");
        let component_id = this.get("X-Component");
        let origin = this.header.origin;

        //todo remove
        console.warn(`[control-flow]: enter auth middleware`);
        console.warn(`path: ${this.path}`);
        console.warn(`origin: ${origin}`)
        console.warn(`from: ${this.from}`)
        console.warn(`component id: ${component_id}`)

        if (origin) log.info('[' + this.from + ']:', origin);
        else log.info('[异步]: ', this.header['x-real-ip'], this.path);

        let arrSync = [
            '/wechat/pay/notify/gift',
            '/gift/media',
        ];
        //调用来源
        let arrFrom = ['merchant', 'client'];
        //组件验证
        let arrObj = ['merchant', 'client']; //测试暂时关闭
        if (!_.includes(arrSync, this.path)) {
            if (this.from === 'client') {
                if (!origin) {
                    this.status = 406;
                    this.body = {
                        errmsg: '第三方原点错误！'
                    };
                    log.error(this.body);
                    return;
                } else {
                    let pat = /(?!(w+)\.)\w*(?:\w+\.)+\w+/gm;
                    let match = origin.match(pat);
                    let origins = match[0].split('.');
                    this.appid = origins[0]
                }
            }
            if (!_.includes(arrFrom, this.from)) {
                this.status = 401;
                this.body = {
                    errcode: config.domain.api,
                    errmsg: config.domain.contact
                };
                pmx.emit('api:from', {
                    header: this.header,
                    body: this.body,
                    from: this.from
                });
                return;
            }
            if (_.includes(arrObj, this.from)) {

                if (!ObjectID.isValid(component_id)) {
                    this.status = 406;
                    this.body = {
                        errcode: 9404,
                        errmsg: '第三方id错误！',
                        comid: component_id
                    };
                    log.error(this.body);
                    return;
                }
                let component = yield Component.findById(component_id).exec();

                //todo remove
                console.warn(`component: ${require('util').inspect(component)}`);

                if (!component) {
                    this.status = 404;
                    this.body = {
                        errcode: 9404,
                        errmsg: '第三方不存在！',
                        comid: component_id
                    };
                    log.error(this.body);
                    return;
                }
                this.component = component;
            }
        } else {
            //log.info('[异步]: ',this.path);
        }

        this.pubno = '';
        //todo remove
        console.warn(`appid: ${this.appid}`);
        console.warn(`token: ${this.token}`);
        if (this.appid && !this.token) {
            let pubno = yield mdPubno.findOne({
                appid: this.appid,
                component_appid: this.component.appid
            }).exec();
            if (!pubno) {
                this.status = 406;
                this.body = {
                    errcode: 9404,
                    errmsg: '公号不存在！',
                    appid: this.appid,
                    comid: component_id,
                    path: this.path
                };
                log.error(JSON.stringify(this.body));
                if (this.path === '/wechat/callback') {
                    this.body = "";
                }
                return;
            }
            this.pubno = pubno;
        }
        if (token && ObjectID.isValid(token)) {
            var tbToken = yield mdToken.findById(token)
                .populate('user')
                .populate('pubno')
                .exec();
            if (!tbToken) {
                this.status = 205;
                this.body = {
                    errmsg: 'F5刷新重新加载本地内容！'
                };
                log.error(this.body);
                return;
            }
            if (this.from === 'merchant' && tbToken.pubno) {
                this.pubno = tbToken.pubno;
            }
            if (this.from === 'client' && tbToken.user) {
                this.user = tbToken.user;
            }
        }
        if (this.pubno) {
            let info = this.pubno.authorizer_info;
            if (info) {
                log.info('[' + this.component.name + ']: ', info.nick_name, this.pubno.appid, '(' + this.pubno.id + ')');
                yield mdPubno.findByIdAndUpdate(this.pubno, {
                    $inc: {
                        'num.access': 1
                    }
                });
            }
            if (this.from === 'client') {
                if (this.pubno.status && this.pubno.status.verify !== true) {
                    this.status = 406;
                    this.body = {
                        errcode: 9401,
                        errmsg: info.nick_name + '尚未通过审核，请联系送你客服：010-84988362 '
                    };
                    log.error(this.body);
                    return;
                }
            }
        }
        var path = this.path;
        if (ignorePaths) {
            let ignorePathMatched = false;
            ignorePaths.some(function(element) {
                var match = minimatch(path, element);
                if (match) {
                    ignorePathMatched = true;
                    return true;
                }
                return false;
            });
            console.warn(`ignore: ${ignorePathMatched}`);
            if (ignorePathMatched) {
                yield next;
                return;
            }
        }

        if (_.isEmpty(token)) {
            this.status = 401;
            this.body = {
                errmsg: '请登录后再访问！'
            };
            return;
        }
        if (!ObjectID.isValid(token)) {
            this.status = 401;
            this.body = {
                errmsg: '1.请登录后再访问！'
            };
            return;
        }
        if (!tbToken) {
            this.status = 401;
            this.body = {
                errmsg: '2.请登录后再访问！'
            };
            return;
        }
        if (this.from === 'merchant') {
            if (!this.pubno) {
                this.status = 404;
                this.body = {
                    errmsg: '找不到公号信息！'
                };
                return;
            }
        };
        if (this.from === 'client' && !tbToken.user) {
            this.status = 404;
            this.body = {
                errcode: 9404,
                errmsg: '找不到用户信息！',
                from: this.from,
                path: this.path,
                token: tbToken.id
            };
            log.error(this.body);
            return;
        }
        tbToken.expires = Date.now();
        tbToken.save();
        this.token = tbToken;
        yield next;
    }
};
