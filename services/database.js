'use strict';
/**
 * database management
 * 
 */

var mongoose = require('mongoose'),
    log = require('./logging').getLogger('database'),
    config = require('../config/environment');

// 链接数据库
mongoose.connect(config.mongo.uris, config.mongo.options);
let conn = mongoose.connection;
conn.on('connected', function() {
    log.info('[MonoDB]:连接');
});
conn.once('open', function() {
    log.info('[MonoDB]:打开'); /*global.gfs = Grid(conn.db);*/
});
conn.on('error', function(err) {
    log.error(err);
});
conn.on('disconnected', function() {
    log.warn('[MonoDB]:断开');
});
conn.on('reconnected', function() {
    log.info('[MonoDB]:重连');
});
process.on('SIGINT', function() {
    conn.close(function() {
        log.info('[MonoDB]:APP中断');
        process.exit(0);
    });
});

exports = module.exports = conn;
