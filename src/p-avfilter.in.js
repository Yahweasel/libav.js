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
 * Initialize a filter graph. No equivalent free since you just need to free
 * the graph itself (av_filter_graph_free) and everything under it will be
 * freed automatically.
 * Returns [AVFilterGraph, AVFilterContext, AVFilterContext], where the second
 * and third are the input and output buffer source/sink. For multiple
 * inputs/outputs, the second and third will be arrays, as appropriate.
 * @param filters_descr  Filtergraph description
 * @param input  Input settings, or array of input settings for multiple inputs
 * @param output  Output settings, or array of output settings for multiple
 *                outputs
 */
/* @types
 * ff_init_filter_graph@sync(
 *     filters_descr: string,
 *     input: FilterIOSettings,
 *     output: FilterIOSettings
 * ): @promise@[number, number, number]@;
 * ff_init_filter_graph@sync(
 *     filters_descr: string,
 *     input: FilterIOSettings[],
 *     output: FilterIOSettings
 * ): @promise@[number, number[], number]@;
 * ff_init_filter_graph@sync(
 *     filters_descr: string,
 *     input: FilterIOSettings,
 *     output: FilterIOSettings[]
 * ): @promise@[number, number, number[]]@;
 * ff_init_filter_graph@sync(
 *     filters_descr: string,
 *     input: FilterIOSettings[],
 *     output: FilterIOSettings[]
 * ): @promise@[number, number[], number[]]@
 */
var ff_init_filter_graph = Module.ff_init_filter_graph = function(filters_descr, input, output) {
    var buffersrc, abuffersrc, format, aformat, buffersink, abuffersink, filter_graph,
        tmp_src_ctx, format_ctx, tmp_sink_ctx, src_ctxs, sink_ctxs, io_outputs, io_inputs,
        int32s;
    var instr, outstr;

    var multiple_inputs = !!input.length;
    if (!multiple_inputs) input = [input];
    var multiple_outputs = !!output.length;
    if (!multiple_outputs) output = [output];
    src_ctxs = [];
    sink_ctxs = [];

    try {
        buffersrc = avfilter_get_by_name("buffer");
        abuffersrc = avfilter_get_by_name("abuffer");
        format = avfilter_get_by_name("format");
        aformat = avfilter_get_by_name("aformat");
        buffersink = avfilter_get_by_name("buffersink");
        abuffersink = avfilter_get_by_name("abuffersink");

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
            if (input.type === 0 /* AVMEDIA_TYPE_VIDEO */) {
                if (buffersrc === 0)
                    throw new Error("Failed to load buffer filter");
                var frame_rate = input.frame_rate;
                var time_base = input.time_base;
                if (typeof frame_rate === "undefined")
                    frame_rate = 30;
                if (typeof time_base === "undefined")
                    time_base = [1, frame_rate];
                tmp_src_ctx = avfilter_graph_create_filter_js(buffersrc, nm,
                    "time_base=" + time_base[0] + "/" + time_base[1] +
                    ":frame_rate=" + frame_rate +
                    ":pix_fmt=" + (input.pix_fmt?input.pix_fmt:0/*YUV420P*/) +
                    ":width=" + (input.width?input.width:640) +
                    ":height=" + (input.height?input.height:360),
                    null, filter_graph);

            } else { // audio filter
                if (abuffersrc === 0)
                    throw new Error("Failed to load abuffer filter");
                var sample_rate = input.sample_rate;
                var time_base = input.time_base;
                if (typeof sample_rate === "undefined")
                    sample_rate = 48000;
                if (typeof time_base === "undefined")
                    time_base = [1, sample_rate];
                tmp_src_ctx = avfilter_graph_create_filter_js(abuffersrc, nm,
                    "time_base=" + time_base[0] + "/" + time_base[1] +
                    ":sample_rate=" + sample_rate +
                    ":sample_fmt=" + (input.sample_fmt?input.sample_fmt:3/*FLT*/) +
                    ":channel_layout=0x" + (input.channel_layout?input.channel_layout:4/*MONO*/).toString(16),
                    null, filter_graph);

            }

            if (tmp_src_ctx === 0)
                throw new Error("Cannot create buffer source");
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
            if (output.type === 0 /* AVMEDIA_TYPE_VIDEO */) {
                if (format === 0 || buffersink === 0)
                    throw new Error("Failed to load format or buffersink filter");
                format_ctx = avfilter_graph_create_filter_js(format, nm + "format",
                    "pix_fmts=0x" + (output.pix_fmt||0).toString(16),
                    null, filter_graph);
                tmp_sink_ctx = avfilter_graph_create_filter_js(
                    buffersink, nm, null, null, filter_graph);
            } else { // audio
                format_ctx = avfilter_graph_create_filter_js(aformat, nm + "format",
                    "sample_fmts=" + (output.sample_fmt||3/*FLT*/) +
                    ":channel_layouts=0x" + (output.channel_layout||4/*mono*/).toString(16) +
                    ":sample_rates=" + (output.sample_rate||48000),
                    null, filter_graph);
                tmp_sink_ctx = avfilter_graph_create_filter_js(abuffersink, nm,
                    null, null, filter_graph);
            }
            if (format_ctx === 0)
                throw new Error("Cannot create format filter");
            if (tmp_sink_ctx === 0)
                throw new Error("Cannot create buffer sink");
            avfilter_link(format_ctx, 0, tmp_sink_ctx, 0);
            sink_ctxs.push(tmp_sink_ctx);

            // Configure it
            outstr = av_strdup(nm);
            if (outstr === 0)
                throw new Error("Failed to transfer parameters");
            AVFilterInOut_name_s(io_inputs, outstr);
            outstr = 0;
            AVFilterInOut_filter_ctx_s(io_inputs, format_ctx);
            format_ctx = tmp_sink_ctx = 0;
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
        if (format_ctx) avfilter_free(format_ctx);
        if (tmp_sink_ctx) avfilter_free(tmp_sink_ctx);
        if (int32s) free(int32s);
        if (instr) free(instr);
        if (outstr) free(outstr);
        throw ex;

    }

    // And finally, return the critical parts
    return [filter_graph, multiple_inputs ? src_ctxs : src_ctxs[0], multiple_outputs ? sink_ctxs : sink_ctxs[0]];
};

