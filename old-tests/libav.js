const version = "4.10.6.1.1";

function load(variant = "default") {
    const opts = {
        nowasm: false,
        nothreads: true
    };
    for (let ai = 2; ai < process.argv.length; ai++) {
        const arg = process.argv[ai];
        if (arg === "asm.js")
            opts.nowasm = true;
        else if (arg === "threads") {
            opts.yesthreads = true;
            opts.nothreads = false;
        }
    }
    const target = opts.nowasm ? "asm"
        : (opts.nothreads ? "wasm" : "thr");
    const LibAV = require(`../dist/libav-${version}-${variant}.js`);
    LibAV.opts = opts;
    const actual = LibAV.target(opts);
    if (target !== actual)
        console.log(`Failed to load target ${target} (got ${actual})`);
    return LibAV;
}

module.exports = load;
