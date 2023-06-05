const libav = await h.LibAV();

const [fmt_ctx, streams] = await libav.ff_init_demuxer_file("bbb.mp4");

let si, stream;
for (si = 0; si < streams.length; si++) {
    stream = streams[si];
    if (stream.codec_type === libav.AVMEDIA_TYPE_AUDIO)
        break;
}
if (si >= streams.length)
    throw new Error("Couldn't find audio stream");

const audio_stream_idx = stream.index;
const [, c, pkt, frame] =
    await libav.ff_init_decoder(stream.codec_id, stream.codecpar);

const [res, packets] = await libav.ff_read_multi(fmt_ctx, pkt);

if (res !== libav.AVERROR_EOF)
    throw new Error("Error reading: " + res);

const frames =
    await libav.ff_decode_multi(c, pkt, frame,
        packets[audio_stream_idx], true);

await libav.ff_free_decoder(c, pkt, frame);
await libav.avformat_close_input_js(fmt_ctx)

// Check that the data is correct
await h.utils.compareAudio("bbb.mp4", frames);
