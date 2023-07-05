/*
 * Copyright (C) 2021-2023 Yahweasel and contributors
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

/**
 * Frames, as taken/given by libav.js.
 */
export interface Frame {
    /**
     * The actual frame data. For non-planar audio data, this is a typed array.
     * For planar audio data, this is an array of typed arrays, one per plane.
     * For video data, this is an array of planes, where each plane is in turn
     * an array of typed arrays, one per line (because of how libav buffers
     * lines).
     */
    data: any[];

    /**
     * Sample format or pixel format.
     */
    format: number;

    /**
     * Presentation timestamp for this frame. Units depends on surrounding
     * context. Will always be set by libav.js, but libav.js will accept frames
     * from outside that do not have this set.
     */
    pts?: number, ptshi?: number;

    /**
     * Audio only. Channel layout. It is possible for only one of this and
     * channels to be set.
     */
    channel_layout?: number;

    /**
     * Audio only. Number of channels. It is possible for only one of this and
     * channel_layout to be set.
     */
    channels?: number;

    /**
     * Audio only. Number of samples in the frame.
     */
    nb_samples?: number;

    /**
     * Audio only. Sample rate.
     */
    sample_rate?: number;

    /**
     * Video only. Width of frame.
     */
    width?: number;

    /**
     * Video only. Height of frame.
     */
    height?: number;

    /**
     * Video only. Sample aspect ratio (pixel aspect ratio), as a numerator and
     * denominator. 0 is interpreted as 1 (square pixels).
     */
    sample_aspect_ratio?: [number, number];

    /**
     * Is this a keyframe? (1=yes, 0=maybe)
     */
    key_frame?: number;

    /**
     * Picture type (libav-specific value)
     */
    pict_type?: number;
}

/**
 * Packets, as taken/given by libav.js.
 */
export interface Packet {
    /**
     * The actual data represented by this packet.
     */
    data: Uint8Array;

    /**
     * Presentation timestamp.
     */
    pts?: number, ptshi?: number;

    /**
     * Decoding timestamp.
     */
    dts?: number, dtshi?: number;

    /**
     * Index of this stream within a surrounding muxer/demuxer.
     */
    stream_index?: number;

    /**
     * Packet flags, as defined by ffmpeg.
     */
    flags?: number;

    /**
     * Duration of this packet. Rarely used.
     */
    duration?: number, durationhi?: number;

    /**
     * Side data. Codec-specific.
     */
    side_data?: any;
}

/**
 * Stream information, as returned by ff_init_demuxer_file.
 */
export interface Stream {
    /**
     * Pointer to the underlying AVStream.
     */
    ptr: number;

    /**
     * Index of this stream.
     */
    index: number;

    /**
     * Codec parameters.
     */
    codecpar: number;

    /**
     * Type of codec (audio or video, typically)
     */
    codec_type: number;

    /**
     * Codec identifier.
     */
    codec_id: number;

    /**
     * Base for timestamps of packets in this stream.
     */
    time_base_num: number, time_base_den: number;

    /**
     * Duration of this stream in time_base units.
     */
    duration_time_base: number;

    /**
     * Duration of this stream in seconds.
     */
    duration: number;
}

/**
 * Settings used to set up a filter.
 */
export interface FilterIOSettings {
    /**
     * Audio only. Sample rate of the input.
     */
    sample_rate?: number;

    /**
     * Audio only. Sample format of the input.
     */
    sample_fmt?: number;

    /**
     * Audio only. Channel layout of the input. Note that there is no
     * "channels"; you must describe a layout.
     */
    channel_layout?: number;

    /**
     * Audio only, output only, optional. Size of an audio frame.
     */
    frame_size?: number;
}

/**
 * Supported properties of an AVCodecContext, used by ff_init_encoder.
 */
