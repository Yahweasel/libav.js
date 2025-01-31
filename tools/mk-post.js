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
    const funcs = JSON.parse(await fs.readFile("funcs.json", "utf8"));
    let inp = await fs.readFile("src/post.in.js", "utf8");
    let out = "";
    const components = (
        await fs.readFile(`configs/configs/${process.argv[2]}/components.txt`, "utf8")
    ).trim().split("\n");

    let parts = [];
    for (const component of components) {
        const fc = funcs[component];
        if (fc.post)
            parts.push(component);

        // Create functions for accessors
        for (const accFamily of (fc.accessors || [])) {
            const klass = accFamily[0];
            for (let acc of accFamily[1]) {
                if (typeof acc === "string")
                    acc = {name: acc};
                const pf = `${klass}_${acc.name}`;
                if (acc.array) {
                    fc.functions.push(
                        [`${pf}_a`, "number", ["number", "number"]],
                        [`${pf}_a_s`, null, ["number", "number", "number"]]
                    );
                } else if (acc.rational) {
                    fc.functions.push(
                        [`${pf}_num`, "number", ["number"]],
                        [`${pf}_den`, "number", ["number"]],
                        [`${pf}_num_s`, null, ["number", "number"]],
                        [`${pf}_den_s`, null, ["number", "number"]],
                        [`${pf}_s`, null, ["number", "number", "number"]]
                    );
                } else if (acc.string) {
                    fc.functions.push(
                        [pf, "string", ["number"]]
                    );
                } else {
                    fc.functions.push(
                        [pf, "number", ["number"]],
                        [`${pf}_s`, null, ["number", "number"]]
                    );
                }
            }
        }

        for (const decl of fc.functions) {
            out += `var ${decl[0]} = ` +
                `Module.${decl[0]} = ` +
                `CAccessors.${decl[0]} = ` +
                `Module.cwrap(${s(decl[0])}, ${s(decl[1])}, ${s(decl[2])}`;
            if (decl[3] && decl[3].async)
                out += ", {async:true}";
            out += ");\n";

            if (decl[3] && decl[3].returnsErrno) {
                // Need to check for ECANCELED, meaning passthru error
                out += `var ${decl[0]}__raw = ${decl[0]}; ` +
                    `${decl[0]} = ` +
                    `Module.${decl[0]} = function() { ` +
                    "var args = arguments; " +
                    `var ret = ${decl[0]}__raw.apply(void 0, args); ` +
                    "if (ret === -11) throw Module.fsThrownError; " +
                    "else if (ret && ret.then) { " +
                      "return ret.then(function(ret) { " +
                        "if (ret === -11) throw Module.fsThrownError; " +
                        "return ret; " +
                      "}); " +
                    "} " +
                    "return ret; " +
                    "};\n";
            }

            if (decl[3] && decl[3].async) {
                // Need to serialize async functions
                out += `Module.${decl[0]} = function() { ` +
                    "var args = arguments; " +
                    "return serially(function() { " +
                    `return ${decl[0]}.apply(void 0, args); ` +
                    "}); " +
                    "};\n";
            }
        }

        for (const freer of (fc.freers || [])) {
            out += `var ${freer}_js = ` +
                `Module.${freer}_js = ` +
                `CAccessors.${freer}_js = ` +
                "function(p) { " +
                "var p2 = malloc(4); " +
                "if (p2 === 0) throw new Error(\"Could not malloc\"); " +
                "(new Uint32Array(Module.HEAPU8.buffer, p2, 1))[0] = p; " +
                `CAccessors.${freer}(p2); ` +
                "free(p2); " +
                "};\n";
        }

        for (const copier of (fc.copiers || [])) {
            const type = copier[0];
            const typedArr = copier[1];
            out += `var copyin_${type} = ` +
                `Module.copyin_${type} = ` +
                `CAccessors.copyin_${type} = ` +
                "function(ptr, arr) { " +
                `var buf = new ${typedArr}(Module.HEAPU8.buffer, ptr); ` +
                "buf.set(arr); " +
                "};\n" +
                `var copyout_${type} = ` +
                `Module.copyout_${type} = ` +
                `CAccessors.copyout_${type} = ` +
                "function(ptr, len) { " +
                `var ret = (new ${typedArr}(Module.HEAPU8.buffer, ptr, len)).slice(0); ` +
                "ret.libavjsTransfer = [ret.buffer]; " +
                "return ret; " +
                "};\n";
        }
    }

    for (const part of parts)
        inp += await fs.readFile(`src/p-${part}.in.js`, "utf8");

    out = inp.replace("@FUNCS", out);

    process.stdout.write(out);
}

main();
