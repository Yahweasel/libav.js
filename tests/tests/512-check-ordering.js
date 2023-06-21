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

// Check whether packets are appearing in order (to test av_compare_ts_js)

const libav = await h.LibAV();

let ret;

const pkt = await libav.av_packet_alloc();
if (!pkt) {
    throw new Error(
        "Could not allocate AVPacket");
}

const ifmt_ctx = await
    libav.avformat_open_input_js("bbb.mp4", 0, 0);
if (!ifmt_ctx) {
    throw new Error(
        "Could not open input file");
}

await libav.avformat_find_stream_info(ifmt_ctx, 0);

const streams = [];
const stream_ct = await libav.AVFormatContext_nb_streams(ifmt_ctx);

for (let i = 0; i < stream_ct; i++) {
    const in_stream = await libav.AVFormatContext_streams_a(ifmt_ctx, i);

    streams.push({
        idx: i,
        time_base_num: await libav.AVStream_time_base_num(in_stream),
        time_base_den: await libav.AVStream_time_base_den(in_stream),
        last_packet: null
    });
}

while (true) {
    ret = await libav.av_read_frame(ifmt_ctx, pkt);
    if (ret === libav.AVERROR_EOF)
        break;
    if (ret < 0)
        throw new Error(await libav.ff_error(ret));

    const packet = await libav.ff_copyout_packet(pkt);
    const stream = streams[packet.stream_index];
    if (stream.last_packet) {
        // Check that we're in order
        if (await libav.av_compare_ts_js(
            stream.last_packet.dts, stream.last_packet.dtshi,
            stream.time_base_num, stream.time_base_den,
            packet.dts, packet.dtshi,
            stream.time_base_num, stream.time_base_den) > 0)
            throw new Error("Packets out of order!");
    }

    stream.last_packet = packet;
}

await libav.av_packet_free_js(pkt);

await libav.avformat_close_input_js(ifmt_ctx);
