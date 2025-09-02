# libav.js

This is a compilation of the libraries associated with handling audio and video
in FFmpeg—libavformat, libavcodec, libavfilter, libavutil and libswresample—for
WebAssembly and asm.js, and thus the web, as well as the `ffmpeg` and `ffprobe`
CLIs themselves. It is compiled via emscripten, is highly customizable, and has
a ruthless commitment to correct licensing.

In short, this is a pure JavaScript and WebAssembly system for low-level audio
and video encoding, decoding, muxing, demuxing, and filtering.

FFmpeg is released under the LGPL. Therefore, if you distribute this library,
you must provide sources. The sources are included in the `sources/` directory
of the compiled version of libav.js.

In order to reduce license-header Hell, the small amount of wrapper functions
provided by libav.js are all released under the so-called “0-clause BSD”
license, which does not require that the license text itself appear in
derivative works. Built libraries have their correct license headers.

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
        <script type="text/javascript" src="https://cdn.jsdelivr.net/npm/@libav.js/variant-default@6.8.8/dist/libav-6.8.8.0-default.js"></script>
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
        <script type="text/javascript" src="libav-6.8.8.0-default.js"></script>
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

Use `.dbg.js` instead of `.js` for a non-minified, more debuggable version. Use
`.mjs` for the ES6 module version. Use `.dbg.mjs` for both. You don't need any
combination; e.g., if you only intend to use imports, you do not need any `.js`
files.

libav.js exposes a global variable, `LibAV`, for all API access. If importing as a
module, `LibAV` is the default export.

For certain unusual loading situations, you can set the `LibAV` global variable
before importing. In particular, if the base directory (directory in which
libav's files are located) can't be detected for some reason, then you must set
`LibAV.base` to the correct base. `LibAV.base` does not need to be a full URL,
but should be if loading from another origin.

Bundlers have further concerns. To use libav.js with a bundler, see the section
on bundlers below.

`LibAV.LibAV` is a factory function which returns a promise which resolves to a
ready instance of libav. The factory function and libav instance methods are
documented in [API.md](docs/API.md).


## Which files do I need?

You need the main entry file and at least one target, for a minimum of three
files, but you should probably include several others.

The main entry file is named as follows: `libav-<version>-<variant>.js`. You
only need the variant you intend to use. The debug version is named
`libav-<version>-<variant>.dbg.js`, and you can use that in place of the
original, but it is not required. If using ES6 modules, use `mjs` in place of
`js`.

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

 * Threaded WebAssembly: Named `libav-<version>-<variant>.thr.js`, `.thr.wasm`,
   and `.thr.worker.js`. Used only when threading is supported by the browser
   *and* `yesthreads` is set. If you don't intend to use threads (set
   `yesthreads`), it is safe to exclude this. Used only when threads are
   activated and supported.

At a minimum, it is usually sufficient to include only the `.js`, `.wasm.js`,
and `.wasm.wasm` files. To include threads, you must also include `.thr.js` and
`.thr.wasm`. Again, use `mjs` instead of `js` if using ES6 imports.

The file `libav.types.d.ts` is a TypeScript types definition file, and is only
needed to compile TypeScript code with support for libav.js's types. It should
never be necessary to distribute.

Note that, independently of what files are available to end users, *you are
contractually obligated to release the source code of libav.js and all of its
dependencies* if you provide the compiled version. If you are using a compiled,
released version, it is sufficient to provide the `sources` directory.

libav.js is published to NPM as `libav.js`, and each released variant is
published in a much smaller NPM package as `@libav.js/variant-<variant>`. The
CDN example above uses the `@libav.js/variant-default` package, for example. The
`@libav.js/types` package is also provided with only the types (`.d.ts` file),
and if using TypeScript, you are highly recommended to use it, to avoid bringing
entire variants in as dependencies of your own packages.

### Why the version number in the filenames?

Caching is Hell.

`libav-<variant>.*` is also available in the releases and repository, but you're
highly recommended *not* to use this name on any web installation, as caching
will cause strange nonsense to happen. Use a full versioned name to avoid
caching madness.


## Devices and asynchrony

