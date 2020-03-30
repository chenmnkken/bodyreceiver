'use strict';

var fs = require('fs');
var path = require('path');
var rBase64 = /^data:([^;]+);base64,/;
var Stream = require('stream');
var verifyFile = require('./verifyfile');
var generateHashFilename = require('./filename');
var mkdirp = require('mkdirp');
// 511 = 0777
var processMode = 511 & (~process.umask());

var textplain = function () {
    var write = function (args) {
        var promiseArr = [];
        var body = args[0];
        var bodyReceiver = args[1];
        var ctx = args[2];
        var options = bodyReceiver.options;
        var isWrite = options.write;
        var dest = options.dest;
        var files = body.files;
        var field;

        for (field in files) {
            files[field].forEach(function (item) {
                var promise = new Promise(function (resolve) {
                    if (!item.contents.length) {
                        resolve();
                        return;
                    }

                    if (isWrite) {
                        mkdirp(dest, processMode, function (err) {
                            if (err) {
                                bodyReceiver.emit('error', err, ctx);
                                return;
                            }

                            var readStream = item.createReadStream();
                            var writeStream = fs.createWriteStream(item.path);

                            writeStream.on('close', () => {
                                bodyReceiver.emit('file', item, ctx);
                                writeStream = readStream = null;
                                resolve();
                            });

                            readStream.pipe(writeStream);
                        });
                    }
                    else {
                        resolve();
                    }
                });

                promiseArr.push(promise);
            });
        }

        if (promiseArr.length) {
            return Promise.all(promiseArr).then(function () {
                bodyReceiver.emit('end', body, ctx);
                return body;
            });
        }

        bodyReceiver.emit('end', body, ctx);
        return Promise.resolve(body);
    };

    var createBody = function (args) {
        var bodyReceiver = args[0];
        var chunks = args[1];
        var ctx = args[2];
        var options = bodyReceiver.options;
        // Limit only get the first 500 characters
        var suffix = chunks.slice(0, 500);
        var generateFilename = options.generateFilename;
        var body = {};
        var file = {};
        var matches;
        var buffer;
        var filename;
        var extname;
        var filepath;
        var fieldName;
        var typeArr;
        var verifyResult;

        // Only search in prefix, avoid global search
        if (rBase64.test(suffix)) {
            matches = suffix.match(rBase64);
            file.type = matches[1];
            chunks = chunks.replace(rBase64, '');
            buffer = Buffer.from(chunks, 'base64');
            typeArr = file.type.split('/');
            extname = '.' + typeArr[1];

            if (typeof generateFilename === 'function') {
                filename = generateFilename('', generateHashFilename(buffer), extname);
            }
            else {
                filename = generateHashFilename(buffer);
                filename += extname;
            }

            fieldName = file.type;
        }
        else {
            file.type = 'text/plain';
            buffer = Buffer.from(chunks);
            extname = '.txt';

            if (typeof generateFilename === 'function') {
                filename = generateFilename('', generateHashFilename(buffer), extname);
            }
            else {
                filename = generateHashFilename(buffer);
                filename += extname;
            }

            fieldName = 'text';
        }

        filepath = path.resolve(options.dest, filename);

        file.name = filename;
        file.path = filepath;
        file.size = buffer.length;
        file.contents = buffer;
        file.createReadStream = function () {
            var stream = new Stream.Readable();

            stream._read = function () {
                this.push(buffer);
                this.push(null);
            };

            return stream;
        };

        verifyResult = verifyFile(file, options, bodyReceiver);
        body.files = {};

        if (verifyResult.allow) {
            if (!body.files[fieldName]) {
                body.files[fieldName] = [];
            }

            body.files[fieldName].push(file);
            bodyReceiver.emit('data', file, ctx);
        }
        else {
            bodyReceiver.emit('error', verifyResult.message, ctx);
        }

        return [body, bodyReceiver, ctx];
    };

    var readData = function (bodyReceiver, ctx) {
        return new Promise(function (resolve) {
            var req = ctx.req;
            var total = req.headers['content-length'];
            var chunks = '';
            var size = 0;

            req
                .on('readable', function () {
                    /* eslint babel/no-invalid-this:0 */
                    var chunk = this.read();

                    if (chunk !== null) {
                        chunks += chunk;
                        size += chunk.length;

                        bodyReceiver.emit('progress', {
                            received: size,
                            total: total
                        }, ctx);
                    }
                })
                .on('aborted', function () {
                    bodyReceiver.emit('aborted', ctx);
                    resolve();
                })
                .on('end', function () {
                    resolve(chunks);
                });
        });
    };

    var init = function (bodyReceiver, ctx) {
        var reqData = readData(bodyReceiver, ctx);
        var promise = Promise.all([bodyReceiver, reqData, ctx]);
        var emitError = function (error) {
            bodyReceiver.emit('error', error, ctx);
        };

        return promise
            .then(createBody, emitError)
            .then(write, emitError)
            .catch(emitError);
    };

    return init;
};

module.exports = textplain();
