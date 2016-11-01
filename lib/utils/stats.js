/* eslint-disable camelcase, no-underscore-dangle */
'use strict';

var request = require('request');
var IonicAppLib = require('ionic-app-lib');
var IonicConfig = IonicAppLib.config;
var ionicConfig;
var IonicInfo = IonicAppLib.info;

var proxy = process.env.PROXY || process.env.http_proxy || null;

function track(event, uuid, data, callback) {
  data = {
    _event : event,
    _uuid: uuid,
    data: data
  };

  request({
    url: 'https://t.ionic.io/event/cli',
    method: 'POST',
    json: data,
    proxy: proxy
  }, function(err, res, body) {
    callback(err, res, body);
  });
}

function createId() {
  var d = new Date().getTime();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = (d + Math.random() * 16) % 16 | 0;
    d = Math.floor(d / 16);
    return (c === 'x' ? r : (r & 0x7 | 0x8)).toString(16);
  });
}

// update any aliases with the full cmd so there's a common property
function mapAliases(args) {
  var aliasMap = {
    rm: 'remove',
    ls: 'list',
    up: 'update',
    '-w': '--no-cordova',
    '-b': '--nobrowser',
    '-r': '--nolivereload',
    '-x': '--noproxy',
    '-l': '--livereload',
    '-c': '--consolelogs',
    '-s': '--serverlogs',
    '-n': '--no-email'
  };

  return args.map(function(arg) {
    var lowerCaseArg = arg.toLowerCase();
    return (aliasMap[lowerCaseArg]) ? aliasMap[lowerCaseArg] : arg;
  });
}

function mp(e, d) {
  var uniqueId = ionicConfig.get('ank');
  if (!uniqueId) {
    uniqueId = createId();
    ionicConfig.set('ank', uniqueId);
  }
  track(e, uniqueId, d, function(err, data) { // eslint-disable-line no-unused-vars,handle-callback-err
  });
}

function t(additionalData) {
  return IonicConfig.promiseLoad().then(function(info) {
    ionicConfig = info;
    return tPromise(additionalData);
  });
}

function tPromise(additionalData) {
  
  if (process.argv.length < 3) return;

  if (ionicConfig.get('statsOptOut') === true) {
    return;
  }

  var cmdName = process.argv[2].toLowerCase();
  var cmdArgs = (process.argv.length > 3 ? process.argv.slice(3) : []); // skip the cmdName

  var statsData = additionalData || {};
  var platforms = [];
  var releaseTag;

  // update any aliases with the full cmd so there's a common property
  cmdArgs = mapAliases(cmdArgs);

  var platformWhitelist = 'android ios firefoxos wp7 wp8 amazon-fireos blackberry10 tizen'.split(' ');
  var argsWhitelist = ('add remove list update check debug release search --livereload --consolelogs --serverlogs ' +
    '--no-cordova --nobrowser --nolivereload --noproxy --no-email --debug --release --device --emulator --sass ' +
    '--splash --icon').split(' ');

  platforms = cmdArgs.filter(function(cmd) {
    return platformWhitelist.indexOf(cmd) !== -1;
  });

  // create a platform property only when there is 1 or more
  if (platforms.length) {
    statsData.platform = platforms.sort().join(',');
  }

  statsData = cmdArgs
    .filter(function(cmd) {
      return argsWhitelist.indexOf(cmd) !== -1;
    })
    .concat(platforms)
    .reduce(function(argObj, cmd) {
      argObj[cmd] = true;
      return argObj;
    }, statsData);

  return IonicConfig.promiseLoad().then(function(info) {
    ionicConfig = info;
    return IonicInfo.gatherInfo();
  }).then(function(info) {
    statsData.email = ionicConfig.get('email');
    statsData.account_id = ionicConfig.get('id');

    if (info.cli_version) {
      releaseTag = info.cli_version.split('-')[1];
    }
    if (releaseTag) {
      statsData.cli_release_tag = releaseTag.split('.')[0];
    }
    mp(cmdName, ({
      ionic_version: info.ionic,
      cli_version: info.ionic_cli,
      os: info.os,
      gulp: info.gulp,
      node: info.node
    }, statsData));
  });
}

module.exports = {
  t: t
};
