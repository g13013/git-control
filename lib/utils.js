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

function defineComputed(obj, name, getter, setter) {
  var descriptor, cache = {};
  descriptor = {
    enumerable: true,
    configurable: true,
    set: function (value) {
      if (setter) {
        value = setter.call(obj, value, cache[name]);
      }
      cache[name] = value;
      return value;
    },
    get: function () {
      if (!getter) {
        return obj[name];
      }
      return getter.call(obj, cache[name]);
    }
  };

  Object.defineProperty(obj, name, descriptor);
}

module.exports = merge({
  merge: merge,
  mergeIf: mergeIf,
  isNone: isNone,
  defineComputed: defineComputed
}, gitConfig);