export interface AVCodecContextProps {
    bit_rate?: number;
    bit_ratehi?: number;
    channel_layout?: number;
    channel_layouthi?: number;
    channels?: number;
    frame_size?: number;
    framerate_num?: number;
    framerate_den?: number;
    gop_size?: number;
    height?: number;
    keyint_min?: number;
    level?: number;
    pix_fmt?: number;
    profile?: number;
    rc_max_rate?: number;
    rc_max_ratehi?: number;
    rc_min_rate?: number;
    rc_min_ratehi?: number;
    sample_aspect_ratio_num?: number;
    sample_aspect_ratio_den?: number;
    sample_fmt?: number;
    sample_rate?: number;
    qmax?: number;
    qmin?: number;
    width?: number;
}

export interface LibAV {
    /**
     * The operating mode of this libav.js instance. Each operating mode has
     * different constraints.
     */
    libavjsMode: "direct" | "worker" | "threads";

    /**
     * If the operating mode is "worker", the worker itself.
     */
    worker?: Worker;

@FUNCS
@DECLS

    // Declarations for things that use int64, so will be communicated incorrectly

    /**
     * Seek to timestamp ts, bounded by min_ts and max_ts. All 64-bit ints are
     * in the form of low and high bits.
     */
    avformat_seek_file(
        s: number, stream_index: number, min_tslo: number, min_tshi: number,
        tslo: number, tshi: number, max_tslo: number, max_tshi: number,
        flags: number
    ): Promise<number>;

    /**
     * Seek to *at the earliest* the given timestamp.
     */
    avformat_seek_file_min(
        s: number, stream_index: number, tslo: number, tshi: number,
        flags: number
    ): Promise<number>;

    /**
     * Seek to *at the latest* the given timestamp.
     */
    avformat_seek_file_max(
        s: number, stream_index: number, tslo: number, tshi: number,
        flags: number
    ): Promise<number>;

    /**
     * Seek to as close to this timestamp as the format allows.
     */
    avformat_seek_file_approx(
        s: number, stream_index: number, tslo: number, tshi: number,
        flags: number
    ): Promise<number>;


    /**
     * Callback when writes occur. Set by the user.
     */
    onwrite?: (filename: string, position: number, buffer: Uint8Array | Int8Array) => void;

    /**
     * Callback for bock reader devices. Set by the user.
     */
    onblockread?: (filename: string, pos: number, length: number)  => void;

    /**
     * Terminate the worker associated with this libav.js instance, rendering
     * it inoperable and freeing its memory.
     */
    terminate(): void;

