'use strict';

module.exports = {
    api: {
        url: 'http://sn-api.arrking.com'
    },
    mongo: {
        uris: 'mongodb://localhost:27017/foo'
    },
    redis: {
        host: 'localhost',
        port: 6399,
        pass: ''
    },
    // 第三方平台的配置
    wechat: {
        component: {
            appId: 'wx4296ea2b775eb9bc'
        }
    },
    log4jsPath: '/tmp/logs',
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
    newrelic: true
};
