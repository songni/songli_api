'use strict';

var moment = require('moment'),
    co = require('co'),
    assert = require('assert')
    // , mongoose = require('mongoose')
    ,
    fs = require('fs'),
    _ = require('lodash'),
    request = require('koa-request'),
    root = '../',
    pathMd = root + 'models/',
    Pubno = require(pathMd + 'wechat.component.public.model'),
    Component = require(pathMd + 'component.model'),
    Weip = require(pathMd + "wechat.ip.model"),
    WeMenu = require(pathMd + "wechat.menu.model"),
    AutoReply = require(pathMd + "wechat.autoreply.model"),
    User = require(pathMd + "user.model"),
    Media = require(pathMd + "media.model"),
    Qrcode = require(pathMd + "qrcode.model"),
    Gift = require(pathMd + "gift.model"),
    GiftOrder = require(pathMd + "gift.order.model"),
    config = require('../config/environment'),
    wecom = require('./wecom.mw'),
    log = require('../services/logging').getLogger('wechat.mw');

exports.getcallbackip = co.wrap(function*() {
    let token = yield wecom.api_authorizer_token(pubno);
    if (token.errcode) return token;
    let options = {
        uri: 'https://api.weixin.qq.com/cgi-bin/getcallbackip',
        method: 'GET',
        json: true,
        qs: {
            access_token: token
        }
    };
    let response = yield request(options);
    let body = response.body;
    if (body.errcode) return body;
    let weip = new Weip({
        ip_list: body.ip_list
    });
    yield weip.save();
    return body;
});
exports.qrcode_create = co.wrap(function*(data, pubno) {
    let token = yield wecom.api_authorizer_token(pubno);
    if (token.errcode) return token;
    let options = {
        uri: 'https://api.weixin.qq.com/cgi-bin/qrcode/create',
        method: 'POST',
        json: true,
        qs: {
            access_token: token
        },
        body: data
    };
    let response = yield request(options);
    let body = response.body;
    return body;
});
exports.qrcode_save = co.wrap(function*(request, response, pubno) {
    let condition = {
        pubno: pubno,
        'request.action_name': request.action_name
    };
    if (request.action_info.scene.scene_id)
        condition['request.action_info.scene.scene_id'] = request.action_info.scene.scene_id;
    if (request.action_info.scene.scene_str)
        condition['request.action_info.scene.scene_str'] = request.action_info.scene.scene_str;
    let qrcode = yield Qrcode.findOne(condition).exec();
    if (qrcode) return qrcode;
    qrcode = new Qrcode();
    qrcode.request = request;
    qrcode.response = response;
    qrcode.pubno = pubno;
    yield qrcode.save(function(err) {
        log.error({
            code: 1,
            err: err
        });
    });
    return qrcode;
});
exports.qrcode_temporary = co.wrap(function*(scene_id) {
    let request = {
        "action_name": "QR_SCENE",
        "action_info": {
            "scene": {
                "scene_id": scene_id
            }
        },
        "expire_seconds": 604800
    };
    let response = yield this.qrcode_create(request, pubno);
    if (response.errcode) {
        response.name = '临时二维码';
        return response;
    }
    return this.qrcode_save(request, response, pubno);
});
exports.qrcode_permanent = co.wrap(function*(scene_id, pubno) {
    let request = {
        "action_name": "QR_LIMIT_SCENE",
        "action_info": {
            "scene": {
                "scene_id": scene_id
            }
        }
    };
    let response = yield this.qrcode_create(request, pubno);
    if (response.errcode) {
        response.name = '永久二维码';
        return response;
    }
    return this.qrcode_save(request, response, pubno);
});
exports.qrcode_permanent_str = co.wrap(function*(scene_str, pubno) {
    let request = {
        "action_name": "QR_LIMIT_STR_SCENE",
        "action_info": {
            "scene": {
                "scene_str": scene_str
            }
        }
    };
    let response = yield this.qrcode_create(request, pubno);
    if (!response) {
        return {
            errcode: 9404,
            errmsg: '永久二维码-字符串形式：返回空'
        };
    }
    if (response && response.errcode) {
        response.name = '永久二维码-字符串形式';
        if (response.errcode == '48001') {
            response.errmsg = '二维码api未授权';
        }
        return response;
    }
    return this.qrcode_save(request, response, pubno);
});
exports.showqrcode = co.wrap(function*(ticket) {
    let options = {
        uri: 'https://mp.weixin.qq.com/cgi-bin/showqrcode',
        method: 'GET',
        qs: {
            ticket: ticket
        }
    };
    let response = yield request(options);
    let body = response.body;
    return body;
});
exports.shorturl = co.wrap(function*(long_url, pubno) {
    log.info('获取短连接');
    let token = yield wecom.api_authorizer_token(pubno);
    if (token.errcode) {
        log.info('short_url.token.error', token);
        return long_url;
    }
    let options = {
        uri: 'https://api.weixin.qq.com/cgi-bin/shorturl',
        method: 'POST',
        json: true,
        qs: {
            access_token: token
        },
        body: {
            action: 'long2short',
            long_url: long_url
        }
    };
    let response = yield request(options);
    let body = response.body;
    if (body.errcode) {
        log.info('short_url.error', body);
        return long_url;
    }
    return body.short_url;
});
exports.get_userinfo = co.wrap(function*(FromUserName, ToUserName, comid) {
    let user = yield User.findOne({
        openid: FromUserName
    }).exec();
    if (!user) {
        user = new User({
            openid: FromUserName
        });
    }
    let token = yield wecom.get_token_by_username(ToUserName, comid);
    if (!token) {
        let errmsg = {
            errcode: 9404,
            errmsg: '公号不存在',
            name: '获取微信用户信息'
        };
        log.error({
            code: 2,
            err: errmsg
        });
        return errmsg;
    }
    if (token.errcode) {
        log.error({
            code: 3,
            err: token
        });
        return token;
    }
    let options = {
        uri: 'https://api.weixin.qq.com/cgi-bin/user/info',
        method: 'POST',
        json: true,
        qs: {
            access_token: token,
            openid: FromUserName,
            lang: 'zh_CN'
        }
    };
    let response = yield request(options);
    let body = response.body;
    if (!body) {
        let errmsg = {
            errcode: 406,
            errmsg: '获取微信用户信息空',
            name: '获取微信用户信息'
        };
        log.error({
            code: 4,
            err: errmsg
        });
        return errmsg;
    }
    if (body && body.errcode) {
        body.name = "获取微信用户信息";
        return body;
    }
    body.nickname ? user.info.nickname = body.nickname : null;
    user.info.sex = body.sex;
    user.info.province = body.province;
    user.info.city = body.city;
    user.info.country = body.country;
    user.info.headimgurl = body.headimgurl;
    user.info.language = body.language;
    user.info.remark = body.remark;
    user.status.subscribe = body.subscribe;
    user.unionid = body.unionid;
    if (body.subscribe_time) {
        user.time.subscribe = moment.unix(_.parseInt(body.subscribe_time));
    }
    user.time.update = Date.now();
    //user.role.client = true;
    user.pubno = yield Pubno.findOne({
        'authorizer_info.user_name': ToUserName
    }).exec();
    yield user.save(function(err) {
        if (err) log.error({
            code: 5,
            err: err
        });
    });
    return user;
});

