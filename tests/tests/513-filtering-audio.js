/*
 * copyright (c) 2013 Andrew Kelley
 *
 * This file is part of FFmpeg.
 *
 * FFmpeg is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * FFmpeg is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with FFmpeg; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA
 */

/* This is sort of a port of doc/examples/filtering_audio.c, but
 * with fixed input and output formats */
var filter_graph;
var buffersink_ctx, aformat_ctx, buffersrc_ctx;

function init_filters(libav, filters_descr, sample_fmt, channel_layout, frame_size) {
    var abuffersrc, aformat, abuffersink, outputs, inputs;
    var int32s;
    return Promise.all([
        libav.avfilter_get_by_name("abuffer"),
        libav.avfilter_get_by_name("aformat"),
        libav.avfilter_get_by_name("abuffersink"),
        libav.avfilter_inout_alloc(),
        libav.avfilter_inout_alloc(),
        libav.avfilter_graph_alloc()
    ]).then(function(ret) {
        abuffersrc = ret[0];
        aformat = ret[1];
        abuffersink = ret[2];
        outputs = ret[3];
        inputs = ret[4];
        filter_graph = ret[5];

        if (!outputs || !inputs || !filter_graph)
            throw new Error();

        return Promise.all([
            libav.avfilter_graph_create_filter_js(abuffersrc, "in",
                "time_base=1/48000:sample_rate=48000:sample_fmt=" + sample_fmt + ":channel_layout=" + channel_layout,
                null, filter_graph),
            libav.avfilter_graph_create_filter_js(aformat, "aformat",
                "sample_rates=48000:sample_fmts=" + sample_fmt + ":channel_layouts=0x" + channel_layout,
                null, filter_graph),
            libav.avfilter_graph_create_filter_js(abuffersink, "out", null,
                null, filter_graph),
            libav.ff_malloc_int32_list([sample_fmt, -1, 48000, -1]),
            libav.av_strdup("in"),
            libav.av_strdup("out")
        ]);

    }).then(function(ret) {
        if (ret[0] === 0)
            throw new Error("Cannot create audio buffer source");
        if (ret[1] === 0)
            throw new Error("Cannot create aformat filter");
        if (ret[2] === 0)
            throw new Error("Cannot create audio buffer sink");
        if (ret[4] === 0 || ret[5] === 0)
            throw new Error("Failed to strdup");

        buffersrc_ctx = ret[0];
        aformat_ctx = ret[1];
        buffersink_ctx = ret[2];
        int32s = ret[3];

        return Promise.all([
            libav.AVFilterInOut_name_s(outputs, ret[4]),
            libav.AVFilterInOut_filter_ctx_s(outputs, buffersrc_ctx),
            libav.AVFilterInOut_pad_idx_s(outputs, 0),
            libav.AVFilterInOut_next_s(outputs, 0),
            libav.AVFilterInOut_name_s(inputs, ret[5]),
            libav.AVFilterInOut_filter_ctx_s(inputs, aformat_ctx),
            libav.AVFilterInOut_pad_idx_s(inputs, 0),
            libav.AVFilterInOut_next_s(inputs, 0)
        ]);

    }).then(function() {
        return libav.avfilter_graph_parse(filter_graph, filters_descr, inputs, outputs, 0);

    }).then(function(ret) {
        if (ret < 0)
            throw new Error("Failed to initialize filters");

        return libav.avfilter_link(aformat_ctx, 0, buffersink_ctx, 0);

    }).then(function(ret) {
        if (ret < 0)
            throw new Error("Failed to connect aformat to buffersink.");

        return libav.av_buffersink_set_frame_size(buffersink_ctx, frame_size);

    }).then(function() {
        return libav.avfilter_graph_config(filter_graph, 0);

    }).then(function(ret) {
        if (ret < 0)
            throw new Error("Failed to configure filtergraph");

        return libav.free(int32s);
    });
}

function main() {
    var libav;
    var oc, fmt, codec, c, frame, pkt, st, pb, frame_size;

    return h.LibAV().then(function(ret) {
        libav = ret;

        return libav.ff_init_encoder("libopus", {
            ctx: {
                bit_rate: 128000,
                sample_fmt: libav.AV_SAMPLE_FMT_FLT,
                sample_rate: 48000,
                channel_layout: 4,
                channels: 1
            },
            time_base: [1, 48000]
        });

    }).then(function(ret) {
        codec = ret[0];
        c = ret[1];
        frame = ret[2];
        pkt = ret[3];
        frame_size = ret[4];

        return libav.ff_init_muxer({filename: "tmp.ogg", open: true}, [[c, 1, 48000]]);

    }).then(function(ret) {
        oc = ret[0];
        fmt = ret[1];
        pb = ret[2];
        st = ret[3][0];

        return Promise.all([
            libav.avformat_write_header(oc, 0),
            init_filters(libav, "atempo=0.5,volume=0.1", libav.AV_SAMPLE_FMT_FLT, 4, frame_size),
            libav.AVFrame_sample_rate_s(frame, 48000)
        ]);

    }).then(function() {
        var t = 0;
        var tincr = 2 * Math.PI * 440 / 48000;
        var pts = 0;
        var frames = [];

        for (var i = 0; i < 200; i++) {
            var samples = [];

            for (var j = 0; j < frame_size; j++) {
                samples[j] = Math.sin(t);
                t += tincr;
            }

            frames.push({
                data: samples,
                channel_layout: 4,
                format: libav.AV_SAMPLE_FMT_FLT,
                pts: pts,
                sample_rate: 48000
            });
            pts += frame_size;
        }

        return libav.ff_filter_multi(buffersrc_ctx, buffersink_ctx, frame, frames, true);

    }).then(function(frames) {
        return libav.ff_encode_multi(c, frame, pkt, frames, true);

    }).then(function(packets) {
        return libav.ff_write_multi(oc, pkt, packets);

    }).then(function() {
        return libav.av_write_trailer(oc);

    }).then(function() {
        return libav.avfilter_graph_free_js(filter_graph);

    }).then(function() {
        return libav.ff_free_muxer(oc, pb);

    }).then(function() {
        return libav.ff_free_encoder(c, frame, pkt);

    }).then(function() {
        return libav.unlink("tmp.ogg");

    });
}

await main();
