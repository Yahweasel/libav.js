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

// Convert between all (viable) formats and test that they all work

const mp4 = ["libopenh264", "aac"];
const formatCodecs = {
    "adts": [null, "aac"],
    "f32le": [null, "pcm_f32le", {nocheck: true}],
    "flac": [null, "flac"],
    "hls": [null, null],
    "image2": [null, null],
    "ipod": mp4,
    "latm": [null, null],
    "mov": mp4,
    "mp3": [null, "libmp3lame"],
    "mp4": mp4,
    "mpegts": mp4,
    "rawvideo": ["rawvideo", null, {nocheck: true}],
    "wav": [null, "pcm_s16le"],
    "wv": [null, "wavpack"]
};

const codecFormats = {
    "qtrle": "mov"
};

async function stdoutFile(libav) {
    await libav.writeFile("stdout", "");
    const stdoutFd = await libav.open("stdout", 1);
    await libav.dup2(stdoutFd, 1);
    await libav.close(stdoutFd);
    const stderrFd = await libav.open("/dev/null", 1);
    await libav.dup2(stderrFd, 2);
    await libav.close(stderrFd);
}

async function getStdout(libav) {
    return await libav.readFile("stdout", {encoding: "utf8"});
}

// First, we need a list of all encoders
const encoders = await (async function() {
    const libav = await h.LibAV({});
    await stdoutFile(libav);
    await libav.ffmpeg("-nostdin", "-encoders");
    const stdout = await getStdout(libav);
    const lines = stdout.split("\n");
    let li;

    // Find the --- line
    for (li = 0; li < lines.length; li++) {
        if (/^ *-/.test(lines[li]))
            break;
    }

    // Now get all the encoders
    const ret = {video: [], audio: []};
    for (; li < lines.length; li++) {
        const line = lines[li];
        const parts = line.split(" ");
        if (parts.length < 3)
            continue;

        // Format: ["", codec info, codec name, ...]
        if (parts[1][0] === "V")
            ret.video.push(parts[2]);
        else if (parts[1][0] === "A")
            ret.audio.push(parts[2]);
    }

    return ret;
})();

// And all formats
const formats = await (async function() {
    const libav = await h.LibAV({});
    await stdoutFile(libav);
    await libav.ffmpeg("-nostdin", "-formats");
    const stdout = await getStdout(libav);
    const lines = stdout.split("\n");
    let li;

    // Find the -- line
    for (li = 0; li < lines.length; li++) {
        if (/^ *-/.test(lines[li]))
            break;
    }

    // Now get all the formats
    const ret = [];
    for (; li < lines.length; li++) {
        const line = lines[li];
        const parts = /^ (.)(.) *([^ ]*)/.exec(line);
        if (!parts)
            continue;

        if (parts[2] === "E") {
            // We can encode this format, so include it
            ret.push(parts[3]);
        }
    }

    return ret;
})();

const libav = await h.LibAV();

// First try each video encoder
for (const cv of encoders.video) {
    if (!h.options.includeSlow)
        break;

    // Even in slow-mode, skip VP9, and AV1, because they're just too slow!
    if (cv === "libvpx-vp9" || cv === "libaom-av1" || cv === "libsvtav1")
        continue;

    // Transcode this
    h.printStatus(`-c:v ${cv}`);
    let format = codecFormats[cv];
    if (!format)
        format = "mkv";
    const out = `tmp-${cv}.${format}`;
    const ret = await libav.ffmpeg(
        "-nostdin",
        "-i", "bbb.webm",
        "-map", "0:v",
        "-c:v", cv,
        "-b:v", "10M",
        "-y", out);
    if (ret !== 0)
        throw new Error(`ffmpeg returned ${ret}`);
    await h.utils.compareVideo("bbb.webm", out, {tolerance: 0.05});
}

// Then try each audio encoder
for (const ca of encoders.audio) {
    h.printStatus(`-c:a ${ca}`);
    let format = codecFormats[ca];
    if (!format)
        format = "mkv";
    const out = `tmp-${ca}.${format}`;
    const ret = await libav.ffmpeg(
        "-nostdin",
        "-i", "bbb.webm",
        "-map", "0:a",
        "-c:a", ca,
        "-b:a", "256k",
        "-y", out);
    if (ret !== 0)
        throw new Error(`ffmpeg returned ${ret}`);
    await h.utils.compareAudio("bbb.webm", out, {tolerance: 0.05});
}

// Then try each format
for (const f of formats) {
    h.printStatus(`-f ${f}`);
    const out = `tmp.${f}`;

    // Build the arguments
    const args = ["-nostdin"];

    let fc = null, video = null, audio = null;
    if (formatCodecs[f]) {
        fc = formatCodecs[f];
        video = fc[0];
        audio = fc[1];
    } else {
        video = "libvpx";
        audio = "libopus";
    }

    if (!h.options.includeSlow)
        video = null;

    if (!video && !audio)
        continue;

    if (video)
        args.push("-i", `tmp-${video}.mkv`);
    if (audio)
        args.push("-i", `tmp-${audio}.mkv`);

    if (video) {
        args.push(
            "-map", "0:v",
            "-c:v", "copy"
        );
    }
    if (audio) {
        if (video)
            args.push("-map", "1:a");
        else
            args.push("-map", "0:a");
        args.push("-c:a", "copy");
    }

    args.push("-f", f, "-y", out);
    const ret = await libav.ffmpeg(args);
    if (ret !== 0)
        throw new Error(`ffmpeg returned ${ret}`);

    if (fc && fc[2] && fc[2].nocheck)
        continue;

    if (video)
        await h.utils.compareVideo("bbb.webm", out, {tolerance: 0.05});
    if (audio)
        await h.utils.compareAudio("bbb.webm", out, {tolerance: 0.05});
}
