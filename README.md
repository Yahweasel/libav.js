# libav.js

This is a compilation of the libraries associated with handling audio and video
in FFmpeg—libavformat, libavcodec, libavfilter, libavutil and libswresample—for
WebAssembly and asm.js, and thus the web. It is compiled via emscripten and is
highly customizable.

In short, this is a pure JavaScript and WebAssembly system for low-level audio
and video encoding, decoding, muxing, demuxing, and filtering.

FFmpeg is released under the LGPL. Therefore, if you distribute this library,
you must provide sources. The sources are included in the `sources/` directory
of the compiled version of libav.js.

This file is the main README for using and building libav.js, and should be
sufficient for many users. More detail on specific concepts is provided in other
files:

 * [API.md](docs/API.md) describes the libav.js-specific parts of the API.

 * [CONFIG.md](docs/CONFIG.md) describes the configuration system and how to
   create your own configuration of libav.js.

 * [IO.md](docs/IO.md) describes the various I/O modes provided by libav.js.

 * [TESTS.md](docs/TESTS.md) describes the testing framework.


## Using libav.js

libav.js builds are available on
[GitHub](https://github.com/Yahweasel/libav.js/releases) and in NPM. Include
dist/libav-`version`-`variant`.js to use libav.js. The variants are discussed
below.

The simplest way to use libav.js is to include it from a CDN. libav.js uses Web
Workers by default, and Web Workers cannot be loaded from a different origin, so
if you load it from a CDN, you must disable its own loading of workers. As such,
it's only recommended to use libav.js from a CDN if you're already *in* a
worker, and thus don't need sub-workers. Nonetheless, the following is a simple
example of using libav.js from a CDN in the browser thread:

```html
<!doctype html>
<html>
    <body>
        <script type="text/javascript">LibAV = {base: "https://cdn.jsdelivr.net/npm/@libav.js/variant-default@4.10.6/dist"};</script>
        <script type="text/javascript" src="https://cdn.jsdelivr.net/npm/@libav.js/variant-default@4.10.6/dist/libav-4.10.6.1.1-default.js"></script>
        <script type="text/javascript">(async function() {
            const libav = await LibAV.LibAV({noworker: true});
            await libav.writeFile("tmp.opus", new Uint8Array(
                await (await fetch("exa.opus")).arrayBuffer()
            ));
            const [fmt_ctx, [stream]] = await libav.ff_init_demuxer_file("tmp.opus");
            const [, c, pkt, frame] = await libav.ff_init_decoder(stream.codec_id, stream.codecpar);
            const [, packets] = await libav.ff_read_multi(fmt_ctx, pkt);
            const frames = await libav.ff_decode_multi(c, pkt, frame, packets[stream.index], true);
            alert(`Got ${frames.length} audio frames!`);
        })();
        </script>
    </body>
</html>
```

Here's a better example, using libav.js locally:

```html
<!doctype html>
<html>
    <body>
        <script type="text/javascript" src="libav-4.10.6.1.1-default.js"></script>
        <script type="text/javascript">(async function() {
            const libav = await LibAV.LibAV();
            await libav.writeFile("tmp.opus", new Uint8Array(
                await (await fetch("exa.opus")).arrayBuffer()
            ));
            const [fmt_ctx, [stream]] = await libav.ff_init_demuxer_file("tmp.opus");
            const [, c, pkt, frame] = await libav.ff_init_decoder(stream.codec_id, stream.codecpar);
            const [, packets] = await libav.ff_read_multi(fmt_ctx, pkt);
            const frames = await libav.ff_decode_multi(c, pkt, frame, packets[stream.index], true);
            alert(`Got ${frames.length} audio frames!`);
        })();
        </script>
    </body>
</html>
```

It's also possible to use libav.js from Node.js, though this isn't a good idea,
since you can presumably use a native version of FFmpeg's libraries. The Node
interface is only provided for internal testing.

Use `.dbg.js` instead of `.js` for a non-minified, more debuggable version.

libav.js exposes a global variable, LibAV, for all API access. If LibAV is set
before loading the library, libav.js does *not* replace it, but extends it.
This gives you an opportunity to pass in values critical for loading. In
particular, if the base directory (directory in which libav's files are
located) isn't ".", then you must set `LibAV.base` to the correct base
directory, as in the CDN example above. `LibAV.base` does not need to be a full
URL, but should be if loading from another origin. You can set `LibAV.base`
after loading libav.js; it's set up so that you can do it before to make it
easier to avoid race conditions.

Bundlers have further concerns. To use libav.js with a bundler, see the section
on bundlers below.

`LibAV.LibAV` is a factory function which returns a promise which resolves to a
ready instance of libav. `LibAV.LibAV` takes an optional argument in which
loading options may be provided. The loading options and their default values
are:
```
{
    "noworker": false,
    "nowasm": false,
    "yesthreads": false,
    "nothreads": false,
    "base": LibAV.base,
    "wasmurl": undefined,
    "variant": undefined
}
```
`nowasm` forces libav.js to load only asm.js code, not WebAssembly code. By
default, it will determine what the browser supports and choose accordingly, so
this is overridable here for testing purposes only.

The other no/yes options affect the execution mode of libav.js. libav.js can run
in one of three modes: `"direct"` (synchronous), `"worker"`, or `"threads"`.
After creating a libav.js instance, the mode can be found in
`libav.libavjsMode`. By default, libav.js will use the `"worker"` mode if
Web Workers are available, and `"direct"` otherwise. libav.js never uses the
`"threads"` mode by default, though this may change in the future.

If `noworker` is set or Web Workers are not available, Web Workers will be
disabled, so libav.js will run in the main thread (i.e., will run in `"direct"`
mode). This is synchronous, so usually undesirable.  Note that if you're loading
libav.js *in* a worker, it may be reasonable to set `noworker`, and make
libav.js synchronous with your worker thread.

If `yesthreads` is set (and `nothreads` is not set) and threads are supported
(see
https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer
), then a threaded version of libav.js will be loaded. This will significantly
improve the performance of some encoders and decoders. However, threads are
disabled by default, as their benefit or otherwise depends on the precise
behavior of your code, and some browsers have a fairly low limit to the number
of worker threads an entire page is allowed to have. Note that separate
instances of libav.js, created by separate calls to `LibAV.LibAV`, will be in
separate threads as long as workers are used, regardless of the value of
`yesthreads`, and thus `yesthreads` is only needed if you need concurrency
*within* a libav.js instance.

libav.js automatically detects which WebAssembly features are available, so even
if you set `yesthreads` to `true`, a version without threads may be loaded. To
know which version will be loaded, call `LibAV.target`. It will return `"asm"`
if only asm.js is used, `"wasm"` for baseline, or `"thr"` for threads. These
strings correspond to the filenames to be loaded, so you can use them to preload
and cache the large WebAssembly files. `LibAV.target` takes the same optional
argument as `LibAV.LibAV`.

The `base` option can be used in these options in place of `LibAV.base`, and
will override `LibAV.base` if set.

The `wasmurl` option can be used to override the *full* URL from which to load
the WebAssembly (if there is WebAssembly), or the `variant` option can be used
to override the variant loaded to be different from the variant that libav.js
was compiled with. Setting `variant` is useful if you need multiple variants
(e.g., one variant to determine what kind of file you have, and then another
variant to decode the data in that file), as the frontend is otherwise the same
and uses global variables.

The tests used to determine which features are available are also exported, as
`LibAV.isWebAssemblySupported` and `LibAV.isThreadingSupported`.

NOTE: libav.js used to have a SIMD build as well. This was dropped because none
of the constituent libraries actually support WebAssembly SIMD, so it
substantially increased the size and time of builds to no benefit.


## Which files do I need?

You need the main entry file and at least one target, for a minimum of three
files, but you should probably include several others.

The main entry file is named as follows: `libav-<version>-<variant>.js`. You
only need the variant you intend to use. The debug version is named
`libav-<version>-<variant>.dbg.js`, and you can use that in place of the
original, but it is not required.

That entry file will load a target based on the environment it's loaded in and
the options used to load it, as described above. The supported targets are
asm.js, plain WebAssembly, and threaded WebAssembly. It is harmless to include
all of them, as users will not download all of them, only the ones they use.
But, you may also include only those you intend to use. In every case, there is
a `.dbg.js` equivalent which is only needed if you intend to use debug mode.

 * asm.js: Named `libav-<version>-<variant>.asm.js`. No modern browser excludes
   support for WebAssembly, so this is probably not necessary.

 * Plain WebAssembly: Named `libav-<version>-<variant>.wasm.js` and
   `libav-<version>-<variant>.wasm.wasm`. Used in most situations.

 * Threaded WebAssembly: Named `libav-<version>-<variant>.thr.js` (and
   `.thr.wasm`). Used only when threading is supported by the browser *and*
   `yesthreads` is set. If you don't intend to use threads (set `yesthreads`),
   it is safe to exclude this. Used in most threaded situations.

At a minimum, it is usually sufficient to include only the `.js`, `.wasm.js`,
and `.wasm.wasm` files. To include threads, you must also include `.thr.js` and
`.thr.wasm`.

The file `libav.types.d.ts` is a TypeScript types definition file, and is only
needed to compile TypeScript code with support for libav.js's types. It should
never be necessary to distribute.

Note that, independently of what files are available to end users, *you are
contractually obligated to release the source code of libav.js and all of its
dependencies* if you provide the compiled version. If you are using a compiled,
released version, it is sufficient to provide the `sources` directory.

libav.js is published to NPM as `libav.js`, and each released variant is
published in a much smaller NPM package as `@libav.js/variant-<variant>`. The
CDN example above uses the `@libav.js/variant-default` package, for example.


## API

The API exposed by libav.js is more-or-less exactly the functions exposed by
the libav libraries, using promises. Because of the promise-based design, the
interface is identical whether Web Workers are used or not.

For an exact list of the functions, see `funcs.json` or `libav.types.d.ts`.

Most structs are exposed as raw pointers (numbers), and their parts can be
accessed using accessor functions named `Struct_member` and `Struct_member_s`.
For instance, to read `frame_size` from an `AVCodecContext`, use `await
AVCodecContext_frame_size(ctx)`, and to write it, use `await
AVCodecContext_frame_size_s(ctx, frame_size)`. There are also libav.js-specific
JavaScript objects for many of them, documented in `libav.types.d.ts`.

Some libav functions take double-pointers so that they can return both an
allocated pointer value and (if applicable) an error code, and where possible
these are wrapped in `_js` versions which simply return a pointer. For
instance, `avfilter_graph_create_filter`, which takes an `AVFilterContext **`
as its first argument, is exposed as `avfilter_graph_create_filter_js`, which
elides the first argument and returns an `AVFilterContext *`.

Some common sequences of functions are combined into `ff_` metafunctions. See
[API.md](docs/API.md) for how to use them.

Further examples are available in the `samples` directory of
https://github.com/ennuicastr/libavjs-webcodecs-polyfill , which uses libav.js
along with WebCodecs (or its own polyfill of WebCodecs), so shows how to marry
these two technologies.

In order to reduce license-header Hell, the small amount of wrapper functions
provided by libav.js are all released under the so-called “0-clause BSD”
license, which does not require that the license text itself appear in
derivative works. Built libraries have their correct license headers.


## Devices and asynchrony

Emscripten's implementation of an in-memory filesystem has severe limitations.
You're recommended to use virtual devices, implemented by `libav.js`, for most
I/O. See [IO.md](docs/IO.md) for more details.

ffmpeg was never designed to work asynchronously, and was only designed to work
with blocking I/O. Still, it's possible to use libav.js with asynchronous input
through these devices.


## TypeScript

Type definitions for libav.js are provided by `libav.types.d.ts`. You can
either copy this file and import it:

```typescript
import type LibAVJS from "./libav.types";
declare let LibAV: LibAVJS.LibAVWrapper;
```

or import it from the npm package:

```typescript
import type LibAVJS from "libav.js";
declare let LibAV: LibAVJS.LibAVWrapper;
```


## Variants

With all of its bells and whistles enabled, FFmpeg is pretty large. So, I
disable most bells and most whistles and build specific versions with specific
features.

The default variant, libav-`<version>`-default.js, includes support for the most
important (and timeless) audio codecs and formats: Opus, FLAC, and wav, in WebM,
ogg, FLAC, or wav containers. It also has a set of common audio filters.

Built-in variants are created by combining “configuration fragments”. You can
find more on configuration fragments or making your own variants in
[CONFIG.md](docs/CONFIG.md).

Use `make build-variant`, replacing `variant` with the variant name, to build
another variant.

Most of the variants provided in the repository are also built and available in
NPM and as binary releases. The notable exception is all variants that include
codecs controlled by the Misanthropic Patent Extortion Gang (MPEG). They are not
built by default, and if you have any sense, you should not use them. MPEG is a
cancer on the digital media ecosystem.

The included variants are:

 * default, default-cli: Opus (via libopus), FLAC, and wav in ogg, WebM, FLAC,
   and wav containers, plus audio filters. The `-cli` subvariant additionally
   includes the CLI (`ffmpeg` and `ffprobe` functions).

 * opus, opus-af: Opus in ogg or WebM. `-af` additionally includes audio
   filters.

 * flac, flac-af: FLAC in ogg or FLAC. `-af` additionally includes audio
   filters.

 * wav, wav-af: PCM wav (16-bit or 24-bit) in wav. `-af` additionally includes
   audio filters.

 * obsolete: Same as default with the addition of two obsolete codecs, Vorbis
   (via libvorbis) and MPEG-1 Layer 3 (MP3) (via libmp3lame). Also includes the
   MP3 container format.

 * webm, webm-vp9¹, webm-cli, webm-vp9-cli¹: Same as default with the addition
   of VP8 (via libvpx) and video filters. `-vp9` additionally includes VP9,
   `-cli` additionally includes the CLI. `-vp9` is separated due to the rather
   significant size of the VP9 codec.

 * webcodecs, webcodecs-avf: Designed to serve as a demuxer/muxer for codecs
   supported by WebCodecs. Pairs well with
   [libavjs-webcodecs-bridge](https://github.com/Yahweasel/libavjs-webcodecs-bridge).
   Includes codecs for Opus, FLAC, and wav. Includes *parsers* (but not codecs)
   for AAC, VP8, VP9, AV1, H.264, and H.265. Includes the ogg, WebM, MP4, FLAC,
   and wav formats. This means that it can demux files including, e.g., H.264,
   but cannot decode the frames. If your WebCodecs supports H.264, you can then
   use it to decode. `-avf` additionally includes audio and video filters.

 * vp8-opus, vp8-opus-avf: VP8 and Opus in WebM (or ogg). `-avf` additionally
   includes audio and video filters.

 * vp9-opus¹, vp9-opus-avf¹: VP9 and Opus in WebM (or ogg). `-avf` additionally
   includes audio and video filters.

 * av1-opus¹, av1-opus-avf¹: AV1 (via libaom) and Opus in WebM (or ogg). Note
   that AV1 support is currently so slow in WebAssembly even with threads that
   these variants are effectively unusable. `-avf` additionally includes audio
   and video filters.

 * aac², aac-af²: Reprobate codec AAC in MP4 or AAC/ADTS. `-af` additionally
   includes audio filters.

 * h264-aac², h264-aac-avf²: Reprobate codec H.264 (via libopenh264) and
   reprobate codec AAC in MP4 (or AAC/ADTS). `-avf` additionally includes audio
   and video filters.

 * hevc-aac², hevc-aac-avf²: Reprobate codec H.265 (decoding only) and reprobate
   codec AAC in MP4 (or AAC/ADTS). `-avf` additionally includes audio and video
   filters.

¹ These builds are not included in the full NPM release for space reasons, but are
  included in GitHub releases, and are available on NPM as
  @libav.js/variant-`<variant>`, e.g. `@libav.js/variant-vp9-opus`.

² Includes technologies patented by the Misanthropic Patent Extortion Gang
  (MPEG). You should not build these, you should not use these builds, and you
  should not support this organization which works actively against the common
  good.


This is intentionally designed so that you can add new variants without needing
to patch anything that already exists. If you want to create your own variants,
see [CONFIG.md](docs/CONFIG.md).

You can also build against different versions of FFmpeg than the version built
by default. To build against, for instance, FFmpeg 4.3.6, use `make
FFMPEG_VERSION_MAJOR=4 FFMPEG_VERSION_MINREV=3.6`. Note that you *must* use
`FFMPEG_VERSION_MAJOR` and `FFMPEG_VERSION_MINREV`, not just `FFMPEG_VERSION`,
because `FFMPEG_VERSION_MAJOR` is used to direct the process of patching FFmpeg.
libav.js should generally build against any version of FFmpeg in the 4, 5, or 6
series, but is not heavily tested against older versions; you should use the
default version unless you have some specific compatibility issue that forces
you to use a different version.


## Size

FFmpeg is big, so libav.js is big. But, it's not ludicrous; the WebAssembly is
usually between 1.5 and 3 MiB for fairly complete builds, and the asm.js is about
double that.

You can estimate the size of variants based on the size of the constituent
fragments. As of version 4.10.6.1.1, an empty build is approximately 589KiB
(WebAssembly). The sizes of each additional fragment can be found in
[fragment-sizes.csv](tools/fragment-sizes.csv). The data in that CSV file can be
recreated by `tools/fragment-sizes.sh`, but note that the CSV file in the
repository is after further processing (in particular, normalizing to KiB and
subtracting away the empty size).

The asm.js versions are much bigger, but will not be loaded on
WebAssembly-capable clients.

The wrapper (“glue”) code is about 304KiB, but is highly compressible.


## Performance

Generally speaking, the performance of audio en- and decoding is much faster
than real time, to the point that it's simply not a concern for most
applications. The author of libav.js regularly uses libav.js in live audio
systems.

Video is a different story, of course.

Video is nowhere near as slow as you might imagine. On reasonable systems,
faster-than-real-time performance for decoding of up to 1080P is achievable if
you use a threaded version of libav.js. If you're willing to use older, simpler
video codecs and lower-resolution video, even real-time *encoding* is possible.
But, for complex codecs, real-time en/decoding is not realistic. One of the
revolutions of video en/decoding is hardware en/decoding, and libav.js cannot do
that, so its performance ceiling is already low.

Muxing and demuxing are bound by I/O time, not software performance. libav.js
will always mux or demux faster than you can use the data.


## libav.js and WebCodecs

On some modern browsers, the WebCodecs API is availble for hardware-accelerated
(or at least, CPU-specific) en/decoding of various codecs. When it is available,
it is better to use it than libav.js. However, WebCodecs does not mux or demux,
and which codecs it supports varies based on the moods of its implementor (if it
is even present), so generally, it is necessary to support WebCodecs but fall
back to libav.js when necessary.

To make this easier, two companion projects to libav.js are provided that
connect it to WebCodecs:

 * [libavjs-webcodecs-polyfill](https://github.com/ennuicastr/libavjs-webcodecs-polyfill)
   is a polyfill for the WebCodecs API using libav.js. Even if WebCodecs exists
   on your browser, this polyfill allows the user to guarantee a certain set of
   supported codecs; any codecs not supported by the built-in WebCodecs can
   simply fall back to libav.js, using only one API.

 * [libavjs-webcodecs-bridge](https://github.com/Yahweasel/libavjs-webcodecs-bridge)
   is a bridge between libav.js and WebCodecs, converting between the two data
   formats. This makes it easy to use libav.js for demuxing and WebCodecs for
   decoding, or WebCodecs for encoding and libav.js for muxing. Of course, the
   WebCodecs used with the bridge can easily be the polyfill if needed.


## Bundlers

Generally speaking, because libav.js needs to adjust its loading procedure based
on the environment it's being loaded in, it's not a good idea to bundle
libav.js. However, if you have to bundle it, it can be done if necessary.
Bundlers such as WebPack, esbuild, Vite, Rollup, etc., may change the names and
location of the LibAV's JavaScript and WebAssembly files or even turn them into
modules.  In these cases, the location of the JavaScript and WebAssembly file of
a LibAV variant can be overridden by options set on the `LibAV` object after
loading libav.js, similar to `LibAV.base`.  `LibAV.toImport` and `LibAV.wasmurl`
override the URL of the used JavaScript and WebAssembly file respectively. These
are usually located in the libav.js directory and follow the scheme
`libav-VER-CONFIGDBG.TARGET.js` and `libav-VER-CONFIGDBG.TARGET.wasm`,
respectively.  The version (`VER`), variant (`CONFIG`) and debug (`DBG`) string
are exposed as `LibAV.VER`, `LibAV.CONFIG` and `LibAV.DBG` respectively after
loading LibAV.  However, you can generally successfully load a different variant
or debuggability level, so these are provided to allow you to verify what your
bundler actually bundled.  The target corresponds to the browser features
available, and can vary between different browsers or other environments. As
such, it should be determined at runtime, which can be done by calling
`LibAV.target()`. For instance, a possible way to retrieve the URL in a module
can be ``new
URL(`node_modules/libav.js/libav-${globalThis.LibAV.VER}-opus.${target}.wasm`,
import.meta.url).href``, but be sure to consult the documentation of your
bundler. Note the variant `opus` is hard-coded in this case to prevent the
bundler from including all variants.

Some bundlers turn LibAV code from a CommonJS module to an ECMAScript 6 module,
which will if loaded in a worker interfere with LibAV's loading code.  In this
case, LibAV's JavaScript code needs to be imported manually before calling the
factory function of the LibAV instance: ``await
import(`../node_modules/libav.js/libav-${globalThis.LibAV.VER}-opus.${target}.js`)``.
Note that dynamically importing ECMAScript 6 modules is supported by all major
browsers, but at the time of this wriging, on Firefox, is protected by a flag
that most users will not have enabled.
