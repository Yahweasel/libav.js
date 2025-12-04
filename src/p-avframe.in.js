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
 * Copy out a frame.
 * @param frame  AVFrame
 */
/// @types ff_copyout_frame@sync(frame: number): @promise@Frame@
var ff_copyout_frame = Module.ff_copyout_frame = function(frame) {
    var nb_samples = AVFrame_nb_samples(frame);
    if (nb_samples === 0) {
        // Maybe a video frame?
        var width = AVFrame_width(frame);
        if (width)
            return ff_copyout_frame_video_width(frame, width);
    }
    var channels = AVFrame_channels(frame);
    var format = AVFrame_format(frame);
    var transfer = [];
    var outFrame = {
        data: null,
        libavjsTransfer: transfer,
        channel_layout: AVFrame_channel_layout(frame),
        channels: channels,
        format: format,
        nb_samples: nb_samples,
        pts: AVFrame_pts(frame),
        ptshi: AVFrame_ptshi(frame),
        best_effort_timestamp: AVFrame_best_effort_timestamp(frame),
        best_effort_timestamphi: AVFrame_best_effort_timestamphi(frame),
        time_base_num: AVFrame_time_base_num(frame),
        time_base_den: AVFrame_time_base_den(frame),
        sample_rate: AVFrame_sample_rate(frame)
    };

    // FIXME: Need to support *every* format here
    if (format >= 5 /* U8P */) {
        // Planar format, multiple data pointers
        var data = [];
        for (var ci = 0; ci < channels; ci++) {
            var inData = AVFrame_data_a(frame, ci);
            var outData = null;
            switch (format) {
                case 5: // U8P
                    outData = copyout_u8(inData, nb_samples);
                    break;

                case 6: // S16P
                    outData = copyout_s16(inData, nb_samples);
                    break;

                case 7: // S32P
                    outData = copyout_s32(inData, nb_samples);
                    break;

                case 8: // FLT
                    outData = copyout_f32(inData, nb_samples);
                    break;
            }

            if (outData) {
                data.push(outData);
                transfer.push(outData.buffer);
            }
        }
        outFrame.data = data;

    } else {
        var ct = channels*nb_samples;
        var inData = AVFrame_data_a(frame, 0);
        var outData = null;
        switch (format) {
            case 0: // U8
                outData = copyout_u8(inData, ct);
                break;

            case 1: // S16
                outData = copyout_s16(inData, ct);
                break;

            case 2: // S32
                outData = copyout_s32(inData, ct);
                break;

            case 3: // FLT
                outData = copyout_f32(inData, ct);
                break;
        }

        if (outData) {
            outFrame.data = outData;
            transfer.push(outData.buffer);
        }

    }

    return outFrame;
};

/**
 * Copy out a video frame. `ff_copyout_frame` will copy out a video frame if a
 * video frame is found, but this may be faster if you know it's a video frame.
 * @param frame  AVFrame
 */
/// @types ff_copyout_frame_video@sync(frame: number): @promise@Frame@
var ff_copyout_frame_video = Module.ff_copyout_frame_video = function(frame) {
    return ff_copyout_frame_video_width(frame, AVFrame_width(frame));
};

// Copy out a video frame. Used internally by ff_copyout_frame.
var ff_copyout_frame_video_width = Module.ff_copyout_frame_video = function(frame, width) {
    var height = AVFrame_height(frame);
    var format = AVFrame_format(frame);
    var desc = av_pix_fmt_desc_get(format);
    var log2ch = AVPixFmtDescriptor_log2_chroma_h(desc);
    var layout = [];
    var transfer = [];
    var outFrame = {
        data: null,
        layout: layout,
        libavjsTransfer: transfer,
        width: width,
        height: height,
        crop: {
            top: AVFrame_crop_top(frame),
            bottom: AVFrame_crop_bottom(frame),
            left: AVFrame_crop_left(frame),
            right: AVFrame_crop_right(frame)
        },
        format: AVFrame_format(frame),
        flags: AVFrame_flags(frame),
        key_frame: AVFrame_key_frame(frame),
        pict_type: AVFrame_pict_type(frame),
        pts: AVFrame_pts(frame),
        ptshi: AVFrame_ptshi(frame),
        best_effort_timestamp: AVFrame_best_effort_timestamp(frame),
        best_effort_timestamphi: AVFrame_best_effort_timestamphi(frame),
        time_base_num: AVFrame_time_base_num(frame),
        time_base_den: AVFrame_time_base_den(frame),
        sample_aspect_ratio: [
            AVFrame_sample_aspect_ratio_num(frame),
            AVFrame_sample_aspect_ratio_den(frame)
        ]
    };

    // Figure out the data range
    var dataLo = 1/0;
    var dataHi = 0;
    for (var p = 0; p < 8 /* AV_NUM_DATA_POINTERS */; p++) {
        var linesize = AVFrame_linesize_a(frame, p);
        if (!linesize)
            break;
        var plane = AVFrame_data_a(frame, p);
        if (plane < dataLo)
            dataLo = plane;
        var h = height;
        if (p === 1 || p === 2)
            h >>= log2ch;
        plane += linesize * h;
        if (plane > dataHi)
            dataHi = plane;
    }

    // Copy out that segment of data
    outFrame.data = Module.HEAPU8.slice(dataLo, dataHi);
    transfer.push(outFrame.data.buffer);

    // And describe the layout
    for (var p = 0; p < 8; p++) {
        var linesize = AVFrame_linesize_a(frame, p);
        if (!linesize)
            break;
        var plane = AVFrame_data_a(frame, p);
        layout.push({
            offset: plane - dataLo,
            stride: linesize
        });
    }

    return outFrame;
};

