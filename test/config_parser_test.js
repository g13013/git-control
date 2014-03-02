'use strict';

var gitConfig = require('../lib/utils/git-config-parser.js');

exports.parse = {
  setUp: function(done) {
    // setup here
    done();
  },
  config: function(test) {
    var expected,
        config = gitConfig.parse('./test/sample_config');
    test.expect(1);
    expected = {
      core: {
        repositoryformatversion: 0,
        filemode: true,
        bare: false
      },
      remote: {
        origin: {
          url: 'https://github.com/g13013/git-control.git',
          fetch: '+refs/heads/*:refs/remotes/origin/*'
        }
      },
      branch: {
        master: {
          remote: 'origin',
          merge: 'refs/heads/master'
        }
      }
    };

    test.deepEqual(config, expected, 'should return an object of sample_config');
    test.done();
  }
};