/**
 * Filter some number of frames, possibly corresponding to multiple sources.
 * Only one sink is allowed, but config is per source. Set
 * `config.ignoreSinkTimebase` to leave frames' timebase as it was, rather than
 * imposing the timebase of the buffer sink. Set `config.copyoutFrame` to use a
 * different copier than the default.
 * @param srcs  AVFilterContext(s), input
 * @param buffersink_ctx  AVFilterContext, output
 * @param framePtr  AVFrame
 * @param inFrames  Input frames, either as an array of frames or with frames
 *                  per input
 * @param config  Options. May be "true" to indicate end of stream.
 */
/* @types
 * ff_filter_multi@sync(
 *     srcs: number, buffersink_ctx: number, framePtr: number,
 *     inFrames: (Frame | number)[], config?: boolean | {
 *         fin?: boolean,
 *         ignoreSinkTimebase?: boolean,
 *         copyoutFrame?: "default" | "video" | "video_packed"
 *     }
 * ): @promise@Frame[]@;
 * ff_filter_multi@sync(
 *     srcs: number[], buffersink_ctx: number, framePtr: number,
 *     inFrames: (Frame | number)[][], config?: boolean[] | {
 *         fin?: boolean,
 *         ignoreSinkTimebase?: boolean,
 *         copyoutFrame?: "default" | "video" | "video_packed"
 *     }[]
 * ): @promise@Frame[]@
 * ff_filter_multi@sync(
 *     srcs: number, buffersink_ctx: number, framePtr: number,
 *     inFrames: (Frame | number)[], config: {
 *         fin?: boolean,
 *         ignoreSinkTimebase?: boolean,
 *         copyoutFrame: "ptr"
 *     }
 * ): @promise@number[]@;
 * ff_filter_multi@sync(
 *     srcs: number[], buffersink_ctx: number, framePtr: number,
 *     inFrames: (Frame | number)[][], config: {
 *         fin?: boolean,
 *         ignoreSinkTimebase?: boolean,
 *         copyoutFrame: "ptr"
 *     }[]
 * ): @promise@number[]@
 * ff_filter_multi@sync(
 *     srcs: number, buffersink_ctx: number, framePtr: number,
 *     inFrames: (Frame | number)[], config: {
 *         fin?: boolean,
 *         ignoreSinkTimebase?: boolean,
 *         copyoutFrame: "ImageData"
 *     }
 * ): @promise@ImageData[]@;
 * ff_filter_multi@sync(
 *     srcs: number[], buffersink_ctx: number, framePtr: number,
 *     inFrames: (Frame | number)[][], config: {
 *         fin?: boolean,
 *         ignoreSinkTimebase?: boolean,
 *         copyoutFrame: "ImageData"
 *     }[]
 * ): @promise@ImageData[]@
 */
