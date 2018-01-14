'use strict';

var fs = require('fs');
var path = require('path');
var assert = require('assert');
var supertest = require('supertest');
var rimraf = require('rimraf');
var Koa = require('koa');
var BodyReceiver = require('../index');
var filePath = path.resolve(__dirname, './avatar_big.jpg');

describe('Body Receiver test file upload events', function () {
    var app = new Koa();
    var bodyReceiver = new BodyReceiver({
        keepFilename: true,
        accept: /jpeg/,
        write: true
    });

    var errorEmited = false;
    var endEmited = false;
    var progressEmited = false;
    var fileEmited = false;
    var dataEmitCount = 0;

    bodyReceiver.on('error', function (error) {
        console.log(error);
        errorEmited = true;
    });

    bodyReceiver.on('data', function (data) {
        if (data) {
            dataEmitCount++;
        }
    });

    bodyReceiver.on('progress', function (data) {
        progressEmited = (data.received / data.total) === 1;
    });

    bodyReceiver.on('file', function (file) {
        fileEmited = file.path && file.name && file.type && file.size && Buffer.isBuffer(file.contents) && typeof file.createReadStream === 'function';
    });

    bodyReceiver.on('end', function (body) {
        var file = body.files.avatar[0];
        endEmited = file.name && file.type && file.size && Buffer.isBuffer(file.contents) && typeof file.createReadStream === 'function';
    });

    app.use(bodyReceiver.startup());

    app.use((ctx, next) => {
        if (ctx.method === 'POST' && ctx.path === '/events/file') {
            ctx.body = 'ok';
        }

        return next();
    });

    var request = supertest(app.listen());

    it('should emit events', function (done) {
        request
            .post('/events/file')
            .attach('avatar', filePath, {
                'content-type': 'image/jpeg'
            })
            .expect(200)
            .end(function (err, res) {
                if (err) {
                    return done(err);
                }

                var destpath = path.resolve(__dirname, 'upload');
                var filepath = path.resolve(destpath, 'avatar_big.jpg');

                assert(dataEmitCount > 0);
                assert(endEmited);
                assert(progressEmited);
                assert(fileEmited);
                assert(!errorEmited);

                fs.exists(filepath, function (exists) {
                    assert(exists);
                    rimraf(destpath, function () {
                        done();
                    });
                });
            });
    });
});
