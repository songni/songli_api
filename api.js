'use strict';
/**
 * to monitor  mongodb, redis, make sure require('newrelic'); 
 * is the first line of the application's main module.
 */
var config = require('./config/environment');

if (config.newrelic) {
    require('newrelic');
}

process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.NODE_DEBUG = false;


var app = require('koa')(),
    logger = require('bunyan').createLogger({
        name: 'songni',
        level: 'debug'
    }),
    koaBunyanLogger = require('koa-bunyan-logger'),
    morgan = require('koa-morgan'),
    cors = require('koa-cors'),
    router = require('koa-router'),
    mount = require('koa-mount'),
    session = require('koa-generic-session'),
    database = require('./services/database'),
    redisStore = require('koa-redis'),
    logging = require('./services/logging'),
    log = logging.getLogger('api');


var pmx = require('pmx');
pmx.init({
    http: true
});
var probe = pmx.probe();
var meter = probe.meter({
    name: 'req/min',
    samples: 60,
    timeframe: 300
});
meter.mark();



app.proxy = true;

app.use(koaBunyanLogger(logger));
app.use(morgan.middleware('short'));

require('koa-onerror')(app, {
    json: function(err) {
        log.error(err);
        this.status = err.status;
        this.body = {
            errmsg: 'Something Error！'
        };
        require('pmx').notify(err);
    }
});



app.use(session({
    store: redisStore({
        port: config.redis.port,
        host: config.redis.host,
        db: 7,
        pass: config.redis.pass
    })
}));
app.use(cors(config.corsOptions));
app.use(require('koa-body')(config.bodyOptions));
app.use(require('./middlewares/auth')(config.ignorePaths));
var pathRt = './routers/';

app.use(mount('/', require(pathRt + 'main')(router).middleware()));
app.use(mount('/wechat', require(pathRt + 'wechat.router')(router).middleware()));
app.use(mount('/merchant', require(pathRt + 'merchant.router')(router).middleware()));
app.use(mount('/user', require(pathRt + 'user.router')(router).middleware()));
app.use(mount('/gift', require(pathRt + 'gift.router')(router).middleware()));
app.use(mount('/album', require(pathRt + 'album.router')(router).middleware()));
app.use(mount('/exp', require(pathRt + 'exp.router')(router).middleware()));

app.use(mount('/api/wechat', require(pathRt + 'wechat.api.router')(router).middleware()));
app.use(mount('/api/user', require(pathRt + 'user.api.router')(router).middleware()));
app.use(mount('/api/merchant', require(pathRt + 'merchant.api.router')(router).middleware()));
app.use(mount('/api/gift', require(pathRt + 'gift.api.router')(router).middleware()));
app.use(mount('/api/exp', require(pathRt + 'exp.api.router')(router).middleware()));

app.listen(config.port, function(err) {
    console.log("API is listenning to " + config.port);
});

app.on('error', function(err) {
    log.error('server error', err);
});

process.on('SIGTERM', function() {
    log.error('oops, server is down with SIGTERM.');
});

process.on('uncaughtException', function(err) {
    console.log('Unexpected exception: ' + err);
    console.log('Unexpected exception stack: ' + err.stack);
});

require('request').debug = false;
