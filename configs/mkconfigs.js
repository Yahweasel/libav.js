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
    ["default", ["format-ogg", "format-webm", "codec-libopus", "format-mp4", "codec-aac", "format-flac", "codec-flac", "format-wav", "audio-filters"]],
    ["lite", ["format-ogg", "codec-libopus", "format-flac", "codec-flac", "format-wav", "audio-filters"]],
    ["fat", ["format-ogg", "format-webm", "codec-libopus", "format-mp4", "codec-aac", "format-flac", "codec-flac", "codec-libvorbis", "format-wavpack", "codec-alac", "format-wav", "audio-filters"]],
    ["obsolete", ["format-ogg", "format-webm", "codec-libopus", "format-mp4", "codec-aac", "format-flac", "codec-flac", "codec-libvorbis", "format-mp3", "decoder-mp3", "encoder-libmp3lame", "audio-filters"]],
    ["opus", ["format-ogg", "codec-libopus"]],
    ["flac", ["format-flac", "codec-flac"]],
    ["opus-flac", ["format-ogg", "codec-libopus", "format-flac", "codec-flac"]],
    ["all-audio-cli", ["format-ogg", "format-webm", "codec-libopus", "format-mp4", "codec-aac", "format-flac", "codec-flac", "codec-libvorbis", "format-mp3", "decoder-mp3", "encoder-libmp3lame", "format-wav", "format-pcm_f32le", "codec-pcm_f32le", "audio-filters", "cli", "workerfs"]],

    ["webm", ["format-ogg", "format-webm", "codec-libopus", "format-mp4", "codec-aac", "format-flac", "codec-flac", "swscale", "libvpx", "codec-libvpx_vp8", "format-wav", "audio-filters"]],
    ["webm-opus-flac", ["format-ogg", "format-webm", "codec-libopus", "format-flac", "codec-flac", "swscale", "libvpx", "codec-libvpx_vp8"]],
    ["mediarecorder-transcoder", ["format-ogg", "format-webm", "codec-libopus", "format-mp4", "codec-aac", "format-flac", "codec-flac", "swscale", "libvpx", "codec-libvpx_vp8", "decoder-h264"]],
    ["open-media", ["format-ogg", "format-webm", "codec-libopus", "format-flac", "codec-flac", "codec-libvorbis", "swscale", "libvpx", "codec-libvpx_vp8", "codec-libvpx_vp9", "codec-libaom_av1"]],
    ["rawvideo", ["format-ogg", "format-webm", "codec-libopus", "format-mp4", "codec-aac", "format-flac", "codec-flac", "swscale", "libvpx", "codec-libvpx_vp8", "decoder-h264", "format-rawvideo", "codec-rawvideo"]],

    ["webcodecs", ["format-ogg", "format-webm", "format-mp4", "format-flac", "codec-libopus", "codec-aac", "codec-flac", "swscale", "libvpx", "codec-libvpx_vp8", "bsf-extract_extradata", "bsf-vp9_metadata", "bsf-h264_metadata", "bsf-hevc_metadata", "bsf-av1_metadata"]],

    // These are mainly here so that "all" will have them for testing
    ["images", ["format-webm", "format-image2", "codec-gif", "codec-mjpeg", "codec-png"]],
    ["h265", ["format-mp4", "format-webm", "swscale", "decoder-hevc"]],
    ["prores", ["format-mp4", "format-webm", "swscale", "codec-prores"]],
    ["qtrle", ["format-mov", "swscale", "codec-qtrle"]],
    ["jsfetch", ["protocol-jsfetch"]],
    ["hls", ["format-hls"]],

    // Patent and/or license encumbered encoders
    ["mediarecorder-openh264", ["format-ogg", "format-webm", "codec-libopus", "format-mp4", "codec-aac", "format-flac", "codec-flac", "swscale", "libvpx", "codec-libvpx_vp8", "decoder-h264", "codec-libopenh264"]],

    ["empty", []],
    ["all", null]
];
let all = Object.create(null);

(async function() {
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
})();
