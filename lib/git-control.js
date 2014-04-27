/**
 * git-control
 * Copyright Aboubakr GASMI <g13013@gmail.com>
 * License: MIT
 */

'use strict';

//TODO read .git file on submodules
//TODO implement exec-sync

var pio = require('promised-io/promise'),
    _util = require('./utils'),
    parseConfig = _util.parse,
    merge = _util.merge,
    path = require('path'),
    cp = require('child_process'),
    exec = cp.exec,
    cwd = process.cwd(),
    fs = require('fs'),
    branchRe = /(\*)? +([^\n]+)[\n]?/g,
    tagsRe = /[\n]?([^\n]+)[\n]?/g,
    stagedRe = /(?:^|\n)[MADRC]\s+([^\n]+)/g,
    untrackedRe = /\?\?\s+([^\n]+)/g,
    modifiedRe = /(?:^|\n)\s[MADRCU]\s([^\n]+)/g,
    subRe = /([\s+-U])?([^\s]+)\s([^\s]+)(?:\s\(([^\s]+)\))?\s?/gm,
    ps = function (command, options) {
      options = options || {};
      var proc, cmd, opt, resolved,
          deferred = pio.Deferred();
      //TODO check command type
      if (typeof command === 'string') {
        cmd = command;
      } else {
        cmd = command.cmd;
        opt = command.opt;
      }

      proc = exec(cmd, opt, function (err, stdout, stderr) {
        if (err) {
          if (options.verbose) {
            process.stdout.write('Failed\n');
          }
          if (resolved) {
            return;
          }
          if (options.ignore) {
            deferred.resolve(false);
          } else {
            deferred.reject(stderr);
          }
        } else {
          if (options.verbose) {
            process.stdout.write('Ok\n');
          }
          deferred.resolve(stdout);
        }
        resolved = true;
      });

      if (options.timeout && options.timeout > 0) {
        setTimeout(function () {
          proc.kill();
          if (resolved) {
            return;
          }
          resolved = true;
          if (options.ignore) {
            deferred.resolve(false);
            return;
          }
          deferred.reject('Aborted due to timeout!');
        }, options.timeout * 1000);
      }

      if (options.verbose) {
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
  var define = _util.defineComputed.bind(this, this);

  options = options || {};

  this.define = define;

  define('workTree', function (old) {
    return old || path.resolve(this.path);
  });

  define('name', function (old) {
    return old || path.basename( path.resolve(this.path) );
  });

  define('gitDir', function (old) {
    if (old) {
      return old;
    }

    var gitDir = this.path + '/.git';

    if (!fs.existsSync(gitDir)) { //if not found use current directory
      return '.';
    }

    if (fs.statSync(gitDir).isFile()) {
      gitDir = fs.readFileSync(gitDir, 'UTF-8').replace('gitdir: ', '');
    }

    return path.resolve(gitDir);
  });

  define('config', function () {
    return parseConfig(this.gitDir + '/config', true);
  }, function () {
    throw new Error('TODO: implement config writing');
  });

  if (typeof options === 'string') {
    options = {path: options};
  }

  return merge(this, options, {
    info : {
      then: function (successHandler, errorHandler) {
        if (!this.isSubmodule) {
          return this.getInfo(true).then(successHandler, errorHandler);
        }
        return this.parent.submodule.initUpdate().then(function () {
          return this.getInfo(true).then(successHandler, errorHandler);
        }.bind(this));
      }.bind(this)
    }
  });
};

Git.prototype = {
  path: cwd,
  parent: null,
  isSubmodule: false,
  verbose: false,
  safeMode: true,
  isInititalized: false,
  isUpdated: false,
  saved: false,
  defaultTimeout: null,
  exec: function (command, ignore, timeout) {
    if (this.verbose) {
      process.stdout.write('[' + this.name + '] Executing Git command `' + command + '` ...');
    }
    var paths = (this.path) ? ('--git-dir="' + this.gitDir +  '" --work-tree="' + this.workTree + '" '): '';
    command  = 'git ' + paths + command;
    return ps({
      cmd: command,
      opt: {cwd: path.resolve(this.path)}
    }, {
      verbose: this.verbose,
      ignore: ignore,
      timeout: timeout || this.defaultTimeout
    });
  },
  getInfo: function (fetch) {
    var self = this,
        info = pio.Deferred(),
        infoSeq = ['log', 'branch', 'status', 'tag', 'submodule'];

    this.info = info; //state is a deferred object

    fetch = (fetch !== false) ? true : false;

    if (fetch === true) {
      infoSeq.splice(1, 0, 'fetch');
    }

    merge(info, {
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
      var err = (typeof reason === 'string') ? reason : (reason && reason.message);
      info.reject('Error while getting repository info: ' + err);
    });

    return info;
  },
  log: function (command) {
    if (command) {
      return this.exec('log ' + command);
    }
    //Default action updates state
    var info = this.info;
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
      info.behind = info.behind || 0;
      info.ahead = info.ahead || 0;
      info.stagedFiles = collect(stagedRe, out);
      info.modifiedFiles = collect(modifiedRe, out).concat(info.stagedFiles);
      info.untrackedFiles = collect(untrackedRe, out);
      info.staged = !!info.stagedFiles.length;
      info.modified = !!info.modifiedFiles.length;
      info.isClean = !info.modifiedFiles.length;
    });
  },
  tag: function (command) {
    var info,
        args = ['exec'];
    if (command) {
      args.push('tag ' + command);
      return execSequence([args, 'tag'], this);
    }
    info = this.info;
    return this.exec('tag').then(function (tagOutput) {
      info.tags = collect(tagsRe, tagOutput);
    });
  },
  submodule: function (command) {
    var args, sub, info,
        self = this;
    if (command) {
      args = ['exec', 'submodule ' + command];
      return execSequence([args, 'submodule'], this);
    }

    info = this.info;

    if (info.submodules) {
      /*jshint -W089*/
      for (sub in info.submodules) {
        delete info.submodule[sub];
      }
    }

    merge(self.submodule, {
      isInititalized: true,
      isUpdated: true,
      hasConflicts: true
    });

    self.submodule.update = function () {
      if (self.isUpdated) {
        return pio.whenPromise();
      }
      return execSequence([['exec', 'submodule update']], self).then(function () {
        self.isUpdated = true;
      });
    };

    self.submodule.init = function () {
      if (self.isInititalized) {
        return pio.whenPromise();
      }
      return execSequence([['exec', 'submodule init']], self).then(function () {
        self.isInititalized = true;
      });
    };

    self.submodule.initUpdate = function () {
      if (self.isUpdated) {
        return pio.whenPromise();
      }
      return execSequence([['exec', 'submodule update --init --recursive']], self).then(function () {
        self.isInititalized = true;
        self.isUpdated = true;
      });
    };

    return this.exec('submodule status').then(function (out) {
      var submodule,
          states = [],
          register = function (sha, subPath, revision, state) {
            var repo,
                isInititalized = state !== '-',
                isUpdated = state !== '+',
                hasConflicts = state === 'U',
                subName = subPath.split('/').pop(),
                subObj = info.submodules[subName];
            subObj = subObj || {
              repo: new Git({
                path: path.join(self.workTree, subPath),
                parent: self,
                gitDir: self.gitDir + '/modules/' + subPath,
                isSubmodule: true,
                isInititalized: isInititalized,
                verbose: self.verbose,
                defaultTimeout: self.defaultTimeout,
                safeMode: self.safeMode
              })
            };

            repo = subObj.repo;

            if (!isInititalized) {
              self.isInititalized = false;
            }
            if (!isUpdated) {
              self.isUpdated = false;
            }

            merge(subObj, {
              isInititalized: isInititalized,
              isUpdated: isUpdated,
              hasConflicts: hasConflicts,
              path: revision,
              sha: sha,
              repo: repo
            });

            info.submodules[subName] = subObj;
            self.submodule[subName] = repo;
            states.push(repo.info);
          };

      info.submodules = {};
      while ((submodule = subRe.exec(out))) {
        register(submodule[2], submodule[3], submodule[4], submodule[1]);
      }
      if (states.length > 0) {
        return pio.all(states);
      }
    });
  },
  branch: function (command) {
    var args = ['branch'],
        info;
    if (command) {
      args.push('branch ' + command);
      return execSequence([args, 'log', 'branch'], this);
    }
    info = this.info;
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
  fetch: function (all, includeTags, ignore, timeout) {
    var args;
    timeout = timeout || this.defaultTimeout || 10;
    if (arguments.length) {
      all = (all) ? ' --all' : '';
      includeTags = (includeTags) ? ' --tags' : '';
      ignore = (ignore !== false) ? true : false;
      args = ['exec', 'fetch' + all + includeTags, ignore, timeout];
      return execSequence([args, 'tag'], this);
    }
    args = ['exec', 'fetch --tags', true, timeout];
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
      pio.Deferred().reject('Can\'t checkout revision  `' + rev + '` in the repository at path `' +
               (this.path || this.workTree) +
               '`, repository is not clean, \n call with `force` or set the `safeMode` option.');
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
      return pio.Deferred().reject('Can\'t pull changes in the repository at path `' +
                (this.path || this.workTree) +
                '`, repository is not clean or is detached, \n call with `force` or set the `safeMode` option.');
    }
  },
  add: function (files) {
    var args = ['exec'];
    if (files instanceof Array) {
      files = files.map(function (file) {
        return '"' + file + '"';
      }).join(' ');
    }
    args.push('add ' + files);
    return execSequence([args, 'status'], this);
  },
  commit: function (message) {
    var args = ['exec', 'commit -m "' + message + '" --no-verify', false];
    return execSequence([args, 'log'], this);
  },
  stash: function (command, message, opt) {
    if (arguments.length === 1 && typeof command !== 'string') {
      opt = command;
      command = 'save';
      message = '';
    } else if (arguments.length === 2 && typeof message !== 'string') {
      opt = message;
      message = '';
    } else {
      command = command || 'save';
      message = message || '';
    }
    opt = opt || {};
    var untracked = (opt.includeUntracked === true) ? '-u' : '',
        keepIdx = (opt.keepIndex === true) ? '--keep-index' : '',
        cmd = ['stash', command, keepIdx, untracked, message],
        args = ['exec', cmd.join(' '), false];
    return execSequence([args], this);
  },
  saveRestore: function () {
    var self = this;
    if (!self.saved) {
      return self.stash('save', {includeUntracked: true}).then(function () {
        self.saved = true;
      });
    }
    return self.stash('pop').then(function () {
      self.saved = false;
    });
  },
  printInfo: function (full, force) {
    var self = this,
        str, output = {};
    if (force) {
      return this.getInfo(true).then(function () {
        return self.printInfo(full, force);
      });
    }

    return this.info.then(function (info) {
      var key, sub;
      /*jshint -W069 */
      output['Unpushed'] = info.ahead;
      output['Commits behind'] = info.behind;
      output['Current revision'] = info.currentRev;
      output['Rev sha'] = info.sha;
      output['Current pointer/branch'] = info.currentBranch;
      output['Clean'] = info.isClean;
      output['Staged'] = info.staged;
      output['Detached'] = info.isDetached;
      output['Staged files'] = info.stagedFiles;
      output['Modified files'] = info.modifiedFiles;
      output['Untracked files'] = info.untrackedFiles;
      output['Branches'] = info.branches;
      output['Tags'] = info.tags;
      if (full) {
        output['config'] = self.config;
        output['Sub modules'] = info.submodules;
      } else {
        output['Sub modules'] = sub = {};
        /*jshint -W089 */
        for (key in info.submodules) {
          sub[key] = {
            path: info.submodules[key].repo.path,
            currentRev: info.submodules[key].repo.info.currentRev,
            isInititalized: info.submodules[key].isInititalized,
            isUpdated: info.submodules[key].isUpdated,
            hasConflicts: info.submodules[key].hasConflicts
          };
        }
      }
      str = JSON.stringify(output, null, 2);
      str = str.replace(/(^{|}$)/g, '');
      str = str.replace(/"/gm, '');
      console.log(str);
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
