/*
 * Copyright (C) 2019-2024 Yahweasel and contributors
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

#include <stdio.h>
#include <string.h>

#include <malloc.h>

#ifdef __EMSCRIPTEN_PTHREADS__
#include <emscripten.h>
#include <pthread.h>
#endif

#include "libavcodec/avcodec.h"
#include "libavformat/avformat.h"
#include "libavfilter/avfilter.h"
#include "libavutil/avutil.h"
#include "libavutil/opt.h"
#include "libavutil/pixdesc.h"
#include "libavutil/version.h"

#define A(struc, type, field) \
    type struc ## _ ## field(struc *a) { return a->field; } \
    void struc ## _ ## field ## _s(struc *a, type b) { a->field = b; }

#define AL(struc, type, field) \
    uint32_t struc ## _ ## field(struc *a) { return (uint32_t) a->field; } \
    uint32_t struc ## _ ## field ## hi(struc *a) { return (uint32_t) (a->field >> 32); } \
    void struc ## _ ## field ## _s(struc *a, uint32_t b) { a->field = b; } \
    void struc ## _ ## field ## hi_s(struc *a, uint32_t b) { a->field |= (((type) b) << 32); }

#define AA(struc, type, field) \
    type struc ## _ ## field ## _a(struc *a, size_t c) { return a->field[c]; } \
    void struc ## _ ## field ## _a_s(struc *a, size_t c, type b) { ((type *) a->field)[c] = b; }


/* Not part of libav, just used to ensure a round trip to C for async purposes */
void ff_nothing() {}


/****************************************************************
 * libavutil
 ***************************************************************/

/* AVFrame */
#define B(type, field) A(AVFrame, type, field)
#define BL(type, field) AL(AVFrame, type, field)
#define BA(type, field) AA(AVFrame, type, field)
B(size_t, crop_bottom)
B(size_t, crop_left)
B(size_t, crop_right)
B(size_t, crop_top)
BA(uint8_t *, data)
B(int, format)
B(int, height)
B(int, key_frame)
BA(int, linesize)
B(int, nb_samples)
B(int, pict_type)
BL(int64_t, pts)
B(int, sample_rate)
B(int, width)
#undef B
#undef BL
#undef BA

/* Either way we expose the old channel layout API, but if the new channel
 * layout API is available, we use it */
#if LIBAVUTIL_VERSION_INT > AV_VERSION_INT(57, 23, 100)
/* New API */
#define CHL(struc) \
void struc ## _channel_layoutmask_s(struc *a, uint32_t bl, uint32_t bh) { \
    uint64_t mask =  (((uint64_t) bl)) | (((uint64_t) bh) << 32); \
    av_channel_layout_uninit(&a->ch_layout); \
    av_channel_layout_from_mask(&a->ch_layout, mask);\
} \
uint64_t struc ## _channel_layoutmask(struc *a) { \
    return a->ch_layout.u.mask; \
}\
int struc ## _channels(struc *a) { \
    return a->ch_layout.nb_channels; \
} \
void struc ## _channels_s(struc *a, int b) { \
    a->ch_layout.nb_channels = b; \
}\
int struc ## _ch_layout_nb_channels(struc *a) { \
    return a->ch_layout.nb_channels; \
}\
void struc ## _ch_layout_nb_channels_s(struc *a, int b) { \
    a->ch_layout.nb_channels = b; \
}\
uint32_t struc ## _channel_layout(struc *a) { \
    return (uint32_t) a->ch_layout.u.mask; \
}\
uint32_t struc ##_channel_layouthi(struc *a) { \
    return (uint32_t) (a->ch_layout.u.mask >> 32);\
}\
void struc ##_channel_layout_s(struc *a, uint32_t b) { \
    a->ch_layout.u.mask = (a->ch_layout.u.mask & (0xFFFFFFFFull << 32)) | (((uint64_t) b));\
    uint64_t mask = a->ch_layout.u.mask;\
    av_channel_layout_uninit(&a->ch_layout);\
    av_channel_layout_from_mask(&a->ch_layout, mask);\
}\
void struc ##_channel_layouthi_s(struc *a, uint32_t b) { \
    a->ch_layout.u.mask = (a->ch_layout.u.mask & 0xFFFFFFFFull) | (((uint64_t) b) << 32);\
    uint64_t mask = a->ch_layout.u.mask;\
    av_channel_layout_uninit(&a->ch_layout);\
    av_channel_layout_from_mask(&a->ch_layout, mask);\
}

