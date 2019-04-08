/*
 * Copyright (C) 2019 Yahweasel
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

(function() {
    function isWebAssemblySupported() {
        try {
            if (typeof WebAssembly === "object" &&
                    typeof WebAssembly.instantiate === "function") {
                var module = new WebAssembly.Module(
                        new Uint8Array([0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]));
                if (module instanceof WebAssembly.Module)
                    return new WebAssembly.Instance(module) instanceof WebAssembly.Instance;
            }
        } catch (e) {
        }
        return false;
    }

    var libav;
    var base = ".";
    var nodejs = (typeof process !== "undefined");
    var threads = 1;

    if (!nodejs) {
        // Make sure LibAV is defined for later loading
        if (typeof LibAV === "undefined")
            LibAV = {};
        libav = LibAV;

        if (libav.base)
            base = libav.base;

    } else {
        // Node.js: Load LibAV now
        libav = LibAV = require(base + "/libav-@VER-@CONFIG." + (wasm?"w":"") + "asm.js");

    }

    libav.targets = [libav];
    libav.ready = false;

    var wasm = !libav.nowasm && isWebAssemblySupported();

    if (!nodejs && typeof Worker !== "undefined" && !libav.noworker) {
        if (libav.threads > 1)
            threads = libav.threads;
        libav.threads = threads;

        // Load the workers
        var workerScr = base + "/libav-@VER-@CONFIG." + (wasm?"w":"") + "asm.js";
        var workers = libav.workers = [];
        for (var i = 0; i < threads; i++)
            workers.push(new Worker(workerScr));
        libav.worker = workers[0];

        // Count how many are ready
        var ready = 0;

        // Our handlers
        libav.on = 1;
        libav.handlers = {
            onready: [function() {
                if (++ready === threads) {
                    libav.ready = true;
                    if (libav.onready)
                        libav.onready();
                }
            }, null],
            onwrite: [function(args) {
                if (libav.onwrite)
                    libav.onwrite.apply(libav, args);
            }, null]
        };

        // And passthru functions
        libav.c = function(thread) {
            var msg = Array.prototype.slice.call(arguments);
            return new Promise(function(res, rej) {
                var id = libav.on++;
                msg[0] = id;
                libav.handlers[id] = [res, rej];
                libav.workers[thread].postMessage(msg);
            });
        };
        function onworkermessage(e) {
            var id = e.data[0];
            var h = libav.handlers[id];
            if (h) {
                if (e.data[2])
                    h[0](e.data[3]);
                else
                    h[1](e.data[3]);
                if (typeof id === "number")
                    delete libav.handlers[id];
            }
        };
        for (var i = 0; i < threads; i++)
            libav.workers[i].onmessage = onworkermessage;

        // Make sure we have as many callable targets as threads
        for (var i = 1; i < threads; i++)
            libav.targets.push({});

        defineWrappers();

    } else {
        // Wrappers for our script or Node.js version
        libav.worker = false;
        libav.threads = 1;
        libav.c = function(thread, func) {
            var args = Array.prototype.slice.call(arguments, 2);
            return new Promise(function(res, rej) {
                res(libav[func].apply(libav, args));
            });
        };
        libav.onRuntimeInitialized = function() {
            defineWrappers();

            this.ready = true;
            if (this.onready)
                this.onready();
        };

        if (!nodejs) {
            // Start it loading
            var scr = document.createElement("script");
            scr.src = base + "/libav-@VER-@CONFIG." + (wasm?"w":"") + "asm.js";
            scr.async = true;
            document.body.appendChild(scr);
        }
    }

    // Now add wrappers for everything
    function defineWrappers() {
        // Our direct function wrappers
        @FUNCS.forEach(function(f) {
            if (libav[f]) {
                var real = libav[f];
                libav[f] = function() {
                    var args = arguments;
                    return new Promise(function(res, rej) {
                        res(real.apply(libav, args));
                    });
                }

            } else {
                libav[f] = function() {
                    return libav.c.apply(libav, [0, f].concat(Array.prototype.slice.call(arguments)));
                };

                for (var i = 1; i < threads; i++) (function(i) {
                    libav.targets[i][f] = function() {
                        return libav.c.apply(libav, [i, f].concat(Array.prototype.slice.call(arguments)));
                    };
                })(i);

            }
        });

        // Convenience multi-part setters (NOTE: Only single-threaded!)
        [
        "AVFrame",
        "AVCodecContext",
        "AVFilterInOut"
        ].forEach(function(type) {
            libav[type + "_set"] = function(obj, vals) {
                var promises = [];
                for (var key in vals) {
                    var val = vals[key];
                    promises.push(libav.c(type + "_" + key + "_s", obj, val));
                }
                return Promise.all(promises);
            };
        });

        // And some enumerations lifted directly from ffmpeg 4.1
        function enume(vals, first) {
            if (typeof first === undefined)
                first = 0;
            var i = first;
            vals.forEach(function(val) {
                libav[val] = i++;
            });
        }

        // AV_OPT
        libav.AV_OPT_SEARCH_CHILDREN = 1;

        // AVMediaType
        enume(["AVMEDIA_TYPE_UNKNOWN", "AVMEDIA_TYPE_VIDEO",
            "AVMEDIA_TYPE_AUDIO", "AVMEDIA_TYPE_DATA", "AVMEDIA_TYPE_SUBTITLE",
            "AVMEDIA_TYPE_ATTACHMENT"], -1);

        // AVSampleFormat
        enume(["AV_SAMPLE_FMT_NONE", "AV_SAMPLE_FMT_U8", "AV_SAMPLE_FMT_S16",
            "AV_SAMPLE_FMT_S32", "AV_SAMPLE_FMT_FLT", "AV_SAMPLE_FMT_DBL",
            "AV_SAMPLE_FMT_U8P", "AV_SAMPLE_FMT_S16P", "AV_SAMPLE_FMT_S32P",
            "AV_SAMPLE_FMT_FLTP", "AV_SAMPLE_FMT_DBLP", "AV_SAMPLE_FMT_S64",
            "AV_SAMPLE_FMT_S64P", "AV_SAMPLE_FMT_NB"], -1);

        // AVIO_FLAGs
        libav.AVIO_FLAG_READ = 1;
        libav.AVIO_FLAG_WRITE = 2;
        libav.AVIO_FLAG_READ_WRITE = 3;
        libav.AVIO_FLAG_NONBLOCK = 8;
        libav.AVIO_FLAG_DIRECT = 0x8000;

        // Errors
        libav.EAGAIN = 11;
        libav.AVERROR_EOF = -0x20464f45;
    }

    if (nodejs) {
        module.exports = libav;
        libav.onRuntimeInitialized();
    }

})();
