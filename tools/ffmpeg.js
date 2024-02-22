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

const LibAV = require("../dist/libav-all.js");
const fs = require("fs/promises");

async function main() {
    if (process.argv.length < 4) {
        console.error(
            "Use: ffmpeg.js <input file> <output file> [ffmpeg arguments, which must include\n" +
            "     at least -i in -f outformat -y out]\n\n" +
            "Note that the input and output filenames are literally \"in\" and \"out\".\n" +
            "NOTE: This program is just meant for testing purposes. In most cases, it makes\n" +
            "      no sense to use a WebAssembly version of FFmpeg; just use your system's\n" +
            "      version!");
        process.exit(1);
        return;
    }

    const libav = await LibAV.LibAV();
    const inF = process.argv[2];
    const outF = process.argv[3];

    // Prepare for reading
    const inS = await fs.stat(inF);
    await libav.mkblockreaderdev("in", inS.size);
    const inH = await fs.open(inF, "r");
    libav.onblockread = async (name, pos, len) => {
        const rb = Buffer.allocUnsafe(len);
        const rd = await inH.read(rb, 0, len, pos);
        if (rd.bytesRead === 0)
            await libav.ff_block_reader_dev_send(name, pos, null);
        else
            await libav.ff_block_reader_dev_send(name, pos, rb.slice(0, rd.bytesRead));
    };

    // Prepare for writing
    const outH = await fs.open(outF, "w");
    await libav.mkstreamwriterdev("out");
    libav.onwrite = (name, pos, data) => {
        outH.write(Buffer.from(data.slice(0)));
    };

    // Do it
    const ret = await libav.ffmpeg(process.argv.slice(4));

    await inH.close();
    await outH.close();

    process.exit(ret);
}
main();
