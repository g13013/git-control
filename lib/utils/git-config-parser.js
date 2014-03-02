'use strict';
var fs = require('fs'),
  sectionRe = /\[(\w+)(?:\s+")?(\w+)?"?\]([^\[]+)/gm,
  paramRe = /(?:[\s\t]+)?(.*)\s+?=\s+?(.*)\s?/gm,
  getSection = function (content) {
    var section;
    if ((section = sectionRe.exec(content))) {
      return {
        name: section[1],
        sub: section[2],
        content: section[3]
      };
    }
  };

module.exports  = {
  parse: function (path) {
    path = path || '.git/config';
    var section,
      node,
      param,
      value,
      configContent = fs.readFileSync(path),
      config = {};
    while((section = getSection(configContent))) {
      node = config[section.name] = config[section.name] || {};
      if (section.sub) {
        node[section.sub] = node[section.sub] || {};
        node = node[section.sub];
      }
      while((param = paramRe.exec(section.content))) {
        value = param[2];
        if (!isNaN(Number(value))) {
          value = Number(value);
        } else if (value === 'true') {
          value = true;
        } else if (value === 'false') {
          value = false;
        }
        node[param[1]] = value;
      }
    }
    return config;
  },
  toJSON: function (path, config) {
    config = config || this.parse(path);
    fs.writeFileSync(path, JSON.stringify(config, null, 2));
  }
};
