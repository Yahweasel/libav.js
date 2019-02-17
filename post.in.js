/*
 * Copyright (C) 2019 Yahweasel
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

var fileCallbacks = {
    open: function(stream) {
        if (!(stream.flags & 1)) {
            // Opened in read mode, which can't work
            throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
    },

    close: function() {},

    read: function() {
        throw new FS.ErrnoError(ERRNO_CODES.EIO);
    },

    write: function(stream, buffer, offset, length, position) {
        if (!Module.onwrite)
            throw new FS.ErrnoError(ERRNO_CODES.EIO);
        Module.onwrite(stream.node.name, position, buffer.subarray(offset, offset + length));
        return length;
    },

    llseek: function(stream, offset, whence) {
        if (whence === 2)
            throw new FS.ErrnoError(ERRNO_CODES.EIO);
        else if (whence === 1)
            offset += stream.position;
        return offset;
    }
};

@FUNCS

var writerDev = FS.makedev(44, 0);
FS.registerDevice(writerDev, fileCallbacks);

Module.readFile = FS.readFile.bind(FS);
Module.writeFile = FS.writeFile.bind(FS);
Module.unlink = FS.unlink.bind(FS);
Module.mkdev = FS.mkdev.bind(FS);
Module.mkwriterdev = function(loc, mode) {
    return FS.mkdev(loc, mode?mode:0777, writerDev);
};

/* Metafunction to initialize an encoder with all the bells and whistles
 * Returns [AVCodec, AVCodecContext, AVFrame, AVPacket, frame_size] */
var ff_init_encoder = Module.ff_init_encoder = function(name, ctxProps, time_base_num, time_base_den) {
    var codec = avcodec_find_encoder_by_name(name);
    if (codec === 0)
        throw new Error("Codec not found");

    var c = avcodec_alloc_context3(codec);
    if (c === 0)
        throw new Error("Could not allocate audio codec context");

    for (var prop in ctxProps)
        this["AVCodecContext_" + prop + "_si"](c, ctxProps[prop]);
    AVCodecContext_time_base_s(c, time_base_num, time_base_den);

    var ret = avcodec_open2(c, codec, 0);
    if (ret < 0)
        throw new Error("Could not open codec (" + ret + ")");

    var frame = av_frame_alloc();
    if (frame === 0)
        throw new Error("Could not allocate frame");
    var pkt = av_packet_alloc();
    if (pkt === 0)
        throw new Error("Could not allocate packet");

    var frame_size = AVCodecContext_frame_size(c);

    AVFrame_nb_samples_s(frame, frame_size);
    AVFrame_format_s(frame, ctxProps.sample_fmt);
    AVFrame_channel_layout_s(frame, ctxProps.channel_layout);

    if (av_frame_get_buffer(frame, 0) < 0)
        throw new Error("Could not allocate audio data buffers");

    return [codec, c, frame, pkt, frame_size];
};

/* Metafunction to initialize a decoder with all the bells and whistles.
 * Similar to ff_init_encoder but doesn't need to initialize the frame.
 * Returns [AVCodec, AVCodecContext, AVPacket, AVFrame] */
var ff_init_decoder = Module.ff_init_decoder = function(name) {
    var codec;
    if (typeof name === "string")
        codec = avcodec_find_decoder_by_name(name);
    else
        codec = avcodec_find_decoder(name);
    if (codec === 0)
        throw new Error("Codec not found");

    var c = avcodec_alloc_context3(codec);
    if (c === 0)
        throw new Error("Could not allocate audio codec context");

    var ret = avcodec_open2(c, codec, 0);
    if (ret < 0)
        throw new Error("Could not open codec (" + ret + ")");;

    var pkt = av_packet_alloc();
    if (pkt === 0)
        throw new Error("Could not allocate packet");

    var frame = av_frame_alloc();
    if (frame === 0)
        throw new Error("Could not allocate frame");

    return [codec, c, pkt, frame];
};

/* Free everything allocated by ff_init_encoder */
var ff_free_encoder = Module.ff_free_encoder = function(c, frame, pkt) {
    av_frame_free_js(frame);
    av_packet_free_js(pkt);
    avcodec_free_context_js(c);
};

/* Free everything allocated by ff_init_decoder */
var ff_free_decoder = Module.ff_free_decoder = function(c, pkt, frame) {
    ff_free_encoder(c, frame, pkt);
};

