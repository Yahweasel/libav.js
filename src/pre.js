/*
 * Copyright (C) 2019-2024 Yahweasel and contributors
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

// Import LibAV.base if applicable
if (typeof _scriptName === "undefined") {
    if (typeof LibAV === "object" && LibAV && LibAV.base)
        _scriptName = LibAV.base + "/libav-@VER-@VARIANT.@DBG@TARGET.@JS";
    else if (typeof self === "object" && self && self.location)
        _scriptName = self.location.href;
}

Module.locateFile = function(path, prefix) {
    // if it's the wasm file
    if (path.lastIndexOf(".wasm") === path.length - 5 &&
        path.indexOf("libav-") !== -1) {
        // Look for overrides
        if (Module.wasmurl)
            return Module.wasmurl;
        if (Module.variant)
            return prefix + "libav-@VER-" + Module.variant + ".@DBG@TARGET.wasm";
    }

    // Otherwise, use the default
    return prefix + path;
}
