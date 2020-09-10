if (typeof process !== "undefined") {
    // Node.js
    LibAV = require("../libav-2.1.4.3.1-default.js");
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

// This is a port of doc/examples/encode_audio.c, but using Opus
function encode(libav, ctx, frame, pkt) {
    return libav.avcodec_send_frame(ctx, frame).then(function(ret) {
        if (ret < 0)
            throw new Error("Error sending the frame to the encoder");

        return new Promise(function(res, rej) {
            function packet() {
                libav.avcodec_receive_packet(ctx, pkt).then(function(ret) {
                    if (ret === -libav.EAGAIN || ret === libav.AVERROR_EOF) {
                        res(ret);
                        return;
                    } else if (ret < 0) {
                        rej(new Error("avcodec_receive_packet: " + ret));
                        return;
                    }

                    return libav.ff_copyout_packet(pkt);

                }).then(function(ret) {
                    if (!ret) return;
                    var part = "";
                    ret.data.forEach(function(b) {
                        if (b < 16) part += "0";
                        part += b.toString(16);
                    });
                    //print(part);

                    return libav.av_packet_unref(pkt).then(packet).catch(rej);

                }).catch(rej);
            }
            packet();
        });
    });
}

function main() {
    var libav;
    var codec, c, pkt, frame, frame_size;

    LibAV.LibAV().then(function(ret) {
        libav = ret;
        return libav.avcodec_find_encoder_by_name("libopus");

    }).then(function(ret) {
        codec = ret;
        if (codec === 0)
            throw new Error("Codec not found");
        return libav.avcodec_alloc_context3(codec);

    }).then(function(ret) {
        c = ret;
        if (c === 0)
            throw new Error("Could not allocate audio codec context");;
        return Promise.all([
            libav.AVCodecContext_set(c, {
                bit_rate: 128000,
                sample_fmt: libav.AV_SAMPLE_FMT_FLT,
                sample_rate: 48000,
                channel_layout: 4,
                channels: 1
            }),
            libav.AVCodecContext_time_base_s(c, 1, 48000)
        ]);

    }).then(function(ret) {
        return libav.avcodec_open2(c, codec, 0);

    }).then(function(ret) {
        if (ret < 0)
            throw new Error("Could not open codec (" + ret + ")");
        return Promise.all([
            libav.av_packet_alloc(),
            libav.av_frame_alloc(),
            libav.AVCodecContext_frame_size(c)
        ]);

    }).then(function(ret) {
        pkt = ret[0];
        frame = ret[1];
        frame_size = ret[2];
        return libav.AVFrame_set(frame, {
            nb_samples: frame_size,
            format: libav.AV_SAMPLE_FMT_FLT,
            channel_layout: 4
        });

    }).then(function() {
        return libav.av_frame_get_buffer(frame, 0);

    }).then(function(ret) {
        if (ret < 0)
            throw new Error("Could not allocate audio data buffers");

        // Form the loop into a promise
        var t = 0;
        var tincr = 2 * Math.PI * 440 / 48000;
        var p = Promise.all([]);

        for (var i = 0; i < 200; i++) (function(i) {
            var samples;
            p = p.then(function() {
                return libav.av_frame_make_writable(frame);
            }).then(function(ret) {
                if (ret < 0)
                    throw new Error();
                return libav.AVFrame_data_a(frame, 0);

            }).then(function(ret) {
                samples = ret;
                var samplesIn = [];

                for (var j = 0; j < frame_size; j++) {
                    samplesIn[j] = Math.sin(t);
                    t += tincr;
                }

                return libav.copyin_f32(samples, samplesIn);

            }).then(function() {
                return encode(libav, c, frame, pkt);

            });
        })(i);

        return p.then(function() {
            return encode(libav, c, 0, pkt);
        });

    }).then(function() {
        return Promise.all([
            libav.av_frame_free_js(frame),
            libav.av_packet_free_js(pkt),
            libav.avcodec_free_context_js(c)
        ]);

    }).then(function() {
        print("Done");

    }).catch(function(err) {
        print(err + "");
    });
}

main();
