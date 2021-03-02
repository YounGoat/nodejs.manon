#	解析

参照 test/help.js 文件所示的例子，一个抽象结构由数组和对象两种元素构成。大部分元素都以数组的形式表述：

```javascript
// ELEMENT "string"
[
	"string",
	"SYNOPSIS",
]

/**
 * 字符串元素是基本元素。
 * 通常情况下，可以简化为一个字符串。
 */
"SYNOPSIS"

// ELEMENT "headings"
[
	/**
	 * 第一个值代表该元素的类别。
	 */
	"headings",

	/**
	 * 第二个及后续的值代表元素的内容，也就是子元素。
	 */
	"SYNOPSIS"
]

// ELEMENT "lines"
[
	"lines",
	"Type of homepage",
    "By default, the homepage defined in package.json will be opened."
]
```