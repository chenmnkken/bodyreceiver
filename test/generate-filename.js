'use strict';

var fs = require('fs');
var path = require('path');
var assert = require('assert');
var supertest = require('supertest');
var rimraf = require('rimraf');
var Koa = require('koa');
var BodyReceiver = require('../index');
var generateFilename = require('../lib/filename');
var filePath = path.resolve(__dirname, './avatar.jpg');

describe('Body Receiver test file upload options: generateFilename', function () {
    var app = new Koa();
    var bodyReceiver = new BodyReceiver({
        accept: /jpeg/,
        generateFilename: function (filename, hashname, extname) {
            return filename + '.' + hashname + extname;
        },
        maxFileSize: '1kb'
    });

    app.use(bodyReceiver.startup());

    app.use((ctx, next) => {
        if (ctx.method === 'POST' && ctx.path === '/filename/accept-jpeg') {
            var file = ctx.request.body.files.avatar[0];

            ctx.body = {
                name: file.name
            };
        }

        return next();
    });

    var request = supertest(app.listen());

    it('should generate custom filename', function (done) {
        request
            .post('/filename/accept-jpeg')
            .attach('avatar', filePath, {
                'content-type': 'image/jpeg'
            })
            .expect(200)
            .end(function (err, res) {
                if (err) {
                    return done(err);
                }

                var data = res.body;

                fs.readFile(filePath, function (err, contents) {
                    if (err) {
                        return done(err);
                    }

                    assert.equal(data.name, 'avatar.' + generateFilename(contents) + '.jpg');
                    done();
                });
            });
    });
});
