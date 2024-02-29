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

// Utility function to interleave planar data
function interleave(planar) {
    const ret = new Float32Array(planar.length * planar[0].length);
    let i = 0;
    for (let si = 0; si < planar[0].length; si++) {
        for (let ci = 0; ci < planar.length; ci++) {
            ret[i++] = planar[ci][si];
        }
    }
    return ret;
}

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
            "-nostdin", "-loglevel", "quiet",
            "-i", file,
            "-f", "f32le",
            "-ar", "48000",
            "-y", "output");
        await libav.unlink("output");

        file = parts;
    }

    if (file instanceof Array) {
        if (file[0] && file[0].data) {
            if (file[0].data.buffer) {
                // Frames of flat data
                file = new Blob(file.map(x => x.data));
            } else {
                // Frames of planar data
                file = new Blob(file.map(x => interleave(x.data)));
            }
        } else {
            // Just data
            file = new Blob(file);
        }
    }

    if (file instanceof Blob)
        file = new Float32Array(await file.arrayBuffer());

    return file;
};

h.utils.compareAudio = async function(fileA, fileB, opts = {}) {
    const nameA = fileA.toString().slice(0, 16);
    const nameB = fileB.toString().slice(0, 16);
    let dataA, dataB;

    dataA = await h.utils.audioF32(fileA);
    dataB = await h.utils.audioF32(fileB);
    const len = Math.min(dataA.length, dataB.length);
    if (len <= 48000) {
        throw new Error(`Found short (nonexistent?) file while trying to compare ${nameA} and ${nameB}`);
    }

    let diff = 0;
    for (let i = 0; i < len; i++) {
        const da = dataA[i] || 0;
        const db = dataB[i] || 0;
        diff += Math.abs(db - da);
    }
    diff /= len;

    const tolerance = opts.tolerance || 0.005;
    if (diff > tolerance) {
        // Suspicious amount of difference!
        throw new Error(`Files ${nameA} and ${nameB} differ by ${(diff*100).toFixed(2)}%!`);
    }
};

h.utils.videoYUV = async function(file) {
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
            "-f", "rawvideo",
            "-pix_fmt", "yuv420p",
            "-y", "output");
        await libav.unlink("output");

        file = parts;
    }

    if (file instanceof Array) {
        if (file[0].data) {
            // Gather together the planar data
            const parts = [];
            for (const frame of file) {
                for (let pi = 0; pi < frame.layout.length; pi++) {
                    const plane = frame.layout[pi];
                    let w = frame.width;
                    let h = frame.height;
                    if (pi === 1 || pi === 2) {
                        w >>= 1;
                        h >>= 1;
                    }
                    for (let y = 0; y < h; y++) {
                        parts.push(frame.data.subarray(
                            plane.offset + y * plane.stride,
                            plane.offset + y * plane.stride + w
                        ));
                    }
                }
            }
            file = new Blob(parts);
        } else {
            // Just data
            file = new Blob(file);
        }
    }

    if (file instanceof Blob)
        file = new Uint8Array(await file.arrayBuffer());

    return file;
};

h.utils.compareVideo = async function(fileA, fileB, opts = {}) {
    const nameA = fileA.toString().slice(0, 16);
    const nameB = fileB.toString().slice(0, 16);
    let dataA, dataB;

    dataA = await h.utils.videoYUV(fileA);
    dataB = await h.utils.videoYUV(fileB);
    const len = Math.min(dataA.length, dataB.length);
    if (len <= 1152000) {
        throw new Error(`Found short (nonexistent?) file while trying to compare ${nameA} and ${nameB}`);
    }

    let diff = 0;
    for (let i = 0; i < len; i++) {
        const da = dataA[i] || 0;
        const db = dataB[i] || 0;
        diff += Math.abs(db - da) / 255;
    }
    diff /= len;

    const tolerance = opts.tolerance || 0.01;
    if (diff > tolerance) {
        // Suspicious amount of difference!
        throw new Error(`Files ${nameA} and ${nameB} differ by ${(diff*100).toFixed(2)}%!`);
    }
};
