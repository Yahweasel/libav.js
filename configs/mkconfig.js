#!/usr/bin/env node
/*
 * Copyright (C) 2021-2024 Yahweasel
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY
 * SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION
 * OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN
 * CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */

const fs = require("fs");
const name = process.argv[2];
const parts = JSON.parse(process.argv[3]);
const files = ["components.txt", "ffmpeg-config.txt", "libs.txt", "license.js", "link-flags.txt"];

try {
    fs.mkdirSync("configs");
} catch (ex) {}
try {
    fs.mkdirSync(`configs/${name}`);
} catch (ex) {}

function exists(f) {
    try {
        fs.accessSync(f);
        return true;
    } catch (ex) {
        return false;
    }
}

function addFragment(out, part) {
    if (exists(`fragments/${part}`)) {
        // Add it directly
        for (const file of files) {
            const inF = `fragments/${part}/${file}`;
            if (exists(inF))
                out[file].write(fs.readFileSync(inF));
        }

        // Add any dependencies
        try {
            const deps = fs.readFileSync(`fragments/${part}/deps.txt`, "utf8").split("\n");
            for (const target of ["base", "thr"]) {
                for (const dep of deps) {
                    if (!dep) continue;
                    out["deps.mk"].write(
                        `build/ffmpeg-$(FFMPEG_VERSION)/build-${target}-${name}/ffbuild/config.mak: ` +
                        dep.replace(/@TARGET/g, target) +
                        "\n"
                    );
                }
            }
        } catch (ex) {}

    } else {
        // Look for meta options
        const res = /^([^-]*)-(.*)$/.exec(part);
        if (!res) {
            console.error(`Unrecognized fragment ${part}!`);
            process.exit(1);
        }

        if (res[1] === "format") {
            // Split into demuxer and muxer
            addFragment(out, `demuxer-${res[2]}`);
            addFragment(out, `muxer-${res[2]}`);

        } else if (res[1] === "codec") {
            // Split into decoder and encoder
            addFragment(out, `decoder-${res[2]}`);
            addFragment(out, `encoder-${res[2]}`);

        } else if (res[1] === "protocol" ||
                   res[1] === "demuxer" ||
                   res[1] === "muxer" ||
                   res[1] === "decoder" ||
                   res[1] === "encoder" ||
                   res[1] === "filter" ||
                   res[1] === "parser" ||
                   res[1] === "bsf") {
            // Just add the ffmpeg config directly
            out["ffmpeg-config.txt"].write(
                `--enable-${res[1]}=${res[2]}\n`);

        } else {
            console.error(`Unrecognized fragment ${part}!`);
            process.exit(1);

        }

    }
}


(function() {
    // Save the parts list
    fs.writeFileSync(`configs/${name}/config.json`, JSON.stringify(parts) + "\n");

    // Open the files
    const out = {};
    for (const file of files.concat(["deps.mk"]))
        out[file] = fs.createWriteStream(`configs/${name}/${file}`);

    // Start the license header
    out["license.js"].write(fs.readFileSync("fragments/default/license-head.js"));

    // Construct the fragments
    for (const part of ["default"].concat(parts)) {
        addFragment(out, part);
    }

    // Finish the header
    out["license.js"].write(fs.readFileSync("fragments/default/license-tail.js"));

    // Close everything
    for (const file of files)
        out[file].end();
})();
