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

#if LIBAVJS_FULL_AVCODEC
/* AVCodec */
#define B(type, field) A(AVCodec, type, field)
#define BA(type, field) AA(AVCodec, type, field)
B(const char *, name)
B(const char *, long_name)
B(const enum AVSampleFormat *, sample_fmts)
BA(enum AVSampleFormat, sample_fmts)
B(const int *, supported_samplerates)
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
B(AVPacketSideData *, coded_side_data)
B(int, compression_level)
B(uint8_t *, extradata)
B(int, extradata_size)
B(int, frame_size)
B(int, gop_size)
B(int, height)
B(int, keyint_min)
B(int, level)
B(int, max_b_frames)
B(int, nb_coded_side_data)
B(int, pix_fmt)
B(int, profile)
BL(int64_t, rc_max_rate)
BL(int64_t, rc_min_rate)
B(int, sample_fmt)
B(int, sample_rate)
B(int, strict_std_compliance)
B(int, qmax)
B(int, qmin)
B(int, width)
#undef B
#undef BL

RAT(AVCodecContext, framerate)
RAT(AVCodecContext, sample_aspect_ratio)
RAT(AVCodecContext, time_base)
RAT(AVCodecContext, pkt_timebase)
CHL(AVCodecContext)

#endif


/* AVCodecDescriptor */
#define B(type, field) A(AVCodecDescriptor, type, field)
B(enum AVCodecID, id)
B(const char *, long_name)
AA(AVCodecDescriptor, const char *, mime_types)
B(const char *, name)
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

#if LIBAVCODEC_VERSION_INT >= AV_VERSION_INT(60, 30, 100)
B(AVPacketSideData *, coded_side_data)
B(int, nb_coded_side_data)
#else
AVPacketSideData *AVCodecParameters_coded_side_data(AVCodecParameters *a) { return NULL; }
void AVCodecParameters_coded_side_data_s(AVCodecParameters *a, AVPacketSideData *b) {}
int AVCodecParameters_nb_coded_side_data(AVCodecParameters *a) { return 0; }
void AVCodecParameters_nb_coded_side_data_s(AVCodecParameters *a, AVPacketSideData *b) {}
#endif
#undef B

#if LIBAVCODEC_VERSION_INT > AV_VERSION_INT(60, 10, 100)
RAT(AVCodecParameters, framerate)
#else
RAT_FAKE(AVCodecParameters, framerate, 60, 1)
#endif

CHL(AVCodecParameters)

uint8_t *ff_codecpar_new_side_data(
    AVCodecParameters *codecpar, enum AVPacketSideDataType type, size_t size
) {
#if LIBAVCODEC_VERSION_INT >= AV_VERSION_INT(60, 30, 100)
    AVPacketSideData *sd = av_packet_side_data_new(
        &codecpar->coded_side_data, &codecpar->nb_coded_side_data, type, size,
        0
    );
    return sd ? sd->data : NULL;
#else
    return NULL;
#endif
}


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

#if LIBAVCODEC_VERSION_INT > AV_VERSION_INT(59, 4, 100)
RAT(AVPacket, time_base)
#else
RAT_FAKE(AVPacket, time_base, 1, 1000)
#endif


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

#if LIBAVJS_FULL_AVCODEC
int avcodec_open2_js(
    AVCodecContext *avctx, const AVCodec *codec, AVDictionary *options
) {
    return avcodec_open2(avctx, codec, &options);
}
#endif

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

static const int LIBAVCODEC_VERSION_INT_V = LIBAVCODEC_VERSION_INT;
#undef LIBAVCODEC_VERSION_INT
int LIBAVCODEC_VERSION_INT() { return LIBAVCODEC_VERSION_INT_V; }
