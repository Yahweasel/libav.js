These are notes, mainly to myself, for making a release.

 * The versioning scheme is `my major.my minor.ffmpeg version`. So, e.g., my own
   3.1 with FFmpeg 4.1.5 is `3.1.4.1.5`. NPM only supports three parts, so that
   becomes `3.1.4`.

 * Before making a release, run the tests with coverage. I don't presently try
   to make sure that the tests actually have perfect coverage, but it's at least
   a good way to know what I'm missing.

 * Update the doxygen by going into FFmpeg's build-base-default directory and
   `make doc/doxy/html`, then `tools/doxy-to-json.js <ffmpeg version>`.

 * Check library versions. Anything but FFmpeg is usually trivial to update, so
   can be updated shortly before release.

 * Run `tools/fragment-sizes.sh`.

 * When updating the version, follow the instructions in package.json.

 * Make a release with `make release`, then publish it to NPM with `make
   npm-publish`. Publish the tarball to github.
