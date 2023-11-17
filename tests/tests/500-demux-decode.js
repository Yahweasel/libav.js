/*
 * Copyright (c) 2023 Yahweasel and contributors
 * Copyright (c) 2012 Stefano Sabatini
 *
 * This test was adapted from demux_decode.c
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
 * @file libavformat and libavcodec demuxing and decoding API usage example
 * @example demux_decode.c
 *
 * Show how to use the libavformat and libavcodec API to demux and decode audio
 * and video data. Write the output as raw audio and input files to be played by
 * ffplay.
 */

const libav = await h.LibAV();

let fmt_ctx, video_dec_ctx, audio_dec_ctx, width, height, pix_fmt, video_stream,
    audio_stream, src_filename;

let video_stream_idx = -1, audio_stream_idx = -1, frame, pkt, video_frame_count,
    audio_frame_count;

async function output_video_frame(frame)
{
    const fWidth = await libav.AVFrame_width(frame);
    const fHeight = await libav.AVFrame_height(frame);
    const fFormat = await libav.AVFrame_format(frame);
    if (fWidth !== width || fHeight !== height ||
        fFormat !== pix_fmt) {
        /* To handle this change, one could call av_image_alloc again and
         * decode the following frames into another rawvideo file. */
        throw new Error(
            "Error: Width, height and pixel format have to be " +
            "constant in a rawvideo file, but the width, height or " +
            "pixel format of the input video changed.");
    }

    /*
    printf("video_frame n:%d\n",
           video_frame_count++);
    */

    /* copy decoded frame to destination buffer:
     * this is required since rawvideo expects non aligned data */
    /*
    av_image_copy(video_dst_data, video_dst_linesize,
                  (const uint8_t **)(frame->data), frame->linesize,
                  pix_fmt, width, height);
    */
    const outFrame = await libav.copyout_frame(frame);

    /* write to rawvideo file */
    //fwrite(video_dst_data[0], 1, video_dst_bufsize, video_dst_file);
}

async function output_audio_frame(frame)
{
    const unpadded_linesize =
        await libav.AVFrame_nb_samples(frame) *
        await libav.av_get_bytes_per_sample(
            await libav.AVFrame_format(frame));
    /*
    printf("audio_frame n:%d nb_samples:%d pts:%s\n",
           audio_frame_count++, frame->nb_samples,
           av_ts2timestr(frame->pts, &audio_dec_ctx->time_base));
     */

    /* Write the raw audio data samples of the first plane. This works
     * fine for packed formats (e.g. AV_SAMPLE_FMT_S16). However,
     * most audio decoders output planar audio, which uses a separate
     * plane of audio samples for each channel (e.g. AV_SAMPLE_FMT_S16P).
     * In other words, this code will write only the first audio channel
     * in these cases.
     * You should use libswresample or libavfilter to convert the frame
     * to packed data. */
    //fwrite(frame->extended_data[0], 1, unpadded_linesize, audio_dst_file);
}

async function decode_packet(dec, pkt, video)
{
    let ret;

    // submit the packet to the decoder
    ret = await libav.avcodec_send_packet(dec, pkt);
    if (ret < 0) {
        throw new Error(
            "Error submitting a packet for decoding (" +
            await libav.ff_error(ret) +
            ")");
    }

    // get all the available frames from the decoder
    while (ret >= 0) {
        ret = await libav.avcodec_receive_frame(dec, frame);
        if (ret < 0) {
            // those two return values are special and mean there is no output
            // frame available, but there were no errors during decoding
            if (ret === libav.AVERROR_EOF || ret === -libav.EAGAIN)
                return 0;

            throw new Error(
                "Error during decoding (" +
                await libav.ff_error(ret) +
                ")");
        }

        // write the frame data to output file
        if (video)
            await output_video_frame(frame);
        else
            await output_audio_frame(frame);

        await libav.av_frame_unref(frame);
    }
}

