if (typeof process !== "undefined") {
    // Node.js
    LibAV = require("./libav.js")();
    fs = require("fs");
    OpusExa = Function(fs.readFileSync("exa.opus.js", "utf8") + "return OpusExa;")();
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

/* This is sort of a port of doc/examples/decode_audio.c, but with
 * no demuxing, and with Opus */
async function main() {
    try {
        const libav = await LibAV.LibAV(LibAV.opts);
        const [codec, c, pkt, frame] = await libav.ff_init_decoder("libopus");

        // Reformat the packets
        const tmpPackets = OpusExa.map(function(p) {
            return {data: p};
        });

        // Decode them
        const packets = libav.ff_decode_multi(c, pkt, frame, tmpPackets, true);

        /*print("[\n" +
            packets.map(function(pkt) {
                return "new Uint8Array([" + Array.prototype.join.call(pkt.data, ", ") + "])";
            }).join(",\n") +
            "\n]");*/

        await libav.ff_free_decoder(c, pkt, frame);

        print("Done");

    } catch (err) {
        print(err + "");

    }
}

main();
