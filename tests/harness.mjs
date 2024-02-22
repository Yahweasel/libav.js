/*
 * Copyright (C) 2023, 2024 Yahweasel and contributors
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

    import * as fs from "fs/promises";

    let LibAVTestHarness;
    let LibAV;

LibAVTestHarness = {
    tests: [],
    files: [],
    options: {},
    data: {},
    utils: {},

    libAVOpts: null,
    libav: null,

    loadTests: async function(list) {
        const AsyncFunction = (async function(){}).constructor;

        this.tests = [];
        for (const test of list) {
            let js;
            if (typeof process !== "undefined") {
                js = await fs.readFile(`tests/${test}`, "utf8");
            } else {
                const resp = await fetch(`tests/${test}`);
                const ab = await resp.arrayBuffer();
                const tdec = new TextDecoder();
                js = tdec.decode(new Uint8Array(ab));

            }

            this.tests.push({
                name: test,
                func: AsyncFunction("h", js)
            });
        }
    },

    readFile: async function(name) {
        if (typeof process !== "undefined") {
            return fs.readFile(name);
        }

        const resp = await fetch(name);
        const ab = await resp.arrayBuffer();
        return new Uint8Array(ab);
    },

    readCachedFile: async function(name) {
        for (const file of this.files) {
            if (file.name === name)
                return new Uint8Array(await file.content.arrayBuffer());
        }
        return null;
    },

    LibAV: async function(opts, variant) {
        if (typeof LibAV === "undefined") {
            // Load a variant
            const toImport = `../dist/libav-all.dbg.` +
                "mjs";
            LibAV = (await import(toImport)).default;

            if (this.libav) {
                this.libav.terminate();
                this.libav = null;
            }
        }

        if (!opts && this.libav)
            return this.libav;

        const ret = await LibAV.LibAV(opts || this.libAVOpts);
        if (!opts)
            this.libav = ret;

        if (this.options.coverage) {
            // Add coverage checks to each function
            if (!this.data.funcs) {
                const funcsJSONU8 = await this.readFile("../funcs.json");
                const funcsJSON = (new TextDecoder()).decode(funcsJSONU8);
                const funcsObj = JSON.parse(funcsJSON);
                this.data.funcs = [];
                for (const func of funcsObj.functions)
                    this.data.funcs.push(func[0]);
                this.data.funcs = this.data.funcs.concat(funcsObj.meta);
                this.data.coverage = {};
            }

            const self = this;
            for (const func of this.data.funcs) (function(func) {
                const orig = ret[func];
                ret[func] = function() {
                    self.data.coverage[func] = true;
                    return orig.apply(this, arguments);
                };
            })(func);
        }

        for (const f of this.files)
            await ret.mkreadaheadfile(f.name, f.content);
        return ret;
    },

    print: console.log,
    printErr: console.error,
    printStatus: console.error,

    runTests: async function(opts) {
        opts = opts || [null];
        let fails = 0;

        let oIdx = 0;
        for (const opt of opts) {
            oIdx++;
            this.files = [];
            if (this.libav) {
                this.libav.terminate();
                this.libav = null;
            }
            this.libAVOpts = opt;

            let idx = 0;
            for (const test of this.tests) {
                idx++;
                this.printStatus(
                    `${oIdx}/${opts.length} ` +
                    `${idx}/${this.tests.length}: ` +
                    test.name);
                try {
                    await test.func(this);
                } catch (ex) {
                    this.printErr("\n" +
                        `Error in test ${test.name}\n` +
                        "Options: " + JSON.stringify(this.libAVOpts) + "\n" +
                        `Error: ${ex}\n${ex.stack}`);
                    fails++;
                }
            }
        }

        // Check coverage if applicable
        if (this.options.coverage) {
            for (const func of this.data.funcs) {
                if (!this.data.coverage[func])
                    this.printErr(`Function ${func} is not covered.`);
            }
        }

        this.printStatus("");
        this.printErr(`Complete. ${fails} tests failed.`);

        return fails;
    }
};

    export default LibAVTestHarness;
