if (typeof process !== "undefined") {
    // Node.js
    LibAV = require("../libav-1.2.4.1.3-default.js");
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
        return libav.writeFile("tmp.opus", new Uint8Array(ret));

    }).then(function() {
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
        c = ret[1];
        pkt = ret[2];
        frame = ret[3];

        return libav.ff_read_multi(fmt_ctx, pkt);

    }).then(function(ret) {
        if (ret[0] !== libav.AVERROR_EOF)
            throw new Error("Error reading: " + ret[0]);

        return libav.ff_decode_multi(c, pkt, frame, ret[1][audio_stream_idx], true);

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
        print(err + "");
    });
}

if (LibAV.ready) {
    main();
} else {
    LibAV.onready = main;
}
