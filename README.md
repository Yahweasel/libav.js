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
        <script type="text/javascript">LibAV = {base: "https://unpkg.com/libav.js@3.1.4"};</script>
        <script type="text/javascript" src="https://unpkg.com/libav.js@3.1.4/libav-3.2.4.4-default.js"></script>
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
        <script type="text/javascript" src="libav-3.2.4.4-default.js"></script>
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
loading options may be provided, but they're rarely useful. The only loading
options are `noworker` and `nowasm`, to disable using Web Workers and
WebAssembly, respectively.


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

In order to reduce license-header Hell, the small amount of wrapper functions
provided by libav.js are all released under the so-called “0-clause BSD”
license, which does not require that the license text itself appear in
derivative works. Built libraries have their correct license headers.


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
usually between 2 and 3 MiB for fairly complete builds, and the asm.js is about
double that.

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
