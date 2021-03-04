'use strict';

const MODULE_REQUIRE = 1
	/* built-in */
	, os = require('os')
	
	/* NPM */
	
	/* in-package */

	/* in-file */
	, SPACE = String.fromCharCode(32)
	, TAB = String.fromCharCode(9)
	, TAB_SIZE = 4
	;

const getIndentWidth = (line, tabsize = 4) => {
	let length = 0;
	/^([ \t]*)/.test(line);
	return RegExp.$1.replace(/\t/g, SPACE.repeat(tabsize)).length;
};

/**
 * Remove heading and tailing empty lines.
 * 清理首尾空白行。
 */
const trimEmptyLines = lines => {
	while (lines.length > 0 && /^\s*$/.test(lines[0])) {
		lines.shift();
	}
	while (lines.length > 0 && /^\s*$/.test(lines[ lines.length - 1 ])) {
		lines.pop();
	}
	return lines;
}

/**
 * 根据经粗筛确定的内容类别，进一步解析。
 */
const PARSER = {
	/**
	 * @param {string} piece 
	 * E.g.
	 *   --name 
	 *   --name <varname>
	 *   --name (enum0|enum1|enum2)
	 */
	'argument': function(piece) {
		let element, remainder = piece;

		ARGUMENT_OPTION: {
			let ret = piece.match(/^(\*\s)?(-{1,2}[\w\-]+(\s+(or|\|)\s+-{1,2}[\w\-]+)*)(\s+<([\w\-]+)>|\s+\(([^)]+)\)|\s+|$)/);
			if (!ret) break ARGUMENT_OPTION;

			let [ whole, bullet, name, ALIAS, OR_OPERATOR, VARNAME_OR_ENUMS, varname, enums ] = ret;

			if (bullet) {
				bullet = bullet.trim();
			}

			/**
			 * Option name(s).
			 * 选项名。
			 */
			name = name.split(/\s+(?:or|\|)\s+/g);

			/**
			 * Option value.
			 * 选项值。
			 */
			let value;
			if (varname) {
				value = [ 'varname', varname ];
			}
			if (enums) {
				value = [ 'enum' ].concat(enums.split('|'));
			}
			
			let option = { name };
			if (bullet) option.bullet = bullet;
			if (value) option.value = value;
			
			element = [ 'option', option ];
			remainder = piece.slice(whole.length);
		}

		ARGUMENT_VARNAME: {
			let ret = (piece || rtext).match(/^<([\w-]+)>/);
			if (!ret) break ARGUMENT_VARNAME;
			
			let [ whole, name ] = ret;
			element = [ 'varname', { name } ];
			remainder = piece.slice(whole.length);
		}

		return { element, remainder };
	},

	'bullet': function(bullet) {
		return [ 'bullet', bullet ];
	},

	/**
	 * @param {string} line 
	 */
	'command': function(line) {
		// Trim needless spaces.
		let rtext = line.trim().replace(/\s+/g, SPACE);

		// Container to save child elements.
		let childs = [];

		let consumer = {
			'name': () => {
				// Get command name.
				let ret = rtext.match(/^(\w[\w\-]*)(\s|$)/);
				if (!ret) return false;
				
				let name = ret[1];
				childs.push([ 'name', name ]);
				rtext = rtext.substr(ret[0].length).trimLeft();
				return true;
			},

			'argument': () => {
				let piece = null;
				let cursor = 0;
				let optional = false;
				if (rtext[0] == '[') {
					let brackets = 1;
					while (brackets && ++cursor < rtext.length) {
						if (rtext[cursor] == '[') brackets++;
						if (rtext[cursor] == ']') brackets--;
					}
					if (brackets) {
						throw new Error(`unmatched squared bracket(s) found: ${rtext}`);
					}
					piece = rtext.slice(1, cursor).trim();
					cursor++;
					optional = true;
				}

				let { element, remainder } = PARSER.argument(piece || rtext);
				if (element) {
					Object.assign(element[1], { optional });
					childs.push(element);
					rtext = (cursor ? rtext.slice(cursor) : remainder).trimLeft();
					return true;
				}

				return false;
			},

			'comment': () => {
				let ret = rtext.match(/^#.*$/);
				if (!ret) return false;

				let lines = ret[0].split('#').slice(1);
				childs.push([ 'comment', PARSER.lines(lines) ] );
				rtext = '';
				return true;
			},
		};

		/**
		 * Retrieve all command names precedes in the command line.
		 * 获取命令行起始处的所有命令名。
		 */
		while (consumer.name()) { /* DO NOTHING. */ }

		while (rtext.length) {
			if (consumer.argument()) continue;
			if (consumer.comment()) continue;

			/**
			 * 所有内容都应当被匹配到，否则抛出异常。
			 */
			throw new Error(`failed to parse command line: ${rtext}`);
		}	

		return [ 'command' ].concat(childs);
	},

	/**
	 * @param {string} line 
	 */
	'line': function(line, keepWhitespaceEnds = false) {
		if (!keepWhitespaceEnds) {
			line = line.trim();
		}
		if (!line) {
			return '';
		}

		let element = [ 'line' ];
		let merge = subElement => {
			if (!subElement) {
				// DO NOTHING.
			}
			else if (typeof subElement == 'string' || subElement[0] != 'line') {
				element.push(subElement);
			}
			else {
				element = element.concat(subElement.slice(1));
			}
		} 
		
		let search = (re, parser) => {
			let match = line.match(re);
			if (!match) return false;
			
			let left = line.slice(0, match.index);
			let rite = line.slice(match.index + match[0].length);
			left = PARSER.line(left);
			rite = PARSER.line(rite);
			merge(left);
			merge(parser.apply(null, match));
			merge(rite);
			return true;
		};

		false
			// line indicator
			|| search(/^#\s/, () => null)
		
			// bullet
			|| search(/^([*])\s/, (match, bullet) => [ 'bullet', bullet ])

			// URL
			|| search(/[a-z]+:\/\/[^\s]+/, urlname => [ 'url', urlname ])

			// code
			|| search(/`(.+?)`/, (match, snippet) => [ 'snippet', snippet ])

			// quoted
			|| search(/"(.+?)"/, (match, quoted) => [ 'quoted', quoted ])

			|| element.push(line)
			;
		return element;
	},

	'lines': function(lines, keepWhitespaceEnds = false) {
		if (keepWhitespaceEnds) {
			return [ 'lines' ].concat(lines.map(line => PARSER.line(line, true)));
		}

		trimEmptyLines(lines);
		let concated = [];
		let concatedLine = '';
		for (let i = 0; i < lines.length; i++) {
			let raw = lines[i];
			let trimed = raw.trim();
			let matched;
			if (trimed == '') {
				/**
				 * 重复的空行将被合并为一行。
				 */
				concatedLine && concated.push(concatedLine);
				concated.push('');
				concatedLine = '';
			}
			else if (matched = trimed.match(/^([#*])\s/)) {
				let [ WHOLE , bullet ] = matched;
				concatedLine && concated.push(concatedLine);
				concatedLine = trimed;
			}
			else if (concatedLine) {
				concatedLine += SPACE + trimed;
			}
			else {
				concatedLine = trimed;
			}
		}
		concatedLine && concated.push(concatedLine);
		return [ 'lines' ].concat(concated.map(PARSER.line));
	},

	'MANUAL': function(lines) {
		// Container to save child elements of root.
		let childs = [];

		// Container to cache the current section lines.
		let sectionLines = [];

		// Parse the current section and reset the container.
		let endSection = () => {
			if (sectionLines.length) {
				childs.push(PARSER.section(sectionLines));
				sectionLines = [];
			}
		};

		// Line by line.
		do {
			let line = lines.shift();

			// All lines have been analysed.
			if (line === undefined) {
				endSection();
				break;
			}

			let IW = getIndentWidth(line);
			if (IW == 0 && line.length /* not empty line */) {
				// It's a top heading line.
				endSection();
				sectionLines.push(line);
			}
			else if (sectionLines.length) {
				sectionLines.push(line);
			}
			else {
				// Discard leading lines before the first section.
				// DO NOTHING.
			}

		} while(true)

		// Head with element name.
		return [ 'root' ].concat(childs);
	},

	/**
	 * @param {string[]} lines 
	 */
	'section': function(lines) {
		let childs = [], line;

		// The first line is heading line.
		let name = lines.shift().trim().toUpperCase();
		childs.push([ 'heading', name ]);

		// Parse the remainder lines according different section types.
		let parser = PARSER['section.' + name];
		if (!parser) parser = PARSER['section.ELSE'];
		childs = childs.concat(parser(lines));
		
		// Head with element name.
		return [ 'section' ].concat(childs);
		;
	},

	'section.ARGUMENTS': function() {
		return PARSER['section.OPTIONS'].apply(null, arguments);
	},

	/**
	 * @param {string[]} lines 
	 */
	'section.NAME': function(lines) {
		let elements = [];
		for (let i = 0; i < lines.length; i++) {
			let line = lines[i];
			let matched = line.match(/^\s+((\w[\w\-]*\s+)+)\s*-\s*(.+)$/);
			if (matched) {
				let [ WHOLE, dt, COMMAND_NAME_PART, dd ] = matched;
				dt = dt.trim();
				dd = dd.trim();
				elements.push([ 'phrase', { dt, dd } ]);
			}
			else if (!/^\s*$/.test(line)) {
				elements.push(line);
			}
		}
		return elements;
	},

	/**
	 * @param {string[]} lines 
	 */
	'section.OPTIONS': function(lines) {
		let terms = [];

		/**
		 * Run until a blank line.
		 * 遇空行即止。
		 */
		let para = [];
		for (let i = 0; i < lines.length; i++) {
			/**
			 * Empty line is doubtless splitter between two paragraphes.
			 * 空行可视为两个段落的天然分界线。
			 */
			if (/^\s*$/.test(lines[i])) {
				terms.push(para);

				/**
				 * Reset current paragraph.
				 * 重置当前段落。
				 */
				para = [];
			}
			else {
				para.push(lines[i]);
			}
		}
		para.length && terms.push(para);

		return terms.map(PARSER.term);
	},

	/**
	 * @param {string[]} lines 
	 */
	'section.SYNOPSIS': function(lines) {
		/**
		 * Split and analyse.
		 * 先分拆，后分析。
		 */
		let commands = [], command = '';
		for (let i = 0, indent = TAB_SIZE; i < lines.length; i++) {
			let line = lines[i];

			/**
			 * Empty line is doubtless splitter between two commands.
			 * 空白行是两条命令之间的天然分界。
			 */
			if (/^\s*$/.test(line)) {
				command && commands.push(command);
				command = '';
				continue;
			}

			if (!command) {
				command = line;
				indent = line.match(/^\s*/)[0].length;
				continue;
			}
			
			/**
			 * Indented line is the succeeding to the previous line. 
			 * 缩进行可视为上一行的自然延续。
			 */
			let IW = getIndentWidth(line);
			if (IW > indent) {
				command += ' ' + line;
				continue;
			}

			/**
			 * If first word is not valid command name, 
			 * the line is regarded as the subsequence of the preivous line.
			 * 如果为首单词不是合法的命令名，
			 * 则该行也视为上一行的自然延续。
			 */
			if (!/^\s*[\w\-]+(\s|$)/.test(line)) {
				command += ' ' + line;
				continue;
			}

			command && commands.push(command);
			command = line;
		}
		command && commands.push(command);
		return commands.map(PARSER.command);
	},

	/**
	 * @param {string[]} lines 
	 */
	'section.ELSE': function(lines) {
		return [ PARSER.lines(lines) ];
	},

	/**
	 * @param {string[]} lines 
	 */
	'term': function(lines) {
		let dt = lines.shift().trim();
		DT: {
			let { element, remainder } = PARSER.argument(dt);
			if (element) {
				dt = element;
			}
			else {
				dt = [ 'lines', dt ];
			}
		}

		let dd = PARSER.lines(lines);

		return [ 'term', { dt, dd } ];
	},
};

function parse(text) {
	
	/**
	 * Split raw text into lines no matter what format it is (MAC/WIN/UNIX).
	 * 按行切分。
	 */
	let lines = text.split(/\r\n|\r|\n/);
	trimEmptyLines(lines);

	let features = {
		'name-section': false,
		'synopsis-section': false,
	};
	lines.forEach(line => {
		if (line == 'NAME') features['name-section'] = true;
		if (line == 'SYNOPSIS') features['synopsis-section'] = true;
	});
	let isManual = true;
	for (let name in features) {
		isManual = isManual && features[name];
	}

	if (isManual) {
		return PARSER.MANUAL(lines);
	}
	else {
		return PARSER.lines(lines.concat(''), true);
	}	
}

module.exports = parse;