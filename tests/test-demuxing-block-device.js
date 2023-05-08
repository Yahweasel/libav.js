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
            xhr.open("GET", "exa.opus", true);

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
            buf = fs.readFileSync("exa.opus").buffer;

        }

        buf = new Uint8Array(buf);
        let rd = 0;
        await libav.mkblockreaderdev("tmp.opus", buf.length);

        libav.onblockread = async function(name, position, length) {
            libav.ff_block_reader_dev_send(name, position, buf.slice(position, position + length));
        };

        const [fmt_ctx, streams] = await libav.ff_init_demuxer_file("tmp.opus");

        let si, stream;
        for (si = 0; si < streams.length; si++) {
            stream = streams[si];
            if (stream.codec_type === libav.AVMEDIA_TYPE_AUDIO)
                break;
        }
        if (si >= streams.length)
            throw new Error("Couldn't find audio stream");

        audio_stream_idx = stream.index;
        const [, c, pkt, frame] = await libav.ff_init_decoder(stream.codec_id);

        let packets = [];
        while (true) {
            const [res, rdPackets] =
                await libav.ff_read_multi(fmt_ctx, pkt, null, {limit: 1024 * 1024});

            if (audio_stream_idx in rdPackets) {
                packets = packets.concat(rdPackets[audio_stream_idx]);
                continue;
            }

            if (res === libav.AVERROR_EOF) {
                // Done!
                break;

            } else if (res !== -libav.EAGAIN) {
                throw new Error("Error reading: " + res);

            }
        }

        const frames = await libav.ff_decode_multi(c, pkt, frame, packets, true);

        /*print("[\n" +
            frames.map(function(pkt) {
                return "new Uint8Array([" + Array.prototype.join.call(pkt.data, ", ") + "])";
            }).join(",\n") +
            "\n]");*/

        await libav.ff_free_decoder(c, pkt, frame);
        await libav.avformat_close_input_js(fmt_ctx);

        print("Done");

    } catch(err) {
        print(err.stack + "");
    }
}

main();
