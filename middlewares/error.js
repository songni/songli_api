'use strict'

/*
 * @ref https://github.com/koajs/json-error
 * @ref https://github.com/syntagma/mongoose-error-helper
 */
//var util = require('util');
//var props = [
//  'message'
//]

//module.exports = function () {
//  return function* jsonErrorHandler(next) {
//    var status
//    try {
//      yield* next
//      status = this.response.status
//      if (!status || (status === 404 && this.response.body == null)) this.throw(404)
//    } catch (err) {
//      console.log('error',err);
//      var obj = this.response.body = {};    
//      if (err.name === 'ValidationError') {
//        obj.code = 3500;
//        var message = '';
//        Object.keys(err.errors).forEach(function (key) {
//            let error = err.errors[key];
//            message += error.message + ' ';
//        });
//        obj.message = message;
//      } if(err.status === 404){
//        obj.code = 4404;
//        obj.message = '找不着！';
//      } else {
//        obj.code = 5500;
//        Object.keys(err).forEach(function (key) {
//          if(key === 'message'){
//            obj[key] = err[key];
//          }
//        })
//      }
//      this.response.status = 200;
//    }
//  }
//}

var props = [
  'name',
  'message',
  'stack',
  'type',
]

module.exports = function () {
  return function* jsonErrorHandler(next) {
    var status
    try {
      yield* next
      status = this.response.status
      // future proof status
      if (!status || (status === 404 && this.response.body == null)) this.throw(404)
    } catch (err) {
      // set body
      var obj = this.response.body = {}

      // set status
      status = this.response.status = err.status = err.status || 500

      // set all properties of error onto the object
      Object.keys(err).forEach(function (key) {
        obj[key] = err[key]
      })
      props.forEach(function (key) {
        var value = err[key]
        if (value) obj[key] = value
      })

      // emit the error if we really care
      if (!err.expose && status >= 500) this.app.emit('error', err, this)
    }
  }
}
