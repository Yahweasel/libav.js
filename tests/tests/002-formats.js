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

const libav = await h.LibAV();

// One by one, convert bbb.mp4 into every format we're likely to need
for (const combo of [
    ["f32.wav", null, "pcm_f32le"],
    ["flac", null, "flac"],
    ["m4a", null, "aac"],
    ["mp3", null, "libmp3lame"],
    ["ogg", null, "libvorbis"],
    ["opus", null, "libopus"],
    ["prores.mov", "prores", "aac", {slow: true}],
    ["s16.wav", null, "pcm_s16le"],
    ["vp8.webm", "libvpx", "libopus", {slow: true}]
]) {
    if (combo[3] && combo[3].slow && !h.options.includeSlow)
        continue;

    const args = [
        "-nostdin",
        "-loglevel", "0",
        "-i", "bbb.mp4"
    ];
    if (combo[1])
        args.push("-map", "0:v", "-c:v", combo[1]);
    if (combo[2])
        args.push("-map", "0:a", "-c:a", combo[2]);
    const fname = "bbb." + combo[0];
    args.push(fname);

    try {
        await libav.ffmpeg(args);
    } catch (ex) {
        ex.message = JSON.stringify(combo) + " " + ex.message;
        throw ex;
    }

    const fileData = await libav.readFile(fname);
    h.files.push({
        name: fname,
        content: new Blob([fileData])
    });
}