/* Encode many frames at once, done at this level to avoid message passing */
var ff_encode_multi = Module.ff_encode_multi = function(ctx, frame, pkt, copyin, inFrames, fin) {
    var outPackets = [];

    function handleFrame(inFrame) {
        if (inFrame !== null) {
            if (av_frame_make_writable(frame) < 0)
                throw new Error("Failed to make frame writable");
            ff_copyin_frame(ctx, frame, inFrame);
        }

        var ret = avcodec_send_frame(ctx, inFrame?frame:0);
        if (ret < 0)
            throw new Error("Error sending the frame to the encoder");

        while (true) {
            ret = avcodec_receive_packet(ctx, pkt);
            if (ret === -11 /* EAGAIN */ || ret === -0x20464f45 /* AVERROR_EOF */)
                return;
            else if (ret < 0)
                throw new Error("Error encoding audio frame");

            var outPacket = ff_copyout_packet(pkt);
            outPacket.data = outPacket.data.slice(0);
            outPackets.push(outPacket);
        }
    }

    inFrames.forEach(handleFrame);

    if (fin)
        handleFrame(null);

    return outPackets;
};

/* Decode many packets at once, done at this level to avoid message passing */
var ff_decode_multi = Module.ff_decode_multi = function(ctx, pkt, frame, inPackets, fin) {
    var outFrames = [];

    function handlePacket(inPacket) {
        if (inPacket !== null) {
            if (av_packet_make_writable(pkt) < 0)
                throw new Error("Failed to make packet writable");
            console.error(inPacket);
            ff_copyin_packet(pkt, inPacket);
        } else {
            av_packet_unref(pkt);
        }

        if (avcodec_send_packet(ctx, pkt) < 0)
            throw new Error("Error submitting the packet to the decoder");
        av_packet_unref(pkt);

        while (true) {
            var ret = avcodec_receive_frame(ctx, frame);
            if (ret === -11 /* EAGAIN */ || ret === -0x20464f45 /* AVERROR_EOF */)
                return;
            else if (ret < 0)
                throw new Error("Error decoding audio frame");

            var outFrame = ff_copyout_frame(ctx, frame);
            outFrame.data = outFrame.data.slice(0);
            outFrames.push(outFrame);
        }
    }

    inPackets.forEach(handlePacket);

    if (fin)
        handlePacket(null);

    return outFrames;
};

/* Set the content of a packet. Necessary because we tend to strip packets of their content. */
var ff_set_packet = Module.ff_set_packet = function(pkt, data) {
    var size = AVPacket_size(pkt);
    if (size < data.length) {
        var ret = av_grow_packet(pkt, data.length - size);
        if (ret < 0)
            throw new Error("Error growing packet: " + ret);
    } else if (size > data.length)
        av_shrink_packet(pkt, data.length);
    var ptr = AVPacket_data(pkt);
    Module.HEAPU8.set(data, ptr);
};

/* Initialize a muxer format, format context and some number of streams */
var ff_init_muxer = Module.ff_init_muxer = function(opts, streamCtxs) {
    var oformat = opts.oformat ? opts.oformat : 0;
    var format_name = opts.format_name ? opts.format_name : null;
    var filename = opts.filename ? opts.filename : null;
    var oc = avformat_alloc_output_context2_js(oformat, format_name, filename);
    if (oc === 0)
        throw new Error("Failed to allocate output context");
    var fmt = AVFormatContext_oformat(oc);
    var sts = [];
    streamCtxs.forEach(function(ctx) {
        var st = avformat_new_stream(oc, 0);
        if (st === 0)
            throw new Error("Could not allocate stream");
        var codecpar = AVStream_codecpar(st);
        if (avcodec_parameters_from_context(codecpar, ctx[0]) < 0)
            throw new Error("Could not copy the stream parameters");
        AVStream_time_base_s(st, ctx[1], ctx[2]);
    });

    // Set up the device if requested
    if (opts.device)
        FS.mkdev(opts.filename, 0777, writerDev);

    // Open the actual file if requested
    var pb = null;
    if (opts.open) {
        pb = avio_open2_js(opts.filename, 2 /* AVIO_FLAG_WRITE */, 0, 0);
        if (pb === 0)
            throw new Error("Could not open file");
        AVFormatContext_pb_s(oc, pb);
    }

    return [oc, fmt, pb, sts];
};

/* Free up a muxer format and/or file */
var ff_free_muxer = Module.ff_free_muxer = function(oc, pb) {
    avformat_free_context(oc);
    if (pb)
        avio_close(pb);
};

