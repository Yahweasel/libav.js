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

        const [fmt_ctx, streams] = await libav.ff_init_demuxer_file("tmp.webm");

        let codecs = [];

        let si, stream;
        for (si = 0; si < streams.length; si++)
            codecs.push(libav.avcodec_get_name(streams[si].codec_id));

        codecs = await Promise.all(codecs);

        for (si = 0; si < codecs.length; si++)
            print("Stream " + si + ": " + codecs[si]);

        await libav.avformat_close_input_js(fmt_ctx)

        print("Done");

    } catch(err) {
        print(err + "");
    }
}

main();
