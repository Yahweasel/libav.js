/*
 * Copyright (C) 2019, 2020 Yahweasel
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

var ERRNO_CODES = {
    EPERM: 1,
    EIO: 5,
    EAGAIN: 6,
    ESPIPE: 29
};

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

    return [codec, c, frame, pkt, frame_size];
};

/* Metafunction to initialize a decoder with all the bells and whistles.
 * Similar to ff_init_encoder but doesn't need to initialize the frame.
 * Returns [AVCodec, AVCodecContext, AVPacket, AVFrame] */
var ff_init_decoder = Module.ff_init_decoder = function(name, codecpar) {
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

    if (codecpar) {
        ret = avcodec_parameters_to_context(c, codecpar);
        if (ret < 0)
            throw new Error("Could not set codec parameters: " + ff_error(ret));
    }

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
        if (inFrame)
            av_frame_unref(frame);

        while (true) {
            ret = avcodec_receive_packet(ctx, pkt);
            if (ret === -6 /* EAGAIN */ || ret === -0x20464f45 /* AVERROR_EOF */)
                return;
            else if (ret < 0)
                throw new Error("Error encoding audio frame: " + ff_error(ret));

            var outPacket = ff_copyout_packet(pkt);
            outPackets.push(outPacket);
            av_packet_unref(pkt);
        }
    }

    inFrames.forEach(handleFrame);

    if (fin)
        handleFrame(null);

    return outPackets;
};

/* Decode many packets at once, done at this level to avoid message passing */
var ff_decode_multi = Module.ff_decode_multi = function(ctx, pkt, frame, inPackets, config) {
    var outFrames = [];
    if (typeof config === "boolean") {
        config = {fin: config};
    } else {
        config = config || {};
    }

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

            var outFrame = ff_copyout_frame(frame);
            outFrames.push(outFrame);
            av_frame_unref(frame);
        }
    }

    inPackets.forEach(handlePacket);

    if (config.fin)
        handlePacket(null);

    return outFrames;
};

/* Set the content of a packet. Necessary because we tend to strip packets of their content. */
var ff_set_packet = Module.ff_set_packet = function(pkt, data) {
    if (data.length === 0) {
        av_packet_unref(pkt);
    } else {
        var size = AVPacket_size(pkt);
        if (size < data.length) {
            var ret = av_grow_packet(pkt, data.length - size);
            if (ret < 0)
                throw new Error("Error growing packet: " + ff_error(ret));
        } else if (size > data.length)
            av_shrink_packet(pkt, data.length);
    }
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

        // Codec info
        outStream.codecpar = codecpar;
        outStream.codec_type = AVCodecParameters_codec_type(codecpar);
        outStream.codec_id = AVCodecParameters_codec_id(codecpar);

        // Duration and related
        outStream.time_base_num = AVStream_time_base_num(inStream);
        outStream.time_base_den = AVStream_time_base_den(inStream);
        outStream.duration_time_base = AVStream_duration(inStream) + (AVStream_durationhi(inStream)*0x100000000);
        outStream.duration = outStream.duration_time_base * outStream.time_base_num / outStream.time_base_den;

        streams.push(outStream);
    }
    return [fmt_ctx, streams];
}

/* Write many packets at once, done at this level to avoid message passing */
var ff_write_multi = Module.ff_write_multi = function(oc, pkt, inPackets, interleave) {
    var step = av_interleaved_write_frame;
    if (interleave === false) step = av_write_frame;
    inPackets.forEach(function(inPacket) {
        var ret = av_packet_make_writable(pkt);
        if (ret < 0)
            throw new Error("Error making packet writable: " + ff_error(ret));
        ff_copyin_packet(pkt, inPacket);
        step(oc, pkt);
        av_packet_unref(pkt);
    });
    av_packet_unref(pkt);
};

/* Read many packets at once, done at this level to avoid message passing */
var ff_read_multi = Module.ff_read_multi = function(fmt_ctx, pkt, devfile, opts) {
    var sz = 0;
    var outPackets = {};
    var dev = Module.readBuffers[devfile];

    if (typeof opts === "number")
        opts = {limit: opts};
    if (typeof opts === "undefined")
        opts = {};
    var devLimit = 32*1024;
    if (opts.devLimit)
        devLimit = opts.devLimit;

    while (true) {
        // If we risk running past the end of the currently-read data, stop now
        if (dev && !dev.eof && dev.buf.length < devLimit)
            return [-6 /* EAGAIN */, outPackets];

        // Read the frame
        var ret = av_read_frame(fmt_ctx, pkt);
        if (ret < 0)
            return [ret, outPackets];

        // And copy it out
        var packet = ff_copyout_packet(pkt);
        if (!(packet.stream_index in outPackets))
            outPackets[packet.stream_index] = [];
        outPackets[packet.stream_index].push(packet);
        av_packet_unref(pkt);
        sz += packet.data.length;
        if (opts.limit && sz >= opts.limit)
            return [-6 /* EAGAIN */, outPackets];
    }
};

