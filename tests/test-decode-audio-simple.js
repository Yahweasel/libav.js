if (typeof process !== "undefined") {
    // Node.js
    LibAV = require("../libav-2.0.4.3.1-default.js");
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
function main() {
    var libav;
    var pkt, frame, codec, c;

    LibAV.LibAV().then(function(ret) {
        libav = ret;
        return libav.ff_init_decoder("libopus");

    }).then(function(ret) {
        codec = ret[0];
        c = ret[1];
        pkt = ret[2];
        frame = ret[3];

        // Reformat the packets
        var tmpPackets = OpusExa.map(function(p) {
            return {data: p};
        });

        // Decode them
        return libav.ff_decode_multi(c, pkt, frame, tmpPackets, true);

    }).then(function(ret) {
        /*print("[\n" +
            ret.map(function(pkt) {
                return "new Uint8Array([" + Array.prototype.join.call(pkt.data, ", ") + "])";
            }).join(",\n") +
            "\n]");*/

        return libav.ff_free_decoder(c, pkt, frame);

    }).then(function() {
        print("Done");

    }).catch(function(err) {
        print(err + "");
    });
}

main();
