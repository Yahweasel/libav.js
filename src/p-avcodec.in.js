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

/**
 * Metafunction to initialize an encoder with all the bells and whistles.
 * Returns [AVCodec, AVCodecContext, AVFrame, AVPacket, frame_size]
 * @param name  libav name of the codec
 * @param opts  Encoder options
 */
/* @types
 * ff_init_encoder@sync(
 *     name: string, opts?: {
 *         ctx?: AVCodecContextProps,
 *         time_base?: [number, number],
 *         options?: Record<string, string>
 *     }
 * ): @promise@[number, number, number, number, number]@
 */
var ff_init_encoder = Module.ff_init_encoder = function(name, opts) {
    opts = opts || {};

    var codec = avcodec_find_encoder_by_name(name);
    if (codec === 0)
        throw new Error("Codec not found");

    var c = avcodec_alloc_context3(codec);
    if (c === 0)
        throw new Error("Could not allocate audio codec context");

    var ctxProps = opts.ctx || {};
    for (var prop in ctxProps)
        this["AVCodecContext_" + prop + "_s"](c, ctxProps[prop]);

    var time_base = opts.time_base || [1, 1000];
    AVCodecContext_time_base_s(c, time_base[0], time_base[1]);

    var options = 0;
    if (opts.options) {
        for (var prop in opts.options)
            options = av_dict_set_js(options, prop, opts.options[prop], 0);
    }

    var ret = avcodec_open2_js(c, codec, options);
    if (ret < 0)
        throw new Error("Could not open codec: " + ff_error(ret));

    var frame = av_frame_alloc();
    if (frame === 0)
        throw new Error("Could not allocate frame");
    var pkt = av_packet_alloc();
    if (pkt === 0)
        throw new Error("Could not allocate packet");

    var frame_size = AVCodecContext_frame_size(c);

    return [codec, c, frame, pkt, frame_size];
};

/**
 * Metafunction to initialize a decoder with all the bells and whistles.
 * Similar to ff_init_encoder but doesn't need to initialize the frame.
 * Returns [AVCodec, AVCodecContext, AVPacket, AVFrame]
 * @param name  libav decoder identifier or name
 * @param config  Decoder configuration. Can just be a number for codec
 *                parameters, or can be multiple configuration options.
 */
/* @types
 * ff_init_decoder@sync(
 *     name: string | number, config?: number | {
 *         codecpar?: number | CodecParameters,
 *         time_base?: [number, number]
 *     }
 * ): @promise@[number, number, number, number]@
 */
var ff_init_decoder = Module.ff_init_decoder = function(name, config) {
    if (typeof config === "number") {
        config = {codecpar: config};
    } else {
        config = config || {};
    }

    var codec, ret;
    if (typeof name === "string")
        codec = avcodec_find_decoder_by_name(name);
    else
        codec = avcodec_find_decoder(name);
    if (codec === 0)
        throw new Error("Codec not found");

    var c = avcodec_alloc_context3(codec);
    if (c === 0)
        throw new Error("Could not allocate audio codec context");

    var codecid = AVCodecContext_codec_id(c);

    if (config.codecpar) {
        var codecparPtr = 0;
        var codecpar = config.codecpar;
        if (typeof codecpar === "object") {
            codecparPtr = avcodec_parameters_alloc();
            if (codecparPtr === 0)
                throw new Error("Failed to allocate codec parameters");
            ff_copyin_codecpar(codecparPtr, codecpar);
            codecpar = codecparPtr;
        }
        ret = avcodec_parameters_to_context(c, codecpar);
        if (codecparPtr)
            avcodec_parameters_free_js(codecparPtr);
        if (ret < 0)
            throw new Error("Could not set codec parameters: " + ff_error(ret));
    }

    // If it is not set, use the copy.
    if (AVCodecContext_codec_id(c) === 0) AVCodecContext_codec_id_s(c, codecid);

    // Keep the time base
    if (config.time_base)
        AVCodecContext_time_base_s(c, config.time_base[0], config.time_base[1]);

    ret = avcodec_open2(c, codec, 0);
    if (ret < 0)
        throw new Error("Could not open codec: " + ff_error(ret));

    var pkt = av_packet_alloc();
    if (pkt === 0)
        throw new Error("Could not allocate packet");

    var frame = av_frame_alloc();
    if (frame === 0)
        throw new Error("Could not allocate frame");

    return [codec, c, pkt, frame];
};

