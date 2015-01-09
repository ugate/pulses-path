'use strict';

var util = require('util');
var fs = require('fs');
var path = require('path');
var pulses = require('pulses');
var PulseEmitter = pulses.PulseEmitter;

util.inherits(PathEmitter, PulseEmitter);

var ppath = exports;
ppath.PathEmitter = PathEmitter;

/**
 * Traverses a series of paths
 * 
 * @class PathEmitter
 * @arg {RegExp} skipper an optional exclusionary regular expression or function(path) w/return value used to determine if a path will be skipped
 */
function PathEmitter(skipper) {
    var pw = this, cns = ['stats', 'mkdir'], dirSplit = /[\/\\]+/g;
    PulseEmitter.call(pw);
    pw.skip = function skip(pth) {
        if (util.isRegExp(skipper)) {
            rx.lastIndex = 0;
            return rx.test(pth);
        }
        return skipper && typeof skipper === 'function' ? skipper(pth) : false;
    };
    pw.Paths = function Paths(path, waitForDeps) {
        var po = this;
        for (var i = 0; i < cns.length; i++) {
            po[cns[i]] = { cnt: 0, ttl: 0 };
        }
        po.path = path;
        po.paths = pth ? Array.isArray(pth) ? pth : [pth] : [];
        po.waitForDeps = waitForDeps;
        po.ready = false;
    };
    pw.Work = function Work(src, dest, waitForSrcDeps, waitForDestDeps) {
        var wrk = this, map = [];
        wrk.src = new pw.Paths(src, waitForSrcDeps);
        wrk.dest = new pw.Paths(dest, waitForDestDeps);
    };
    pw.walk = function walk(src, dest) {
        pw.emit('paths', 'stats', 'src', true, true, new pw.Work(src, dest, false, true));
    };
    pw.on('paths', function paths(evt, typ, skips, split, wrk) {
        var po = wrk[typ], poc = po[evt], dup = {};
        for (var i = 0, l = po.paths.length, pth; i < l; i++) {
            pth = path.normalize(po.paths[i]);
            if (skips && pw.skip(pth)) {
                continue;
            }
            for (var j = 0, pa = split ? pth.split(dirSplit) : [pth], pl = pa.length, pr = ''; j < pl; j++) {
                if (dup[pa[j] + j]) {
                    continue; // prevent duplicates
                }
                dup[pa[j] + j] = true;
                pr = path.join(pr, pa[j]); // accumulative path used so original path is maintained
                poc.ttl++;
                pw.emitAsync(evt, pa.slice(0, j), pr, typ, wrk);
            }
        }
    });
    pw.on('stats', function stats(deps, pth, typ, wrk) {
        if (wrk[typ].waitForDeps && deps && deps.length) {
            pw.after('stats', deps, deps, pth, typ, wrk);
        } else {
            fs.stat(pth, pw.callback('statsDone', deps, pth, typ, wrk));
        }
    });
    pw.on('statsDone', function statsDone(deps, pth, typ, wrk, err, stats) {
        var po = wrk[typ], poc = po['stats'], isLast = (++poc.cnt) >= poc.ttl;
        err = pw.error(err, true, false, null, typ, pth);
        if (!err && stats.isDirectory()) {
            poc.ttl++; // increment to prevent completion of dir stats capture
            pw.emit('readdirStats', deps, pth, typ, wrk);
        } else {
            // ready to start processing the file/resource
            pw.emit(typ, err, pth, stats, isLast, wrk);
        }
    });
    pw.on('readdirStats', function readDirStats(deps, pth, typ, wrk) {
        fs.readdir(pth, pw.callback('readdirStatsDone', deps, pth, typ, wrk));
    });
    pw.on('readdirStatsDone', function readDirDone(deps, pth, typ, wrk, err, files) {
        // decrement total to inidcate completion of dir stats capture
        var po = wrk[typ], poc = po['stats'], isLast = poc.cnt >= (--poc.ttl);
        err = pw.error(err, true, false, null, typ, pth);
        if (!err) {
            pw.emit(pth, deps, pth, typ, wrk); // notify dirs w/dependency on the path
        }
        if (!err && files.length) {
            for (var i = 0; i < files.length; i++) {
                poc.ttl++;
                deps.push(pth);
                pw.emitAsync('stats', deps, path.join(pth, files[i]), typ, wrk);
            }
        } else {
            pw.emit(typ, err, pth, null, isLast, wrk);
        }
    });
    pw.on('src', function src(err, pth, stats, isLast, wrk) {
        wrk.src.ready = isLast;
        if (!err && pth && stats) {
            if (!wrk.dest.ready) {
            }
        }
    });
    pw.on('mkdir', function mkdir(pth, typ, wrk) {
        fs.mkdir(pth, pw.callback('mkdirDone', pth, typ, wrk));
    });
    pw.on('mkdirDone', function mkdirDone(pth, typ, wrk, err) {
        var po = wrk[typ], poc = po[typ], isLast = (++poc.cnt) >= poc.ttl;
        if (!pw.error(err, true, false, 'EEXIST', typ, pth)) {
                
        }
    });
}