/**
 * Get the size of a packed video frame in its native format.
 * @param frame  AVFrame
 */
/// @types ff_frame_video_packed_size@sync(frame: number): @promise@Frame@
var ff_frame_video_packed_size = Module.ff_frame_video_packed_size = function(frame) {
    // FIXME: duplication
    var width = AVFrame_width(frame);
    var height = AVFrame_height(frame);
    var format = AVFrame_format(frame);
    var desc = av_pix_fmt_desc_get(format);

    // VERY simple bpp, assuming all components are 8-bit
    var bpp = 1;
    if (!(AVPixFmtDescriptor_flags(desc) & 0x10) /* planar */)
        bpp *= AVPixFmtDescriptor_nb_components(desc);

    var dataSz = 0;
    for (var i = 0; i < 8 /* AV_NUM_DATA_POINTERS */; i++) {
        var linesize = AVFrame_linesize_a(frame, i);
        if (!linesize)
            break;
        var w = width * bpp;
        var h = height;
        if (i === 1 || i === 2) {
            w >>= AVPixFmtDescriptor_log2_chroma_w(desc);
            h >>= AVPixFmtDescriptor_log2_chroma_h(desc);
        }
        dataSz += w * h;
    }

    return dataSz;
};

/* Copy out just the packed data from this frame, into the given buffer. Used
 * internally. */
function ff_copyout_frame_data_packed(data, layout, frame) {
    var width = AVFrame_width(frame);
    var height = AVFrame_height(frame);
    var format = AVFrame_format(frame);
    var desc = av_pix_fmt_desc_get(format);

    // VERY simple bpp, assuming all components are 8-bit
    var bpp = 1;
    if (!(AVPixFmtDescriptor_flags(desc) & 0x10) /* planar */)
        bpp *= AVPixFmtDescriptor_nb_components(desc);

    // Copy it out
    var dIdx = 0;
    for (var i = 0; i < 8 /* AV_NUM_DATA_POINTERS */; i++) {
        var linesize = AVFrame_linesize_a(frame, i);
        if (!linesize)
            break;
        var inData = AVFrame_data_a(frame, i);
        var w = width * bpp;
        var h = height;
        if (i === 1 || i === 2) {
            w >>= AVPixFmtDescriptor_log2_chroma_w(desc);
            h >>= AVPixFmtDescriptor_log2_chroma_h(desc);
        }
        layout.push({
            offset: dIdx,
            stride: w
        });
        for (var y = 0; y < h; y++) {
            var line = inData + y * linesize;
            data.set(
                Module.HEAPU8.subarray(line, line + w),
                dIdx
            );
            dIdx += w;
        }
    }
};

/**
 * Copy out a video frame, as a single packed Uint8Array.
 * @param frame  AVFrame
 */
/// @types ff_copyout_frame_video_packed@sync(frame: number): @promise@Frame@
var ff_copyout_frame_video_packed = Module.ff_copyout_frame_video_packed = function(frame) {
    var data = new Uint8Array(ff_frame_video_packed_size(frame));
    var layout = [];
    ff_copyout_frame_data_packed(data, layout, frame);

    var outFrame = {
        data: data,
        libavjsTransfer: [data.buffer],
        width: AVFrame_width(frame),
        height: AVFrame_height(frame),
        format: AVFrame_format(frame),
        flags: AVFrame_flags(frame),
        key_frame: AVFrame_key_frame(frame),
        pict_type: AVFrame_pict_type(frame),
        pts: AVFrame_pts(frame),
        ptshi: AVFrame_ptshi(frame),
        best_effort_timestamp: AVFrame_best_effort_timestamp(frame),
        best_effort_timestamphi: AVFrame_best_effort_timestamphi(frame),
        time_base_num: AVFrame_time_base_num(frame),
        time_base_den: AVFrame_time_base_den(frame),
        sample_aspect_ratio: [
            AVFrame_sample_aspect_ratio_num(frame),
            AVFrame_sample_aspect_ratio_den(frame)
        ]
    };

    return outFrame;
};

/**
 * Copy out a video frame as an ImageData. The video frame *must* be RGBA for
 * this to work as expected (though some ImageData will be returned for any
 * frame).
 * @param frame  AVFrame
 */
/* @types
 * ff_copyout_frame_video_imagedata@sync(
 *     frame: number
 * ): @promise@ImageData@
 */
