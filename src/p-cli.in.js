/*
 * Copyright (C) 2019-2025 Yahweasel and contributors
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY
 * SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION
 * OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN
 * CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */

// Convert arguments to an array of string arguments (internal)
function convertArgs(argv0, args) {
    var ret = [argv0];
    ret = ret.concat(Array.prototype.slice.call(args, 0));
    for (var i = 0; i < ret.length; i++) {
        var arg = ret[i];
        if (typeof arg !== "string") {
            if ("length" in arg) {
                // Array of strings
                ret.splice.apply(ret, [i, 1].concat(arg));
            } else {
                // Just stringify it
                ret[i] = "" + arg;
            }
        }
    }
    return ret;
}

// Helper to run a main()
function runMain(main, name, args) {
    args = convertArgs(name, args);
    var argv = ff_malloc_string_array(args);
    Module.fsThrownError = null;
    var ret = null;
    try {
        ret = main(args.length, argv);
    } catch (ex) {
        if (ex && ex.name === "ExitStatus")
            ret = ex.status;
        else if (ex === "unwind")
            ret = EXITSTATUS;
        else
            throw ex;
    }

    function cleanup() {
        ff_free_string_array(argv);
    }

    if (ret && ret.then) {
        return ret.then(function(ret) {
            cleanup();
            return ret;
        }).catch(function(ex) {
            cleanup();
            if (ex && ex.name === "ExitStatus")
                return Promise.resolve(ex.status);
            else if (ex === "unwind")
                return Promise.resolve(EXITSTATUS);
            else
                return Promise.reject(ex);
        }).then(function(ret) {
            if (Module.fsThrownError) {
                var thr = Module.fsThrownError;
                Module.fsThrownError = null;
                throw thr;
            }
            return ret;
        });
    } else {
        cleanup();
        if (Module.fsThrownError) {
            var thr = Module.fsThrownError;
            Module.fsThrownError = null;
            throw thr;
        }
        return ret;
    }
}

/**
 * Frontend to the ffmpeg CLI (if it's compiled in). Pass arguments as strings,
 * or you may intermix arrays of strings for multiple arguments.
 *
 * NOTE: ffmpeg 6.0 and later require threads for the ffmpeg CLI. libav.js
 * *does* support the ffmpeg CLI on unthreaded environments, but to do so, it
 * uses an earlier version of the CLI, from 5.1.3. The libraries are still
 * modern, and if running libav.js in threaded mode, the ffmpeg CLI is modern as
 * well. As time passes, these two versions will drift apart, so make sure you
 * know whether you're running in threaded mode or not!
 */
/// @types ffmpeg@sync(...args: (string | string[])[]): @promsync@number@
var ffmpeg = Module.ffmpeg = function() {
    return runMain(ffmpeg_main, "ffmpeg", arguments);
};

/**
 * Frontend to the ffprobe CLI (if it's compiled in). Pass arguments as strings,
 * or you may intermix arrays of strings for multiple arguments.
 */
/// @types ffprobe@sync(...args: (string | string[])[]): @promsync@number@
var ffprobe = Module.ffprobe = function() {
    return runMain(ffprobe_main, "ffprobe", arguments);
};
