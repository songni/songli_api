'use strict'

let moment = require('moment');

exports.diff = function (end){
  var now = moment();
  var end = moment(end);
  if (now.isSame(end)) {
      return '当前';
  }
  if (now.isAfter(end)) {
      var tmp = now;
      now = end;
      end = tmp;
  }
  var yDiff = end.year() - now.year();
  var mDiff = end.month() - now.month();
  var dDiff = end.date() - now.date();
  var hourDiff = end.hour() - now.hour();
  var minDiff = end.minute() - now.minute();
  var secDiff = end.second() - now.second();

  if (secDiff < 0) {
      secDiff = 60 + secDiff;
      minDiff--;
  }
  if (minDiff < 0) {
      minDiff = 60 + minDiff;
      hourDiff--;
  }
  if (hourDiff < 0) {
      hourDiff = 24 + hourDiff;
      dDiff--;
  }
  if (dDiff < 0) {
      var daysInLastFullMonth = moment(end.year() + '-' + (end.month() + 1), "YYYY-MM").subtract(1,'months').daysInMonth();
      if (daysInLastFullMonth < now.date()) { // 31/01 -> 2/03
          dDiff = daysInLastFullMonth + dDiff + (now.date() - daysInLastFullMonth);
      } else {
          dDiff = daysInLastFullMonth + dDiff;
      }
      mDiff--;
  }
  if (mDiff < 0) {
      mDiff = 12 + mDiff;
      yDiff--;
  }
  var result = [];
  if (yDiff) {
      result.push(yDiff+'年');
  }
  if (mDiff) {
      result.push(mDiff, '月');
  }
  if (dDiff) {
      result.push(dDiff, '天');
  }
  if (hourDiff) {
      result.push(hourDiff, '小时');
  }
  if (minDiff) {
      result.push(minDiff, '分钟');
  }
  /*
  if (secDiff) {
      result.push(secDiff, '秒');
  }
  */

  return result.join('');
};
