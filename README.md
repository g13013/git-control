# NOTE: git-control is no longer maintained because excellent projects that do the same thing like [nodegit](https://github.com/nodegit/nodegit) exist, and i strongly recommend using them instead.

# git-control (beta) [![Build Status](https://secure.travis-ci.org/g13013/git-control.png?branch=master)](http://travis-ci.org/g13013/git-control)

A node module that helps you perform git operations on a repository. To start, all operations are build arround [Promises/A](http://wiki.commonjs.org/wiki/Promises/A) promises for asynchronious implementation, but there is a plan to support synchronious commands too.

## Getting Started
Install the module with: `npm install git-control` and then:

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

## Documentation
_(Coming soon)_

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [Grunt](http://gruntjs.com/).

### TODO
* Implement tests (in progress)
* Support more operations
* Support synchronious operations

## License
Originally Written by [Aboubakr Gasmi](https://github.com/g13013/) and is licensed under the [MIT license](LICENSE.md)
