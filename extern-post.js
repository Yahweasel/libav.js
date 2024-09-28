/*
 * Copyright (C) 2019-2024 Yahweasel
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

if (/* We're in a worker */
    typeof importScripts !== "undefined" &&
    /* We're not being loaded with noworker from the main code */
    typeof LibAV === "undefined" &&
    /* We're not being loaded as a thread */
    (
        (typeof self === "undefined" && typeof Module === "undefined") ||
        (typeof self !== "undefined" && self.name !== "em-pthread")
    )
    ) (function() {
    var libav;

    Promise.all([]).then(function() {
        /* We're the primary code for this worker. The host should ask us to
         * load immediately. */
        return new Promise(function(res, rej) {
            onmessage = function(e) {
                if (e && e.data && e.data.config) {
                    LibAVFactory({
                        wasmurl: e.data.config.wasmurl,
                        variant: e.data.config.variant
                    }).then(res).catch(rej);
                }
            };
        });

    }).then(function(lib) {
        libav = lib;

        // Now we're ready for normal messages
        onmessage = function(e) {
            var id = e.data[0];
            var fun = e.data[1];
            var args = e.data.slice(2);
            var ret = void 0;
            var succ = true;

            function reply() {
                var transfer = [];
                if (ret && ret.libavjsTransfer)
                    transfer = ret.libavjsTransfer
                try {
                    postMessage([id, fun, succ, ret], transfer);
                } catch (ex) {
                    try {
                        ret = JSON.parse(JSON.stringify(
                            ret, function(k, v) { return v; }
                        ));
                        postMessage([id, fun, succ, ret], transfer);
                    } catch (ex) {
                        postMessage([id, fun, succ, "" + ret]);
                    }
                }
            }

            try {
                ret = libav[fun].apply(libav, args);
            } catch (ex) {
                succ = false;
                ret = ex;
            }
            if (succ && ret && ret.then) {
                // Let the promise resolve
                ret.then(function(res) {
                    ret = res;
                }).catch(function(ex) {
                    succ = false;
                    ret = ex;
                }).then(reply);

            } else reply();
        };

        libav.onwrite = function(name, pos, buf) {
            /* We have to buf.slice(0) so we don't duplicate the entire heap just
             * to get one part of it in postMessage */
            buf = buf.slice(0);
            postMessage(["onwrite", "onwrite", true, [name, pos, buf]], [buf.buffer]);
        };

        libav.onblockread = function(name, pos, len) {
            postMessage(["onblockread", "onblockread", true, [name, pos, len]]);
        };
        postMessage(["onready", "onready", true, null]);

    }).catch(function(ex) {
        console.log("Loading LibAV failed\n" + ex + "\n" + ex.stack);
    });
})();
