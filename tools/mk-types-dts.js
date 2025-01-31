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
    let inp = await fs.readFile("src/libav.types.in.d.ts", "utf8");
    let asyncOut = "", syncOut = "";
    const doxygen = JSON.parse(await fs.readFile("mk/doxygen.json", "utf8"));

    function paramNames() {
        return {
            doc: {
                param: Array.from(arguments).map(x => ({declname: x}))
            }
        };
    }

    function commentType(decl) {
        let async = decl.replace(/@sync/g, "")
            .replace(/@promise@([^@]*)@/g, "Promise<$1>")
            .replace(/@promsync@([^@]*)@/g, "Promise<$1>");
        let syncy = decl
            .replace(/@sync/g, "_sync")
            .replace(/@promise@([^@]*)@/g, "$1")
            .replace(/@promsync@([^@]*)@/g, "$1 | Promise<$1>");
        asyncOut += async + ";\n";
        syncOut += syncy + ";\n";
    }

    for (const component in funcs) {
        const fc = funcs[component];

        // Convert accessors into function declarations
        for (const accFamily of (fc.accessors || [])) {
            const klass = accFamily[0];
            for (let acc of accFamily[1]) {
                if (typeof acc === "string")
                    acc = {name: acc};
                const pf = `${klass}_${acc.name}`;
                if (acc.array) {
                    fc.functions.push(
                        [
                            `${pf}_a`, "number", ["number", "number"],
                            paramNames("ptr", "idx")
                        ],
                        [
                            `${pf}_a_s`, null, ["number", "number", "number"],
                            paramNames("ptr", "idx", "val")
                        ]
                    );

                } else if (acc.rational) {
                    fc.functions.push(
                        [
                            `${pf}_num`, "number", ["number"],
                            paramNames("ptr")
                        ],
                        [
                            `${pf}_den`, "number", ["number"],
                            paramNames("ptr")
                        ],
                        [
                            `${pf}_num_s`, "number", ["number", "number"],
                            paramNames("ptr", "val")
                        ],
                        [
                            `${pf}_den_s`, "number", ["number", "number"],
                            paramNames("ptr", "val")
                        ],
                        [
                            `${pf}_s`, "number", ["number", "number", "number"],
                            paramNames("ptr", "num", "den")
                        ]
                    );

                } else if (acc.string) {
                    fc.functions.push(
                        [
                            pf, "string", ["number"],
                            paramNames("ptr")
                        ]
                    );

                } else {
                    fc.functions.push(
                        [
                            pf, "number", ["number"],
                            paramNames("ptr")
                        ]
                    );
                    fc.functions.push(
                        [
                            `${pf}_s`, null, ["number", "number"],
                            paramNames("ptr", "val")
                        ]
                    );

                }
            }
        }

        // Convert freers to function declarations
        for (const freer of (fc.freers || [])) {
            fc.functions.push([
                `${freer}_js`, null, ["number"],
                paramNames("ptr")
            ]);
        }

        // Convert copiers to function declarations
        for (const copier of (fc.copiers || [])) {
            const type = copier[0];
            const typedArr = copier[1];
            fc.functions.push(
                [
                    `copyin_${type}`, null, ["number", typedArr],
                    paramNames("ptr", "arr")
                ],
                [
                    `copyout_${type}`, typedArr, ["number", "number"],
                    paramNames("ptr", "len")
                ]
            );
        }

        // Convert declarations to types
        for (const decl of fc.functions) {
            if (decl[3] && decl[3].notypes)
                continue;

            const nm = decl[0];
            const noJSName = nm.replace(/_js$/, "");
            const doc = (decl[3] && decl[3].doc) ? decl[3].doc : doxygen[noJSName];
            let args;
            if (doc && doc.param) {
                // Try to make the parameters names match the real names
                let param = doc.param;
                if (!(param instanceof Array))
                    param = [param];

                args = decl[2].map((t, idx) => {
                    if (param[idx])
                        return `${param[idx].declname}: ${t}`;
                    return `a${idx}: ${t}`;
                }).join(",");

            } else {
                args = decl[2].map((t, idx) => `a${idx}: ${t}`).join(",");

            }

            // Give the function description
            if (doc && doc.raw) {
                // The raw description was retrieved from the file
                asyncOut += doc.raw + "\n";
                syncOut += doc.raw + "\n";

            } else if (doc && doc.briefdescription && doc.briefdescription.para) {
                let desc = doc.briefdescription.para;
                if (typeof desc === "object") {
                    if (desc["#text"] && typeof desc["#text"] === "string")
                        desc = desc["#text"];
                    else
                        desc = JSON.stringify(desc);
                } else if (typeof desc !== "string")
                    desc = JSON.stringify(desc);
                asyncOut += `/**\n * ${desc}\n */\n`;
                syncOut += `/**\n * ${desc}\n */\n`;
            }

            const ret = decl[1] || "void";
            asyncOut += `${decl[0]}(${args}): Promise<${ret}>;\n`;
            syncOut += `${decl[0]}_sync(${args}): ${ret}`;
            if (decl[3] && decl[3].async)
                syncOut += ` | Promise<${ret}>`;
            syncOut += ";\n";
        }

        // Convert post.js components
        let postJs = null;
        if (component === "c")
            postJs = "post";
        else if (fc.post)
            postJs = `p-${component}`;
        if (postJs) {
            let lastComment = "";
            let inComment = false;
            let lastTypes = "";
            let inTypes = false;
            const lines = (await fs.readFile(`src/${postJs}.in.js`, "utf8")).split("\n");

            for (const line of lines) {
                if (line === "/**") {
                    inComment = true;
                    lastComment = line + "\n";
                } else if (inComment) {
                    lastComment += line + "\n";
                    if (line === " */")
                        inComment = false;
                } else if (line === "/* @types") {
                    inTypes = true;
                    lastTypes = "";
                } else if (inTypes) {
                    if (line === " */") {
                        inTypes = false;
                        commentType(lastComment + lastTypes.trim());
                    } else {
                        lastTypes += line.slice(3) + "\n";
                    }
                } else if (line.slice(0, 10) === "/// @types") {
                    commentType(lastComment + line.slice(11));
                }
            }
        }
    }

    const out = inp.replace("@FUNCS", asyncOut).replace("@SYNCFUNCS", syncOut);

    process.stdout.write(out);
}

main();
