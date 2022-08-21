if (typeof process !== "undefined") {
    // Node.js
    LibAV = require("./libav.js")();
    fs = require("fs");
    OpusExa = Function(fs.readFileSync("exa.opus.js", "utf8")+"return OpusExa;")();
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

/* This is sort of a port of doc/examples/decode_audio.c, but with
 * no demuxing, and with Opus */
function decode(libav, dec_ctx, pkt, frame) {
    return libav.avcodec_send_packet(dec_ctx, pkt).then(function(ret) {
        if (ret < 0)
            throw new Error("Error submitting the packet to the decoder");

        return new Promise(function(res, rej) {
            function readFrame() {
                libav.avcodec_receive_frame(dec_ctx, frame).then(function(ret) {
                    if (ret === -libav.EAGAIN || ret === libav.AVERROR_EOF) {
                        res(ret);
                        return;
                    } else if (ret < 0) {
                        rej(new Error("avcodec_receive_frame: " + ret));
                        return;
                    }

                    return libav.ff_copyout_frame(frame);

                }).then(function(ret) {
                    if (!ret) return;
                    //print(Array.prototype.join.call(ret.data, ", "));
                    readFrame();
                }).catch(rej);
            }
            readFrame();
        });
    });
}

function main() {
    var libav;
    var pkt, frame, codec, c;

    LibAV.LibAV().then(function(ret) {
        libav = ret;
        return Promise.all([
            libav.av_packet_alloc(),
            libav.av_frame_alloc(),
            libav.avcodec_find_decoder_by_name("libopus")
        ])
    }).then(function(ret) {
        pkt = ret[0];
        frame = ret[1];
        codec = ret[2];

        if (pkt === 0)
            throw new Error();
        if (frame === 0)
            throw new Error("Could not allocate audio frame");
        if (codec === 0)
            throw new Error("Codec not found");

        return libav.avcodec_alloc_context3(codec);

    }).then(function(ret) {
        c = ret;

        if (c === 0)
            throw new Error("Could not allocate audio codec context");

        return libav.avcodec_open2(c, codec, 0);

    }).then(function(ret) {
        if (ret < 0)
            throw new Error("Could not open codec");

        var p = Promise.all([]);

        // Decode each packet
        OpusExa.forEach(function(inPacket) {
            p = p.then(function() {
                return libav.av_packet_make_writable(pkt);
            }).then(function(ret) {
                if (ret < 0)
                    throw new Error();
                return libav.ff_set_packet(pkt, inPacket);
            }).then(function() {
                return decode(libav, c, pkt, frame);
            });
        });

        return p.then(function() {
            return libav.av_packet_unref(pkt);
        }).then(function() {
            // Flush the decoder
            return decode(libav, c, pkt, frame);
        });

    }).then(function() {
        return Promise.all([
            libav.avcodec_free_context_js(c),
            libav.av_frame_free(frame),
            libav.av_packet_free(pkt)
        ]);

    }).then(function() {
        print("Done");

    }).catch(function(err) {
        print(err + "");
    });
}

main();
