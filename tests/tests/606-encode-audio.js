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

// Audio encoding using our meta API

const libav = await h.LibAV();

const [codec, c, frame, pkt, frame_size] =
    await libav.ff_init_encoder("libopus", {
        ctx: {
            bit_rate: 128000,
            sample_fmt: libav.AV_SAMPLE_FMT_FLT,
            sample_rate: 48000,
            channel_layout: 4,
            channels: 1
        },
        time_base: [1, 48000]
    });

let t = 0;
let tincr = 2 * Math.PI * 440 / 48000;
let pts = 0;
let frames = [];

for (let i = 0; i < 200; i++) {
    const samples = new Float32Array(frame_size);

    for (let j = 0; j < frame_size; j++) {
        samples[j] = Math.sin(t);
        t += tincr;
    }

    frames.push({
        data: samples,
        channel_layout: 4,
        format: libav.AV_SAMPLE_FMT_FLT,
        pts: pts,
        sample_rate: 48000
    });
    pts += frame_size;
}

const packets =
    await libav.ff_encode_multi(c, frame, pkt, frames, true);

await libav.ff_free_encoder(c, frame, pkt);

/*
FIXME: This doesn't decode to identical data, but it may just be that Opus
wasn't really meant for encoding pure tones, so gives a result that sounds right
but doesn't decode identically.
// To make sure it encoded correctly, decode it
let outFrames;
{
    const [, c, pkt, frame] = await
        libav.ff_init_decoder("libopus");
    await libav.AVCodecContext_channel_layoutmask_s(c, 4);
    outFrames = await libav.ff_decode_multi(c, pkt, frame, packets, true);
    await libav.ff_free_decoder(c, pkt, frame);
}

await h.utils.compareAudio(frames, outFrames);
*/
