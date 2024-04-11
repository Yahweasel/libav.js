# Configuration

libav.js uses a system of “configuration fragments” which direct building of
dependencies, configuration of ffmpeg, and licensing.

`config/mkconfigs.js` makes all the built-in configurations, and
`config/mkconfig.js` makes a single configuration.


## Making a custom variant

If all you want is to make a configuration that fits your needs, in the `config`
directory, run a command like `./mkconfig.js my-great-variant '["audio-filters",
"format-rm", "codec-rv20", "codec-ra_144"]'`. The first argument is the name of
the variant you're creating, and the second argument is a JSON array with the
configuration fragments to include. The order of the fragments in the array is
essentially irrelevant (it will affect the order that things are built in, and
the order that license text appears in headers, but nothing else).

If there's a built-in variant that's close to what you need, use its
`config.json` file as a starting point for the fragments argument. e.g.,
`configs/default/config.json` contains `["format-ogg", "format-webm",
"parser-opus", "codec-libopus", "format-flac", "parser-flac", "codec-flac",
"format-wav", "audio-filters"]`.

Most configuration fragments have FFmpeg-specific, but otherwise predictable,
names. For instance, `codec-libopus` enables the libopus codec. Fragments can be
named `protocol-*`, `format-*`, `demuxer-*`, `muxer-*`, `codec-*`, `decoder-*`,
`encoder-*`, `parser-*`, `filter-*`, or `bsf-*`, to enable the relevant features
of FFmpeg. Note that `format-*` usually just implies both `demuxer-*` and
`muxer-*` (for the same `*`), and the same applies to `codec-*`, `decoder-*`,
and `encoder-*`. So, for example, if you want to support decoding H.264 video
data in MP4 files, you want `"demuxer-mp4", "parser-h264", "decoder-h264"`.

You need to know FFmpeg jargon to predict a lot of names. For instance, H.264 is
`h264`, but H.265 is `hevc`. Run FFmpeg's configure's various `--list` flags to
know what you're requesting.

A few fragments don't follow this format: `audio-filters` is a set of commonly
needed audio filters, `cli` enables the `ffmpeg` and `ffprobe` CLI programs,
`default` is default configuration used by everything (and does not need to be
specified explicitly), `libvpx` enables the VPX library but neither of its
codecs (it is needed to include either codec), `swscale` enables the swscale
library (usually necessary to handle video usefully), and `workerfs` enables
Emscripten's WorkerFS.

So, following our H.264 example, you would probably also want to include
`swscale`. Let's say we wanted H.264 and AAC in HLS. HLS is handled via the
jsfetch protocol (see [IO.md](IO.md)), so the following configuration command
would be sufficient:
```
./mkconfig.js my-great-variant '["audio-filters", "swscale", "protocol-jsfetch",
"demuxer-hls", "parser-h264", "decoder-h264", "parser-aac", "decoder-aac"]
```

The above examples have always used parsers and decoders hand-in-hand. Generally
speaking, you only need the parser if you want to seek in files, as the parser
is used to find keyframes. But, the parser is tiny, so usually harmless to
include.


## Implementation details

Each configuration has the following files:

 * `deps.mk`: The library dependencies of this configuration, used to direct
   building of libraries. This is actually created from `deps.txt` in the
   fragments.

 * `ffmpeg-config.txt`: The configuration options to ffmpeg.

 * `libs.txt`: Related to deps, libraries to link in.

 * `license.js`: The license header to be prepended to built files.

 * `link-flags.txt`: Any extra link flags needed while building.

Configuration fragments contain the same files, and they are concatenated
together to create the configurations. The build uses these files, and expects
to find them in `configs/configs/<variant>` when you run `make build-<variant>`.

Configuration fragments are in `configs/fragments`.

For protocols, formats, demuxers, muxers, codecs, decoders, encoders, parsers,
filters, or bsfs (bitstream filters) that can be enabled with only the relevant
FFmpeg configuration flag (most of them), no actual fragment is needed. For
instance, if you enable the fragment `codec-h263p`, then the `h263p` decoder and
encoder will be included, even though `configs/fragments/codec-h263p` does not
exist.

You can find which fragments are used for all the standard configurations in the
header of `configs/mkconfigs.js`.
