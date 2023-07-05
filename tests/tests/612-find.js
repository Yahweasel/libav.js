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

// Testing the various find_ functions

const libav = await h.LibAV();

const [fmt_ctx, streams] =
    await libav.ff_init_demuxer_file("bbb.webm");

let si;
for (si = 0; si < streams.length; si++) {
    stream = streams[si];
    const fd1 = await libav.avcodec_find_decoder(stream.codec_id);
    let name = await libav.avcodec_get_name(stream.codec_id);
    if (name === "vp9")
        name = "libvpx-vp9";
    else if (name === "opus")
        name = "libopus";
    const fd2 = await libav.avcodec_find_decoder_by_name(name);
    const fe1 = await libav.avcodec_find_encoder(stream.codec_id);
    const fe2 = await libav.avcodec_find_encoder_by_name(name);
    if (fd1 !== fd2 || fe1 !== fe2)
        throw new Error(`Failed to find codecs (${name}, ${fd1} ${fd2}, ${fe1} ${fe2})`);
}

await libav.av_find_input_format("matroska");

await libav.avformat_close_input_js(fmt_ctx);