#else
/* Old API */
#define CHL(struc) \
void struc ## _channel_layoutmask_s(struc *a, uint32_t bl, uint32_t bh) { \
    a->channel_layout = ((uint16_t) bh << 32) | bl; \
} \
uint64_t struc ## _channel_layoutmask(struc *a) { \
    return a->channel_layout; \
}\
int struc ## _channels(struc *a) { \
    return a->channels; \
} \
void struc ## _channels_s(struc *a, int b) { \
    a->channels = b; \
}\
int struc ## _ch_layout_nb_channels(struc *a) { \
    return a->channels; \
}\
void struc ## _ch_layout_nb_channels_s(struc *a, int b) { \
    a->channels = b; \
}\
uint32_t struc ## _channel_layout(struc *a) { \
    return a->channel_layout; \
}\
uint32_t struc ##_channel_layouthi(struc *a) { \
    return a->channel_layout >> 32; \
}\
void struc ##_channel_layout_s(struc *a, uint32_t b) { \
    a->channel_layout = \
        (a->channel_layout & (0xFFFFFFFFull << 32)) | \
        ((uint64_t) b); \
}\
void struc ##_channel_layouthi_s(struc *a, uint32_t b) { \
    a->channel_layout = \
        (((uint64_t) b) << 32) | \
        (a->channel_layout & 0xFFFFFFFFull); \
}

#endif /* Channel layout API version */

CHL(AVFrame)

int AVFrame_sample_aspect_ratio_num(AVFrame *a) {
    return a->sample_aspect_ratio.num;
}

int AVFrame_sample_aspect_ratio_den(AVFrame *a) {
    return a->sample_aspect_ratio.den;
}

void AVFrame_sample_aspect_ratio_s(AVFrame *a, int n, int d) {
    a->sample_aspect_ratio.num = n;
    a->sample_aspect_ratio.den = d;
}

/* AVPixFmtDescriptor */
#define B(type, field) A(AVPixFmtDescriptor, type, field)
B(uint64_t, flags)
B(uint8_t, nb_components)
B(uint8_t, log2_chroma_h)
B(uint8_t, log2_chroma_w)
#undef B

int AVPixFmtDescriptor_comp_depth(AVPixFmtDescriptor *fmt, int comp)
{
    return fmt->comp[comp].depth;
}

int av_opt_set_int_list_js(void *obj, const char *name, int width, void *val, int term, int flags)
{
    switch (width) {
        case 4:
            return av_opt_set_int_list(obj, name, ((int32_t *) val), term, flags);
        case 8:
            return av_opt_set_int_list(obj, name, ((int64_t *) val), term, flags);
        default:
            return AVERROR(EINVAL);
    }
}


/****************************************************************
 * libavcodec
 ***************************************************************/

/* AVCodec */
#define B(type, field) A(AVCodec, type, field)
#define BA(type, field) AA(AVCodec, type, field)
B(enum AVSampleFormat *, sample_fmts)
BA(enum AVSampleFormat, sample_fmts)
B(int *, supported_samplerates)
BA(int, supported_samplerates)
B(enum AVMediaType, type)
#undef B
#undef BA

/* AVCodecContext */
#define B(type, field) A(AVCodecContext, type, field)
#define BL(type, field) AL(AVCodecContext, type, field)
B(enum AVCodecID, codec_id)
B(enum AVMediaType, codec_type)
BL(int64_t, bit_rate)
B(uint8_t *, extradata)
B(int, extradata_size)
B(int, frame_size)
B(int, gop_size)
B(int, height)
B(int, keyint_min)
B(int, level)
B(int, max_b_frames)
B(int, pix_fmt)
B(int, profile)
BL(int64_t, rc_max_rate)
BL(int64_t, rc_min_rate)
B(int, sample_fmt)
B(int, sample_rate)
B(int, qmax)
B(int, qmin)
B(int, width)
#undef B
#undef BL

CHL(AVCodecContext)

int AVCodecContext_framerate_num(AVCodecContext *a) {
    return a->framerate.num;
}

int AVCodecContext_framerate_den(AVCodecContext *a) {
    return a->framerate.den;
}

void AVCodecContext_framerate_num_s(AVCodecContext *a, int b) {
    a->framerate.num = b;
}

void AVCodecContext_framerate_den_s(AVCodecContext *a, int b) {
    a->framerate.den = b;
}

void AVCodecContext_framerate_s(AVCodecContext *a, int n, int d) {
    a->framerate.num = n;
    a->framerate.den = d;
}

int AVCodecContext_sample_aspect_ratio_num(AVCodecContext *a) {
    return a->sample_aspect_ratio.num;
}

int AVCodecContext_sample_aspect_ratio_den(AVCodecContext *a) {
    return a->sample_aspect_ratio.den;
}

