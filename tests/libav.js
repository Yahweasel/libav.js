const version = "3.7.5.0.1";

function load(variant = "default") {
    const opts = {
        nowasm: false,
        nothreads: true,
        nosimd: true
    };
    for (let ai = 2; ai < process.argv.length; ai++) {
        const arg = process.argv[ai];
        if (arg === "asm.js")
            opts.nowasm = true;
        else if (arg === "threads") {
            opts.yesthreads = true;
            opts.nothreads = false;
        } else if (arg === "simd")
            opts.nosimd = false;
    }
    const target = opts.nowasm ? "asm" : (
        opts.nothreads ? (
            opts.nosimd ? "wasm" : "simd"
        ) : (
            opts.nosimd ? "thr" : "thrsimd"
        )
    );
    const LibAV = require(`../libav-${version}-${variant}.js`);
    const actual = LibAV.target(opts);
    if (target !== actual)
        console.log(`Failed to load target ${target} (got ${actual})`);
    return LibAV;
}

module.exports = load;
