#!/usr/bin/env node
/*
 * Copyright (C) 2021-2024 Yahweasel and contributors
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

const libav = ["avformat", "avcodec"];
const avformat = ["avformat", "avfcbridge"];

const opus = ["parser-opus", "codec-libopus"];
const flac = ["format-flac", "parser-flac", "codec-flac"];
const mp3 = ["format-mp3", "decoder-mp3", "encoder-libmp3lame"];
const vp8 = ["parser-vp8", "codec-libvpx_vp8"];
const vp9 = ["parser-vp9", "codec-libvpx_vp9"];
// Hopefully, a faster AV1 encoder will become an option soon...
const aomav1 = ["parser-av1", "codec-libaom_av1"];
const aomsvtav1 = ["parser-av1", "decoder-libaom_av1", "encoder-libsvtav1"];

// Misanthropic Patent Extortion Gang (formats/codecs by reprobates)
const aac = ["parser-aac", "codec-aac"];
const h264 = ["parser-h264", "decoder-h264", "codec-libopenh264"];
const hevc = ["parser-hevc", "decoder-hevc"];

const configsRaw = [
    // Audio sensible:
    ["default", [
        libav, "avfilter", "swresample",
        "format-ogg", "format-webm",
        opus, flac, "format-wav", "codec-pcm_f32le",
        "audio-filters"
    ], {cli: true}],

    ["opus", [libav, "format-ogg", "format-webm", opus], {af: true}],
    ["flac", [libav, "format-ogg", flac], {af: true}],
    ["wav", [libav, "format-wav", "codec-pcm_f32le"], {af: true}],

    // Audio silly:
    ["obsolete", [
        libav, "avfilter", "swresample",

        // Modern:
        "format-ogg", "format-webm",
        opus, flac,

        // Timeless:
        "format-wav", "codec-pcm_f32le",

        // Obsolete:
        "codec-libvorbis", mp3,

        // (and filters)
        "audio-filters"
    ]],

    // Audio reprobate:
    ["aac", [libav, "format-mp4", "format-aac", "format-webm", aac], {af: true}],

    // Video sensible:
    ["webm", [
        libav,
        "format-ogg", "format-webm",
        opus, flac, "format-wav", "codec-pcm_f32le",
        "audio-filters",

        "libvpx", vp8,
        "swscale", "video-filters"
    ], {vp9: true, cli: true}],

    ["vp8-opus", [libav, "format-ogg", "format-webm", opus, "libvpx", vp8], {avf: true}],
    ["vp9-opus", [libav, "format-ogg", "format-webm", opus, "libvpx", vp9], {avf: true}],
    ["av1-opus", [libav, "format-ogg", "format-webm", opus, aomav1], {avf: true}],

    // Video reprobate:
    ["h264-aac", [libav, "format-mp4", "format-aac", "format-webm", aac, h264], {avf: true}],
    ["hevc-aac", [libav, "format-mp4", "format-aac", "format-webm", aac, hevc], {avf: true}],

    // Mostly parsing:
    ["webcodecs", [
        libav,
        "format-ogg", "format-webm", "format-mp4",
        opus, flac, "format-wav", "codec-pcm_f32le",
        "parser-aac",

        "parser-vp8", "parser-vp9", "parser-av1",
        "parser-h264", "parser-hevc",

        "bsf-extract_extradata",
        "bsf-vp9_metadata", "bsf-av1_metadata",
        "bsf-h264_metadata", "bsf-hevc_metadata"
    ], {avf: true}],

    // Single-format demuxers
    ["demuxer-asf", [avformat, "demuxer-asf", "parser-aac", "parser-h263", "parser-h264", "parser-hevc", "parser-mpeg4video", "parser-mpegaudio"], {noAll: true}],
    ["demuxer-au", [avformat, "demuxer-au"], {noAll: true}],
    ["demuxer-avi", [avformat, "demuxer-avi", "parser-aac", "parser-av1", "parser-flac", "parser-h261", "parser-h263", "parser-h264", "parser-hevc", "parser-mpeg4video", "parser-mpegaudio", "parser-mpegvideo", "parser-opus", "parser-vorbis", "parser-vp8", "parser-vp9"], {noAll: true}],
    ["demuxer-caf", [avformat, "demuxer-caf", "parser-aac", "parser-opus"], {noAll: true}],
    ["demuxer-dv", [avformat, "demuxer-dv", "parser-dvaudio"], {noAll: true}],
    ["demuxer-flac", [avformat, "demuxer-flac", "parser-flac"], {noAll: true}],
    ["demuxer-flv", [avformat, "demuxer-flv", "parser-aac", "parser-h264", "parser-mpeg4video"], {noAll: true}],
    ["demuxer-matroska", [avformat, "demuxer-matroska", "parser-aac", "parser-ac3", "parser-av1", "parser-flac", "parser-h261", "parser-h263", "parser-h264", "parser-hevc", "parser-mpeg4video", "parser-mpegaudio", "parser-mpegvideo", "parser-opus", "parser-vorbis", "parser-vp8", "parser-vp9"], {noAll: true}],
    ["demuxer-mp3", [avformat, "demuxer-mp3", "parser-mpegaudio"], {noAll: true}],
    ["demuxer-mp4", [avformat, "demuxer-mp4", "parser-aac", "parser-av1", "parser-h263", "parser-h264", "parser-hevc", "parser-mpeg4video", "parser-mpegaudio", "parser-mpegvideo", "parser-opus"], {noAll: true}],
    ["demuxer-mpeg", [avformat, "demuxer-mpeg", "parser-aac", "parser-mpeg4video", "parser-mpegaudio", "parser-mpegvideo"], {noAll: true}],
    ["demuxer-mpegts", [avformat, "demuxer-mpegts", "parser-aac", "parser-h264", "parser-hevc", "parser-mpeg4video", "parser-mpegaudio", "parser-mpegvideo"], {noAll: true}],
    ["demuxer-ogg", [avformat, "demuxer-ogg", "parser-flac", "parser-opus", "parser-vorbis"], {noAll: true}],
    ["demuxer-rm", [avformat, "demuxer-rm", "parser-cook", "parser-h263", "parser-h264", "parser-mpeg4video", "parser-mpegaudio", "parser-mpegvideo", "parser-rv34", "parser-sipr"], {noAll: true}],
    ["demuxer-wav", [avformat, "demuxer-wav"], {noAll: true}],
    ["demuxer-wv", [avformat, "demuxer-wv"], {noAll: true}],

    // Single-format decoders
    ["decoder-av1", ["avcodec", "parser-av1", "decoder-libaom_av1"], {noAll: true}],
    ["decoder-cinepak", ["avcodec", "decoder-cinepak"], {noAll: true}],
    ["decoder-dvvideo", ["avcodec", "decoder-dvvideo"], {noAll: true}],
    ["decoder-flashsv", ["avcodec", "zlib", "decoder-flashsv"], {noAll: true}],
    ["decoder-flashsv2", ["avcodec", "zlib", "decoder-flashsv2"], {noAll: true}],
    ["decoder-flv1", ["avcodec", "decoder-flv"], {noAll: true}],
    ["decoder-h261", ["avcodec", "decoder-h261", "parser-h261"], {noAll: true}],
    ["decoder-h263", ["avcodec", "decoder-h263", "parser-h263"], {noAll: true}],
    ["decoder-h263p", ["avcodec", "decoder-h263p", "parser-h263"], {noAll: true}],
    ["decoder-h264", ["avcodec", "decoder-h264", "parser-h264"], {noAll: true}],
    ["decoder-hevc", ["avcodec", "decoder-hevc", "parser-hevc"], {noAll: true}],
    ["decoder-indeo2", ["avcodec", "decoder-indeo2"], {noAll: true}],
    ["decoder-indeo3", ["avcodec", "decoder-indeo3"], {noAll: true}],
    ["decoder-indeo4", ["avcodec", "decoder-indeo4"], {noAll: true}],
    ["decoder-indeo5", ["avcodec", "decoder-indeo5"], {noAll: true}],
    ["decoder-mpeg1video", ["avcodec", "decoder-mpeg1video", "parser-mpegvideo"], {noAll: true}],
    ["decoder-mpeg2video", ["avcodec", "decoder-mpeg2video", "parser-mpegvideo"], {noAll: true}],
    ["decoder-mpeg4", ["avcodec", "decoder-mpeg4", "parser-mpeg4video"], {noAll: true}],
    ["decoder-msmpeg4v1", ["avcodec", "decoder-msmpeg4v1", "parser-mpeg4video"], {noAll: true}],
    ["decoder-msmpeg4v2", ["avcodec", "decoder-msmpeg4v2", "parser-mpeg4video"], {noAll: true}],
    ["decoder-msmpeg4v3", ["avcodec", "decoder-msmpeg4v3", "parser-mpeg4video"], {noAll: true}],
    ["decoder-msvideo1", ["avcodec", "decoder-msvideo1"], {noAll: true}],
    ["decoder-prores", ["avcodec", "decoder-prores"], {noAll: true}],
    ["decoder-qtrle", ["avcodec", "decoder-qtrle"], {noAll: true}],
    ["decoder-rv10", ["avcodec", "decoder-rv10"], {noAll: true}],
    ["decoder-rv20", ["avcodec", "decoder-rv20"], {noAll: true}],
    ["decoder-rv30", ["avcodec", "decoder-rv30", "parser-rv34"], {noAll: true}],
    ["decoder-rv40", ["avcodec", "decoder-rv40", "parser-rv34"], {noAll: true}],
    ["decoder-theora", ["avcodec", "decoder-theora"], {noAll: true}],
    ["decoder-vp8", ["avcodec", "libvpx", "decoder-libvpx_vp8", "parser-vp8"], {noAll: true}],
    ["decoder-vp9", ["avcodec", "libvpx", "decoder-libvpx_vp9", "parser-vp9"], {noAll: true}],
    ["decoder-wmv1", ["avcodec", "decoder-wmv1"], {noAll: true}],
    ["decoder-wmv2", ["avcodec", "decoder-wmv2"], {noAll: true}],
    ["decoder-wmv3", ["avcodec", "decoder-wmv3"], {noAll: true}],
    ["decoder-aac", ["avcodec", "decoder-aac", "parser-aac"], {noAll: true}],
    ["decoder-ac3", ["avcodec", "decoder-ac3", "parser-ac3"], {noAll: true}],
    ["decoder-alac", ["avcodec", "decoder-alac"], {noAll: true}],
    ["decoder-cook", ["avcodec", "decoder-cook", "parser-cook"], {noAll: true}],
    ["decoder-dvaudio", ["avcodec", "decoder-dvaudio", "parser-dvaudio"], {noAll: true}],
    ["decoder-flac", ["avcodec", "decoder-flac", "parser-flac"], {noAll: true}],
    ["decoder-mp1", ["avcodec", "decoder-mp1", "parser-mpegaudio"], {noAll: true}],
    ["decoder-mp2", ["avcodec", "decoder-mp2", "parser-mpegaudio"], {noAll: true}],
    ["decoder-mp3", ["avcodec", "decoder-mp3", "parser-mpegaudio"], {noAll: true}],
    ["decoder-opus", ["avcodec", "decoder-libopus", "parser-opus"], {noAll: true}],
    ["decoder-pcm_f16le", ["avcodec", "decoder-pcm_f16le"], {noAll: true}],
    ["decoder-pcm_f24le", ["avcodec", "decoder-pcm_f24le"], {noAll: true}],
    ["decoder-pcm_f32be", ["avcodec", "decoder-pcm_f32be"], {noAll: true}],
    ["decoder-pcm_f32le", ["avcodec", "decoder-pcm_f32le"], {noAll: true}],
    ["decoder-pcm_f64be", ["avcodec", "decoder-pcm_f64be"], {noAll: true}],
    ["decoder-pcm_f64le", ["avcodec", "decoder-pcm_f64le"], {noAll: true}],
    ["decoder-pcm_s16be", ["avcodec", "decoder-pcm_s16be"], {noAll: true}],
    ["decoder-pcm_s16le", ["avcodec", "decoder-pcm_s16le"], {noAll: true}],
    ["decoder-pcm_s24be", ["avcodec", "decoder-pcm_s24be"], {noAll: true}],
    ["decoder-pcm_s24le", ["avcodec", "decoder-pcm_s24le"], {noAll: true}],
    ["decoder-pcm_s32be", ["avcodec", "decoder-pcm_s32be"], {noAll: true}],
    ["decoder-pcm_s32le", ["avcodec", "decoder-pcm_s32le"], {noAll: true}],
    ["decoder-pcm_s64be", ["avcodec", "decoder-pcm_s64be"], {noAll: true}],
    ["decoder-pcm_s64le", ["avcodec", "decoder-pcm_s64le"], {noAll: true}],
    ["decoder-pcm_s8", ["avcodec", "decoder-pcm_s8"], {noAll: true}],
    ["decoder-pcm_u16be", ["avcodec", "decoder-pcm_u16be"], {noAll: true}],
    ["decoder-pcm_u16le", ["avcodec", "decoder-pcm_u16le"], {noAll: true}],
    ["decoder-pcm_u24be", ["avcodec", "decoder-pcm_u24be"], {noAll: true}],
    ["decoder-pcm_u24le", ["avcodec", "decoder-pcm_u24le"], {noAll: true}],
    ["decoder-pcm_u32be", ["avcodec", "decoder-pcm_u32be"], {noAll: true}],
    ["decoder-pcm_u32le", ["avcodec", "decoder-pcm_u32le"], {noAll: true}],
    ["decoder-pcm_u8", ["avcodec", "decoder-pcm_u8"], {noAll: true}],
    ["decoder-ra_144", ["avcodec", "decoder-ra_144",], {noAll: true}],
    ["decoder-ra_288", ["avcodec", "decoder-ra_288"], {noAll: true}],
    ["decoder-ralf", ["avcodec", "decoder-ralf"], {noAll: true}],
    ["decoder-sipr", ["avcodec", "decoder-sipr", "parser-sipr"], {noAll: true}],
    ["decoder-vorbis", ["avcodec", "decoder-libvorbis", "parser-vorbis"], {noAll: true}],
    ["decoder-wavpack", ["avcodec", "decoder-wavpack"], {noAll: true}],
    ["decoder-wmalossless", ["avcodec", "decoder-wmalossless"], {noAll: true}],
    ["decoder-wmapro", ["avcodec", "decoder-wmapro"], {noAll: true}],
    ["decoder-wmav1", ["avcodec", "decoder-wmav1"], {noAll: true}],
    ["decoder-wmav2", ["avcodec", "decoder-wmav2"], {noAll: true}],
    ["decoder-wmavoice", ["avcodec", "decoder-wmavoice"], {noAll: true}],

    // These are here so that "all" will have them for testing
    ["extras", [
        libav, "avfilter", "swresample", "swscale",

        // Images
        "format-image2", "demuxer-image_gif_pipe", "demuxer-image_jpeg_pipe",
        "demuxer-image_png_pipe",
        "parser-gif", "codec-gif", "parser-mjpeg",
        "codec-mjpeg", "parser-png", "zlib", "codec-png",
        "parser-webp", "decoder-webp",

        // Raw data
        "format-rawvideo", "codec-rawvideo",
        "format-pcm_f32le", "codec-pcm_f32le",

        // Apple-flavored lossless
        "codec-alac", "codec-prores", "codec-qtrle",

        // HLS
        "format-hls", "protocol-jsfetch",

        // BSF (bitstream filters)
        "avbsf", "bsf-null", "bsf-h264_mp4toannexb", "bsf-hevc_mp4toannexb"
    ]],

    ["empty", []],
    ["all", null]
];
let all = Object.create(null);

function configGroup(configs, nameExt, parts) {
    const toAdd = configs.map(config =>
        [`${config[0]}-${nameExt}`, config[1].concat(parts)]
    );
    configs.push.apply(configs, toAdd);
}

// Process the configs into groups
const configs = [];
for (const config of configsRaw) {
    const [name, inParts, extra] = config;

    // Expand the parts
    const parts = inParts ? [] : null;
    if (inParts) {
        for (const part of inParts) {
            if (part instanceof Array)
                parts.push.apply(parts, part);
            else
                parts.push(part);
        }
    }

    // Expand the extras
    const toAdd = [[name, parts]];
    if (extra && extra.vp9)
        configGroup(toAdd, "vp9", vp9);
    if (extra && extra.af)
        configGroup(toAdd, "af", ["avfilter", "swresample", "audio-filters"]);
    if (extra && extra.avf)
        configGroup(toAdd, "avf", ["avfilter", "swresample", "swscale", "audio-filters", "video-filters"]);
    if (extra && extra.cli)
        configGroup(toAdd, "cli", ["avfilter", "cli"]);

    configs.push.apply(configs, toAdd);
}

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
    for (let [name, config, extra] of configs) {
        if (name !== "all") {
            if (!extra || !extra.noAll) {
                for (const fragment of config)
                    all[fragment] = true;
            }
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

            if (fragment.startsWith("bsf-"))
                fragments.push("avbsf");

            if (
                fragment.startsWith("codec-") ||
                fragment.startsWith("decoder-") ||
                fragment.startsWith("encoder-") ||
                fragment.startsWith("parser-")
            )
                fragments.push("avcodec");

            if (
                fragment.startsWith("demuxer-") ||
                fragment.startsWith("format-") ||
                fragment.startsWith("muxer-") ||
                fragment.startsWith("protocol-")
            )
                fragments.push("avformat");

            if (
                fragment === "audio-filters" ||
                fragment === "swresample" ||
                fragment === "swscale" ||
                fragment === "video-filters"
            )
                fragments.push("avfilter");

            // And make the variant
            const p = cproc.spawn("./mkconfig.js", [
                `one-${fragment}`, JSON.stringify(fragments)
            ], {stdio: "inherit"});
            await new Promise(res => p.on("close", res));
        }
    }
}
main();
