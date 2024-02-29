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

// Loading alternate variants

// Make a Vorbis file
let data;
{
    const libav = await h.LibAV();
    await libav.ffmpeg(
        "-nostdin", "-loglevel", "quiet",
        "-i", "bbb.webm",
        "-map", "0:a", "-c:a", "libvorbis",
        "tmp.ogg"
    );
    data = await libav.readFile("tmp.ogg");
    await libav.unlink("tmp.ogg");
}

// Load the default variant, which doesn't have Vorbis support
const opts = {variant: "default"};
if (h.libAVOpts) Object.assign(opts, h.libAVOpts);
const libav = await h.LibAV(opts);
await libav.writeFile("tmp.ogg", data);

const [fmt_ctx, streams] = await libav.ff_init_demuxer_file("tmp.ogg");

let si, stream;
for (si = 0; si < streams.length; si++) {
    stream = streams[si];
    if (stream.codec_type === libav.AVMEDIA_TYPE_AUDIO)
        break;
}
if (si >= streams.length)
    throw new Error("Couldn't find AAC stream");

const stream_idx = stream.index;

let succeeded = false;

try {
    let [, c, pkt, frame] =
        await libav.ff_init_decoder(stream.codec_id, stream.codecpar);

    let [res, packets] = await libav.ff_read_frame_multi(fmt_ctx, pkt);

    if (res !== libav.AVERROR_EOF)
        throw new Error("Error reading: " + res);

    const frames = await libav.ff_decode_multi(c, pkt, frame,
        packets[stream_idx], true);

    await libav.ff_free_decoder(c, pkt, frame);
    await libav.avformat_close_input_js(fmt_ctx);

    succeeded = true;
} catch (ex) {}

// If this *succeeded*, it was an error
if (succeeded)
    throw new Error("Failed to load alternate variant");

libav.terminate();
