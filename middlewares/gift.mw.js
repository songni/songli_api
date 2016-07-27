'use strict';

var co = require('co'),
    root = '../',
    pathMd = root + 'models/',
    Gift = require(pathMd + 'gift.model'),
    GiftOrder = require(pathMd + 'gift.order.model'),
    Pubno = require(pathMd + 'wechat.component.public.model'),
    GiftOrderReceiver = require(pathMd + 'gift.order.receiver.model'),
    wechat = require(root + 'middlewares/wechat.mw'),
    wemsg = require(root + 'middlewares/wemsg.mw'),
    moment = require('moment'),
    request = require('request'),
    koarequest = require('koa-request'),
    config = require(root + 'config/environment'),
    fs = require('fs'),
    log = require('../services/logging').getLogger('gift.mw'),
    _ = require('lodash');

exports.orders = co.wrap(function*() {
    log.info('调出订单列表');
    var orders = yield GiftOrder.find({})
        .populate('sender')
        .populate('gift')
        .populate('pubno')
        .exec();
    var info = '';
    for (var i in orders) {
        var order = orders[i];
        this.generate_card(order).then(function(data) {
            log.info(data);
        }, function(err) {
            log.info(err);
        });
    }
    return info;
});
exports.generate_card = co.wrap(function*(order) {
    var wBox = 300;
    var hBox = 380;
    var QRCode = require('qrcode'),
        Canvas = require('canvas'),
        Image = Canvas.Image,
        canvas = new Canvas(wBox, hBox),
        ctx = canvas.getContext('2d');
    var url = 'http://' + order.pubno.appid + '.' + config.domain.client + '/order/' + order.id + '/listen?from=scan';
    QRCode.draw(url, function(err, qrcode) {
        var img = new Image();
        img.src = qrcode.toBuffer();
        ctx.drawImage(img, 10, 40, 280, 280);

        ctx.font = '16px "Microsoft YaHei",Impact, serif';
        var txt1 = '微信扫一扫,听' + order.sender.info.nickname + '对你说';
        var wTxt1 = ctx.measureText(txt1).width;
        var w1 = (wBox - wTxt1) / 2;
        ctx.fillText(txt1, w1, 40);
        var txt2 = '序列号：' + order.serial;
        var wTxt2 = ctx.measureText(txt2).width;
        var w2 = (wBox - wTxt2) / 2;
        ctx.fillText(txt2, w2, 330);

        var w = canvas.width;
        var h = canvas.height;
        var data = ctx.getImageData(0, 0, w, h);
        var compositeOperation = ctx.globalCompositeOperation;
        ctx.globalCompositeOperation = "destination-over";
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, w, h);

        var stream = canvas.pngStream();
        var dir = '/mnt/photo/images/gift/qrcode/' + moment(order.time.add).format('YYYY-M') + '/';
        require('mkdirp').sync(dir);
        var file = dir + order.serial + '.png'
        var out = require('fs').createWriteStream(file)
        stream.on('data', function(chunk) {
            out.write(chunk);
        });
        stream.on('end', function() {
            log.info('成功保存声音卡:' + file);
        });
    });
    return '生成礼物卡:' + order.serial;
});
exports.get_media = co.wrap(function*(id) {
    var order = yield GiftOrder.findById(id).populate('pubno').exec();
    var dir = '/mnt/photo/media/' + require('moment')(order.time.add).format('YYYY-M') + '/';
    var file = dir + order.serverId + '.amr';
    var data = yield wechat.media_upload(file, order.pubno, 'voice');
    return data;
});
//关注回复
exports.subscribe = co.wrap(function*(FromUserName, ToUserName, id, comid, pubno, username) {
    log.info('扫描语音卡返回语音');
    var pubno = yield Pubno.findById(pubno).exec();
    var reply = yield wechat.get_autoreply(pubno);
    var content = username + ',欢迎访问' + pubno.authorizer_info.nick_name + '!';
    if (reply && reply.add_friend_autoreply_info) { //reply.is_add_friend_reply_open === 1
        content = reply.add_friend_autoreply_info.content;
    }
    var data = {
        "touser": FromUserName
    };
    data.msgtype = 'text';
    data.text = {
        content: content
    };
    var reply = yield wemsg.send_custom(ToUserName, data, comid);
    var r = yield this.send_voice(FromUserName, ToUserName, id, comid);
    r.reply = reply;
    return r;
});
exports.send_voice = co.wrap(function*(FromUserName, ToUserName, id, comid) {
    // 扫二维码者的OpenId
    log.debug('from user', FromUserName);

    // 公众号的Id
    log.debug('to user', ToUserName);

    var data = {
        "touser": FromUserName
    };
    var order = yield GiftOrder.findById(id)
        .populate('sender')
        .populate('pubno')
        .populate('receivers')
        .exec();
    var name = order.sender.info && order.sender.info.nickname ? order.sender.info.nickname : '某人';
    data.msgtype = 'text';
    data.text = {
        content: name + "对你说:"
    };
    var text = yield wemsg.send_custom(ToUserName, data, comid);
    var dir = '/mnt/photo/media/' + require('moment')(order.time.add).format('YYYY-M') + '/';
    var file = dir + order.serverId + '.amr';
    var media = yield wechat.media_upload(file, order.pubno, 'voice');
    data.msgtype = 'voice';
    data.voice = {
        "media_id": media.media_id
    };
    var voice = yield wemsg.send_custom(ToUserName, data, comid);
    //发送阅读信息
    // if (order.status.read === false) {
    //     order.status.read = true;
    //     order.save(function(err) {
    //         if (err) log.error(err);
    //     });
    //     var msg = yield wemsg.gift_read(order);
    //     log.info('wemsg.gift_read', msg);
    // }

    // 验证是一送一还是一送多
    if (order.capacity == 1) {
        // 如果receiver.read = true, 就不再提示了
        // 一送一有可能是送礼者自己填的name, phone 和 address 
        // GiftOrderReceier 就不会有OpenId
        // 所以，不能通过验证OpenId 来证明究竟是不是收礼者扫描了
        // 这是一个漏洞!!
        if (!order.receivers[0].status.read) {
            let receiver = yield GiftOrderReceiver.findById(order.receivers[0].id).exec();
            receiver.status.read = true;
            receiver.status.read_date = new Date();

            yield receiver.save(function(err) {
                if (err) {
                    log.error('can not save receiver', err);
                }
            });

            // #TODO https://github.com/arrking/songni/issues/112
            // 向送礼者发布状态
            let msg = yield wemsg.gift_read(order);
            // yield wemsg.gift_read(order);
            log.info('wemsg.gift_read', msg);
        }
    } else {
        // 检查OpenId 是不是在收礼者的数组里
        let receiver = null;
        _.some(order.receivers, function(val, index) {
            if (val.userOpenId === FromUserName) {
                receiver = val;
                return true;
            } else {
                return false;
            }
        });
        // 是收礼者而且read 的状态是false
        if (receiver && (receiver.status.read === false)) {
            let receiver2 = yield GiftOrderReceiver.findById(receiver.id).exec();
            receiver2.status.read = true;
            receiver2.status.read_date = new Date();
            yield receiver2.save(function(err) {
                if (err) {
                    log.error('can not save receiver', err);
                }
            });
            // 通知送礼者
            // #TODO https://github.com/arrking/songni/issues/112
            // 向送礼者发布状态
            let msg = yield wemsg.gift_read(order, receiver2);
            log.info('wemsg.gift_read', msg);
        }
    }

    return {
        text: text,
        voice: voice
    };
});
exports.get_to_me = co.wrap(function*(user) {
    var order = yield GiftOrder.findOne({
        reader: user,
        'status.pushed': false
    }).populate('pubno').exec();
    if (!order) return {
        errcode: '9404',
        errmsg: '暂无新礼物'
    };
    order.status.pushed = true;
    order.save(function(err) {
        if (err) log.error('order.status.pushed_error:', err);
    });
    var dir = '/mnt/photo/media/' + require('moment')(order.time.add).format('YYYY-M') + '/';
    var file = dir + order.serverId + '.amr';
    var data = yield wechat.media_upload(file, order.pubno, 'voice');
    return data;
});
//生成微信二维码
exports.qrcode_url = co.wrap(function*(id, pubno) {
    log.info('获取订单二维码');
    var qrcode = yield wechat.qrcode_permanent_str('gift_' + id, pubno);
    if (qrcode.errcode) {
        log.error('qrcode.error', qrcode);
        return 'http://' + pubno.appid + '.' + config.domain.client + '/order/' + id + '/listen?from=scan';
    };
    var long_url = 'https://mp.weixin.qq.com/cgi-bin/showqrcode?ticket=' + qrcode.response.ticket;
    return long_url;
});
exports.orders_wx = co.wrap(function*() {
    log.info('调出订单列表');
    var sleep = require('sleep');
    var orders = yield GiftOrder.find({})
        .populate('sender')
        .populate('gift')
        .populate('pubno')
        .exec();
    var info = '';
    for (var i in orders) {
        var order = orders[i];
        yield this.generate_card_wx(order).then(function(data) {
            log.info(data);
        }, function(err) {
            log.info(err);
        });
    }
    return info;
});
exports.order_wx = co.wrap(function*(order) {
    var order = yield GiftOrder.findById(order)
        .populate('sender')
        .populate('pubno')
        .exec();
    this.generate_card_wx(order).then(function(data) {
        log.info(data);
    }, function(err) {
        log.info(err);
    });
});
exports.generate_card_wx = co.wrap(function*(order) {
    var wBox = 380;
    var hBox = 380;
    var Canvas = require('canvas'),
        Image = Canvas.Image,
        canvas = new Canvas(wBox, hBox),
        ctx = canvas.getContext('2d');

    var dir = '/mnt/photo/images/gift/qrcode/' + moment(order.time.add).format('YYYY-M') + '/';
    require('mkdirp').sync(dir);

    var qrcode = yield wechat.qrcode_permanent_str('gift_' + order.id, order.pubno);
    if (qrcode.errcode) {
        log.error(qrcode);
        return qrcode;
    }
    var qrcode_url = 'https://mp.weixin.qq.com/cgi-bin/showqrcode?ticket=' + qrcode.response.ticket;
    var qrcode_image = dir + order.serial + '_qrcode.jpg';

    request.get(qrcode_url)
        .pipe(fs.createWriteStream(qrcode_image))
        .on('close', function() {
            fs.readFile(qrcode_image, function(err, squid) {
                if (err) throw err;
                let img = new Image;
                img.src = squid;
                ctx.drawImage(img, 50, 80, 280, 280);
                if (order.capacity == 1) {
                    ctx.font = '22px "Microsoft YaHei",Impact, serif';
                    var txt0 = '亲爱的' + order.receivers[0].name;
                    var wTxt0 = ctx.measureText(txt0).width;
                    var w0 = (wBox - wTxt0) / 2;
                    ctx.fillText(txt0, w0, 40);
                }

                var name = order.sender.info && order.sender.info.nickname ? order.sender.info.nickname.substring(0, 10) : '某人';
                ctx.font = '15px "Microsoft YaHei",Impact, serif';
                var txt1 = '除了这份礼物,' + name + '还有些话想对你说';
                var wTxt1 = ctx.measureText(txt1).width;
                var w1 = (wBox - wTxt1) / 2;
                ctx.fillText(txt1, w1, 70);
                var txt10 = '扫码关注公众号即可听到～';
                var wTxt10 = ctx.measureText(txt10).width;
                var w10 = (wBox - wTxt10) / 2;
                ctx.fillText(txt10, w10, 88);


                ctx.font = '14px "Microsoft YaHei",Impact, serif';
                var txt2 = '序列号：' + order.serial;
                var wTxt2 = ctx.measureText(txt2).width;
                var w2 = (wBox - wTxt2) / 2;
                ctx.fillText(txt2, w2, 370);

                var w = canvas.width;
                var h = canvas.height;
                var data = ctx.getImageData(0, 0, w, h);
                var compositeOperation = ctx.globalCompositeOperation;
                ctx.globalCompositeOperation = "destination-over";
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, w, h);

                var stream = canvas.pngStream();
                var file = dir + order.serial + '_wx.png';
                var out = require('fs').createWriteStream(file);
                stream.on('data', function(chunk) {
                    out.write(chunk);
                });
                stream.on('end', function() {
                    log.info('成功保存声音卡:' + file);
                });
            });
        });
    return '生成礼物卡:' + order.serial;
});
