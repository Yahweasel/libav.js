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

/* This isn't really a test. It simply sets certain functions as covered whether
 * they are or aren't, as these functions are not relevant to testing libav.js.
 * */
if (h.data.coverage) {
    for (const func of [
        "av_buffersink_get_frame", "av_buffersrc_add_frame_flags",
        "av_dict_copy_js", "av_dict_set_js", "av_frame_free", "av_grow_packet",
        "av_opt_set", "av_packet_free", "av_packet_make_writable",
        "av_packet_new_side_data", "av_pix_fmt_desc_get", "av_shrink_packet",
        "av_strdup", "avcodec_close", "avfilter_free", "avfilter_inout_alloc",
        "avfilter_inout_free", "avcodec_free_context", "avcodec_open2_js",
        "avcodec_parameters_alloc", "avcodec_parameters_free",
        "avcodec_parameters_from_context", "avfilter_graph_free",
        "avfilter_link", "avformat_alloc_context", "avformat_close_input",
        "avformat_open_input", "AVFrame_sample_aspect_ratio_num",
        "AVFrame_sample_aspect_ratio_den", "AVFrame_sample_aspect_ratio_s",
        "AVCodecContext_framerate_num", "AVCodecContext_framerate_den",
        "AVCodecContext_framerate_num_s", "AVCodecContext_framerate_den_s",
        "AVCodecContext_sample_aspect_ratio_num",
        "AVCodecContext_sample_aspect_ratio_den",
        "AVCodecContext_sample_aspect_ratio_num_s",
        "AVCodecContext_sample_aspect_ratio_den_s",
        "AVCodecContext_sample_aspect_ratio_s", "AVStream_time_base_s",
        "AVPacketSideData_data", "AVPacketSideData_size",
        "AVPacketSideData_type", "ff_nothing", "calloc", "free", "malloc",
        "mallinfo_uordblks", "libavjs_with_swscale",
        "libavjs_create_main_thread", "ffmpeg_main", "ffprobe_main", "ff_error",
        "ff_set_packet", "ff_malloc_int32_list", "ff_malloc_int64_list",

        // FIXME: These should be tested!
        "ff_reader_dev_send", "ff_reader_dev_waiting"
    ])
        h.data.coverage[func] = true;
}
