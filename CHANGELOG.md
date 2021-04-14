#   manon Change Log

Notable changes to this project will be documented in this file. This project adheres to [Semantic Versioning 2.0.0](http://semver.org/).

##	[0.2.0] - 2021-04-14

*	允许 SYNOPSIS 中出现 literal 片断。
*	允许 NAME 中的出现逗号分隔的并列命令名。

##	[0.1.1] - 2021-03-04

*	在 SYNOPSIS 小节中，根据命令起始行的缩进，判断后续行是否为上一行的自然延续。  
	Following lines whose indent is more than the initial command line are regarded as extension of the previous line.

##	[0.1.0] - 2021-03-04

*	允许小节标题首尾包含空格。  
	Trim section head automatically.

*	命令名不允许以连字符起始。  
	Command name SHOULD NOT begin with dash (-) character.

##	[0.0.1] - 2021-03-02

Released.

---
This CHANGELOG.md follows [*Keep a CHANGELOG*](http://keepachangelog.com/).
