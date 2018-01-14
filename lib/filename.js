'use strict';

var crypto = require('crypto');

var generateFilename = function (contents) {
    return crypto.createHash('md5').update(contents).digest('hex');
};

module.exports = generateFilename;
