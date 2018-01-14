'use strict';

var fs = require('fs');
var path = require('path');
var assert = require('assert');
var supertest = require('supertest');
var rimraf = require('rimraf');
var Koa = require('koa');
var BodyReceiver = require('../index');
var filePath = path.resolve(__dirname, './base64.txt');

describe('Body Receiver test text-plain file upload', function () {
    var app = new Koa();
    var bodyReceiver = new BodyReceiver({
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
        var file = body.files['image/jpeg'][0];
        endEmited = file.name && file.type && file.size && Buffer.isBuffer(file.contents) && typeof file.createReadStream === 'function';
    });

    app.use(bodyReceiver.startup());

    app.use((ctx, next) => {
        if (ctx.method === 'POST' && ctx.path === '/textplain') {
            var file = ctx.request.body.files['image/jpeg'][0];

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

    var request = supertest(app.listen());

    it('should receive jpeg file', function (done) {
        fs.readFile(filePath, 'utf-8', function (err, contents) {
            if (err) {
                return done(err);
            }

            request
                .post('/textplain')
                .set('content-type', 'text/plain')
                .send(contents.trim())
                .expect(200)
                .end(function (err, res) {
                    if (err) {
                        return done(err);
                    }

                    var data = res.body;
                    var destpath = path.resolve(__dirname, 'upload');

                    assert(dataEmitCount > 0);
                    assert(endEmited);
                    assert(progressEmited);
                    assert(fileEmited);
                    assert(!errorEmited);
                    assert(data.size);
                    assert(data.name);
                    assert(data.type);
                    assert(data.contents);
                    assert(data.createReadStream);

                    fs.exists(destpath, function (exists) {
                        assert(exists);
                        rimraf(destpath, function () {
                            done();
                        });
                    });
                });
        });
    });
});
