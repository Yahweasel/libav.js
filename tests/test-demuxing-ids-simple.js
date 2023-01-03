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

    LibAV.LibAV(LibAV.opts).then(function(ret) {
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
        var codecs = [];

        var si, stream;
        for (si = 0; si < streams.length; si++)
            codecs.push(libav.avcodec_get_name(streams[si].codec_id));

        return Promise.all(codecs);

    }).then(function(ret) {
        for (var si = 0; si < ret.length; si++)
            print("Stream " + si + ": " + ret[si]);

        libav.avformat_close_input_js(fmt_ctx)

    }).then(function() {
        print("Done");

    }).catch(function(err) {
        print(err + "");
    });
}

main();
