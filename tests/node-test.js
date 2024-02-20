#!/usr/bin/env node
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

const options = {};
for (const arg of process.argv.slice(2)) {
    switch (arg) {
        case "--include-slow":
            options.includeSlow = true;
            break;

        case "--coverage":
            options.coverage = true;
            break;

        default:
            console.error(`Unrecognized argument ${arg}`);
            process.exit(1);
    }
}

const harness = require("./harness.js");
Object.assign(harness.options, options);
async function main() {
    harness.printStatus = x => {
        process.stderr.write("\x1b[K" + x + "\r");
    };
    await harness.loadTests(require("./suite.json"));
    process.exit(await harness.runTests([
        null,
        {nowasm: true}
    ]) ? 1 : 0);
}
main();
