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

// Video transcoding using our meta API

if (!h.options.includeSlow)
    return;

const libav = await h.LibAV();

const [fmt_ctx, streams] = await libav.ff_init_demuxer_file("bbb.webm");

let si, stream;
for (si = 0; si < streams.length; si++) {
    stream = streams[si];
    if (stream.codec_type === libav.AVMEDIA_TYPE_VIDEO)
        break;
}
if (si >= streams.length)
    throw new Error("Couldn't find video stream");

const video_stream_idx = stream.index;

let [, c, pkt, frame] =
    await libav.ff_init_decoder(stream.codec_id, stream.codecpar);

let [res, packets] = await libav.ff_read_frame_multi(fmt_ctx, pkt);

if (res !== libav.AVERROR_EOF)
    throw new Error("Error reading: " + res);

const frames = await libav.ff_decode_multi(c, pkt, frame,
    packets[video_stream_idx], true);

// Scale all the frames
const sws = await libav.sws_getContext(
    frames[0].width, frames[0].height, frames[0].format,
    640, 360, libav.AV_PIX_FMT_RGB32,
    0, 0, 0, 0);
const scaleFrame = await libav.av_frame_alloc();
for (let fi = 0; fi < frames.length; fi++) {
    const lframe = frames[fi];
    await libav.ff_copyin_frame(frame, lframe);
    await libav.sws_scale_frame(sws, scaleFrame, frame);
    frames[fi] = await libav.ff_copyout_frame(scaleFrame);
}
await libav.av_frame_free_js(scaleFrame);
await libav.sws_freeContext(sws);

await libav.ff_free_decoder(c, pkt, frame);
await libav.avformat_close_input_js(fmt_ctx);

let codec;
[codec, c, frame, pkt] =
    await libav.ff_init_encoder("libvpx", {
        ctx: {
            bit_rate: 10000000,
            pix_fmt: frames[0].format,
            width: frames[0].width,
            height: frames[0].height
        }
    });

const [oc, fmt, pb, st] = await libav.ff_init_muxer(
    {filename: "tmp.webm", open: true}, [[c, 1, 1000]]);

await libav.avformat_write_header(oc, 0);

packets =
    await libav.ff_encode_multi(c, frame, pkt, frames, true);

await libav.ff_write_multi(oc, pkt, packets);

await libav.av_write_trailer(oc);

await libav.ff_free_muxer(oc, pb);
await libav.ff_free_encoder(c, frame, pkt);
