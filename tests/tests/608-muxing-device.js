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

// Muxing to a device

async function main() {
    const libav = await h.LibAV();
    let output = new Uint8Array(0);

    let oldOnWrite = libav.onwrite;
    libav.onwrite = function(name, pos, buf) {
        let newLen = pos + buf.length;
        if (output.length < newLen) {
            let newOutput = new Uint8Array(newLen);
            newOutput.set(output);
            output = newOutput;
        }
        output.set(buf, pos);
    };

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

    const [oc, fmt, pb, [st]] = await libav.ff_init_muxer(
        {filename: "tmp.ogg", open: true, device: true}, [[c, 1, 48000]]);

    await libav.avformat_write_header(oc, 0)

    let t = 0;
    let tincr = 2 * Math.PI * 440 / 48000;
    let pts = 0;
    let frames = [];

    for (let i = 0; i < 200; i++) {
        let samples = [];

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

    const packets = await libav.ff_encode_multi(c, frame, pkt, frames, true);

    await libav.ff_write_multi(oc, pkt, packets);

    await libav.av_write_trailer(oc);

    await libav.ff_free_muxer(oc, pb);
    await libav.ff_free_encoder(c, frame, pkt);

    await libav.unlink("tmp.ogg");
    if (oldOnWrite)
        libav.onwrite = oldOnWrite;
    else
        delete libav.onwrite;
}

await main();
