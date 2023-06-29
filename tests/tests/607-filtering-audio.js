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

// Audio filtering using our meta API

/* This is sort of a port of doc/examples/filtering_audio.c, but
 * with fixed input and output formats, simplified */
async function main() {
    const libav = await h.LibAV();

    const [, c, frame, pkt, frame_size] =
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

    const [oc, fmt, pb, [st]] =
        await libav.ff_init_muxer({filename: "tmp.ogg", open: true},
            [[c, 1, 48000]]);

    await libav.avformat_write_header(oc, 0);
    const [filter_graph, buffersrc_ctx, buffersink_ctx] =
        await libav.ff_init_filter_graph("atempo=0.5,volume=0.1", {
            sample_rate: 48000,
            sample_fmt: libav.AV_SAMPLE_FMT_FLT,
            channel_layout: 4
        }, {
            sample_rate: 48000,
            sample_fmt: libav.AV_SAMPLE_FMT_FLT,
            channel_layout: 4,
            frame_size: frame_size
        });

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

    const filterFrames = await libav.ff_filter_multi(buffersrc_ctx,
        buffersink_ctx, frame, frames, true);

    const packets =
        await libav.ff_encode_multi(c, frame, pkt, filterFrames, true);

    await libav.ff_write_multi(oc, pkt, packets);

    await libav.av_write_trailer(oc);

    await libav.avfilter_graph_free_js(filter_graph);
    await libav.ff_free_muxer(oc, pb);
    await libav.ff_free_encoder(c, frame, pkt);

    await libav.unlink("tmp.ogg");
}

await main();
