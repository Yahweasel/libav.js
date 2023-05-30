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


char readRawPacketDurations[1000000] = "";
const char * avformat_read_raw_packet_durations(const char *filename) {

    AVFormatContext *pFormatContext = NULL;

    // Open the file and read header.
    int ret;
    if ((ret = avformat_open_input(&pFormatContext, filename, NULL, NULL)) < 0) {
        printf("Error: avformat_read_raw_packet_durations in: (%s). \"%s\",  %i \n", filename, av_err2str(ret), ret);
        strcpy(readRawPacketDurations, "{\"audioDuration\":-1, \"videoDuration\":-1}");
        return readRawPacketDurations;
    }

    AVPacket pkt;
    // Seek to the last keyframe
    av_seek_frame(pFormatContext, -1, INT64_MAX, AVSEEK_FLAG_BACKWARD | AVSEEK_FLAG_ANY);

    // Initialize the highest timestamp
    double max_audio_duration = -1;
    double max_video_duration = -1;

    // printf("avformat_read_raw_packet_durations before loop\n");
    while(av_read_frame(pFormatContext, &pkt)>=0) {
        AVStream* avStream = pFormatContext->streams[pkt.stream_index];

        // Skip if it's not audio or video
        bool isVideo = avStream->codecpar->codec_type == AVMEDIA_TYPE_VIDEO;
        bool isAudio = avStream->codecpar->codec_type == AVMEDIA_TYPE_AUDIO;

        // printf("avformat_read_raw_packet_durations loop (isVideo = %i, isAudio = %i\n", isVideo, isAudio);

        if( isAudio || isVideo ){
            double end = (pkt.pts + pkt.duration)*av_q2d(pFormatContext->streams[pkt.stream_index]->time_base);

            // printf("end = %f. max_video_duration = %f, max_audio_duration = %f\n", end, max_video_duration, max_audio_duration);

            if(isVideo && end>max_video_duration){
                max_video_duration = end;
            } else if(isAudio && end>max_audio_duration){
                max_audio_duration = end;
            }


        }

        av_packet_unref(&pkt);
    }

    avformat_close_input(&pFormatContext);

    // printf("avformat_read_raw_packet_durations after loop\n");
    // printf("max_video_duration = %f, max_audio_duration = %f\n", max_video_duration, max_audio_duration);

    // Audio and video
    if( max_audio_duration != -1 && max_video_duration != -1 ) {
        sprintf(readRawPacketDurations, "{\"audioDuration\": %f, \"videoDuration\": %f}", max_audio_duration, max_video_duration);
        return readRawPacketDurations;
    }
    // Just audio
    else if(max_audio_duration != -1){
        sprintf(readRawPacketDurations, "{\"audioDuration\": %f, \"videoDuration\": -1}", max_audio_duration);
        return readRawPacketDurations;
    }
    // Just video
    else if(max_video_duration != -1){
        sprintf(readRawPacketDurations, "{\"videoDuration\": %f, \"audioDuration\": -1}", max_video_duration);
        return readRawPacketDurations;
    } else {
        printf("Error: avformat_read_raw_packet_durations no audio or video tracks");
        strcpy(readRawPacketDurations, "{\"audioDuration\":-1, \"videoDuration\":-1}");
        return readRawPacketDurations;
    }
}

char videoSampleTimingJson2[1000000] = "";
const char * avformat_get_video_sample_timing(const char *filename) {
    videoSampleTimingJson2[0] = 0;

    AVFormatContext *pFormatContext = NULL;

    print("%s", filename);

    // Open the file and read header.
    int ret;
    if ((ret = avformat_open_input(&pFormatContext, filename, NULL, NULL)) < 0) {
        printf("Error: avformat_get_video_sample_timing in: (%s). \"%s\",  %i \n", filename, av_err2str(ret), ret);
        strcpy(videoSampleTimingJson2, "{duration:0.0, gops:[]}");
        return videoSampleTimingJson2;
    }

    clock_t startTime, endTime;

    // Record the start time
    startTime = clock();

    int offset = 0;
    AVStream* avStream = NULL;
    for (int i = 0; i < pFormatContext->nb_streams; i++) {
        avStream = pFormatContext->streams[i];
        if(avStream->codecpar->codec_type==AVMEDIA_TYPE_VIDEO){
            break;
        }
    }

    double timeBase = av_q2d(avStream->time_base);
    double duration = (double)avStream->duration * timeBase;

    offset += sprintf(videoSampleTimingJson2+offset, "{");
        double streamDuration = avStream->duration * timeBase;
        offset += sprintf(videoSampleTimingJson2+offset, "\"duration\": %.4f,", streamDuration);

        offset += sprintf(videoSampleTimingJson2+offset, "\"gops\": [");

    double timeCompenstation = 0.0;


    int sampleCount = avformat_index_get_entries_count(avStream);
    for(int c = 0; c<sampleCount; c++){
        AVIndexEntry* indexEntry = avformat_index_get_entry(avStream, c);

        bool isKeyframe = indexEntry->flags & 0x0001;

        if(isKeyframe){
            double timestamp = (double)indexEntry->timestamp * timeBase;

            // HACK: Remove this, there is a whole complicated story around timestamps I think. Marcello has mentioned
            // in other cases where he has had to decode each packet in order to get the correct timestamp. This is a quick
            // workaround so I can focus on seeking logic
            if(timestamp<0.0&&c==0){
                timeCompenstation = -timestamp;
                timestamp = 0.0;
            } else {
                timestamp += timeCompenstation;
            }

            offset += sprintf(videoSampleTimingJson2+offset, "%.4f,", timestamp);
        }
    }
    // Remove the dangling comma
    if(sampleCount){
        offset--;
    }

    avformat_close_input(&pFormatContext);

        offset += sprintf(videoSampleTimingJson2+offset, "]");
    offset += sprintf(videoSampleTimingJson2+offset, "}");

    // Record the end time
    endTime = clock();

    // Calculate the elapsed time
    double elapsedTime = (double)(endTime - startTime) / CLOCKS_PER_SEC;

    // Print the elapsed time
    printf("Elapsed time: %f seconds\n", elapsedTime);

    return videoSampleTimingJson2;
    // return "{}";
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
