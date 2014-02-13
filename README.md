##Git operations (Work in progress)
Help you perform basic git operations, all operations return promises for easier and better management.

##Usage:
###initializing

```
	var git = require('git-control'),
	newRepo =  git.repo({
		path: '../path/to/repo', //default to '.'
		gitDir: '../.git', //default to path + '/.git',
        workTree: 'path/to/work/tree' // default to path
	});

    newRepo.printInfo(); //output usefull information about the status.

```


###Available commands
exec: main function that is used by all other commands, execute the given git command, ex: `repo.exec('status');`<br>
log, status, tag, submodule, branch, fetch, checkout, pull, add, commit, printInfo

###Doc
Comming soon!

###Contribution
if you want to contribute to the project you are very welcome. let us know what you want to implement or submit directly your pull requests.

####TODO
tests<br>
jshint<br>
support more operations
