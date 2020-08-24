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

    // Make sure LibAV is defined for later loading
    if (typeof LibAV === "undefined")
        LibAV = {};
    libav = LibAV;

    if (libav.base)
        base = libav.base;

    // Now start making our instance generating function
    libav.LibAV = function(opts) {
        opts = opts || {};
        var wasm = !opts.nowasm && isWebAssemblySupported();
        var ret, threads;

        return Promise.all([]).then(function() {
            // Step one: Get LibAV loaded
            if (!libav.LibAVFactory) {
                if (nodejs) {
                    // Node.js: Load LibAV now
                    libav.LibAVFactory = require(base + "/libav-@VER-@CONFIG." + (wasm?"w":"") + "asm.js");

                } else {
                    // Web: Load the script
                    return new Promise(function(res, rej) {
                        var scr = document.createElement("script");
                        scr.src = base + "/libav-@VER-@CONFIG." + (wasm?"w":"") + "asm.js";
                        scr.addEventListener("load", res);
                        scr.addEventListener("error", rej);
                        scr.async = true;
                        document.body.appendChild(scr);
                    }).then(function() {
                        libav.LibAVFactory = LibAVFactory;

                    });

                }
            }

        }).then(function() {
            // Step two: Create the underlying instance
            if (!nodejs && typeof Worker !== "undefined" && !libav.noworker) {
                // Worker thread
                ret = {};

                // Load the worker
                ret.worker = new Worker(base + "/libav-@VER-@CONFIG." + (wasm?"w":"") + "asm.js");

                // Report our readiness
                return new Promise(function(res, rej) {
                    var ready = 0;

                    // Our handlers
                    ret.on = 1;
                    ret.handlers = {
                        onready: [function() {
                            res();
                        }, null],
                        onwrite: [function(args) {
                            if (ret.onwrite)
                                ret.onwrite.apply(ret, args);
                        }, null]
                    };

                    // And passthru functions
                    ret.c = function() {
                        var msg = Array.prototype.slice.call(arguments);
                        return new Promise(function(res, rej) {
                            var id = ret.on++;
                            msg[0] = id;
                            ret.handlers[id] = [res, rej];
                            ret.worker.postMessage(msg);
                        });
                    };
                    function onworkermessage(e) {
                        var id = e.data[0];
                        var h = ret.handlers[id];
                        if (h) {
                            if (e.data[2])
                                h[0](e.data[3]);
                            else
                                h[1](e.data[3]);
                            if (typeof id === "number")
                                delete ret.handlers[id];
                        }
                    };
                    ret.worker.onmessage = onworkermessage;
                });

            } else { // Not Workers
                // Start with a real instance
                return Promise.all([]).then(function() {
                    // Annoyingly, Emscripten's "Promise" isn't really a Promise
                    return new Promise(function(res) {
                        libav.LibAVFactory().then(function(x) {
                            delete x.then;
                            res(x);
                        });
                    });
                }).then(function(x) {
                    ret = x;
                    ret.worker = false;

                    // Simple wrappers
                    ret.c = function(func) {
                        var args = Array.prototype.slice.call(arguments, 1);
                        return new Promise(function(res, rej) {
                            try {
                                res(ret[func].apply(ret, args));
                            } catch (ex) {
                                rej(ex);
                            }
                        });
                    };
                });

            }

        }).then(function() {
            // Step three: Add wrappers to the instance(s)

            // Our direct function wrappers
            @FUNCS.forEach(function(f) {
                if (ret[f]) {
                    var real = ret[f];
                    ret[f] = function() {
                        var args = arguments;
                        return new Promise(function(res, rej) {
                            try {
                                res(real.apply(ret, args));
                            } catch (ex) {
                                rej(ex);
                            }
                        });
                    }

                } else {
                    ret[f] = function() {
                        return ret.c.apply(ret, [0, f].concat(Array.prototype.slice.call(arguments)));
                    };

                    for (var i = 1; i < threads; i++) (function(i) {
                        ret.targets[i][f] = function() {
                            return ret.c.apply(ret, [i, f].concat(Array.prototype.slice.call(arguments)));
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
                ret[type + "_set"] = function(obj, vals) {
                    var promises = [];
                    for (var key in vals) {
                        var val = vals[key];
                        promises.push(ret.c(type + "_" + key + "_s", obj, val));
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
                    ret[val] = i++;
                });
            }

            // AV_OPT
            ret.AV_OPT_SEARCH_CHILDREN = 1;

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
            ret.AVIO_FLAG_READ = 1;
            ret.AVIO_FLAG_WRITE = 2;
            ret.AVIO_FLAG_READ_WRITE = 3;
            ret.AVIO_FLAG_NONBLOCK = 8;
            ret.AVIO_FLAG_DIRECT = 0x8000;

            // Errors
            ret.EAGAIN = 6;
            ret.AVERROR_EOF = -0x20464f45;

            return ret;
        });
    }

    if (nodejs)
        module.exports = libav;

})();
