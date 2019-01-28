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
particular, libav-`version`-`variant`.js only chooses whether to use a Web
Worker or not and whether to use WebAssembly or not, then loads the appropriate
version, for which it needs the base directory from which to load. If the base
directory isn't ".", set LibAV.base to the correct base directory.

libav.js is ready when `LibAV.ready` is `true`. If `LibAV.ready` is false, you
may set `LibAV.onready` to a function to call when it's ready.

Otherwise, the API exposed by `LibAV` is more-or-less exactly the functions
exposed by the `libav` libraries, using promises. Because of the promise-based
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
derivative works. Built libraries should have their correct license headers.


## VARIANTS

With all of its bells and whistles enabled, ffmpeg is pretty large. So, I
disable most bells and most whistles and build specific versions with specific
features.

The default build, libav-`version`-default.js, includes supports for all of the
most important formats for the web: Opus in WebM or ogg containers, AAC in the
M4A container, and FLAC and 16- or 24-bit wav in their respective containers.
Also supported are all valid combinations of those formats and containers, e.g.
any codec in Matroska (since WebM is Matroska), FLAC in ogg, etc.

Use `make build-variant`, replacing `variant` with the variant name, to build
another variant.

The second variant that ships with libav.js is the “obsolete” variant,
including two obsolete but still commonly found audio formats, namely Vorbis in
the ogg container and MP3 in its own container. Note that while Vorbis has been
formally replaced by Opus, at the time of this writing, Opus still has
lackluster support in audio software, so Vorbis is still useful. MP3, on the
other hand, is completely worthless, and is only supplied in case your end
users are idiots. Friends don't let friends use MP3.

To create other variants, simply create the configuration for them in `configs`
and, if necessary, add Makefile fragments to `mk`. This is intentionally
designed so that you can overly new configurations without needing to patch
anything that already exists. See the two existing variants' configuration
files in `config` and the existing fragments in `mk` to understand how.
