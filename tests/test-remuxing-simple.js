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

        const [fmt_ctx, streams] =
            await libav.ff_init_demuxer_file("tmp.webm");

        let si;
        for (si = 0; si < streams.length; si++) {
            stream = streams[si];
            if (stream.codec_type === libav.AVMEDIA_TYPE_VIDEO)
                break;
        }
        if (si >= streams.length)
            throw new Error("Couldn't find video stream");

        let video_stream_idx = stream.index;
        const [, c, pkt, frame] = await libav.ff_init_decoder(stream.codec_id);

        const [res, allPackets] = await libav.ff_read_multi(fmt_ctx, pkt);

        if (res !== libav.AVERROR_EOF)
            throw new Error("Error reading: " + res);

        const packets = allPackets[video_stream_idx];
        await libav.ff_decode_multi(c, pkt, frame, packets, true);

        /* We don't actually care about the decoded video, we just needed to
         * decode a bit to get the codec context in place */
        const [oc, fmt, pb, [st]] = await libav.ff_init_muxer(
            {filename: "tmp.ogg", open: true},
            [[c, stream.time_base_num, stream.time_base_den]]);

        await libav.avformat_write_header(oc, 0)

        // Create a gap by writing the first packet at the beginning first...
        await libav.ff_write_multi(oc, pkt, packets.slice(0, 1));

        // But then writing it, and everything else, much later
        let skip = 2 * ~~(stream.time_base_den / stream.time_base_num);
        packets.forEach(function(packet) {
            packet.dts += skip;
            packet.pts += skip;
        });
        await libav.ff_write_multi(oc, pkt, packets);

        await libav.av_write_trailer(oc);

        await libav.ff_free_decoder(c, pkt, frame);
        await libav.avformat_close_input_js(fmt_ctx);
        await libav.ff_free_muxer(oc, pb);

        const out = await libav.readFile("tmp.ogg");

        if (typeof document !== "undefined") {
            var blob = new Blob([out.buffer]);
            var a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.innerText = "OGG";
            document.body.appendChild(a);

        } else {
            fs.writeFileSync("out.ogg", out);

        }

        print("Done");

    } catch(err) {
        print(err + "");
        throw err;
    }
}

main();
