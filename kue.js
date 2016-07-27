'use strict';

var env = process.env.NODE_ENV,
    kue = require('kue'),
    config = require('./config/environment'),
    jobs = kue.createQueue({
        prefix: 'songni',
        redis: {
            host: config.redis.host,
            port: config.redis.port,
            auth: config.redis.pass,
            db: 9,
            options: {}
        }
    }),
    wechat = require('./queues/wechat.kue'),
    mongoose = require('mongoose'),
    log = require('./services/logging').getLogger('kue');

mongoose.connect(config.mongo.uris, config.mongo.options);
let conn = mongoose.connection;
conn.on('connected', function() {
    log.info('[MonoDB]:连接');
});
conn.once('open', function() {
    log.info('[MonoDB]:打开');
});
conn.on('disconnected', function() {
    log.warn('[MonoDB]:断开');
});
conn.on('reconnected', function() {
    log.info('[MonoDB]:重连');
});
conn.on('error', function(err) {
    log.error(err);
});

jobs.process('component_token_' + env, wechat.api_component_token);
jobs.process('deal_wemsg_failure_' + env, wechat.deal_wemsg_failure);
jobs.promote();
