/*
 * Copyright (C) 2019-2023 Yahweasel
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
    function isWebAssemblySupported(module) {
        module = module || [0x0, 0x61, 0x73, 0x6d, 0x1, 0x0, 0x0, 0x0];
        if (typeof WebAssembly !== "object" || typeof WebAssembly.instantiate !== "function")
            return false;
        try {
            var module = new WebAssembly.Module(new Uint8Array(module));
            if (module instanceof WebAssembly.Module)
                return new WebAssembly.Instance(module) instanceof WebAssembly.Instance;
        } catch (e) {}
        return false;
    }

    function isThreadingSupported() {
        try {
            var mem = new WebAssembly.Memory({initial: 1, maximum: 1, shared: true});
            if (!(mem.buffer instanceof SharedArrayBuffer))
                return false;
            return true;
        } catch (e) {}
        return false;
    }

    function isSIMDSupported() {
        return isWebAssemblySupported([0x0, 0x61, 0x73, 0x6d, 0x1, 0x0, 0x0,
            0x0, 0x1, 0x5, 0x1, 0x60, 0x0, 0x1, 0x7b, 0x3, 0x2, 0x1, 0x0, 0xa,
            0xa, 0x1, 0x8, 0x0, 0x41, 0x0, 0xfd, 0xf, 0xfd, 0x62, 0xb]);
    }

    var libav;
    var nodejs = (typeof process !== "undefined");

    // Make sure LibAV is defined for later loading
    if (typeof LibAV === "undefined")
        LibAV = {};
    libav = LibAV;

    if (!libav.base)
        libav.base = ".";

    // Proxy our detection functions
    libav.isWebAssemblySupported = isWebAssemblySupported;
    libav.isThreadingSupported = isThreadingSupported;
    libav.isSIMDSupported = isSIMDSupported;

    // Get the target that will load, given these options
    function target(opts) {
        opts = opts || {};
        var wasm = !opts.nowasm && isWebAssemblySupported();
        var thr = opts.yesthreads && wasm && !opts.nothreads && isThreadingSupported();
        var simd = wasm && !opts.nosimd && isSIMDSupported();
        if (!wasm)
            return "asm";
        else if (!thr && !simd)
            return "wasm";
        else
            return (thr ? "thr" : "") + (simd ? "simd" : "");
    }
    libav.target = target;

    function getFiles(conf) {
        // define a similar function, adapted to your bundler, probably you will ignore base
        if (conf.ext === "wasm") {
            return new URL(conf.base + "/libav-" + conf.ver + "-" + conf.config + conf.dbg + "." + conf.topts + ".wasm");
        } else if (conf.ext === "import") {
            // not supported by the standard implementation, since it is only required for bundler
            // and it would trigger the bundler and fail.
            return null;
            // example what it should do, if it is implemented externally
            // return import(conf.base + "/libav-" + conf.ver + "-" + conf.config + conf.dbg + "." + conf.topts + ".js")
        } else {
            return new URL(conf.base + "/libav-" + conf.ver + "-" + conf.config + conf.dbg + "." + conf.topts + ".js");
        }
    } 

    // Now start making our instance generating function
    libav.LibAV = function(opts) {
        opts = opts || {};
        var base = opts.base || libav.base;
        var topts = target(opts);
        var getfiles = libav.getFiles || getFiles;
        var url = getfiles( { ext: "js", base: base, ver: "@VER", config: "@VER", dbg: "@DBG", topts: topts });
        (globalThis || window || self).LibAV.wasmurl = getfiles( { ext: "wasm", base, ver: "@VER", config: "@VER", dbg: "@DBG", topts });
        var ret;

        return Promise.all([]).then(function() {
            // Step one: Get LibAV loaded
            if (!libav.LibAVFactory) {
                if (nodejs) {
                    // Node.js: Load LibAV now
                    libav.LibAVFactory = require(url);

                } else if (typeof Worker !== "undefined" && !opts.noworker) {
                    // Worker: Nothing to load now

                } else if (typeof importScripts !== "undefined") {
                    // Worker scope. Import it.
                    if (this !== undefined) { // this tells us, if we inside a module
                        importScripts(url);
                    } else {
                        var imported = getfiles( { ext: "import", base: base, ver: "@VER", config: "@VER", dbg: "@DBG", topts: topts });
                        return imported
                            .then(function(mod) {
                                if (globalThis.LibAVFactoryAsync)
                                    return globalThis.LibAVFactoryAsync;
                                else throw new Error('No LibAVFactoryAsync');
                            })
                            .then(function(LibAVFactory) {
                                libav.LibAVFactory = LibAVFactory;
                            })
                            .catch(function(error) {
                               console.log('Error loading libAV', error);
                            });
                    }

                } else {
                    // Web: Load the script
                    return new Promise(function(res, rej) {
                        var scr = document.createElement("script");
                        scr.src = url;
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
            if (!nodejs && typeof Worker !== "undefined" && !opts.noworker) {
                // Worker thread
                ret = {};

                // Load the worker
                ret.worker = new Worker(url);

                ret.worker.postMessage({
                    wasmurl: (globalThis || window || self).LibAV.wasmurl.toString()
                  });

                // Report our readiness
                return new Promise(function(res, rej) {

                    // Our handlers
                    ret.on = 1;
                    ret.handlers = {
                        onready: [function() {
                            res();
                        }, null],
                        onwrite: [function(args) {
                            if (ret.onwrite)
                                ret.onwrite.apply(ret, args);
                        }, null],
                        onblockread: [function(args) {
                            if (ret.onblockread)
                                ret.onblockread.apply(ret, args);
                        }, null]
                    };

                    // And passthru functions
                    ret.c = function() {
                        var msg = Array.prototype.slice.call(arguments);
                        return new Promise(function(res, rej) {
                            var id = ret.on++;
                            msg = [id].concat(msg);
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

                    // And termination
                    ret.terminate = function() {
                        ret.worker.terminate();
                    };
                });

            } else { // Not Workers
                // Start with a real instance
                return Promise.all([]).then(function() {
                    // Annoyingly, Emscripten's "Promise" isn't really a Promise
                    return new Promise(function(res) {
                        libav.LibAVFactory().then(function(x) {
                            delete x.then;
                            res(x);
                        }).catch(function (error) { // promise was unhandled, can lead to wacky errors
                            console.log('libAV: problem', error);
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

                    // No termination
                    ret.terminate = function() {};
                });

            }

        }).then(function() {
            // Step three: Add wrappers to the instance(s)

            // Our direct function wrappers
            @FUNCS.forEach(function(f) {
                if (ret[f]) {
                    var real = ret[f + "_sync"] = ret[f];
                    ret[f] = function() {
                        var args = arguments;
                        return new Promise(function(res, rej) {
                            try {
                                var p = real.apply(ret, args);
                                if (typeof p === "object" && p !== null && p.then)
                                    p.then(res).catch(rej);
                                else
                                    res(p);
                            } catch (ex) {
                                rej(ex);
                            }
                        });
                    };

                } else {
                    ret[f] = function() {
                        return ret.c.apply(ret, [f].concat(Array.prototype.slice.call(arguments)));
                    };

                }
            });

            // Some enumerations lifted directly from FFmpeg
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

            // AVPixelFormat
            enume(["AV_PIX_FMT_NONE", "AV_PIX_FMT_YUV420P",
                "AV_PIX_FMT_YUYV422", "AV_PIX_FMT_RGB24", "AV_PIX_FMT_BGR24",
                "AV_PIX_FMT_YUV422P", "AV_PIX_FMT_YUV444P",
                "AV_PIX_FMT_YUV410P", "AV_PIX_FMT_YUV411P", "AV_PIX_FMT_GRAY8",
                "AV_PIX_FMT_MONOWHITE", "AV_PIX_FMT_MONOBLACK",
                "AV_PIX_FMT_PAL8", "AV_PIX_FMT_YUVJ420P",
                "AV_PIX_FMT_YUVJ422P", "AV_PIX_FMT_YUVJ444P",
                "AV_PIX_FMT_UYVY422", "AV_PIX_FMT_UYYVYY411",
                "AV_PIX_FMT_BGR8", "AV_PIX_FMT_BGR4", "AV_PIX_FMT_BGR4_BYTE",
                "AV_PIX_FMT_RGB8", "AV_PIX_FMT_RGB4", "AV_PIX_FMT_RGB4_BYTE",
                "AV_PIX_FMT_NV12", "AV_PIX_FMT_NV21", "AV_PIX_FMT_ARGB",
                "AV_PIX_FMT_RGBA", "AV_PIX_FMT_ABGR", "AV_PIX_FMT_BGRA",
                "AV_PIX_FMT_GRAY16BE", "AV_PIX_FMT_GRAY16LE",
                "AV_PIX_FMT_YUV440P", "AV_PIX_FMT_YUVJ440P",
                "AV_PIX_FMT_YUVA420P", "AV_PIX_FMT_RGB48BE",
                "AV_PIX_FMT_RGB48LE", "AV_PIX_FMT_RGB565BE",
                "AV_PIX_FMT_RGB565LE", "AV_PIX_FMT_RGB555BE",
                "AV_PIX_FMT_RGB555LE", "AV_PIX_FMT_BGR565BE",
                "AV_PIX_FMT_BGR565LE", "AV_PIX_FMT_BGR555BE",
                "AV_PIX_FMT_BGR555LE"], -1);

            // AVIO_FLAGs
            ret.AVIO_FLAG_READ = 1;
            ret.AVIO_FLAG_WRITE = 2;
            ret.AVIO_FLAG_READ_WRITE = 3;
            ret.AVIO_FLAG_NONBLOCK = 8;
            ret.AVIO_FLAG_DIRECT = 0x8000;

            // AVSEEK_FLAGs
            ret.AVSEEK_FLAG_BACKWARD = 1;
            ret.AVSEEK_FLAG_BYTE = 2;
            ret.AVSEEK_FLAG_ANY = 4;
            ret.AVSEEK_FLAG_FRAME = 8;

            // Errors
            ret.EAGAIN = 6;
            ret.AVERROR_EOF = -0x20464f45;

            return ret;
        });
    }

    if (nodejs)
        module.exports = libav;

})();
