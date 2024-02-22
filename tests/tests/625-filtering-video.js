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

// Decoding and filtering video

if (!h.options.includeSlow)
    return;

const libav = await h.LibAV();

const [fmt_ctx, streams] = await libav.ff_init_demuxer_file("bbb.webm");
let streamIdx = -1;
for (let i = 0; i < streams.length; i++) {
    if (streams[i].codec_type === libav.AVMEDIA_TYPE_VIDEO) {
        streamIdx = i;
        break;
    }
}
if (streamIdx < 0)
    throw new Error("Could not find audio track");
const stream = streams[streamIdx];

const [, c, pkt, frame] = await libav.ff_init_decoder(
    "libvpx-vp9", streams[streamIdx].codecpar);
const [res, packets] = await libav.ff_read_frame_multi(fmt_ctx, pkt, {
    copyoutPacket: "ptr"
});
if (res !== libav.AVERROR_EOF)
    throw new Error("Failed to read packets");
await libav.avformat_close_input_js(fmt_ctx);

if (!packets[streamIdx].length)
    throw new Error("No packets found for the appropriate stream");

// Make sure it didn't actually copy
if (typeof packets[streamIdx][0] !== "number")
    throw new Error("ff_copyout_packet_ptr was not used");

// FIXME: Discard other streams (MEMORY LEAK!)

// Get a filter graph that won't really do anything
const [filter_graph, buffersrc_ctx, buffersink_ctx] =
    await libav.ff_init_filter_graph("scale=1920:1080,fps=120,fps=60,scale=1280:720", {
        type: libav.AVMEDIA_TYPE_VIDEO,
        time_base: [1, 1000],
        frame_rate: 60,
        width: 1280,
        height: 720,
        pix_fmt: libav.AV_PIX_FMT_YUV420P
    }, {
        type: libav.AVMEDIA_TYPE_VIDEO,
        time_base: [1, 1000],
        pix_fmt: libav.AV_PIX_FMT_YUV420P
    });

// Decode and filter them
const frames = await libav.ff_decode_filter_multi(
    c, buffersrc_ctx, buffersink_ctx, pkt, frame, packets[streamIdx], true);

// Free the decoder
await libav.ff_free_decoder(c, pkt, frame);

// Free the filter
await libav.avfilter_graph_free_js(filter_graph);

// Check for correctness
await h.utils.compareVideo("bbb.webm", frames);
