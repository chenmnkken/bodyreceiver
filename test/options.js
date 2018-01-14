'use strict';

var fs = require('fs');
var path = require('path');
var assert = require('assert');
var supertest = require('supertest');
var rimraf = require('rimraf');
var Koa = require('koa');
var BodyReceiver = require('../index');
var generateFilename = require('../lib/filename');
var jpegFilePath = path.resolve(__dirname, './avatar.jpg');
var jpegFilePath2 = path.resolve(__dirname, './avatar_big.jpg');
var jsFilePath = path.resolve(__dirname, './body.js');

describe('Body Receiver test file upload options', function () {
    var app = new Koa();
    var bodyReceiver = new BodyReceiver({
        accept: /jpeg/,
        keepFilename: true,
        maxFileSize: '1kb',
        write: true
    });

    app.use(bodyReceiver.startup());

    app.use((ctx, next) => {
        if (ctx.method === 'POST' && ctx.path === '/options/accept-jpeg') {
            var file = ctx.request.body.files.avatar[0];

            ctx.body = {
                name: file.name,
                type: !!file.type,
                size: !!file.size,
                contents: Buffer.isBuffer(file.contents),
                createReadStream: typeof file.createReadStream === 'function',
                error: file.error
            };
        }

        return next();
    });

    app.use((ctx, next) => {
        if (ctx.method === 'POST' && ctx.path === '/options/accept-js') {
            var file = ctx.request.body.files.avatar[0];

            ctx.body = file;
        }

        return next();
    });

    var request = supertest(app.listen());

    it('should accept jpg file', function (done) {
        request
            .post('/options/accept-jpeg')
            .attach('avatar', jpegFilePath, {
                'content-type': 'image/jpeg'
            })
            .expect(200)
            .end(function (err, res) {
                if (err) {
                    return done(err);
                }

                var data = res.body;
                var destpath = path.resolve(__dirname, 'upload');
                var filepath = path.resolve(destpath, 'avatar.jpg');

                assert(data.size);
                assert.equal(data.name, 'avatar.jpg');
                assert(data.type);
                assert(data.contents);
                assert(data.createReadStream);

                fs.exists(filepath, function (exists) {
                    assert(exists);
                    rimraf(destpath, function () {
                        done();
                    });
                });
            });
    });

    it('should receive js file, but can not accept', function (done) {
        request
            .post('/options/accept-js')
            .attach('avatar', jsFilePath, {
                'content-type': 'text/plain'
            })
            .expect(200)
            .end(function (err, res) {
                if (err) {
                    return done(err);
                }

                var data = res.body;

                assert.equal(data.error, 'has the forbidden file type');
                done();
            });
    });

    it('should receive jpg file, but size is limit exceeded', function (done) {
        request
            .post('/options/accept-jpeg')
            .attach('avatar', jpegFilePath2, {
                'content-type': 'image/jpeg'
            })
            .expect(200)
            .end(function (err, res) {
                if (err) {
                    return done(err);
                }

                var data = res.body;

                assert.equal(data.error, 'file size limit exceeded');
                done();
            });
    });
});