var ff_filter_multi = Module.ff_filter_multi = function(srcs, buffersink_ctx, framePtr, inFrames, config) {
    var outFrames = [];
    var transfer = [];
    var tbNum = -1, tbDen = -1;

    if (!srcs.length) {
        srcs = [srcs];
        inFrames = [inFrames];
        config = [config];
    }

    config = config.map(function(config) {
        if (config === true)
            return {fin: true};
        return config || {};
    });

    // Find the longest buffer (ideally they're all the same)
    var max = inFrames.map(function(srcFrames) {
        return srcFrames.length;
    }).reduce(function(a, b) {
        return Math.max(a, b);
    });

    function handleFrame(buffersrc_ctx, inFrame, copyoutFrame, config) {
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

            if (tbNum < 0) {
                tbNum = av_buffersink_get_time_base_num(buffersink_ctx);
                tbDen = av_buffersink_get_time_base_den(buffersink_ctx);
            }

            var outFrame = copyoutFrame(framePtr);

            if (tbNum && !config.ignoreSinkTimebase) {
                if (typeof outFrame === "number") {
                    AVFrame_time_base_s(outFrame, tbNum, tbDen);
                } else if (outFrame) {
                    outFrame.time_base_num = tbNum;
                    outFrame.time_base_den = tbDen;
                }
            }

            if (outFrame && outFrame.libavjsTransfer && outFrame.libavjsTransfer.length)
                transfer.push.apply(transfer, outFrame.libavjsTransfer);
            outFrames.push(outFrame);
            av_frame_unref(framePtr);
        }
    }

    // Choose a frame copier per stream
    var copyoutFrames = [];
    for (var ti = 0; ti < inFrames.length; ti++) (function(ti) {
        var copyoutFrame = ff_copyout_frame;
        if (config[ti].copyoutFrame)
            copyoutFrame = ff_copyout_frame_versions[config[ti].copyoutFrame];
        copyoutFrames.push(copyoutFrame);
    })(ti);

    // Handle in *frame* order
    for (var fi = 0; fi <= max; fi++) {
        for (var ti = 0; ti < inFrames.length; ti++) {
            var inFrame = inFrames[ti][fi];
            if (inFrame) handleFrame(srcs[ti], inFrame, copyoutFrames[ti], config[ti]);
            else if (config[ti].fin) handleFrame(srcs[ti], null, copyoutFrames[ti], config[ti]);
        }
    }

    outFrames.libavjsTransfer = transfer;
    return outFrames;
};

/**
 * Decode and filter frames. Just a combination of ff_decode_multi and
 * ff_filter_multi that's all done on the libav.js side.
 * @param ctx  AVCodecContext
 * @param buffersrc_ctx  AVFilterContext, input
 * @param buffersink_ctx  AVFilterContext, output
 * @param pkt  AVPacket
 * @param frame  AVFrame
 * @param inPackets  Incoming packets to decode and filter
 * @param config  Decoding and filtering options. May be "true" to indicate end
 *                of stream.
 */
/* @types
 * ff_decode_filter_multi@sync(
 *     ctx: number, buffersrc_ctx: number, buffersink_ctx: number, pkt: number,
 *     frame: number, inPackets: (Packet | number)[],
 *     config?: boolean | {
 *         fin?: boolean,
 *         ignoreErrors?: boolean,
 *         copyoutFrame?: "default" | "video" | "video_packed"
 *     }
 * ): @promise@Frame[]@
 * ff_decode_filter_multi@sync(
 *     ctx: number, buffersrc_ctx: number, buffersink_ctx: number, pkt: number,
 *     frame: number, inPackets: (Packet | number)[],
 *     config: {
 *         fin?: boolean,
 *         ignoreErrors?: boolean,
 *         copyoutFrame: "ptr"
 *     }
 * ): @promise@number[]@
 * ff_decode_filter_multi@sync(
 *     ctx: number, buffersrc_ctx: number, buffersink_ctx: number, pkt: number,
 *     frame: number, inPackets: (Packet | number)[],
 *     config: {
 *         fin?: boolean,
 *         ignoreErrors?: boolean,
 *         copyoutFrame: "ImageData"
 *     }
 * ): @promise@ImageData[]@
 */
var ff_decode_filter_multi = Module.ff_decode_filter_multi = function(
    ctx, buffersrc_ctx, buffersink_ctx, pkt, frame, inPackets, config
) {
    if (typeof config === "boolean") {
        config = {fin: config};
    } else {
        config = config || {};
    }

    // 1: Decode
    var decodedFrames = ff_decode_multi(ctx, pkt, frame, inPackets, {
        fin: !!config.fin,
        ignoreErrors: !!config.ignoreErrors,
        copyoutFrame: "ptr"
    });

    // 2: Filter
    return ff_filter_multi(
        buffersrc_ctx, buffersink_ctx, frame, decodedFrames, {
            fin: !!config.fin,
            copyoutFrame: config.copyoutFrame || "default"
        }
    );
}
