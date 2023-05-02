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
BL(uint64_t, channel_layout)
B(int, channels)
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
BL(int64_t, bit_rate)
BL(uint64_t, channel_layout)
B(int, channels)
B(uint8_t *, extradata)
B(int, extradata_size)
B(int, frame_size)
B(int, gop_size)
B(int, height)
B(int, keyint_min)
B(int, level)
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
B(int, channels)
B(int, sample_rate)
#undef B

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

size_t av_get_codec_tag_string(char *buf, size_t buf_size, unsigned int codec_tag)
 {
     int i, len, ret = 0;
 
 #define TAG_PRINT(x)                                              \
     (((x) >= '0' && (x) <= '9') ||                                \
      ((x) >= 'a' && (x) <= 'z') || ((x) >= 'A' && (x) <= 'Z') ||  \
      ((x) == '.' || (x) == ' ' || (x) == '-' || (x) == '_'))
 
     for (i = 0; i < 4; i++) {
         len = snprintf(buf, buf_size,
                        TAG_PRINT(codec_tag & 0xFF) ? "%c" : "[%d]", codec_tag & 0xFF);
         buf        += len;
         buf_size    = buf_size > len ? buf_size - len : 0;
         ret        += len;
         codec_tag >>= 8;
     }
     return ret;
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

int avformat_seek_frame(
    AVFormatContext *pFormatContext, 
    int stream_index, 
    unsigned int timestampLowBits, 
    unsigned int timestampHighBits, 
    int flags) 
{
    int64_t timestamp = toInt64(timestampLowBits, timestampHighBits);
    // printf("av_seek_frame_js timestamp: %" PRIi64 "\n", timestamp);
    return av_seek_frame(pFormatContext, stream_index, timestamp, flags);
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

char metaDataJson[100000] = "";
const char * avformat_get_meta_data(const char *filename) {

    // TODO: Just noticing that this function not longer deallocates any memory 
    // it allocates. Fix that.

    metaDataJson[0] = 0;
    // Initialize the FFmpeg library
    // av_register_all();

    // print("----AVFormat_get_meta_data--------------------------");

    AVFormatContext *pFormatContext = NULL;

    // Open the file and read header.
    int ret;
    if ((ret = avformat_open_input(&pFormatContext, filename, NULL, NULL)) < 0) {
        print("ERROR: %s\n", av_err2str(ret));
    }

    // printf("FORMATS\n");    

    // printf("nb_streams: %u\n",pFormatContext->nb_streams);
    // Figure out if this is a video or audio file and calculate the maximum
    // duration of all streams
    // TODO: Look again to see if there is a field or function that calculates the maximum duration for you.
    //       pFormatContext->max_analyze_duration and pFormatContext->duration were always 0 for me.
    //       https://ffmpeg.org/doxygen/trunk/structAVFormatContext.html#a4d860662c014f88277c8f20e238fa694
    bool foundVideo = false;
    bool foundAudio = false;
    float maxDurationInSeconds = 0.0;
    for (int i = 0; i < pFormatContext->nb_streams; i++) {
        AVStream* avStream = pFormatContext->streams[i];
        if(avStream->codecpar->codec_type==AVMEDIA_TYPE_VIDEO){
            foundVideo = true;
        } else if(avStream->codecpar->codec_type==AVMEDIA_TYPE_AUDIO){
            foundAudio = true;
        }

        float durationInSeconds = (float)( 
            ((double)avStream->duration)/((double)avStream->time_base.den)
        );
        if(durationInSeconds>maxDurationInSeconds){
            maxDurationInSeconds = durationInSeconds;
        }   
    }
    sprintf(metaDataJson+strlen(metaDataJson), "{\n");

    if(foundVideo){
        sprintf(metaDataJson+strlen(metaDataJson), "\"type\": \"video\",\n");
    } else if(foundAudio){
        sprintf(metaDataJson+strlen(metaDataJson), "\"type\": \"audio\",\n");
    } else {
        printf("ERROR: No audio or video streams were found in the AVFormatContext\n");
    }

    

    
    sprintf(metaDataJson+strlen(metaDataJson), "\"duration\": %.3f,\n",maxDurationInSeconds);
    sprintf(metaDataJson+strlen(metaDataJson), "\"estimatedDuration\": %.3f,\n",maxDurationInSeconds);

    sprintf(metaDataJson+strlen(metaDataJson), "\"format\": \"%s\",\n", pFormatContext->iformat->name);
    if(pFormatContext->iformat->long_name==NULL){
        sprintf(metaDataJson+strlen(metaDataJson), "\"formatLong\": \"undefined\",\n");
    } else {
        sprintf(metaDataJson+strlen(metaDataJson), "\"formatLong\": \"%s\",\n", pFormatContext->iformat->long_name);
    }

    // Get stream info from format.
    if (avformat_find_stream_info(pFormatContext, NULL) < 0) {
      print("ERROR: could not get stream info\n");
    }

    int video_stream_index = av_find_best_stream(pFormatContext, AVMEDIA_TYPE_VIDEO, -1, -1, NULL, 0);

    // AVStream *stream = pFormatContext->streams[video_stream_index];
    // AVCodec* codec = avcodec_find_decoder(stream->codecpar->codec_id);
    
    // AVCodecContext *pCodecContext = avcodec_alloc_context3(codec);
    // avcodec_parameters_to_context(pCodecContext, stream->codecpar);
    // avcodec_open2(pCodecContext, codec, NULL);

    // av_seek_frame

    sprintf(metaDataJson+strlen(metaDataJson), "\"videoStreams\": [\n");
    // Loop through the video streams.
    const AVDictionaryEntry *tag = NULL;
    for (int i = 0; i < pFormatContext->nb_streams; i++) {
        AVStream* avStream = pFormatContext->streams[i];

        if( avStream->codecpar->codec_type!=AVMEDIA_TYPE_VIDEO ) {
            continue;
        }
        
        
        // Skip tracks that we don't have codecs for
        AVCodec* codec = avcodec_find_decoder(avStream->codecpar->codec_id);
        if(codec==NULL){
           // printf("Skipping track which a codec we don't support. avStream->codecpar->codec_id = %i\n", avStream->codecpar->codec_id);
         //  continue;
        }

        AVCodecContext *pCodecContext = avcodec_alloc_context3(codec);
        if (!pCodecContext)
        {
            printf("failed to allocated memory for AVCodecContext\n");
            continue;
        }

        // Get the codec string
        char codec_string[128];
        avcodec_string(codec_string, sizeof(codec_string), pCodecContext, 0);
        // printf("Codec string: %s,\n", codec_string);

        // printf("AVCodecContext->level: %i,\n", pCodecContext->level);
        // printf("AVCodecContext->profile: %i,\n", pCodecContext->profile);
        // printf("(AVCLevelIndication) avStream->codecpar->level: %i,\n", avStream->codecpar->level);
        

        int result_len;
        char codec_string2[128];
        // AVCodecContext *codec_ctx = get_codec_context();

        result_len = av_get_codec_tag_string(codec_string2, sizeof(codec_string2), avStream->codecpar->codec_tag);

        // printf("Codec string2: \"%s\" %i %u\n", codec_string2, result_len, avStream->codecpar->codec_tag);
        if (result_len > 0) {
            // Parse the codec string
            char *token;

            // AVCProfileIndication
            token = strtok(codec_string2, ".");
            if (token) {
                // Do something with AVCProfileIndication
               // printf("AVCProfileIndication: %s,\n", token);
            } else {
                // printf("token was null\n");
            }

            // profile_compatibility
            token = strtok(NULL, ".");
            if (token) {
                // Do something with profile_compatibility
                // printf("profile_compatibility: %s\n", token);
            }

            // AVCLevelIndication
            token = strtok(NULL, ".");
            if (token) {
                // Do something with AVCLevelIndication
                // printf("AVCLevelIndication: %s\n", token);
            }
        }

        // Only collect audio/video tracks
        if( (avStream->codecpar->codec_type == AVMEDIA_TYPE_VIDEO || avStream->codecpar->codec_type == AVMEDIA_TYPE_AUDIO) == false ){
            printf("Skipping track that isn't an audio/video one. avStream->codecpar->codec_type = %i\n",avStream->codecpar->codec_type);
            continue;
        }

        sprintf(metaDataJson+strlen(metaDataJson), "{\n");

        
        sprintf(metaDataJson+strlen(metaDataJson), "  \"streamIndex\": %i,\n", avStream->id-1);
        // sprintf(metaDataJson+strlen(metaDataJson), "Stream id: %i\n", i, avStream->id);
        // sprintf(metaDataJson+strlen(metaDataJson), "For loop: %i\n", i);
        // print("Streams for loop %d %i %u",pFormatContext->nb_streams,pFormatContext->nb_streams,pFormatContext->nb_streams);
        
        
        sprintf(metaDataJson+strlen(metaDataJson), "  \"codec\": \"%s\",\n",codec->name);
        // printf();
        // printf("\n");
        // print("Codec name: %s", avcodec_get_name(pFormatContext->streams[i]->codecpar->codec_id));
        if(codec->long_name==NULL){
            sprintf(metaDataJson+strlen(metaDataJson), "  \"codecLong\": \"undefined\",\n");
        } else {
            sprintf(metaDataJson+strlen(metaDataJson), "  \"codecLong\": \"%s\",\n",codec->long_name);
        }

        sprintf(metaDataJson+strlen(metaDataJson), "  \"duration\": %.3f,\n", (float)( 
            ((double)avStream->duration)/((double)avStream->time_base.den)
        ));
        sprintf(metaDataJson+strlen(metaDataJson), "  \"estimatedDuration\": %.3f,\n", (float)( 
            ((double)avStream->duration)/((double)avStream->time_base.den)
        ));

        // print("Codec Bit rate: %lu", casted);
        // printf(""); 
        sprintf(metaDataJson+strlen(metaDataJson), "  \"bitRate\": %" PRIi64 ",\n", avStream->codecpar->bit_rate);     

        // List of color spaces names
        // https://ffmpeg.org/doxygen/trunk/pixdesc_8c.html#ade35f5fa255d189d9c23fad1e442d97b
        const char* colorSpace = av_color_space_name(avStream->codecpar->color_space);
        sprintf(metaDataJson+strlen(metaDataJson), "  \"colorSpace\": \"%s\",\n", colorSpace!=NULL?colorSpace:"unknown");

        // List of color primaries names
        // https://ffmpeg.org/doxygen/trunk/pixdesc_8c.html#a5ae601a41761d1d14281c9899568d64f
        const char* colorPrimaries = av_color_primaries_name(avStream->codecpar->color_primaries);
        sprintf(metaDataJson+strlen(metaDataJson), "  \"colorPrimaries\": \"%s\",\n", colorPrimaries!=NULL?colorPrimaries:"unknown");

        // List of color transfers names
        // https://ffmpeg.org/doxygen/trunk/pixdesc_8c.html#a100bbe55171fc34ae728cd613e6daa28
        const char* colorTransfer = av_color_transfer_name(avStream->codecpar->color_trc);
        sprintf(metaDataJson+strlen(metaDataJson), "  \"colorTransfer\": \"%s\",\n", colorTransfer!=NULL?colorTransfer:"unknown");
        
        sprintf(metaDataJson+strlen(metaDataJson), "  \"size\": {\n");
            sprintf(metaDataJson+strlen(metaDataJson), "    \"width\": %i,\n", avStream->codecpar->width);
            sprintf(metaDataJson+strlen(metaDataJson), "    \"height\": %i\n", avStream->codecpar->height);
        sprintf(metaDataJson+strlen(metaDataJson), "  },\n");

        // Get the pixel format for the video
        enum AVPixelFormat pix_fmt = (enum AVPixelFormat)(avStream->codecpar->format);
        const char *pix_fmt_name = av_get_pix_fmt_name(pix_fmt);
        sprintf(metaDataJson+strlen(metaDataJson), "  \"pixelFormat\": \"%s\",\n", pix_fmt_name);

        // Get number of video frames
        sprintf(metaDataJson+strlen(metaDataJson), "  \"frameCount\": %" PRIi64 ",\n", avStream->nb_frames);

        sprintf(metaDataJson+strlen(metaDataJson), "  \"averageFrameRate\": {\n");
            sprintf(metaDataJson+strlen(metaDataJson), "    \"framerateNumerator\": %i,\n", avStream->avg_frame_rate.num);
            sprintf(metaDataJson+strlen(metaDataJson), "    \"framerateDenominator\": %i\n", avStream->avg_frame_rate.den);
        sprintf(metaDataJson+strlen(metaDataJson), "  },\n");
    
        AVRational rational = av_guess_frame_rate(pFormatContext, avStream, NULL);
            //av_stream_get_r_frame_rate(avStream);
        sprintf(metaDataJson+strlen(metaDataJson), "  \"maximumFrameRate\": {\n");
            sprintf(metaDataJson+strlen(metaDataJson), "    \"framerateNumerator\": %i,\n", rational.num);
            sprintf(metaDataJson+strlen(metaDataJson), "    \"framerateDenominator\": %i\n", rational.den);
        sprintf(metaDataJson+strlen(metaDataJson), "  },\n");

        sprintf(metaDataJson+strlen(metaDataJson), "\"fieldOrder\": \"unknown\"\n");
        

        sprintf(metaDataJson+strlen(metaDataJson), "}\n");
    }
    sprintf(metaDataJson+strlen(metaDataJson), "],\n"); // End video stream loop

    sprintf(metaDataJson+strlen(metaDataJson), "\"audioStreams\": [\n");
    // Loop through the audio streams.
    for (int i = 0; i < pFormatContext->nb_streams; i++) {
        AVStream* avStream = pFormatContext->streams[i];

        if( avStream->codecpar->codec_type!=AVMEDIA_TYPE_AUDIO ) {
            continue;
        }
        
        
        // Skip tracks that we don't have codecs for
        AVCodec* codec = avcodec_find_decoder(avStream->codecpar->codec_id);
        if(codec==NULL){
            printf("Skipping track which a codec we don't support. avStream->codecpar->codec_id = %i\n", avStream->codecpar->codec_id);
            continue;
        }

        AVCodecContext *pCodecContext = avcodec_alloc_context3(codec);
        if (!pCodecContext)
        {
            printf("failed to allocated memory for AVCodecContext\n");
            continue;
        }

        // Get the codec string
        char codec_string[128];
        avcodec_string(codec_string, sizeof(codec_string), pCodecContext, 0);
        // printf("Codec string: %s,\n", codec_string);

        // printf("AVCodecContext->level: %i,\n", pCodecContext->level);
        // printf("AVCodecContext->profile: %i,\n", pCodecContext->profile);
        // printf("(AVCLevelIndication) avStream->codecpar->level: %i,\n", avStream->codecpar->level);
        

        int result_len;
        char codec_string2[128];
        // AVCodecContext *codec_ctx = get_codec_context();

        result_len = av_get_codec_tag_string(codec_string2, sizeof(codec_string2), avStream->codecpar->codec_tag);

        // printf("Codec string2: \"%s\" %i %u\n", codec_string2, result_len, avStream->codecpar->codec_tag);
        if (result_len > 0) {
            // Parse the codec string
            char *token;

            // AVCProfileIndication
            token = strtok(codec_string2, ".");
            if (token) {
                // Do something with AVCProfileIndication
               // printf("AVCProfileIndication: %s,\n", token);
            } else {
                // printf("token was null\n");
            }

            // profile_compatibility
            token = strtok(NULL, ".");
            if (token) {
                // Do something with profile_compatibility
                // printf("profile_compatibility: %s\n", token);
            }

            // AVCLevelIndication
            token = strtok(NULL, ".");
            if (token) {
                // Do something with AVCLevelIndication
                // printf("AVCLevelIndication: %s\n", token);
            }
        }

        // Only collect audio/video tracks
        if( (avStream->codecpar->codec_type == AVMEDIA_TYPE_VIDEO || avStream->codecpar->codec_type == AVMEDIA_TYPE_AUDIO) == false ){
            printf("Skipping track that isn't an audio/video one. avStream->codecpar->codec_type = %i\n",avStream->codecpar->codec_type);
            continue;
        }

        sprintf(metaDataJson+strlen(metaDataJson), "{\n");

        
        sprintf(metaDataJson+strlen(metaDataJson), "  \"streamIndex\": %i,\n", avStream->id-1);
        // sprintf(metaDataJson+strlen(metaDataJson), "Stream id: %i\n", i, avStream->id);
        // sprintf(metaDataJson+strlen(metaDataJson), "For loop: %i\n", i);
        // print("Streams for loop %d %i %u",pFormatContext->nb_streams,pFormatContext->nb_streams,pFormatContext->nb_streams);
        
        
        sprintf(metaDataJson+strlen(metaDataJson), "  \"codec\": \"%s\",\n",codec->name);
        // printf();
        // printf("\n");
        // print("Codec name: %s", avcodec_get_name(pFormatContext->streams[i]->codecpar->codec_id));
        if(codec->long_name==NULL){
            sprintf(metaDataJson+strlen(metaDataJson), "  \"codecLong\": \"undefined\",\n");
        } else {
            sprintf(metaDataJson+strlen(metaDataJson), "  \"codecLong\": \"%s\",\n",codec->long_name);
        }

        sprintf(metaDataJson+strlen(metaDataJson), "  \"duration\": %.3f,\n", (float)( 
            ((double)avStream->duration)/((double)avStream->time_base.den)
        ));
        sprintf(metaDataJson+strlen(metaDataJson), "  \"estimatedDuration\": %.3f,\n", (float)( 
            ((double)avStream->duration)/((double)avStream->time_base.den)
        ));

        // print("Codec Bit rate: %lu", casted);
        // printf(""); 
        sprintf(metaDataJson+strlen(metaDataJson), "  \"bitRate\": %" PRIi64 ",\n", avStream->codecpar->bit_rate);     

        
        
        sprintf(metaDataJson+strlen(metaDataJson), "  \"bitDepth\": %i,\n", avStream->codecpar->bits_per_coded_sample);
        sprintf(metaDataJson+strlen(metaDataJson), "  \"channelCount\": %i,\n", avStream->codecpar->channels);
        sprintf(metaDataJson+strlen(metaDataJson), "  \"sampleRate\": %i\n", avStream->codecpar->sample_rate);
        

        sprintf(metaDataJson+strlen(metaDataJson), "}\n");
    }
    sprintf(metaDataJson+strlen(metaDataJson), "]\n"); // End audio stream loop



    sprintf(metaDataJson+strlen(metaDataJson), "}\n");

    // print("----AVFormat_get_meta_data--------------------------");
   

    return metaDataJson;
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
