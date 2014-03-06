'use strict';
var gitConfig = require('./utils/git-config-parser.js'),
    apSlice = Array.prototype.slice;

function isNone(value) {
  return value !== null && value !== undefined;
}

function merge(obj, source) {
  var key,
      list;
  if (arguments.length > 2) {
    list = apSlice.call(arguments, 1);
    list.forEach(function (sourceN) {
      merge(obj, sourceN);
    });
    return obj;
  }

  for (key in source) {
    if (source.hasOwnProperty(key)) {
      obj[key] = source[key];
    }
  }
  return obj;
}

function mergeIf(obj, source) {
  var key,
      list;
  if (arguments.length > 2) {
    list = apSlice.call(arguments, 1);
    list.forEach(function (sourceN) {
      mergeIf(obj, sourceN);
    });
    return obj;
  }

  for (key in source) {
    if (source.hasOwnProperty(key) && !isNone(obj[key])) {
      obj[key] = source[key];
    }
  }
  return obj;
}

module.exports = merge({
  merge: merge,
  mergeIf: mergeIf,
  isNone: isNone
}, gitConfig);