/**
 * Free everything allocated by ff_init_encoder.
 * @param c  AVCodecContext
 * @param frame  AVFrame
 * @param pkt  AVPacket
 */
/* @types
 * ff_free_encoder@sync(
 *     c: number, frame: number, pkt: number
 * ): @promise@void@
 */
var ff_free_encoder = Module.ff_free_encoder = function(c, frame, pkt) {
    av_frame_free_js(frame);
    av_packet_free_js(pkt);
    avcodec_free_context_js(c);
};

/**
 * Free everything allocated by ff_init_decoder
 * @param c  AVCodecContext
 * @param pkt  AVPacket
 * @param frame  AVFrame
 */
/* @types
 * ff_free_decoder@sync(
 *     c: number, pkt: number, frame: number
 * ): @promise@void@
 */
var ff_free_decoder = Module.ff_free_decoder = function(c, pkt, frame) {
    ff_free_encoder(c, frame, pkt);
};

/**
 * Encode some number of frames at once. Done in one go to avoid excess message
 * passing.
 * @param ctx  AVCodecContext
 * @param frame  AVFrame
 * @param pkt  AVPacket
 * @param inFrames  Array of frames in libav.js format
 * @param config  Encoding options. May be "true" to indicate end of stream.
 */
/* @types
 * ff_encode_multi@sync(
 *     ctx: number, frame: number, pkt: number, inFrames: (Frame | number)[],
 *     config?: boolean | {
 *         fin?: boolean,
 *         copyoutPacket?: "default"
 *     }
 * ): @promise@Packet[]@
 * ff_encode_multi@sync(
 *     ctx: number, frame: number, pkt: number, inFrames: (Frame | number)[],
 *     config: {
 *         fin?: boolean,
 *         copyoutPacket: "ptr"
 *     }
 * ): @promise@number[]@
 */
var ff_encode_multi = Module.ff_encode_multi = function(ctx, frame, pkt, inFrames, config) {
    if (typeof config === "boolean") {
        config = {fin: config};
    } else {
        config = config || {};
    }

    var outPackets = [];
    var tbNum = AVCodecContext_time_base_num(ctx);
    var tbDen = AVCodecContext_time_base_den(ctx);

    var copyoutPacket = function(ptr) {
        var ret = ff_copyout_packet(ptr);
        if (!ret.time_base_num) {
            ret.time_base_num = tbNum;
            ret.time_base_den = tbDen;
        }
        return ret;
    };

    if (config.copyoutPacket === "ptr") {
        copyoutPacket = function(ptr) {
            var ret = ff_copyout_packet_ptr(ptr);
            if (!AVPacket_time_base_num(ret))
                AVPacket_time_base_s(ret, tbNum, tbDen);
            return ret;
        };
    }

    function handleFrame(inFrame) {
        if (inFrame !== null) {
            ff_copyin_frame(frame, inFrame);
            if (tbNum) {
                if (typeof inFrame === "number") {
                    var itbn = AVFrame_time_base_num(frame);
                    if (itbn) {
                        ff_frame_rescale_ts_js(
                            frame,
                            itbn, AVFrame_time_base_den(frame),
                            tbNum, tbDen
                        );
                        AVFrame_time_base_s(frame, tbNum, tbDen);
                    }
                } else if (inFrame && inFrame.time_base_num) {
                    ff_frame_rescale_ts_js(
                        frame,
                        inFrame.time_base_num, inFrame.time_base_den,
                        tbNum, tbDen
                    );
                    AVFrame_time_base_s(frame, tbNum, tbDen);
                }
            }
        }

        var ret = avcodec_send_frame(ctx, inFrame?frame:0);
        if (ret < 0)
            throw new Error("Error sending the frame to the encoder: " + ff_error(ret));
        if (inFrame)
            av_frame_unref(frame);

        while (true) {
            ret = avcodec_receive_packet(ctx, pkt);
            if (ret === -6 /* EAGAIN */ || ret === -0x20464f45 /* AVERROR_EOF */)
                return;
            else if (ret < 0)
                throw new Error("Error encoding audio frame: " + ff_error(ret));

            outPackets.push(copyoutPacket(pkt));
            av_packet_unref(pkt);
        }
    }

    inFrames.forEach(handleFrame);

    if (config.fin)
        handleFrame(null);

    return outPackets;
};

