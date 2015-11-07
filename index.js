var basename  = require('path').basename;
var dirname   = require('path').dirname;
var extname   = require('path').extname;
var debug     = require('debug')('metalsmith-pandoc');
var pdcPath   = require('pandoc-bin').path;
var pdc       = require('pdc');
var minimatch = require('minimatch');
var each      = require('async-each');
var which     = require('which');
var fs        = require('fs');
var platform  = require('os').platform;

// use pandoc-bin
pdc.path = pdcPath;
// check if installation of pandoc-bin is ok
fs.stat(pdcPath, function(err, stats){
  if (err || !isExecutable(stats.mode)) {
    console.log('metalsmith-pandoc: trouble with pandoc-bin installation');
    console.log('metalsmith-pandoc: trying to use system installed pandoc');
    // try to use system installed pandoc
    which('pandoc', function(err,cmd){
      if (!err) pdc.path = cmd;
      else console.log('metalsmith-pandoc: ERROR pandoc not found');
    });
  }
});

function isExecutable(mode){
  if (platform() === 'win32') return true;  // do not check +x on windows
  var unixMode = mode & 07777;
  return (unixMode % 2 == 1);
}


/**
 * Expose `plugin`.
 */

module.exports = plugin;

/**
 * Metalsmith plugin to convert files using pandoc.
 *
 */

function plugin(options){
  options = options || {};
  var from = options.from || 'markdown';
  var to   = options.to   || 'html5';
  var args = options.args || [];
  var opts = options.opts || [];
  var pattern = options.pattern || '**/*.md';
  var extension = options.ext || '.html';

  return function(files, metalsmith, done){
    each(Object.keys(files), function(file, cb){
      debug('Checking file: %s', file);
      if (!minimatch(file, pattern)) {
        cb(); // count
        return; // do nothing
      }
      var data = Object.create(files[file]);
      var dir = dirname(file);
      var dest = basename(file, extname(file)) + extension;
      if ('.' != dir) dest = dir + '/' + dest;
      args.unshift("--output=" + dest);

      debug('Converting file %s', file);
      var md = data.contents.toString();
      debug("from %s to %s args %s opts %s", from, to, args, opts);
      pdc(md, from, to, args, opts, function(err,res){
        if (err){
          msg = 'metalsmith-pandoc: ' + file + ' - ' + err;
          debug(msg);
          cb(msg);
          return;
        }
        fs.readFile(dest, function(err,res) {
          if (err){
            msg = 'metalsmith-pandoc: read ' + file + ' - ' + err;
            debug(msg);
            cb(msg);
            return;
          }
          data.contents = new Buffer(res);
          fs.unlink(dest, function(err) {
            if (err){
              msg = 'metalsmith-pandoc: unlink ' + file + ' - ' + err;
              debug(msg);
              cb(msg);
              return;
            }
            if (!options.keep) {
              delete files[file];
            }
            files[dest] = data;
            debug('Converted file %s to %s...', file, dest);
            cb();
          });
        });
      });
    }, done);
  };
}
