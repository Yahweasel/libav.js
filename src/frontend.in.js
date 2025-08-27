/*
 * Copyright (C) 2019-2025 Yahweasel
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

@E6 const libav = {};

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

@E5 var libav;
    var nodejs = (typeof process !== "undefined");

@E5 // Make sure LibAV is defined for later loading
@E5 if (typeof LibAV === "undefined")
@E5     LibAV = {};
@E5 libav = LibAV;

    if (!libav.base) {
@E6     libav.base = import.meta.url;
@E5     if (typeof __dirname === "string") {
@E5         libav.base = __dirname;
@E5     } else {
@E5         if (typeof document !== "undefined" && document && document.currentScript)
@E5             libav.base = document.currentScript.src;
@E5         else if (typeof self !== "undefined" && self && self.location)
@E5             libav.base = self.location.href;
@E5         else
@E5             libav.base = "./.";
            libav.base = libav.base.replace(/\/[^\/]*$/, "");
@E5     }
    }

    // Proxy our detection functions
    libav.isWebAssemblySupported = isWebAssemblySupported;
    libav.isThreadingSupported = isThreadingSupported;

    // Get the target that will load, given these options
    function target(opts) {
        opts = opts || {};
        var wasm = !opts.nowasm && isWebAssemblySupported();
        var thr = opts.yesthreads && wasm && !opts.nothreads && isThreadingSupported();
        if (!wasm)
            return "asm";
        else if (thr)
            return "thr";
        else
            return "wasm";
    }
    libav.target = target;
    libav.VER = "@VER";
    libav.CONFIG = "@VARIANT";
    libav.DBG = "@DBG";
    libav.factories = {};

    // Statics that are provided both by LibAV and by libav instances
    var libavStatics = {};

    /* libav.js returns and takes 64-bit numbers as 32-bit pairs, so we
     * need conversion functions to use those */
    libavStatics.i64tof64 = function(lo, hi) {
        // Common positive case
        if (!hi && lo >= 0) return lo;

        // Common negative case
        if (hi === -1 && lo < 0) return lo;

        /* Lo bit negative numbers are really just the 32nd bit being
         * set, so we make up for that with an additional 2^32 */
        return (
            hi * 0x100000000 +
            lo +
            ((lo < 0) ? 0x100000000 : 0)
        );
    };

    libavStatics.f64toi64 = function(val) {
        return [~~val, Math.floor(val / 0x100000000)];
    };

    libavStatics.i64ToBigInt = function(lo, hi) {
        var dv = new DataView(new ArrayBuffer(8));
        dv.setInt32(0, lo, true);
        dv.setInt32(4, hi, true);
        return dv.getBigInt64(0, true);
    };

    libavStatics.bigIntToi64 = function(val) {
        var dv = new DataView(new ArrayBuffer(8));
        dv.setBigInt64(0, val, true);
        return [dv.getInt32(0, true), dv.getInt32(4, true)];
    };

    libavStatics.ff_channel_layout = function(frame) {
        if (frame.channel_layout)
            return frame.channel_layout;
        else if (frame.channels && frame.channels !== 1)
            return (1 << frame.channels) - 1;
        else
            return 4; // Mono
    };

    libavStatics.ff_channels = function(frame) {
        if (frame.channels) {
            return frame.channels;
        } else if (frame.channel_layout) {
            var channels = 0;
            var cl = frame.channel_layout;
            while (cl) {
                channels += (cl & 1);
                cl >>= 1;
            }
            return channels;
        } else {
            return 1;
        }
    };

    libavStatics.AV_VERSION_INT = function(maj, min, rev) {
        return maj << 16 | min << 8 | rev;
    };

    // Some enumerations lifted directly from FFmpeg
    function enume(vals, first) {
        if (typeof first === undefined)
            first = 0;
        var i = first;
        vals.forEach(function(val) {
            libavStatics[val] = i++;
        });
    }

    // Common
    libavStatics.AV_TIME_BASE = 1000000;
    libavStatics.AV_NOPTS_VALUE_I64 = [0, ~~0x80000000];
    libavStatics.AV_NOPTS_VALUE_LO = 0;
    libavStatics.AV_NOPTS_VALUE_HI = ~~0x80000000;
    libavStatics.AV_NOPTS_VALUE = libavStatics.i64tof64(0, ~~0x80000000);

    // AV_OPT
    libavStatics.AV_OPT_SEARCH_CHILDREN = 1;

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
    libavStatics.AVIO_FLAG_READ = 1;
    libavStatics.AVIO_FLAG_WRITE = 2;
    libavStatics.AVIO_FLAG_READ_WRITE = 3;
    libavStatics.AVIO_FLAG_NONBLOCK = 8;
    libavStatics.AVIO_FLAG_DIRECT = 0x8000;

    // Useful AVFMT_FLAGs
    libavStatics.AVFMT_FLAG_NOBUFFER = 0x40;
    libavStatics.AVFMT_FLAG_FLUSH_PACKETS = 0x200;

    // AVSEEK_FLAGs
    libavStatics.AVSEEK_FLAG_BACKWARD = 1;
    libavStatics.AVSEEK_FLAG_BYTE = 2;
    libavStatics.AVSEEK_FLAG_ANY = 4;
    libavStatics.AVSEEK_FLAG_FRAME = 8;

    // AVDISCARDs
    libavStatics.AVDISCARD_NONE = -16;
    libavStatics.AVDISCARD_DEFAULT = 0;
    libavStatics.AVDISCARD_NONREF = 8;
    libavStatics.AVDISCARD_BIDIR = 16;
    libavStatics.AVDISCARD_NONINTRA = 24;
    libavStatics.AVDISCARD_NONKEY = 32;
    libavStatics.AVDISCARD_ALL = 48;

    // AV_LOG levels
    libavStatics.AV_LOG_QUIET = -8;
    libavStatics.AV_LOG_PANIC = 0;
    libavStatics.AV_LOG_FATAL = 8;
    libavStatics.AV_LOG_ERROR = 16;
    libavStatics.AV_LOG_WARNING = 24;
    libavStatics.AV_LOG_INFO = 32;
    libavStatics.AV_LOG_VERBOSE = 40;
    libavStatics.AV_LOG_DEBUG = 48;
    libavStatics.AV_LOG_TRACE = 56;

    // AV_PKT_FLAGs
    libavStatics.AV_PKT_FLAG_KEY = 0x0001;
    libavStatics.AV_PKT_FLAG_CORRUPT = 0x0002;
    libavStatics.AV_PKT_FLAG_DISCARD = 0x0004;
    libavStatics.AV_PKT_FLAG_TRUSTED = 0x0008;
    libavStatics.AV_PKT_FLAG_DISPOSABLE = 0x0010;


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
    libavStatics.AVERROR_EOF = -0x20464f45;

    // Apply the statics to LibAV
    Object.assign(libav, libavStatics);


    // Now start making our instance generating function
    libav.LibAV = function(opts) {
        opts = opts || {};
        var base = opts.base || libav.base;
        var t = target(opts);
        var variant = opts.variant || libav.variant || "@VARIANT";

        // Determine the file to import
@E6     var useES6 = true;
@E6     if (useES6 && (opts.noes6 || libav.noes6))
@E6         useES6 = false;
        var toImport = opts.toImport || libav.toImport ||
            base + "/libav-@VER-" + variant + "@DBG." + t + "." +
@E6        (useES6?"mjs":"js");
@E5        "js";
        var ret;

        var mode = "direct";
        if (t === "thr")
            mode = "threads";
        else if (!nodejs && !opts.noworker && typeof Worker !== "undefined")
            mode = "worker";

        return Promise.all([]).then(function() {
            // Step one: Get LibAV loaded
            if (opts.factory || libav.factory)
                return opts.factory || libav.factory;
            if (libav.factories[toImport])
                return libav.factories[toImport];

            if (mode === "worker") {
                // Worker: Nothing to load now

@E6         } else if (useES6) {
@E6             // Load via ES6 module
@E6             return import(toImport).then(function(laf) {
@E6                 libav.factories[toImport] = laf.default;
@E6                 return laf.default;
@E6             });

            } else if (nodejs) {
                // Node.js: Load LibAV now
                return libav.factories[toImport] = require(toImport);

            } else if (typeof importScripts !== "undefined") {
                // Worker scope. Import it.
                importScripts(toImport);
                return libav.factories[toImport] = LibAVFactory;

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
                    return libav.factories[toImport] = LibAVFactory;

                });

            }

        }).then(function(factory) {

            // Step two: Create the underlying instance
            if (mode === "worker") {
                // Worker thread
                ret = {};

                // Load the worker
                ret.worker = new Worker(toImport
@E6                 , {type: useES6 ? "module" : "classic"}
                );

                // Report our readiness
                return new Promise(function(res, rej) {

                    ret.worker.onerror = ev => {
                        console.error(ev);
                        rej(ev.error || new Error(ev.message));
                    };

                    ret.worker.postMessage({
                        config: {
                            variant: opts.variant || libav.variant,
                            wasmurl: opts.wasmurl || libav.wasmurl
                        }
                    });

                    // Our handlers
                    ret.on = 1;
                    ret.handlers = {
                        error: [function(ex) {
                            rej(ex);
                        }, null],
                        onready: [function() {
                            res();
                        }, null],
                        onwrite: [function(args) {
                            if (ret.onwrite)
                                ret.onwrite.apply(ret, args);
                        }, null],
                        onread: [function(args) {
                            try {
                                var rr = null;
                                if (ret.onread)
                                    rr = ret.onread.apply(ret, args);
                                if (rr && rr.then && rr.catch) {
                                    rr.catch(function(ex) {
                                        ret.ff_reader_dev_send(args[0], null, {error: ex});
                                    });
                                }
                            } catch (ex) {
                                ret.ff_reader_dev_send(args[0], null, {error: ex});
                            }
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
                        var transfer = [];
                        for (var i = 0; i < msg.length; i++) {
                            if (msg[i] && msg[i].libavjsTransfer)
                                transfer.push.apply(transfer, msg[i].libavjsTransfer);
                        }
                        return new Promise(function(res, rej) {
                            var id = ret.on++;
                            msg = [id].concat(msg);
                            ret.handlers[id] = [res, rej];
                            ret.worker.postMessage(msg, transfer);
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
                return Promise.all([]).then(function() {
                    return factory({
                        wasmurl: opts.wasmurl || libav.wasmurl,
                        variant: opts.variant || libav.variant
                    });
                }).then(function(x) {
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
                                worker.postMessage({
                                    c: "libavjs_wait_reader",
                                    fd: e.data.fd
                                });
                            } else {
                                var name = ret.fdName(e.data.fd);
                                var waiters =
                                    ret.ff_reader_dev_waiters[name];
                                if (!waiters) {
                                    waiters =
                                        ret.ff_reader_dev_waiters[name] =
                                        [];
                                }
                                waiters.push(function() {
                                    worker.postMessage({
                                        c: "libavjs_wait_reader",
                                        fd: e.data.fd
                                    });
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
                return Promise.all([]).then(function() {
                    return factory({
                        wasmurl: opts.wasmurl || libav.wasmurl,
                        variant: opts.variant || libav.variant
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

            // Apply the statics
            Object.assign(ret, libavStatics);

            return ret;
        });
    }

@E5 if (nodejs)
@E5     module.exports = libav;
})();

@E6 export const {
@E6 @EXPORTS
@E6 } = libav;
@E6 export default libav;
