#!/usr/bin/env node
/*
 * Copyright (C) 2021-2023 Yahweasel and contributors
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

const cproc = require("child_process");
const fs = require("fs");

const configs = [
    ["default", ["ogg", "webm", "opus", "ipod", "aac", "flac", "wav", "audio-filters"]],
    ["lite", ["ogg", "opus", "flac", "wav", "audio-filters"]],
    ["fat", ["ogg", "webm", "opus", "ipod", "aac", "flac", "vorbis", "wavpack", "alac", "wav", "audio-filters"]],
    ["obsolete", ["ogg", "webm", "opus", "ipod", "aac", "flac", "vorbis", "lame", "audio-filters"]],
    ["opus", ["ogg", "opus"]],
    ["flac", ["flac"]],
    ["opus-flac", ["ogg", "opus", "flac"]],
    ["all-audio-cli", ["ogg", "webm", "opus", "ipod", "aac", "flac", "vorbis", "lame", "wav", "flt", "audio-filters", "cli", "workerfs"]],

    ["webm", ["ogg", "webm", "opus", "ipod", "aac", "flac", "swscale", "vpx", "vp8", "wav", "audio-filters"]],
    ["webm-opus-flac", ["ogg", "webm", "opus", "flac", "swscale", "vpx", "vp8"]],
    ["mediarecorder-transcoder", ["ogg", "webm", "opus", "ipod", "aac", "flac", "swscale", "vpx", "vp8", "h264"]],
    ["open-media", ["ogg", "webm", "opus", "flac", "vorbis", "swscale", "vpx", "vp8", "vp9", "av1"]],

    ["h265", ["ipod", "webm", "swscale", "hevc"]],
    ["prores", ["ipod", "webm", "swscale", "prores"]],

    // Patent and/or license encumbered encoders
    ["mediarecorder-openh264", ["ogg", "webm", "opus", "ipod", "aac", "flac", "swscale", "vpx", "vp8", "h264", "openh264"]],
    ["mediarecorder-x265", ["ogg", "webm", "opus", "ipod", "aac", "flac", "swscale", "vpx", "vp8", "h264", "hevc", "x265"]],

    ["descript",      ["ogg", "webm", "opus", "ipod", "aac", "flac",/*"vorbis",*/"lame", "wav", "flt", "swscale", "vpx", "vp8", "h264", "hevc", "audio-filters", "cli", "workerfs"]],

    ["empty", []],
    ["all", fs.readdirSync("fragments").filter(x => x !== "default")]
];

(async function() {
    for (const [name, config] of configs) {
        const p = cproc.spawn("./mkconfig.js", [name, JSON.stringify(config)], {
            stdio: "ignore"
        });
        await new Promise(res => p.on("close", res));
    }
})();
