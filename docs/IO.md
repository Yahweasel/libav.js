# I/O

libav.js provides a number of ways to stream data into and out of libav. They
all act like files, in keeping with the Unix standard (devices and pipes are
files). Note that libav.js's filesystem is virtual, and has no connection to the
real filesystem.

Experimentally, libav.js also supports the `jsfetch` "protocol", which uses
JavaScript's `fetch` function to stream data over HTTP or HTTPS. This is not
currently enabled by default in any build (other than "all"), but using an
experimental build with `jsfetch` enabled, simply use, e.g., the URL
`jsfetch:https://example.com/video.mkv` to use fetch. `jsfetch` does not
currently support seeking or writing, only reading in a stream. If you enable
the HLS demuxer, `jsfetch` supports reading from HLS streams as well.


## Reading

On the reading side, there are five options: simple files, streaming devices,
block devices, readahead files, and WorkerFS files.

### Simple files

Emscripten supports an in-memory filesystem. For small files, it may be
sufficient to just put the file in the in-memory filesystem.

A file can be created with `await libav.writeFile(<name>, <content>)`, where
`<name>` is the file name (a string) and `<content>` is a `Uint8Array` with the
file's content. This file can then simply be used with the name provided. Simple
files can be deleted with `await libav.unlink(<name>)`.

### Streaming reader devices

If your data is streaming (i.e., you're receiving it from start to finish), you
can provide it in a virtual file (formally, a character device). When libav
reads from this file, if no data is available, it will block. When it blocks, it
calls a callback to indicate to you that it needs more data, and you can call a
function to provide it with that data.

To create a readable streaming device, use `libav.mkreaderdev(<name>)`, with
any file name you wish. Streaming reader devices can be deleted with `await
libav.unlink(<name>)`. Create a `libav.onread` callback, which takes the
arguments `filename, position, length`, being the name of the file being read,
the position it's reading from in bytes (which will always be in sequence with
previous reads), and the length it wants to read.

To send data (usually during `onread`, but you can send data whenever you want),
call `libav.ff_reader_dev_send(<name>, <data>)`, where `<name>` is the filename
and `<data>` is a Uint8Array of the data to send. You may send the requested
length if you want to, but you can also send less or more.
`libav.ff_reader_dev_send` returns a promise, but it's not necessary to `await`
it, since it will actually be unblocking another promise (the one reading from a
file).

Send `null` as `<data>` to indicate EOF.

To put all of this together, a typical process to use `ff_read_multi` to read
packets from a streaming reader device might look like this:

```
await libav.mkreaderdev("input");
libav.onread = function() {
    /* This function assumes you have only one reader device, so don't actually
     * care about the arguments. */
    // ... get some data...
    libav.ff_reader_dev_send("input", eof ? null : data);
};

...

while (true) {
    const [result, packets] = await libav.ff_read_multi(
        fmt_ctx, pkt, null,
        {
            limit: 32*1024 /* amount to read at once */
        }
    );
    ...
}
```

Alternatively, when using `ff_read_multi`, reader devices can be used in a
"push" style, where `ff_read_multi` itself will refuse to request more data
unless enough data is available. The third argument tells `ff_read_multi` which
device to check for this purpose. In that case, you should check if the result
of `ff_read_multi` is `-libav.EAGAIN`, indicating that more data is needed. An
example using that style might look like this:

```
while (true) {
    const [result, packets] = await libav.ff_read_multi(fmt_ctx, pkt, "input");
    ...
    if (result === -libav.EAGAIN) {
        // ... get some data ...
        libav.ff_reader_dev_send("input", data);
    }
}
```

There should be no appreciable difference in performance between these two
styles; they just let you control the process in different ways. Note that only
`ff_read_multi` supports this "push" style; you will still need to use
`libav.onread` for `ff_init_demuxer_file` and all low-level C functions.

### Block reader devices

Streaming devices have no fixed size and cannot be seeked. If your input data
has a fixed size, it may be more wise to present it as a virtual *block* file
(formally a block device), rather than a streaming device. The block reader
device is also a bit simpler to use.

To create a readable block device, use `await libav.mkblockreaderdev(<name>,
<size>)`, with any file name you wish. The size is in bytes, and is mandatory.
Readable block devices can be deleted with `await libav.unlink(<name>)`.

When a read request is sent to a block reader device, libav.js invokes the
`libav.onblockread` function with the following arguments: `(<name>, <position>,
<length>)`. When `onblockread` is called, you are expected to send data to the
named file at the given position; the length is merely informative, and you may
send less or more data. If `onblockread` throws an exception (directly or in a
promise), that exception will be passed through the reading process.

To send data for a block reader device, use
`libav.ff_block_reader_dev_send(<name>, <position>, <data>)`. You may *not* send
extra data in advance; the block device will only "remember" the data it's most
recently been sent. Thus, this should only be called as a result of
`onblockread`. The data should be a Uint8Array. If you're using libav.js
*without* a worker, it then owns the data, so in general you need to duplicate
the data if you want it later. The position doesn't have to be the most recently
requested position, but if the position plus data length doesn't at least
*include* the most recently requested position, you'll just get another request
for the same position.

A typical process to use `ff_read_multi` to read packets from a block reader
device might look like this:

