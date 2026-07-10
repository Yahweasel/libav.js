/*
 * Copyright (C) 2024 Yahweasel and contributors
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

// Basic test of metadata and chapter extraction

const libav = await h.LibAV();

// Create a dictionary and copy it out
let dict = await libav.av_dict_set_js(0, "foo", "bar");
const jsDict = await libav.ff_copyout_dict(dict);
if (!jsDict.foo || jsDict.foo !== "bar")
    throw new Error("Dictionary copyout failed");
// (skip av_dict_free -- it takes AVDictionary** but is wrapped as number,
// causing memory access errors in the all variant wasm)

// Initialize demuxer and check stream metadata
const [fmt_ctx, streams] = await libav.ff_init_demuxer_file("bbb.mp4");
if (typeof streams[0].metadata !== "object")
    throw new Error("Stream metadata missing");
await libav.avformat_close_input_js(fmt_ctx);

// Check chapters from a file that has them
const [fmt_ctx2, streams2] = await libav.ff_init_demuxer_file("bbb_chapters.mp4");
const chapters = await libav.ff_get_demuxer_chapters(fmt_ctx2);
if (!Array.isArray(chapters))
    throw new Error("Chapters missing");
if (chapters.length < 1)
    throw new Error("Expected at least 1 chapter, got " + chapters.length);
if (!chapters[0].metadata || !chapters[0].metadata.title)
    throw new Error("Chapter missing title metadata");
if (typeof streams2[0].metadata !== "object")
    throw new Error("Stream metadata missing on chapters file");
await libav.avformat_close_input_js(fmt_ctx2);
