/**
 * git-control
 * Copyright Aboubakr GASMI <g13013@gmail.com>
 * License: MIT
 */

'use strict';

//TODO read .git file on submodules
//TODO implement exec-sync

var pio = require('promised-io/promise'),
    util = require('util'),
    path = require('path'),
    cp = require('child_process'),
    exec = cp.exec,
    cwd = process.cwd(),
    branchRe = /(\*)? +([^\n]+)[\n]?/g,
    tagsRe = /[\n]?([^\n]+)[\n]?/g,
    stagedRe = /(?:^|\n)[MADRC]\s+([^\n]+)/g,
    untrackedRe = /\?\?\s+([^\n]+)/g,
    modifiedRe = /(?:^|\n)\s[MADRCU]\s([^\n]+)/g,
    subRe = /(?:^|\n)(.+) (.+) \((.+)\)/g,
    ps = function (command, options, verbose, ignore) {
        var proc,
            deferred = pio.Deferred();
        proc = exec(command, options, function (err, stdout, stderr) {
            if (err) {
                if (verbose) {
                    console.log('Failed.\n');
                }
                if (ignore) {
                    deferred.resolve(false);
                } else {
                    deferred.reject(stderr);
                }
            } else {
                if (verbose) {
                    console.log('Ok.\n');
                }
                deferred.resolve(stdout);
            }
        });
        if (verbose) {
            proc.stderr.on('data', function (data) {
                console.warn(data.replace(/(^|\n)([^\n]+)/g, '$1\t\t$2'));
            });
        }
        return deferred;
    },
    collect = function (re, str) {//collects matching regex values
        var matches = [],
            match;
        if (!re.global) {
            match = re.exec(str);
            return match && match[1];
        }
        while ((match = re.exec(str)) !== null) {
            matches.push(match[1]);
        }
        return matches;
    },
    execSequence = function (list, scope) {
        var seq = list.map(function (name) {
            var args = [];
            if (name instanceof Array) {
                args = name.slice(1);
                name = name[0];
            } else {
                args = [];
            }
            return function () {
                return scope[name].apply(scope, args);
            };
        }, scope);
        return pio.seq(seq);
    };
var Git = function (options) {
    options = options || {};

    if (typeof options === 'string') {
        options = {path: options};
    }

    this.path = options.path || '.';
    this.workTree = options.workTree || options.path || this.workTree;
    this.gitDir = options.gitDir || (options.path && (options.path + '/.git')) || this.gitDir;
    this.verbose = options.verbose || false;
    this.safeMode = options.safeMode || true;
    this.info = null;
    this.getInfo.call(this, true);
    return this;
};

function copyState(dest, source) {
    var key;
    for (key in source) {
        dest[key] = source[key];
    }
}

