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

/**
 * Copy out a packet.
 * @param pkt  AVPacket
 */
/// @types ff_copyout_packet@sync(pkt: number): @promise@Packet@
var ff_copyout_packet = Module.ff_copyout_packet = function(pkt) {
    var data = AVPacket_data(pkt);
    var size = AVPacket_size(pkt);
    var data = copyout_u8(data, size);
    return {
        data: data,
        libavjsTransfer: [data.buffer],
        pts: AVPacket_pts(pkt),
        ptshi: AVPacket_ptshi(pkt),
        dts: AVPacket_dts(pkt),
        dtshi: AVPacket_dtshi(pkt),
        time_base_num: AVPacket_time_base_num(pkt),
        time_base_den: AVPacket_time_base_den(pkt),
        stream_index: AVPacket_stream_index(pkt),
        flags: AVPacket_flags(pkt),
        duration: AVPacket_duration(pkt),
        durationhi: AVPacket_durationhi(pkt),
        side_data: ff_copyout_side_data(
            AVPacket_side_data(pkt),
            AVPacket_side_data_elems(pkt)
        )
    };
};

// Copy out a packet's side data. Used internally by ff_copyout_packet.
var ff_copyout_side_data = Module.ff_copyout_side_data = function(side_data, side_data_elems) {
    if (!side_data) return null;

    var ret = [];
    for (var i = 0; i < side_data_elems; i++) {
        var data = AVPacketSideData_data(side_data, i);
        var size = AVPacketSideData_size(side_data, i);
        ret.push({
            data: copyout_u8(data, size),
            type: AVPacketSideData_type(side_data, i)
        });
    }

    return ret;
};

/**
 * Copy "out" a packet by just copying its data into a new AVPacket.
 * @param pkt  AVPacket
 */
/// @types ff_copyout_packet_ptr@sync(pkt: number): @promise@number@
var ff_copyout_packet_ptr = Module.ff_copyout_packet_ptr = function(pkt) {
    var ret = av_packet_clone(pkt);
    if (!ret)
        throw new Error("Failed to clone packet");
    return ret;
};

// Versions of ff_copyout_packet
var ff_copyout_packet_versions = {
    default: ff_copyout_packet,
    ptr: ff_copyout_packet_ptr
};

/**
 * Copy in a packet.
 * @param pktPtr  AVPacket
 * @param packet  Packet to copy in, as either a Packet or an AVPacket pointer
 */
/// @types ff_copyin_packet@sync(pktPtr: number, packet: Packet | number): @promise@void@
var ff_copyin_packet = Module.ff_copyin_packet = function(pktPtr, packet) {
    if (typeof packet === "number") {
        // Input packet is an AVPacket pointer, duplicate it
        av_packet_unref(pktPtr);
        var res = av_packet_ref(pktPtr, packet);
        if (res < 0)
            throw new Error("Failed to reference packet: " + ff_error(res));
        av_packet_unref(packet);
        av_packet_free_js(packet);
        return;
    }

    ff_set_packet(pktPtr, packet.data);

    [
        "dts", "dtshi", "duration", "durationhi", "flags", "stream_index",
        "pts", "ptshi", "time_base_num", "time_base_den"
    ].forEach(function(key) {
        if (key in packet)
            CAccessors["AVPacket_" + key + "_s"](pktPtr, packet[key]);
    });

    ff_copyin_side_data(pktPtr, packet.side_data);
};

// Copy in a packet's side data. Used internally by ff_copyin_packet.
var ff_copyin_side_data = Module.ff_copyin_side_data = function(pktPtr, side_data) {
    AVPacket_side_data_s(pktPtr, 0);
    AVPacket_side_data_elems_s(pktPtr, 0);
    if (!side_data) return;
    side_data.forEach(function(elem) {
        var data = av_packet_new_side_data(pktPtr, elem.type, elem.data.length);
        if (data === 0)
            throw new Error("Failed to allocate side data!");
        copyin_u8(data, elem.data);
    });
};

/**
 * Copy out codec parameters.
 * @param codecpar  AVCodecParameters
 */
