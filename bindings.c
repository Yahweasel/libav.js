/*
 * Copyright (C) 2019-2023 Yahweasel and contributors
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
#include <inttypes.h>
#include <stdbool.h>
#include <time.h>
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

#include "libavutil/dict.h"
#include "libavutil/pixfmt.h"

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
    void struc ## _ ## field ## _a_s(struc *a, size_t c, type b) { a->field[c] = b; }


/* Not part of libav, just used to ensure a round trip to C for async purposes */
void ff_nothing() {}


/****************************************************************
 * libavutil
 ***************************************************************/

/* AVFrame */
#define B(type, field) A(AVFrame, type, field)
#define BL(type, field) AL(AVFrame, type, field)
#define BA(type, field) AA(AVFrame, type, field)
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

// Replacement for printf, that automatically adds a newline.
// In Emscripten printf is line buffered. With this callers
// don't have to always add a "\n" to the end of printf strings
char printBuf[10000];
void print(const char *fmt, ...) {
    va_list args;
    va_start(args, fmt);
    sprintf(printBuf, fmt, args);
    va_end(args);
    printf("%s\n",printBuf);
}

// The following code should work also with older code
#define CHL(struc)\
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
A(AVPixFmtDescriptor, uint8_t, log2_chroma_h)

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

/* AVCodecParameters */
#define B(type, field) A(AVCodecParameters, type, field)
B(enum AVCodecID, codec_id)
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
struct AVCodecParameters *ff_calloc_AVCodecParameters()
{
    return (struct AVCodecParameters *)
        calloc(1, sizeof(struct AVCodecParameters));
}

/* AVPacket */
#define B(type, field) A(AVPacket, type, field)
#define BL(type, field) AL(AVPacket, type, field)
B(uint8_t *, data)
BL(int64_t, dts)
BL(int64_t, duration)
B(int, flags)
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
#define BL(type, field) AL(AVStream, type, field)
B(AVCodecParameters *, codecpar)
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

int AVStream_width(AVStream* avStream) {
    return avStream->codecpar->width;
}

int AVStream_height(AVStream* avStream) {
    return avStream->codecpar->height;
}

int64_t toInt64(unsigned int lowBits, unsigned int highBits) {
    return ((int64_t) highBits << 32) | lowBits;
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
            postMessage({
                c: "libavjs_ret",
                a: [a[0], a[1], succ, ret]
            });
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
            var waiters = Module.ff_reader_dev_waiters;
            Module.ff_reader_dev_waiters = [];
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
    AVDictionary **options)
{
    AVFormatContext *ret = NULL;
    int err = avformat_open_input(&ret, url, fmt, options);
    if (err < 0)
        fprintf(stderr, "[avformat_open_input_js] %s\n", av_err2str(err));
    return ret;
}

AVStream* findStreamByCodecType(AVFormatContext *pFormatContext, enum AVMediaType codecType){
    for (int i = 0; i < pFormatContext->nb_streams; i++) {
        AVStream *avStream = pFormatContext->streams[i];
        if (avStream->codecpar->codec_type == codecType) {
            return avStream;
        }
    }
    return NULL;
}

// Number.MIN_SAFE_INTEGER
const int64_t JS_MIN_SAFE_INTEGER = -9007199254740991;
// Number.MAX_SAFE_INTEGER
const int64_t JS_MAX_SAFE_INTEGER = 9007199254740991;


int64_t findStartTimestamp(AVFormatContext *pFormatContext, enum AVMediaType codecType){
    AVStream* avStream = findStreamByCodecType(pFormatContext, codecType);

    if(avStream==NULL){
        return JS_MAX_SAFE_INTEGER;
    }

    AVPacket pkt;

    // Find the first video and audio stream
    av_seek_frame(pFormatContext, avStream->index, 0, AVSEEK_FLAG_BACKWARD);

    if( av_read_frame(pFormatContext, &pkt) >= 0 ){
        printf("Frame codecType: %i, target codecType: %i\n", avStream->codecpar->codec_type, codecType);

        if(pkt.flags & AV_PKT_FLAG_KEY) {
            printf("The packet is a keyframe.\n");
        } else {
            printf("The packet is not a keyframe.\n");
        }

        int64_t start = pkt.pts;

        av_packet_unref(&pkt);
        return start;
    } else {
        return JS_MAX_SAFE_INTEGER; 
    }
    
}

