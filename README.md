##Git operations (Work in progress)
`git-control` is a node module that helps you perform git operations on a repository. To start, all operations are build arround [Promises/A](http://wiki.commonjs.org/wiki/Promises/A) promises for asynchronious implementation, but there is a plan to support synchronious commands too.

##Usage:
###initializing


	var git = require('git-control'),
	newRepo =  git.repo({
		path: '../path/to/repo', //default to '.'
		gitDir: '../.git', //default to path + '/.git',
        workTree: 'path/to/work/tree' // default to path
	});

    newRepo.printInfo(); //output usefull information about the status.



###Available commands
* exec, main function that is used by all other commands, execute the given git command, ex: `repo.exec('status');`
* log
* status
* tag
* submodule, (NOTE: exports also submodules, so if you have a submodule called `jquery` in your main repository `myLib`, you could access its `git-control` repository instance using `myLib.submodule.jquery`)
* branch
* fetch
* checkout
* pull
* add
* commit
* printInfo

###Doc
Comming soon!

###Contribution
If you want to contribute to the project you are very welcome. let us know what you want to implement or submit directly your pull requests.

###TODO
* Implement tests
* jshint
* Support more operations
* Support synchronious operations

##License
Originally Written by [Aboubakr Gasmi](https://github.com/g13013/) and is licensed under the [MIT license](LICENSE.md)

