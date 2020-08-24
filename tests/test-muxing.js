if (typeof process !== "undefined") {
    // Node.js
    LibAV = require("../libav-1.6.4.3.1-default.js");
    fs = require("fs");
}

function print(txt) {
    if (typeof document !== "undefined") {
        var out = document.createElement("pre");
        out.innerText = txt;
        document.body.appendChild(out);
    } else {
        console.log(txt);
    }
}

/* This is a port of doc/examples/muxing.c, but with fixed output */
function main() {
    var libav;
    var oc, fmt, codec, c, frame, pkt, st, pb, frame_size;

    LibAV.LibAV().then(function(ret) {
        libav = ret;

        return libav.avformat_alloc_output_context2_js(0, null, "tmp.ogg");

    }).then(function(ret) {
        oc = ret;
        if (oc === 0)
            throw new Error("Failed to allocate output context");

        return Promise.all([
            libav.AVFormatContext_oformat(oc),
            libav.ff_init_encoder("libopus", {
                bit_rate: 128000,
                sample_fmt: libav.AV_SAMPLE_FMT_FLT,
                sample_rate: 48000,
                channel_layout: 4,
                channels: 1
            }, 1, 48000)
        ]);

    }).then(function(ret) {
        fmt = ret[0];
        codec = ret[1][0];
        c = ret[1][1];
        frame = ret[1][2];
        pkt = ret[1][3];
        frame_size = ret[1][4];

        return Promise.all([
            libav.avformat_new_stream(oc, 0),
            libav.avio_open2_js("tmp.ogg", libav.AVIO_FLAG_WRITE, 0, 0)
        ]);

    }).then(function(ret) {
        st = ret[0];
        pb = ret[1];

        if (st === 0)
            throw new Error("Could not allocate stream");
        if (pb === 0)
            throw new Error("Could not open file");

        return Promise.all([
            libav.AVStream_codecpar(st),
            libav.AVStream_time_base_s(st, 1, 48000),
            libav.AVFormatContext_pb_s(oc, pb)
        ]);

    }).then(function(ret) {
        var codecpar = ret[0];

        return libav.avcodec_parameters_from_context(codecpar, c);

    }).then(function(ret) {
        if (ret < 0)
            throw new Error("Could not copy the stream parameters");

        return libav.avformat_write_header(oc, 0);

    }).then(function(ret) {
        var t = 0;
        var tincr = 2 * Math.PI * 440 / 48000;
        var pts = 0;
        var frames = [];

        for (var i = 0; i < 200; i++) {
            var samples = [];

            for (var j = 0; j < frame_size; j++) {
                samples[j] = Math.sin(t);
                t += tincr;
            }

            frames.push({
                data: samples,
                channel_layout: 4,
                format: libav.AV_SAMPLE_FMT_FLT,
                pts: pts,
                sample_rate: 48000
            });
            pts += frame_size;
        }

        return libav.ff_encode_multi(c, frame, pkt, frames, true);

    }).then(function(packets) {
        var p = Promise.all([]);

        packets.forEach(function(inPacket) {
            p = p.then(function() {
                return libav.av_packet_make_writable(pkt);
            }).then(function(ret) {
                if (ret < 0)
                    throw new Error();
                return libav.ff_copyin_packet(pkt, inPacket);
            }).then(function() {
                // FIXME: av_packet_rescale_ts
                // FIXME: pkt->stream_index = st->index
                return libav.av_interleaved_write_frame(oc, pkt);
            });
        });

        return p.then(function() { return libav.av_packet_unref(pkt) });

    }).then(function() {
        return libav.av_write_trailer(oc);

    }).then(function() {
        return libav.avio_close(pb);

    }).then(function() {
        return libav.avformat_free_context(oc);

    }).then(function() {
        return libav.ff_free_encoder(c, frame, pkt);

    }).then(function() {
        return libav.readFile("tmp.ogg");

    }).then(function(ret) {
        if (typeof document !== "undefined") {
            var blob = new Blob([ret.buffer]);
            var a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.innerText = "Opus";
            document.body.appendChild(a);

        } else {
            fs.writeFileSync("out.opus", ret);

        }

        print("Done");

    }).catch(function(err) {
        print(err + "");
    });
}

main();
