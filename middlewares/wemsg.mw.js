'use strict';

var moment = require('moment'),
    co = require('co'),
    assert = require('assert')
    // , mongoose = require('mongoose')
    ,
    _ = require('lodash'),
    request = require('koa-request'),
    root = '../',
    pathMd = root + 'models/',
    Pubno = require(pathMd + "wechat.component.public.model"),
    WechatTemp = require(pathMd + "wechat.temp.model"),
    Wemsg = require(pathMd + "wemsg.model"),
    config = require('../config/environment'),
    wecom = require('./wecom.mw'),
    datetime = require('./datetime'),
    options_component = {
        baseUrl: 'https://api.weixin.qq.com/cgi-bin/component/',
        method: 'POST',
        json: true
    },
    log = require('../services/logging').getLogger('wemsg.mw');

//发送模板消息
exports.send = co.wrap(function*(pubno, body, comid, retry) {
    let token = yield wecom.get_token_by_username(pubno, comid);
    if (token && token.errcode) return token;
    let options = {
        baseUrl: 'https://api.weixin.qq.com/cgi-bin/',
        uri: 'message/template/send',
        method: 'POST',
        json: true,
        qs: {
            access_token: token
        },
        body: body
    };
    let response = yield request(options);
    let ret = response.body;
    if (retry) return ret; // 重试不保存
    if (!ret) ret = {
        msgid: 0,
        errcode: 9404,
        errmsg: '无法调用发消息api'
    };
    let wemsg = new Wemsg({
        msgid: ret.msgid,
        errcode: ret.errcode,
        errmsg: ret.errmsg,
        content: body,
        pubno: pubno,
        component: comid
    });
    yield wemsg.save(function(err) {
        if (err) log.error('保存发送模板消息', err);
    });
    return wemsg;
});
//发送失败消息，对于未关注用户，如何优化处理？？？
exports.send_failure = co.wrap(function*(pubno) {
    //log.info('发送失败消息公号:',pubno);
    let condition = {
        errcode: {
            $gt: 0
        }
    };
    if (pubno) condition.pubno = pubno;
    let wemsgs = yield Wemsg.find(condition).exec();
    var rtmsg = {
        name: '处理失败消息',
        msg: []
    };
    for (let i in wemsgs) {
        let wemsg = wemsgs[i];
        let ret = yield this.send(wemsg.pubno, wemsg.content, wemsg.component, true);
        rtmsg.msg.push(ret);
        wemsg.errcode = 0;
        yield wemsg.save(function(err) {
            if (err) log.error('wemsg_save_errcode', err);
        });
    }
    return rtmsg;
});
//获取模板id
exports.api_add_template = co.wrap(function*(pubno, template_id_short) {
    let temp = yield WechatTemp.findOne({
        template_id_short: template_id_short,
        pubno: pubno.id
    }).exec();
    if (temp) return temp.template_id;
    let token = yield wecom.get_token_by_username(
        pubno.authorizer_info.user_name,
        pubno.component_appid
    );
    if (token.errcode) return token;
    let options = {
        uri: 'https://api.weixin.qq.com/cgi-bin/template/api_add_template',
        method: 'POST',
        json: true,
        qs: {
            access_token: token
        },
        body: {
            template_id_short: template_id_short
        }
    };
    let response = yield request(options);
    let body = response.body;
    if (body.errcode) {
        body.name = "获取模板id错误";
        return body;
    }
    temp = new WechatTemp({
        template_id_short: template_id_short,
        template_id: body.template_id,
        pubno: pubno.id
    });
    yield temp.save();
    return temp.template_id;
});
exports.send_custom = co.wrap(function*(UserName, body, comid) {
    let token = yield wecom.get_token_by_username(UserName, comid);
    log.info('发送客服消息消息', token);
    if (token.errcode) return token;
    let options = {
        uri: 'https://api.weixin.qq.com/cgi-bin/message/custom/send',
        method: 'POST',
        json: true,
        qs: {
            access_token: token
        },
        body: body
    };
    let response = yield request(options);
    return response.body;
});
exports.cstm_issue = co.wrap(function*(FromUserName, ToUserName, query_auth_code, comid) {
    let data = {
        "touser": FromUserName,
        "msgtype": "text",
        "text": {
            "content": query_auth_code + '_from_api'
        }
    }
    return yield this.send_custom(ToUserName, data, comid);
});
exports.gift = co.wrap(function*(order) {
    log.info('购买礼品通知');
    let gift = order.gift;
    let template_id = yield this.api_add_template(order.pubno, 'TM00976');
    if (template_id.errcode) return template_id;

    // 一送多，链接到礼单
    let url = "http://" + order.pubno.appid + "." + config.domain.client + "/order/" + order.id + "/fillin";
    if (order.capacity === 1) {
        // 一送一，到订单
        url = "http://" + order.pubno.appid + "." + config.domain.client + "/order/" + order.id + "/info";
    }
    let body = {
        "touser": order.sender.openid,
        "template_id": template_id,
        "url": url,
        "topcolor": "#FF0000",
        "data": {
            "first": {
                "value": "你已成功购买礼品",
                "color": "#173177"
            },
            "keyword1": { //商品名称
                "value": gift.info.name,
                "color": "#173177"
            },
            "keyword2": { //消费金额
                "value": gift.info.price * order.capacity,
                "color": "#173177"
            },
            "keyword3": { //购买时间
                "value": moment(order.time.pay).format('YY年M月D号 HH:mm'),
                "color": "#173177"
            },
            "remark": {
                "value": "点击详情开始给你的朋友送礼吧！",
                "color": "#173177"
            }
        }
    };
    return yield this.send(
        order.pubno.authorizer_info.user_name,
        body,
        order.pubno.component_appid
    );
});
exports.voice = co.wrap(function*(FromUserName, ToUserName, media_id, comid) {
    var data = {
        "touser": FromUserName,
        "msgtype": "voice",
        "voice": {
            "media_id": media_id
        }
    }
    return yield this.send_custom(ToUserName, data, comid);
});
exports.gift_read = co.wrap(function*(order, receiver) {
    log.info('礼物阅读通知');
    let gift = order.gift;
    let template_id = yield this.api_add_template(order.pubno, 'OPENTM202182343');
    if (template_id.errcode) return template_id;
    let body = {
        "touser": order.sender.openid,
        "template_id": template_id,
        "url": "http://" + order.pubno.appid + "." + config.domain.client + "/order/" + order.id + "/info",
        "topcolor": "#FF0000",
        "data": {
            "first": {
                "value": receiver.consignee + "已经拆开礼物，正在听你对Ta说", //+gift.info.name,
                "color": "#173177"
            },
            "keyword1": { //签收人
                "value": receiver.consignee,
                "color": "#173177"
            },
            "keyword2": { //签收时间
                "value": moment().format('YY年M月D号 HH:mm'),
                "color": "#173177"
            },
            "remark": {
                "value": "",
                "color": "#173177"
            }
        }
    };
    return yield this.send(
        order.pubno.authorizer_info.user_name,
        body,
        order.pubno.component_appid
    );
});