    // Enumerations:
    AV_OPT_SEARCH_CHILDREN: number;
    AVMEDIA_TYPE_UNKNOWN: number;
    AVMEDIA_TYPE_VIDEO: number;
    AVMEDIA_TYPE_AUDIO: number;
    AVMEDIA_TYPE_DATA: number;
    AVMEDIA_TYPE_SUBTITLE: number;
    AVMEDIA_TYPE_ATTACHMENT: number;
    AV_SAMPLE_FMT_NONE: number;
    AV_SAMPLE_FMT_U8: number;
    AV_SAMPLE_FMT_S16: number;
    AV_SAMPLE_FMT_S32: number;
    AV_SAMPLE_FMT_FLT: number;
    AV_SAMPLE_FMT_DBL: number;
    AV_SAMPLE_FMT_U8P: number;
    AV_SAMPLE_FMT_S16P: number;
    AV_SAMPLE_FMT_S32P: number;
    AV_SAMPLE_FMT_FLTP: number;
    AV_SAMPLE_FMT_DBLP: number;
    AV_SAMPLE_FMT_S64: number;
    AV_SAMPLE_FMT_S64P: number;
    AV_SAMPLE_FMT_NB: number;
    AV_PIX_FMT_NONE: number;
    AV_PIX_FMT_YUV420P: number;
    AV_PIX_FMT_YUYV422: number;
    AV_PIX_FMT_RGB24: number;
    AV_PIX_FMT_BGR24: number;
    AV_PIX_FMT_YUV422P: number;
    AV_PIX_FMT_YUV444P: number;
    AV_PIX_FMT_YUV410P: number;
    AV_PIX_FMT_YUV411P: number;
    AV_PIX_FMT_GRAY8: number;
    AV_PIX_FMT_MONOWHITE: number;
    AV_PIX_FMT_MONOBLACK: number;
    AV_PIX_FMT_PAL8: number;
    AV_PIX_FMT_YUVJ420P: number;
    AV_PIX_FMT_YUVJ422P: number;
    AV_PIX_FMT_YUVJ444P: number;
    AV_PIX_FMT_UYVY422: number;
    AV_PIX_FMT_UYYVYY411: number;
    AV_PIX_FMT_BGR8: number;
    AV_PIX_FMT_BGR4: number;
    AV_PIX_FMT_BGR4_BYTE: number;
    AV_PIX_FMT_RGB8: number;
    AV_PIX_FMT_RGB4: number;
    AV_PIX_FMT_RGB4_BYTE: number;
    AV_PIX_FMT_NV12: number;
    AV_PIX_FMT_NV21: number;
    AV_PIX_FMT_ARGB: number;
    AV_PIX_FMT_RGBA: number;
    AV_PIX_FMT_ABGR: number;
    AV_PIX_FMT_BGRA: number;
    AV_PIX_FMT_GRAY16BE: number;
    AV_PIX_FMT_GRAY16LE: number;
    AV_PIX_FMT_YUV440P: number;
    AV_PIX_FMT_YUVJ440P: number;
    AV_PIX_FMT_YUVA420P: number;
    AV_PIX_FMT_RGB48BE: number;
    AV_PIX_FMT_RGB48LE: number;
    AV_PIX_FMT_RGB565BE: number;
    AV_PIX_FMT_RGB565LE: number;
    AV_PIX_FMT_RGB555BE: number;
    AV_PIX_FMT_RGB555LE: number;
    AV_PIX_FMT_BGR565BE: number;
    AV_PIX_FMT_BGR565LE: number;
    AV_PIX_FMT_BGR555BE: number;
    AV_PIX_FMT_BGR555LE: number;
    AVIO_FLAG_READ: number;
    AVIO_FLAG_WRITE: number;
    AVIO_FLAG_READ_WRITE: number;
    AVIO_FLAG_NONBLOCK: number;
    AVIO_FLAG_DIRECT: number;
    AVSEEK_FLAG_BACKWARD: number;
    AVSEEK_FLAG_BYTE: number;
    AVSEEK_FLAG_ANY: number;
    AVSEEK_FLAG_FRAME: number;
    AVDISCARD_NONE: number;
    AVDISCARD_DEFAULT: number;
    AVDISCARD_NONREF: number;
    AVDISCARD_BIDIR: number;
    AVDISCARD_NONINTRA: number;
    AVDISCARD_NONKEY: number;
    AVDISCARD_ALL: number;
    E2BIG: number;
    EPERM: number;
    EADDRINUSE: number;
    EADDRNOTAVAIL: number;
    EAFNOSUPPORT: number;
    EAGAIN: number;
    EALREADY: number;
    EBADF: number;
    EBADMSG: number;
    EBUSY: number;
    ECANCELED: number;
    ECHILD: number;
    ECONNABORTED: number;
    ECONNREFUSED: number;
    ECONNRESET: number;
    EDEADLOCK: number;
    AVERROR_EOF: number;
}

export interface LibAVSync {
@SYNCFUNCS
@SYNCDECLS
}

export interface LibAVOpts {
    /**
     * Don't create a worker.
     */
    noworker?: boolean;

    /**
     * Don't use WebAssembly.
     */
    nowasm?: boolean;

    /**
     * Don't use WebAssembly SIMD.
     */
    nosimd?: boolean;

    /**
     * Use threads. If threads ever become reliable, this flag will disappear,
     * and you will need to use nothreads.
     */
    yesthreads?: boolean;

    /**
     * Don't use threads. The default.
     */
    nothreads?: boolean;

    /**
     * URL base from which to load workers and modules.
     */
    base?: string;
}

export interface LibAVWrapper {
    /**
     * URL base from which load workers and modules.
     */
    base: string;

    /**
     * Create a LibAV instance.
     * @param opts  Options
     */
    LibAV(opts?: LibAVOpts & {noworker?: false}): Promise<LibAV>;
    LibAV(opts: LibAVOpts & {noworker: true}): Promise<LibAV & LibAVSync>;
}
