if (typeof process !== "undefined") {
    // Node.js
    LibAV = require("../libav-3.0.4.4-default.js");
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

/* This is a port of doc/examples/encode_audio.c, simplified with
 * some metafunctions. Note that this version isn't just easier on
 * the eyes, it's faster. */
function main() {
    var libav;
    var codec, c, pkt, frame, frame_size;

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

        var t = 0;
        var tincr = 2 * Math.PI * 440 / 48000;
        var pts = 0;
        var frames = [];

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

        return libav.ff_encode_multi(c, frame, pkt, frames, true);

    }).then(function(ret) {
        /*print("[\n" +
            ret.map(function(pkt) {
                return "new Uint8Array([" + Array.prototype.join.call(pkt.data, ", ") + "])";
            }).join(",\n") +
            "\n]");*/

        return libav.ff_free_encoder(c, frame, pkt);

    }).then(function() {
        print("Done");

    }).catch(function(err) {
        print(err + "");
    });
}

main();
