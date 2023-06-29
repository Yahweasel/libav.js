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

// This isn't really a test; it just gets the input file in place
for (const file of [
    ["bbb.mp4", "bbb_input.mp4"],
    ["bbb.webm", "bbb_input.webm"],
    ["bitrate.webm", "bbb_bitrate.webm"],
    ["example-bad-ffprobe.mov", "sandwich-av-mp4a.40.5.mov"]
]) {
    const content = await h.readFile(`files/${file[1]}`);
    h.files.push({
        name: file[0],
        content: new Blob([content])
    });
}
