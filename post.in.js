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
 * Returns [AVCodec AVCodecContext, AVFrame, AVPacket] */
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

/* Free everything allocated by ff_init_encoder */
var ff_free_encoder = Module.ff_free_encoder = function(c, frame, pkt) {
    av_frame_free_js(frame);
    av_packet_free_js(pkt);
    avcodec_free_context_js(c);
};

/* Encode many frames at once, done at this level to avoid message passing */
var ff_encode_multi = Module.ff_encode_multi = function(ctx, frame, pkt, copyin, inFrames, fin) {
    var outPackets = [];

    function handleFrame(inFrame) {
        if (inFrame !== null) {
            if (av_frame_make_writable(frame) < 0)
                throw new Error("Failed to make frame writable");
            var samples = AVFrame_data0(frame);
            Module[copyin + "i"](samples, inFrame.data);
            if (inFrame.pts)
                AVFrame_pts_s(frame, inFrame.pts);
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

            var data = AVPacket_data(pkt);
            var size = AVPacket_size(pkt);
            outPackets.push({
                data: copyout_u8(data, size).slice(0),
                pts: AVPacket_pts(pkt),
                dts: AVPacket_dts(pkt)
            });
        }
    }

    inFrames.forEach(handleFrame);

    if (fin)
        handleFrame(null);

    return outPackets;
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

/* Initialize a format, format context and some number of streams */
var ff_init_format = Module.ff_init_format = function(opts, streamCtxs) {
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

/* Free up a format and/or file */
var ff_free_format = Module.ff_free_format = function(oc, pb) {
    avformat_free_context(oc);
    if (pb)
        avio_close(pb);
};

/* Write many packets at once, done at this level to avoid message passing */
var ff_write_multi = Module.ff_write_multi = function(oc, pkt, inPackets) {
    inPackets.forEach(function(inPacket) {
        if (av_packet_make_writable(pkt) < 0)
            throw new Error();
        ff_set_packet(pkt, inPacket.data);
        AVPacket_pts_s(pkt, inPacket.pts);
        AVPacket_dts_s(pkt, inPacket.dts);
        av_interleaved_write_frame(oc, pkt);
    });
    av_packet_unref(pkt);
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
