/*
 * Copyright (c) 2023 Yahweasel and contributors
 * Copyright (c) 2001 Fabrice Bellard
 *
 * This test was adapted from decode_video.c
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
 * @file libavcodec video decoding API usage example
 * @example decode_video.c *
 *
 * Read from an MPEG1 video file, decode frames, and generate PGM images as
 * output.
 */

const libav = await h.LibAV();

async function decode(dec_ctx, frame, pkt)
{
    let ret;

    ret = await libav.avcodec_send_packet(dec_ctx, pkt);
    if (ret < 0) {
        throw new Error(
            "Error sending a packet for decoding");
    }

    while (ret >= 0) {
        ret = await libav.avcodec_receive_frame(dec_ctx, frame);
        if (ret === -libav.EAGAIN || ret === libav.AVERROR_EOF)
            return;
        else if (ret < 0) {
            throw new Error(
                "Error during decoding");
        }

        // This test just makes sure it decodes, so does nothing with the data
    }
}

async function main()
{
    let ret;
    const filename    = "bbb.mp4";

    pkt = await libav.av_packet_alloc();
    if (!pkt)
        throw new Error("Failed to allocate packet");

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
            "Could not allocate video codec context");
    }

    await libav.avcodec_parameters_to_context(c, stream.codecpar);

    /* open it */
    if (await libav.avcodec_open2(c, codec, 0) < 0) {
        throw new Error(
            "Could not open codec");
    }

    const frame = await libav.av_frame_alloc();
    if (!frame) {
        throw new Error(
            "Could not allocate video frame");
    }

    /* decode until eof */
    const [, packets] = await libav.ff_read_frame_multi(fmt_ctx, pkt);

    /* do a pointless BSF */
    let outPackets = [];
    {
        const bsf = await libav.av_bsf_list_parse_str_js("null");
        await libav.av_bsf_init(bsf);
        for (const packet of packets[streamIdx]) {
            await libav.ff_copyin_packet(pkt, packet);
            await libav.av_bsf_send_packet(bsf, pkt);
            while (true) {
                const ret = await libav.av_bsf_receive_packet(bsf, pkt);
                if (ret === -libav.EAGAIN)
                    break;
                if (ret < 0)
                    throw new Error("Failed to filter packet");
                outPackets.push(await libav.ff_copyout_packet(pkt));
                await libav.av_packet_unref(pkt);
            }
        }

        await libav.av_bsf_flush(bsf);
        while (true) {
            const ret = await libav.av_bsf_receive_packet(bsf, pkt);
            if (ret === -libav.EAGAIN)
                break;
            if (ret < 0)
                throw new Error("Failed to flush BSF");
            outPackets.push(await libav.ff_copyout_packet(pkt));
            await libav.av_packet_unref(pkt);
        }

        await libav.av_bsf_free_js(bsf);
    }

    let decoded_frame;
    for (const packet of outPackets) {
        await libav.ff_copyin_packet(pkt, packet);
        await decode(c, frame, pkt);
    }
    await libav.avformat_close_input_js(fmt_ctx);

    /* flush the decoder */
    await decode(c, frame, 0);

    await libav.avcodec_free_context_js(c);
    await libav.av_frame_free_js(frame);
    await libav.av_packet_free_js(pkt);
}
await main();
