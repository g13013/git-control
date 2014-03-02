'use strict';

var repo,
    git_control = require('../lib/git-control.js');

exports['config'] = {
  setUp: function(done) {
    repo = git_control.repo();
    // setup here
    done();
  },
  'repo config': function(test) {
    repo.info.then(function () {
      test.done();
      test.ok(typeof repo.config === 'object', 'should parse config');
    });
  },
};
