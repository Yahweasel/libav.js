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
    let inp = await fs.readFile("src/frontend.in.js", "utf8");
    const components = (
        await fs.readFile(`configs/configs/${variant}/components.txt`, "utf8")
    ).trim().split("\n");

    let normalFuncs = [];
    let localFuncs = [];

    for (const component of components) {
        const fc = funcs[component];

        for (const decl of fc.functions)
            normalFuncs.push(decl[0]);

        for (const decl of (fc.fs || []))
            localFuncs.push(decl);

        for (const decl of (fc.meta || []))
            normalFuncs.push(decl);

        for (const accFamily of (fc.accessors || [])) {
            const klass = accFamily[0];
            for (let acc of accFamily[1]) {
                if (typeof acc === "string")
                    acc = {name: acc};
                const pf = `${klass}_${acc.name}`;
                if (acc.array) {
                    normalFuncs.push(`${pf}_a`, `${pf}_a_s`)
                } else if (acc.rational) {
                    normalFuncs.push(
                        `${pf}_num`, `${pf}_den`,
                        `${pf}_num_s`, `${pf}_den_s`,
                        `${pf}_s`
                    );
                } else if (acc.string) {
                    normalFuncs.push(pf);
                } else {
                    normalFuncs.push(pf, `${pf}_s`);
                }
            }
        }

        for (const decl of (fc.freers || []))
            normalFuncs.push(`${decl}_js`);

        for (const copier of (fc.copiers || [])) {
            const type = copier[0];
            localFuncs.push(`copyin_${type}`, `copyout_${type}`);
        }
    }

    let out = inp
        .replace(/@VARIANT/g, variant)
        .replace("@FUNCS", JSON.stringify(normalFuncs))
        .replace("@LOCALFUNCS", JSON.stringify(localFuncs))
        .replace(/@VER/g, version);

    if (jsSuffix === "mjs") {
        out = out
            .replace(/\n(@E5.*\n)+/g, "\n")
            .replace(/\n@E6 /g, "\n");
    } else {
        out = out
            .replace(/\n@E5 /g, "\n")
            .replace(/\n(@E6.*\n)+/g, "\n");
    }

    process.stdout.write(out);
}

main();
