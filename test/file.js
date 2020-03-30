'use strict';

var fs = require('fs');
var path = require('path');
var assert = require('assert');
var supertest = require('supertest');
var Koa = require('koa');
var BodyReceiver = require('../index');
var generateFilename = require('../lib/filename');
var filePath = path.resolve(__dirname, './avatar.jpg');

describe('Body Receiver test file upload', function () {
    var app = new Koa();
    var bodyReceiver = new BodyReceiver();

    app.use(bodyReceiver.startup());

    app.use((ctx, next) => {
        if (ctx.method === 'POST' && ctx.path === '/file/contents') {
            ctx.body = ctx.request.body.files.avatar[0].contents;
        }

        return next();
    });

    app.use((ctx, next) => {
        if (ctx.method === 'POST' && ctx.path === '/file/meta') {
            ctx.body = {
                type: ctx.request.body.files.avatar[0].type,
                size: ctx.request.body.files.avatar[0].size,
                name: ctx.request.body.files.avatar[0].name
            };
        }

        return next();
    });

    app.use((ctx, next) => {
        if (ctx.method === 'POST' && ctx.path === '/file/stream') {
            var file = ctx.request.body.files.avatar[0];
            ctx.body = file.createReadStream();
        }

        return next();
    });

    var request = supertest(app.listen());

    it('should receive jpg file buffer contents', function (done) {
        request
            .post('/file/contents')
            .attach('avatar', filePath, {
                'content-type': 'image/jpeg'
            })
            .expect(200)
            .end(function (err, res) {
                if (err) {
                    return done(err);
                }

                fs.readFile(filePath, function (err, contents) {
                    if (err) {
                        return done(err);
                    }

                    assert.equal(contents.compare(res.body), 0);
                    done();
                });
            });
    });

    it('should receive jpg file meta data', function (done) {
        request
            .post('/file/meta')
            .attach('avatar', filePath, {
                'content-type': 'image/jpeg'
            })
            .expect(200)
            .end(function (err, res) {
                if (err) {
                    return done(err);
                }

                fs.readFile(filePath, function (err, contents) {
                    if (err) {
                        return done(err);
                    }

                    assert.equal(generateFilename(contents) + '.jpg', res.body.name);
                    assert.equal(res.body.size, contents.length);
                    assert.equal(res.body.type, 'image/jpeg');
                    done();
                });
            });
    });

    it('should receive jpg file stream', function (done) {
        request
            .post('/file/stream')
            .attach('avatar', filePath, {
                'content-type': 'image/jpeg'
            })
            .expect(200)
            .end(function (err, res) {
                if (err) {
                    return done(err);
                }

                fs.readFile(filePath, function (err, contents) {
                    if (err) {
                        return done(err);
                    }

                    assert.equal(contents.compare(res.body), 0);
                    done();
                });
            });
    });
});
