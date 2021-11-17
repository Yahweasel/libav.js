#!/usr/bin/env node
const fs = require("fs");
const funcs = JSON.parse(fs.readFileSync("funcs.json", "utf8"));

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
        f(decl[0]);
    });
    accessors((decl) => {
        f(decl);
        f(decl+"_s");
    });
    if (meta) {
        funcs.meta.forEach((decl) => {
            f(decl);
        });
        funcs.freers.forEach((decl) => {
            f(decl + "_js");
        });
        funcs.copiers.forEach((type) => {
            f("copyin_" + type[0]);
            f("copyout_" + type[0]);
        });
    }
}

// post.js
(function() {
    var inp = fs.readFileSync("post.in.js", "utf8");

    var outp = "";
    funcs.functions.forEach((decl) => {
        outp += "var " + decl[0] + " = Module." + decl[0] + " = Module.cwrap(" + s(decl[0]) + ", " + s(decl[1]) + ", " + s(decl[2]);
        if (decl[3])
            outp += ", " + s(decl[3]);
        outp += ");\n";
    });
    accessors((decl, field) => {
        if (field && field.array) {
            outp += "var " + decl + " = Module." + decl + " = Module.cwrap(" + s(decl) + ", \"number\", [\"number\", \"number\"]);\n" +
                "var " + decl + "_s = Module." + decl + "_s = Module.cwrap(" + s(decl+"_s") + ", null, [\"number\", \"number\", \"number\"]);\n";
        } else {
            outp += "var " + decl + " = Module." + decl + " = Module.cwrap(" + s(decl) + ", \"number\", [\"number\"]);\n" +
                "var " + decl + "_s = Module." + decl + "_s = Module." + decl + "_si = Module.cwrap(" + s(decl+"_s") + ", null, [\"number\", \"number\"]);\n";
        }
    });

    funcs.freers.forEach((decl) => {
        outp += "var " + decl + "_js = Module." + decl + "_js = function(p) { " +
            "var p2 = malloc(4); " +
            "if (p2 === 0) throw new Error(\"Could not malloc\"); " +
            "(new Uint32Array(Module.HEAPU8.buffer, p2, 1))[0] = p; " +
            "Module." + decl + "(p2); " +
            "free(p2); " +
            "};\n";
    });

    funcs.copiers.forEach((type) => {
        outp += "var copyin_" + type[0] + " = Module.copyin_" + type[0] + " = Module.copyin_" + type[0] + "i = function(ptr, arr) { " +
            "var buf = new " + type[1] + "(Module.HEAPU8.buffer, ptr); " +
            "buf.set(arr); " +
            "};\n" +
            "var copyout_" + type[0] + " = Module.copyout_" + type[0] + " = function(ptr, len) { " +
            "return (new " + type[1] + "(Module.HEAPU8.buffer, ptr, len)).slice(0); " +
            "};\n";
    });

    outp = inp.replace("@FUNCS", outp);

    fs.writeFileSync("post.js", outp);
})();

// libav.types.d.ts
(function() {
    var inp = fs.readFileSync("libav.types.in.d.ts", "utf8");

    function args(x) {
        return x.map((t, idx) => `a${idx}: ${t}`).join(",");
    }

    function ret(x) {
        return (x === null) ? "void" : x;
    }

    var outp = "";
    funcs.functions.forEach((decl) => {
        outp += `${decl[0]}(${args(decl[2])}): Promise<${ret(decl[1])}>;\n`;
    });
    accessors((decl, field) => {
        if (field && field.array) {
            outp += `${decl}(ptr: number, idx: number): Promise<number>;\n`;
            outp += `${decl}_s(ptr: number, idx: number, val: number): Promise<void>;\n`;
        } else {
            outp += `${decl}(ptr: number): Promise<number>;\n`;
            outp += `${decl}_s(ptr: number, val: number): Promise<void>;\n`;
        }
    });

    funcs.freers.forEach((decl) => {
        outp += `${decl}_js(ptr: number);\n`;
    });

    funcs.copiers.forEach((type) => {
        outp += `copyin_${type[0]}(ptr: number, arr: ${type[1]}): Promise<void>;\n`;
        outp += `copyout_${type[0]}(ptr: number, len: number): Promise<${type[1]}>;\n`;
    });

    inp = inp.replace("@FUNCS", outp);

    /* We also read type declarations out of post.in.js, to keep all the decls
     * in one place */
    outp = "";
    let lastComment = "";
    let inComment = false;
    let lastTypes = "";
    let inTypes = false;
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
                outp += lastComment + lastTypes.trim() + ";\n";
            } else {
                lastTypes += line.slice(3) + "\n";
            }
        } else if (line.slice(0, 10) === "/// @types") {
            outp += lastComment + line.slice(11) + ";\n";
        }
    }
    outp = inp.replace("@DECLS", outp);

    fs.writeFileSync("libav.types.d.ts", outp);
})();

// libav.js
(function() {
    var ver = process.argv[2];
    var inp = fs.readFileSync("libav.in.js", "utf8");

    var outp = [];
    decls((decl) => {
        outp.push(decl);
    }, true);

    outp = inp.replace("@FUNCS", s(outp)).replace(/@VER/g, ver);

    fs.writeFileSync("libav-" + ver + ".js", outp);
})();

// exports.json
(function() {
    var outp = [];
    decls((decl) => {
        outp.push("_" + decl);
    });

    fs.writeFileSync("exports.json", s(outp));
})();