var ff_copyout_frame_video_imagedata = Module.ff_copyout_frame_video_imagedata = function(frame) {
    var width = AVFrame_width(frame);
    var height = AVFrame_height(frame);
    var id = new ImageData(width, height);
    var layout = [];
    ff_copyout_frame_data_packed(id.data, layout, frame);
    id.libavjsTransfer = [id.data.buffer];
    return id;
};

/**
 * Copy "out" a video frame by just allocating another frame in libav.
 * @param frame  AVFrame
 */
var ff_copyout_frame_ptr = Module.ff_copyout_frame_ptr = function(frame) {
    var ret = av_frame_clone(frame);
    if (!ret)
        throw new Error("Failed to allocate new frame");
    return ret;
};

// All of the versions of ff_copyout_frame
var ff_copyout_frame_versions = {
    default: ff_copyout_frame,
    video: ff_copyout_frame_video,
    video_packed: ff_copyout_frame_video_packed,
    ImageData: ff_copyout_frame_video_imagedata,
    ptr: ff_copyout_frame_ptr
};

/**
 * Copy in a frame.
 * @param framePtr  AVFrame
 * @param frame  Frame to copy in, as either a Frame or an AVFrame pointer
 */
/// @types ff_copyin_frame@sync(framePtr: number, frame: Frame | number): @promise@void@
var ff_copyin_frame = Module.ff_copyin_frame = function(framePtr, frame) {
    if (typeof frame === "number") {
        // This is a frame pointer, not a libav.js Frame
        av_frame_unref(framePtr);
        var ret = av_frame_ref(framePtr, frame);
        if (ret < 0)
            throw new Error("Failed to reference frame data: " + ff_error(ret));
        av_frame_unref(frame);
        av_frame_free_js(frame);
        return;
    }

    if (frame.width)
        return ff_copyin_frame_video(framePtr, frame);

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
        "channel_layout", "channels", "format", "pts", "ptshi", "sample_rate",
        "best_effort_timestamp", "best_effort_timestamphi",
        "time_base_num", "time_base_den"
    ].forEach(function(key) {
        if (key in frame)
            CAccessors["AVFrame_" + key + "_s"](framePtr, frame[key]);
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

// Copy in a video frame. Used internally by ff_copyin_frame.
var ff_copyin_frame_video = Module.ff_copyin_frame_video = function(framePtr, frame) {
    [
        "format", "height", "key_frame", "flags", "pict_type", "pts", "ptshi", "width",
        "best_effort_timestamp", "best_effort_timestamphi",
        "time_base_num", "time_base_den"
    ].forEach(function(key) {
        if (key in frame)
            CAccessors["AVFrame_" + key + "_s"](framePtr, frame[key]);
    });

    if ("sample_aspect_ratio" in frame) {
        AVFrame_sample_aspect_ratio_s(framePtr, frame.sample_aspect_ratio[0],
            frame.sample_aspect_ratio[1]);
    }

    var crop = frame.crop || {top: 0, bottom: 0, left: 0, right: 0};
    AVFrame_crop_top_s(framePtr, crop.top);
    AVFrame_crop_bottom_s(framePtr, crop.bottom);
    AVFrame_crop_left_s(framePtr, crop.left);
    AVFrame_crop_right_s(framePtr, crop.right);

    var desc = av_pix_fmt_desc_get(frame.format);
    var log2cw = AVPixFmtDescriptor_log2_chroma_w(desc);
    var log2ch = AVPixFmtDescriptor_log2_chroma_h(desc);

    // We may or may not need to actually allocate
    if (av_frame_make_writable(framePtr) < 0) {
        var ret = av_frame_get_buffer(framePtr, 0);
        if (ret < 0)
            throw new Error("Failed to allocate frame buffers: " + ff_error(ret));
    }

    // If layout is not provided, assume packed
    var layout = frame.layout;
    if (!layout) {
        layout = [];

        // VERY simple bpp, assuming all components are 8-bit
        var bpp = 1;
        if (!(AVPixFmtDescriptor_flags(desc) & 0x10) /* planar */)
            bpp *= AVPixFmtDescriptor_nb_components(desc);

        var off = 0;
        for (var p = 0; p < 8 /* AV_NUM_DATA_POINTERS */; p++) {
            var linesize = AVFrame_linesize_a(framePtr, p);
            if (!linesize)
                break;
            var w = frame.width;
            var h = frame.height;
            if (p === 1 || p === 2) {
                w >>= log2cw;
                h >>= log2ch;
            }
            layout.push({
                offset: off,
                stride: w * bpp
            });
            off += w * h * bpp;
        }
    }

    // Copy it in
    for (var p = 0; p < layout.length; p++) {
        var lplane = layout[p];
        var linesize = AVFrame_linesize_a(framePtr, p);
        var data = AVFrame_data_a(framePtr, p);
        var h = frame.height;
        if (p === 1 || p === 2)
            h >>= log2ch;
        var ioff = lplane.offset;
        var ooff = 0;
        var stride = Math.min(lplane.stride, linesize);
        for (var y = 0; y < h; y++) {
            copyin_u8(
                data + ooff,
                frame.data.subarray(ioff, ioff + stride)
            );
            ooff += linesize;
            ioff += lplane.stride;
        }
    }
};
