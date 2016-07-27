'use strict';

var env = process.env.NODE_ENV
  , co = require('co')
  , config = require('../config/environment')
  , kue = require('kue')
  , defer = require('co-defer')
  , jobs = kue.createQueue({
              prefix: 'songni',
              redis: {
                port: config.redis.port,
                host: config.redis.host,
                auth: config.redis.pass,
                db: 9,
                options: {}
              }
            });

var pre = "[创建任务]：";

exports.api_component_token = co.wrap(function*(){
  var title = '获取微信第三方组件令牌';
  console.log(env);
  var job = jobs.create('component_token_'+env, {title: title})
                .removeOnComplete( true )
                .save( function(err){
                   if( err ) console.error(pre+title + ':错误:', err.stack);
                   else console.log(pre+title, job.id );
                });
  return job;
});

exports.deal_wemsg_failure = co.wrap(function*(){
  var title = '处理失败消息';
  var job = jobs.create('deal_wemsg_failure_'+env, {title: title})
                .removeOnComplete( true )
                .save( function(err){
                   if( err ) console.error(pre+title+':错误:',err.stack);
                   else console.log(pre+title, job.id );
                });
  return job;
});