char readRawPacketTimes[2000] = "";
const char * avformat_read_raw_packet_times(const char *filename) {

    AVFormatContext *pFormatContext = NULL;

    // Open the file and read header.
    int ret;
    if ((ret = avformat_open_input(&pFormatContext, filename, NULL, NULL)) < 0) {
        printf("Error: avformat_read_raw_packet_durations in: (%s). \"%s\",  %i \n", filename, av_err2str(ret), ret);
        strcpy(readRawPacketTimes, "{\"audioDuration\":-1, \"videoDuration\":-1}");
        return readRawPacketTimes;
    }
    
    int64_t min_video_start = findStartTimestamp(pFormatContext, AVMEDIA_TYPE_VIDEO);
    int64_t min_audio_start = findStartTimestamp(pFormatContext, AVMEDIA_TYPE_AUDIO);

    int64_t max_video_end = JS_MIN_SAFE_INTEGER;
    int64_t max_audio_end = JS_MIN_SAFE_INTEGER;
    
    int videoTimebaseNumerator = -1;
    int videoTimebaseDenominator = -1;

    int audioTimebaseNumerator = -1;
    int audioTimebaseDenominator = -1;

    // Jump to the last GOP in a file and then scan through it's packets looking for the one highest timestamp+duration
    // we can find
    AVPacket pkt;
    av_seek_frame(pFormatContext, -1, INT64_MAX, AVSEEK_FLAG_BACKWARD);

    while(av_read_frame(pFormatContext, &pkt)>=0) {
        AVStream* avStream = pFormatContext->streams[pkt.stream_index];

        // Skip if it's not audio or video
        bool isVideo = avStream->codecpar->codec_type == AVMEDIA_TYPE_VIDEO;
        bool isAudio = avStream->codecpar->codec_type == AVMEDIA_TYPE_AUDIO;

        if( isAudio || isVideo ){
            int64_t end = pkt.pts + pkt.duration;

            if(isVideo && end > max_video_end){
                videoTimebaseNumerator = avStream->time_base.num;
                videoTimebaseDenominator = avStream->time_base.den;
                max_video_end = end;
            }

            if(isAudio && end > max_audio_end){
                audioTimebaseNumerator = avStream->time_base.num;
                audioTimebaseDenominator = avStream->time_base.den;
                max_audio_end = end;
            }
        }

        av_packet_unref(&pkt);
    }

    avformat_close_input(&pFormatContext);

    if(min_audio_start == INT64_MAX && min_video_start == INT64_MAX){
        const char *error = "avformat_read_raw_packet_times found no audio or video tracks";
        printf(error);
        sprintf(readRawPacketTimes, "{\"error\": \"%s\"", error);
    } else {
        sprintf(readRawPacketTimes, 
        "{\n"
        "  \"video\": {\n"
        "    \"start\": %" PRId64 ",\n"
        "    \"end\": %" PRId64 ",\n"
        "    \"timebase\": {\n"
        "      \"numerator\": %i,\n"
        "      \"denominator\": %i\n"
        "    }\n"
        "  },\n"
        "  \"audio\": {\n"
        "    \"start\": %" PRId64 ",\n"
        "    \"end\": %" PRId64 ",\n"
        "    \"timebase\": {\n"
        "      \"numerator\": %i,\n"
        "      \"denominator\": %i\n"
        "    }\n"
        "  }\n"
        "}",
        min_video_start, max_video_end, videoTimebaseNumerator, videoTimebaseDenominator, min_audio_start, max_audio_end, audioTimebaseNumerator, audioTimebaseDenominator);
    }

    // "{\"video\": {\"start\": %" PRId64 
    //     ", \"end\": %" PRId64 
    //     ", \"timebase\": {\"numerator\": %i, \"denominator\": %i}}, \"audio\": {\"start\": %" PRId64 
    //     ", \"end\": %" PRId64 
    //     ", \"timebase\": {\"numerator\": %i, \"denominator\": %i}}"
    

    return readRawPacketTimes;
}

AVIOContext *avio_open2_js(const char *url, int flags,
    const AVIOInterruptCB *int_cb, AVDictionary **options)
{
    AVIOContext *ret = NULL;
    int err = avio_open2(&ret, url, flags, int_cb, options);
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
