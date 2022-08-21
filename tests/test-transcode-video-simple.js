if (typeof process !== "undefined") {
    // Node.js
    LibAV = require("./libav.js")("webm");
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

function main() {
    var libav;
    var fmt_ctx, streams, video_stream_idx, pkt, frame, codec, c;
    var oc, fmt, pb, st;
    var frames;

    LibAV.LibAV().then(function(ret) {
        libav = ret;
        return new Promise(function(res, rej) {
            if (typeof XMLHttpRequest !== "undefined") {
                var xhr = new XMLHttpRequest();
                xhr.responseType = "arraybuffer";
                xhr.open("GET", "exa.webm", true);

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
                res(fs.readFileSync("exa.webm").buffer);

            }

        });

    }).then(function(ret) {
        return libav.writeFile("tmp.webm", new Uint8Array(ret));

    }).then(function() {
        return libav.ff_init_demuxer_file("tmp.webm");

    }).then(function(ret) {
        fmt_ctx = ret[0];
        streams = ret[1];

        var si, stream;
        for (si = 0; si < streams.length; si++) {
            stream = streams[si];
            if (stream.codec_type === libav.AVMEDIA_TYPE_VIDEO)
                break;
        }
        if (si >= streams.length)
            throw new Error("Couldn't find video stream");

        video_stream_idx = stream.index;
        return libav.ff_init_decoder(stream.codec_id, stream.codecpar);

    }).then(function(ret) {
        c = ret[1];
        pkt = ret[2];
        frame = ret[3];

        return libav.ff_read_multi(fmt_ctx, pkt);

    }).then(function(ret) {
        if (ret[0] !== libav.AVERROR_EOF)
            throw new Error("Error reading: " + ret[0]);

        return libav.ff_decode_multi(c, pkt, frame, ret[1][video_stream_idx], true);

    }).then(function(ret) {
        frames = ret;
        return Promise.all([
            libav.ff_free_decoder(c, pkt, frame),
            libav.avformat_close_input_js(fmt_ctx)
        ]);

    }).then(function() {
        return libav.ff_init_encoder("libvpx", {
            ctx: {
                bit_rate: 1000000,
                pix_fmt: frames[0].format,
                width: frames[0].width,
                height: frames[0].height
            },
            options: {
                quality: "realtime",
                "cpu-used": "8"
            }
        });

    }).then(function(ret) {
        codec = ret[0];
        c = ret[1];
        frame = ret[2];
        pkt = ret[3];

        return libav.ff_init_muxer({filename: "tmp2.webm", open: true}, [[c, 1, 1000]]);

    }).then(function(ret) {
        oc = ret[0];
        fmt = ret[1];
        pb = ret[2];
        st = ret[3];

        return libav.avformat_write_header(oc, 0);

    }).then(function() {
        return libav.ff_encode_multi(c, frame, pkt, frames, true);

    }).then(function(packets) {
        return libav.ff_write_multi(oc, pkt, packets);

    }).then(function() {
        return libav.av_write_trailer(oc);

    }).then(function() {
        return Promise.all([
            libav.ff_free_muxer(oc, pb),
            libav.ff_free_encoder(c, frame, pkt)
        ]);

    }).then(function() {
        return libav.readFile("tmp2.webm");

    }).then(function(ret) {
        if (typeof document !== "undefined") {
            var blob = new Blob([ret.buffer]);
            var a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.innerText = "WebM";
            document.body.appendChild(a);

        } else {
            fs.writeFileSync("out.webm", ret);

        }

        print("Done");

    }).catch(function(err) {
        print(err + "");
    });
}

main();
