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
        outp += "var " + decl[0] + " = Module." + decl[0] + " = Module.cwrap(" + s(decl[0]) + ", " + s(decl[1]) + ", " + s(decl[2]) + ");\n";
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
            "for (var i = 0; i < arr.length; i++) buf[i] = arr[i]; " +
            "};\n" +
            "var copyout_" + type[0] + " = Module.copyout_" + type[0] + " = function(ptr, len) { " +
            "return new " + type[1] + "(Module.HEAPU8.buffer, ptr, len); " +
            "};\n";
    });

    outp = inp.replace("@FUNCS", outp);

    fs.writeFileSync("post.js", outp);
})();

// libav.js
(function() {
    var ver = process.argv[2];
    var inp = fs.readFileSync("libav-" + ver + ".in.js", "utf8");

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