/* Initialize a filter graph. No equivalent free since you just need to free
 * the graph itself, and everything under it will be freed automatically. */
var ff_init_filter_graph = Module.ff_init_filter_graph = function(filters_descr, input, output) {
    var abuffersrc, abuffersink, filter_graph, tmp_src_ctx, tmp_sink_ctx,
        src_ctxs, sink_ctxs, io_outputs, io_inputs, int32s, int64s;
    var instr, outstr;

    var multiple_inputs = !!input.length;
    if (!multiple_inputs) input = [input];
    var multiple_outputs = !!output.length;
    if (!multiple_outputs) output = [output];
    src_ctxs = [];
    sink_ctxs = [];

    try {
        abuffersrc = avfilter_get_by_name("abuffer");
        if (abuffersrc === 0)
            throw new Error("Failed to load abuffer filter");

        abuffersink = avfilter_get_by_name("abuffersink");
        if (abuffersink === 0)
            throw new Error("Failed to load abuffersink filter");

        filter_graph = avfilter_graph_alloc();
        if (filter_graph === 0)
            throw new Error("Failed to allocate filter graph");

        // Allocate all the "outputs" (our inputs)
        io_outputs = 0;
        var ii = 0;
        input.forEach(function(input) {
            // Allocate the output itself
            var next_io_outputs = avfilter_inout_alloc();
            if (next_io_outputs === 0)
                throw new Error("Failed to allocate outputs");
            AVFilterInOut_next_s(next_io_outputs, io_outputs);
            io_outputs = next_io_outputs;

            // Now create our input filter
            var nm = "in" + (multiple_inputs?ii:"");
            tmp_src_ctx = avfilter_graph_create_filter_js(abuffersrc, nm,
                "time_base=1/" + (input.sample_rate?input.sample_rate:48000) +
                ":sample_rate=" + (input.sample_rate?input.sample_rate:48000) +
                ":sample_fmt=" + (input.sample_fmt?input.sample_fmt:3/*FLT*/) +
                ":channel_layout=" + (input.channel_layout?input.channel_layout:4/*MONO*/),
                null, filter_graph);
            if (tmp_src_ctx === 0)
                throw new Error("Cannot create audio buffer source");
            src_ctxs.push(tmp_src_ctx);

            // Configure the inout
            instr = av_strdup(nm);
            if (instr === 0)
                throw new Error("Failed to allocate output");

            AVFilterInOut_name_s(io_outputs, instr);
            instr = 0;
            AVFilterInOut_filter_ctx_s(io_outputs, tmp_src_ctx);
            tmp_src_ctx = 0;
            AVFilterInOut_pad_idx_s(io_outputs, 0);
            ii++;
        });

        // Allocate all the "inputs" (our outputs)
        io_inputs = 0;
        var oi = 0;
        output.forEach(function(output) {
            // Allocate the input itself
            var next_io_inputs = avfilter_inout_alloc();
            if (next_io_inputs === 0)
                throw new Error("Failed to allocate inputs");
            AVFilterInOut_next_s(next_io_inputs, io_inputs);
            io_inputs = next_io_inputs;

            // Create the output filter
            var nm = "out" + (multiple_outputs?oi:"");
            tmp_sink_ctx = avfilter_graph_create_filter_js(abuffersink, nm, null, null,
                    filter_graph);
            if (tmp_sink_ctx === 0)
                throw new Error("Cannot create audio buffer sink");
            sink_ctxs.push(tmp_sink_ctx);

            // Allocate space to transfer our options
            int32s = ff_malloc_int32_list([output.sample_fmt?output.sample_fmt:3/*FLT*/, -1, output.sample_rate?output.sample_rate:48000, -1]);
            int64s = ff_malloc_int64_list([output.channel_layout?output.channel_layout:4/*MONO*/, -1]);
            outstr = av_strdup(nm);
            if (int32s === 0 || int64s === 0 || outstr === 0)
                throw new Error("Failed to transfer parameters");

            if (
                av_opt_set_int_list_js(tmp_sink_ctx, "sample_fmts", 4, int32s, -1, 1 /* AV_OPT_SEARCH_CHILDREN */) < 0 ||
                av_opt_set_int_list_js(tmp_sink_ctx, "channel_layouts", 8, int64s, -1, 1) < 0 ||
                av_opt_set_int_list_js(tmp_sink_ctx, "sample_rates", 4, int32s + 8, -1, 1) < 0)
            {
                throw new Error("Failed to set filter parameters");
            }
            free(int32s);
            int32s = 0;
            free(int64s);
            int64s = 0;

            // Configure it
            AVFilterInOut_name_s(io_inputs, outstr);
            outstr = 0;
            AVFilterInOut_filter_ctx_s(io_inputs, tmp_sink_ctx);
            tmp_sink_ctx = 0;
            AVFilterInOut_pad_idx_s(io_inputs, 0);
            oi++;
        });

        // Parse it
        var ret = avfilter_graph_parse(filter_graph, filters_descr, io_inputs, io_outputs, 0);
        if (ret < 0)
            throw new Error("Failed to initialize filters: " + ff_error(ret));
        io_inputs = io_outputs = 0;

        // Set the output frame sizes
        var oi = 0;
        output.forEach(function(output) {
            if (output.frame_size)
                av_buffersink_set_frame_size(sink_ctxs[oi], output.frame_size);
            oi++;
        });

        // Configure it
        ret = avfilter_graph_config(filter_graph, 0);
        if (ret < 0)
            throw new Error("Failed to configure filter graph: " + ff_error(ret));

    } catch (ex) {
        // Clean up after ourselves
        if (io_outputs) avfilter_inout_free(io_outputs);
        if (io_inputs) avfilter_inout_free(io_inputs);
        if (filter_graph) avfilter_graph_free(filter_graph);
        if (tmp_src_ctx) avfilter_free(tmp_src_ctx);
        if (tmp_sink_ctx) avfilter_free(tmp_sink_ctx);
        if (int32s) free(int32s);
        if (int64s) free(int64s);
        if (instr) free(instr);
        if (outstr) free(outstr);
        throw ex;

    }

    // And finally, return the critical parts
    return [filter_graph, multiple_inputs ? src_ctxs : src_ctxs[0], multiple_outputs ? sink_ctxs : sink_ctxs[0]];
};

