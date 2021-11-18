#!/usr/bin/env node
/*
 * Copyright (C) 2021 Yahweasel
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
const files = ["deps.txt", "ffmpeg-config.txt", "libs.txt", "link-flags.txt"]; // license.js is special

try {
    fs.mkdirSync(name);
} catch (ex) {}

function exists(f) {
    try {
        fs.accessSync(f);
        return true;
    } catch (ex) {
        return false;
    }
}

(function() {
    // Open the files
    const out = {};
    for (const file of files)
        out[file] = fs.createWriteStream(`${name}/${file}`);
    out["license.js"] = fs.createWriteStream(`${name}/license.js`);

    // Construct the basics
    for (const part of ["default"].concat(parts)) {
        for (const file of files) {
            const inF = `fragments/${part}/${file}`;
            if (exists(inF))
                out[file].write(fs.readFileSync(inF));
        }
        const lh = `fragments/${part}/license-head.js`;
        if (exists(lh))
            out["license.js"].write(fs.readFileSync(lh));
    }

    // Finish the header
    for (const part of parts) {
        const lf = `fragments/${part}/license.js`;
        if (exists(lf))
            out["license.js"].write(fs.readFileSync(lf));
    }
    out["license.js"].write(fs.readFileSync("fragments/default/license-tail.js"));

    // Close everything
    for (const file of files)
        out[file].end();
    out["license.js"].end();
})();
