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

var readerCallbacks = {
    open: function(stream) {
        if (stream.flags & 3) {
            // Opened in write mode, which can't work
            throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
    },

    close: function(stream) {
        delete Module.readBuffers[stream.node.name];
    },

    read: function(stream, buffer, offset, length, position) {
        var data = Module.readBuffers[stream.node.name];
        if (!data)
            throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
        if (data.buf.length === 0) {
            if (data.eof)
                return 0;
            else
                throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
        }

        var ret;
        if (length < data.buf.length) {
            // Cut a slice
            ret = data.buf.slice(0, length);
            data.buf = data.buf.slice(length);
        } else {
            // Get the beginning
            ret = data.buf;
            data.buf = new Uint8Array(0);
        }

        (new Uint8Array(buffer.buffer)).set(ret, offset);
        return ret.length;
    },

    write: function() {
        throw new FS.ErrnoError(ERRNO_CODES.EIO);
    },

    llseek: function() {
        throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
    }
};

var writerCallbacks = {
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

var readerDev = FS.makedev(44, 0);
FS.registerDevice(readerDev, readerCallbacks);
Module.readBuffers = {};
var writerDev = FS.makedev(44, 1);
FS.registerDevice(writerDev, writerCallbacks);

Module.readFile = FS.readFile.bind(FS);
Module.writeFile = FS.writeFile.bind(FS);
Module.unlink = FS.unlink.bind(FS);
Module.mkdev = FS.mkdev.bind(FS);
Module.mkreaderdev = function(loc, mode) {
    FS.mkdev(loc, mode?mode:0777, readerDev);
    return 0;
};
Module.mkwriterdev = function(loc, mode) {
    FS.mkdev(loc, mode?mode:0777, writerDev);
    return 0;
};

/* Send some data to a reader device */
var ff_reader_dev_send = Module.ff_reader_dev_send = function(name, data) {
    var idata;
    if (!(name in Module.readBuffers))
        Module.readBuffers[name] = {buf: new Uint8Array(0), eof: false};
    idata = Module.readBuffers[name];

    if (data === null) {
        // EOF
        idata.eof = true;
        return;
    }

    var newbuf = new Uint8Array(idata.buf.length + data.length);
    newbuf.set(idata.buf);
    newbuf.set(data, idata.buf.length);
    idata.buf = newbuf;
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
        throw new Error("Could not open codec: " + ff_error(ret));

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

    ret = av_frame_get_buffer(frame, 0);
    if (ret < 0)
        throw new Error("Could not allocate audio data buffers: " + ff_error(ret));

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
        throw new Error("Could not open codec: " + ff_error(ret));

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
var ff_encode_multi = Module.ff_encode_multi = function(ctx, frame, pkt, inFrames, fin) {
    var outPackets = [];

    function handleFrame(inFrame) {
        if (inFrame !== null)
            ff_copyin_frame(frame, inFrame);

        var ret = avcodec_send_frame(ctx, inFrame?frame:0);
        if (ret < 0)
            throw new Error("Error sending the frame to the encoder: " + ff_error(ret));

        while (true) {
            ret = avcodec_receive_packet(ctx, pkt);
            if (ret === -11 /* EAGAIN */ || ret === -0x20464f45 /* AVERROR_EOF */)
                return;
            else if (ret < 0)
                throw new Error("Error encoding audio frame: " + ff_error(ret));

            var outPacket = ff_copyout_packet(pkt);
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
        var ret;

        if (inPacket !== null) {
            ret = av_packet_make_writable(pkt);
            if (ret < 0)
                throw new Error("Failed to make packet writable: " + ff_error(ret));
            ff_copyin_packet(pkt, inPacket);
        } else {
            av_packet_unref(pkt);
        }

        ret = avcodec_send_packet(ctx, pkt);
        if (ret < 0)
            throw new Error("Error submitting the packet to the decoder: " + ff_error(ret));
        av_packet_unref(pkt);

        while (true) {
            ret = avcodec_receive_frame(ctx, frame);
            if (ret === -11 /* EAGAIN */ || ret === -0x20464f45 /* AVERROR_EOF */)
                return;
            else if (ret < 0)
                throw new Error("Error decoding audio frame: " + ff_error(ret));

            var outFrame = ff_copyout_frame(frame);
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
            throw new Error("Error growing packet: " + ff_error(ret));
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
        var ret = avcodec_parameters_from_context(codecpar, ctx[0]);
        if (ret < 0)
            throw new Error("Could not copy the stream parameters: " + ff_error(ret));
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
var ff_init_demuxer_file = Module.ff_init_demuxer_file = function(filename, fmt) {
    var fmt_ctx = avformat_open_input_js(filename, fmt?fmt:null, null);
    if (fmt_ctx === 0)
        throw new Error("Could not open source file");
    var nb_streams = AVFormatContext_nb_streams(fmt_ctx);
    var streams = [];
    for (var i = 0; i < nb_streams; i++) {
        var inStream = AVFormatContext_streams_a(fmt_ctx, i);
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
        var ret = av_packet_make_writable(pkt);
        if (ret < 0)
            throw new Error("Error making packet writable: " + ff_error(ret));
        ff_copyin_packet(pkt, inPacket);
        av_interleaved_write_frame(oc, pkt);
        av_packet_unref(pkt);
    });
    av_packet_unref(pkt);
};

/* Read many packets at once, done at this level to avoid message passing */
var ff_read_multi = Module.ff_read_multi = function(fmt_ctx, pkt, devfile, limit) {
    var sz = 0;
    var outPackets = [];
    var dev = Module.readBuffers[devfile];

    while (true) {
        // If we risk running past the end of the currently-read data, stop now
        if (dev && !dev.eof && dev.buf.length < 32*1024)
            return [-11 /* EAGAIN */, outPackets];

        // Read the frame
        var ret = av_read_frame(fmt_ctx, pkt);
        if (ret < 0)
            return [ret, outPackets];

        // And copy it out
        var packet = ff_copyout_packet(pkt);
        outPackets.push(packet);
        sz += packet.data.length;
        if (limit && sz >= limit)
            return [-11 /* EAGAIN */, outPackets];
    }
};

/* Initialize a filter graph. No equivalent free since you just need to free
 * the graph itself, and everything under it will be freed automatically. */
var ff_init_filter_graph = Module.ff_init_filter_graph = function(filters_descr, input, output) {
    var abuffersrc, abuffersink, filter_graph, src_ctx, sink_ctx, outputs, inputs, int32s, int64s;
    var instr, outstr;

    // FIXME: This has so many allocations, it should have a try-finally to clean up

    abuffersrc = avfilter_get_by_name("abuffer");
    if (abuffersrc === 0)
        throw new Error("Failed to load abuffer filter");

    abuffersink = avfilter_get_by_name("abuffersink");
    if (abuffersink === 0)
        throw new Error("Failed to load abuffersink filter");

    outputs = avfilter_inout_alloc();
    if (outputs === 0)
        throw new Error("Failed to allocate outputs");

    inputs = avfilter_inout_alloc();
    if (inputs === 0)
        throw new Error("Failed to allocate inputs");

    filter_graph = avfilter_graph_alloc();
    if (filter_graph === 0)
        throw new Error("Failed to allocate filter graph");

    // Now create our input and output filters
    src_ctx = avfilter_graph_create_filter_js(abuffersrc, "in",
        "time_base=1/" + (input.sample_rate?input.sample_rate:48000) +
        ":sample_rate=" + (input.sample_rate?input.sample_rate:48000) +
        ":sample_fmt=" + (input.sample_fmt?input.sample_fmt:3/*FLT*/) +
        ":channel_layout=" + (input.channel_layout?input.channel_layout:4/*MONO*/),
        null, filter_graph);
    if (src_ctx === 0)
        throw new Error("Cannot create audio buffer source");

    sink_ctx = avfilter_graph_create_filter_js(abuffersink, "out", null, null,
        filter_graph);
    if (sink_ctx === 0)
        throw new Error("Cannot create audio buffer sink");

    // Allocate space to transfer our options
    int32s = ff_malloc_int32_list([output.sample_fmt?output.sample_fmt:3/*FLT*/, -1, output.sample_rate?output.sample_rate:48000, -1]);
    int64s = ff_malloc_int64_list([output.channel_layout?output.channel_layout:4/*MONO*/, -1]);
    instr = av_strdup("in");
    outstr = av_strdup("out");
    if (int32s === 0 || int64s === 0 || instr === 0 || outstr === 0)
        throw new Error("Failed to transfer parameters");

    if (
        av_opt_set_int_list_js(sink_ctx, "sample_fmts", 4, int32s, -1, 1 /* AV_OPT_SEARCH_CHILDREN */) < 0 ||
        av_opt_set_int_list_js(sink_ctx, "channel_layouts", 8, int64s, -1, 1) < 0 ||
        av_opt_set_int_list_js(sink_ctx, "sample_rates", 4, int32s + 8, -1, 1) < 0)
    {
        throw new Error("Failed to set filter parameters");
    }

    AVFilterInOut_name_s(outputs, instr);
    AVFilterInOut_filter_ctx_s(outputs, src_ctx);
    AVFilterInOut_pad_idx_s(outputs, 0);
    AVFilterInOut_next_s(outputs, 0);
    AVFilterInOut_name_s(inputs, outstr);
    AVFilterInOut_filter_ctx_s(inputs, sink_ctx);
    AVFilterInOut_pad_idx_s(inputs, 0);
    AVFilterInOut_next_s(inputs, 0);

    // Parse it
    var ret = avfilter_graph_parse(filter_graph, filters_descr, inputs, outputs, 0);
    if (ret < 0)
        throw new Error("Failed to initialize filters: " + ff_error(ret));

    // Set the output frame size
    if (output.frame_size)
        av_buffersink_set_frame_size(sink_ctx, output.frame_size);

    // Configure it
    ret = avfilter_graph_config(filter_graph, 0);
    if (ret < 0)
        throw new Error("Failed to configure filter graph: " + ff_error(ret));

    // Free our leftovers
    free(int32s);
    free(int64s);

    // And finally, return the critical parts
    return [filter_graph, src_ctx, sink_ctx];
};

/* Filter many frames at once */
var ff_filter_multi = Module.ff_filter_multi = function(buffersrc_ctx, buffersink_ctx, inFramePtr, inFrames, fin) {
    var outFrames = [];
    var outFramePtr = av_frame_alloc();
    if (outFramePtr === 0)
        throw new Error("Failed to allocate output frame");

    function handleFrame(inFrame) {
        if (inFrame !== null)
            ff_copyin_frame(inFramePtr, inFrame);

        var ret = av_buffersrc_add_frame_flags(buffersrc_ctx, inFrame ? inFramePtr : 0, 8 /* AV_BUFFERSRC_FLAG_KEEP_REF */);
        if (ret < 0)
            throw new Error("Error while feeding the audio filtergraph: " + ff_error(ret));
        av_frame_unref(inFramePtr);

        while (true) {
            ret = av_buffersink_get_frame(buffersink_ctx, outFramePtr);
            if (ret === -11 /* EGAIN */ || ret === -0x20464f45 /* AVERROR_EOF */)
                break;
            if (ret < 0)
                throw new Error("Error while receiving a frame from the filtergraph: " + ff_error(ret));
            var outFrame = ff_copyout_frame(outFramePtr);
            outFrames.push(outFrame);
            av_frame_unref(outFramePtr);
        }
    }

    inFrames.forEach(handleFrame);

    if (fin)
        handleFrame(null);

    av_frame_free(outFramePtr);

    return outFrames;
};

/* Copy out a frame */
var ff_copyout_frame = Module.ff_copyout_frame = function(frame) {
    var channels = AVFrame_channels(frame);
    var format = AVFrame_format(frame);
    var nb_samples = AVFrame_nb_samples(frame);
    var outFrame = {
        data: null,
        channel_layout: AVFrame_channel_layout(frame),
        channels: channels,
        format: format,
        nb_samples: nb_samples,
        pts: AVFrame_pts(frame),
        ptshi: AVFrame_ptshi(frame),
        sample_rate: AVFrame_sample_rate(frame)
    };

    // FIXME: Need to support *every* format here
    if (format >= 5 /* U8P */) {
        // Planar format, multiple data pointers
        var data = [];
        for (var ci = 0; ci < channels; ci++) {
            var inData = AVFrame_data_a(frame, ci);
            switch (format) {
                case 5: // U8P
                    data.push(copyout_u8(inData, nb_samples).slice(0));
                    break;

                case 6: // S16P
                    data.push(copyout_s16(inData, nb_samples).slice(0));
                    break;

                case 7: // S32P
                    data.push(copyout_s32(inData, nb_samples).slice(0));
                    break;

                case 8: // FLT
                    data.push(copyout_f32(inData, nb_samples).slice(0));
                    break;
            }
        }
        outFrame.data = data;

    } else {
        var ct = channels*nb_samples;
        var inData = AVFrame_data_a(frame, 0);
        switch (format) {
            case 0: // U8
                outFrame.data = copyout_u8(inData, ct).slice(0);
                break;

            case 1: // S16
                outFrame.data = copyout_s16(inData, ct).slice(0);
                break;

            case 2: // S32
                outFrame.data = copyout_s32(inData, ct).slice(0);
                break;

            case 3: // FLT
                outFrame.data = copyout_f32(inData, ct).slice(0);
                break;
        }

    }

    return outFrame;
};

/* Copy in a frame */
var ff_copyin_frame = Module.ff_copyin_frame = function(framePtr, frame) {
    var format = frame.format;
    var channels = frame.channels;
    if (!channels) {
        // channel_layout must be set
        var channel_layout = frame.channel_layout;
        channels = 0;
        while (channel_layout) {
            if (channel_layout&1) channels++;
            channel_layout>>>=1;
        }
    }

    [
        "channel_layout", "channels", "format", "pts", "ptshi", "sample_rate"
    ].forEach(function(key) {
        if (key in frame)
            Module["AVFrame_" + key + "_si"](framePtr, frame[key]);
    });

    var nb_samples;
    if (format >= 5 /* U8P */) {
        // Planar, so nb_samples is out of data[0]
        nb_samples = frame.data[0].length;
    } else {
        // Non-planar, divide by channel count
        nb_samples = frame.data.length / channels;
    }

    AVFrame_nb_samples_s(framePtr, nb_samples);

    // We may or may not need to actually allocate
    if (av_frame_make_writable(framePtr) < 0) {
        var ret = av_frame_get_buffer(framePtr, 0);
        if (ret < 0)
            throw new Error("Failed to allocate frame buffers: " + ff_error(ret));
    }

    if (format >= 5 /* U8P */) {
        // A planar format
        for (var ci = 0; ci < channels; ci++) {
            var data = AVFrame_data_a(framePtr, ci);
            var inData = frame.data[ci];
            switch (format) {
                case 5: // U8P
                    copyin_u8(data, inData);
                    break;

                case 6: // S16P
                    copyin_s16(data, inData);
                    break;

                case 7: // S32P
                    copyin_s32(data, inData);
                    break;

                case 8: // FLT
                    copyin_f32(data, inData);
                    break;
            }
        }

    } else {
        var data = AVFrame_data_a(framePtr, 0);
        var inData = frame.data;

        // FIXME: Need to support *every* format here
        switch (format) {
            case 0: // U8
                copyin_u8(data, inData);
                break;

            case 1: // S16
                copyin_s16(data, inData);
                break;

            case 2: // S32
                copyin_s32(data, inData);
                break;

            case 3: // FLT
                copyin_f32(data, inData);
                break;
        }

    }
};

/* Copy out a packet */
var ff_copyout_packet = Module.ff_copyout_packet = function(pkt) {
    var data = AVPacket_data(pkt);
    var size = AVPacket_size(pkt);
    return {
        data: copyout_u8(data, size).slice(0),
        pts: AVPacket_pts(pkt),
        ptshi: AVPacket_ptshi(pkt),
        dts: AVPacket_dts(pkt),
        dtshi: AVPacket_dtshi(pkt),
        stream_index: AVPacket_stream_index(pkt)
    };
};

/* Copy in a packet */
var ff_copyin_packet = Module.ff_copyin_packet = function(pktPtr, packet) {
    ff_set_packet(pktPtr, packet.data);

    [
        "dts", "dtshi", "stream_index", "pts", "pts_hi"
    ].forEach(function(key) {
        if (key in packet)
            Module["AVPacket_" + key + "_si"](pktPtr, packet[key]);
    });
};

/* Allocate and copy in a 32-bit int list */
var ff_malloc_int32_list = Module.ff_malloc_int32_list = function(list) {
    var ptr = malloc(list.length * 4);
    if (ptr === 0)
        throw new Error("Failed to malloc");
    var arr = new Uint32Array(Module.HEAPU8.buffer, ptr, list.length);
    for (var i = 0; i < list.length; i++)
        arr[i] = list[i];
    return ptr;
};

/* Allocate and copy in a 64-bit int list */
var ff_malloc_int64_list = Module.ff_malloc_int64_list = function(list) {
    var ptr = malloc(list.length * 8);
    if (ptr === 0)
        throw new Error("Failed to malloc");
    var arr = new Int32Array(Module.HEAPU8.buffer, ptr, list.length*2);
    for (var i = 0; i < list.length; i++) {
        arr[i*2] = list[i];
        arr[i*2+1] = (list[i]<0)?-1:0;
    }
    return ptr;
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