/// @types ff_copyout_codecpar@sync(codecpar: number): @promise@CodecParameters@
var ff_copyout_codecpar = Module.ff_copyout_codecpar = function(codecpar) {
    return {
        bit_rate: AVCodecParameters_bit_rate(codecpar),
        channel_layoutmask: AVCodecParameters_channel_layoutmask(codecpar),
        channels: AVCodecParameters_channels(codecpar),
        chroma_location: AVCodecParameters_chroma_location(codecpar),
        codec_id: AVCodecParameters_codec_id(codecpar),
        codec_tag: AVCodecParameters_codec_tag(codecpar),
        codec_type: AVCodecParameters_codec_type(codecpar),
        color_primaries: AVCodecParameters_color_primaries(codecpar),
        color_range: AVCodecParameters_color_range(codecpar),
        color_space: AVCodecParameters_color_space(codecpar),
        color_trc: AVCodecParameters_color_trc(codecpar),
        format: AVCodecParameters_format(codecpar),
        height: AVCodecParameters_height(codecpar),
        level: AVCodecParameters_level(codecpar),
        profile: AVCodecParameters_profile(codecpar),
        sample_rate: AVCodecParameters_sample_rate(codecpar),
        width: AVCodecParameters_width(codecpar),
        extradata: ff_copyout_codecpar_extradata(codecpar),
        coded_side_data: ff_copyout_side_data(
            AVCodecParameters_coded_side_data(codecpar),
            AVCodecParameters_nb_coded_side_data(codecpar)
        )
    };
};

// Copy out codec parameter extradata. Used internally by ff_copyout_codecpar.
var ff_copyout_codecpar_extradata = Module.ff_copyout_codecpar_extradata = function(codecpar) {
    var extradata = AVCodecParameters_extradata(codecpar);
    var extradata_size = AVCodecParameters_extradata_size(codecpar);
    if (!extradata || !extradata_size) return null;
    return copyout_u8(extradata, extradata_size);
};

/**
 * Copy in codec parameters.
 * @param codecparPtr  AVCodecParameters
 * @param codecpar  Codec parameters to copy in.
 */
/// @types ff_copyin_codecpar@sync(codecparPtr: number, codecpar: CodecParameters): @promise@void@
var ff_copyin_codecpar = Module.ff_copyin_codecpar = function(codecparPtr, codecpar) {
    [
        "bit_rate", "channel_layoutmask", "channels", "chroma_location",
        "codec_id", "codec_tag", "codec_type", "color_primaries", "color_range",
        "color_space", "color_trc", "format", "height", "level", "profile",
        "sample_rate", "width"
    ].forEach(function(key) {
        if (key in codecpar)
            CAccessors["AVCodecParameters_" + key + "_s"](codecparPtr, codecpar[key]);
    });

    ff_copyin_codecpar_extradata(codecparPtr, codecpar.extradata);
    ff_copyin_codecpar_side_data(codecparPtr, codecpar.side_data);
};

// Copy in codec parameter extradata. Used internally by ff_copyin_codecpar.
var ff_copyin_codecpar_extradata = Module.ff_copyin_codecpar_extradata = function(codecparPtr, extradata) {
    if (!extradata) {
        AVCodecParameters_extradata_s(codecparPtr, 0);
        AVCodecParameters_extradata_size_s(codecparPtr, 0);
    } else {
        var extradataPtr = malloc(extradata.length);
        copyin_u8(extradataPtr, extradata);
        AVCodecParameters_extradata_s(codecparPtr, extradataPtr);
        AVCodecParameters_extradata_size_s(codecparPtr, extradata.length);
    }
};

// Copy in a codecpar's side data. Used internally by ff_copyin_codecpar.
var ff_copyin_codecpar_side_data = Module.ff_copyin_codecpar_side_data = function(codecpar, side_data) {
    AVCodecParameters_coded_side_data_s(codecpar, 0);
    AVCodecParameters_nb_coded_side_data_s(codecpar, 0);
    if (!side_data) return;
    side_data.forEach(function(elem) {
        var data = ff_codecpar_new_side_data(codecpar, elem.type, elem.data.length);
        if (data === 0)
            throw new Error("Failed to allocate side data!");
        copyin_u8(data, elem.data);
    });
};