```
libav.onblockread = async function(name, pos, length) {
    const ab = await file.slice(pos, pos + length).arrayBuffer();
    libav.ff_block_reader_dev_send(name, pos, new Uint8Array(ab));
};

await libav.mkblockreaderdev("input");

...

while (true) {
    const [result, packets] = await
        libav.ff_read_multi(fmt_ctx, pkt, null, {limit: 32*1024 /* amount to read at once */});
    ...
}
```

Because of its callback style, block reader devices are generally easier to use
than stream reader devices (and it's likely that stream reader devices will
eventually be given a callback style as well for this reason).

### Readahead files

If your data is in a Blob or File, you can pass that into libav.js and have it
treated like a normal file using two different methods, of which readahead files
are one. "Readahead" files are called so because they will attempt to anticipate
libav's next read and read ahead. This is completely transparent, and readahead
files appear like simple files, but unlike simple files, they can be arbitrarily
large.

Create readahead files with `await libav.mkreadaheadfile(<name>, <content>)`.
`<name>` is the filename, and `<content>` must be a Blob or File. These files
can then be used as simple files. Because of the readahead cache, you must
delete readahead files with `await libav.unlinkreadaheadfile(<name>)`, not just
`libav.unlink`.

### WorkerFS files

Emscripten provides a "worker" filesystem that (predictably) only works in
WebWorkers. It behaves similarly to readahead files, but:

 * Is limited to only workers,
 * doesn't read ahead, and
 * presents a blocking file, rather than a non-blocking file (which is a detail
   you should usually not need to know or worry about).

If a blocking file is important to you for some reason (e.g., you're reading it
in libav with some interface other than the standard libavformat reader), then
WorkerFS is an option.

Create WorkerFS files with `name = await libav.mkworkerfsfile(<name>,
<content>)`. As with `mkreadaheadfile`, the content must be a Blob or File. Note
that `mkworkerfsfile` creates a *new* file name based on the name you gave (as a
technical detail, this is because WorkerFS is a filesystem, not a device file).
Make sure you use the returned name, not your original name.

To remove a WorkerFS file, use `await libav.unlinkworkerfsfile(<name>)`, not
just `libav.unlink`. Pass in the *original* name, not the name returned by
`libav.mkworkerfsfile`.


## Writing

On the writing side, there are three options: simple files, block devices, and
streaming devices.

### Simple files

Emscripten supports an in-memory filesystem. For small files, it may be
sufficient to just let libav write the file in the in-memory filesystem, then
read it out as a buffer.

Simple files are created by default by any libav functions, if there's no device
or other file with the given name.

Once the file is finalized, it can be read with `await libav.readFile(<name>)`,
where `<name>` is the filename. `libav.readFile` returns (a promise to) a
Uint8Array which the caller then owns.

Simple files can be deleted with `libav.unlink`.

### Block writer devices

Most formats require writing the file's content, then going back and writing an
index or similar. As such, it is usually desirable to let libav write files in
any order. Block writer devices provide libav with this power, with a simple
callback mechanism.

To create a block writer device, use `await libav.mkwriterdev(<name>)`. Then,
simply write to it as a file. Note that the file already exists, so certain
interfaces require cajoling to write to it; for instance, if using the `ffmpeg`
CLI, you need to pass the `-y` option for it to "overwrite" the device file.
Block writer devices can be deleted with `libav.unlink`.

To use block writer devices, you must provide a callback, `libav.onwrite`, which
will be called when data is written to the device. `onwrite` takes three
arguments, `(<name>, <position>, <data>)`. `<name>` is the filename being
written to, `<position>` is the position where this data is written to (in
bytes), and `<data>` is the written data, as a Uint8Array. If libav.js is
running in a Worker, you own the data array, but if it's *not* running in a
worker, what you have is a subarray into libav's memory, so you must use or
duplicate it.

A typical process to use the `ffmpeg` CLI with a block writer device might look
like this:

```
await libav.writeFile("input", inputData);
await libav.mkwriterdev("output");

let writtenData = new Uint8Array(0);
libav.onwrite = function(name, pos, data) {
    const newLen = Math.max(writtenData.length, pos + data.length);
    if (newLen > writtenData.length) {
        const newData = new Uint8Array(newLen);
        newData.set(writtenData);
        writtenData = newData;
    }
    writtenData.set(data, pos);
};

await libav.ffmpeg(
    "-i", "input",
    "-f", "webm",
    "-y", "output"
);

// writtenData now contains the data written to the file
```

### Streaming writer devices

If you want to ensure that libav is streaming your data (writing it from start
to finish, without going back to write an index or similar), you can either
check the positions sent to `onwrite` with a block writer device, or use a
streaming writer device, which libav is not allowed to seek in.

NOTE: This will not make libav capable of writing formats in a streaming fashion
that it wouldn't otherwise be able to. Some formats are streamable and some are
not. This merely *restricts* libav.

To create a streaming writer device, use `await
libav.mkstreamwriterdev(<name>)`. Streaming writer devices are otherwise
identical to block writer devices in every detail, including that they use
`onwrite` as their callback, and include the position.

### Writer filesystem

If you're using a format that outputs multiple files, such as image2's
frame-output, you can use a writer *filesystem* to make all files in a directory
automatically act as block writer files. Use `await
libav.mountwriterfs("/somepath")` to mount a writer filesystem to `"/somepath"`,
at which point every file created under `"/somepath"` will act as a block
writer, invoking `onwrite` with every write.

When finished, you can use `await libav.unmount("/somepath")` to unmount the
writer filesystem.
