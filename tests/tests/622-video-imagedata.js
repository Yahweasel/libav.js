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

// Extract ImageData rather than our Frames

if (typeof ImageData === "undefined") {
    // Obviously, ImageData must be defined to test it
    return;
}

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
    throw new Error("Could not find video track");
const stream = streams[streamIdx];

const [, c, pkt, frame] = await libav.ff_init_decoder(
    "libvpx-vp9", streams[streamIdx].codecpar);
const [res, packets] = await libav.ff_read_frame_multi(fmt_ctx, pkt);
if (res !== libav.AVERROR_EOF)
    throw new Error("Failed to read packets");
await libav.avformat_close_input_js(fmt_ctx);

if (!packets[streamIdx].length)
    throw new Error("No packets found for the appropriate stream");

// Decode just the first frame
const frames = await libav.ff_decode_multi(c, pkt, frame, [packets[streamIdx][0]], true);

// Scale all the frames
const sws = await libav.sws_getContext(
    frames[0].width, frames[0].height, frames[0].format,
    640, 360, libav.AV_PIX_FMT_RGBA,
    0, 0, 0, 0);
const scaleFrame = await libav.av_frame_alloc();
for (let fi = 0; fi < frames.length; fi++) {
    const lframe = frames[fi];
    await libav.ff_copyin_frame(frame, lframe);
    await libav.sws_scale_frame(sws, scaleFrame, frame);
    frames[fi] = await libav.ff_copyout_frame_video_imagedata(scaleFrame);
}
await libav.av_frame_free_js(scaleFrame);
await libav.sws_freeContext(sws);

// FIXME: Is it practical to actually *test* the resulting ImageData?
if (frames[0].data.length !== frames[0].width * frames[0].height * 4)
    throw new Error("This does not appear to be correct ImageData");

// Free the decoder
await libav.ff_free_decoder(c, pkt, frame);
