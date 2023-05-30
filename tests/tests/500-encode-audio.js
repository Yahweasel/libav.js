/*
 * Copyright (c) 2023 Yahweasel and contributors
 * Copyright (c) 2001 Fabrice Bellard
 *
 * This test was adapted from encode_audio.c
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 * THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

/**
 * @file libavcodec encoding audio API usage examples
 * @example encode_audio.c
 *
 * Generate a synthetic audio signal and encode it to an output MP2 file.
 */

const libav = await h.LibAV();

async function encode(ctx, frame, pkt, outbuf) {
    let ret;

    /* send the frame for encoding */
    ret = await libav.avcodec_send_frame(ctx, frame);
    if (ret < 0) {
        throw new Error(
            "Error sending the frame to the encoder");
    }

    /* read all the available output packets (in general there may be any
     * number of them */
    while (ret >= 0) {
        ret = await libav.avcodec_receive_packet(ctx, pkt);
        if (ret === -libav.EAGAIN || ret === libav.AVERROR_EOF)
            return;
        else if (ret < 0) {
            throw new Error(
                "Error encoding audio frame");
        }

        outbuf.push(await libav.ff_copyout_packet(pkt));
        await libav.av_packet_unref(pkt);
    }
}

async function main() {
    let ret;
    const outbuf = [];

    /* find the libopus encoder */
    const codec = await
        libav.avcodec_find_encoder_by_name("libopus");
    if (!codec) {
        throw new Error(
            "Codec not found");
    }

    const c = await libav.avcodec_alloc_context3(codec);
    if (!c) {
        throw new Error(
            "Could not allocate audio codec context");
    }

    /* put sample parameters */
    await libav.AVCodecContext_bit_rate_s(c, 64000);
    await libav.AVCodecContext_sample_fmt_s(c, libav.AV_SAMPLE_FMT_FLT);

    /* select other audio parameters supported by the encoder */
    await libav.AVCodecContext_sample_rate_s(c, 48000);
    await libav.AVCodecContext_channel_layout_s(c, 3);

    /* open it */
    ret = await libav.avcodec_open2(c, codec, 0);
    if (ret < 0) {
        throw new Error(
            "Could not open codec");
    }

    /* packet for holding encoded output */
    pkt = await libav.av_packet_alloc();
    if (!pkt) {
        throw new Error(
            "could not allocate the packet");
    }

    /* frame containing input raw audio */
    frame = await libav.av_frame_alloc();
    if (!frame) {
        throw new Error(
            "Could not allocate audio frame");
    }

    await libav.AVFrame_nb_samples_s(frame,
        await libav.AVCodecContext_frame_size(c));
    await libav.AVFrame_format_s(frame,
        await libav.AVCodecContext_sample_fmt(c));
    await libav.AVFrame_channel_layout_s(frame,
        await libav.AVCodecContext_channel_layout(c));

    /* allocate the data buffers */
    ret = await libav.av_frame_get_buffer(frame, 0);
    if (ret < 0) {
        throw new Error(
            "Could not allocate audio data buffers");
    }

    /* encode a single tone sound */
    let t = 0;
    const tincr = 2 * Math.PI * 440.0 /
        await libav.AVCodecContext_sample_rate(c);
    const frame_size = await libav.AVCodecContext_frame_size(c);
    for (let i = 0; i < 200; i++) {
        /* make sure the frame is writable -- makes a copy if the encoder
         * kept a reference internally */
        ret = await libav.av_frame_make_writable(frame);
        if (ret < 0)
            throw new Error("Could not make frame writable");
        //samples = (uint16_t*)frame->data[0];
        const samples_loc = await libav.AVFrame_data_a(frame, 0);
        const samples = new Float32Array(frame_size);

        for (let j = 0; j < frame_size; j += 2) {
            samples[2*j] = Math.sin(t) * 0.1;

            for (let k = 1; k < 2; k++)
                samples[2*j + k] = samples[2*j];
            t += tincr;
        }
        await libav.copyin_f32(samples_loc, samples);
        await encode(c, frame, pkt, outbuf);
    }

    /* flush the encoder */
    await encode(c, 0, pkt, outbuf);

    await libav.av_frame_free_js(frame);
    await libav.av_packet_free_js(pkt);
    await libav.avcodec_free_context_js(c);
}
await main();
