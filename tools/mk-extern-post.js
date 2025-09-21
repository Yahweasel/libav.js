#!/usr/bin/env node
/*
 * Copyright (C) 2019-2025 Yahweasel and contributors
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

async function main() {
    const jsSuffix = process.argv[2];

    const inp = await fs.readFile("src/extern-post.in.js", "utf8");

    let out;
    if (jsSuffix === "mjs") {
        out = inp
            .replace(/\n(@E5.*\n)+/g, "\n")
            .replace(/\n@E6 /g, "\n");
    } else {
        out = inp
            .replace(/\n@E5 /g, "\n")
            .replace(/\n(@E6.*\n)+/g, "\n");
    }

    process.stdout.write(out);
}

main();
