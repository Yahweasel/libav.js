/*
 * Copyright (C) 2023, 2024 Yahweasel and contributors
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

// Check that decoded/filtered data has expected time bases

const libav = await h.LibAV();

const [fmt_ctx, streams] = await libav.ff_init_demuxer_file("bbb.webm");
let streamIdx = -1;
for (let i = 0; i < streams.length; i++) {
    if (streams[i].codec_type === libav.AVMEDIA_TYPE_AUDIO) {
        streamIdx = i;
        break;
    }
}
if (streamIdx < 0)
    throw new Error("Could not find audio track");
const stream = streams[streamIdx];

const [, c, pkt, frame] = await libav.ff_init_decoder(
    "libopus", streams[streamIdx].codecpar);
const [res, packets] = await libav.ff_read_frame_multi(fmt_ctx, pkt);
if (res !== libav.AVERROR_EOF)
    throw new Error("Failed to read packets");
await libav.avformat_close_input_js(fmt_ctx);

if (!packets[streamIdx].length)
    throw new Error("No packets found for the appropriate stream");

// Check packet time bases
for (const packet of packets[streamIdx]) {
    if (packet.time_base_num !== 1 ||
        packet.time_base_den !== 1000) {
        // Matroska/WebM always uses 1ms timebase
        throw new Error(`Incorrect packet timebase: ${packet.time_base_num}/${packet.time_base_den}`);
    }
}

// Decode them
const frames = await libav.ff_decode_multi(c, pkt, frame, packets[streamIdx], true);

for (const frame of frames) {
    if (frame.time_base_num !== 1 ||
        frame.time_base_den !== 48000) {
        throw new Error(`Incorrect frame timebase: ${frame.time_base_num}/${frame.time_base_den}`);
    }
}

// Get a filter graph that won't really do anything
const [filter_graph, buffersrc_ctx, buffersink_ctx] =
    await libav.ff_init_filter_graph("volume=0.8,volume=1.25", {
        sample_rate: 48000,
        sample_fmt: libav.AV_SAMPLE_FMT_FLT,
        channel_layout: 3
    }, {
        sample_rate: 48000,
        sample_fmt: libav.AV_SAMPLE_FMT_FLT,
        channel_layout: 3
    });

// Filter
const filterFrames = await libav.ff_filter_multi(buffersrc_ctx,
    buffersink_ctx, frame, frames, true);

for (const frame of filterFrames) {
    if (frame.time_base_num !== 1 ||
        frame.time_base_den !== 48000) {
        throw new Error(`Incorrect filter frame timebase: ${frame.time_base_num}/${frame.time_base_den}`);
    }
}

// Free the decoder
await libav.ff_free_decoder(c, pkt, frame);

// Free the filter
await libav.avfilter_graph_free_js(filter_graph);
