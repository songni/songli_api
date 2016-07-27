'use strict';

var wecom = require('../middlewares/wecom.mw'),
    wemsg = require('../middlewares/wemsg.mw'),
    log = require('../services/logging').getLogger('crontabs');

exports.api_component_token = function(job, done) {
    wecom.api_component_tokens().then(function(result) {
        log.info({
            request: result
        }, '获取微信第三方访问令牌：component_access_token：');
        done(null, result);
    }, function(err) {
        log.error({
            message: err.stack
        }, '获取微信第三方访问令牌：component_access_token：错误内容');
        done(err);
    });
};

exports.deal_wemsg_failure = function(job, done) {
    wemsg.send_failure().then(function(result) {
        log.info({
            request: result
        }, '处理失败消息');
        done(null, result);
    }, function(err) {
        log.error({
            message: err.stack
        }, '处理失败消息');
        done(err);
    });
};
