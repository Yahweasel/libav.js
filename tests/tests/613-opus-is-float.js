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

// Pointless test that Opus is floating-point

const libav = await h.LibAV();

const [fmt_ctx, streams] =
    await libav.ff_init_demuxer_file("bbb.webm");

let si = -1;
for (si = 0; si < streams.length; si++) {
    const stream = streams[si];
    if (stream.codec_type === libav.AVMEDIA_TYPE_AUDIO)
        break;
}
const stream = streams[si];

const [, c, pkt, frame] =
    await libav.ff_init_decoder(stream.codec_id, stream.codecpar);

const [res, packets] = await libav.ff_read_frame_multi(fmt_ctx, pkt);
if (res !== libav.AVERROR_EOF)
    throw new Error(await libav.ff_error(res));
await libav.avformat_close_input_js(fmt_ctx);

const frames = await libav.ff_decode_multi(c, pkt, frame, packets[si], true);
await libav.ff_free_decoder(c, pkt, frame);

const sample_fmt_name = await libav.av_get_sample_fmt_name(frames[0].format);
if (sample_fmt_name !== "flt")
    throw new Error(`Unexpected sample format ${sample_fmt_name}`);
