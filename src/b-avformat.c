/*
 * Copyright (C) 2019-2025 Yahweasel and contributors
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

/* AVFormatContext */
#define B(type, field) A(AVFormatContext, type, field)
#define BA(type, field) AA(AVFormatContext, type, field)
#define BL(type, field) AL(AVFormatContext, type, field)
BL(int64_t, duration)
B(int, flags)
B(unsigned int, nb_streams)
B(const struct AVOutputFormat *, oformat)
B(AVIOContext *, pb)
BL(int64_t, start_time)
BA(AVStream *, streams)
#undef B
#undef BA
#undef BL

/* AVStream */
#define B(type, field) A(AVStream, type, field)
#define BL(type, field) AL(AVStream, type, field)
B(AVCodecParameters *, codecpar)
B(enum AVDiscard, discard)
BL(int64_t, duration)
#undef B
#undef BL

RAT(AVStream, time_base)

int avformat_seek_file_min(
    AVFormatContext *s, int stream_index, int64_t ts, int flags
) {
    return avformat_seek_file(s, stream_index, ts, ts, INT64_MAX, flags);
}

int avformat_seek_file_max(
    AVFormatContext *s, int stream_index, int64_t ts, int flags
) {
    return avformat_seek_file(s, stream_index, INT64_MIN, ts, ts, flags);
}

int avformat_seek_file_approx(
    AVFormatContext *s, int stream_index, int64_t ts, int flags
) {
    return avformat_seek_file(s, stream_index, INT64_MIN, ts, INT64_MAX, flags);
}

AVFormatContext *avformat_alloc_output_context2_js(AVOutputFormat *oformat,
    const char *format_name, const char *filename)
{
    AVFormatContext *ret = NULL;
    int err = avformat_alloc_output_context2(&ret, oformat, format_name, filename);
    if (err < 0)
        fprintf(stderr, "[avformat_alloc_output_context2_js] %s\n", av_err2str(err));
    return ret;
}

AVFormatContext *avformat_open_input_js(const char *url, AVInputFormat *fmt,
    AVDictionary *options)
{
    AVFormatContext *ret = NULL;
    AVDictionary** options_p = &options;
    int err = avformat_open_input(&ret, url, fmt, options_p);
    if (err < 0)
        fprintf(stderr, "[avformat_open_input_js] %s\n", av_err2str(err));
    return ret;
}

AVIOContext *avio_open2_js(const char *url, int flags,
    const AVIOInterruptCB *int_cb, AVDictionary *options)
{
    AVIOContext *ret = NULL;
    AVDictionary** options_p = &options;
    int err = avio_open2(&ret, url, flags, int_cb, options_p);
    if (err < 0)
        fprintf(stderr, "[avio_open2_js] %s\n", av_err2str(err));
    return ret;
}

static const int LIBAVFORMAT_VERSION_INT_V = LIBAVFORMAT_VERSION_INT;
#undef LIBAVFORMAT_VERSION_INT
int LIBAVFORMAT_VERSION_INT() { return LIBAVFORMAT_VERSION_INT_V; }