exports.media_upload = function*(file, pubno, type) {
    log.info('上传多媒体文件');
    let token = yield wecom.api_authorizer_token(pubno);
    if (token.errcode) return token;
    let filename = require('path').basename(file);
    let filelength = fs.statSync(file)["size"];
    let content_type = require('mime-types').lookup(file);
    let mimeTotype = {
        'audio/amr': 'voice',
        'audio/mp3': 'voice',
        'image/jpeg': 'image',
        'image/jpg': 'image',
        'image/png': 'image',
        'image/gif': 'image'
    };
    let formData = {
        media: {
            value: fs.createReadStream(file),
            options: {
                'filename': filename,
                'filelength': filelength,
                'content-type': content_type
            }
        },
        nonce: '' //无法上传架空
    };
    let options = {
        uri: 'http://file.api.weixin.qq.com/cgi-bin/media/upload',
        method: 'POST',
        formData: formData,
        qs: {
            access_token: token,
            type: type
        },
        json: true
    };
    let response = yield request(options);
    let body = response.body;
    if (body.errcode) return body;
    let media = new Media({
        media_id: body.media_id,
        pubno: pubno,
        type: type,
        filename: filename,
        io: 'upload'
    });
    yield media.save(function(err) {
        if (err)
            log.error({
                code: 6,
                err: err
            });
    });
    return body;
};
exports.media_get = function*(media_id, pubno, ext) {
    log.info('下载多媒体文件');
    let token = yield wecom.api_authorizer_token(pubno);
    if (token.errcode) return token;
    let type = 'image';
    var dir = '/mnt/photo/media/' + require('moment')().format('YYYY-M') + '/';
    require('mkdirp').sync(dir);
    let options = {
        uri: 'http://file.api.weixin.qq.com/cgi-bin/media/get',
        method: 'POST',
        json: true,
        qs: {
            access_token: token,
            media_id: media_id
        }
    };
    require('request')(options)
        .on('response', function(response) {
            let content_type = response.headers['content-type'];
            if (content_type === 'audio/amr') {
                type = 'voice';
            }
            if (_.includes(['image/jpeg', 'image/jpg', 'image/png', 'image/gif'], content_type)) {
                type = 'image';
            }
            let filename = response.headers['content-disposition'].match(/\"(.*?)\"/)[1];
            let media = new Media({
                media_id: media_id,
                pubno: pubno,
                type: type,
                filename: filename,
                io: 'download'
            });
            media.save();
        })
        .pipe(fs.createWriteStream(dir + media_id + '.' + ext));
};
exports.menu = co.wrap(function*(pubno) {
    log.info('设置菜单');
    let token = yield wecom.api_authorizer_token(pubno);
    if (token.errcode) return token;
    let menu = yield WeMenu.getCurr(pubno.id);
    if (!menu || !menu.content) {
        menu = config.menu[pubno.component_appid];
        menu = JSON.stringify(menu);
        menu = menu.replace(new RegExp(/(\$APPID\$)/g), pubno.appid);
        menu = {
            content: JSON.parse(menu)
        };
        let errmsg = {
            errcode: 9404,
            errmsg: '还没有设置菜单使用配置菜单'
        };
        log.error({
            code: 7,
            err: errmsg
        });
    }
    let options = {
        uri: "https://api.weixin.qq.com/cgi-bin/menu/create",
        method: 'POST',
        json: true,
        qs: {
            access_token: token
        },
        body: menu.content
    };
    let response = yield request(options);
    if (!response) {
        let errmsg = {
            errcode: 9404,
            errmsg: '无法连接菜单接口'
        };
        log.error({
            code: 8,
            err: errmsg
        });
        return errmsg;
    }
    let body = response.body;
    if (body.errcode) {
        body.name = "设置菜单";
        log.error({
            code: 9,
            err: body
        });
    }
    return body;
});
exports.update_autoreply = co.wrap(function*(pubno) {
    log.info('更新自动回复规则');
    let token = yield wecom.api_authorizer_token(pubno);
    if (token.errcode) return token;
    let options = {
        uri: "https://api.weixin.qq.com/cgi-bin/get_current_autoreply_info",
        method: 'GET',
        json: true,
        qs: {
            access_token: token
        }
    };
    let response = yield request(options);
    if (!response) {
        let errmsg = {
            errcode: 9404,
            errmsg: '无法获取自动回复规则'
        };
        log.error({
            code: 10,
            err: errmsg
        });
        return errmsg;
    }
    let body = response.body;
    if (body.errcode) console.errcode(body);
    let reply = yield AutoReply.getCurr(pubno);
    if (!reply) reply = new AutoReply();
    reply.pubno = pubno;
    reply.content = body;
    reply.time.update = Date.now();
    yield reply.save(function(err) {
        if (err) log.error('保存自动回复规则错误:', err);
    });
    return reply;
});
exports.get_autoreply = co.wrap(function*(pubno) {
    log.info('获取自动回复规则');
    let token = yield wecom.api_authorizer_token(pubno);
    if (token.errcode) return token;
    let reply = yield AutoReply.getCurr(pubno.id);
    if (reply && reply.content) {
        return reply.content;
    }
    let options = {
        uri: "https://api.weixin.qq.com/cgi-bin/get_current_autoreply_info",
        method: 'GET',
        json: true,
        qs: {
            access_token: token
        }
    };
    let response = yield request(options);
    if (!response) {
        let errmsg = {
            errcode: 9404,
            errmsg: '无法获取自动回复规则'
        };
        log.error(errmsg);
        return errmsg;
    }
    let body = response.body;
    if (!body) {
        let errmsg = {
            errmsg: '暂无自动回复规则'
        };
        conosole.errcode(errmsg);
        return errmsg;
    }
    if (body.errcode) {
        console.errcode(body);
        return body;
    }
    reply = new AutoReply();
    reply.pubno = pubno;
    reply.content = body;
    yield reply.save(function(err) {
        if (err) log.error('保存自动回复规则错误:', err);
    });
    return response.body;
});
exports.api_set_industry = co.wrap(function*(pubno) {
    log.info('设置模板消息所属行业');
    let token = yield wecom.api_authorizer_token(pubno);
    if (token.errcode) return token;
    let options = {
        uri: "https://api.weixin.qq.com/cgi-bin/template/api_set_industry",
        method: 'POST',
        json: true,
        qs: {
            access_token: token
        },
        body: {
            "industry_id1": "1",
            "industry_id2": "2"
        }
    };
    let response = yield request(options);
    if (!response) {
        let errmsg = {
            errcode: 9404,
            errmsg: '无法模板消息所属行业接口'
        };
        log.error({
            rc: 11,
            err: errmsg
        });
        return errmsg;
    }
    let body = response.body;
    if (body.errcode) {
        body.name = "设置模板消息所属行业";
        log.error(body);
    }
    return body;
});
