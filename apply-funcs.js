#!/usr/bin/env node
/*
 * Copyright (C) 2019-2023 Yahweasel and contributors
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
const funcs = JSON.parse(fs.readFileSync("funcs.json", "utf8"));
const doxygen = JSON.parse(fs.readFileSync("mk/doxygen.json", "utf8"));

function s(x) {
    return JSON.stringify(x);
}

function accessors(f) {
    funcs.accessors.forEach((type) => {
        type[1].forEach((field) => {
            if (typeof field === "object")
                f(type[0] + "_" + field.name + "_a", field);
            else
                f(type[0] + "_" + field, null);
        });
    });
}

function decls(f, meta) {
    funcs.functions.forEach((decl) => {
        f(decl[0], "func");
    });
    accessors((decl) => {
        f(decl, "getter");
        f(decl+"_s", "setter");
    });
    if (meta) {
        funcs.fs.forEach((decl) => {
            f(decl, "fs");
        });
        funcs.meta.forEach((decl) => {
            f(decl, "meta");
        });
        funcs.freers.forEach((decl) => {
            f(decl + "_js", "freer");
        });
        funcs.copiers.forEach((type) => {
            f("copyin_" + type[0], "copyin");
            f("copyout_" + type[0], "copyout");
        });
    }
}

// post.js
(function() {
    var inp = fs.readFileSync("post.in.js", "utf8");

    var outp = "";
    funcs.functions.forEach((decl) => {
        outp += `var ${decl[0]} = ` +
            `Module.${decl[0]} = ` +
            `CAccessors.${decl[0]} = ` +
            `Module.cwrap(${s(decl[0])}, ${s(decl[1])}, ${s(decl[2])}`;
        if (decl[3] && decl[3].async)
            outp += `, {async:true}`;
        outp += ");\n";
    });
    accessors((decl, field) => {
        if (field && field.array) {
            outp += `var ${decl} = ` +
                `Module.${decl} = ` +
                `CAccessors.${decl} = ` +
                `Module.cwrap(${s(decl)}, "number", ["number", "number"]);\n` +
                `var ${decl}_s = ` +
                `Module.${decl}_s = ` +
                `CAccessors.${decl}_s = ` +
                `Module.cwrap(${s(decl+"_s")}, null, ["number", "number", "number"]);\n`;

        } else {
            outp += `var ${decl} = ` +
                `Module.${decl} = ` +
                `CAccessors.${decl} = ` +
                `Module.cwrap(${s(decl)}, "number", ["number"]);\n` +
                `var ${decl}_s = ` +
                `Module.${decl}_s = ` +
                `CAccessors.${decl}_s = ` +
                `Module.cwrap(${s(decl+"_s")}, null, ["number", "number"]);\n`;
        }
    });

    funcs.freers.forEach((decl) => {
        outp += `var ${decl}_js = ` +
            `Module.${decl}_js = ` +
            `CAccessors.${decl}_js = ` +
            "function(p) { " +
            "var p2 = malloc(4); " +
            "if (p2 === 0) throw new Error(\"Could not malloc\"); " +
            "(new Uint32Array(Module.HEAPU8.buffer, p2, 1))[0] = p; " +
            `CAccessors.${decl}(p2); ` +
            "free(p2); " +
            "};\n";
    });

    funcs.copiers.forEach((type) => {
        outp += `var copyin_${type[0]} = ` +
            `Module.copyin_${type[0]} = ` +
            `CAccessors.copyin_${type[0]} = ` +
            "function(ptr, arr) { " +
            `var buf = new ${type[1]}(Module.HEAPU8.buffer, ptr); ` +
            "buf.set(arr); " +
            "};\n" +
            `var copyout_${type[0]} = ` +
            `Module.copyout_${type[0]} = ` +
            `CAccessors.copyout_${type[0]} = ` +
            "function(ptr, len) { " +
            `return (new ${type[1]}(Module.HEAPU8.buffer, ptr, len)).slice(0); ` +
            "};\n";
    });

    outp = inp.replace("@FUNCS", outp);

    fs.writeFileSync("build/post.js", outp);
})();

// libav.types.d.ts
(function() {
    var inp = fs.readFileSync("libav.types.in.d.ts", "utf8");

    let outp = "", syncp = "";

    function ret(x) {
        return (x === null) ? "void" : x;
    }

    function signature(name, args, ret, async) {
        outp += `${name}(${args}): Promise<${ret}>;\n`;
        if (async)
            syncp += `${name}_sync(${args}): ${ret} | Promise<${ret}>;\n`;
        else
            syncp += `${name}_sync(${args}): ${ret};\n`;
    }

    funcs.functions.forEach((decl) => {
        const nm = decl[0];
        const noJSName = nm.replace(/_js$/, "");
        const doc = doxygen[noJSName];
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
        if (doc && doc.briefdescription && doc.briefdescription.para) {
            let desc = doc.briefdescription.para;
            if (typeof desc === "object") {
                if (desc["#text"] && typeof desc["#text"] === "string")
                    desc = desc["#text"];
                else
                    desc = JSON.stringify(desc);
            } else if (typeof desc !== "string")
                desc = JSON.stringify(desc);
            outp += `/**\n * ${desc}\n */\n`;
            syncp += `/**\n * ${desc}\n */\n`;
        }

        signature(decl[0], args, ret(decl[1]), decl[3] && decl[3].async);
    });
    accessors((decl, field) => {
        if (field && field.array) {
            signature(decl, "ptr: number, idx: number", "number");
            signature(`${decl}_s`, "ptr: number, idx: number, val: number",
                "void");
        } else {
            signature(decl, "ptr: number", "number");
            signature(`${decl}_s`, "ptr: number, val: number", "void");
        }
    });

    funcs.freers.forEach((decl) => {
        signature(`${decl}_js`, "ptr: number", "void");
    });

    funcs.copiers.forEach((type) => {
        signature(`copyin_${type[0]}`, `ptr: number, arr: ${type[1]}`, "void");
        signature(`copyout_${type[0]}`, "ptr: number, len: number", type[1]);
    });

    inp = inp.replace("@FUNCS", outp).replace("@SYNCFUNCS", syncp);

    /* We also read type declarations out of post.in.js, to keep all the decls
     * in one place */
    outp = "";
    syncp = "";
    let lastComment = "";
    let inComment = false;
    let lastTypes = "";
    let inTypes = false;

    function commentType(decl) {
        let async = decl.replace(/@sync/g, "")
            .replace(/@promise@([^@]*)@/g, "Promise<$1>")
            .replace(/@promsync@([^@]*)@/g, "Promise<$1>");
        let syncy = decl
            .replace(/@sync/g, "_sync")
            .replace(/@promise@([^@]*)@/g, "$1")
            .replace(/@promsync@([^@]*)@/g, "$1 | Promise<$1>");
        outp += async + ";\n";
        syncp += syncy + ";\n";
    }

    for (const line of fs.readFileSync("post.in.js", "utf8").split("\n")) {
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
    outp = inp.replace("@DECLS", outp).replace("@SYNCDECLS", syncp);

    fs.writeFileSync("dist/libav.types.d.ts", outp);
})();

// libav.js
(function() {
    var ver = process.argv[2];
    var inp = fs.readFileSync("libav.in.js", "utf8");

    var normalFuncs = [];
    var localFuncs = [];
    decls((decl, type) => {
        if (type === "fs" || type === "copyin" || type === "copyout")
            localFuncs.push(decl);
        else
            normalFuncs.push(decl);
    }, true);

    outp = inp
        .replace("@FUNCS", s(normalFuncs))
        .replace("@LOCALFUNCS", s(localFuncs))
        .replace(/@VER/g, ver);

    fs.writeFileSync("build/libav-" + ver + ".js", outp);
})();

// exports.json
(function() {
    var outp = [];
    decls((decl) => {
        outp.push("_" + decl);
    });

    fs.writeFileSync("build/exports.json", s(outp));
})();
