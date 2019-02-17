/*
 * Copyright (C) 2019 Yahweasel
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

#include "libavcodec/avcodec.h"
#include "libavformat/avformat.h"
#include "libavfilter/avfilter.h"

#define A(struc, type, field) \
    type struc ## _ ## field(struc *a) { return a->field; } \
    void struc ## _ ## field ## _s(struc *a, type b) { a->field = b; }

#define AA(struc, type, field) \
    type struc ## _ ## field ## _a(struc *a, size_t c) { return a->field[c]; } \
    void struc ## _ ## field ## _a_s(struc *a, size_t c, type b) { a->field[c] = b; }


/****************************************************************
 * libavutil
 ***************************************************************/

/* AVFrame */
#define B(type, field) A(AVFrame, type, field)
#define BA(type, field) AA(AVFrame, type, field)
B(uint64_t, channel_layout)
BA(uint8_t *, data)
B(int, format)
B(int, nb_samples)
B(int64_t, pts)
#undef B
#undef BA


/****************************************************************
 * libavcodec
 ***************************************************************/

/* AVCodecContext */
#define B(type, field) A(AVCodecContext, type, field)
B(int64_t, bit_rate)
B(uint64_t, channel_layout)
B(int, channels)
B(int, frame_size)
B(int, sample_fmt)
B(int, sample_rate)
#undef B

void AVCodecContext_time_base_s(AVCodecContext *a, int n, int d) {
    a->time_base.num = n;
    a->time_base.den = d;
}

/* AVCodecParameters */
#define B(type, field) A(AVCodecParameters, type, field)
B(enum AVCodecID, codec_id)
B(enum AVMediaType, codec_type)
#undef B

/* AVPacket */
#define B(type, field) A(AVPacket, type, field)
B(uint8_t *, data)
B(int64_t, dts)
B(int, size)
B(int, stream_index)
B(int64_t, pts)
#undef B


/****************************************************************
 * avformat
 ***************************************************************/

/* AVFormatContext */
#define B(type, field) A(AVFormatContext, type, field)
#define BA(type, field) AA(AVFormatContext, type, field)
B(unsigned int, nb_streams)
B(struct AVOutputFormat *, oformat)
B(AVIOContext *, pb)
BA(AVStream *, streams)
#undef B
#undef BA

/* AVStream */
#define B(type, field) A(AVStream, type, field)
B(AVCodecParameters *, codecpar);
#undef B

void AVStream_time_base_s(AVStream *a, int n, int d) {
    a->time_base.num = n;
    a->time_base.den = d;
}


/****************************************************************
 * Bindings to avoid pointer issues
 ***************************************************************/

AVFormatContext *avformat_alloc_output_context2_js(AVOutputFormat *oformat,
    const char *format_name, const char *filename)
{
    AVFormatContext *ret = NULL;
    avformat_alloc_output_context2(&ret, oformat, format_name, filename);
    return ret;
}

AVFormatContext *avformat_open_input_js(const char *url, AVInputFormat *fmt,
    AVDictionary **options)
{
    AVFormatContext *ret = NULL;
    avformat_open_input(&ret, url, fmt, options);
    return ret;
}

AVIOContext *avio_open2_js(const char *url, int flags,
    const AVIOInterruptCB *int_cb, AVDictionary **options)
{
    AVIOContext *ret = NULL;
    avio_open2(&ret, url, flags, int_cb, options);
    return ret;
}

AVFilterContext *avfilter_graph_create_filter_js(const AVFilter *filt,
    const char *name, const char *args, void *opaque, AVFilterGraph *graph_ctx)
{
    AVFilterContext *ret = NULL;
    avfilter_graph_create_filter(&ret, filt, name, args, opaque, graph_ctx);
    return ret;
}
