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

// Audio decoding using our meta API

const libav = await h.LibAV();
const buf = await h.readCachedFile("bbb.webm");
await libav.mkreaderdev("tmp.webm");
let rd = 0;

libav.onread = function() {
    const rdp = rd;
    rd += 1024;
    libav.ff_reader_dev_send("tmp.webm", buf.slice(rdp, rd));
    if (rd >= buf.length)
        libav.ff_reader_dev_send("tmp.webm", null);
};

// Blocking read
const [fmt_ctx, streams] = await libav.ff_init_demuxer_file("tmp.webm");

let si, stream;
for (si = 0; si < streams.length; si++) {
    stream = streams[si];
    if (stream.codec_type === libav.AVMEDIA_TYPE_AUDIO)
        break;
}
if (si >= streams.length)
    throw new Error("Couldn't find audio stream");

const audio_stream_idx = stream.index;
const [, c, pkt, frame] = await libav.ff_init_decoder(
    stream.codec_id, stream.codecpar);

// Force floating point decoding for compareAudio
await libav.AVCodecContext_sample_fmt_s(c, libav.AV_SAMPLE_FMT_FLT);

let packets = [];
while (true) {
    const [res, rdPackets] = await libav.ff_read_frame_multi(fmt_ctx, pkt, {limit: 1024});

    if (audio_stream_idx in rdPackets)
        packets = packets.concat(rdPackets[audio_stream_idx]);

    if (res === libav.AVERROR_EOF) {
        // Done!
        break;

    } else if (res < 0 && res !== -libav.EAGAIN) {
        throw new Error("Error reading: " + res);

    }
}

const frames = await libav.ff_decode_multi(c, pkt, frame, packets, true);

await libav.ff_free_decoder(c, pkt, frame);
await libav.avformat_close_input_js(fmt_ctx);

await libav.unlink("tmp.webm");

await h.utils.compareAudio("bbb.webm", frames);
