/*
 * Copyright (C) 2021-2025 Yahweasel and contributors
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

declare namespace LibAV {
    /**
     * Things in libav.js with Worker transfer characteristics.
     */
    export interface LibAVTransferable {
        /**
         * The elements to pass as transfers when passing this object to/from
         * workers.
         */
        libavjsTransfer?: Transferable[];
    }

    /**
     * Frames, as taken/given by libav.js.
     */
    export interface Frame extends LibAVTransferable {
        /**
         * The actual frame data. For non-planar audio data, this is a typed array.
         * For planar audio data, this is an array of typed arrays, one per plane.
         * For video data, this is a single Uint8Array, and its layout is described
         * by the layout field.
         */
        data: any;

        /**
         * Sample format or pixel format.
         */
        format: number;

        /**
         * Video only. Layout of each plane within the data array. `offset` is the
         * base offset of the plane, and `stride` is what libav calls `linesize`.
         * This layout format is from WebCodecs.
         */
        layout?: {offset: number, stride: number}[];

        /**
         * Presentation timestamp for this frame. Units depends on surrounding
         * context. Will always be set by libav.js, but libav.js will accept frames
         * from outside that do not have this set.
         */
        pts?: number, ptshi?: number;
        
        /**
         * Presentation timestamp estimated using various heuristics, in stream time base.
         */
        best_effort_timestamp?: number, best_effort_timestamphi?: number;

        /**
         * Base for timestamps of this frame.
         */
        time_base_num?: number, time_base_den?: number;

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
         * Video only. Cropping rectangle of the frame.
         */
        crop?: {top: number, bottom: number, left: number, right: number};

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
    export interface Packet extends LibAVTransferable {
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
         * Base for timestamps of this packet.
         */
        time_base_num?: number, time_base_den?: number;

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
     * Codec parameters, if copied out.
     */
    export interface CodecParameters {
        /**
         * General type of the encoded data.
         */
        codec_type: number;

        /**
         * Specific type of the encoded data (the codec used).
         */
        codec_id: number;

        /**
         * Additional information about the codec (corresponds to the AVI FOURCC).
         */
        codec_tag?: number;

        /**
         * Extra binary data needed for initializing the decoder, codec-dependent.
         *
         * Must be allocated with av_malloc() and will be freed by
         * avcodec_parameters_free(). The allocated size of extradata must be at
         * least extradata_size + AV_INPUT_BUFFER_PADDING_SIZE, with the padding
         * bytes zeroed.
         */
        extradata?: Uint8Array;

        /**
         * - video: the pixel format, the value corresponds to enum AVPixelFormat.
         * - audio: the sample format, the value corresponds to enum AVSampleFormat.
         */
        format: number;

        /**
         * Bitrate. Not always set.
         */
        bit_rate?: number;
        bit_ratehi?: number;

        /**
         * Codec-specific bitstream restrictions that the stream conforms to.
         */
        profile?: number;
        level?: number;

        /**
         * Video only. The dimensions of the video frame in pixels.
         */
        width?: number;
        height?: number;

        /**
         * Video only. Additional colorspace characteristics.
         */
        color_range?: number;
        color_primaries?: number;
        color_trc?: number;
        color_space?: number;
        chroma_location?: number;

        /**
         * Audio only. The number of audio samples per second.
         */
        sample_rate?: number;

        /**
         * Audio only. The channel layout and number of channels.
         */
        channel_layoutmask?: number;
        channels?: number;

        /**
         * Side data. Codec-specific.
         */
        coded_side_data?: any;
    }

    /**
     * Settings used to set up a filter.
     */
    export interface FilterIOSettings {
        /**
         * Type of filterchain, as an AVMEDIA_TYPE_*. If unset, defaults to
         * AVMEDIA_TYPE_AUDIO.
         */
        type?: number;

        /**
         * The timebase for this filterchain. If unset, [1, frame_rate] or [1,
         * sample_rate] will be used.
         */
        time_base?: [number, number];

        /**
         * Video only. Framerate of the input.
         */
        frame_rate?: number;

        /**
         * Audio only. Sample rate of the input.
         */
        sample_rate?: number;

        /**
         * Video only. Pixel format of the input.
         */
        pix_fmt?: number;

        /**
         * Audio only. Sample format of the input.
         */
        sample_fmt?: number;

        /**
         * Video only. Width of the input.
         */
        width?: number;

        /**
         * Video only. Height of the input.
         */
        height?: number;

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

    /**
     * Static properties that are accessible both on the LibAV wrapper and on each
     * libav instance.
     */
    export interface LibAVStatic {
        /**
         * Convert a pair of 32-bit integers representing a single 64-bit integer
         * into a 64-bit float. 64-bit floats are only sufficient for 53 bits of
         * precision, so for very large values, this is lossy.
         * @param lo  Low bits of the pair
         * @param hi  High bits of the pair
         */
        i64tof64(lo: number, hi: number): number;

        /**
         * Convert a 64-bit floating-point number into a pair of 32-bit integers
         * representing a single 64-bit integer. The 64-bit float must actually
         * contain an integer value for this result to be accurate.
         * @param val  Floating-point value to convert
         * @returns [low bits, high bits]
         */
        f64toi64(val: number): [number, number];

        /**
         * Convert a pair of 32-bit integers representing a single 64-bit integer
         * into a BigInt. Requires BigInt support, of course.
         * @param lo  Low bits of the pair
         * @param hi  High bits of the pair
         */
        i64ToBigInt(lo: number, hi: number): BigInt;

        /**
         * Convert a (64-bit) BigInt into a pair of 32-bit integers. Requires BigInt
         * support, of course.
         * @param val  BigInt value to convert
         * @returns [low bits, high bits]
         */
        bigIntToi64(val: BigInt): [number, number];

        /**
         * Extract the channel layout from a frame (or any other source of
         * channel layout). Unifies the various ways that channel layouts may
         * be stored.
         */
        ff_channel_layout(frame: {
            channel_layout?: number,
            channels?: number
        }): number;

        /**
         * Extract the channel count from a frame (or any other source of
         * channel layout). Unifies the various ways that channel layouts may be
         * stored.
         */
        ff_channels(frame: {
            channel_layout?: number,
            channels?: number
        }): number;

        /**
         * Convert a major, minor, and revision number to the internal integer
         * version representation used in libav. Note that these version numbers
         * are *not* FFmpeg versions. They are the internal libav versions, one
         * for each libav library.
         */
        AV_VERSION_INT(maj: number, min: number, rev: number): number;

        // Constants:
        AV_NOPTS_VALUE_I64: [number, number];
        AV_NOPTS_VALUE_LO: number;
        AV_NOPTS_VALUE_HI: number;
        AV_NOPTS_VALUE: number;
        AV_TIME_BASE: number;
        AV_OPT_SEARCH_CHILDREN: number;

        // Enumerations:
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
        AV_LOG_QUIET: number;
        AV_LOG_PANIC: number;
        AV_LOG_FATAL: number;
        AV_LOG_ERROR: number;
        AV_LOG_WARNING: number;
        AV_LOG_INFO: number;
        AV_LOG_VERBOSE: number;
        AV_LOG_DEBUG: number;
        AV_LOG_TRACE: number;
        AV_PKT_FLAG_KEY: number;
        AV_PKT_FLAG_CORRUPT: number;
        AV_PKT_FLAG_DISCARD: number;
        AV_PKT_FLAG_TRUSTED: number;
        AV_PKT_FLAG_DISPOSABLE: number;
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
        EDESTADDRREQ: number;
        EDOM: number;
        EDQUOT: number;
        EEXIST: number;
        EFAULT: number;
        EFBIG: number;
        EHOSTUNREACH: number;
        EIDRM: number;
        EILSEQ: number;
        EINPROGRESS: number;
        EINTR: number;
        EINVAL: number;
        EIO: number;
        EISCONN: number;
        EISDIR: number;
        ELOOP: number;
        EMFILE: number;
        EMLINK: number;
        EMSGSIZE: number;
        EMULTIHOP: number;
        ENAMETOOLONG: number;
        ENETDOWN: number;
        ENETRESET: number;
        ENETUNREACH: number;
        ENFILE: number;
        ENOBUFS: number;
        ENODEV: number;
        ENOENT: number;
        AVERROR_EOF: number;
    }

    /**
     * A LibAV instance, created by LibAV.LibAV (*not* the LibAV wrapper itself)
     */
    export interface LibAV extends LibAVStatic {
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
         * Seek to the keyframe at timestamp 'timestamp' in 'stream_index'.
         */
        av_seek_frame(
            s: number, stream_index: number,
            timestamplo: number, timestamphi: number,
            flags: number
        ): Promise<number>;

        /**
         * Get the depth of this component of this pixel format.
         */
        AVPixFmtDescriptor_comp_depth(fmt: number, comp: number): Promise<number>;


        /**
         * Callback when writes occur. Set by the user.
         */
        onwrite?: (filename: string, position: number, buffer: Uint8Array | Int8Array) => void;

        /**
         * Callback for stream reader devices. Set by the user.
         */
        onread?: (filename: string, pos: number, length: number) => void;

        /**
         * Callback for block reader devices. Set by the user.
         */
        onblockread?: (filename: string, pos: number, length: number) => void;

        /**
         * Terminate the worker associated with this libav.js instance, rendering
         * it inoperable and freeing its memory.
         */
        terminate(): void;
    }

    /**
     * Synchronous functions, available on non-worker libav.js instances.
     */
    export interface LibAVSync {
@SYNCFUNCS
    }

    /**
     * Options to create a libav.js instance.
     */
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
         * Use threads. If threads ever become reliable, this flag will disappear,
         * and you will need to use nothreads.
         */
        yesthreads?: boolean;

        /**
         * Don't use threads. The default.
         */
        nothreads?: boolean;

        /**
         * Don't use ES6 modules for loading, even if libav.js was compiled as an
         * ES6 module.
         */
        noes6?: boolean;

        /**
         * URL base from which to load workers and modules.
         */
        base?: string;

        /**
         * URL from which to load the module factory.
         */
        toImport?: string;

        /**
         * The module factory to use itself.
         */
        factory?: any;

        /**
         * The variant to load (instead of whichever variant was compiled)
         */
        variant?: string;

        /**
         * The full URL from which to load the .wasm file.
         */
        wasmurl?: string;
    }

    /**
     * The main wrapper for libav.js, typically named "LibAV".
     */
    export interface LibAVWrapper extends LibAVOpts, LibAVStatic {
        /**
         * Create a LibAV instance.
         * @param opts  Options
         */
        LibAV(opts?: LibAVOpts & {noworker?: false}): Promise<LibAV>;
        LibAV(opts: LibAVOpts & {noworker: true}): Promise<LibAV & LibAVSync>;
        LibAV(opts: LibAVOpts): Promise<LibAV | LibAV & LibAVSync>;
    }
}

/**
 * The actual export is the namespace (for types) and a wrapper (for data).
 */
declare const LibAV: LibAV.LibAVWrapper;
export = LibAV;
