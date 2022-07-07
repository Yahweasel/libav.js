if (typeof process !== "undefined") {
    // Node.js
    LibAV = require("../libav-3.7.5.0.1-webm.js");
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
