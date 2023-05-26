/*
 * Copyright (c) 2023 Yahweasel and contributors
 * Copyright (c) 2001 Fabrice Bellard
 *
 * This test was adapted from encode_video.c
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
 * @file libavcodec encoding video API usage example
 * @example encode_video.c
 *
 * Generate synthetic video data and encode it to an output file.
 */

const libav = await h.LibAV();

async function encode(enc_ctx, frame, pkt, outbuf) {
    let ret;

    /* send the frame to the encoder */
    ret = await libav.avcodec_send_frame(enc_ctx, frame);
    if (ret < 0) {
        throw new Error(
            "Error sending a frame for encoding");
    }

    while (ret >= 0) {
        ret = await libav.avcodec_receive_packet(enc_ctx, pkt);
        if (ret === -libav.EAGAIN || ret === libav.AVERROR_EOF)
            return;
        else if (ret < 0) {
            throw new Error(
                "Error during encoding");
        }

        outbuf.push(await libav.ff_copyout_packet(pkt));
        await libav.av_packet_unref(pkt);
    }
}

async function main() {
    let ret;
    const outbuf = [];

    const codec_name = "libvpx";

    /* find the video encoder */
    const codec = await
        libav.avcodec_find_encoder_by_name(codec_name);
    if (!codec) {
        throw new Error(
            "Codec not found");
    }

    const c = await libav.avcodec_alloc_context3(codec);
    if (!c) {
        throw new Error(
            "Could not allocate video codec context");
    }

    const pkt = await libav.av_packet_alloc();
    if (!pkt)
        throw new Error("Failed to allocate packet");

    /* put sample parameters */
    await libav.AVCodecContext_bit_rate_s(c, 400000);
    /* resolution must be a multiple of two */
    await libav.AVCodecContext_width_s(c, 352);
    await libav.AVCodecContext_height_s(c, 288);
    /* frames per second */
    await libav.AVCodecContext_time_base_s(c, 1, 25);
    await libav.AVCodecContext_framerate_s(c, 25, 1);

    /* emit one intra frame every ten frames
     * check frame pict_type before passing frame
     * to encoder, if frame->pict_type is AV_PICTURE_TYPE_I
     * then gop_size is ignored and the output of encoder
     * will always be I frame irrespective to gop_size
     */
    await libav.AVCodecContext_gop_size_s(c, 10);
    await libav.AVCodecContext_max_b_frames_s(c, 1);
    await libav.AVCodecContext_pix_fmt_s(c, libav.AV_PIX_FMT_YUV420P);

    /* open it */
    ret = await libav.avcodec_open2(c, codec, 0);
    if (ret < 0) {
        throw new Error(
            "Could not open codec: " + await libav.ff_error(ret));
    }

    const frame = await libav.av_frame_alloc();
    if (!frame) {
        throw new Error(
            "Could not allocate video frame");
    }
    await libav.AVFrame_format_s(frame,
        await libav.AVCodecContext_pix_fmt(c));
    await libav.AVFrame_width_s(frame,
        await libav.AVCodecContext_width(c));
    await libav.AVFrame_height_s(frame,
        await libav.AVCodecContext_height(c));

    ret = await libav.av_frame_get_buffer(frame, 0);
    if (ret < 0) {
        throw new Error(
            "Could not allocate the video frame data");
    }

    /* encode 1 second of video */
    const width = await libav.AVCodecContext_width(c);
    const height = await libav.AVCodecContext_height(c);
    for (let i = 0; i < 25; i++) {
        /* Make sure the frame data is writable.
           On the first round, the frame is fresh from av_frame_get_buffer()
           and therefore we know it is writable.
           But on the next rounds, encode() will have called
           avcodec_send_frame(), and the codec may have kept a reference to
           the frame in its internal structures, that makes the frame
           unwritable.
           av_frame_make_writable() checks that and allocates a new buffer
           for the frame only if necessary.
         */
        ret = await libav.av_frame_make_writable(frame);
        if (ret < 0)
            throw new Error("Failed to make frame writable");

        /* Prepare a dummy image.
           In real code, this is where you would have your own logic for
           filling the frame. FFmpeg does not care what you put in the
           frame.
         */
        /* Y */
        const dataYPtr = await libav.AVFrame_data_a(frame, 0);
        const linesizeY = await libav.AVFrame_linesize_a(frame, 0);
        const dataY = new Uint8Array(linesizeY * height);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                dataY[y * linesizeY + x] = x + y + i * 3;
            }
        }
        await libav.copyin_u8(dataYPtr, dataY);

        /* Cb and Cr */
        const dataCPtr = [
            await libav.AVFrame_data_a(frame, 1),
            await libav.AVFrame_data_a(frame, 2)
        ];
        const linesizeC = [
            await libav.AVFrame_linesize_a(frame, 1),
            await libav.AVFrame_linesize_a(frame, 2)
        ];
        const dataC = [
            new Uint8Array(linesizeC[0] * height / 2),
            new Uint8Array(linesizeC[1] * height / 2)
        ];
        for (let y = 0; y < height/2; y++) {
            for (let x = 0; x < width/2; x++) {
                dataC[0][y * linesizeC[0] + x] = 128 + y + i * 2;
                dataC[1][y * linesizeC[1] + x] = 64 + x + i * 5;
            }
        }
        await libav.copyin_u8(dataCPtr[0], dataC[0]);
        await libav.copyin_u8(dataCPtr[1], dataC[1]);

        await libav.AVFrame_pts_s(frame, i);

        /* encode the image */
        await encode(c, frame, pkt, outbuf);
    }

    /* flush the encoder */
    await encode(c, 0, pkt, outbuf);

    await libav.avcodec_free_context_js(c);
    await libav.av_frame_free_js(frame);
    await libav.av_packet_free_js(pkt);
}
await main();
