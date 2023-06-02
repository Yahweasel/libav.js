/*
 * Copyright (C) 2023 Yahweasel and contributors
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

h.utils.audioF32 = async function(file) {
    if (typeof file === "string") {
        // Convert it to raw float data
        const libav = await h.LibAV();

        await libav.mkwriterdev("output");
        const parts = [];
        libav.onwrite = (name, pos, buf) => {
            parts.push(buf.slice(0));
        };

        await libav.ffmpeg(
            "-nostdin", "-loglevel", "0",
            "-i", file,
            "-f", "f32le",
            "-ar", "48000",
            "-y", "output");
        await libav.unlink("output");

        file = parts;
    }

    if (file instanceof Array)
        file = new Blob(file);

    if (file instanceof Blob)
        file = new Float32Array(await file.arrayBuffer());

    return file;
};

h.utils.compareAudio = async function(fileA, fileB) {
    let dataA, dataB;

    dataA = await h.utils.audioF32(fileA);
    dataB = await h.utils.audioF32(fileB);
    const len = Math.min(dataA.length, dataB.length);
    if (len <= 48000) {
        throw new Error(`Found short (nonexistent?) file while trying to compare ${fileA} and ${fileB}`);
    }

    let diff = 0;
    for (let i = 0; i < len; i++) {
        const da = dataA[i] || 0;
        const db = dataB[i] || 0;
        diff += Math.abs(db - da);
    }
    diff /= len;

    if (diff > 0.005) {
        // Suspicious amount of difference!
        throw new Error(`Files ${fileA} and ${fileB} differ by ${(diff*100).toFixed(2)}%!`);
    }
};
