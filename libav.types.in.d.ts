/*
 * Copyright (C) 2021 Yahweasel
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
    channel_layout: number;

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
    bit_rate: number,
    bit_ratehi: number,
    channel_layout: number,
    channel_layouthi: number,
    channels: number,
    frame_size: number,
    framerate_num: number,
    framerate_den: number,
    gop_size: number,
    height: number,
    keyint_min: number,
    pix_fmt: number,
    rc_max_rate: number,
    rc_max_ratehi: number,
    rc_min_rate: number,
    rc_min_ratehi: number,
    sample_fmt: number,
    sample_rate: number,
    qmax: number,
    qmin: number,
    width: number
}

export interface LibAV {
@FUNCS
@DECLS

    /**
     * Terminate the worker associated with this libav.js instance, rendering
     * it inoperable and freeing its memory.
     */
    terminate(): void;
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
    LibAV(opts?: {
        noworker?: boolean,
        nowasm?: boolean
    }): Promise<LibAV>;
}
