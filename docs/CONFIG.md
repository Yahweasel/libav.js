# Configuration

libav.js uses a system of “configuration fragments” which direct building of
dependencies, configuration of ffmpeg, and licensing.

`config/mkconfigs.js` makes all the built-in configurations, and
`config/mkconfig.js` makes a single configuration.

Each configuration has the following files:

 * `deps.txt`: The library dependencies of this configuration, used to direct
   building of libraries.

 * `ffmpeg-config.txt`: The configuration options to ffmpeg.

 * `libs.txt`: Related to deps, libraries to link in.

 * `license.js`: The license header to be prepended to built files.

 * `link-flags.txt`: Any extra link flags needed while building.

Configuration fragments contain the same files, and they are concatenated
together to create the configurations.

## Fragments

Configuration fragments are in `config/fragments`. Most define how to build and
link a single feature.

Most configuration fragments have FFmpeg-specific, but otherwise predictable,
names. For instance, `codec-libopus` enables the libopus codec. Fragments can be
named `format-*`, `demuxer-*`, `muxer-*`, `codec-*`, `decoder-*`, `encoder-*`,
`filter-*`, or `bsf-*`, to enable the relevant features of FFmpeg. Note that
`format-*` usually just implies both `demuxer-*` and `muxer-*` (for the same
`*`), and the same applies to `codec-*`, `decoder-*`, and `encoder-*`.

For formats, demuxers, muxers, codecs, decoders, encoders, filters, or bsfs
(bitstream filters) that can be enabled with only the relevant FFmpeg
configuration flag (most of them), no actual fragment is needed. For instance,
if you enable the fragment `codec-prores`, then the `prores` decoder and encoder
will be included, even though `configs/fragments/codec-prores` does not exist.
These names are all FFmpeg-specific, so make sure to run FFmpeg's configure's
various `--list` flags to know what you're requesting.

A few fragments don't follow this format: `audio-filters` is a set of commonly
needed audio filters, `cli` enables the `ffmpeg` and `ffprobe` CLI programs,
`default` is default configuration used by everything, `libvpx` enables the VPX
library but neither of its codecs, `swscale` enables the swscale library, and
`workerfs` enables Emscripten's WorkerFS.

You can find which fragments are used for all the standard configurations in the
header of `configs/mkconfigs.js`.
