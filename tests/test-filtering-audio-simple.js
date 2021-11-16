if (typeof process !== "undefined") {
    // Node.js
    LibAV = require("../libav-3.1.4.4-default.js");
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

/* This is sort of a port of doc/examples/filtering_audio.c, but
 * with fixed input and output formats, simplified */
function main() {
    var libav;
    var oc, fmt, codec, c, frame, pkt, st, pb, frame_size;
    var filter_graph, buffersrc_ctx, buffersink_ctx;

    LibAV.LibAV().then(function(ret) {
        libav = ret;

        return libav.ff_init_encoder("libopus", {
            ctx: {
                bit_rate: 128000,
                sample_fmt: libav.AV_SAMPLE_FMT_FLT,
                sample_rate: 48000,
                channel_layout: 4,
                channels: 1
            },
            time_base: [1, 48000]
        });

    }).then(function(ret) {
        codec = ret[0];
        c = ret[1];
        frame = ret[2];
        pkt = ret[3];
        frame_size = ret[4];

        return libav.ff_init_muxer({filename: "tmp.ogg", open: true}, [[c, 1, 48000]]);

    }).then(function(ret) {
        oc = ret[0];
        fmt = ret[1];
        pb = ret[2];
        st = ret[3][0];

        return Promise.all([
            libav.avformat_write_header(oc, 0),
            libav.ff_init_filter_graph("atempo=0.5,volume=0.1", {
                sample_rate: 48000,
                sample_fmt: libav.AV_SAMPLE_FMT_FLT,
                channel_layout: 4
            }, {
                sample_rate: 48000,
                sample_fmt: libav.AV_SAMPLE_FMT_FLT,
                channel_layout: 4,
                frame_size: frame_size
            })
        ]);

    }).then(function(ret) {
        var t = 0;
        var tincr = 2 * Math.PI * 440 / 48000;
        var pts = 0;
        var frames = [];

        filter_graph = ret[1][0];
        buffersrc_ctx = ret[1][1];
        buffersink_ctx = ret[1][2];

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

        return libav.ff_filter_multi(buffersrc_ctx, buffersink_ctx, frame, frames, true);

    }).then(function(frames) {
        return libav.ff_encode_multi(c, frame, pkt, frames, true);

    }).then(function(packets) {
        return libav.ff_write_multi(oc, pkt, packets);

    }).then(function() {
        return libav.av_write_trailer(oc);

    }).then(function() {
        return libav.avfilter_graph_free_js(filter_graph);

    }).then(function() {
        return libav.ff_free_muxer(oc, pb);

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
        print(err + "\n" + err.stack);
    });
}

main();
