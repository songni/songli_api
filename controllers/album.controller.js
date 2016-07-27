'use strict';

var root = '../',
    pathMd = root + 'models/',
    Album = require(pathMd + "album.model"),
    _ = require("lodash"),
    mongoose = require('mongoose'),
    ObjectID = mongoose.Types.ObjectId,
    config = require(root + 'config/environment');

exports.upload = function*(next) {
    let body = this.request.body;
    if (_.isUndefined(body.files) || _.isUndefined(body.files.file)) {
        this.status = 404;
        this.body = {
            errmsg: '暂无上传图片'
        }
        return;
    }

    let file = body.files.file;
    let path = require('path');
    let oldPath = file.path;
    let basename = path.basename(oldPath);
    let photo = '/' + require('moment')().format('YYYY-M') + '/' + basename
    let newPath = '/mnt/photo/photo' + photo;
    require('mv')(oldPath, newPath, function(err) {
        if (err) throw err;
    });

    var album = new Album({
        'info.file_path': photo,
        'info.file_name': file.name,
        'info.file_type': file.type,
        'info.file_size': file.size,
        'pubno': this.token.pubno ? this.token.pubno : '5553bf863f25f2770c080a02'
    });
    yield album.save();

    this.body = {
        link: "http://" + config.domain.img + photo,
        name: file.name
    };
};