Git.prototype = {
    path: cwd,
    gitDir: cwd + '/.git',
    workTree: cwd,
    exec: function (command, ignore) {
        if (this.verbose) {
            console.log('Executing Git command `' + command + '` at directory : ' + this.path);
            console.log('git-dir: ' + this.gitDir);
            console.log('work-tree: ' + this.workTree);
        }
        var self = this,
            paths = (this.path) ? ('--git-dir="' + path.resolve(this.gitDir) +  '" --work-tree="' + path.resolve(this.workTree) + '" '): '';
        command  = 'git ' + paths + command;
        return ps(command, {cwd: path.resolve(this.path)}, this.verbose, ignore);
    },
    getInfo: function (fetch) {
        var seq,
            git = this,
            info = pio.Deferred(),
            infoSeq = ['log', 'branch', 'status', 'tag', 'submodule'];

        this.info = info; //state is a deferred object

        fetch = (fetch !== false) ? true : false;

        if (fetch === true) {
            infoSeq.splice(1, 0, 'fetch');
        }

        copyState(info, {
            ahead: null,
            behind: null,
            currentRev: null,
            currentBranch: null,
            isClean: null,
            staged: null,
            isDetached: null,
            branches: null,
            tags: null,
            submodules: null,
            stagedFiles: null,
            modifiedFiles: null,
            untrackedFiles: null
        });

        execSequence(infoSeq, this).then(function () {
            info.resolve(info);
        }, function (reason) {
            info.reject('Error while getting repository info!');
        });

        return info;
    },
    log: function (command) {
        if (command) {
            return this.exec('log ' + command);
        }
        //Default action updates state
        var info = this.info,
            promise = this.exec('log -n 1 --pretty=format:"%H" | cat');
        return this.exec('log -n 1 --pretty=format:"%H" | cat').then(function (out) {
            info.sha = out;
            info.currentRev = out.substr(0, 7);
        });
    },
    status: function (command) {
        if (command) {
            return this.exec('status ' + command);
        }
        var info = this.info;
        return this.exec('status -s -b').then(function (out) {
            out.replace(/(ahead|behind) ([0-9]*)[\]\,]/, function (match, direction, nbr) {
                info[direction] = Number(nbr);
            });
            info.behind = info.behind || 0;
            info.ahead = info.ahead || 0;
            info.stagedFiles = collect(stagedRe, out);
            info.modifiedFiles = collect(modifiedRe, out).concat(info.stagedFiles);
            info.untrackedFiles = collect(untrackedRe, out);
            info.staged = !!info.stagedFiles.length;
            info.modified = !!info.modifiedFiles.length;
            info.isClean = !info.modifiedFiles.length;
        });
    },
    tag: function (command) {
        var args = ['exec'];
        if (command) {
            args.push('tag ' + command);
            return execSequence([args, 'tag'], this);
        }
        var info = this.info;
        return this.exec('tag').then(function (tagOutput) {
            info.tags = collect(tagsRe, tagOutput);
        });
    },
    submodule: function (command) {
        var args,
            self = this;
        if (command) {
            args = ['exec', 'submodule ' + command];
            return execSequence([args, 'submodule'], this);
        }

        var sub,
            info = this.info;

        if (info.submodules) {
            for (sub in info.submodules) {
                delete info.submodule[sub];
            }
        }

        return this.exec('submodule status').then(function (out) {
            var states = [];
            info.submodules = {};
            out.replace(subRe, function (match, sha, subPath, revState) {
                var subName = subPath.split('/').pop(),
                    repo = new Git({
                        path: subPath,
                        verbose: self.verbose,
                        safeMode: self.safeMode
                    });
                info.submodules[subName] = {
                    path: subPath,
                    sha: sha,
                    repo: repo
                };
                self.submodule[subName] = repo;
                states.push(repo.info);
            });
            return pio.all(states);
        });
    },
    branch: function (command) {
        var args = ['branch'];
        if (command) {
            args.push('branch ' + command);
            return execSequence([args, 'log', 'branch'], this);
        }
        var info = this.info;
        return this.exec('branch').then(function (data) {
            var branches = [];
            data.replace(branchRe, function (match, current, branch) {
                var detached;
                if (current) {
                    detached = /\(detached from ([^\)]+)\)/.exec(branch);
                    info.isDetached = !!detached;
                    if (info.isDetached) {
                        info.currentBranch = detached[1];
                    } else {
                        info.currentBranch = branch;
                        branches.push(branch);
                    }
                    return;
                }
                branches.push(branch);
            });
            info.branches = branches;
        });
    },
    fetch: function (all, includeTags, ignore) {
        var args;
        if (arguments.length) {
            all = (all) ? ' --all' : '';
            includeTags = (includeTags) ? ' --tags' : '';
            ignore = (ignore !== false) ? true : false;
            args = ['exec', 'fetch' + all + includeTags, ignore];
            return execSequence([args, 'tag'], this);
        }
        args = ['exec', 'fetch --tags', true];
        return execSequence([args], this);
    },
    checkout: function (rev, force) {
        var args,
            isTagVersion = /^tags\//.test(rev),
            tag = isTagVersion && rev.replace(/^tags\//, '');
        force = ((force) ? ' --force' : '');
        if ((isTagVersion && this.info.currentBranch !== tag) || this.info.currentBranch !== rev) {
            if (force || !this.safeMode || this.info.isClean) {
                args = ['exec', 'checkout ' + rev + force, false];
                return execSequence([args, 'log', 'branch'], this);
            }
            pio.Deferred().reject("Can't checkout revision  `" + rev + "` in the repository at path `" +
                           (this.path || this.workTree) +
                           "`, repository is not clean, \n call with `force` or set the `safeMode` option.");
        }
        return this.info;
    },
    pull: function (rebase, force) {
        var args;
        force = ((force) ? ' --force' : '');
        rebase = (rebase === true) ? ' --rebase' : '';
        if (force || !this.safeMode || (!this.info.ahead && !this.info.isDetached && this.info.isClean)) {
            args = ['exec', 'pull' + rebase + force, false, true];
            return execSequence([args, 'log'], this);
        } else {
            return pio.Deferred().reject("Can't pull changes in the repository at path `" +
                                (this.path || this.workTree) +
                                "`, repository is not clean or is detached, \n call with `force` or set the `safeMode` option.");
        }
    },
    add: function (files) {
        var self = this,
            args = ['exec'],
            seq;
        if (files instanceof Array) {
            files = files.join(' ');
        }
        args.push('add ' + files);
        return execSequence([args, 'status'], this);
    },
    commit: function (message) {
        var args = ['exec', 'commit -m "' + message + '" --no-verify', false];
        return execSequence([args, 'log'], this);
    },
    printInfo: function (force) {
        var self = this,
            renderArr = function (arr) {
                if (!arr || arr.length === 0) {
                    return '[]';
                }
                return "[\n        " + arr.join('\n        ') + '\n    ]';
            };
        if (force) {
            this.getInfo(true);
        }
        return this.info.then(function (info) {
            var key,
                sub = '',
                stMsg = [
                "    Unpushed: " + info.ahead,
                "    Commits behind: " + info.behind,
                "    Current revision: " + info.currentRev,
                "    Rev sha: " + info.sha,
                "    Current pointer/branch: " + info.currentBranch,
                "    Clean: " + info.isClean,
                "    Staged: " + info.staged,
                "    Detached: " + info.isDetached,
                "    Staged files: " + renderArr(info.stagedFiles),
                "    Modified files: " + renderArr(info.modifiedFiles),
                "    Untracked files: " + renderArr(info.untrackedFiles),
                "    Branches : " + renderArr(info.branches),
                "    Tags: " + renderArr(info.tags)
            ];
            for (key in info.submodules) {
                sub = sub + '\n        ' +  key + ' (' + info.submodules[key].path + '): ' + info.submodules[key].sha;
            }
            if (sub) {
                stMsg.push("    submodules:" + sub);
            }
            console.log('\n' + stMsg.join('\n'));
        });
    }
};

module.exports = {
    exec: function (command) {
        return Git.prototype.exec(command);
    },
    repo: function (path) {
        return new Git(path);
    }
};