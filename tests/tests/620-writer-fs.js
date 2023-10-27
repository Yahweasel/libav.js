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

// Using the multi-file writer filesystem with multi-file png output

if (!h.options.includeSlow)
    return;

const libav = await h.LibAV();

const oldOnWrite = libav.onwrite;

// Collect all the file data
const files = Object.create(null);
libav.onwrite = function(name, pos, buf) {
    buf = new Uint8Array(buf.slice(0).buffer);
    if (!files[name])
        files[name] = new Uint8Array(0);
    let file = files[name];
    if (file.length < pos + buf.length) {
        const newFile = new Uint8Array(pos + buf.length);
        newFile.set(file);
        files[name] = file = newFile;
    }
    file.set(buf, pos);
};

// Get a shorter file
await libav.ffmpeg(
    "-nostdin", "-loglevel", "quiet",
    "-i", "bbb.webm",
    "-map", "0:v", "-c:v", "copy", "-frames", "30",
    "tmp.webm"
);

// Convert to a sequence of JPEGs
await libav.mountwriterfs("/wfs");
await libav.ffmpeg(
    "-nostdin", "-loglevel", "quiet",
    "-i", "tmp.webm", "/wfs/%06d.png"
);
await libav.unmount("/wfs");

// Then write them
for (const name in files)
    await libav.writeFile(`tmp-${name}`, files[name]);

// Check them
await h.utils.compareVideo("tmp.webm", "tmp-%06d.png");

// And clean up
await libav.unlink("tmp.webm");
for (const name in files)
    await libav.unlink(`tmp-${name}`);

if (oldOnWrite)
    libav.onwrite = oldOnWrite;
else
    delete libav.onwrite;