/* Filter many frames at once, possibly to many sources at once */
var ff_filter_multi = Module.ff_filter_multi = function(srcs, buffersink_ctx, framePtr, inFrames, fin) {
    var outFrames = [];

    if (!srcs.length) {
        srcs = [srcs];
        inFrames = [inFrames];
        fin = [fin];
    }

    // Find the longest buffer (ideally they're all the same)
    var max = inFrames.map(function(srcFrames) {
        return srcFrames.length;
    }).reduce(function(a, b) {
        return Math.max(a, b);
    });

    function handleFrame(buffersrc_ctx, inFrame) {
        if (inFrame !== null)
            ff_copyin_frame(framePtr, inFrame);

        var ret = av_buffersrc_add_frame_flags(buffersrc_ctx, inFrame ? framePtr : 0, 8 /* AV_BUFFERSRC_FLAG_KEEP_REF */);
        if (ret < 0)
            throw new Error("Error while feeding the audio filtergraph: " + ff_error(ret));
        av_frame_unref(framePtr);

        while (true) {
            ret = av_buffersink_get_frame(buffersink_ctx, framePtr);
            if (ret === -6 /* EAGAIN */ || ret === -0x20464f45 /* AVERROR_EOF */)
                break;
            if (ret < 0)
                throw new Error("Error while receiving a frame from the filtergraph: " + ff_error(ret));
            var outFrame = ff_copyout_frame(framePtr);
            outFrames.push(outFrame);
            av_frame_unref(framePtr);
        }
    }

    // Handle in *frame* order
    for (var fi = 0; fi <= max; fi++) {
        for (var ti = 0; ti < inFrames.length; ti++) {
            var inFrame = inFrames[ti][fi];
            if (inFrame) handleFrame(srcs[ti], inFrame);
            else if (fin[ti]) handleFrame(srcs[ti], null);
        }
    }

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
        stream_index: AVPacket_stream_index(pkt),
        flags: AVPacket_flags(pkt),
        duration: AVPacket_duration(pkt),
        durationhi: AVPacket_durationhi(pkt),
        side_data: ff_copyout_side_data(pkt)
    };
};

/* Copy out a packet's side data */
var ff_copyout_side_data = Module.ff_copyout_side_data = function(pkt) {
    var side_data = AVPacket_side_data(pkt);
    var side_data_elems = AVPacket_side_data_elems(pkt);
    if (!side_data) return null;

    var ret = [];
    for (var i = 0; i < side_data_elems; i++) {
        var data = AVPacketSideData_data(side_data, i);
        var size = AVPacketSideData_size(side_data, i);
        ret.push({
            data: copyout_u8(data, size).slice(0),
            type: AVPacketSideData_type(side_data, i)
        });
    }

    return ret;
};

/* Copy in a packet */
var ff_copyin_packet = Module.ff_copyin_packet = function(pktPtr, packet) {
    ff_set_packet(pktPtr, packet.data);

    [
        "dts", "dtshi", "duration", "durationhi", "flags", "side_data", "side_data_elems", "stream_index", "pts", "ptshi"
    ].forEach(function(key) {
        if (key in packet)
            Module["AVPacket_" + key + "_si"](pktPtr, packet[key]);
    });

    if (packet.side_data)
        ff_copyin_side_data(pktPtr, packet.side_data);
};

/* Copy in a packet's side data */
var ff_copyin_side_data = Module.ff_copyin_side_data = function(pktPtr, side_data) {
    side_data.forEach(function(elem) {
        var data = av_packet_new_side_data(pktPtr, elem.type, elem.data.length);
        if (data === 0)
            throw new Error("Failed to allocate side data!");
        copyin_u8(data, elem.data);
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
