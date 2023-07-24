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

 * (API.md)[docs/API.md] describes the libav.js-specific parts of the API.

 * (CONFIG.md)[docs/CONFIG.md] describes the configuration system and how to
   create your own configuration of libav.js.

 * (IO.md)[docs/IO.md] describes the various I/O modes provided by libav.js.

 * (TESTS.md)[docs/TESTS.md] describes the testing framework.


## Using libav.js

Include dist/libav-`version`-`variant`.js to use libav.js. The variants are
discussed below.

The simplest way to use libav.js is to include it from a CDN, but this is not
recommended, as libav.js uses Web Workers by default, and Web Workers cannot be
loaded from a different origin. Nonetheless, the following is a simple example
of using libav.js from a CDN:

```html
<!doctype html>
<html>
    <body>
        <script type="text/javascript">LibAV = {base: "https://unpkg.com/libav.js@4.3.6/dist"};</script>
        <script type="text/javascript" src="https://unpkg.com/libav.js@4.3.6/dist/libav-4.3.6.0-default.js"></script>
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
        <script type="text/javascript" src="libav-4.3.6.0-default.js"></script>
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
    "nosimd": false,
    "base": LibAV.base
}
```
`nowasm` and `nosimd` affect what forms of code libav.js is allowed to load. By
default it will load SIMD WebAssembly if the browser supports it, non-SIMD
WebAssembly if the browser supports WebAssembly but not SIMD, and asm.js if the
browser supports no WebAssembly. These are overridable here for testing purposes
only.

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

libav.js automatically detects which WebAssembly features are available, so
even if you set `yesthreads` to `true` and don't set `nosimd`, a version with
neither feature may be loaded. To know which version will be loaded, call
`LibAV.target`. It will return `"asm"` if only asm.js is used, `"wasm"` for
baseline, or `"thr"`, `"simd"`, or `"thrsimd"` for versions with extensions
activated. These strings correspond to the filenames to be loaded, so you can
use them to preload and cache the large WebAssembly files. `LibAV.target` takes
the same optional argument as `LibAV.LibAV`.

The `base` option can be used in these options in place of `LibAV.base`, and
will override `LibAV.base` if set.

The tests used to determine which features are available are also exported, as
`LibAV.isWebAssemblySupported`, `LibAV.isThreadingSupported`, and
`LibAV.isSIMDSupported`.


## Which files do I need?

You need the main entry file and at least one target, for a minimum of three
files, but you should probably include several others.

The main entry file is named as follows: `libav-<version>-<variant>.js`. You
only need the variant you intend to use. The debug version is named
`libav-<version>-<variant>.dbg.js`, and you can use that in place of the
original, but it is not required.

That entry file will load a target based on the environment it's loaded in and
the options used to load it, as described above. The supported targets are
asm.js, plain WebAssembly, SIMD WebAssembly, threaded WebAssembly, and
threaded+SIMD WebAssembly. It is harmless to include all of them, as users will
not download all of them, only the ones they use. But, you may also include only
those you intend to use. In every case, there is a `.dbg.js` equivalent which is
only needed if you intend to use debug mode.

 * asm.js: Named `libav-<version>-<variant>.asm.js`. No modern browser excludes
   support for WebAssembly, so this is probably not necessary.

 * Plain WebAssembly: Named `libav-<version>-<variant>.wasm.js` and
   `libav-<version>-<variant>.wasm.wasm`. Since most browsers support SIMD, this
   is actually rarely used in practice, but if you want to reduce the number of
   builds, it's better to set `nosimd` and *only* use this version.

 * SIMD WebAssembly: Named `libav-<version>-<variant>.simd.js` (and
   `.simd.wasm`). Used in most situations.

 * Threaded WebAssembly: Named `libav-<version>-<variant>.thr.js` (and
   `.thr.wasm`). Used only when threading is supported by the browser *and*
   `yesthreads` is set. If you don't intend to use threads (set `yesthreads`),
   it is safe to exclude this. Like with unthreaded WebAssembly, most real
   browsers will load the SIMD version, but you can set `nosimd` to always load
   this version and thus reduce the number of files you need to distribute.

 * Threaded+SIMD WebAssembly: Named `libav-<version>-<variant>.thrsimd.js` (and
   `.thrsimd.wasm`). Used in most threaded situations.

At a minimum, it is usually sufficient to include only the `.js`, `.wasm.js`,
and `.wasm.wasm` files, if you always set `nosimd`. To include SIMD support, you
must also include `.simd.js` and `.simd.wasm`. Similarly, to include threads,
you must include `.thr.js` and `.thr.wasm`, and to include both, `.thrsimd.js`,
`.thrsimd.wasm`.

The file `libav.types.d.ts` is a TypeScript types definition file, and is only
needed to compile TypeScript code with support for libav.js's types. It should
never be necessary to distribute.

Note that, independently of what files are available to end users, *you are
contractually obligated to release the source code of libav.js and all of its
dependencies* if you provide the compiled version. If you are using a compiled,
released version, it is sufficient to provide the `sources` directory.


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
I/O.

ffmpeg was never designed to work asynchronously, and was only designed to work
with blocking I/O. Still, it's possible to use libav.js with asynchronous input
through devices.

The `mkreaderdev` function creates a reader device, which simply acts as a pipe.
That device can be used as a file for reading.

