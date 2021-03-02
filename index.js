'use strict';

const MODULE_REQUIRE = 1
	/* built-in */
	, fs = require('fs')
	
	/* NPM */
	, noda = require('noda')
	
	/* in-package */
	, parse = noda.inRequire('parse')
	, to = noda.inRequireDir('to')
	;

/**
 * Format manual page.
 * @param {string}   raw
 * @param {string}  [type]
 * @param {Object}  [options]
 */
function format(raw, type = 'console') {
	// console.log('....', JSON.stringify(parse(raw), null, 4));
	return to[type](parse(raw));
}

module.exports = {
	format,
	parse,
};