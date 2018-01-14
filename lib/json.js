'use strict';

var Buffer = require('buffer').Buffer;

var json = function () {
    var readData = function (bodyReceiver, ctx) {
        return new Promise(function (resolve, reject) {
            var req = ctx.req;
            var maxBodySize = bodyReceiver.options.maxBodySize;
            var total = req.headers['content-length'];
            var chunks = [];
            var size = 0;

            if (total > maxBodySize) {
                bodyReceiver.emit('error', 'body size limit exceeded', ctx);
                return resolve();
            }

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
                    var body = buffer.toString();

                    try {
                        body = JSON.parse(body);
                        resolve(body);
                    }
                    catch (ex) {
                        bodyReceiver.emit('error', 'parse request body to json failed', ctx);
                        resolve();
                    }

                    buffer = null;
                });
        });
    };

    var init = function (bodyReceiver, ctx) {
        var promise = readData(bodyReceiver, ctx);
        var emitError = function (error) {
            bodyReceiver.emit('error', error, ctx);
        };

        return promise
            .then(function (body) {
                bodyReceiver.emit('end', body, ctx);
                return body;
            }, emitError)
            .catch(emitError);
    };

    return init;
};

module.exports = json();
