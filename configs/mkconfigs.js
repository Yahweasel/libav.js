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
    ["default", ["format-ogg", "format-webm", "parser-opus", "codec-libopus", "format-mp4", "parser-aac", "codec-aac", "format-flac", "parser-flac", "codec-flac", "format-wav", "audio-filters"]],
    ["lite", ["format-ogg", "parser-opus", "codec-libopus", "format-flac", "parser-flac", "codec-flac", "format-wav", "audio-filters"]],
    ["fat", ["format-ogg", "format-webm", "parser-opus", "codec-libopus", "format-mp4", "parser-aac", "codec-aac", "format-flac", "parser-flac", "codec-flac", "parser-vorbis", "codec-libvorbis", "format-wavpack", "codec-alac", "format-wav", "audio-filters"]],
    ["obsolete", ["format-ogg", "format-webm", "parser-opus", "codec-libopus", "format-mp4", "parser-aac", "codec-aac", "format-flac", "parser-flac", "codec-flac", "parser-vorbis", "codec-libvorbis", "format-mp3", "decoder-mp3", "encoder-libmp3lame", "audio-filters"]],
    ["opus", ["format-ogg", "parser-opus", "codec-libopus"]],
    ["flac", ["format-flac", "parser-flac", "codec-flac"]],
    ["opus-flac", ["format-ogg", "parser-opus", "codec-libopus", "format-flac", "parser-flac", "codec-flac"]],
    ["all-audio-cli", ["format-ogg", "format-webm", "parser-opus", "codec-libopus", "format-mp4", "parser-aac", "codec-aac", "format-flac", "parser-flac", "codec-flac", "parser-vorbis", "codec-libvorbis", "format-mp3", "decoder-mp3", "encoder-libmp3lame", "format-wav", "format-pcm_f32le", "codec-pcm_f32le", "audio-filters", "cli", "workerfs"]],

    ["webm", ["format-ogg", "format-webm", "parser-opus", "codec-libopus", "format-mp4", "parser-aac", "codec-aac", "format-flac", "parser-flac", "codec-flac", "swscale", "libvpx", "parser-vp8", "codec-libvpx_vp8", "format-wav", "audio-filters"]],
    ["webm-opus-flac", ["format-ogg", "format-webm", "parser-opus", "codec-libopus", "format-flac", "parser-flac", "codec-flac", "swscale", "libvpx", "parser-vp8", "codec-libvpx_vp8"]],
    ["mediarecorder-transcoder", ["format-ogg", "format-webm", "parser-opus", "codec-libopus", "format-mp4", "parser-aac", "codec-aac", "format-flac", "parser-flac", "codec-flac", "swscale", "libvpx", "parser-vp8", "codec-libvpx_vp8", "parser-h264", "decoder-h264"]],
    ["open-media", ["format-ogg", "format-webm", "parser-opus", "codec-libopus", "format-flac", "parser-flac", "codec-flac", "parser-vorbis", "codec-libvorbis", "swscale", "libvpx", "parser-vp8", "codec-libvpx_vp8", "parser-vp9", "codec-libvpx_vp9", "parser-av1", "codec-libaom_av1"]],
    ["rawvideo", ["format-ogg", "format-webm", "parser-opus", "codec-libopus", "format-mp4", "parser-aac", "codec-aac", "format-flac", "parser-flac", "codec-flac", "swscale", "libvpx", "parser-vp8", "codec-libvpx_vp8", "parser-h264", "decoder-h264", "format-rawvideo", "codec-rawvideo"]],

    ["webcodecs", ["format-ogg", "format-webm", "format-mp4", "format-flac", "parser-opus", "codec-libopus", "parser-aac", "codec-aac", "parser-flac", "codec-flac", "swscale", "libvpx", "parser-vp8", "codec-libvpx_vp8", "bsf-extract_extradata", "parser-vp9", "bsf-vp9_metadata", "parser-h264", "bsf-h264_metadata", "parser-hevc", "bsf-hevc_metadata", "bsf-av1_metadata"]],

    // These are here so that "all" will have them for testing
    ["extras", [
        // Images
        "format-image2", "parser-gif", "codec-gif", "parser-mjpeg",
        "codec-mjpeg", "parser-png", "codec-png", "parser-webp", "decoder-webp",

        // H.265
        "parser-hevc", "decoder-hevc",

        // Apple-y lossless
        "codec-prores", "codec-qtrle",

        // HLS
        "format-hls", "protocol-jsfetch"
    ]],

    // Patent and/or license encumbered encoders
    ["mediarecorder-openh264", ["format-ogg", "format-webm", "parser-opus", "codec-libopus", "format-mp4", "parser-aac", "codec-aac", "format-flac", "parser-flac", "codec-flac", "swscale", "libvpx", "parser-vp8", "codec-libvpx_vp8", "parser-h264", "decoder-h264", "codec-libopenh264"]],

    ["empty", []],
    ["all", null]
];
let all = Object.create(null);

// Process arguments
let createOnes = false;
for (const arg of process.argv.slice(2)) {
    if (arg === "--create-ones")
        createOnes = true;
    else {
        console.error(`Unrecognized argument ${arg}`);
        process.exit(1);
    }
}

async function main() {
    for (let [name, config] of configs) {
        if (name !== "all") {
            for (const fragment of config)
                all[fragment] = true;
        } else {
            config = Object.keys(all);
        }

        const p = cproc.spawn("./mkconfig.js", [name, JSON.stringify(config)], {
            stdio: "inherit"
        });
        await new Promise(res => p.on("close", res));
    }

    if (createOnes) {
        const allFragments = Object.keys(all).map(x => {
            // Split up codecs and formats
            const p = /^([^-]*)-(.*)$/.exec(x);
            if (!p)
                return [x];
            if (p[1] === "codec")
                return [`decoder-${p[2]}`, `encoder-${p[2]}`, x]
            else if (p[1] === "format")
                return [`demuxer-${p[2]}`, `muxer-${p[2]}`, x]
            else
                return [x];
        }).reduce((a, b) => a.concat(b));

        for (const fragment of allFragments) {
            // Fix fragment dependencies
            let fragments = [fragment];
            if (fragment.indexOf("libvpx") >= 0)
                fragments.unshift("libvpx");
            if (fragment === "parser-aac")
                fragments.push("parser-ac3");

            // And make the variant
            const p = cproc.spawn("./mkconfig.js", [
                `one-${fragment}`, JSON.stringify(fragments)
            ], {stdio: "inherit"});
            await new Promise(res => p.on("close", res));
        }
    }
}
main();
