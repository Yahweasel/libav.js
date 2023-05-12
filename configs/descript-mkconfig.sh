#!/bin/sh
./mkconfig.js 'rawvideo' '["format-ogg", "format-webm", "codec-libopus", "format-mp4", "codec-aac", "codec-flac", "swscale", "libvpx", "decoder-libvpx_vp8", "decoder-h264", "decoder-hevc", "decoder-prores", "workerfs", "cli", "format-rawvideo", "codec-rawvideo"]'

FRAGS='[
"audio-filters", "swscale", "workerfs", "cli",
"format-wav", "format-mp3", "decoder-mp3", "encoder-libmp3lame", "format-mp4", "format-ogg", "format-aac",
"demuxer-gif",
"codec-aac", "format-pcm_f32le", "codec-pcm_f32le", "codec-libopus", "decoder-opus", "decoder-h264", "decoder-hevc", "decoder-prores"'
./mkconfig.js 'descript-p1' "$FRAGS]"
FRAGS="$FRAGS"',
"demuxer-webm", "demuxer-flac",
"codec-flac", "demuxer-aiff",
"decoder-alac", "codec-pcm_s32le",
"libvpx", "decoder-libvpx_vp8", "decoder-libvpx_vp9"'
./mkconfig.js 'descript-p2' "$FRAGS]"
FRAGS="$FRAGS"',
"format-mpegts", "demuxer-mpegps", "demuxer-asf", "decoder-wmav2",
"decoder-mpeg4", "decoder-wmv2", "decoder-wmv3"]'
./mkconfig.js 'descript-p3' "$FRAGS"
