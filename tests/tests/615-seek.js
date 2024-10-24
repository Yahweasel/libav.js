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

// Test of seeking functionality

const libav = await h.LibAV();

const [fmt_ctx, streams] = await libav.ff_init_demuxer_file("bitrate.webm");
const pkt = await libav.av_packet_alloc();

async function zero() {
    await libav.avformat_seek_file_approx(fmt_ctx, 0, 0, 0, 0);
}

async function testSeek(min, max, func) {
    await libav.av_read_frame(fmt_ctx, pkt);
    const packet = await libav.ff_copyout_packet(pkt);
    await libav.av_packet_unref(pkt);

    const time = packet.pts * streams[0].time_base_num / streams[0].time_base_den;
    if (time < min || time > max)
        throw new Error(`Failed to seek between ${min} and ${max} (${func})`);
}

await libav.avformat_seek_file(fmt_ctx, 0,
    3 * 60 * streams[0].time_base_den / streams[0].time_base_num, 0,
    3.5 * 60 * streams[0].time_base_den / streams[0].time_base_num, 0,
    4 * 60 * streams[0].time_base_den / streams[0].time_base_num, 0,
    0);
await testSeek(3 * 60, 4 * 60, "avformat_seek_file");
await zero();
await libav.avformat_seek_file_min(fmt_ctx, 0,
    3 * 60 * streams[0].time_base_den / streams[0].time_base_num, 0,
    0);
await testSeek(3 * 60, 4 * 60, "avformat_seek_file_min");
await zero();
await libav.avformat_seek_file_max(fmt_ctx, 0,
    4 * 60 * streams[0].time_base_den / streams[0].time_base_num, 0,
    0);
await testSeek(3 * 60, 4 * 60, "avformat_seek_file_max");
await zero();
await libav.avformat_seek_file_approx(fmt_ctx, 0,
    3.5 * 60 * streams[0].time_base_den / streams[0].time_base_num, 0,
    0);
await testSeek(3 * 60, 4 * 60, "avformat_seek_file_approx");
await libav.av_seek_frame(fmt_ctx, 0,
    3.5 * 60 * streams[0].time_base_den / streams[0].time_base_num, 0,
    0);
await testSeek(3 * 60, 4 * 60, "av_seek_frame");

await libav.av_packet_free_js(pkt);
await libav.avformat_close_input_js(fmt_ctx);