Emscripten's implementation of an in-memory filesystem has severe limitations.
You're recommended to use virtual devices, implemented by `libav.js`, for most
I/O. See [IO.md](docs/IO.md) for more details. libav.js itself imposes no
restriction on file sizes so long as you use asynchronous, device-backed I/O
(thus, the only restriction to size is JavaScript's number type).

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


## Variants and Building libav.js

With all of its bells and whistles enabled, FFmpeg is pretty large. So, I
disable most bells and most whistles and build specific versions with specific
features.

The default variant, `libav-<version>-default.js`, includes support for the most
important (and timeless) audio codecs and formats: Opus, FLAC, and wav, in WebM,
ogg, FLAC, or wav containers. It also has a set of common audio filters.

Built-in variants are created by combining “configuration fragments”. You can
find more on configuration fragments or making your own variants in
[CONFIG.md](docs/CONFIG.md).

Use `make build-<variant>`, replacing `<variant>` with the variant name, to
build another variant.

Most of the variants provided in the repository are also built and available in
NPM and as binary releases. The notable exception is all variants that include
codecs controlled by the Misanthropic Patent Extortion Gang (MPEG). They are not
built by default, and if you have any sense, you should not use them. MPEG is a
cancer on the digital media ecosystem.

The included variants and their codecs and formats are:

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


## Modular variants

In addition to the variants described above, a large number of modular variants
are provided, each of which is sufficient for demuxing exactly one format, or
decoding exactly one codec. The purpose of these modular variants is to make it
easy to support every conceivable input file without making a massive
monolithic build of libav.js.

The modular variants are not available in NPM. Instead, most are provided in
releases on GitHub with the suffix `-modular`. This release does not include
popular reprobate codecs; you will need to build them yourself if you need
them.

Demuxer variants are named `demuxer-<format>`, e.g. `demuxer-matroska` and
`demuxer-mp4`. Decoder variants are named `decoder-<codec>`, e.g.
`decoder-opus` and `decoder-aac`. Each provides *only* functions related to
demuxing or decoding, respectively.

The modular variants are best paired with
[AVGuesser](https://github.com/Yahweasel/AVGuesser) and
[TransAVormer](https://github.com/Yahweasel/transavormer), as loading multiple
variants on demand is complicated.


## Size

FFmpeg is big, so libav.js is big. But, it's not ludicrous; the WebAssembly is
usually between 1.5 and 3 MiB for fairly complete builds, and the asm.js is about
double that.

You can estimate the size of variants based on the size of the constituent
fragments. As of version 6.8.8.0, an empty build is approximately 178KiB
(WebAssembly). The sizes of each additional fragment can be found in
[fragment-sizes.csv](docs/fragment-sizes.csv). The data in that CSV file can be
recreated by `tools/fragment-sizes.sh`, but note that the CSV file in the
repository is after further processing (in particular, normalizing to KiB and
subtracting away the empty and sizes). Note that the library columns show
dependencies: for example, the `decoder-libopus` fragment depends on the
`avcodec` fragment (since it's a codec), and the `1` in the `avcodec` column
tells you that that dependency exists; a build with just `decoder-libopus` will
take approximately the empty size, plus the fragment size of `avcodec`, plus the
fragment size of `decoder-libopus`.

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

In addition, a frontend library was created to bring together all of these
projects and provide a single frontend for media transformation on a browser:

 * [TransAVormer](https://github.com/Yahweasel/transavormer) is a stream-based
   frontend for libav.js and WebCodecs for anything-to-anything transformation
   of digital media data.


## Bundlers

Generally speaking, because libav.js needs to adjust its loading procedure based
on the environment it's being loaded in, it's not a good idea to bundle
libav.js. However, if you have to bundle it, it can be done if necessary.

libav.js has a frontend (`libav-<version>-<variant>.js`), a factory
(`libav-<version>-<variant>.wasm.js` or `.thr.js`), and, if using WebAssembly, a
backend (`libav-<version>-<variant>.wasm.wasm` or `.thr.wasm`). Any of these can
be overridden, and any of them can be object URLs to bundle everything, though
this will destroy libav.js's ability to load the correct version for the system.

To override the frontend, simply load a different frontend!

To override the factory, you have two choices:

 * Pass `toImport`, a string, to `LibAV.LibAV`'s options, e.g.,
   `LibAV.LibAV({toImport: "libav-but-better.wasm.js"})`.

 * Load the factory yourself, and pass the factory function as the `factory`
   option to `LibAV.LibAV`, e.g., `LibAV.LibAV({factory: LibAVFactory})`. By
   default, the factory function is exported as `LibAVFactory`, or for ES6
   modules, it is the default export of the module.

To override the backend, you can pass the full URL (or object URL) to the
WebAssembly as the option `wasmurl` to `LibAV.LibAV`, e.g.,
`LibAV.LibAV({wasmurl: URL.createObjectURL(...)})`.

Be careful about which versions of things you bundle. The ES6 module version of
libav.js assumes that it will actually *be* an ES6 module, and so will be able
to use, e.g., `import`. If your bundler transforms it into a non-ES6 module, you
must explicitly tell it to import some other way by passing the option `noes6`
to `LibAV.LibAV`, e.g., `LibAV.LibAV({noes6: true})`. Also, if your bundler
converts the ES6 frontend to non-ES6 and you intend to explicitly specify
`toImport`, you must specify the *non-ES6* factory.
