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

/* example-bad-ffprobe.mov is a file that ffprobe fails on in current versions
 * of ffmpeg */
if (await libav.ffprobe("-loglevel", "quiet", "example-bad-ffprobe.mov") === 0)
    throw new Error("Unexpected ffprobe success");

// bbb.mp4 is a fine file
if (await libav.ffprobe("-loglevel", "quiet", "bbb.mp4") !== 0)
    throw new Error("Unexpected ffprobe failure");
