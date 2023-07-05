/*
 * Copyright (c) 2023 Yahweasel and contributors
 * Copyright (c) 2013 Stefano Sabatini
 *
 * This test was adapted from remux.c, without av_interleaved_write_frame
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
 * @file libavformat/libavcodec demuxing and muxing API usage example
 * @example remux.c
 *
 * Remux streams from one container format to another. Data is copied from the
 * input to the output without transcoding.
 */

const libav = await h.LibAV();

/*
static void log_packet(const AVFormatContext *fmt_ctx, const AVPacket *pkt, const char *tag)
{
    AVRational *time_base = &fmt_ctx->streams[pkt->stream_index]->time_base;

    printf("%s: pts:%s pts_time:%s dts:%s dts_time:%s duration:%s duration_time:%s stream_index:%d\n",
           tag,
           av_ts2str(pkt->pts), av_ts2timestr(pkt->pts, time_base),
           av_ts2str(pkt->dts), av_ts2timestr(pkt->dts, time_base),
           av_ts2str(pkt->duration), av_ts2timestr(pkt->duration, time_base),
           pkt->stream_index);
}
*/

async function main() {
    let ret;

    const in_filename  = "bbb.mp4";
    const out_filename = "bbb-500-remux.mov";

    const pkt = await libav.av_packet_alloc();
    if (!pkt) {
        throw new Error(
            "Could not allocate AVPacket");
    }

    const ifmt_ctx = await
        libav.avformat_open_input_js(in_filename, 0, 0);
    if (!ifmt_ctx) {
        throw new Error(
            "Could not open input file " + in_filename);
    }

    if ((ret = await libav.avformat_find_stream_info(ifmt_ctx, 0)) < 0) {
        throw new Error(
            "Failed to retrieve input stream information");
    }

    //av_dump_format(ifmt_ctx, 0, in_filename, 0);

    const ofmt_ctx = await
        libav.avformat_alloc_output_context2_js(0, null, out_filename);
    if (!ofmt_ctx) {
        throw new Error(
            "Could not create output context");
    }

    const stream_mapping_size = await libav.AVFormatContext_nb_streams(ifmt_ctx);
    const stream_mapping = [];

    const ofmt = await libav.AVFormatContext_oformat(ofmt_ctx);

    let stream_index = 0;
    for (let i = 0; i < stream_mapping_size; i++) {
        const in_stream = await libav.AVFormatContext_streams_a(ifmt_ctx, i);
        const in_codecpar = await libav.AVStream_codecpar(in_stream);
        const codec_type = await libav.AVCodecParameters_codec_type(in_codecpar);

        if (codec_type != libav.AVMEDIA_TYPE_AUDIO &&
            codec_type != libav.AVMEDIA_TYPE_VIDEO) {
            stream_mapping.push(-1);
            continue;
        }

        stream_mapping.push(stream_index++);

        const out_stream = await
            libav.avformat_new_stream(ofmt_ctx, 0);
        if (!out_stream) {
            throw new Error(
                "Failed allocating output stream");
        }

        const out_codecpar = await libav.AVStream_codecpar(out_stream);
        ret = await
            libav.avcodec_parameters_copy(out_codecpar, in_codecpar);
        if (ret < 0) {
            throw new Error(
                "Failed to copy codec parameters");
        }
        await libav.AVCodecParameters_codec_tag_s(out_codecpar, 0);
    }
    //av_dump_format(ofmt_ctx, 0, out_filename, 1);

    const opb = await
        libav.avio_open2_js(out_filename, libav.AVIO_FLAG_WRITE, 0, 0);
    if (!opb) {
        throw new Error(
            "Could not open output file " + out_filename);
    }
    await libav.AVFormatContext_pb_s(ofmt_ctx, opb);

    ret = await libav.avformat_write_header(ofmt_ctx, 0);
    if (ret < 0) {
        throw new Error(
            "Error occurred when opening output file");
    }

    while (true) {
        ret = await libav.av_read_frame(ifmt_ctx, pkt);
        if (ret < 0)
            break;

        let pkt_stream_index = await
            libav.AVPacket_stream_index(pkt);
        const in_stream = await
            libav.AVFormatContext_streams_a(ifmt_ctx, pkt_stream_index);
        if (pkt_stream_index >= stream_mapping_size ||
            stream_mapping[pkt_stream_index] < 0) {
            await libav.av_packet_unref(pkt);
            continue;
        }

        pkt_stream_index = stream_mapping[pkt_stream_index];
        await libav.AVPacket_stream_index_s(pkt, pkt_stream_index);
        const out_stream = await
            libav.AVFormatContext_streams_a(ofmt_ctx, pkt_stream_index);
        //log_packet(ifmt_ctx, pkt, "in");

        /* copy packet */
        const [in_tb_num, in_tb_den, out_tb_num, out_tb_den] = [
            await libav.AVStream_time_base_num(in_stream),
            await libav.AVStream_time_base_den(in_stream),
            await libav.AVStream_time_base_num(out_stream),
            await libav.AVStream_time_base_den(out_stream)
        ];
        await libav.av_packet_rescale_ts_js(
            pkt, in_tb_num, in_tb_den, out_tb_num, out_tb_den);
        await libav.AVPacket_pos_s(pkt, -1);
        await libav.AVPacket_poshi_s(pkt, -1);
        //log_packet(ofmt_ctx, pkt, "out");

        ret = await libav.av_write_frame(ofmt_ctx, pkt);
        if (ret < 0) {
            throw new Error(
                "Error muxing packet");
        }
        await libav.av_packet_unref(pkt);
    }

    await libav.av_write_trailer(ofmt_ctx);
    await libav.av_packet_free_js(pkt);

    await libav.avformat_close_input_js(ifmt_ctx);

    /* close output */
    await libav.avio_close(opb);
    await libav.avformat_free_context(ofmt_ctx);

    /* validate output */
    await h.utils.compareAudio(in_filename, out_filename);
}
await main();
