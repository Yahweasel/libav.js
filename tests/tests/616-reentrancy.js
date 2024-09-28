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

// Check for reentrancy issues by trying to do two files at once

const libav = await h.LibAV();
const buf = await h.readCachedFile("bbb.webm");

await libav.mkblockreaderdev("dev1.webm", buf.length);
await libav.mkblockreaderdev("dev2.webm", buf.length);

const origOnBlockRead = libav.onblockread;
libav.onblockread = function(name, position, length) {
    libav.ff_block_reader_dev_send(name, position, buf.slice(position, position + length));
};

const [fmt_ctx1, [, stream1]] = await libav.ff_init_demuxer_file("dev1.webm");
const [fmt_ctx2, [, stream2]] = await libav.ff_init_demuxer_file("dev2.webm");
const [, c1, pkt1, frame1] = await libav.ff_init_decoder(
    "libopus", stream1.codecpar);
const [, c2, pkt2, frame2] = await libav.ff_init_decoder(
    "libopus", stream2.codecpar);

// Reader for one or the other
async function reader(fmt_ctx, c, pkt, frame) {
    let frames = [];
    while (true) {
        const [ret, packets] = await libav.ff_read_frame_multi(fmt_ctx, pkt, {
            limit: 65536
        });

        if (ret !== libav.AVERROR_EOF && ret !== -libav.EAGAIN && ret !== 0)
            throw new Error("Invalid return from ff_read_frame_multi");

        if (!packets[1])
            continue;

        // Decode them
        const partFrames = await libav.ff_decode_multi(c, pkt, frame, packets[1], false);
        frames = frames.concat(partFrames);

        if (ret === libav.AVERROR_EOF)
            break;
    }

    const lastFrames = await libav.ff_decode_multi(c, pkt, frame, [], true);
    frames = frames.concat(lastFrames);
    return frames;
}

const [frames1, frames2] = await Promise.all([
    reader(fmt_ctx1, c1, pkt1, frame1),
    reader(fmt_ctx2, c2, pkt2, frame2)
]);

await libav.ff_free_decoder(c1, pkt1, frame1);
await libav.ff_free_decoder(c2, pkt2, frame2);
await libav.avformat_close_input_js(fmt_ctx1);
await libav.avformat_close_input_js(fmt_ctx2);
await libav.unlink("dev1.webm");
await libav.unlink("dev2.webm");

if (origOnBlockRead)
    libav.onblockread = origOnBlockRead;
else
    delete libav.onblockread;

// Check for correctness
await h.utils.compareAudio("bbb.webm", frames1);
//await h.utils.compareAudio("bbb.webm", frames2);
