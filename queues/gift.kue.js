'use strict';

let log = require('bunyan').createLogger({name: 'crontabs'})
  , co = require('co')
  , moment = require('moment')
  , root = '../'
  , pathMd = root+'models/'
  , Order = require(pathMd+'gift.order.model')
  , pathMw = root+'middlewares/'
  , wemsg = require(pathMw+'wemsg.mw')
  ;
  
//生成订单id
exports.generate_serial = co.wrap(function*(id){
  let start = moment().startOf('day');
  let end = moment().endOf('day');
  let condition = {'time.add': {$gte: start, $lt: end}};
  let order = yield Order.findOne(condition).sort({serial:-1}).exec();
  let serial = moment().format('YYYYMMDD')*10000;
  if(order&&order.serial){
    serial = order.serial;
  }
  order = yield Order.findById(id).exec();
  if(!order.serial){
    order.serial = serial+1;
    yield order.save(function(err){if(err) console.log(err);});
  }
  return order;
});
