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
// Force floating point decoding
await libav.AVCodecContext_sample_fmt_s(c, libav.AV_SAMPLE_FMT_FLT);
const [res, packets] = await libav.ff_read_frame_multi(fmt_ctx, pkt);
if (res !== libav.AVERROR_EOF)
    throw new Error("Failed to read packets");
await libav.avformat_close_input_js(fmt_ctx);

if (!packets[streamIdx].length)
    throw new Error("No packets found for the appropriate stream");

// Decode them
const frames = await libav.ff_decode_multi(c, pkt, frame, packets[streamIdx], true);

// Free the decoder
await libav.ff_free_decoder(c, pkt, frame);

// Check for correctness
await h.utils.compareAudio("bbb.webm", frames);
