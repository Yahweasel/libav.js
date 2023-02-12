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

async function main() {
    try {
        const libav = await LibAV.LibAV(LibAV.opts);

        let buf;
        if (typeof XMLHttpRequest !== "undefined") {
            var xhr = new XMLHttpRequest();
            xhr.responseType = "arraybuffer";
            xhr.open("GET", "exa.m4a", true);

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
            buf = fs.readFileSync("exa.m4a").buffer;

        }

        await libav.writeFile("tmp.m4a", new Uint8Array(buf));

        const [fmt_ctx, streams] = await libav.ff_init_demuxer_file("tmp.m4a");

        let si, stream;
        for (si = 0; si < streams.length; si++) {
            stream = streams[si];
            if (stream.codec_type === libav.AVMEDIA_TYPE_AUDIO)
                break;
        }
        if (si >= streams.length)
            throw new Error("Couldn't find audio stream");

        audio_stream_idx = stream.index;
        const [, c, pkt, frame] =
            await libav.ff_init_decoder(stream.codec_id, stream.codecpar);

        const [res, packets] = await libav.ff_read_multi(fmt_ctx, pkt);

        if (res !== libav.AVERROR_EOF)
            throw new Error("Error reading: " + res);

        const frames =
            await libav.ff_decode_multi(c, pkt, frame,
                packets[audio_stream_idx], true);

        /*print("[\n" +
            frames.map(function(pkt) {
                return "new Uint8Array([" + Array.prototype.join.call(pkt.data, ", ") + "])";
            }).join(",\n") +
            "\n]");*/

        await libav.ff_free_decoder(c, pkt, frame);
        await libav.avformat_close_input_js(fmt_ctx)

        print("Done");

    } catch (err) {
        print(err + "");
    }
}

main();
