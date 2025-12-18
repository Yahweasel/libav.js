/*
 * Copyright (C) 2019-2025 Yahweasel and contributors
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY
 * SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION
 * OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN
 * CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */

// Callbacks for stream-based reader
var readerCallbacks = {
    open: function(stream) {
        if (stream.flags & 3) {
            // Opened in write mode, which can't work
            throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
    },

    close: function() {},

    read: function(stream, buffer, offset, length, position) {
        var data = Module.readBuffers[stream.node.name];

        if (!data || (data.buf.length === 0 && !data.eof)) {
            if (Module.onread) {
                try {
                    var rr = Module.onread(stream.node.name, position, length);
                    if (rr && rr.then && rr.catch) {
                        rr.catch(function(ex) {
                            ff_reader_dev_send(stream.node.name, null, {error: ex});
                        });
                    }
                } catch (ex) {
                    ff_reader_dev_send(stream.node.name, null, {error: ex});
                }
            }
            data = Module.readBuffers[stream.node.name];
        }

        if (!data)
            throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
        if (data.error) {
            Module.fsThrownError = data.error;
            throw new FS.ErrnoError(ERRNO_CODES.ECANCELED);
        }
        if (data.errorCode)
            throw new FS.ErrnoError(data.errorCode);
        if (data.buf.length === 0) {
            if (data.eof) {
                return 0;
            } else {
                data.ready = false;
                throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
            }
        }

        var ret;
        if (length < data.buf.length) {
            // Cut a slice
            ret = data.buf.subarray(0, length);
            data.buf = data.buf.slice(length);
        } else {
            // Get the beginning
            ret = data.buf;
            data.buf = new Uint8Array(0);
        }

        (new Uint8Array(buffer.buffer)).set(ret, offset);
        return ret.length;
    },

    write: function() {
        throw new FS.ErrnoError(ERRNO_CODES.EIO);
    },

    llseek: function() {
        throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
    }
};

// Callbacks for block-based reader
var blockReaderCallbacks = {
    open: function(stream) {
        if (stream.flags & 3)
            throw new FS.ErrnoError(ERRNO_CODES.EPERM);
    },

    close: function() {},

    read: function(stream, buffer, offset, length, position) {
        var data = Module.blockReadBuffers[stream.node.name];
        if (!data)
            throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
        if (data.error) {
            Module.fsThrownError = data.error;
            throw new FS.ErrnoError(ERRNO_CODES.ECANCELED);
        }
        if (data.errorCode)
            throw new FS.ErrnoError(data.errorCode);

        var bufMin = data.position;
        var bufMax = data.position + data.buf.length;
        if (position < bufMin || position >= bufMax) {
            if (position >= stream.node.ff_block_reader_dev_size)
                return 0; // EOF

            if (!Module.onblockread)
                throw new FS.ErrnoError(ERRNO_CODES.EIO);
            try {
                var brr = Module.onblockread(stream.node.name, position, length);
                if (brr && brr.then && brr.catch) {
                    brr.catch(function(ex) {
                        ff_block_reader_dev_send(stream.node.name, position, null, {error: ex});
                    });
                }
            } catch (ex) {
                Module.fsThrownError = ex;
                throw new FS.ErrnoError(ERRNO_CODES.ECANCELED);
            }

            // If it was asynchronous, this won't be ready yet
            bufMin = data.position;
            bufMax = data.position + data.buf.length;
            if (position < bufMin || position >= bufMax) {
                data.ready = false;
                throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
            }
        }

        var bufPos = position - bufMin;
        var ret;
        if (bufPos + length < data.buf.length) {
            // Cut a slice
            ret = data.buf.subarray(bufPos, bufPos + length);
        } else {
            // Get the beginning of what was requested
            ret = data.buf.subarray(bufPos, data.buf.length);
        }

        (new Uint8Array(buffer.buffer)).set(ret, offset);
        return ret.length;
    },

    write: function() {
        throw new FS.ErrnoError(ERRNO_CODES.EIO);
    },

    llseek: function(stream, offset, whence) {
        if (whence === 2 /* SEEK_END */)
            offset = stream.node.size + offset;
        else if (whence === 1 /* SEEK_CUR */)
            offset += stream.position;
        return offset;
    }
};

// Callbacks for block-based writer
var writerCallbacks = {
    open: function(stream) {
        if (!(stream.flags & 1)) {
            // Opened in read mode, which can't work
            throw new FS.ErrnoError(ERRNO_CODES.EPERM);
        }
    },

    close: function() {},

    read: function() {
        throw new FS.ErrnoError(ERRNO_CODES.EIO);
    },

    write: function(stream, buffer, offset, length, position) {
        if (!Module.onwrite)
            throw new FS.ErrnoError(ERRNO_CODES.EIO);
        Module.onwrite(stream.node.name, position, buffer.subarray(offset, offset + length));
        return length;
    },

    llseek: function(stream, offset, whence) {
        if (whence === 2)
            throw new FS.ErrnoError(ERRNO_CODES.EIO);
        else if (whence === 1)
            offset += stream.position;
        return offset;
    }
};

// Callbacks for stream-based writer
var streamWriterCallbacks = Object.create(writerCallbacks);
streamWriterCallbacks.write = function(stream, buffer, offset, length, position) {
    if (position != stream.position)
        throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
    return writerCallbacks.write(stream, buffer, offset, length, position);
};
streamWriterCallbacks.llseek = function() {
    throw new FS.ErrnoError(ERRNO_CODES.ESPIPE);
};

/* Filesystem for a writer directory. This is done by using MEMFS, but overriding
 * the stream operations. */
var streamWriterFS = Object.create(MEMFS);

streamWriterFS.mount = function(mount) {
    return streamWriterFS.createNode(null, "/", 0x4000 /* S_IFDIR */ | 0x1FF, 0);
}

streamWriterFS.createNode = function() {
    var node = MEMFS.createNode.apply(MEMFS, arguments);
    if (FS.isDir(node.mode)) {
        if (!streamWriterFS.dir_node_ops) {
            streamWriterFS.dir_node_ops = Object.create(node.node_ops);
            streamWriterFS.dir_node_ops.mknod = function(parent, name, mode, dev) {
                return streamWriterFS.createNode(parent, name, mode, dev);
            };
        }
        node.node_ops = streamWriterFS.dir_node_ops;

    } else if (FS.isFile(node.mode)) {
        node.stream_ops = writerCallbacks;

    }

    return node;
};

// Filesystem
function fsBinding(of) {
    Module[of] = function() {
        try {
            return FS[of].apply(FS, arguments);
        } catch (ex) {
            if (ex && ex.name === "ErrnoError") {
                // Give a more useful error
                ex.message = strerror(ex.errno);
                if (typeof arguments[0] === "string")
                    ex.message = arguments[0] + ": " + ex.message;
            }
            throw ex;
        }
    };
}

var readerDev = FS.makedev(44, 0);
FS.registerDevice(readerDev, readerCallbacks);
Module.readBuffers = Object.create(null);
Module.blockReadBuffers = Object.create(null);
var writerDev = FS.makedev(44, 1);
FS.registerDevice(writerDev, writerCallbacks);
var streamWriterDev = FS.makedev(44, 2);
FS.registerDevice(streamWriterDev, streamWriterCallbacks);

/**
 * Read a complete file from the in-memory filesystem.
 * @param name  Filename to read
 */
/// @types readFile@sync(name: string): @promise@Uint8Array@
fsBinding("readFile");

/**
 * Write a complete file to the in-memory filesystem.
 * @param name  Filename to write
 * @param content  Content to write to the file
 */
/// @types writeFile@sync(name: string, content: Uint8Array): @promise@Uint8Array@
fsBinding("writeFile");

/**
 * Delete a file in the in-memory filesystem.
 * @param name  Filename to delete
 */
/// @types unlink@sync(name: string): @promise@void@
fsBinding("unlink");

/**
 * Unmount a mounted filesystem.
 * @param mountpoint  Path where the filesystem is mounted
 */
/// @types unmount@sync(mountpoint: string): @promise@void@
fsBinding("unmount");

fsBinding("mkdev");

/**
 * Make a lazy file. Direct link to createLazyFile.
 */
/* @types
 * createLazyFile@sync(
 *     parent: string, name: string, url: string, canRead: boolean,
 *     canWrite: boolean
 * ): @promise@void@
 */
fsBinding("createLazyFile");

/**
 * Make a reader device.
 * @param name  Filename to create.
 * @param mode  Unix permissions (pointless since this is an in-memory
 *              filesystem)
 */
/// @types mkreaderdev@sync(name: string, mode?: number): @promise@void@
Module.mkreaderdev = function(loc, mode) {
    FS.mkdev(loc, mode?mode:0x1FF, readerDev);
    Module.readBuffers[loc] = {
        buf: new Uint8Array(0),
        eof: false,
        errorCode: 0,
        error: null
    };
    return 0;
};

/**
 * Make a block reader "device". Technically a file that we then hijack to have
 * our behavior.
 * @param name  Filename to create.
 * @param size  Size of the device to present.
 */
/// @types mkblockreaderdev@sync(name: string, size: number): @promise@void@
var mkblockreaderdev = Module.mkblockreaderdev = function(name, size) {
    FS.writeFile(name, new Uint8Array(0));
    var f = FS.open(name, 0);

    var super_node_ops = f.node.node_ops;
    var node_ops = f.node.node_ops = Object.create(super_node_ops);
    node_ops.getattr = function(node) {
        var ret = super_node_ops.getattr(node);
        ret.size = size;
        ret.blksize = 4096;
        ret.blocks = Math.ceil(size / 4096);
        return ret;
    };

    f.node.stream_ops = blockReaderCallbacks;
    f.node.ff_block_reader_dev_size = size;

    Module.blockReadBuffers[name] = {
        position: -1,
        buf: new Uint8Array(0),
        ready: false,
        errorCode: 0,
        error: null
    };

    FS.close(f);
};

// Readahead devices
var readaheads = {};

// Original onblockread
var preReadaheadOnBlockRead = null;

// Passthru for readahead.
function readaheadOnBlockRead(name, position, length) {
    if (!(name in readaheads)) {
        if (preReadaheadOnBlockRead)
            return preReadaheadOnBlockRead(name, position, length);
        return;
    }

    var ra = readaheads[name];

    function then() {
        if (ra.position !== position) {
            ra.position = position;
            ra.buf = null;
            ra.bufPromise = ra.file.slice(position, position + length).arrayBuffer()
                .then(function(ret) {
                    ra.buf = ret;
                }).catch(function(ex) {
                    console.error(ex + "\n" + ex.stack);
                    ra.buf = new Uint8Array(0);
                }).then(then);
            return;
        }

        ff_block_reader_dev_send(name, position, new Uint8Array(ra.buf));

        // Attempt to predict the next read
        position += length;
        ra.position = position;
        ra.buf = null;
        ra.bufPromise = ra.file.slice(position, position + length).arrayBuffer()
            .then(function(ret) {
                ra.buf = ret;
            }).catch(function(ex) {
                console.error(ex + "\n" + ex.stack);
                ra.buf = new Uint8Array(0);
            });
    }

    if (!ra.buf && ra.bufPromise)
        ra.bufPromise.then(then);
    else
        then();
}

/**
 * Make a readahead device. This reads a File (or other Blob) and attempts to
 * read ahead of whatever libav actually asked for. Note that this overrides
 * onblockread, so if you want to support both kinds of files, make sure you set
 * onblockread before calling this.
 * @param name  Filename to create.
 * @param file  Blob or file to read.
 */
/// @types mkreadaheadfile@sync(name: string, file: Blob): @promise@void@
Module.mkreadaheadfile = function(name, file) {
    if (Module.onblockread !== readaheadOnBlockRead) {
        preReadaheadOnBlockRead = Module.onblockread;
        Module.onblockread = readaheadOnBlockRead;
    }

    mkblockreaderdev(name, file.size);
    readaheads[name] = {
        file: file,
        position: -1,
        bufPromise: null,
        buf: null
    };
};

/**
 * Unlink a readahead file. Also gets rid of the File reference.
 * @param name  Filename to unlink.
 */
/// @types unlinkreadaheadfile@sync(name: string): @promise@void@
Module.unlinkreadaheadfile = function(name) {
    FS.unlink(name);
    delete readaheads[name];
};

/**
 * Make a writer device.
 * @param name  Filename to create
 * @param mode  Unix permissions
 */
/// @types mkwriterdev@sync(name: string, mode?: number): @promise@void@
var mkwriterdev = Module.mkwriterdev = function(loc, mode) {
    FS.mkdev(loc, mode?mode:0x1FF, writerDev);
    return 0;
};

/**
 * Make a stream writer device. The same as a writer device but does not allow
 * seeking.
 * @param name  Filename to create
 * @param mode  Unix permissions
 */
/// @types mkstreamwriterdev@sync(name: string, mode?: number): @promise@void@
Module.mkstreamwriterdev = function(loc, mode) {
    FS.mkdev(loc, mode?mode:0x1FF, streamWriterDev);
    return 0;
};

/**
 * Mount a writer *filesystem*. All files created in this filesystem will be
 * redirected as writers. The directory will be created for you if it doesn't
 * already exist, but it may already exist.
 * @param mountpoint  Directory to mount as a writer filesystem
 */
/// @types mountwriterfs@sync(mountpoint: string): @promise@void@
Module.mountwriterfs = function(mountpoint) {
    try {
        FS.mkdir(mountpoint);
    } catch (ex) {}
    FS.mount(streamWriterFS, {}, mountpoint);
    return 0;
}

// Users waiting to read
Module.ff_reader_dev_waiters = Object.create(null);

/**
 * Make a workerfs file. Returns the filename that it's mounted to.
 * @param name  Filename to use.
 * @param blob  Blob to load at that file.
 */
/// @types mkworkerfsfile@sync(name: string, blob: Blob): @promise@string@
Module.mkworkerfsfile = function(name, blob) {
    FS.mkdir("/" + name + ".d");
    FS.mount(WORKERFS, {
        blobs: [{name: name, data: blob}]
    }, "/" + name + ".d");
    return "/" + name + ".d/" + name;
};

/**
 * Unmount (unmake) a workerfs file. Give the *original name you provided*, not
 * the name mkworkerfsfile returned.
 * @param name  Filename to unmount.
 */
/// @types unlinkworkerfsfile@sync(name: string): @promise@void@
Module.unlinkworkerfsfile = function(name) {
    FS.unmount("/" + name + ".d");
    FS.rmdir("/" + name + ".d");
};

// FileSystemFileHandle devices
var fsfhs = {};

// Original onwrite
var preFSFHOnWrite = null;

// Passthru for FSFH writing.
function fsfhOnWrite(name, position, buffer) {
    if (!(name in fsfhs)) {
        if (preFSFHOnWrite)
            return preFSFHOnWrite(name, position, buffer);
        return;
    }

    var h = fsfhs[name];
    buffer = buffer.slice(0);

    if (h.syncHandle) {
        h.syncHandle.write(buffer.buffer, {
            at: position
        });
        return;
    }

    var p = h.promise.then(function() {
        return h.handle.write({
            type: "write",
            position: position,
            data: buffer
        });
    });

    h.promise = p.catch(console.error);
    return p;
}

/**
 * Make a FileSystemFileHandle device. This writes via a FileSystemFileHandle,
 * synchronously if possible. Note that this overrides onwrite, so if you want
 * to support both kinds of files, make sure you set onwrite before calling
 * this.
 * @param name  Filename to create.
 * @param fsfh  FileSystemFileHandle corresponding to this filename.
 */
/// @types mkfsfhfile(name: string, fsfh: FileSystemFileHandle): Promise<void>
Module.mkfsfhfile = function(name, fsfh) {
    if (Module.onwrite !== fsfhOnWrite) {
        preFSFHOnWrite = Module.onwrite;
        Module.onwrite = fsfhOnWrite;
    }

    mkwriterdev(name);

    var h = fsfhs[name] = {
        promise: Promise.all([])
    };
    h.promise = h.promise.then(function() {
        return fsfh.createSyncAccessHandle();
    }).then(function(syncHandle) {
        h.syncHandle = syncHandle;
    }).catch(function() {
        return fsfh.createWritable();
    }).then(function(handle) {
        h.handle = handle;
    });
    return h.promise;
};

/**
 * Unlink a FileSystemFileHandle file. Also closes the file handle.
 * @param name  Filename to unlink.
 */
/// @types unlinkfsfhfile(name: string): Promise<void>
Module.unlinkfsfhfile = function(name) {
    FS.unlink(name);
    var h = fsfhs[name];
    delete fsfhs[name];

    if (h.syncHandle) {
        h.syncHandle.close();
        return Promise.all([]);
    }

    return h.promise.then(function() {
        return h.handle.close();
    });
}

/**
 * Send some data to a reader device. To indicate EOF, send null. To indicate an
 * error, send EOF and include an error code in the options.
 * @param name  Filename of the reader device.
 * @param data  Data to send.
 * @param opts  Optional send options, such as an error code.
 */
/* @types
 * ff_reader_dev_send@sync(
 *     name: string, data: Uint8Array | null,
 *     opts?: {
 *         errorCode?: number,
 *         error?: any // any other error, used internally
 *     }
 * ): @promise@void@
 */
var ff_reader_dev_send = Module.ff_reader_dev_send = function(name, data, opts) {
    opts = opts || {};
    var idata = Module.readBuffers[name];

    if (data === null) {
        // EOF or error
        idata.eof = true;

    } else {
        var newbuf = new Uint8Array(idata.buf.length + data.length);
        newbuf.set(idata.buf);
        newbuf.set(data, idata.buf.length);
        idata.buf = newbuf;

    }

    idata.ready = true;

    idata.errorCode = 0;
    if (typeof opts.errorCode === "number")
        idata.errorCode = opts.errorCode;
    idata.error = null;
    if (opts.error)
        idata.error = opts.error;

    // Wake up waiters
    var waiters = Module.ff_reader_dev_waiters[name] || [];
    delete Module.ff_reader_dev_waiters[name];
    for (var i = 0; i < waiters.length; i++)
        waiters[i]();
};

/**
 * Send some data to a block reader device. To indicate EOF, send null (but note
 * that block read devices have a fixed size, and will automatically send EOF
 * for reads outside of that size, so you should not normally need to send EOF).
 * To indicate an error, send EOF and include an error code in the options.
 * @param name  Filename of the reader device.
 * @param pos  Position of the data in the file.
 * @param data  Data to send.
 * @param opts  Optional send options, such as an error code.
 */
/* @types
 * ff_block_reader_dev_send@sync(
 *     name: string, pos: number, data: Uint8Array | null,
 *     opts?: {
 *         errorCode?: number,
 *         error?: any // any other error, used internally
 *     }
 * ): @promise@void@
 */
var ff_block_reader_dev_send = Module.ff_block_reader_dev_send = function(name, pos, data, opts) {
    opts = opts || {};
    var idata = Module.blockReadBuffers[name];
    idata.position = pos;
    idata.buf = data;
    idata.ready = true;
    idata.errorCode = 0;
    idata.error = null;

    if (data === null)
        idata.buf = new Uint8Array(0);

    if (typeof opts.errorCode === "number")
        idata.errorCode = opts.errorCode;
    if (opts.error)
        idata.error = opts.error;

    // Wake up waiters
    var waiters = Module.ff_reader_dev_waiters[name] || [];
    delete Module.ff_reader_dev_waiters[name];
    for (var i = 0; i < waiters.length; i++)
        waiters[i]();
};

/**
 * @deprecated
 * DEPRECATED. Use the onread callback.
 * Metafunction to determine whether any device has any waiters. This can be
 * used to determine whether more data needs to be sent before a previous step
 * will be fully resolved.
 * @param name  Optional name of file to check for waiters
 */
/// @types ff_reader_dev_waiting@sync(name?: string): @promise@boolean@
var ff_reader_dev_waiting = Module.ff_reader_dev_waiting = function(name) {
    console.log("[libav.js] ff_reader_dev_waiting is deprecated. Use the onread callback.");
    return ff_nothing().then(function() {
        if (name)
            return !!Module.ff_reader_dev_waiters[name];
        else
            return !!Object.keys(Module.ff_reader_dev_waiters).length;
    });
};

/**
 * Internal function to determine if this device is ready (to avoid race
 * conditions).
 */
Module.readerDevReady = function(fd) {
    var stream = FS.streams[fd].node.name;
    if (stream in Module.readBuffers)
        return Module.readBuffers[stream].ready;
    else if (stream in Module.blockReadBuffers)
        return Module.blockReadBuffers[stream].ready;
    return false;
};

/**
 * Internal function to get the name of a file being read by an FD.
 */
Module.fdName = function(fd) {
    return FS.streams[fd].node.name;
};

/**
 * Initialize a muxer format, format context and some number of streams.
 * Returns [AVFormatContext, AVOutputFormat, AVIOContext, AVStream[]]
 * @param opts  Muxer options
 * @param stramCtxs  Context info for each stream to mux
 */
/* @types
 * ff_init_muxer@sync(
 *     opts: {
 *         oformat?: number, // format pointer
 *         format_name?: string, // libav name
 *         filename?: string,
 *         device?: boolean, // Create a writer device
 *         open?: boolean, // Open the file for writing
 *         codecpars?: boolean // Streams is in terms of codecpars, not codecctx
 *     },
 *     streamCtxs: [number, number, number][] // AVCodecContext | AVCodecParameters, time_base_num, time_base_den
 * ): @promise@[number, number, number, number[]]@
 */
var ff_init_muxer = Module.ff_init_muxer = function(opts, streamCtxs) {
    var oformat = opts.oformat ? opts.oformat : 0;
    var format_name = opts.format_name ? opts.format_name : null;
    var filename = opts.filename ? opts.filename : null;
    var oc = avformat_alloc_output_context2_js(oformat, format_name, filename);
    if (oc === 0)
        throw new Error("Failed to allocate output context");
    var fmt = AVFormatContext_oformat(oc);
    var sts = [];
    streamCtxs.forEach(function(ctx) {
        var st = avformat_new_stream(oc, 0);
        if (st === 0)
            throw new Error("Could not allocate stream");
        sts.push(st);
        var codecpar = AVStream_codecpar(st);
        var ret;
        if (opts.codecpars) {
            ret = avcodec_parameters_copy(codecpar, ctx[0]);
            AVCodecParameters_codec_tag_s(codecpar, 0);
        } else {
            ret = avcodec_parameters_from_context(codecpar, ctx[0]);
        }
        if (ret < 0)
            throw new Error("Could not copy the stream parameters: " + ff_error(ret));
        AVStream_time_base_s(st, ctx[1], ctx[2]);
    });

    // Set up the device if requested
    if (opts.device)
        FS.mkdev(opts.filename, 0x1FF, writerDev);

    // Open the actual file if requested
    var pb = null;
    if (opts.open) {
        pb = avio_open2_js(opts.filename, 2 /* AVIO_FLAG_WRITE */, 0, 0);
        if (pb === 0)
            throw new Error("Could not open file");
        AVFormatContext_pb_s(oc, pb);
    }

    return [oc, fmt, pb, sts];
};

/**
 * Free up a muxer format and/or file
 * @param oc  AVFormatContext
 * @param pb  AVIOContext
 */
/// @types ff_free_muxer@sync(oc: number, pb: number): @promise@void@
var ff_free_muxer = Module.ff_free_muxer = function(oc, pb) {
    avformat_free_context(oc);
    if (pb)
        avio_close(pb);
};

/**
 * Initialize a demuxer from a file and format context, and get the list of
 * codecs/types.
 * Returns [AVFormatContext, Stream[]]
 * @param filename  Filename to open
 * @param opts  Options to use when opening. If a string, then the string
 *              format.
 */
/* @types
 * ff_init_demuxer_file@sync(
 *     filename: string, opts?: string | {
 *         format?: string,
 *         open_input_options?: number
 *     }
 * ): @promsync@[number, Stream[]]@
 */
function ff_init_demuxer_file(filename, opts) {
    var fmt_ctx;

    if (typeof opts === "string")
        opts = {format: opts};
    else if (typeof opts === "undefined")
        opts = {};

    return avformat_open_input_js(
        filename,
        opts.format||null,
        opts.open_input_options||null
    ).then(function(ret) {
        fmt_ctx = ret;
        if (fmt_ctx === 0)
            throw new Error("Could not open source file");

        return avformat_find_stream_info(fmt_ctx, 0);

    }).then(function() {
        var nb_streams = AVFormatContext_nb_streams(fmt_ctx);
        var streams = [];
        for (var i = 0; i < nb_streams; i++) {
            var inStream = AVFormatContext_streams_a(fmt_ctx, i);
            var outStream = {
                ptr: inStream,
                index: i
            };

            // Codec info
            var codecpar = AVStream_codecpar(inStream);
            outStream.codecpar = codecpar;
            outStream.codec_type = AVCodecParameters_codec_type(codecpar);
            outStream.codec_id = AVCodecParameters_codec_id(codecpar);

            // Duration and related
            outStream.time_base_num = AVStream_time_base_num(inStream);
            outStream.time_base_den = AVStream_time_base_den(inStream);
            outStream.duration_time_base = AVStream_duration(inStream) + (AVStream_durationhi(inStream)*0x100000000);
            outStream.duration = outStream.duration_time_base * outStream.time_base_num / outStream.time_base_den;

            streams.push(outStream);
        }
        return [fmt_ctx, streams];

    });
}
Module.ff_init_demuxer_file = function() {
    var args = arguments;
    return serially(function() {
        return ff_init_demuxer_file.apply(void 0, args);
    });
};

/**
 * Write some number of packets at once.
 * @param oc  AVFormatContext
 * @param pkt  AVPacket
 * @param inPackets  Packets to write
 * @param interleave  Set to false to *not* use the interleaved writer.
 *                    Interleaving is the default.
 */
/* @types
 * ff_write_multi@sync(
 *     oc: number, pkt: number, inPackets: (Packet | number)[], interleave?: boolean
 * ): @promise@void@
 */
var ff_write_multi = Module.ff_write_multi = function(oc, pkt, inPackets, interleave) {
    var step = av_interleaved_write_frame;
    if (interleave === false) step = av_write_frame;
    var tbs = {};

    inPackets.forEach(function(inPacket) {
        var ret = av_packet_make_writable(pkt);
        if (ret < 0)
            throw new Error("Error making packet writable: " + ff_error(ret));
        ff_copyin_packet(pkt, inPacket);

        var sti = inPacket.stream_index || 0;
        var iptbNum, iptbDen;
        if (typeof inPacket === "number") {
            iptbNum = AVPacket_time_base_num(pkt);
            iptbDen = AVPacket_time_base_den(pkt);
        } else {
            iptbNum = inPacket.time_base_num;
            iptbDen = inPacket.time_base_den;
        }
        if (iptbNum) {
            var tb = tbs[sti];
            if (!tb) {
                var str = AVFormatContext_streams_a(oc, sti);
                tb = tbs[sti] = [
                    AVStream_time_base_num(str),
                    AVStream_time_base_den(str)
                ];
            }
            if (tb[0]) {
                av_packet_rescale_ts_js(
                    pkt,
                    iptbNum, iptbDen,
                    tb[0], tb[1]
                );
                AVPacket_time_base_s(pkt, tb[0], tb[1]);
            }
        }

        step(oc, pkt);
        av_packet_unref(pkt);
    });
    av_packet_unref(pkt);
};

/**
 * Read many packets at once. If you don't set any limits, this function will
 * block (asynchronously) until the whole file is read, so make sure you set
 * some limits if you want to read a bit at a time. Returns a pair [result,
 * packets], where the result indicates whether an error was encountered, an
 * EOF, or simply limits (EAGAIN), and packets is a dictionary indexed by the
 * stream number in which each element is an array of packets from that stream.
 * @param fmt_ctx  AVFormatContext
 * @param pkt  AVPacket
 * @param opts  Other options
 */
/* @types
 * ff_read_frame_multi@sync(
 *     fmt_ctx: number, pkt: number, opts?: {
 *         limit?: number, // OUTPUT limit, in bytes
 *         unify?: boolean, // If true, unify the packets into a single stream (called 0), so that the output is in the same order as the input
 *         copyoutPacket?: "default" // Version of ff_copyout_packet to use
 *     }
 * ): @promsync@[number, Record<number, Packet[]>]@
 * ff_read_frame_multi@sync(
 *     fmt_ctx: number, pkt: number, opts: {
 *         limit?: number, // OUTPUT limit, in bytes
 *         unify?: boolean, // If true, unify the packets into a single stream (called 0), so that the output is in the same order as the input
 *         copyoutPacket: "ptr" // Version of ff_copyout_packet to use
 *     }
 * ): @promsync@[number, Record<number, number[]>]@
 */
function ff_read_frame_multi(fmt_ctx, pkt, opts) {
    var sz = 0;
    var outPackets = {};
    var tbs = {};

    if (typeof opts === "number")
        opts = {limit: opts};
    if (typeof opts === "undefined")
        opts = {};
    var unify = !!opts.unify;
    var copyoutPacket = ff_copyout_packet;
    if (opts.copyoutPacket)
        copyoutPacket = ff_copyout_packet_versions[opts.copyoutPacket];

    function step() {
        // Read the frame
        return av_read_frame(fmt_ctx, pkt).then(function(ret) {
            if (ret < 0)
                return [ret, outPackets];

            // And copy it out
            var packet = copyoutPacket(pkt);
            var stri = AVPacket_stream_index(pkt);

            // Get the time base correct
            var ptbNum, ptbDen;
            if (typeof packet === "number") {
                ptbNum = AVPacket_time_base_num(packet);
                ptbDen = AVPacket_time_base_den(packet);
            } else {
                ptbNum = packet.time_base_num;
                ptbDen = packet.time_base_den;
            }
            if (!ptbNum) {
                var tb = tbs[stri];
                if (!tb) {
                    var str = AVFormatContext_streams_a(fmt_ctx, stri);
                    tb = tbs[stri] = [
                        AVStream_time_base_num(str),
                        AVStream_time_base_den(str)
                    ];
                }
                if (typeof packet === "number") {
                    AVPacket_time_base_s(packet, tb[0], tb[1]);
                } else {
                    packet.time_base_num = tb[0];
                    packet.time_base_den = tb[1];
                }
            }

            // Put it in the output
            var idx = unify ? 0 : stri;
            if (!(idx in outPackets))
                outPackets[idx] = [];
            outPackets[idx].push(packet);
            sz += AVPacket_size(pkt);
            av_packet_unref(pkt);
            if (opts.limit && sz >= opts.limit)
                return [-6 /* EAGAIN */, outPackets];

            return Promise.all([]).then(step);
        });
    }

    return step();
}
Module.ff_read_frame_multi = function() {
    var args = arguments;
    return serially(function() {
        return ff_read_frame_multi.apply(void 0, args);
    });
};

/**
 * @deprecated
 * DEPRECATED. Use `ff_read_frame_multi`.
 * Read many packets at once. This older API is now deprecated. The devfile
 * parameter is unused and unsupported. Dev files should be used via the normal
 * `ff_reader_dev_waiting` API, rather than counting on device file limits, as
 * this function used to.
 * @param fmt_ctx  AVFormatContext
 * @param pkt  AVPacket
 * @param devfile  Unused
 * @param opts  Other options
 */
/* @types
 * ff_read_multi@sync(
 *     fmt_ctx: number, pkt: number, devfile?: string | null, opts?: {
 *         limit?: number, // OUTPUT limit, in bytes
 *         unify?: boolean, // If true, unify the packets into a single stream (called 0), so that the output is in the same order as the input
 *         copyoutPacket?: "default" // Version of ff_copyout_packet to use
 *     }
 * ): @promsync@[number, Record<number, Packet[]>]@
 * ff_read_multi@sync(
 *     fmt_ctx: number, pkt: number, devfile: string | null, opts: {
 *         limit?: number, // OUTPUT limit, in bytes
 *         devLimit?: number, // INPUT limit, in bytes (don't read if less than this much data is available)
 *         unify?: boolean, // If true, unify the packets into a single stream (called 0), so that the output is in the same order as the input
 *         copyoutPacket: "ptr" // Version of ff_copyout_packet to use
 *     }
 * ): @promsync@[number, Record<number, number[]>]@
 */
Module.ff_read_multi = function(fmt_ctx, pkt, devfile, opts) {
    console.log("[libav.js] ff_read_multi is deprecated. Use ff_read_frame_multi.");
    return Module.ff_read_frame_multi(fmt_ctx, pkt, opts);
};
