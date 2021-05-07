if (typeof process !== "undefined") {
    // Node.js
    LibAV = require("../libav-2.3.4.4-default.js");
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

// This is a loose port of doc/examples/demuxing_decoding.c
function open_codec_context(libav, fmt_ctx) {
    var stream_index, st, codecpar, dec, dec_ctx;

    return libav.av_find_best_stream(fmt_ctx, libav.AVMEDIA_TYPE_AUDIO, -1, -1, 0, 0).then(function(ret) {
        stream_index = ret;
        if (stream_index < 0)
            throw new Error("Could not find stream in input file");

        // Find a decoder for the stream
        return libav.AVFormatContext_streams_a(fmt_ctx, stream_index);

    }).then(function(ret) {
        st = ret;
        return libav.AVStream_codecpar(st);
    }).then(function(ret) {
        codecpar = ret;
        return libav.AVCodecParameters_codec_id(codecpar);
    }).then(function(ret) {
        return libav.avcodec_find_decoder(ret);

    }).then(function(ret) {
        dec = ret;
        if (dec === 0)
            throw new Error("Failed to find codec");

        return libav.avcodec_alloc_context3(dec);

    }).then(function(ret) {
        dec_ctx = ret;
        if (dec_ctx === 0)
            throw new Error("Failed to allocate the codec context");

        return libav.avcodec_parameters_to_context(dec_ctx, codecpar);

    }).then(function(ret) {
        if (ret < 0)
            throw new Error("Failed to copy codec parameters to decoder context");

        return libav.avcodec_open2(dec_ctx, dec, 0);

    }).then(function(ret) {
        if (ret < 0)
            throw new Error("Failed to open codec");

        return new Promise(function(res, rej) { res([stream_index, dec_ctx]); });
    });
}

function main() {
    var libav;
    var fmt_ctx, audio_stream_idx, pkt, frame, codec, c;
    var inPackets;

    LibAV.LibAV().then(function(ret) {
        libav = ret;
        return new Promise(function(res, rej) {
            if (typeof XMLHttpRequest !== "undefined") {
                var xhr = new XMLHttpRequest();
                xhr.responseType = "arraybuffer";
                xhr.open("GET", "exa.opus", true);

                xhr.onreadystatechange = function() {
                    if (xhr.readyState === 4) {
                        if (xhr.status === 200)
                            res(xhr.response);
                        else
                            rej(xhr.status);
                    }
                };

                xhr.send();

            } else {
                res(fs.readFileSync("exa.opus").buffer);

            }

        });

    }).then(function(ret) {
        return libav.writeFile("tmp.opus", new Uint8Array(ret));

    }).then(function() {
        return libav.avformat_open_input_js("tmp.opus", null, null);

    }).then(function(ret) {
        fmt_ctx = ret;
        if (fmt_ctx === 0)
            throw new Error("Could not open source file");

        return open_codec_context(libav, fmt_ctx);

    }).then(function(ret) {
        audio_stream_idx = ret[0];
        c = ret[1];

        return Promise.all([
            libav.av_packet_alloc(),
            libav.av_frame_alloc()
        ]);

    }).then(function(ret) {
        pkt = ret[0];
        frame = ret[1];
        inPackets = [];

        return new Promise(function(res, rej) {
            function readFrame() {
                libav.av_read_frame(fmt_ctx, pkt).then(function(ret) {
                    if (ret < 0) {
                        res(ret);
                        return;
                    }

                    return libav.ff_copyout_packet(pkt);

                }).then(function(ret) {
                    if (!ret) return;
                    inPackets.push(ret);
                    readFrame();

                }).catch(rej);
            }
            readFrame();
        });

    }).then(function() {
        return libav.ff_decode_multi(c, pkt, frame, inPackets, true);

    }).then(function(ret) {
        /*print("[\n" +
            ret.map(function(pkt) {
                return "new Uint8Array([" + Array.prototype.join.call(pkt.data, ", ") + "])";
            }).join(",\n") +
            "\n]");*/

        return Promise.all([
            libav.ff_free_decoder(c, pkt, frame),
            libav.avformat_close_input_js(fmt_ctx)
        ]);

    }).then(function() {
        print("Done");

    }).catch(function(err) {
        print(err + "");
    });
}

main();