/* Initialize a demuxer from a file, format context, and get the list of codecs/types */
var ff_init_demuxer_file = Module.ff_init_demuxer_file = function(filename) {
    var fmt_ctx = avformat_open_input_js(filename, null, null);
    if (fmt_ctx === 0)
        throw new Error("Could not open source file");
    var nb_streams = AVFormatContext_nb_streams(fmt_ctx);
    var streams = [];
    for (var i = 0; i < nb_streams; i++) {
        var inStream = AVFormatContext_stream_a(fmt_ctx, i);
        var outStream = {};
        var codecpar = AVStream_codecpar(inStream);
        outStream.index = i;
        outStream.codec_type = AVCodecParameters_codec_type(codecpar);
        outStream.codec_id = AVCodecParameters_codec_id(codecpar);
        streams.push(outStream);
    }
    return [fmt_ctx, streams];
}

/* Write many packets at once, done at this level to avoid message passing */
var ff_write_multi = Module.ff_write_multi = function(oc, pkt, inPackets) {
    inPackets.forEach(function(inPacket) {
        if (av_packet_make_writable(pkt) < 0)
            throw new Error();
        ff_copyin_packet(pkt, inPacket);
        av_interleaved_write_frame(oc, pkt);
        av_packet_unref(pkt);
    });
    av_packet_unref(pkt);
};

/* Copy out a frame */
var ff_copyout_frame = Module.ff_copyout_frame = function(ctx, frame) {
    var sample_fmt = AVCodecContext_sample_fmt(ctx);
    var channels = AVCodecContext_channels(ctx);
    var nb_samples = AVFrame_nb_samples(frame);
    var ct = channels*nb_samples;
    var data = AVFrame_data_a(frame, 0);
    var outFrame = {data: null, sample_fmt: sample_fmt, channels: channels, pts: AVFrame_pts(frame)};

    // FIXME: Need to support *every* format here
    switch (sample_fmt) {
        case 0: // U8
            outFrame.data = copyout_u8(data, ct);
            break;

        case 1: // S16
            outFrame.data = copyout_s16(data, ct);
            break;

        case 2: // S32
            outFrame.data = copyout_s32(data, ct);
            break;

        case 3: // FLT
            outFrame.data = copyout_f32(data, ct);
            break;
    }

    return outFrame;
};

/* Copy in a frame */
var ff_copyin_frame = Module.ff_copyin_frame = function(ctx, framePtr, frame) {
    var sample_fmt = AVCodecContext_sample_fmt(ctx);
    var data = AVFrame_data_a(framePtr, 0);

    if (frame.pts)
        AVFrame_pts_s(framePtr, frame.pts);

    // FIXME: Need to support *every* format here
    switch (sample_fmt) {
        case 0: // U8
            copyin_u8(data, frame.data);
            break;

        case 1: // S16
            copyin_s16(data, frame.data);
            break;

        case 2: // S32
            copyin_s32(data, frame.data);
            break;

        case 3: // FLT
            copyin_f32(data, frame.data);
            break;
    }
};

/* Copy out a packet */
var ff_copyout_packet = Module.ff_copyout_packet = function(pkt) {
    var data = AVPacket_data(pkt);
    var size = AVPacket_size(pkt);
    return {
        data: copyout_u8(data, size),
        pts: AVPacket_pts(pkt),
        dts: AVPacket_dts(pkt),
        stream_index: AVPacket_stream_index(pkt)
    };
};

/* Copy in a packet */
var ff_copyin_packet = Module.ff_copyin_packet = function(pktPtr, packet) {
    ff_set_packet(pktPtr, packet.data);

    if (packet.pts)
        AVPacket_pts_s(pktPtr, packet.pts);
    if (packet.dts)
        AVPacket_dts_s(pktPtr, packet.dts);
    if (packet.stream_index)
        AVPacket_stream_index_s(pktPtr, packet.stream_index);
};

if (typeof importScripts !== "undefined") {
    // We're a WebWorker, so arrange messages
    onmessage = function(e) {
        var id = e.data[0];
        var fun = e.data[1];
        var args = e.data.slice(2);
        var ret = void 0;
        var succ = true;
        try {
            ret = Module[fun].apply(Module, args);
        } catch (ex) {
            succ = false;
            ret = ex.toString() + "\n" + ex.stack;
        }
        postMessage([id, fun, succ, ret]);
    };

    Module.onRuntimeInitialized = function() {
        postMessage([0, "onRuntimeInitialized", true, null]);
    };

    Module.onwrite = function(name, pos, buf) {
        postMessage(["onwrite", "onwrite", true, [name, pos, buf]]);
    };
}
