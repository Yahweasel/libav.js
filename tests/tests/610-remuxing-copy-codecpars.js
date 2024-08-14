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

// Remuxing using our meta API

const libav = await h.LibAV();
const buf = await h.readCachedFile("bbb.webm");
await libav.writeFile("tmp.webm", new Uint8Array(buf));

const [fmt_ctx, streams] =
    await libav.ff_init_demuxer_file("tmp.webm");

let si;
for (si = 0; si < streams.length; si++) {
    stream = streams[si];
    if (stream.codec_type === libav.AVMEDIA_TYPE_VIDEO)
        break;
}
if (si >= streams.length)
    throw new Error("Couldn't find video stream");

let video_stream_idx = stream.index;

const pkt = await libav.av_packet_alloc();

const [res, allPackets] = await libav.ff_read_frame_multi(fmt_ctx, pkt);

if (res !== libav.AVERROR_EOF)
    throw new Error("Error reading: " + res);

const packets = allPackets[video_stream_idx];
packets.forEach(function(packet) {
    packet.stream_index = 0;
});

// Copy out the codec parameters
const codecpar = await libav.ff_copyout_codecpar(stream.codecpar);

// Make sure we don't use previous codec parameters
await libav.avformat_close_input_js(fmt_ctx);

// Copy in new codec parameters
const codecparPtr = await libav.avcodec_parameters_alloc();
await libav.ff_copyin_codecpar(codecparPtr, codecpar);

const [oc, fmt, pb, [st]] = await libav.ff_init_muxer(
    {
        filename: "tmp2.webm",
        open: true,
        codecpars: true
    },
    [[codecparPtr, stream.time_base_num, stream.time_base_den]]);

await libav.avformat_write_header(oc, 0);

await libav.ff_write_multi(oc, pkt, packets);

await libav.av_write_trailer(oc);

await libav.ff_free_muxer(oc, pb);
await libav.av_packet_free_js(pkt);

if (h.options.includeSlow)
    await h.utils.compareVideo("bbb.webm", "tmp2.webm");

await libav.unlink("tmp.webm");
await libav.unlink("tmp2.webm");
