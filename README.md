# LibAV.js v6.5.7.1 + paulrouget Patches

This repository contains Yahweasel's libav.js v6.5.7.1 with paulrouget's patches applied for the `h264-aac-mp3` variant.

## Changes from Upstream

Based on [Yahweasel/libav.js](https://github.com/Yahweasel/libav.js) v6.5.7.1 with these additions:

1. **h264-aac-mp3 config** - Custom variant for H.264/AAC/MP3 encoding/decoding
2. **Strict JS fix** - `let _scriptName;` declaration in pre.js
3. **stderr logging** - `Module.printErr = console.log.bind(console);`

## Building

### Prerequisites
- Docker

### Build Command
```bash
docker build -t libav-builder .
docker run --rm -v $(pwd)/dist:/libav.js/dist libav-builder
```

### Output
Build artifacts will be in `dist/`:
- `libav-6.5.7.1-h264-aac-mp3.wasm.wasm`
- `libav-6.5.7.1-h264-aac-mp3.wasm.mjs`

## GitHub Actions

The repository includes a GitHub Actions workflow that automatically builds on push to `main` or `patched-h264-aac-mp3` branches.

## License

See LICENSE file. Components include FFmpeg (LGPL 2.1), OpenH264 (BSD), libmp3lame (LGPL).
