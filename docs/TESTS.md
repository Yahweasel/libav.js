libav.js's test suite is in the `tests/` directory. To run the test suite, you
must first build the `all` variant with `make build-all` (the tests use the all
variant), then, from the `tests/` directory, run `node node-test.js` or `node
node-test.mjs`. Alternatively or additionally, you can expose the entire
libav.js directory with a web server, then access `tests/web-test.html` to run
the same tests in a web browser.

The `node-test.js` program takes two optional arguments:

 * `--include-slow`: Include slow-running tests, in particular tests with video
   encoding.

 * `--coverage`: Also perform simplistic coverage analysis to make sure that the
   tests have proper coverage of the functions exposed by libav.js.

The `web-test.html` page also exposes the ability to run the slow tests.


# Test framework

The tests listed in `suite.json` (which can be regenerated with
`mksuitejson.js`) are run in the order they're given in `suite.json`.

Each test is a JavaScript file in the `tests/tests/` directory. As a matter of
convention, each test is named with a three-digit number followed by a
descriptive name, and the tests in the `000` to `099` range are actually
configuration and setup, rather than tests per se.

New tests can be added by creating a file and adding it to suite.json.

Each test is run as an `async function`, with `h` as the harness. The test
should throw an exception to indicate failure. Tests can output for other
reasons using `h.print` and/or `h.printErr`.

## Test harness

The test harness is defined in `harness.js` (pre-ES6) or `harness.mjs` (ES6),
both of which are generated from `harness.in.js`. Other than whether ES6 modules
are used, both versions are identical.

## Using libav.js

An instance of libav.js can be loaded from the harness with `await h.LibAV()`.
If you need a separate instance of libav.js from the one used by other tests,
then `await h.LibAV({})` can be used instead (or that object can have libav.js
loading options). If no argument is given, the same libav.js instance will be
reused for each test.

From that point, the libav.js instance can be used like any libav.js instance.

The `--include-slow` option is exposed as `h.options.includeSlow`.

## Writing tests

A test should perform some function and throw an exception if the test fails.

Several utility functions are provided by `003-utils` to make testing easier:

 * `await h.utils.compareAudio(fileA, fileB)` compares two audio files and
   throws an exception if they're too different. The files may be provided as
   filenames, arrays of libav.js Frames, or arrays of TypedArrays representing
   raw float32 data.

 * `await h.utils.audioF32(file)` converts a file to a raw float32 array, from
   any of the formats described above. This is a utility function used by
   `compareAudio` and usually does not need to be called directly.

 * `await h.utils.compareVideo(fileA, fileB)` does the same as `compareAudio`,
   but for video.

 * `await h.utils.videoYUV(file)` does the same as `audioF32`, but for video,
   converting to planar YUV420 data.

## Test files

The pseudo-test `001-input` loads input files into the environment, and the
psuedo-test `002-formats` converts those input files into a variety of formats.
You can read these tests to see which files are available, or add new files.

Files can be read from the harness with `await h.readCachedFile(name)`, or from
the environment with `await h.readFile(name)`. The files in the harness are also
in the libav.js environment, so they can be read directly.
