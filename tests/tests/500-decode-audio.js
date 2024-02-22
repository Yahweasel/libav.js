/*
 * Copyright (c) 2023 Yahweasel and contributors
 * Copyright (c) 2001 Fabrice Bellard
 *
 * This test was adapted from decode_audio.c
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

const libav = await h.LibAV();

async function get_format_from_sample_fmt(fmt, sample_fmt)
{
    switch (sample_fmt) {
        case libav.AV_SAMPLE_FMT_U8: return "u8";
        case libav.AV_SAMPLE_FMT_S16: return "s16le";
        case libav.AV_SAMPLE_FMT_S32: return "s32le";
        case libav.AV_SAMPLE_FMT_FLT: return "f32le";
        case libav.AV_SAMPLE_FMT_DBL: return "f64le";
    }

    throw new Error(
        `sample format ${sample_fmt} is not supported as output format`);
}

async function decode(dec_ctx, pkt, frame, outbuf)
{
    /* send the packet with the compressed data to the decoder */
    let ret = await libav.avcodec_send_packet(dec_ctx, pkt);
    if (ret < 0) {
        throw new Error(
            "Error submitting the packet to the decoder");
    }

    /* read all the output frames (in general there may be any number of them */
    while (ret >= 0) {
        ret = await libav.avcodec_receive_frame(dec_ctx, frame);
        if (ret === -libav.EAGAIN || ret === libav.AVERROR_EOF)
            return;
        else if (ret < 0) {
            throw new Error(
                "Error during decoding");
        }
        const data_size = await libav.av_get_bytes_per_sample(
            await libav.AVCodecContext_sample_fmt(dec_ctx));
        if (data_size < 0) {
            /* This should not occur, checking just for paranoia */
            throw new Error(
                "Failed to calculate data size");
        }
        const nb_samples = await libav.AVFrame_nb_samples(frame);
        const channels = await libav.AVCodecContext_channels(dec_ctx);
        const data = [];
        for (let ch = 0; ch < channels; ch++) {
            const ptr = await libav.AVFrame_data_a(frame, ch);
            data.push(await libav.copyout_u8(ptr, data_size * nb_samples));
        }
        for (let i = 0; i < nb_samples; i++) {
            for (let ch = 0; ch < channels; ch++) {
                outbuf.push(data[ch].slice(data_size * i, data_size * i + data_size));
            }
        }
    }
}

async function main() {
    const filename = "bbb.mp4";
    const outbuf = [];

    const pkt = await libav.av_packet_alloc();

    const [fmt_ctx, streams] = await
        libav.ff_init_demuxer_file(filename);
    let streamIdx = -1, stream;
    for (let i = 0; i < streams.length; i++) {
        if (streams[i].codec_type === libav.AVMEDIA_TYPE_AUDIO) {
            streamIdx = i;
            stream = streams[i];
            break;
        }
    }
    if (streamIdx < 0)
        throw new Error("Could not find audio track");

    const codec = await libav.avcodec_find_decoder(stream.codec_id);
    if (!codec) {
        throw new Error(
            "Codec not found");
    }

    const c = await libav.avcodec_alloc_context3(codec);
    if (!c) {
        throw new Error(
            "Could not allocate audio codec context");
    }

    await libav.avcodec_parameters_to_context(c, stream.codecpar);

    /* open it */
    if (await libav.avcodec_open2(c, codec, 0) < 0) {
        throw new Error(
            "Could not open codec");
    }

    /* decode until eof */
    const [, packets] = await libav.ff_read_frame_multi(fmt_ctx, pkt);
    let decoded_frame;
    for (const packet of packets[streamIdx]) {
        if (!decoded_frame) {
            if (!(decoded_frame = await libav.av_frame_alloc())) {
                fprintf(stderr, "Could not allocate audio frame\n");
                exit(1);
            }
        }

        await libav.ff_copyin_packet(pkt, packet);

        await decode(c, pkt, decoded_frame, outbuf);
    }
    await libav.avformat_close_input_js(fmt_ctx);

    /* flush the decoder */
    await libav.AVPacket_data_s(pkt, 0);
    await libav.AVPacket_size_s(pkt, 0);
    await decode(c, pkt, decoded_frame, outbuf);

    /* print output pcm infomations, because there have no metadata of pcm */
    const sfmt = await libav.AVCodecContext_sample_fmt(c);

    /*
    if (av_sample_fmt_is_planar(sfmt)) {
        const char *packed = av_get_sample_fmt_name(sfmt);
        printf("Warning: the sample format the decoder produced is planar "
               "(%s). This example will output the first channel only.\n",
               packed ? packed : "?");
        sfmt = av_get_packed_sample_fmt(sfmt);
    }
    */

    await libav.avcodec_free_context_js(c);
    await libav.av_frame_free_js(decoded_frame);
    await libav.av_packet_free_js(pkt);

    // Check for correctness
    const out = new Float32Array(await (new Blob(outbuf)).arrayBuffer());
    await h.utils.compareAudio("bbb.mp4", out);
}
await main();
