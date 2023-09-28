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

    /* Source: Jason Miller on Twitter. Returns true if we're in an ES6 module
     * in a worker. */
    function isModule() {
        try {
            importScripts("data:text/javascript,0");
            return false;
        } catch(e) {}
        return true;
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
    libav.isModule = isModule;

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
    libav.VER = "@VER";
    libav.CONFIG = "@CONFIG";
    libav.DBG = "@DBG";

    // Now start making our instance generating function
    libav.LibAV = function(opts) {
        opts = opts || {};
        var base = opts.base || libav.base;
        var t = target(opts);
        var toImport = libav.toImport ||  base + "/libav-@VER-@CONFIG@DBG." + t + ".js";
        var ret;

        var mode = "direct";
        if (t.indexOf("thr") === 0)
            mode = "threads";
        else if (!nodejs && !opts.noworker && typeof Worker !== "undefined")
            mode = "worker";

        return Promise.all([]).then(function() {
            // Step one: Get LibAV loaded
            if (!libav.LibAVFactory) {
                if (nodejs) {
                    // Node.js: Load LibAV now
                    libav.LibAVFactory = require(toImport);

                } else if (mode === "worker") {
                    // Worker: Nothing to load now

                } else if (typeof importScripts !== "undefined") {
                    // Worker scope. Import it.
                    if (!isModule()) {
                        importScripts(toImport);
                        libav.LibAVFactory = LibAVFactory;
                    } else {
                        var gt;
                        if (typeof globalThis !== "undefined") gt = globalThis;
                        else if (typeof self !== "undefined") gt = self;
                        else gt = window;
                        libav.LibAVFactory = gt.LibAVFactory;

                        if (gt.LibAVFactory)
                            return gt.LibAVFactory;
                        else
                            throw new Error("If in an ES6 module, you need to import " + toImport + " yourself before loading libav.js.");
                    }

                } else {
                    // Web: Load the script
                    return new Promise(function(res, rej) {
                        var scr = document.createElement("script");
                        scr.src = toImport;
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
            if (mode === "worker") {
                // Worker thread
                ret = {};

                // Load the worker
                ret.worker = new Worker(toImport);

                ret.worker.postMessage({
                    config: {
                        variant: opts.variant || libav.variant,
                        wasmurl: opts.wasmurl || libav.wasmurl
                    }
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
                            try {
                                var brr = null;
                                if (ret.onblockread)
                                    brr = ret.onblockread.apply(ret, args);
                                if (brr && brr.then && brr.catch) {
                                    brr.catch(function(ex) {
                                        ret.ff_block_reader_dev_send(args[0], args[1], null, {error: ex});
                                    });
                                }
                            } catch (ex) {
                                ret.ff_block_reader_dev_send(args[0], args[1], null, {error: ex});
                            }
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

            } else if (mode === "threads") {
                /* Worker through Emscripten's own threads. Start with a real
                 * instance. */
                var libavVariant = libav.variant;
                var libavWasmurl = libav.wasmurl;
                return Promise.all([]).then(function() {
                    if (opts.variant)
                        libav.variant = opts.variant;
                    if (opts.wasmurl)
                        libav.wasmurl = opts.wasmurl;
                    return libav.LibAVFactory();
                }).then(function(x) {
                    libav.variant = libavVariant;
                    libav.wasmurl = libavWasmurl;
                    ret = x;

                    // Get the worker
                    var pthreadT = ret.libavjs_create_main_thread();
                    var worker = ret.PThread.pthreads[pthreadT];
                    var ready = 0;

                    // Our handlers
                    var on = 1;
                    var handlers = {};
                    var readyPromiseRes = null;
                    var readyPromise = new Promise(function(res) {
                        readyPromiseRes = res;
                    });

                    // And passthru functions
                    ret.c = function() {
                        var msg = Array.prototype.slice.call(arguments);
                        return new Promise(function(res, rej) {
                            var id = on++;
                            msg = [id].concat(msg);
                            handlers[id] = [res, rej];
                            worker.postMessage({
                                c: "libavjs_run",
                                a: msg
                            });
                        });
                    };

                    var origOnmessage = worker.onmessage;
                    worker.onmessage = function(e) {
                        if (e.data && e.data.c === "libavjs_ret") {
                            // Return from a command
                            var a = e.data.a;
                            var h = handlers[a[0]];
                            if (h) {
                                if (a[2])
                                    h[0](a[3]);
                                else
                                    h[1](a[3]);
                                delete handlers[a[0]];
                            }
                        } else if (e.data && e.data.c === "libavjs_wait_reader") {
                            if (ret.readerDevReady(e.data.fd)) {
                                worker.postMessage({c: "libavjs_wait_reader"});
                            } else {
                                ret.ff_reader_dev_waiters.push(function() {
                                    worker.postMessage({c: "libavjs_wait_reader"});
                                });
                            }
                        } else if (e.data && e.data.c === "libavjs_ready") {
                            readyPromiseRes();
                        } else {
                            return origOnmessage.apply(this, arguments);
                        }
                    };

                    // Termination is more complicated
                    ret.terminate = function() {
                        ret.PThread.unusedWorkers
                        .concat(ret.PThread.runningWorkers)
                        .forEach(function(worker) {
                            worker.terminate()
                        });
                    };

                    return readyPromise;
                });

            } else { // Direct mode
                // Start with a real instance
                var libavVariant = libav.variant;
                var libavWasmurl = libav.wasmurl;
                return Promise.all([]).then(function() {
                    if (opts.variant)
                        libav.variant = opts.variant;
                    if (opts.wasmurl)
                        libav.wasmurl = opts.wasmurl;
                    return libav.LibAVFactory();
                }).then(function(x) {
                    libav.variant = libavVariant;
                    libav.wasmurl = libavWasmurl;
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

            function indirectors(funcs) {
                funcs.forEach(function(f) {
                    ret[f] = function() {
                        return ret.c.apply(ret, [f].concat(Array.prototype.slice.call(arguments)));
                    };
                });
            }

            function directs(funcs) {
                funcs.forEach(function(f) {
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
                    }
                });
            }

            var funcs = @FUNCS;
            var localFuncs = @LOCALFUNCS;

            ret.libavjsMode = mode;
            if (mode === "worker") {
                // All indirect
                indirectors(funcs);
                indirectors(localFuncs);

            } else if (mode === "threads") {
                // Some funcs are direct, rest are indirect
                indirectors(funcs);
                directs(localFuncs);

            } else { // direct
                // All direct
                directs(funcs);
                directs(localFuncs);

            }

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

            // AVDISCARDs
            ret.AVDISCARD_NONE = -16;
            ret.AVDISCARD_DEFAULT = 0;
            ret.AVDISCARD_NONREF = 8;
            ret.AVDISCARD_BIDIR = 16;
            ret.AVDISCARD_NONINTRA = 24;
            ret.AVDISCARD_NONKEY = 32;
            ret.AVDISCARD_ALL = 48;

            // Errors
            enume(["E2BIG", "EPERM", "EADDRINUSE", "EADDRNOTAVAIL",
                "EAFNOSUPPORT", "EAGAIN", "EALREADY", "EBADF", "EBADMSG",
                "EBUSY", "ECANCELED", "ECHILD", "ECONNABORTED", "ECONNREFUSED",
                "ECONNRESET", "EDEADLOCK", "EDESTADDRREQ", "EDOM", "EDQUOT",
                "EEXIST", "EFAULT", "EFBIG", "EHOSTUNREACH", "EIDRM", "EILSEQ",
                "EINPROGRESS", "EINTR", "EINVAL", "EIO", "EISCONN", "EISDIR",
                "ELOOP", "EMFILE", "EMLINK", "EMSGSIZE", "EMULTIHOP",
                "ENAMETOOLONG", "ENETDOWN", "ENETRESET", "ENETUNREACH",
                "ENFILE", "ENOBUFS", "ENODEV", "ENOENT"], 1);
            ret.AVERROR_EOF = -0x20464f45;

            return ret;
        });
    }

    if (nodejs)
        module.exports = libav;

})();
