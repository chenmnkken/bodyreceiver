'use strict';

var Buffer = require('buffer').Buffer;

/**
 * Query string parse to object
 * test1=1&test2=2 => { test1 : 1, test2 : 2 }
 * @param{ String } query string
 * @return { Object } query object
 */
const parseQuery = (queryString) => {
    var queryObject = {};
    var i = 0;
    var arr;
    var len;
    var item;
    var index;
    var name;

    arr = queryString.split('&');
    len = arr.length;

    for (; i < len; i++) {
        item = arr[i];
        index = item.indexOf('=');
        name = item.slice(0, index);

        if (!queryObject[name]) {
            queryObject[name] = [];
        }

        queryObject[name].push(
            item.slice(index + 1)
        );
    }

    // Convert array of 1 length value to string
    Object.keys(queryObject).forEach(function (item) {
        if (queryObject[item].length === 1) {
            queryObject[item] = queryObject[item].toString();
        }
    });

    return queryObject;
};

var urlencoded = function () {
    var readData = function (bodyReceiver, ctx) {
        return new Promise(function (resolve, reject) {
            var maxBodySize = bodyReceiver.options.maxBodySize;
            var req = ctx.req;
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
                    var queryObject = parseQuery(body);

                    resolve(queryObject);
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

module.exports = urlencoded();
