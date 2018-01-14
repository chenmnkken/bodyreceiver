'use strict';

var util = require('util');
var bytes = require('bytes');
var EventEmitter = require('events').EventEmitter;

var multipart = require('./lib/multipart');
var textplain = require('./lib/textplain');
var json = require('./lib/json');
var urlencoded = require('./lib/urlencoded');

// @TODO Consider the destruction of persistent documents

var defaults = {
    accept: null, // Regexp or Function, Upload file only, limit accept file type
    write: false, // Boolean, Upload file only, whether write file to disk
    maxBodySize: '1mb', // String, allow maximum body size
    maxFileSize: '3mb', // String, Upload file only, allow maximum file size to be uploaded
    minFileSize: null, // String, Upload file only, allow minimum file size to be uploaded
    keepFilename: false, // Boolean, Upload file only, whether keep origin file name
    generateFilename: null, // Function, Upload file only, generate filename handle function
    dest: process.cwd() + '/upload' // String, Upload file only, default upload folder
};

var BodyReceiver = function (options) {
    EventEmitter.call(this);
    this.options = Object.assign({}, defaults, options || {});
    this.options.maxBodySize = bytes(this.options.maxBodySize);
    this.options.maxFileSize = bytes(this.options.maxFileSize);

    if (this.options.minFileSize) {
        this.options.minFileSize = bytes(this.options.minFileSize);
    }
};

util.inherits(BodyReceiver, EventEmitter);

BodyReceiver.prototype.startup = function () {
    var self = this;

    // handle error event
    if (!self.listenerCount('error')) {
        self.on('error', function (error, ctx) {
            console.error('Body Receiver Error:', error);
        });
    }

    return async function bodyReceiver (ctx, next) {
        var req = ctx.req;
        var method = req.method.toLowerCase();
        var headers = req.headers;
        var contentType;
        var result;

        if ((method === 'post' || method === 'put') && 'content-type' in headers && ('transfer-encoding' in headers || 'content-length' in headers)) {
            contentType = headers['content-type'];

            // multipart
            if (~contentType.indexOf('multipart/form-data')) {
                result = multipart(self, ctx);
            }
            // text/plain
            else if (~contentType.indexOf('text/plain')) {
                result = textplain(self, ctx);
            }
            // application/json
            else if (~contentType.indexOf('application/json')) {
                result = json(self, ctx);
            }
            // application/x-www-form-urlencoded
            else {
                result = urlencoded(self, ctx);
            }

            ctx.request.body = await result;

            if (!ctx.request.body) {
                ctx.request.body = {};
            }
        }

        await next();
    };
};

module.exports = BodyReceiver;
