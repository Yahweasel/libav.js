#!/usr/bin/env node
/*
 * Copyright (C) 2023 Yahweasel and contributors
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

const fs = require("fs/promises");

const versions = {};
for (let ai = 3; ai < process.argv.length; ai += 2)
    versions[process.argv[ai]] = process.argv[ai+1];
function version(comp) {
    if (!versions[comp]) {
        console.error(`Unrecognized component ${comp}`);
        process.exit(1);
    }
    return versions[comp];
}

async function main() {
    const smap = JSON.parse(await fs.readFile(process.argv[2], "utf8"));
    for (let i = 0; i < smap.sources.length; i++) {
        const orig = smap.sources[i];
        let res = orig;

        if (
            orig === "../../src/bindings.c" ||
            /^\.\.\/\.\.\/src\/b-/.test(orig) ||
            /^\.\.\/\.\.\/build/.test(orig)
        ) {
            // Already a full path
            res = orig.slice(3);

        } else if (
            /^\.\.\/\.\.\/src\/ff/.test(orig) ||
            /^\.\.\/\.\.\/src\/libav/.test(orig) ||
            /^\.\.\/\.\.\/src\/libsw[rs]/.test(orig)
        ) {
            // In ffmpeg
            res = `../build/ffmpeg-${version("ffmpeg")}/` + orig.slice(10);

        } else if (
            /^(\.\.\/)*(opus|libvorbis|libogg|lame|libvpx|openh264|zlib)-/.test(orig)
        ) {
            /* In a package where we already have the right path. Just swap all
             * the ..s for build */
            res = orig.replace(/^(\.\.\/)*/, "../build/");

        } else if (/^\.\.\/\.\.\/vp[89x]_/.test(orig)) {
            // VPX-specific hack
            res = `../build/libvpx-${version("libvpx")}/` + orig.slice(6);

        } else if (/^\.\.\/\.\.\/config\/(aom|av1)/.test(orig)) {
            // AOM-specific hack
            res = `../build/libaom-${version("libaom")}/` + orig.slice(6);

        } else if (
            /cache\/sysroot/.test(orig) ||
            /system\/lib/.test(orig)
        ) {
            // An emscripten file. Nothing we can do with this.

        } else {
            console.error(`Unrecognized source name ${orig}`);
            process.exit(1);
        }

        smap.sources[i] = res;
    }
    await fs.writeFile(process.argv[2], JSON.stringify(smap));
}
main();
