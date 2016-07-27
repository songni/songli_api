'use strict';

var path = require('path'),
    wait = require('co-wait'),
    _ = require('lodash');

var env = process.env.NODE_ENV || 'development';
env = env.toLowerCase();

var all = {
    env: process.env.NODE_ENV,
    root: path.normalize(__dirname + '/../..'),
    port: 8262,
    secrets: {
        session: 'gift-secret'
    },
    userRoles: ['guest', 'worker', 'accountant', 'admin'],
    mongo: {
        options: {
            db: {
                safe: true
            }
        },
        replset: {
            readPreference: 'nearest',
            strategy: 'ping',
            rs_name: 'Chubby'
        }
    },
    redis: {
        host: '',
        port: '',
        pass: null
    },
    locals: {
        version: '0.0.1',
        now: function() {
            return new Date();
        },
        ip: function*() {
            yield wait(100);
            return this.ip;
        }
    },
    filters: {
        format: function(time) {
            return time.getFullYear() + '-' + (time.getMonth() + 1) + '-' + time.getDate();
        }
    },
    ignorePaths: [
        "/",
        "/token",
        "/document/*",
        "/wechat/component",
        '/wechat/component/callback',
        '/wechat/component/token',
        '/wechat/component/notice',
        '/wechat/component/auth',
        "/wechat/callback",
        "/wechat/pay/notify/gift",
        "/wechat/experience",
        "/merchant/login",
        "/api/wechat/sign/jssdk",
        "/api/wechat/client",
        "/api/wechat/token",
        "/api/wechat/experience",
        "/api/merchant",
        "/api/gift",
        "/api/gift/*",
        "/api/gift/order/*",
        "/gift/media",
        "/api/gift/order/list/s",
    ],
    corsOptions: {
        headers: ['Content-Type', 'Authorization', 'Accept', 'X-API-From', 'X-APPID', 'X-Component'],
        Origin: '*',
        methods: ['GET', 'PUT', 'POST', 'PATCH', 'DELETE']
    },
    bodyOptions: {
        multipart: true,
        formLimit: '10mb',
        formidable: {
            keepExtensions: true,
            maxFieldsSize: 1024 * 1024 * 5,
            onPart: function(part) {
                part.addListener('data', function() {
                    console.log('parting...');
                });
            }
        }
    },
    regulars: {
        telephone: new RegExp(/^1[34578][0-9][0-9]{8}$/i)
    },
    // 第三方平台的配置
    wechat: {
        component: {
            appId: ''
        }
    },
    // 微信菜单默认配置
    menu: {
        "wx4296ea2b775eb9bc": { //礼物
            "button": [{
                "type": "view",
                "name": "礼物列表",
                "url": "http://$APPID$.sn-client.arrking.com"
            }, {
                "type": "view",
                "name": "我送的礼物",
                "url": "http://$APPID$.sn-client.arrking.com/order/list"
            }]
        }
    },
    domain: {
        serve: "sn-serve.arrking.com",
        client: "sn-client.arrking.com",
        api: "sn-api.arrking.com",
        img: "sn-imgs.arrking.com",
        contact: "010-84988362"
    },
    newrelic: false
};
module.exports = _.merge(all, require('./' + env + '.js') || {});
