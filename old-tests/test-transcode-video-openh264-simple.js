if (typeof process !== "undefined") {
    // Node.js
    LibAV = require("./libav.js")("mediarecorder-openh264");
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

async function main() {
    try {
        const libav = await LibAV.LibAV(LibAV.opts);

        let buf;
        if (typeof XMLHttpRequest !== "undefined") {
            var xhr = new XMLHttpRequest();
            xhr.responseType = "arraybuffer";
            xhr.open("GET", "exa.webm", true);

            buf = await new Promise((res, rej) => {
                xhr.onreadystatechange = function() {
                    if (xhr.readyState === 4) {
                        if (xhr.status === 200)
                            res(xhr.response);
                        else
                            rej(xhr.status);
                    }
                };

                xhr.send();
            });

        } else {
            buf = fs.readFileSync("exa.webm").buffer;

        }

        await libav.writeFile("tmp.webm", new Uint8Array(buf));

        const [fmt_ctx, streams] = await libav.ff_init_demuxer_file("tmp.webm");

        let si, stream;
        for (si = 0; si < streams.length; si++) {
            stream = streams[si];
            if (stream.codec_type === libav.AVMEDIA_TYPE_VIDEO)
                break;
        }
        if (si >= streams.length)
            throw new Error("Couldn't find video stream");

        const video_stream_idx = stream.index;
        let [, c, pkt, frame] =
            await libav.ff_init_decoder(stream.codec_id, stream.codecpar);

        let [res, packets] =
            await libav.ff_read_multi(fmt_ctx, pkt);

        if (res !== libav.AVERROR_EOF)
            throw new Error("Error reading: " + res);

        const frames = await libav.ff_decode_multi(c, pkt, frame,
            packets[video_stream_idx], true);

        await libav.ff_free_decoder(c, pkt, frame);
        await libav.avformat_close_input_js(fmt_ctx);

        let codec;
        [codec, c, frame, pkt] =
        await libav.ff_init_encoder("libopenh264", {
            ctx: {
                bit_rate: 1000000,
                pix_fmt: frames[0].format,
                width: frames[0].width,
                height: frames[0].height
            }
        });

        // We can't use arbitrary timebases for MP4, so scale to 1/16K
        for (const frame of frames)
            frame.pts *= 16;

        const [oc, fmt, pb, st] = await libav.ff_init_muxer(
            {filename: "tmp.mp4", open: true}, [[c, 1, 16000]]);

        await libav.avformat_write_header(oc, 0);

        packets =
            await libav.ff_encode_multi(c, frame, pkt, frames, true);

        await libav.ff_write_multi(oc, pkt, packets);

        await libav.av_write_trailer(oc);

        await libav.ff_free_muxer(oc, pb);
        await libav.ff_free_encoder(c, frame, pkt);

        const out = await libav.readFile("tmp.mp4");

        if (typeof document !== "undefined") {
            var blob = new Blob([out.buffer]);
            var a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.innerText = "MP4";
            document.body.appendChild(a);

        } else {
            fs.writeFileSync("out.mp4", out);

        }

        print("Done");

    } catch(err) {
        print(err + "");
    }
}

main();
