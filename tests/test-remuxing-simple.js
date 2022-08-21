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
    var fmt_ctx, streams, stream, video_stream_idx, pkt, frame, codec, c, packets;
    var oc, fmt, pb, st;

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

        var si;
        for (si = 0; si < streams.length; si++) {
            stream = streams[si];
            if (stream.codec_type === libav.AVMEDIA_TYPE_VIDEO)
                break;
        }
        if (si >= streams.length)
            throw new Error("Couldn't find video stream");

        video_stream_idx = stream.index;
        return libav.ff_init_decoder(stream.codec_id);

    }).then(function(ret) {
        c = ret[1];
        pkt = ret[2];
        frame = ret[3];

        return libav.ff_read_multi(fmt_ctx, pkt);

    }).then(function(ret) {
        if (ret[0] !== libav.AVERROR_EOF)
            throw new Error("Error reading: " + ret[0]);

        packets = ret[1][video_stream_idx];
        return libav.ff_decode_multi(c, pkt, frame, packets, true);

    }).then(function(ret) {
        /* We don't actually care about the decoded video, we just needed to
         * decode a bit to get the codec context in place */
        return libav.ff_init_muxer({filename: "tmp.ogg", open: true}, [[c, stream.time_base_num, stream.time_base_den]]);

    }).then(function(ret) {
        oc = ret[0];
        fmt = ret[1];
        pb = ret[2];
        st = ret[3][0];

        return libav.avformat_write_header(oc, 0)

    }).then(function() {
        // Create a gap by writing the first packet at the beginning first...
        return libav.ff_write_multi(oc, pkt, packets.slice(0, 1));

    }).then(function() {
        // But then writing it, and everything else, much later
        var skip = 2 * ~~(stream.time_base_den / stream.time_base_num);
        packets.forEach(function(packet) {
            packet.dts += skip;
            packet.pts += skip;
        });
        return libav.ff_write_multi(oc, pkt, packets);

    }).then(function() {
        return libav.av_write_trailer(oc);

    }).then(function() {
        return Promise.all([
            libav.ff_free_decoder(c, pkt, frame),
            libav.avformat_close_input_js(fmt_ctx),
            libav.ff_free_muxer(oc, pb)
        ]);

    }).then(function() {
        return libav.readFile("tmp.ogg");

    }).then(function(ret) {
        if (typeof document !== "undefined") {
            var blob = new Blob([ret.buffer]);
            var a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.innerText = "OGG";
            document.body.appendChild(a);

        } else {
            fs.writeFileSync("out.ogg", ret);

        }

        print("Done");

    }).catch(function(err) {
        print(err + "");
    });
}

main();
