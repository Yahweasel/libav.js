if (typeof process !== "undefined") {
    // Node.js
    LibAV = require("./libav.js")();
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

/* This is a port of doc/examples/muxing.c, simplified */
async function main() {
    try {
        const libav = await LibAV.LibAV(LibAV.opts);

        const [codec, c, frame, pkt, frame_size] =
        await libav.ff_init_encoder("libopus", {
            ctx: {
                bit_rate: 128000,
                sample_fmt: libav.AV_SAMPLE_FMT_FLT,
                sample_rate: 48000,
                channel_layout: 4,
                channels: 1
            },
            time_base: [1, 48000]
        });

        const [oc, fmt, pb, [st]] = await libav.ff_init_muxer(
            {filename: "tmp.ogg", open: true}, [[c, 1, 48000]]);

        await libav.avformat_write_header(oc, 0)

        let t = 0;
        let tincr = 2 * Math.PI * 440 / 48000;
        let pts = 0;
        let frames = [];

        for (let i = 0; i < 200; i++) {
            let samples = [];

            for (let j = 0; j < frame_size; j++) {
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

        const packets =
            await libav.ff_encode_multi(c, frame, pkt, frames, true);

        await libav.ff_write_multi(oc, pkt, packets);

        await libav.av_write_trailer(oc);

        await libav.ff_free_muxer(oc, pb);
        await libav.ff_free_encoder(c, frame, pkt);

        const out = await libav.readFile("tmp.ogg");

        if (typeof document !== "undefined") {
            var blob = new Blob([out.buffer]);
            var a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.innerText = "Opus";
            document.body.appendChild(a);

        } else {
            fs.writeFileSync("out.opus", out);

        }

        print("Done");

    } catch(err) {
        print(err + "");
    }
}

main();
