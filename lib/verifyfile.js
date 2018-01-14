'use strict';

// Verify file type & size
var toString = Object.prototype.toString;

var verifyFile = function (file, options) {
    var type = file.type;
    var size = file.size;
    var accept = options.accept;
    var minFileSize = options.minFileSize;
    var maxFileSize = options.maxFileSize;
    var result = {};

    // verify file type
    if (accept === null) {
        result.allow = true;
    }
    else {
        if (!type) {
            result.allow = false;
        }
        else {
            // accept is RegExp
            if (toString.call(accept) === '[object RegExp]') {
                result.allow = accept.test(type);
            }
            // accept is function
            else if (typeof accept === 'function') {
                result.allow = accept(type, size);
            }
        }

        if (!result.allow) {
            result.message = 'has the forbidden file type';
        }
    }

    // verify file size
    if (result.allow) {
        minFileSize = minFileSize || 1;
        result.allow = size >= minFileSize && size <= maxFileSize;

        if (size < minFileSize || size > maxFileSize) {
            result.allow = false;
            result.message = 'file size limit exceeded';
        }
        else {
            result.allow = true;
        }
    }

    return result;
};

module.exports = verifyFile;
