This is a compilation of the libraries associated with handling audio in
ffmpeg—libavformat, libavcodec, libavfilter, libavutil and libswresample—for
emscripten, and thus the web. This compilation exposes the *library* interface
of ffmpeg, not ffmpeg itself, and there is a separate project by a different
author, ffmpeg.js, if what you need is ffmpeg.

Include libav-`version`-`variant`.js to use libav.js. The variants are
discussed below.

libav.js exposes a global variable, LibAV, for all API access. If LibAV is set
before loading the library, libav.js does *not* replace it, but extends it:
This gives you an opportunity to pass in values critical for loading. In
particular, if the base directory (directory in which libav's files are
located) isn't ".", then you must set `LibAV.base` to the correct base
directory.

`LibAV.LibAV` is a factory function which returns a promise which resolves to a
ready instance of libav. `LibAV.LibAV` takes an optional argument in which
loading options may be provided, but they're rarely useful. The only loading
options are `noworker` and `nowasm`, to disable using Web Workers and
WebAssembly, respectively.

Otherwise, the API exposed by libav.js is more-or-less exactly the functions
exposed by the libav libraries, using promises. Because of the promise-based
design, the interface is identical whether Web Workers are used or not.

For an exact list of the functions, see `funcs.json`. Some libav functions take
double-pointers so that they can return both an allocated pointer value and (if
applicable) an error code, and where possible these are wrapped in `_js`
versions which simply return a pointer. For instance,
`avfilter_graph_create_filter`, which takes an `AVFilterContext **` as its
first argument, is exposed as `avfilter_graph_create_filter_js`, which returns
an `AVFilterContext *`.

Some common sequences of functions are combined into `ff_` metafunctions. See
the tests in `tests` for examples.

In order to reduce license-header Hell, the small amount of wrapper functions
provided by libav.js are all released under the so-called “0-clause BSD”
license, which does not require that the license text itself appear in
derivative works. Built libraries have their correct license headers.


## VARIANTS

With all of its bells and whistles enabled, ffmpeg is pretty large. So, I
disable most bells and most whistles and build specific versions with specific
features.

The default build, libav-`version`-default.js, includes supports for all of the
most important audio formats for the web: Opus in WebM or ogg containers, AAC
in the M4A container, and FLAC and 16- or 24-bit wav in their respective
containers. Also supported are all valid combinations of those formats and
containers, e.g. any codec in Matroska (since WebM is Matroska), FLAC in ogg,
etc.

Built-in variants are created by combining “configuration fragments”, but
variants may be created manually as well. The fragments for the default variant
are `["ogg", "webm", "opus", "ipod", "aac", "flac", "wav", "audio-filters"]`.

Use `make build-variant`, replacing `variant` with the variant name, to build
another variant.

libav.js includes several other variants:

The “lite” variant removes, relative to the default variant, AAC, and the M4A
and WebM/Matroska containers. (`["ogg", "opus", "flac", "wav",
"audio-filters"]`)

The “fat” variant adds, relative to the default variant, Vorbis, wavpack and
its container, and ALAC. (`["ogg", "webm", "opus", "ipod", "aac", "flac",
"vorbis", "wavpack", "alac", "wav", "audio-filters"]`)

The “obsolete” variant adds, relative to the default variant, two obsolete but
still commonly found audio formats, namely Vorbis in the ogg container and MP3
in its own container. Note that while Vorbis has been formally replaced by
Opus, at the time of this writing, Opus still has lackluster support in audio
software, so Vorbis is still useful. MP3, on the other hand, is completely
worthless, and is only supplied in case your end users are idiots. Friends
don't let friends use MP3. (`["ogg", "webm", "opus", "ipod", "aac", "flac",
"vorbis", "lame", "audio-filters"]`)

The “opus”, “flac”, and “opus-flac” variants are intended just for encoding or
decoding Opus and/or FLAC. They include only their named format(s), the
appropriate container(s), and the `aresample` filter; in particular, no other
filters are provided whatsoever. With Opus in particular, this is a better
option than a simple conversion of libopus to JavaScript, because Opus mandates
a limited range of audio sample rates, so having a resampler is beneficial.
(`["ogg", "opus"]`, `["flac"]`, `["ogg", "opus", "flac"]`)

The “webm” variant, relative to the default variant, includes support for VP8
video. The “webm-opus-flac” variant, relative to “opus-flac”, includes support
for VP8 video, as “webm”, but excludes all filters except aresample. The
“mediarecorder-transcoder” variant, relative to “webm-opus-flac”, adds MPEG-4
AAC and H.264, making it sufficient for transcoding formats that MediaRecorder
can produce on all platforms. Note that support is not included for *encoding*
MPEG-4 video, only decoding. (`["ogg", "webm", "opus", "ipod", "aac", "flac",
"vpx", "vp8", "wav", "audio-filters"]`, `["ogg", "webm", "opus", "flac", "vpx",
"vp8"]`, `["ogg", "webm", "opus", "ipod", "aac", "flac", "vpx", "vp8",
"h264"]`)

To create a variant from configuration fragments, run `./mkconfig.js` in the
`configs` directory. The first argument is the name of the variant to make, and
the second argument is the JSON array of fragments to include.

To create other variants, simply create the configuration for them in
subdirectories of `configs` and, if necessary, add Makefile fragments to `mk`.

This is intentionally designed so that you can add new configurations without
needing to patch anything that already exists. See the existing variants'
configuration files in `config` and the existing fragments in `mk` to
understand how.


## SIZE

libav.js is big.

You can estimate the size of variants based on the size of the constituent
fragments. As of version 3.0.4.4, an empty build is approximately 673KiB
(WebAssembly), and the fragments add the following:

| Fragment      | Size (KiB)    |
| ------------: | :------------ |
| ogg           | 67            |
| webm          | 11            |
| ipod          | 344           |
|               |               |
| opus          | 284           |
| aac           | 281           |
| vorbis        | 451           |
| lame          | 278           |
| flac          | 82            |
| wav           | 48            |
| wavpack       | 104           |
| alac          | 25            |
|               |               |
| vpx+vp8       | 343           |
| vpx+vp9       | 742           |
| h264          | 544           |
|               |               |
| audio-filters | 133           |

The asm.js versions are much bigger, but will not be loaded on
WebAssembly-capable clients.

The wrapper (“glue”) code is about 220KiB, but is highly compressible.