async function open_codec_context(fmt_ctx, type) {
    let ret;

    ret = await libav.av_find_best_stream(fmt_ctx, type, -1, -1, 0, 0);
    if (ret < 0) {
        throw new Error("Could not find stream in input file");
    } else {
        const stream_index = ret;
        const st = await libav.AVFormatContext_streams_a(fmt_ctx, stream_index);
        const codecpar = await libav.AVStream_codecpar(st);
        const codecparId = await libav.AVCodecParameters_codec_id(codecpar);

        /* find decoder for the stream */
        const dec = await libav.avcodec_find_decoder(codecparId);
        if (!dec) {
            throw new Error("Failed to find codec");
        }

        /* Allocate a codec context for the decoder */
        const dec_ctx = await libav.avcodec_alloc_context3(dec);
        if (!dec_ctx) {
            throw new Error("Failed to allocate codec context");
        }

        /* Copy codec parameters from input stream to output codec context */
        ret = await libav.avcodec_parameters_to_context(dec_ctx, codecpar);
        if (ret < 0) {
            throw new Error("Failed to copy codec parameters to decoder context");
        }

        /* Init the decoders */
        ret = await libav.avcodec_open2(dec_ctx, dec, 0);
        if (ret < 0) {
            throw new Error("Failed to open codec");
        }
        return [stream_index, dec_ctx];
    }
}

async function main()
{
    let ret;

    src_filename = "bbb.mp4";

    /* open input file, and allocate format context */
    const options = await libav.av_dict_set_js(0, "foobar", "123");
    fmt_ctx = await
        libav.avformat_open_input_js(src_filename, 0, options);
    if (!fmt_ctx) {
        throw new Error(
            "Could not open source file");
    }

    /* retrieve stream information */
    ret = await libav.avformat_find_stream_info(fmt_ctx, 0);
    if (ret < 0) {
        throw new Error(
            "Could not find stream information");
    }

    [video_stream_idx, video_dec_ctx] = await
        open_codec_context(fmt_ctx, libav.AVMEDIA_TYPE_VIDEO);
    video_stream = await libav.AVFormatContext_streams_a(fmt_ctx, video_stream_idx);

    width = await libav.AVCodecContext_width(video_dec_ctx);
    height = await libav.AVCodecContext_height(video_dec_ctx);
    pix_fmt = await libav.AVCodecContext_pix_fmt(video_dec_ctx);

    [audio_stream_idx, audio_dec_ctx] = await
        open_codec_context(fmt_ctx, libav.AVMEDIA_TYPE_AUDIO);
    audio_stream = await libav.AVFormatContext_streams_a(fmt_ctx, audio_stream_idx);

    /* dump input information to stderr */
    //av_dump_format(fmt_ctx, 0, src_filename, 0);

    frame = await libav.av_frame_alloc();
    if (!frame) {
        throw new Error(
            "Could not allocate frame");
    }

    pkt = await libav.av_packet_alloc();
    if (!pkt) {
        throw new Error(
            "Could not allocate packet");
    }

    /* read frames from the file */
    while (await libav.av_read_frame(fmt_ctx, pkt) >= 0) {
        // check if the packet belongs to a stream we are interested in, otherwise
        // skip it
        const pktStreamIndex = await libav.AVPacket_stream_index(pkt);
        if (pktStreamIndex === video_stream_idx)
            await decode_packet(video_dec_ctx, pkt);
        else if (pktStreamIndex === audio_stream_idx)
            await decode_packet(audio_dec_ctx, pkt);
        await libav.av_packet_unref(pkt);
    }

    /* flush the decoders */
    await decode_packet(video_dec_ctx, 0);
    await decode_packet(audio_dec_ctx, 0);

    await libav.avcodec_free_context_js(video_dec_ctx);
    await libav.avcodec_free_context_js(audio_dec_ctx);
    await libav.avformat_close_input_js(fmt_ctx);
    await libav.av_packet_free_js(pkt);
    await libav.av_frame_free_js(frame);
}
await main();
