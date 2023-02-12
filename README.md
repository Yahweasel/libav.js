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

Include libav-`version`-`variant`.js to use libav.js. The variants are
discussed below.

The simplest way to use libav.js is to include it from a CDN, but this is not
recommended, as libav.js uses Web Workers by default, and Web Workers cannot be
loaded from a different origin. Nonetheless, the following is a simple example
of using libav.js from a CDN:

```html
<!doctype html>
<html>
    <body>
        <script type="text/javascript">LibAV = {base: "https://unpkg.com/libav.js@3.11.5"};</script>
        <script type="text/javascript" src="https://unpkg.com/libav.js@3.11.5/libav-3.11.5.1.2-default.js"></script>
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
        <script type="text/javascript" src="libav-3.11.5.1.2-default.js"></script>
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

libav.js exposes a global variable, LibAV, for all API access. If LibAV is set
before loading the library, libav.js does *not* replace it, but extends it:
This gives you an opportunity to pass in values critical for loading. In
particular, if the base directory (directory in which libav's files are
located) isn't ".", then you must set `LibAV.base` to the correct base
directory, as in the CDN example above. `LibAV.base` does not need to be a full
URL, but should be if loading from another origin.

`LibAV.LibAV` is a factory function which returns a promise which resolves to a
ready instance of libav. `LibAV.LibAV` takes an optional argument in which
loading options may be provided, but they're rarely useful. The loading options and their default values are:
```
{
    "noworker": false,
    "nowasm": false,
    "yesthreads": false,
    "nothreads": false,
    "nosimd": false
}
```
If `noworker` is set, Web Workers will be disabled, so libav.js runs in the
main thread. If `nowasm` is set, WebAssembly will be disabled. WebAssembly
threads are disabled by default *and not built by default*, as most browsers
have a limit to the number of worker threads an entire page is allowed to
have, so instead, `yesthreads` must be set to enable threads, and you'll have
to build the threaded versions manually. Note that separate instances of
libav.js, created by separate calls to `LibAV.LibAV`, will be in separate
threads as long as workers are used, regardless of the value of `yesthreads`,
and this is how you're intended to thread libav.js. If `nothreads` is set then
threads will be disabled even if `yesthreads` is set (this is so that the
default setting of threads can be changed in the future). If `nosimd` is set,
WebAssembly's SIMD extension won't be used.

libav.js automatically detects which WebAssembly features are available, so
even if you set `yesthreads` to `true` and don't set `nosimd`, a version with
neither feature may be loaded. To know which version will be loaded, call
`LibAV.target`. It will return `"asm"` if only asm.js is used, `"wasm"` for
baseline, or `"thr"`, `"simd"`, or `"thrsimd"` for versions with extensions
activated. These strings correspond to the filenames to be loaded, so you can
use them to preload and cache the large WebAssembly files. `LibAV.target` takes
the same optional argument as `LibAV.LibAV`.

The tests used to determine which features are available are also exported, as
`LibAV.isWebAssemblySupported`, `LibAV.isThreadingSupported`, and
`LibAV.isSIMDSupported`.


## API

The API exposed by libav.js is more-or-less exactly the functions exposed by
the libav libraries, using promises. Because of the promise-based design, the
interface is identical whether Web Workers are used or not.

For an exact list of the functions, see `funcs.json` or `libav.types.d.ts`.

Most structs are exposed as raw pointers (numbers), and their parts can be
accessed using accessor functions named `Struct_member` and `Struct_member_s`.
For instance, to read `frame_size` from an `AVCodecContext`, use `await
AVCodecContext_frame_size(ctx)`, and to write it, use `await
AVCodecContext_frame_size_s(ctx, frame_size)`.

Some libav functions take double-pointers so that they can return both an
allocated pointer value and (if applicable) an error code, and where possible
these are wrapped in `_js` versions which simply return a pointer. For
instance, `avfilter_graph_create_filter`, which takes an `AVFilterContext **`
as its first argument, is exposed as `avfilter_graph_create_filter_js`, which
elides the first argument and returns an `AVFilterContext *`.

Some common sequences of functions are combined into `ff_` metafunctions. See
the documentation in `libav.types.d.ts` for how to use them, or the tests in
`tests` for examples.

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

Finally, the “mediarecorder-openh264” variant, relative to
“mediarecorder-transcoder”, adds H.264 *encoding* support, through libopenh264.
Note that H.264 is under patent until at least 2024, and the use of the
libopenh264 encoder in this context before that time opens you to the
possibility of patent litigation, unless you have patent rights. For this
reason, this variant is not provided pre-built in releases, and you must build
it yourself if you want it. Cisco, who authors libopenh264, grants a patent
license to its users, but this license applies only to users of the precompiled
version compiled by Cisco, and no such version is provided in WebAssembly, so
it does not apply to use in libav.js. (`["ogg", "webm", "opus", "ipod", "aac",
"flac", "swscale", "vpx", "vp8", "h264", "openh264"]`)

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