void AVCodecContext_sample_aspect_ratio_num_s(AVCodecContext *a, int b) {
    a->sample_aspect_ratio.num = b;
}

void AVCodecContext_sample_aspect_ratio_den_s(AVCodecContext *a, int b) {
    a->sample_aspect_ratio.den = b;
}

void AVCodecContext_sample_aspect_ratio_s(AVCodecContext *a, int n, int d) {
    a->sample_aspect_ratio.num = n;
    a->sample_aspect_ratio.den = d;
}

void AVCodecContext_time_base_s(AVCodecContext *a, int n, int d) {
    a->time_base.num = n;
    a->time_base.den = d;
}

/* AVCodecDescriptor */
#define B(type, field) A(AVCodecDescriptor, type, field)
B(enum AVCodecID, id)
B(char *, long_name)
AA(AVCodecDescriptor, char *, mime_types)
B(char *, name)
B(int, props)
B(enum AVMediaType, type)
#undef B

/* AVCodecParameters */
#define B(type, field) A(AVCodecParameters, type, field)
B(enum AVCodecID, codec_id)
B(uint32_t, codec_tag)
B(enum AVMediaType, codec_type)
B(uint8_t *, extradata)
B(int, extradata_size)
B(int, format)
B(int64_t, bit_rate)
B(int, profile)
B(int, level)
B(int, width)
B(int, height)
B(enum AVColorRange, color_range)
B(enum AVColorPrimaries, color_primaries)
B(enum AVColorTransferCharacteristic, color_trc)
B(enum AVColorSpace, color_space)
B(enum AVChromaLocation, chroma_location)
B(int, sample_rate)
#undef B

CHL(AVCodecParameters)
#undef CHL

/* AVPacket */
#define B(type, field) A(AVPacket, type, field)
#define BL(type, field) AL(AVPacket, type, field)
B(uint8_t *, data)
BL(int64_t, dts)
BL(int64_t, duration)
B(int, flags)
BL(int64_t, pos)
BL(int64_t, pts)
B(AVPacketSideData *, side_data)
B(int, side_data_elems)
B(int, size)
B(int, stream_index)
#undef B
#undef BL


/* AVPacketSideData uses special accessors because it's usually an array */
uint8_t *AVPacketSideData_data(AVPacketSideData *a, int idx) {
    return a[idx].data;
}

int AVPacketSideData_size(AVPacketSideData *a, int idx) {
    return a[idx].size;
}

enum AVPacketSideDataType AVPacketSideData_type(AVPacketSideData *a, int idx) {
    return a[idx].type;
}

int avcodec_open2_js(
    AVCodecContext *avctx, const AVCodec *codec, AVDictionary *options
) {
    return avcodec_open2(avctx, codec, &options);
}

/* Implemented as a binding so that we don't have to worry about struct copies */
void av_packet_rescale_ts_js(
    AVPacket *pkt,
    int tb_src_num, int tb_src_den,
    int tb_dst_num, int tb_dst_den
) {
    AVRational tb_src = {tb_src_num, tb_src_den},
               tb_dst = {tb_dst_num, tb_dst_den};
    av_packet_rescale_ts(pkt, tb_src, tb_dst);
}


/****************************************************************
 * avformat
 ***************************************************************/

/* AVFormatContext */
#define B(type, field) A(AVFormatContext, type, field)
#define BA(type, field) AA(AVFormatContext, type, field)
B(int, flags)
B(unsigned int, nb_streams)
B(struct AVOutputFormat *, oformat)
B(AVIOContext *, pb)
BA(AVStream *, streams)
#undef B
#undef BA

/* AVStream */
#define B(type, field) A(AVStream, type, field)
#define BL(type, field) AL(AVStream, type, field)
B(AVCodecParameters *, codecpar)
B(enum AVDiscard, discard)
BL(int64_t, duration)
#undef B
#undef BL

int AVStream_time_base_num(AVStream *a) {
    return a->time_base.num;
}

int AVStream_time_base_den(AVStream *a) {
    return a->time_base.den;
}

void AVStream_time_base_s(AVStream *a, int n, int d) {
    a->time_base.num = n;
    a->time_base.den = d;
}

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


/****************************************************************
 * avfilter
 ***************************************************************/

/* AVFilterInOut */
#define B(type, field) A(AVFilterInOut, type, field)
B(AVFilterContext *, filter_ctx)
B(char *, name)
B(AVFilterInOut *, next)
B(int, pad_idx)
#undef B


/****************************************************************
 * swscale
 ***************************************************************/
int libavjs_with_swscale() {
#ifdef LIBAVJS_WITH_SWSCALE
    return 1;
#else
    return 0;
#endif
}

