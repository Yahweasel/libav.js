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

const s = JSON.stringify;

async function main() {
    const variant = process.argv[2];
    const version = process.argv[3];
    const jsSuffix = process.argv[4];

    const funcs = JSON.parse(await fs.readFile("funcs.json", "utf8"));
    const exports = ["_emfiberthreads_timeout_expiry"];
    const components = (
        await fs.readFile(`configs/configs/${variant}/components.txt`, "utf8")
    ).trim().split("\n");

    for (const component of components) {
        const fc = funcs[component];

        for (const decl of fc.functions)
            exports.push(`_${decl[0]}`);

        for (const accFamily of (fc.accessors || [])) {
            const klass = accFamily[0];
            for (let acc of accFamily[1]) {
                if (typeof acc === "string")
                    acc = {name: acc};
                const pf = `${klass}_${acc.name}`;
                if (acc.array) {
                    exports.push(`_${pf}_a`, `_${pf}_a_s`)
                } else if (acc.rational) {
                    exports.push(
                        `_${pf}_num`, `_${pf}_den`,
                        `_${pf}_num_s`, `_${pf}_den_s`,
                        `_${pf}_s`
                    );
                } else if (acc.string) {
                    exports.push(`_${pf}`);
                } else {
                    exports.push(`_${pf}`, `_${pf}_s`);
                }
            }
        }

        for (const decl of (fc.freers || []))
            exports.push(`_${decl}`);
    }

    process.stdout.write(JSON.stringify(exports));
}

main();
