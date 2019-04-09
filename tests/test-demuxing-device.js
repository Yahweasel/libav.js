if (typeof process !== "undefined") {
    // Node.js
    LibAV = require("../libav-1.3.4.1.3-default.js");
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
    var libav = LibAV;
    var fmt_ctx, streams, audio_stream_idx, pkt, frame, codec, c;
    var buf, rd = 0;
    var packets = [];

    new Promise(function(res, rej) {
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

    }).then(function(ret) {
        // Send the first 64K (NOTE: We know this as a magic number; use a larger buffer!)
        buf = new Uint8Array(ret);
        rd = 32*1024;
        return Promise.all([
            libav.mkreaderdev("tmp.opus"),
            libav.ff_reader_dev_send("tmp.opus", buf.slice(0, rd))
        ]);

    }).then(function(ret) {
        return libav.ff_init_demuxer_file("tmp.opus");

    }).then(function(ret) {
        fmt_ctx = ret[0];
        streams = ret[1];

        var si, stream;
        for (si = 0; si < streams.length; si++) {
            stream = streams[si];
            if (stream.codec_type === libav.AVMEDIA_TYPE_AUDIO)
                break;
        }
        if (si >= streams.length)
            throw new Error("Couldn't find audio stream");

        audio_stream_idx = stream.index;
        return libav.ff_init_decoder(stream.codec_id);

    }).then(function(ret) {
        packets = [];
        c = ret[1];
        pkt = ret[2];
        frame = ret[3];

        return new Promise(function(res, rej) {
            function go() {
                libav.ff_read_multi(fmt_ctx, pkt, "tmp.opus").then(function(ret) {
                    if (audio_stream_idx in ret[1])
                        packets = packets.concat(ret[1][audio_stream_idx]);

                    if (ret[0] === -libav.EAGAIN) {
                        // We need more data!
                        var rdp = rd;
                        rd += 32*1024;
                        libav.ff_reader_dev_send("tmp.opus", buf.slice(rdp, rd)).then(function() {
                            if (rd >= buf.length)
                                libav.ff_reader_dev_send("tmp.opus", null).then(go);
                            else
                                go();
                        });
                        return;
                    }

                    if (ret[0] === libav.AVERROR_EOF) {
                        res();
                        return;
                    }

                    if (ret[0] < 0)
                        throw new Error("Error reading: " + ret[0]);

                    go();
                });
            }

            go();
        });

    }).then(function() {
        return libav.ff_decode_multi(c, pkt, frame, packets, true);

    }).then(function(ret) {
        print("[\n" +
            ret.map(function(pkt) {
                return "new Uint8Array([" + Array.prototype.join.call(pkt.data, ", ") + "])";
            }).join(",\n") +
            "\n]");

        return Promise.all([
            libav.ff_free_decoder(c, pkt, frame),
            libav.avformat_close_input_js(fmt_ctx)
        ]);

    }).then(function() {
        // Nothing

    }).catch(function(err) {
        print(err.stack + "");
    });
}

if (LibAV.ready) {
    main();
} else {
    LibAV.onready = main;
}
