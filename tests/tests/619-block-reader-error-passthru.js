/*
 * Copyright (C) 2023 Yahweasel and contributors
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

// Checks that at least some FS errno errors get transcribed to something useful

const libav = await h.LibAV({});

await libav.mkblockreaderdev("tmp.webm", 4096);

async function checkPassthru() {
    try {
        let ret = await libav.ffprobe("-loglevel", "0", "-o", "stdout", "tmp.webm");
        throw new Error("Error was not passed through (return " + ret + ")");
    } catch (ex) {
        if (ex.message !== "passthru")
            throw ex;
    }
}

// Method one: an error
libav.onblockread = function() {
    throw new Error("passthru");
};
await checkPassthru();

// Method two: Promise
libav.onblockread = async function() {
    throw new Error("passthru");
};
await checkPassthru();

// Method three: direct
libav.onblockread = function(file, pos) {
    libav.ff_block_reader_dev_send(file, pos, null, {error: new Error("passthru")});
};
await checkPassthru();