/**
 * Decode some number of packets at once. Done in one go to avoid excess
 * message passing.
 * @param ctx  AVCodecContext
 * @param pkt  AVPacket
 * @param frame  AVFrame
 * @param inPackets  Incoming packets to decode
 * @param config  Decoding options. May be "true" to indicate end of stream.
 */
/* @types
 * ff_decode_multi@sync(
 *     ctx: number, pkt: number, frame: number, inPackets: (Packet | number)[],
 *     config?: boolean | {
 *         fin?: boolean,
 *         ignoreErrors?: boolean,
 *         copyoutFrame?: "default" | "video" | "video_packed"
 *     }
 * ): @promise@Frame[]@
 * ff_decode_multi@sync(
 *     ctx: number, pkt: number, frame: number, inPackets: (Packet | number)[],
 *     config: {
 *         fin?: boolean,
 *         ignoreErrors?: boolean,
 *         copyoutFrame: "ptr"
 *     }
 * ): @promise@number[]@
 * ff_decode_multi@sync(
 *     ctx: number, pkt: number, frame: number, inPackets: (Packet | number)[],
 *     config: {
 *         fin?: boolean,
 *         ignoreErrors?: boolean,
 *         copyoutFrame: "ImageData"
 *     }
 * ): @promise@ImageData[]@
 */
var ff_decode_multi = Module.ff_decode_multi = function(ctx, pkt, frame, inPackets, config) {
    var outFrames = [];
    var transfer = [];
    if (typeof config === "boolean") {
        config = {fin: config};
    } else {
        config = config || {};
    }

    var tbNum = AVCodecContext_time_base_num(ctx);
    var tbDen = AVCodecContext_time_base_den(ctx);

    var copyoutFrameO = ff_copyout_frame;
    if (config.copyoutFrame)
        copyoutFrameO = ff_copyout_frame_versions[config.copyoutFrame];
    var copyoutFrame = function(ptr) {
        var ret = copyoutFrameO(ptr);
        if (!ret.time_base_num) {
            ret.time_base_num = tbNum;
            ret.time_base_den = tbDen;
        }
        return ret;
    };
    if (config.copyoutFrame === "ptr") {
        copyoutFrame = function(ptr) {
            var ret = ff_copyout_frame_ptr(ptr);
            if (!AVFrame_time_base_num(ret))
                AVFrame_time_base_s(ret, tbNum, tbDen);
            return ret;
        };
    }

    function handlePacket(inPacket) {
        var ret;

        if (inPacket !== null) {
            ret = av_packet_make_writable(pkt);
            if (ret < 0)
                throw new Error("Failed to make packet writable: " + ff_error(ret));
            ff_copyin_packet(pkt, inPacket);

            if (tbNum) {
                if (typeof inPacket === "number") {
                    var iptbn = AVPacket_time_base_num(pkt);
                    if (iptbn) {
                        av_packet_rescale_ts_js(
                            pkt,
                            iptbn, AVPacket_time_base_den(pkt),
                            tbNum, tbDen
                        );
                        AVPacket_time_base_s(pkt, tbNum, tbDen);
                    }
                } else if (inPacket && inPacket.time_base_num) {
                    av_packet_rescale_ts_js(
                        pkt,
                        inPacket.time_base_num, inPacket.time_base_den,
                        tbNum, tbDen
                    );
                    AVPacket_time_base_s(pkt, tbNum, tbDen);
                }
            }
        } else {
            av_packet_unref(pkt);
        }

        ret = avcodec_send_packet(ctx, pkt);
        if (ret < 0) {
            var err = "Error submitting the packet to the decoder: " + ff_error(ret);
            if (!config.ignoreErrors)
                throw new Error(err);
            else {
                console.log(err);
                av_packet_unref(pkt);
                return;
            }
        }
        av_packet_unref(pkt);

        while (true) {
            ret = avcodec_receive_frame(ctx, frame);
            if (ret === -6 /* EAGAIN */ || ret === -0x20464f45 /* AVERROR_EOF */)
                return;
            else if (ret < 0)
                throw new Error("Error decoding audio frame: " + ff_error(ret));

            var outFrame = copyoutFrame(frame);
            if (outFrame && outFrame.libavjsTransfer && outFrame.libavjsTransfer.length)
                transfer.push.apply(transfer, outFrame.libavjsTransfer);
            outFrames.push(outFrame);
            av_frame_unref(frame);
        }
    }

    inPackets.forEach(handlePacket);

    if (config.fin)
        handlePacket(null);

    outFrames.libavjsTransfer = transfer;
    return outFrames;
};

