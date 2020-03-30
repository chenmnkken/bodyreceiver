'use strict';

var fs = require('fs');
var path = require('path');
var Stream = require('stream');
var mkdirp = require('mkdirp');
var Buffer = require('buffer').Buffer;
var verifyFile = require('./verifyfile');
var generateHashFilename = require('./filename');
// 511 = 0777
var processMode = 511 & (~process.umask());

var multipart = function () {
    var rHeaderSpilt = /;\s|\r\n/;
    var rQuation = /['"]/g;

    var BOUNDARY = 'boundary=';
    var LF = 10; // \n
    var CR = 13; // \r

    var write = function (args) {
        var promiseArr = [];
        var body = args[0];
        var bodyReceiver = args[1];
        var ctx = args[2];
        var options = bodyReceiver.options;
        var files = body.files;
        var isWrite = options.write;
        var keepFilename = options.keepFilename;
        var dest = options.dest;
        var generateFilename = options.generateFilename;
        var field;

        for (field in files) {
            files[field].forEach(function (item) {
                if (item.error) {
                    return;
                }

                var promise = new Promise(function (resolve) {
                    if (!item.contents.length) {
                        resolve();
                        return;
                    }

                    var filename;
                    var filepath;
                    var extname;

                    if (typeof generateFilename === 'function') {
                        extname = path.extname(item.name);
                        filename = generateFilename(
                            path.basename(item.name, extname),
                            generateHashFilename(item.contents),
                            extname
                        );
                        item.name = filename;
                    }
                    else {
                        // Whether or not write file to disk have to generate file name
                        if (keepFilename) {
                            filename = item.name;
                        }
                        else {
                            extname = path.extname(item.name);
                            filename = generateHashFilename(item.contents);
                            filename += extname;
                            item.name = filename;
                        }
                    }

                    // Write file to disk
                    if (isWrite) {
                        filepath = path.resolve(dest, filename);
                        item.path = filepath;

                        mkdirp(dest, processMode, function (err) {
                            if (err) {
                                bodyReceiver.emit('error', err, ctx);
                                return;
                            }

                            var writeStream;
                            var readStream;

                            if (err) {
                                bodyReceiver.emit('error', 'upload dest create failed', ctx);
                                resolve();
                            }
                            else {
                                readStream = item.createReadStream();
                                writeStream = fs.createWriteStream(filepath);

                                writeStream.on('close', () => {
                                    bodyReceiver.emit('file', item, ctx);
                                    writeStream = readStream = null;
                                    resolve();
                                });

                                readStream.pipe(writeStream);
                            }
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

    var headerParser = function (buffer) {
        var headerArr = buffer.toString().split(rHeaderSpilt);
        var length = headerArr.length;
        var i = 1;
        var result = {};
        var headerMap = {};
        var filed;
        var value;
        var index;
        var item;

        for (; i < length; i++) {
            item = headerArr[i];

            if (item) {
                index = item.indexOf('=');

                if (~index) {
                    // parse name=value
                    filed = item.slice(0, index);
                    value = item.slice(index + 1).replace(rQuation, '');
                    headerMap[filed] = value;
                }
                else {
                    // Upload file need parse content-type
                    if ('filename' in headerMap) {
                        index = item.indexOf(':');

                        if (~index) {
                            // parse name: value
                            filed = item.slice(0, index).toLowerCase();
                            value = item.slice(index + 1).trim();
                            headerMap[filed] = value;
                        }
                        else {
                            headerMap.value = item;
                        }
                    }
                    // Not upload file
                    else {
                        headerMap.value = item;
                    }
                }
            }
        }

        result.field = headerMap.name;

        if (headerMap.value) {
            result.value = headerMap.value;
        }

        if (headerMap.filename) {
            result.file = {
                name: headerMap.filename,
                type: headerMap['content-type']
            };
        }

        headerMap = null;
        return result;
    };

    var bufferSplit = function (buffer, separator, fromIndex) {
        fromIndex = fromIndex || 0;
        var arr = [];

        var _split = function (buffer, pattern, fromIndex) {
            var index = buffer.indexOf(separator, fromIndex);
            var strFragment;

            if (~index) {
                strFragment = buffer.slice(fromIndex, index);
                arr.push(strFragment);
                return _split(buffer, separator, index + separator.length);
            }
            else {
                strFragment = buffer.slice(fromIndex);

                if (strFragment !== '') {
                    arr.push(strFragment);
                    return arr;
                }
            }
        };

        return _split(buffer, separator, fromIndex);
    };

    var createMultipleBody = function (buffer, boundary) {
        var startBoundary = '\r\n' + boundary.startBoundary;
        var boundaryBuffer = Buffer.from(startBoundary);

        return bufferSplit(buffer, boundaryBuffer);
    };

    var createBody = function (args) {
        var boundary = args[0];
        var bodyReceiver = args[1];
        var buffer = args[2];
        var ctx = args[3];
        var options = bodyReceiver.options;
        var maxBodySize = options.maxBodySize;
        var hasField = false;
        var body = {
            fields: {},
            files: {}
        };

        // Delete start and end boundary
        buffer = buffer.slice(boundary.startLength, boundary.endLength);

        createMultipleBody(buffer, boundary).forEach(function (buffer) {
            var i = 0;
            var LFCount = 0;
            var CRCount = 0;
            var length = buffer.length;
            var headerBuffer;
            var contentBuffer;
            var headerObj;
            var file;
            var verifyResult;

            for (; i < length; i++) {
                if (buffer[i] === CR) {
                    CRCount++;
                }
                else if (buffer[i] === LF) {
                    LFCount++;
                }

                if (CRCount === 3 && LFCount === 3) {
                    i++;
                    break;
                }
            }

            headerBuffer = buffer.slice(0, i);
            contentBuffer = buffer.slice(i);

            // Break empty field
            if (!headerBuffer.length && !contentBuffer.length) {
                return;
            }

            headerObj = headerParser(headerBuffer);

            // file type
            if (headerObj.file) {
                file = headerObj.file;
                file.size = contentBuffer.length;
                file.contents = contentBuffer;
                file.createReadStream = function () {
                    var stream = new Stream.Readable();

                    stream._read = function () {
                        this.push(contentBuffer);
                        this.push(null);
                    };

                    return stream;
                };

                verifyResult = verifyFile(file, options);

                if (!body.files[headerObj.field]) {
                    body.files[headerObj.field] = [];
                }

                if (verifyResult.allow) {
                    body.files[headerObj.field].push(file);
                    bodyReceiver.emit('data', file, ctx);
                }
                else {
                    body.files[headerObj.field].push({
                        error: verifyResult.message
                    });
                    bodyReceiver.emit('error', headerObj.field + ' ' + verifyResult.message, ctx);
                }
            }
            // form-data type
            else {
                if (headerObj.field && headerObj.value) {
                    if (!body.fields[headerObj.field]) {
                        body.fields[headerObj.field] = [];
                    }

                    hasField = true;
                    body.fields[headerObj.field].push(headerObj.value);
                }
            }
        });

        // Convert array of 1 length value to string
        if (hasField) {
            Object.keys(body.fields).forEach(function (item) {
                if (body.fields[item].length === 1) {
                    body.fields[item] = body.fields[item].toString();
                }
            });

            if (!Object.keys(body.files).length) {
                if (buffer.length > maxBodySize) {
                    body.fields = {};
                    bodyReceiver.emit('error', 'body size limit exceeded', ctx);
                }
            }
        }

        return [body, bodyReceiver, ctx];
    };

    var getBoundary = function (bodyReceiver, ctx) {
        var headers = ctx.req.headers;
        var contentType = headers['content-type'];
        var index;
        var boundary;
        var startBoundary;
        var endBoundary;

        if (!contentType) {
            bodyReceiver.emit('error', 'content-type header is broken', ctx);
        }

        index = contentType.indexOf(BOUNDARY);
        boundary = contentType.slice(index + BOUNDARY.length);
        startBoundary = '--' + boundary + '\r\n';
        endBoundary = '\r\n--' + boundary + '--\r\n';

        return {
            startLength: startBoundary.length,
            endLength: 0 - endBoundary.length,
            startBoundary: startBoundary,
            endBoundary: endBoundary
        };
    };

    var readData = function (bodyReceiver, ctx) {
        return new Promise(function (resolve) {
            var req = ctx.req;
            var total = req.headers['content-length'];
            var chunks = [];
            var size = 0;

            req
                .on('readable', function () {
                    /* eslint babel/no-invalid-this:0 */
                    var buffer = this.read();

                    if (buffer !== null) {
                        chunks.push(buffer);
                        size += buffer.length;

                        bodyReceiver.emit('progress', {
                            received: size,
                            total: total
                        }, ctx);
                    }
                })
                .on('aborted', function () {
                    bodyReceiver.emit('aborted', ctx);
                })
                .on('end', function () {
                    var buffer = Buffer.concat(chunks, size);
                    resolve(buffer);
                });
        });
    };

    var init = function (bodyReceiver, ctx) {
        var boundary = getBoundary(bodyReceiver, ctx);
        var reqData = readData(bodyReceiver, ctx);
        var promise = Promise.all([boundary, bodyReceiver, reqData, ctx]);
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

module.exports = multipart();
