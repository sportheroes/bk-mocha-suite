'use strict';

const yn = require('yn');

const DEFAULT_NUMBER_OF_RETRIES = 4;
const DISABLE_TEST_RETRY = yn(process.env.DISABLE_TEST_RETRY);

var SETUP_METHODS = ["before", "beforeEach", "beforeAll", "after", "afterEach", "afterAll"];
var EXCLUSIVE_METHODS = ["only"];
var IT_METHODS = ["it", "xit"];
var THAT_METHODS = ["that", "xthat"];
var SET_METHODS = ["setBefore", "setAfter", "setBeforeAll", "setAfterAll"];
var REPLACE_METHOD = ["replaceWith"];
var utils = require("./utils");

var _ = require("underscore");

var callMethod = function (name) {
  return global[name + "Method"];
};

var hasMethod = function (name) {
  if (name === 'only') {
    return true;
  }

  const callName = `${name}Method`;

  return global[callName];
};

var callHandler = function (f, callName, ctx) {
  // Allow number of retries to be dynamically changed within the runtime context of a test
  const numberOfRetries = process.env.RETRIES_ON_FAILED_TESTS || DEFAULT_NUMBER_OF_RETRIES;
  var fcall;

  if (f.useDone) {
    fcall = function (done) {
      if (!DISABLE_TEST_RETRY) {
        this.retries(numberOfRetries);
      }

      this.suit = ctx;
      return f.fcall.call(this, done);
    };
  } else {
    fcall = function () {
      if (!DISABLE_TEST_RETRY) {
        this.retries(numberOfRetries);
      }

      this.suit = ctx;
      return f.fcall.call(this);
    };
  }

  var args = [fcall];
  if (typeof f.msg === "string") {
    args.unshift(f.msg)
  }

  const method = (callName !== 'only') ?
    global[callMethod(callName)] :
    global['it'][callName];

  method.apply({}, args);
};

var processHandler = function (methods, Suit, ctx) {
  methods.forEach(function (callName) {
    var containerName = "__" + callName;
    var canBeCalled = hasMethod(callName);

    if (Suit[containerName] && canBeCalled) {
      Suit[containerName].forEach(function (f) {
        if (f.suit) {
          processHandler([callName], f.suit, ctx);
        } else {
          callHandler(f, callName, ctx)
        }
      });
    }
  });
};

module.exports = function generateDescribe(list, ctx, caseDescribe, modifiers) {
  var TargetSuit = list.shift();
  var RunningSuit = _.where(modifiers.replaceWith, {
    targetSuit: TargetSuit
  });

  if (RunningSuit.length > 0) {
    RunningSuit = RunningSuit[0].newSuit;
  } else {
    RunningSuit = TargetSuit;
  }
  var describeString = String(TargetSuit.describe);
  describeString = utils.dotEndString(describeString);

  var run = function () {
    this.suit = ctx;
    RunningSuit.fcall && RunningSuit.fcall.call(this);

    processHandler(SET_METHODS, {
      __setBefore: _.where(modifiers.setBefore.__setBefore, {
        targetSuit: TargetSuit
      }),
      __setBeforeAll: _.where(modifiers.setBefore.__setBeforeAll, {
        targetSuit: TargetSuit
      })
    }, ctx);

    processHandler(SETUP_METHODS, RunningSuit, ctx);

    processHandler(SET_METHODS, {
      __setAfter: _.where(modifiers.setAfter.__setAfter, {
        targetSuit: TargetSuit
      }),
      __setAfterAll: _.where(modifiers.setAfter.__setAfterAll, {
        targetSuit: TargetSuit
      })
    }, ctx);

    if (list.length == 0) {
      if (caseDescribe.length > 0) {
        global[callMethod("describe")](caseDescribe, function () {
          processHandler(IT_METHODS, RunningSuit, ctx);
        });
      } else {
        if (RunningSuit['__only'] && RunningSuit['__only'].length > 0) {
          processHandler(EXCLUSIVE_METHODS, RunningSuit, ctx);
        } else {
          processHandler(IT_METHODS, RunningSuit, ctx);
        }
      }
    }

    if (list.length > 0) {
      generateDescribe(list, ctx, caseDescribe, modifiers);
    } else {
      processHandler(THAT_METHODS, modifiers.that, ctx);
    }
  };

  if (TargetSuit.skip) {
    global[callMethod("xdescribe")](describeString, run);
  } else {
    global[callMethod("describe")](describeString, run);
  };
};

module.exports.EXCLUSIVE_METHODS = EXCLUSIVE_METHODS;
module.exports.IT_METHODS = IT_METHODS;
module.exports.REPLACE_METHOD = REPLACE_METHOD;
module.exports.SET_METHODS = SET_METHODS;
module.exports.SETUP_METHODS = SETUP_METHODS;
module.exports.THAT_METHODS = THAT_METHODS;