#ifndef LIBAVJS_WITH_SWSCALE
/* swscale isn't included, but we need the symbols */
void sws_getContext() {}
void sws_freeContext() {}
void sws_scale_frame() {}

#elif LIBAVUTIL_VERSION_INT <= AV_VERSION_INT(57, 4, 101)
/* No sws_scale_frame in this version */
void sws_scale_frame() {}

#endif


/****************************************************************
 * CLI
 ***************************************************************/
int libavjs_with_cli() {
#ifdef LIBAVJS_WITH_CLI
    return 1;
#else
    return 0;
#endif
}

#ifndef LIBAVJS_WITH_CLI
int ffmpeg_main() { return 0; }
int ffprobe_main() { return 0; }
#endif


/****************************************************************
 * Threading
 ***************************************************************/

#ifdef __EMSCRIPTEN_PTHREADS__
EM_JS(void *, libavjs_main_thread, (void *ignore), {
    // Avoid exiting the runtime so we can receive normal requests
    noExitRuntime = Module.noExitRuntime = true;

    // Hijack the event handler
    var origOnmessage = onmessage;
    onmessage = function(ev) {
        var a;

        function reply(succ, ret) {
            var transfer = [];
            if (typeof ret === "object" && ret && ret.libavjsTransfer)
                transfer = ret.libavjsTransfer;
            postMessage({
                c: "libavjs_ret",
                a: [a[0], a[1], succ, ret]
            }, transfer);
        }

        if (ev.data && ev.data.c === "libavjs_run") {
            a = ev.data.a;
            var succ = true;
            var ret;
            try {
                ret = Module[a[1]].apply(Module, a.slice(2));
            } catch (ex) {
                succ = false;
                ret = ex + "\n" + ex.stack;
            }
            if (succ && ret && ret.then) {
                ret
                    .then(function(ret) { reply(true, ret); })
                    .catch(function(ret) { reply(false, ret + "\n" + ret.stack); });
            } else {
                reply(succ, ret);
            }

        } else if (ev.data && ev.data.c === "libavjs_wait_reader") {
            var name = "" + ev.data.fd;
            var waiters = Module.ff_reader_dev_waiters[name] || [];
            delete Module.ff_reader_dev_waiters[name];
            for (var i = 0; i < waiters.length; i++)
                waiters[i]();

        } else {
            return origOnmessage.apply(this, arguments);
        }
    };

    // And indicate that we're ready
    postMessage({c: "libavjs_ready"});
});

pthread_t libavjs_create_main_thread()
{
    pthread_t ret;
    if (pthread_create(&ret, NULL, libavjs_main_thread, NULL))
        return NULL;
    return ret;
}

#else
void *libavjs_create_main_thread() { return NULL; }

#endif

/****************************************************************
 * Other bindings
 ***************************************************************/

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

AVFilterContext *avfilter_graph_create_filter_js(const AVFilter *filt,
    const char *name, const char *args, void *opaque, AVFilterGraph *graph_ctx)
{
    AVFilterContext *ret = NULL;
    int err = avfilter_graph_create_filter(&ret, filt, name, args, opaque, graph_ctx);
    if (err < 0)
        fprintf(stderr, "[avfilter_graph_create_filter_js] %s\n", av_err2str(err));
    return ret;
}

AVDictionary *av_dict_copy_js(
    AVDictionary *dst, const AVDictionary *src, int flags
) {
    av_dict_copy(&dst, src, flags);
    return dst;
}

AVDictionary *av_dict_set_js(
    AVDictionary *pm, const char *key, const char *value, int flags
) {
    av_dict_set(&pm, key, value, flags);
    return pm;
}

int av_compare_ts_js(
    unsigned int ts_a_lo, int ts_a_hi,
    int tb_a_num, int tb_a_den,
    unsigned int ts_b_lo, int ts_b_hi,
    int tb_b_num, int tb_b_den
) {
    int64_t ts_a = (int64_t) ts_a_lo + ((int64_t) ts_a_hi << 32);
    int64_t ts_b = (int64_t) ts_b_lo + ((int64_t) ts_b_hi << 32);
    AVRational tb_a = {tb_a_num, tb_b_den},
               tb_b = {tb_b_num, tb_b_den};
    return av_compare_ts(ts_a, tb_a, ts_b, tb_b);
}


/* Errors */
#define ERR_BUF_SZ 256
static char err_buf[ERR_BUF_SZ];

char *ff_error(int err)
{
    av_strerror(err, err_buf, ERR_BUF_SZ - 1);
    return err_buf;
}

int mallinfo_uordblks()
{
    return mallinfo().uordblks;
}