/**
 * 收礼人取得礼物的通知，给送礼人
 * @param {[type]} order         [description]
 * @param {[type]} express       [description]
 * @param {[type]} receiver)     {               let gift [description]
 * @yield {[type]} [description]
 */
exports.gift_express_fillin = co.wrap(function*(order, receiver) {
    let gift = order.gift;
    let template_id = yield this.api_add_template(order.pubno, 'TM00251');
    if (template_id.errcode) return template_id;
    // 一送多，链接到礼单
    let url = "http://" + order.pubno.appid + "." + config.domain.client + "/order/" + order.id + "/fillin";
    if (order.capacity === 1) {
        // 一送一，到订单
        url = "http://" + order.pubno.appid + "." + config.domain.client + "/order/" + order.id + "/go";
    }
    let body = {
        "touser": order.sender.openid,
        "template_id": template_id,
        "url": url,
        "topcolor": "#FF0000",
        "data": {
            "first": {
                "value": "你的礼物已被领取",
                "color": "#173177"
            },
            "toName": {
                "value": receiver.consignee,
                "color": "#173177"
            },
            "gift": {
                "value": gift.info.name,
                "color": "#173177"
            },
            "time": {
                "value": moment(receiver.fillinDate).format("YYYY-MM-DD HH:mm"),
                "color": "#173177"
            }
            // ,
            // "remark": {
            //     "value": "感谢惠顾！",
            // }
        }
    };
    return yield this.send(
        order.pubno.authorizer_info.user_name,
        body,
        order.pubno.component_appid
    );
});

/**
 * 发货通知，给送礼人
 * @param {[type]} order         [description]
 * @param {[type]} express       [description]
 * @param {[type]} receiver)     {               let gift [description]
 * @yield {[type]} [description]
 */
exports.gift_express_sender = co.wrap(function*(order, express, receiver) {
    let gift = order.gift;
    let expcom = express.company.name;
    let expno = express.no;
    let template_id = yield this.api_add_template(order.pubno, 'OPENTM200565259');
    if (template_id.errcode) return template_id;
    let body = {
        "touser": order.sender.openid,
        "template_id": template_id,
        'url': 'http://m.kuaidi100.com/index_all.html?type=' + expcom + '&postid=' + expno,
        "topcolor": "#FF0000",
        "data": {
            "first": {
                "value": "你的订单[" + gift.info.name + "]已发货给" + receiver.consignee + "！请注意查收",
                "color": "#173177"
            },
            "keyword1": {
                "value": order.id,
                "color": "#173177"
            },
            "keyword2": {
                "value": expcom,
                "color": "#173177"
            },
            "keyword3": {
                "value": expno,
                "color": "#173177"
            }
            // ,
            // "remark": {
            //     "value": "感谢惠顾！",
            // }
        }
    };
    return yield this.send(
        order.pubno.authorizer_info.user_name,
        body,
        order.pubno.component_appid
    );
});

/**
 * 发货通知，给收礼人
 * @param {[type]} order         [description]
 * @param {[type]} express       [description]
 * @param {[type]} receiver)     {               let gift [description]
 * @yield {[type]} [description]
 */
exports.gift_express_receiver = co.wrap(function*(order, express, receiver) {
    let gift = order.gift;
    let expcom = express.company.name;
    let expno = express.no;
    let template_id = yield this.api_add_template(order.pubno, 'OPENTM200565259');
    if (template_id.errcode) return template_id;
    let body = {
        "touser": receiver.userOpenId,
        "template_id": template_id,
        'url': 'http://m.kuaidi100.com/index_all.html?type=' + expcom + '&postid=' + expno,
        "topcolor": "#FF0000",
        "data": {
            "first": {
                "value": "你的订单[" + gift.info.name + "]已发货！请注意查收",
                "color": "#173177"
            },
            "keyword1": {
                "value": order.id,
                "color": "#173177"
            },
            "keyword2": {
                "value": expcom,
                "color": "#173177"
            },
            "keyword3": {
                "value": expno,
                "color": "#173177"
            }
            // ,
            // "remark": {
            //     "value": "感谢惠顾！",
            // }
        }
    };
    return yield this.send(
        order.pubno.authorizer_info.user_name,
        body,
        order.pubno.component_appid
    );
});
