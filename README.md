# libav.js

This is a compilation of the libraries associated with handling audio and video
in FFmpeg—libavformat, libavcodec, libavfilter, libavutil and libswresample—for
WebAssembly and asm.js, and thus the web. It is compiled via emscripten.  This
compilation exposes the *library* interface of FFmpeg, not ffmpeg itself, and
there is a separate project by a different author, ffmpeg.js, if what you need
is ffmpeg.

In short, this is a pure JavaScript and WebAssembly system for low-level audio
and video encoding, decoding, muxing, demuxing, and filtering.

FFmpeg is released under the LGPL. Therefore, if you distribute this library,
you must provide sources. The sources are included in the `sources/` directory
of the compiled version of libav.js.


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
        <script type="text/javascript">LibAV = {base: "https://unpkg.com/libav.js@3.11.6/dist"};</script>
        <script type="text/javascript" src="https://unpkg.com/libav.js@3.11.6/dist/libav-3.11.6.0-default.js"></script>
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
        <script type="text/javascript" src="libav-3.11.6.0-default.js"></script>
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
libav.js synchronous with your worker thread.  However, in that case, you must
set `LibAV.nolibavworker = true` before loading; this tells the loading code of
libav.js that it is not running in a worker that it created, and so should not
load its own worker code.  Otherwise, loading it `noworker` in a worker is
likely to fail, as it will interfere with your own worker's message handling.

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

libav.js includes several other variants:

The “lite” variant removes, relative to the default variant, AAC, and the M4A
and WebM/Matroska containers.

The “fat” variant adds, relative to the default variant, Vorbis, wavpack and
its container, and ALAC.

The “obsolete” variant adds, relative to the default variant, two obsolete but
still commonly found audio formats, namely Vorbis in the ogg container and MP3
in its own container. Note that while Vorbis has been formally replaced by
Opus, at the time of this writing, Opus still has lackluster support in audio
software, so Vorbis is still useful. MP3, on the other hand, is completely
worthless, and is only supplied in case your end users are idiots. Friends
don't let friends use MP3.

The “opus”, “flac”, and “opus-flac” variants are intended just for encoding or
decoding Opus and/or FLAC. They include only their named format(s), the
appropriate container(s), and the `aresample` filter; in particular, no other
filters are provided whatsoever. With Opus in particular, this is a better
option than a simple conversion of libopus to JavaScript, because Opus mandates
a limited range of audio sample rates, so having a resampler is beneficial.

The “webm” variant, relative to the default variant, includes support for VP8
video. The “webm-opus-flac” variant, relative to “opus-flac”, includes support
for VP8 video, as “webm”, but excludes all filters except aresample. The
“mediarecorder-transcoder” variant, relative to “webm-opus-flac”, adds MPEG-4
AAC and H.264, making it sufficient for transcoding formats that MediaRecorder
can produce on all platforms. Note that support is not included for *encoding*
MPEG-4 video, only decoding.

Finally, the “mediarecorder-openh264” variant, relative to
“mediarecorder-transcoder”, adds H.264 *encoding* support, through libopenh264.
Note that H.264 is under patent until at least 2024, and the use of the
libopenh264 encoder in this context before that time opens you to the
possibility of patent litigation, unless you have patent rights. For this
reason, this variant is not provided pre-built in releases, and you must build
it yourself if you want it. Cisco, who authors libopenh264, grants a patent
license to its users, but this license applies only to users of the precompiled
version compiled by Cisco, and no such version is provided in WebAssembly, so
it does not apply to use in libav.js.

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
