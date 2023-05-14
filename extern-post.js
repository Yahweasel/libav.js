/*
 * Copyright (C) 2019, 2020 Yahweasel
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

if (typeof LibAV !== "undefined" && LibAV.wasmurl){
    (globalThis || window || self).LibAVFactoryAsync = new Promise((resolve, reject) => {   
            const initialFactory = LibAVFactory
            fetch(LibAV.wasmurl).then((response) => {
            if (!response['ok']) {
               throw ("failed to load wasm binary file at '" + LibAV.wasmurl + "'");
            }
            return response['arrayBuffer']();
        }).then((binary) => {
            resolve (() => { 
                return initialFactory({ wasmBinary: binary });
            })
        }).catch((error)=> reject(error))
  })
}

if (typeof importScripts !== "undefined" && (typeof LibAV === "undefined" /* || !LibAV.nolibavworker*/)) {
    // We're a WebWorker, so arrange messages
    const loadLibAV = async (wasmurl) => {
        try {
            const response = await fetch(wasmurl);
            if (!response['ok']) {
                throw ("failed to load wasm binary file at '" + wasmurl + "'");
            }
            return await LibAVFactory({ wasmBinary: await response['arrayBuffer']()})
        } catch(error) {
            throw error
        }
    }   
    let libav
    onmessage = async function (e) {
            if (e?.data?.wasmurl) {
                try {
       
                   libav = await loadLibAV(e.data.wasmurl)
                   libav.onwrite = function (name, pos, buf) {
                        /* We have to buf.slice(0) so we don't duplicate the entire heap just
                         * to get one part of it in postMessage */
                        buf = buf.slice(0);
                        postMessage(["onwrite", "onwrite", true, [name, pos, buf]], [buf.buffer]);
                    };

          
                    libav.onblockread = function(name, pos) {
                        postMessage(["onblockread", "onblockread", true, [name, pos]]);
                    };
                    postMessage(['onready', 'onready', true, null])
                } catch (ex) {  
                    console.log('Loading LibAV failed' + '\n' + ex.stack)
                }
                return
            } 
            var id = e.data[0];
            var fun = e.data[1];
            var args = e.data.slice(2);
            var ret = void 0;
            var succ = true;
            try {
                ret = libav[fun].apply(libav, args);
            } catch (ex) {
                succ = false;
                ret = ex.toString() + "\n" + ex.stack;
            }
            if (succ && typeof ret === "object" && ret !== null && ret.then) {
                // Let the promise resolve
                ret.then(function(res) {
                    ret = res;
                }).catch(function(ex) {
                    succ = false;
                    ret = ex.toString() + "\n" + ex.stack;
                }).then(function() {
                    postMessage([id, fun, succ, ret]);
                });

            } else {
                postMessage([id, fun, succ, ret]);

            }
        }
}
