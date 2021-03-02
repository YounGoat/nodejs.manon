
'use strict';

const { match } = require('assert');
const { read } = require('fs');

const MODULE_REQUIRE = 1
	/* built-in */
	, os = require('os')
	
	/* NPM */
	, colors = require('colors')
	, if2 = require('if2')
	
	/* in-package */

	/* in-file */
	, uncolors = text => {
		return text.replace(RE_COLOR_G, '');
	}	

	, uncolorsWidth = text => uncolors(text).length
	;

const RE_COLOR   = /\u001b\[\?{0,1}\d+(;\d+){0,2}[mlhABCDEFGK]/;
const RE_COLOR_G = /\u001b\[\?{0,1}\d+(;\d+){0,2}[mlhABCDEFGK]/g;
const SPACE      = String.fromCharCode(32);
const BACKSPACE  = String.fromCharCode(8);
const TAB        = SPACE.repeat(4);
const CR         = '\u000d'; // equals '\r'
const EOL        = os.EOL;
const LINE_WIDTH = 80;

const DEFAULT_OPTIONS = {
	'synopsisHaning': false,
};

// 当前的元素路径。
let elementPath;

// 当前的缩进级别。
let indentCursor;
const indent = () => TAB.repeat(indentCursor);
const indentMove = offset => indentCursor += offset;
const indentReset = () => indentCursor = 0;
const maxWidth = () => process.stdout.columns - 10 || LINE_WIDTH;

/**
 * 添加下边距。
 * @param {string} text 
 * @return {string}
 */
const marginBottom = text => {
	let end = EOL.repeat(2);
	while (!text.endsWith(end)) {
		text += EOL;
	}
	return text;
};

const RENDER = {
	'bullet': function(bullet) {
		switch (bullet) {
			case '#':
				return '';
		
			default:
				return colors.magenta(bullet);
		}
	},

	'command': function() {
		let args = Array.from(arguments);
		let output = indent();
		
		for (let 
				i = 0, 
				/* int */ lineWidth, /* length of current line */
				/* int */ indentWidth /* length of indenf of 2nd+ lines */
			; i < args.length; i++) {
			
			let [ name ] = args[i];
			let arg_fo = format(args[i]);
			
			if (name == 'comment') {
				output += EOL + arg_fo;
				continue;
			}

			if (!indentWidth && name == 'name') {
				/**
				 * Add space between name pieces.
				 * 在命令名之间插入空格。
				 */
				if (i) output += SPACE;
				output += arg_fo;
				continue;
			}
			
			/**
			 * All command names have been formatted.
			 * 确定第二行（如有）及以下行的缩进。
			 */
			if (!indentWidth) {
				lineWidth = uncolorsWidth(output);
				indentWidth = lineWidth + 1 /* width of SPACE */;
			}

			let width = uncolorsWidth(arg_fo);
			lineWidth += 1 /* width of SPACE */ + width;
			if (lineWidth <= maxWidth()) {
				output += SPACE + arg_fo;
			}
			else {
				output += EOL + SPACE.repeat(indentWidth) + arg_fo;
				lineWidth = indentWidth + width;
			}
		}
		
		output += EOL;
		return output;
	},

	'command.name': function() {
		return colors.bold.cyan(format_s(arguments));
	},

	'comment.lines.line': function() {
		return indent() + colors.green('#') + SPACE + format_s(arguments, SPACE) + EOL;
	},

	'enum': function() {
		let mapper = element => colors.green(format(element));
		return Array.from(arguments).map(mapper).join(colors.dim(' | '));
	},

	'heading': function() {
		return indent() + colors.bold(format_s(arguments)) + EOL;
	},

	'line': function() {
		let remainder = indent() + format_s(arguments, SPACE);

		/**
		 * Limit line width.
		 * 限制行宽。遇超宽则自动断行。
		 */
		let max = maxWidth();
		let lines = [];
		let length = 0, left = '';
		do {
			let matched = remainder.match(RE_COLOR);
			let txt;
			if (matched) {
				txt = remainder.slice(0, matched.index);
				remainder = remainder.slice(matched.index + matched[0].length);
			}
			else {
				txt = remainder;
				remainder = '';
			}

			if (length + txt.length >= max) {
				lines.push(left + txt.slice(0, max - length));
				left = txt.slice(max - length).trim();
				while (left.length >= max) {
					lines.push(left.slice(0, max));
					left = left.slice(max).trim();
				}
				length = left.length;
			}
			else {
				left += txt;	
				length += txt.length;
			}

			/**
			 * Append with control characters.
			 * 附加控制字符。
			 */
			if (matched) left += matched[0];
		} while (remainder.length);
		lines.push(left + EOL);		
		return lines.join(EOL + indent());
	},

	'lines': function() {
		let lines = Array.from(arguments).map(line => Array.isArray(line) ? line : [ 'line', line ]);
		return format_s(lines);
	},

	'option': function(option) {
		let { bullet, name, value, optional } = option;

		let output = '';

		if (bullet) {
			output = BACKSPACE + BACKSPACE + colors.yellow(bullet) + SPACE;
		}
		
		if (name) {
			output += Array.from(name)
				.map(name => colors.bold(name))
				.join(SPACE + colors.dim('or') + SPACE)
				;
		}

		if (value) {
			output += SPACE + format(value);
		}

		if (optional) {
			output = '[' + output + ']';
		}
		return output;
	},

	'phrase': function(phrase) {
		return '' +
			indent() + colors.bold.cyan(format(phrase.dt)) + 
			SPACE + '-' + SPACE + 
			format(phrase.dd) + 
			EOL;
	},

	'quoted': function(quoted) {
		return colors.dim('"') + colors.green(quoted) + colors.dim('"');
	},

	'section': function() {
		/**
		 * Add margin at bottom of section.
		 * 在节（section）的下边缘留白。
		 */
		return marginBottom(format_s(arguments));
	},

	'snippet': function(snippet) {
		return colors.blue(snippet);
	},

	'term': function(term) {
		let output = indent() + format(term.dt) + EOL;
		indentMove(+1);
		output += format(term.dd);
		indentMove(-1);
		output += EOL;
		return output;
	},

	'url': function(urlname) {
		return colors.blue.underline(urlname);
	},

	'varname': function(varname) {
		let output = colors.italic(varname.name || varname);
		if (varname.optional) {
			output = '[' + output + ']';
		}
		return output;
	},
};

/**
 * Find correspond render function according to current element path.
 * 根据元素所处的路径（类似 XPath）获取匹配的渲染方法。
 */
const getRender = () => {
	let render;

	// 长名称优先匹配。
	let names = elementPath.slice();
	for (let fullname; !render && names.length; names.shift()) {
		fullname = names.join('.');
		render = RENDER[fullname];
	}
	return render;
};

const INDENT = {
	'heading': -1,
	'section': +1,
};

/**
 * Format an array of elements.
 * 格式化一组元素。
 * @param {Array} elements
 * @return {string}
 */
function format_s(elements, joiner = '') {
	let mapper = element => format(element);
	return Array.from(elements).map(mapper).join(joiner);
}

/**
 * Format one element.
 * 格式化一个元素。
 * @param {Element} tree
 * @return {string}
 */
function format(tree) {
	if (arguments.length > 1) {
		return format_s(arguments);
	}

	// element
	if (tree instanceof Array) {
		let [ name, ...content ] = tree;

		/**
		 * Update current MANON-Path.
		 * 更新当前的元素路径。
		 */
		elementPath.push(name);

		let output = null;
		let indentOffset = if2.defined(INDENT[name], 0);
		let render = getRender();
		if (render) {
			indentMove(+indentOffset);
			output = render.apply(null, content);
			indentMove(-indentOffset);
		}
		else {
			output = format_s(content);
		}

		/**
		 * Restore previous MANON-Path.
		 * 还原之前的元素路径。
		 */
		elementPath.pop();

		return output;
	}

	// scalar
	else if (['string', 'number', 'boolean'].includes(typeof tree)) {
		return tree;
	}

	// vector (Object)
	else {
		let output = [];
		for (let name in tree) {
			output.push(format(tree[name]));
		}
		return output.join(SPACE);
	}
}

function toConsole(tree) {
	/**
	 * Reset the registers.
	 * 重置寄存器。
	 */
	elementPath = [];
	indentReset();

	let output = EOL + format(tree);
	return output;
}

module.exports = toConsole;