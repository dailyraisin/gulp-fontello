/**
 * Created by gillbeits on 01/04/15.
 */

var
  HOST        = 'http://fontello.com',

  needle      = require('needle-retry-x'),
  through2    = require('through2'),
  path        = require('path'),
  $           = require('gulp-util'),
  Decompress  = require('decompress'),

  PluginError = $.PluginError
  ;

var needleOptions = {
    open_timeout: 2000,
    retry_request_on_error_code: ['ECONNRESET', 'ENOTFOUND'],
    retry_request: true
};

const PLUGIN_NAME = 'gulp-fontello';
var isWindows = /^win/.test(process.platform);

function addMultipart (obj) {
    obj.multipart = true;
    return obj;
}

function fontello () {
  "use strict";

  return through2.obj(function (file, enc, callback) {

    if (!file.isBuffer() || !file.path) {
      throw new PluginError(PLUGIN_NAME, "No config file for Fontello");
    }
    var self = this;

    var stream = through2.obj(function (file) {
      if (!file.toString()) {
        throw new PluginError(PLUGIN_NAME, "No session at Fontello for zip archive");
      }

      var zipFile;
      zipFile = needle.get(HOST + "/" + file.toString() + "/get", needleOptions, function(error) {
        if (error) {
          throw error;
        }
      });

      var buffer = [];
      zipFile.on('data', function(d) { buffer.push(d); })
      zipFile.on('end', function() {
        var decompress = new Decompress();
        decompress
          .src(Buffer.concat(buffer))
          .use(Decompress.zip())
          .run(function(err, files) {
            if(err) {
              throw new PluginError(PLUGIN_NAME, err);
            }
            files.forEach(function(entry) {
              var dirName, fileName, pathName, type, _ref, chunks = [];
              pathName = entry.path;
              entry.pipe(through2.obj(function (chunk, enc, cb) {
                  chunks.push(chunk);
                  cb();
                },
                function (cb) {
                  if(chunks.length > 0){
                    dirName = (_ref = path.dirname(pathName).match(/\/([^\/]*)$/)) != null ? _ref[1] : void 0;

                    if(isWindows) {
                      fileName = path.posix.basename(pathName).split('\\');
                      fileName.shift(); //removes temporary folder
                      fileName = fileName.join('\\');
                    } else {
                      fileName = path.basename(pathName);
                    }

                    entry.path = fileName;

                    var file = new $.File({
                      cwd : "./",
                      path : (dirName ? (dirName + '/') : '')+ entry.path,
                      contents: Buffer.concat(chunks)
                    });
                    self.push(file);
                  }
                  cb()
              }));
          });
          callback();
        });
      });
    });

    needle.post(
      HOST,
      {
        config: {
          file: file.path,
          content_type: 'application/json'
        }
      }, addMultipart(needleOptions), function(error) {
        if (error) {
          throw error;
        }
      }
    ).pipe(stream);
  });
}

module.exports = fontello;