Initializing a demuxer is particularly troublesome: you must start initializing
and save the promise aside, then so long as something is waiting on the device,
feed it data. See `tests/test-demuxing-device.js` for an example.

Output through writer devices is also possible. See
`tests/test-muxing-device.js` for an example.


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

The default build, libav-`version`-default.js, includes supports for all of the
most important audio formats for the web: Opus in WebM or ogg containers, AAC
in the M4A container, and FLAC and 16- or 24-bit wav in their respective
containers. Also supported are all valid combinations of those formats and
containers, e.g. any codec in Matroska (since WebM is Matroska), FLAC in ogg,
etc.

Built-in variants are created by combining “configuration fragments”. You can
find more on configuration fragments or making your own variants in
[CONFIG.md](docs/CONFIG.md).

Use `make build-variant`, replacing `variant` with the variant name, to build
another variant.

libav.js includes several other variants, listed here by feature:

| Variant Name		| mp4	| ogg	| webm	| aac	| flac	| opus	| wav	| Standard audio filters	| Video						| Others	|
| ----------------- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ------------------------- | ------------------------- | --------- |
| default			| x		| x		| x		| 		| x		| x		| x		| x							|							| |
| lite				| 		| x		| 		| 		| x		| x		| x		| x							|							| |
| fat				| x		| x		| 		| x		| x		| x		| x		| x							|							| vorbis, alac, wavpack |
| obsolete			| x		| x		| x		| x		| x		| x		| 		| x							|							| mp3, vorbis |
| opus				| 		| x		| 		| 		| 		| x		| 		| 							|							| |
| flac				| 		| 		| 		| 		| x		| 		| 		| 							|							| |
| opus-flac			| 		| x		| 		| 		| x		| x		| 		| 							|							| |
| webm				| x		| x		| x		| x		| x		| x		| x		| x							| VP8						| |
| webm-opus-flac	| 		| x		| x		| 		| x		| x		| 		| 							| VP8						| |
| mediarecorder-transcoder | x | x	| x		| x		| x		| x		| 		| 							| VP8, H.264 (decoding)		| |
| open-media		| 		| x		| x		| 		| x		| x		| 		| 							| VP8, VP9, AV1				| vorbis |
| webcodecs			| x		| x		| x		| x		| x		| x		| 		| 							| VP8						| Note 1 |

The following variants have defined configurations, and so can be built “out of
the box”, but are not included in libav.js distributions.

| Variant Name		| mp4	| ogg	| webm	| aac	| flac	| opus	| wav	| Standard audio filters	| Video						| Others	|
| ----------------- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ------------------------- | ------------------------- | --------- |
| all-audio-cli		| x		| x		| x		| x		| x		| x		| x		| x							|							| floating-point wav, mp3, vorbis. Note 2 |
| rawvideo			| x		| x		| x		| x		| x		| x		| 		| 							| VP8, H.264 (decoding), rawvideo | |
| h265				| x		| 		| x		| 		| 		| 		| 		| 							| H.265 (decoding)			| Note 3 |
| prores			| x		| x		| 		| 		| 		| 		| 		| 							| ProRes					| |
| mediarecorder-transcoder | x | x	| x		| x		| x		| x		| 		| 							| VP8, H.264				| Note 3 |
| all				| x		| x		| x		| x		| x		| x		| x		| x							| (All)						| (All) |

Note 1: Also includes bitstream data extractors for VP9, AV1, H.264, and H.265.
This makes the `webcodecs` variant ideal for pairing with WebCodecs, using
WebCodecs to do the actual decoding.

Note 2: Also includes the CLI (`ffmpeg` and `ffprobe` functions).

Note 3: Includes technologies patented by the Misanthropic Patent Extortion
Gang (MPEG). You should not use these builds, and you should not support this
organization which works actively against the common good.

To create a variant from configuration fragments, run `./mkconfig.js` in the
`configs` directory. The first argument is the name of the variant to make, and
the second argument is the JSON array of fragments to include.

To create other variants, simply create the configuration for them in
subdirectories of `configs` and, if necessary, add Makefile fragments to `mk`.

This is intentionally designed so that you can add new configurations without
needing to patch anything that already exists. See the existing variants'
configuration files in `config` and the existing fragments in `mk` to
understand how.


## Size

FFmpeg is big, so libav.js is big. But, it's not ludicrous; the WebAssembly is
usually between 1.5 and 3 MiB for fairly complete builds, and the asm.js is about
double that.

You can estimate the size of variants based on the size of the constituent
fragments. As of version 3.9.5.1.2, an empty build is approximately 540KiB
(WebAssembly), and the fragments add the following:

| Fragment      | Size (KiB)    |
| ------------: | :------------ |
| ogg           | 68            |
| webm          | 164           |
| ipod          | 376           |
|               |               |
| opus          | 284           |
| aac           | 272           |
| vorbis        | 452           |
| lame          | 276           |
| flac          | 84            |
| wav           | 52            |
| wavpack       | 108           |
| alac          | 28            |
|               |               |
| vpx+vp8       | 344           |
| vpx+vp9       | 748           |
| vpx+vp8+vp9   | 1044          |
| av1           | 3500          |
| h263p         | 660           |
| h264          | 500           |
| openh264      | 832           |
|               |               |
| audio-filters | 260           |
| swscale       | 412           |

The asm.js versions are much bigger, but will not be loaded on
WebAssembly-capable clients.

The wrapper (“glue”) code is about 292KiB, but is highly compressible.


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
