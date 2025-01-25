/*
 * Copyright (C) 2019-2024 Yahweasel and contributors
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

// A global promise chain for serialization of asyncify components
var serializationPromise = null;

function serially(f) {
    var p;
    if (serializationPromise) {
        p = serializationPromise.catch(function(){}).then(function() {
            return f();
        });
    } else {
        p = f();
    }
    serializationPromise = p = p.finally(function() {
        if (serializationPromise === p)
            serializationPromise = null;
    });
    return p;
}

// A global error passed through filesystem operations
Module.fsThrownError = null;

var ERRNO_CODES = {
    EPERM: 1,
    EIO: 5,
    EAGAIN: 6,
    ECANCELED: 11,
    ESPIPE: 29
};

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

/* Original versions of all our functions, since the Module version is replaced
 * if we're a Worker */
var CAccessors = {};

@FUNCS

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
 * Metafunction to initialize an encoder with all the bells and whistles.
 * Returns [AVCodec, AVCodecContext, AVFrame, AVPacket, frame_size]
 * @param name  libav name of the codec
 * @param opts  Encoder options
 */
/* @types
 * ff_init_encoder@sync(
 *     name: string, opts?: {
 *         ctx?: AVCodecContextProps,
 *         time_base?: [number, number],
 *         options?: Record<string, string>
 *     }
 * ): @promise@[number, number, number, number, number]@
 */
var ff_init_encoder = Module.ff_init_encoder = function(name, opts) {
    opts = opts || {};

    var codec = avcodec_find_encoder_by_name(name);
    if (codec === 0)
        throw new Error("Codec not found");

    var c = avcodec_alloc_context3(codec);
    if (c === 0)
        throw new Error("Could not allocate audio codec context");

    var ctxProps = opts.ctx || {};
    for (var prop in ctxProps)
        this["AVCodecContext_" + prop + "_s"](c, ctxProps[prop]);

    var time_base = opts.time_base || [1, 1000];
    AVCodecContext_time_base_s(c, time_base[0], time_base[1]);

    var options = 0;
    if (opts.options) {
        for (var prop in opts.options)
            options = av_dict_set_js(options, prop, opts.options[prop], 0);
    }

    var ret = avcodec_open2_js(c, codec, options);
    if (ret < 0)
        throw new Error("Could not open codec: " + ff_error(ret));

    var frame = av_frame_alloc();
    if (frame === 0)
        throw new Error("Could not allocate frame");
    var pkt = av_packet_alloc();
    if (pkt === 0)
        throw new Error("Could not allocate packet");

    var frame_size = AVCodecContext_frame_size(c);

    return [codec, c, frame, pkt, frame_size];
};

/**
 * Metafunction to initialize a decoder with all the bells and whistles.
 * Similar to ff_init_encoder but doesn't need to initialize the frame.
 * Returns [AVCodec, AVCodecContext, AVPacket, AVFrame]
 * @param name  libav decoder identifier or name
 * @param config  Decoder configuration. Can just be a number for codec
 *                parameters, or can be multiple configuration options.
 */
/* @types
 * ff_init_decoder@sync(
 *     name: string | number, config?: number | {
 *         codecpar?: number | CodecParameters,
 *         time_base?: [number, number]
 *     }
 * ): @promise@[number, number, number, number]@
 */
var ff_init_decoder = Module.ff_init_decoder = function(name, config) {
    if (typeof config === "number") {
        config = {codecpar: config};
    } else {
        config = config || {};
    }

    var codec, ret;
    if (typeof name === "string")
        codec = avcodec_find_decoder_by_name(name);
    else
        codec = avcodec_find_decoder(name);
    if (codec === 0)
        throw new Error("Codec not found");

    var c = avcodec_alloc_context3(codec);
    if (c === 0)
        throw new Error("Could not allocate audio codec context");

    var codecid = AVCodecContext_codec_id(c);

    if (config.codecpar) {
        var codecparPtr = 0;
        var codecpar = config.codecpar;
        if (typeof codecpar === "object") {
            codecparPtr = avcodec_parameters_alloc();
            if (codecparPtr === 0)
                throw new Error("Failed to allocate codec parameters");
            ff_copyin_codecpar(codecparPtr, codecpar);
            codecpar = codecparPtr;
        }
        ret = avcodec_parameters_to_context(c, codecpar);
        if (codecparPtr)
            avcodec_parameters_free_js(codecparPtr);
        if (ret < 0)
            throw new Error("Could not set codec parameters: " + ff_error(ret));
    }

    // If it is not set, use the copy.
    if (AVCodecContext_codec_id(c) === 0) AVCodecContext_codec_id_s(c, codecid);

    // Keep the time base
    if (config.time_base)
        AVCodecContext_time_base_s(c, config.time_base[0], config.time_base[1]);

    ret = avcodec_open2(c, codec, 0);
    if (ret < 0)
        throw new Error("Could not open codec: " + ff_error(ret));

    var pkt = av_packet_alloc();
    if (pkt === 0)
        throw new Error("Could not allocate packet");

    var frame = av_frame_alloc();
    if (frame === 0)
        throw new Error("Could not allocate frame");

    return [codec, c, pkt, frame];
};

/**
 * Free everything allocated by ff_init_encoder.
 * @param c  AVCodecContext
 * @param frame  AVFrame
 * @param pkt  AVPacket
 */
/* @types
 * ff_free_encoder@sync(
 *     c: number, frame: number, pkt: number
 * ): @promise@void@
 */
var ff_free_encoder = Module.ff_free_encoder = function(c, frame, pkt) {
    av_frame_free_js(frame);
    av_packet_free_js(pkt);
    avcodec_free_context_js(c);
};

/**
 * Free everything allocated by ff_init_decoder
 * @param c  AVCodecContext
 * @param pkt  AVPacket
 * @param frame  AVFrame
 */
/* @types
 * ff_free_decoder@sync(
 *     c: number, pkt: number, frame: number
 * ): @promise@void@
 */
var ff_free_decoder = Module.ff_free_decoder = function(c, pkt, frame) {
    ff_free_encoder(c, frame, pkt);
};

/**
 * Encode some number of frames at once. Done in one go to avoid excess message
 * passing.
 * @param ctx  AVCodecContext
 * @param frame  AVFrame
 * @param pkt  AVPacket
 * @param inFrames  Array of frames in libav.js format
 * @param config  Encoding options. May be "true" to indicate end of stream.
 */
/* @types
 * ff_encode_multi@sync(
 *     ctx: number, frame: number, pkt: number, inFrames: (Frame | number)[],
 *     config?: boolean | {
 *         fin?: boolean,
 *         copyoutPacket?: "default"
 *     }
 * ): @promise@Packet[]@
 * ff_encode_multi@sync(
 *     ctx: number, frame: number, pkt: number, inFrames: (Frame | number)[],
 *     config: {
 *         fin?: boolean,
 *         copyoutPacket: "ptr"
 *     }
 * ): @promise@number[]@
 */
var ff_encode_multi = Module.ff_encode_multi = function(ctx, frame, pkt, inFrames, config) {
    if (typeof config === "boolean") {
        config = {fin: config};
    } else {
        config = config || {};
    }

    var outPackets = [];
    var tbNum = AVCodecContext_time_base_num(ctx);
    var tbDen = AVCodecContext_time_base_den(ctx);

    var copyoutPacket = function(ptr) {
        var ret = ff_copyout_packet(ptr);
        if (!ret.time_base_num) {
            ret.time_base_num = tbNum;
            ret.time_base_den = tbDen;
        }
        return ret;
    };

    if (config.copyoutPacket === "ptr") {
        copyoutPacket = function(ptr) {
            var ret = ff_copyout_packet_ptr(ptr);
            if (!AVPacket_time_base_num(ret))
                AVPacket_time_base_s(ret, tbNum, tbDen);
            return ret;
        };
    }

    function handleFrame(inFrame) {
        if (inFrame !== null) {
            ff_copyin_frame(frame, inFrame);
            if (tbNum) {
                if (typeof inFrame === "number") {
                    var itbn = AVFrame_time_base_num(frame);
                    if (itbn) {
                        ff_frame_rescale_ts_js(
                            frame,
                            itbn, AVFrame_time_base_den(frame),
                            tbNum, tbDen
                        );
                        AVFrame_time_base_s(frame, tbNum, tbDen);
                    }
                } else if (inFrame && inFrame.time_base_num) {
                    ff_frame_rescale_ts_js(
                        frame,
                        inFrame.time_base_num, inFrame.time_base_den,
                        tbNum, tbDen
                    );
                    AVFrame_time_base_s(frame, tbNum, tbDen);
                }
            }
        }

        var ret = avcodec_send_frame(ctx, inFrame?frame:0);
        if (ret < 0)
            throw new Error("Error sending the frame to the encoder: " + ff_error(ret));
        if (inFrame)
            av_frame_unref(frame);

        while (true) {
            ret = avcodec_receive_packet(ctx, pkt);
            if (ret === -6 /* EAGAIN */ || ret === -0x20464f45 /* AVERROR_EOF */)
                return;
            else if (ret < 0)
                throw new Error("Error encoding audio frame: " + ff_error(ret));

            outPackets.push(copyoutPacket(pkt));
            av_packet_unref(pkt);
        }
    }

    inFrames.forEach(handleFrame);

    if (config.fin)
        handleFrame(null);

    return outPackets;
};

/**
 * Decode some number of packets at once. Done in one go to avoid excess
 * message passing.
 * @param ctx  AVCodecContext
 * @param pkt  AVPacket
 * @param frame  AVFrame
 * @param inPackets  Incoming packets to decode
 * @param config  Decoding options. May be "true" to indicate end of stream.
 */
/* @types
 * ff_decode_multi@sync(
 *     ctx: number, pkt: number, frame: number, inPackets: (Packet | number)[],
 *     config?: boolean | {
 *         fin?: boolean,
 *         ignoreErrors?: boolean,
 *         copyoutFrame?: "default" | "video" | "video_packed"
 *     }
 * ): @promise@Frame[]@
 * ff_decode_multi@sync(
 *     ctx: number, pkt: number, frame: number, inPackets: (Packet | number)[],
 *     config: {
 *         fin?: boolean,
 *         ignoreErrors?: boolean,
 *         copyoutFrame: "ptr"
 *     }
 * ): @promise@number[]@
 * ff_decode_multi@sync(
 *     ctx: number, pkt: number, frame: number, inPackets: (Packet | number)[],
 *     config: {
 *         fin?: boolean,
 *         ignoreErrors?: boolean,
 *         copyoutFrame: "ImageData"
 *     }
 * ): @promise@ImageData[]@
 */
var ff_decode_multi = Module.ff_decode_multi = function(ctx, pkt, frame, inPackets, config) {
    var outFrames = [];
    var transfer = [];
    if (typeof config === "boolean") {
        config = {fin: config};
    } else {
        config = config || {};
    }

    var tbNum = AVCodecContext_time_base_num(ctx);
    var tbDen = AVCodecContext_time_base_den(ctx);

    var copyoutFrameO = ff_copyout_frame;
    if (config.copyoutFrame)
        copyoutFrameO = ff_copyout_frame_versions[config.copyoutFrame];
    var copyoutFrame = function(ptr) {
        var ret = copyoutFrameO(ptr);
        if (!ret.time_base_num) {
            ret.time_base_num = tbNum;
            ret.time_base_den = tbDen;
        }
        return ret;
    };
    if (config.copyoutFrame === "ptr") {
        copyoutFrame = function(ptr) {
            var ret = ff_copyout_frame_ptr(ptr);
            if (!AVFrame_time_base_num(ret))
                AVFrame_time_base_s(ret, tbNum, tbDen);
            return ret;
        };
    }

    function handlePacket(inPacket) {
        var ret;

        if (inPacket !== null) {
            ret = av_packet_make_writable(pkt);
            if (ret < 0)
                throw new Error("Failed to make packet writable: " + ff_error(ret));
            ff_copyin_packet(pkt, inPacket);

            if (tbNum) {
                if (typeof inPacket === "number") {
                    var iptbn = AVPacket_time_base_num(pkt);
                    if (iptbn) {
                        av_packet_rescale_ts_js(
                            pkt,
                            iptbn, AVPacket_time_base_den(pkt),
                            tbNum, tbDen
                        );
                        AVPacket_time_base_s(pkt, tbNum, tbDen);
                    }
                } else if (inPacket && inPacket.time_base_num) {
                    av_packet_rescale_ts_js(
                        pkt,
                        inPacket.time_base_num, inPacket.time_base_den,
                        tbNum, tbDen
                    );
                    AVPacket_time_base_s(pkt, tbNum, tbDen);
                }
            }
        } else {
            av_packet_unref(pkt);
        }

        ret = avcodec_send_packet(ctx, pkt);
        if (ret < 0) {
            var err = "Error submitting the packet to the decoder: " + ff_error(ret);
            if (!config.ignoreErrors)
                throw new Error(err);
            else {
                console.log(err);
                av_packet_unref(pkt);
                return;
            }
        }
        av_packet_unref(pkt);

        while (true) {
            ret = avcodec_receive_frame(ctx, frame);
            if (ret === -6 /* EAGAIN */ || ret === -0x20464f45 /* AVERROR_EOF */)
                return;
            else if (ret < 0)
                throw new Error("Error decoding audio frame: " + ff_error(ret));

            var outFrame = copyoutFrame(frame);
            if (outFrame && outFrame.libavjsTransfer && outFrame.libavjsTransfer.length)
                transfer.push.apply(transfer, outFrame.libavjsTransfer);
            outFrames.push(outFrame);
            av_frame_unref(frame);
        }
    }

    inPackets.forEach(handlePacket);

    if (config.fin)
        handlePacket(null);

    outFrames.libavjsTransfer = transfer;
    return outFrames;
};

/* Set the content of a packet. Necessary because we tend to strip packets of their content. */
var ff_set_packet = Module.ff_set_packet = function(pkt, data) {
    if (data.length === 0) {
        av_packet_unref(pkt);
    } else {
        var size = AVPacket_size(pkt);
        if (size < data.length) {
            var ret = av_grow_packet(pkt, data.length - size);
            if (ret < 0)
                throw new Error("Error growing packet: " + ff_error(ret));
        } else if (size > data.length)
            av_shrink_packet(pkt, data.length);
    }
    var ptr = AVPacket_data(pkt);
    Module.HEAPU8.set(data, ptr);
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
 * @param fmt  Format to use (optional)
 */
/* @types
 * ff_init_demuxer_file@sync(
 *     filename: string, fmt?: string
 * ): @promsync@[number, Stream[]]@
 */
function ff_init_demuxer_file(filename, fmt) {
    var fmt_ctx;

    return avformat_open_input_js(filename, fmt?fmt:null, null).then(function(ret) {
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

/**
 * Initialize a filter graph. No equivalent free since you just need to free
 * the graph itself (av_filter_graph_free) and everything under it will be
 * freed automatically.
 * Returns [AVFilterGraph, AVFilterContext, AVFilterContext], where the second
 * and third are the input and output buffer source/sink. For multiple
 * inputs/outputs, the second and third will be arrays, as appropriate.
 * @param filters_descr  Filtergraph description
 * @param input  Input settings, or array of input settings for multiple inputs
 * @param output  Output settings, or array of output settings for multiple
 *                outputs
 */
/* @types
 * ff_init_filter_graph@sync(
 *     filters_descr: string,
 *     input: FilterIOSettings,
 *     output: FilterIOSettings
 * ): @promise@[number, number, number]@;
 * ff_init_filter_graph@sync(
 *     filters_descr: string,
 *     input: FilterIOSettings[],
 *     output: FilterIOSettings
 * ): @promise@[number, number[], number]@;
 * ff_init_filter_graph@sync(
 *     filters_descr: string,
 *     input: FilterIOSettings,
 *     output: FilterIOSettings[]
 * ): @promise@[number, number, number[]]@;
 * ff_init_filter_graph@sync(
 *     filters_descr: string,
 *     input: FilterIOSettings[],
 *     output: FilterIOSettings[]
 * ): @promise@[number, number[], number[]]@
 */
var ff_init_filter_graph = Module.ff_init_filter_graph = function(filters_descr, input, output) {
    var buffersrc, abuffersrc, buffersink, abuffersink, filter_graph,
        tmp_src_ctx, tmp_sink_ctx, src_ctxs, sink_ctxs, io_outputs, io_inputs,
        int32s;
    var instr, outstr;

    var multiple_inputs = !!input.length;
    if (!multiple_inputs) input = [input];
    var multiple_outputs = !!output.length;
    if (!multiple_outputs) output = [output];
    src_ctxs = [];
    sink_ctxs = [];

    try {
        buffersrc = avfilter_get_by_name("buffer");
        abuffersrc = avfilter_get_by_name("abuffer");
        buffersink = avfilter_get_by_name("buffersink");
        abuffersink = avfilter_get_by_name("abuffersink");

        filter_graph = avfilter_graph_alloc();
        if (filter_graph === 0)
            throw new Error("Failed to allocate filter graph");

        // Allocate all the "outputs" (our inputs)
        io_outputs = 0;
        var ii = 0;
        input.forEach(function(input) {
            // Allocate the output itself
            var next_io_outputs = avfilter_inout_alloc();
            if (next_io_outputs === 0)
                throw new Error("Failed to allocate outputs");
            AVFilterInOut_next_s(next_io_outputs, io_outputs);
            io_outputs = next_io_outputs;

            // Now create our input filter
            var nm = "in" + (multiple_inputs?ii:"");
            if (input.type === 0 /* AVMEDIA_TYPE_VIDEO */) {
                if (buffersrc === 0)
                    throw new Error("Failed to load buffer filter");
                var frame_rate = input.frame_rate;
                var time_base = input.time_base;
                if (typeof frame_rate === "undefined")
                    frame_rate = 30;
                if (typeof time_base === "undefined")
                    time_base = [1, frame_rate];
                tmp_src_ctx = avfilter_graph_create_filter_js(buffersrc, nm,
                    "time_base=" + time_base[0] + "/" + time_base[1] +
                    ":frame_rate=" + frame_rate +
                    ":pix_fmt=" + (input.pix_fmt?input.pix_fmt:0/*YUV420P*/) +
                    ":width=" + (input.width?input.width:640) +
                    ":height=" + (input.height?input.height:360),
                    null, filter_graph);

            } else { // audio filter
                if (abuffersrc === 0)
                    throw new Error("Failed to load abuffer filter");
                var sample_rate = input.sample_rate;
                var time_base = input.time_base;
                if (typeof sample_rate === "undefined")
                    sample_rate = 48000;
                if (typeof time_base === "undefined")
                    time_base = [1, sample_rate];
                tmp_src_ctx = avfilter_graph_create_filter_js(abuffersrc, nm,
                    "time_base=" + time_base[0] + "/" + time_base[1] +
                    ":sample_rate=" + sample_rate +
                    ":sample_fmt=" + (input.sample_fmt?input.sample_fmt:3/*FLT*/) +
                    ":channel_layout=0x" + (input.channel_layout?input.channel_layout:4/*MONO*/).toString(16),
                    null, filter_graph);

            }

            if (tmp_src_ctx === 0)
                throw new Error("Cannot create buffer source");
            src_ctxs.push(tmp_src_ctx);

            // Configure the inout
            instr = av_strdup(nm);
            if (instr === 0)
                throw new Error("Failed to allocate output");

            AVFilterInOut_name_s(io_outputs, instr);
            instr = 0;
            AVFilterInOut_filter_ctx_s(io_outputs, tmp_src_ctx);
            tmp_src_ctx = 0;
            AVFilterInOut_pad_idx_s(io_outputs, 0);
            ii++;
        });

        // Allocate all the "inputs" (our outputs)
        io_inputs = 0;
        var oi = 0;
        output.forEach(function(output) {
            // Allocate the input itself
            var next_io_inputs = avfilter_inout_alloc();
            if (next_io_inputs === 0)
                throw new Error("Failed to allocate inputs");
            AVFilterInOut_next_s(next_io_inputs, io_inputs);
            io_inputs = next_io_inputs;

            // Create the output filter
            var nm = "out" + (multiple_outputs?oi:"");
            if (output.type === 0 /* AVMEDIA_TYPE_VIDEO */) {
                if (buffersink === 0)
                    throw new Error("Failed to load buffersink filter");
                tmp_sink_ctx = avfilter_graph_create_filter_js(
                    buffersink, nm, null, null, filter_graph);
            } else { // audio
                tmp_sink_ctx = avfilter_graph_create_filter_js(abuffersink, nm,
                    null, null, filter_graph);
            }
            if (tmp_sink_ctx === 0)
                throw new Error("Cannot create buffer sink");
            sink_ctxs.push(tmp_sink_ctx);

            if (output.type === 0 /* AVMEDIA_TYPE_VIDEO */) {
                // Allocate space to transfer our options
                int32s = ff_malloc_int32_list([
                    output.pix_fmt?output.pix_fmt:0 /* YUV420P */, -1
                ]);
                if (int32s === 0)
                    throw new Error("Failed to transfer parameters");

                if (
                    av_opt_set_int_list_js(
                        tmp_sink_ctx, "pix_fmts", 4, int32s, -1, 1
                    ) < 0
                ) {
                    throw new Error("Failed to set filter parameters");
                }
                free(int32s);
                int32s = 0;

            } else { // audio
                // Allocate space to transfer our options
                int32s = ff_malloc_int32_list([
                    output.sample_fmt?output.sample_fmt:3/*FLT*/, -1,
                    output.sample_rate?output.sample_rate:48000, -1
                ]);
                if (int32s === 0)
                    throw new Error("Failed to transfer parameters");
                var ch_layout = output.channel_layout?output.channel_layout:4;
                var ch_layout_i64 = [~~ch_layout, Math.floor(ch_layout / 0x100000000)];

                if (
                    av_opt_set_int_list_js(
                        tmp_sink_ctx, "sample_fmts", 4, int32s, -1, 1 /* AV_OPT_SEARCH_CHILDREN */
                    ) < 0 ||
                    ff_buffersink_set_ch_layout(
                        tmp_sink_ctx,
                        ch_layout_i64[0], ch_layout_i64[1]
                    ) < 0 ||
                    av_opt_set_int_list_js(
                        tmp_sink_ctx, "sample_rates", 4, int32s + 8, -1, 1
                    ) < 0
                )
                {
                    throw new Error("Failed to set filter parameters");
                }
                free(int32s);
                int32s = 0;

            }

            // Configure it
            outstr = av_strdup(nm);
            if (outstr === 0)
                throw new Error("Failed to transfer parameters");
            AVFilterInOut_name_s(io_inputs, outstr);
            outstr = 0;
            AVFilterInOut_filter_ctx_s(io_inputs, tmp_sink_ctx);
            tmp_sink_ctx = 0;
            AVFilterInOut_pad_idx_s(io_inputs, 0);
            oi++;
        });

        // Parse it
        var ret = avfilter_graph_parse(filter_graph, filters_descr, io_inputs, io_outputs, 0);
        if (ret < 0)
            throw new Error("Failed to initialize filters: " + ff_error(ret));
        io_inputs = io_outputs = 0;

        // Set the output frame sizes
        var oi = 0;
        output.forEach(function(output) {
            if (output.frame_size)
                av_buffersink_set_frame_size(sink_ctxs[oi], output.frame_size);
            oi++;
        });

        // Configure it
        ret = avfilter_graph_config(filter_graph, 0);
        if (ret < 0)
            throw new Error("Failed to configure filter graph: " + ff_error(ret));

    } catch (ex) {
        // Clean up after ourselves
        if (io_outputs) avfilter_inout_free(io_outputs);
        if (io_inputs) avfilter_inout_free(io_inputs);
        if (filter_graph) avfilter_graph_free(filter_graph);
        if (tmp_src_ctx) avfilter_free(tmp_src_ctx);
        if (tmp_sink_ctx) avfilter_free(tmp_sink_ctx);
        if (int32s) free(int32s);
        if (instr) free(instr);
        if (outstr) free(outstr);
        throw ex;

    }

    // And finally, return the critical parts
    return [filter_graph, multiple_inputs ? src_ctxs : src_ctxs[0], multiple_outputs ? sink_ctxs : sink_ctxs[0]];
};

/**
 * Filter some number of frames, possibly corresponding to multiple sources.
 * Only one sink is allowed, but config is per source. Set
 * `config.ignoreSinkTimebase` to leave frames' timebase as it was, rather than
 * imposing the timebase of the buffer sink. Set `config.copyoutFrame` to use a
 * different copier than the default.
 * @param srcs  AVFilterContext(s), input
 * @param buffersink_ctx  AVFilterContext, output
 * @param framePtr  AVFrame
 * @param inFrames  Input frames, either as an array of frames or with frames
 *                  per input
 * @param config  Options. May be "true" to indicate end of stream.
 */
/* @types
 * ff_filter_multi@sync(
 *     srcs: number, buffersink_ctx: number, framePtr: number,
 *     inFrames: (Frame | number)[], config?: boolean | {
 *         fin?: boolean,
 *         ignoreSinkTimebase?: boolean,
 *         copyoutFrame?: "default" | "video" | "video_packed"
 *     }
 * ): @promise@Frame[]@;
 * ff_filter_multi@sync(
 *     srcs: number[], buffersink_ctx: number, framePtr: number,
 *     inFrames: (Frame | number)[][], config?: boolean[] | {
 *         fin?: boolean,
 *         ignoreSinkTimebase?: boolean,
 *         copyoutFrame?: "default" | "video" | "video_packed"
 *     }[]
 * ): @promise@Frame[]@
 * ff_filter_multi@sync(
 *     srcs: number, buffersink_ctx: number, framePtr: number,
 *     inFrames: (Frame | number)[], config: {
 *         fin?: boolean,
 *         ignoreSinkTimebase?: boolean,
 *         copyoutFrame: "ptr"
 *     }
 * ): @promise@number[]@;
 * ff_filter_multi@sync(
 *     srcs: number[], buffersink_ctx: number, framePtr: number,
 *     inFrames: (Frame | number)[][], config: {
 *         fin?: boolean,
 *         ignoreSinkTimebase?: boolean,
 *         copyoutFrame: "ptr"
 *     }[]
 * ): @promise@number[]@
 * ff_filter_multi@sync(
 *     srcs: number, buffersink_ctx: number, framePtr: number,
 *     inFrames: (Frame | number)[], config: {
 *         fin?: boolean,
 *         ignoreSinkTimebase?: boolean,
 *         copyoutFrame: "ImageData"
 *     }
 * ): @promise@ImageData[]@;
 * ff_filter_multi@sync(
 *     srcs: number[], buffersink_ctx: number, framePtr: number,
 *     inFrames: (Frame | number)[][], config: {
 *         fin?: boolean,
 *         ignoreSinkTimebase?: boolean,
 *         copyoutFrame: "ImageData"
 *     }[]
 * ): @promise@ImageData[]@
 */
var ff_filter_multi = Module.ff_filter_multi = function(srcs, buffersink_ctx, framePtr, inFrames, config) {
    var outFrames = [];
    var transfer = [];
    var tbNum = -1, tbDen = -1;

    if (!srcs.length) {
        srcs = [srcs];
        inFrames = [inFrames];
        config = [config];
    }

    config = config.map(function(config) {
        if (config === true)
            return {fin: true};
        return config || {};
    });

    // Find the longest buffer (ideally they're all the same)
    var max = inFrames.map(function(srcFrames) {
        return srcFrames.length;
    }).reduce(function(a, b) {
        return Math.max(a, b);
    });

    function handleFrame(buffersrc_ctx, inFrame, copyoutFrame, config) {
        if (inFrame !== null)
            ff_copyin_frame(framePtr, inFrame);

        var ret = av_buffersrc_add_frame_flags(buffersrc_ctx, inFrame ? framePtr : 0, 8 /* AV_BUFFERSRC_FLAG_KEEP_REF */);
        if (ret < 0)
            throw new Error("Error while feeding the audio filtergraph: " + ff_error(ret));
        av_frame_unref(framePtr);

        while (true) {
            ret = av_buffersink_get_frame(buffersink_ctx, framePtr);
            if (ret === -6 /* EAGAIN */ || ret === -0x20464f45 /* AVERROR_EOF */)
                break;
            if (ret < 0)
                throw new Error("Error while receiving a frame from the filtergraph: " + ff_error(ret));

            if (tbNum < 0) {
                tbNum = av_buffersink_get_time_base_num(buffersink_ctx);
                tbDen = av_buffersink_get_time_base_den(buffersink_ctx);
            }

            var outFrame = copyoutFrame(framePtr);

            if (tbNum && !config.ignoreSinkTimebase) {
                if (typeof outFrame === "number") {
                    AVFrame_time_base_s(outFrame, tbNum, tbDen);
                } else if (outFrame) {
                    outFrame.time_base_num = tbNum;
                    outFrame.time_base_den = tbDen;
                }
            }

            if (outFrame && outFrame.libavjsTransfer && outFrame.libavjsTransfer.length)
                transfer.push.apply(transfer, outFrame.libavjsTransfer);
            outFrames.push(outFrame);
            av_frame_unref(framePtr);
        }
    }

    // Choose a frame copier per stream
    var copyoutFrames = [];
    for (var ti = 0; ti < inFrames.length; ti++) (function(ti) {
        var copyoutFrame = ff_copyout_frame;
        if (config[ti].copyoutFrame)
            copyoutFrame = ff_copyout_frame_versions[config[ti].copyoutFrame];
        copyoutFrames.push(copyoutFrame);
    })(ti);

    // Handle in *frame* order
    for (var fi = 0; fi <= max; fi++) {
        for (var ti = 0; ti < inFrames.length; ti++) {
            var inFrame = inFrames[ti][fi];
            if (inFrame) handleFrame(srcs[ti], inFrame, copyoutFrames[ti], config[ti]);
            else if (config[ti].fin) handleFrame(srcs[ti], null, copyoutFrames[ti], config[ti]);
        }
    }

    outFrames.libavjsTransfer = transfer;
    return outFrames;
};

/**
 * Decode and filter frames. Just a combination of ff_decode_multi and
 * ff_filter_multi that's all done on the libav.js side.
 * @param ctx  AVCodecContext
 * @param buffersrc_ctx  AVFilterContext, input
 * @param buffersink_ctx  AVFilterContext, output
 * @param pkt  AVPacket
 * @param frame  AVFrame
 * @param inPackets  Incoming packets to decode and filter
 * @param config  Decoding and filtering options. May be "true" to indicate end
 *                of stream.
 */
/* @types
 * ff_decode_filter_multi@sync(
 *     ctx: number, buffersrc_ctx: number, buffersink_ctx: number, pkt: number,
 *     frame: number, inPackets: (Packet | number)[],
 *     config?: boolean | {
 *         fin?: boolean,
 *         ignoreErrors?: boolean,
 *         copyoutFrame?: "default" | "video" | "video_packed"
 *     }
 * ): @promise@Frame[]@
 * ff_decode_filter_multi@sync(
 *     ctx: number, buffersrc_ctx: number, buffersink_ctx: number, pkt: number,
 *     frame: number, inPackets: (Packet | number)[],
 *     config: {
 *         fin?: boolean,
 *         ignoreErrors?: boolean,
 *         copyoutFrame: "ptr"
 *     }
 * ): @promise@number[]@
 * ff_decode_filter_multi@sync(
 *     ctx: number, buffersrc_ctx: number, buffersink_ctx: number, pkt: number,
 *     frame: number, inPackets: (Packet | number)[],
 *     config: {
 *         fin?: boolean,
 *         ignoreErrors?: boolean,
 *         copyoutFrame: "ImageData"
 *     }
 * ): @promise@ImageData[]@
 */
var ff_decode_filter_multi = Module.ff_decode_filter_multi = function(
    ctx, buffersrc_ctx, buffersink_ctx, pkt, frame, inPackets, config
) {
    if (typeof config === "boolean") {
        config = {fin: config};
    } else {
        config = config || {};
    }

    // 1: Decode
    var decodedFrames = ff_decode_multi(ctx, pkt, frame, inPackets, {
        fin: !!config.fin,
        ignoreErrors: !!config.ignoreErrors,
        copyoutFrame: "ptr"
    });

    // 2: Filter
    return ff_filter_multi(
        buffersrc_ctx, buffersink_ctx, frame, decodedFrames, {
            fin: !!config.fin,
            copyoutFrame: config.copyoutFrame || "default"
        }
    );
}

/**
 * Copy out a frame.
 * @param frame  AVFrame
 */
/// @types ff_copyout_frame@sync(frame: number): @promise@Frame@
var ff_copyout_frame = Module.ff_copyout_frame = function(frame) {
    var nb_samples = AVFrame_nb_samples(frame);
    if (nb_samples === 0) {
        // Maybe a video frame?
        var width = AVFrame_width(frame);
        if (width)
            return ff_copyout_frame_video_width(frame, width);
    }
    var channels = AVFrame_channels(frame);
    var format = AVFrame_format(frame);
    var transfer = [];
    var outFrame = {
        data: null,
        libavjsTransfer: transfer,
        channel_layout: AVFrame_channel_layout(frame),
        channels: channels,
        format: format,
        nb_samples: nb_samples,
        pts: AVFrame_pts(frame),
        ptshi: AVFrame_ptshi(frame),
        time_base_num: AVFrame_time_base_num(frame),
        time_base_den: AVFrame_time_base_den(frame),
        sample_rate: AVFrame_sample_rate(frame)
    };

    // FIXME: Need to support *every* format here
    if (format >= 5 /* U8P */) {
        // Planar format, multiple data pointers
        var data = [];
        for (var ci = 0; ci < channels; ci++) {
            var inData = AVFrame_data_a(frame, ci);
            var outData = null;
            switch (format) {
                case 5: // U8P
                    outData = copyout_u8(inData, nb_samples);
                    break;

                case 6: // S16P
                    outData = copyout_s16(inData, nb_samples);
                    break;

                case 7: // S32P
                    outData = copyout_s32(inData, nb_samples);
                    break;

                case 8: // FLT
                    outData = copyout_f32(inData, nb_samples);
                    break;
            }

            if (outData) {
                data.push(outData);
                transfer.push(outData.buffer);
            }
        }
        outFrame.data = data;

    } else {
        var ct = channels*nb_samples;
        var inData = AVFrame_data_a(frame, 0);
        var outData = null;
        switch (format) {
            case 0: // U8
                outData = copyout_u8(inData, ct);
                break;

            case 1: // S16
                outData = copyout_s16(inData, ct);
                break;

            case 2: // S32
                outData = copyout_s32(inData, ct);
                break;

            case 3: // FLT
                outData = copyout_f32(inData, ct);
                break;
        }

        if (outData) {
            outFrame.data = outData;
            transfer.push(outData.buffer);
        }

    }

    return outFrame;
};

/**
 * Copy out a video frame. `ff_copyout_frame` will copy out a video frame if a
 * video frame is found, but this may be faster if you know it's a video frame.
 * @param frame  AVFrame
 */
/// @types ff_copyout_frame_video@sync(frame: number): @promise@Frame@
var ff_copyout_frame_video = Module.ff_copyout_frame_video = function(frame) {
    return ff_copyout_frame_video_width(frame, AVFrame_width(frame));
};

// Copy out a video frame. Used internally by ff_copyout_frame.
var ff_copyout_frame_video_width = Module.ff_copyout_frame_video = function(frame, width) {
    var height = AVFrame_height(frame);
    var format = AVFrame_format(frame);
    var desc = av_pix_fmt_desc_get(format);
    var log2ch = AVPixFmtDescriptor_log2_chroma_h(desc);
    var layout = [];
    var transfer = [];
    var outFrame = {
        data: null,
        layout: layout,
        libavjsTransfer: transfer,
        width: width,
        height: height,
        crop: {
            top: AVFrame_crop_top(frame),
            bottom: AVFrame_crop_bottom(frame),
            left: AVFrame_crop_left(frame),
            right: AVFrame_crop_right(frame)
        },
        format: AVFrame_format(frame),
        key_frame: AVFrame_key_frame(frame),
        pict_type: AVFrame_pict_type(frame),
        pts: AVFrame_pts(frame),
        ptshi: AVFrame_ptshi(frame),
        time_base_num: AVFrame_time_base_num(frame),
        time_base_den: AVFrame_time_base_den(frame),
        sample_aspect_ratio: [
            AVFrame_sample_aspect_ratio_num(frame),
            AVFrame_sample_aspect_ratio_den(frame)
        ]
    };

    // Figure out the data range
    var dataLo = 1/0;
    var dataHi = 0;
    for (var p = 0; p < 8 /* AV_NUM_DATA_POINTERS */; p++) {
        var linesize = AVFrame_linesize_a(frame, p);
        if (!linesize)
            break;
        var plane = AVFrame_data_a(frame, p);
        if (plane < dataLo)
            dataLo = plane;
        var h = height;
        if (p === 1 || p === 2)
            h >>= log2ch;
        plane += linesize * h;
        if (plane > dataHi)
            dataHi = plane;
    }

    // Copy out that segment of data
    outFrame.data = Module.HEAPU8.slice(dataLo, dataHi);
    transfer.push(outFrame.data.buffer);

    // And describe the layout
    for (var p = 0; p < 8; p++) {
        var linesize = AVFrame_linesize_a(frame, p);
        if (!linesize)
            break;
        var plane = AVFrame_data_a(frame, p);
        layout.push({
            offset: plane - dataLo,
            stride: linesize
        });
    }

    return outFrame;
};

/**
 * Get the size of a packed video frame in its native format.
 * @param frame  AVFrame
 */
/// @types ff_frame_video_packed_size@sync(frame: number): @promise@Frame@
var ff_frame_video_packed_size = Module.ff_frame_video_packed_size = function(frame) {
    // FIXME: duplication
    var width = AVFrame_width(frame);
    var height = AVFrame_height(frame);
    var format = AVFrame_format(frame);
    var desc = av_pix_fmt_desc_get(format);

    // VERY simple bpp, assuming all components are 8-bit
    var bpp = 1;
    if (!(AVPixFmtDescriptor_flags(desc) & 0x10) /* planar */)
        bpp *= AVPixFmtDescriptor_nb_components(desc);

    var dataSz = 0;
    for (var i = 0; i < 8 /* AV_NUM_DATA_POINTERS */; i++) {
        var linesize = AVFrame_linesize_a(frame, i);
        if (!linesize)
            break;
        var w = width * bpp;
        var h = height;
        if (i === 1 || i === 2) {
            w >>= AVPixFmtDescriptor_log2_chroma_w(desc);
            h >>= AVPixFmtDescriptor_log2_chroma_h(desc);
        }
        dataSz += w * h;
    }

    return dataSz;
};

/* Copy out just the packed data from this frame, into the given buffer. Used
 * internally. */
function ff_copyout_frame_data_packed(data, layout, frame) {
    var width = AVFrame_width(frame);
    var height = AVFrame_height(frame);
    var format = AVFrame_format(frame);
    var desc = av_pix_fmt_desc_get(format);

    // VERY simple bpp, assuming all components are 8-bit
    var bpp = 1;
    if (!(AVPixFmtDescriptor_flags(desc) & 0x10) /* planar */)
        bpp *= AVPixFmtDescriptor_nb_components(desc);

    // Copy it out
    var dIdx = 0;
    for (var i = 0; i < 8 /* AV_NUM_DATA_POINTERS */; i++) {
        var linesize = AVFrame_linesize_a(frame, i);
        if (!linesize)
            break;
        var inData = AVFrame_data_a(frame, i);
        var w = width * bpp;
        var h = height;
        if (i === 1 || i === 2) {
            w >>= AVPixFmtDescriptor_log2_chroma_w(desc);
            h >>= AVPixFmtDescriptor_log2_chroma_h(desc);
        }
        layout.push({
            offset: dIdx,
            stride: w
        });
        for (var y = 0; y < h; y++) {
            var line = inData + y * linesize;
            data.set(
                Module.HEAPU8.subarray(line, line + w),
                dIdx
            );
            dIdx += w;
        }
    }
};

/**
 * Copy out a video frame, as a single packed Uint8Array.
 * @param frame  AVFrame
 */
/// @types ff_copyout_frame_video_packed@sync(frame: number): @promise@Frame@
var ff_copyout_frame_video_packed = Module.ff_copyout_frame_video_packed = function(frame) {
    var data = new Uint8Array(ff_frame_video_packed_size(frame));
    var layout = [];
    ff_copyout_frame_data_packed(data, layout, frame);

    var outFrame = {
        data: data,
        libavjsTransfer: [data.buffer],
        width: AVFrame_width(frame),
        height: AVFrame_height(frame),
        format: AVFrame_format(frame),
        key_frame: AVFrame_key_frame(frame),
        pict_type: AVFrame_pict_type(frame),
        pts: AVFrame_pts(frame),
        ptshi: AVFrame_ptshi(frame),
        time_base_num: AVFrame_time_base_num(frame),
        time_base_den: AVFrame_time_base_den(frame),
        sample_aspect_ratio: [
            AVFrame_sample_aspect_ratio_num(frame),
            AVFrame_sample_aspect_ratio_den(frame)
        ]
    };

    return outFrame;
};

/**
 * Copy out a video frame as an ImageData. The video frame *must* be RGBA for
 * this to work as expected (though some ImageData will be returned for any
 * frame).
 * @param frame  AVFrame
 */
/* @types
 * ff_copyout_frame_video_imagedata@sync(
 *     frame: number
 * ): @promise@ImageData@
 */
var ff_copyout_frame_video_imagedata = Module.ff_copyout_frame_video_imagedata = function(frame) {
    var width = AVFrame_width(frame);
    var height = AVFrame_height(frame);
    var id = new ImageData(width, height);
    var layout = [];
    ff_copyout_frame_data_packed(id.data, layout, frame);
    id.libavjsTransfer = [id.data.buffer];
    return id;
};

/**
 * Copy "out" a video frame by just allocating another frame in libav.
 * @param frame  AVFrame
 */
var ff_copyout_frame_ptr = Module.ff_copyout_frame_ptr = function(frame) {
    var ret = av_frame_clone(frame);
    if (!ret)
        throw new Error("Failed to allocate new frame");
    return ret;
};

// All of the versions of ff_copyout_frame
var ff_copyout_frame_versions = {
    default: ff_copyout_frame,
    video: ff_copyout_frame_video,
    video_packed: ff_copyout_frame_video_packed,
    ImageData: ff_copyout_frame_video_imagedata,
    ptr: ff_copyout_frame_ptr
};

/**
 * Copy in a frame.
 * @param framePtr  AVFrame
 * @param frame  Frame to copy in, as either a Frame or an AVFrame pointer
 */
/// @types ff_copyin_frame@sync(framePtr: number, frame: Frame | number): @promise@void@
var ff_copyin_frame = Module.ff_copyin_frame = function(framePtr, frame) {
    if (typeof frame === "number") {
        // This is a frame pointer, not a libav.js Frame
        av_frame_unref(framePtr);
        var ret = av_frame_ref(framePtr, frame);
        if (ret < 0)
            throw new Error("Failed to reference frame data: " + ff_error(ret));
        av_frame_unref(frame);
        av_frame_free_js(frame);
        return;
    }

    if (frame.width)
        return ff_copyin_frame_video(framePtr, frame);

    var format = frame.format;
    var channels = frame.channels;
    if (!channels) {
        // channel_layout must be set
        var channel_layout = frame.channel_layout;
        channels = 0;
        while (channel_layout) {
            if (channel_layout&1) channels++;
            channel_layout>>>=1;
        }
    }

    [
        "channel_layout", "channels", "format", "pts", "ptshi", "sample_rate",
        "time_base_num", "time_base_den"
    ].forEach(function(key) {
        if (key in frame)
            CAccessors["AVFrame_" + key + "_s"](framePtr, frame[key]);
    });

    var nb_samples;
    if (format >= 5 /* U8P */) {
        // Planar, so nb_samples is out of data[0]
        nb_samples = frame.data[0].length;
    } else {
        // Non-planar, divide by channel count
        nb_samples = frame.data.length / channels;
    }

    AVFrame_nb_samples_s(framePtr, nb_samples);

    // We may or may not need to actually allocate
    if (av_frame_make_writable(framePtr) < 0) {
        var ret = av_frame_get_buffer(framePtr, 0);
        if (ret < 0)
            throw new Error("Failed to allocate frame buffers: " + ff_error(ret));
    }

    if (format >= 5 /* U8P */) {
        // A planar format
        for (var ci = 0; ci < channels; ci++) {
            var data = AVFrame_data_a(framePtr, ci);
            var inData = frame.data[ci];
            switch (format) {
                case 5: // U8P
                    copyin_u8(data, inData);
                    break;

                case 6: // S16P
                    copyin_s16(data, inData);
                    break;

                case 7: // S32P
                    copyin_s32(data, inData);
                    break;

                case 8: // FLT
                    copyin_f32(data, inData);
                    break;
            }
        }

    } else {
        var data = AVFrame_data_a(framePtr, 0);
        var inData = frame.data;

        // FIXME: Need to support *every* format here
        switch (format) {
            case 0: // U8
                copyin_u8(data, inData);
                break;

            case 1: // S16
                copyin_s16(data, inData);
                break;

            case 2: // S32
                copyin_s32(data, inData);
                break;

            case 3: // FLT
                copyin_f32(data, inData);
                break;
        }

    }
};

// Copy in a video frame. Used internally by ff_copyin_frame.
var ff_copyin_frame_video = Module.ff_copyin_frame_video = function(framePtr, frame) {
    [
        "format", "height", "key_frame", "pict_type", "pts", "ptshi", "width",
        "time_base_num", "time_base_den"
    ].forEach(function(key) {
        if (key in frame)
            CAccessors["AVFrame_" + key + "_s"](framePtr, frame[key]);
    });

    if ("sample_aspect_ratio" in frame) {
        AVFrame_sample_aspect_ratio_s(framePtr, frame.sample_aspect_ratio[0],
            frame.sample_aspect_ratio[1]);
    }

    var crop = frame.crop || {top: 0, bottom: 0, left: 0, right: 0};
    AVFrame_crop_top_s(framePtr, crop.top);
    AVFrame_crop_bottom_s(framePtr, crop.bottom);
    AVFrame_crop_left_s(framePtr, crop.left);
    AVFrame_crop_right_s(framePtr, crop.right);

    var desc = av_pix_fmt_desc_get(frame.format);
    var log2cw = AVPixFmtDescriptor_log2_chroma_w(desc);
    var log2ch = AVPixFmtDescriptor_log2_chroma_h(desc);

    // We may or may not need to actually allocate
    if (av_frame_make_writable(framePtr) < 0) {
        var ret = av_frame_get_buffer(framePtr, 0);
        if (ret < 0)
            throw new Error("Failed to allocate frame buffers: " + ff_error(ret));
    }

    // If layout is not provided, assume packed
    var layout = frame.layout;
    if (!layout) {
        layout = [];

        // VERY simple bpp, assuming all components are 8-bit
        var bpp = 1;
        if (!(AVPixFmtDescriptor_flags(desc) & 0x10) /* planar */)
            bpp *= AVPixFmtDescriptor_nb_components(desc);

        var off = 0;
        for (var p = 0; p < 8 /* AV_NUM_DATA_POINTERS */; p++) {
            var linesize = AVFrame_linesize_a(framePtr, p);
            if (!linesize)
                break;
            var w = frame.width;
            var h = frame.height;
            if (p === 1 || p === 2) {
                w >>= log2cw;
                h >>= log2ch;
            }
            layout.push({
                offset: off,
                stride: w * bpp
            });
            off += w * h * bpp;
        }
    }

    // Copy it in
    for (var p = 0; p < layout.length; p++) {
        var lplane = layout[p];
        var linesize = AVFrame_linesize_a(framePtr, p);
        var data = AVFrame_data_a(framePtr, p);
        var h = frame.height;
        if (p === 1 || p === 2)
            h >>= log2ch;
        var ioff = lplane.offset;
        var ooff = 0;
        var stride = Math.min(lplane.stride, linesize);
        for (var y = 0; y < h; y++) {
            copyin_u8(
                data + ooff,
                frame.data.subarray(ioff, ioff + stride)
            );
            ooff += linesize;
            ioff += lplane.stride;
        }
    }
};

/**
 * Copy out a packet.
 * @param pkt  AVPacket
 */
/// @types ff_copyout_packet@sync(pkt: number): @promise@Packet@
var ff_copyout_packet = Module.ff_copyout_packet = function(pkt) {
    var data = AVPacket_data(pkt);
    var size = AVPacket_size(pkt);
    var data = copyout_u8(data, size);
    return {
        data: data,
        libavjsTransfer: [data.buffer],
        pts: AVPacket_pts(pkt),
        ptshi: AVPacket_ptshi(pkt),
        dts: AVPacket_dts(pkt),
        dtshi: AVPacket_dtshi(pkt),
        time_base_num: AVPacket_time_base_num(pkt),
        time_base_den: AVPacket_time_base_den(pkt),
        stream_index: AVPacket_stream_index(pkt),
        flags: AVPacket_flags(pkt),
        duration: AVPacket_duration(pkt),
        durationhi: AVPacket_durationhi(pkt),
        side_data: ff_copyout_side_data(pkt)
    };
};

// Copy out a packet's side data. Used internally by ff_copyout_packet.
var ff_copyout_side_data = Module.ff_copyout_side_data = function(pkt) {
    var side_data = AVPacket_side_data(pkt);
    var side_data_elems = AVPacket_side_data_elems(pkt);
    if (!side_data) return null;

    var ret = [];
    for (var i = 0; i < side_data_elems; i++) {
        var data = AVPacketSideData_data(side_data, i);
        var size = AVPacketSideData_size(side_data, i);
        ret.push({
            data: copyout_u8(data, size),
            type: AVPacketSideData_type(side_data, i)
        });
    }

    return ret;
};

/**
 * Copy "out" a packet by just copying its data into a new AVPacket.
 * @param pkt  AVPacket
 */
/// @types ff_copyout_packet_ptr@sync(pkt: number): @promise@number@
var ff_copyout_packet_ptr = Module.ff_copyout_packet_ptr = function(pkt) {
    var ret = av_packet_clone(pkt);
    if (!ret)
        throw new Error("Failed to clone packet");
    return ret;
};

// Versions of ff_copyout_packet
var ff_copyout_packet_versions = {
    default: ff_copyout_packet,
    ptr: ff_copyout_packet_ptr
};

/**
 * Copy in a packet.
 * @param pktPtr  AVPacket
 * @param packet  Packet to copy in, as either a Packet or an AVPacket pointer
 */
/// @types ff_copyin_packet@sync(pktPtr: number, packet: Packet | number): @promise@void@
var ff_copyin_packet = Module.ff_copyin_packet = function(pktPtr, packet) {
    if (typeof packet === "number") {
        // Input packet is an AVPacket pointer, duplicate it
        av_packet_unref(pktPtr);
        var res = av_packet_ref(pktPtr, packet);
        if (res < 0)
            throw new Error("Failed to reference packet: " + ff_error(res));
        av_packet_unref(packet);
        av_packet_free_js(packet);
        return;
    }

    ff_set_packet(pktPtr, packet.data);

    [
        "dts", "dtshi", "duration", "durationhi", "flags", "side_data",
        "side_data_elems", "stream_index", "pts", "ptshi", "time_base_num",
        "time_base_den"
    ].forEach(function(key) {
        if (key in packet)
            CAccessors["AVPacket_" + key + "_s"](pktPtr, packet[key]);
    });

    if (packet.side_data)
        ff_copyin_side_data(pktPtr, packet.side_data);
};

// Copy in a packet's side data. Used internally by ff_copyin_packet.
var ff_copyin_side_data = Module.ff_copyin_side_data = function(pktPtr, side_data) {
    side_data.forEach(function(elem) {
        var data = av_packet_new_side_data(pktPtr, elem.type, elem.data.length);
        if (data === 0)
            throw new Error("Failed to allocate side data!");
        copyin_u8(data, elem.data);
    });
};

/**
 * Copy out codec parameters.
 * @param codecpar  AVCodecParameters
 */
/// @types ff_copyout_codecpar@sync(codecpar: number): @promise@CodecParameters@
var ff_copyout_codecpar = Module.ff_copyout_codecpar = function(codecpar) {
    return {
        bit_rate: AVCodecParameters_bit_rate(codecpar),
        channel_layoutmask: AVCodecParameters_channel_layoutmask(codecpar),
        channels: AVCodecParameters_channels(codecpar),
        chroma_location: AVCodecParameters_chroma_location(codecpar),
        codec_id: AVCodecParameters_codec_id(codecpar),
        codec_tag: AVCodecParameters_codec_tag(codecpar),
        codec_type: AVCodecParameters_codec_type(codecpar),
        color_primaries: AVCodecParameters_color_primaries(codecpar),
        color_range: AVCodecParameters_color_range(codecpar),
        color_space: AVCodecParameters_color_space(codecpar),
        color_trc: AVCodecParameters_color_trc(codecpar),
        format: AVCodecParameters_format(codecpar),
        height: AVCodecParameters_height(codecpar),
        level: AVCodecParameters_level(codecpar),
        profile: AVCodecParameters_profile(codecpar),
        sample_rate: AVCodecParameters_sample_rate(codecpar),
        width: AVCodecParameters_width(codecpar),
        extradata: ff_copyout_codecpar_extradata(codecpar)
    };
};

// Copy out codec parameter extradata. Used internally by ff_copyout_codecpar.
var ff_copyout_codecpar_extradata = Module.ff_copyout_codecpar_extradata = function(codecpar) {
    var extradata = AVCodecParameters_extradata(codecpar);
    var extradata_size = AVCodecParameters_extradata_size(codecpar);
    if (!extradata || !extradata_size) return null;
    return copyout_u8(extradata, extradata_size);
};

/**
 * Copy in codec parameters.
 * @param codecparPtr  AVCodecParameters
 * @param codecpar  Codec parameters to copy in.
 */
/// @types ff_copyin_codecpar@sync(codecparPtr: number, codecpar: CodecParameters): @promise@void@
var ff_copyin_codecpar = Module.ff_copyin_codecpar = function(codecparPtr, codecpar) {
    [
        "bit_rate", "channel_layoutmask", "channels", "chroma_location",
        "codec_id", "codec_tag", "codec_type", "color_primaries", "color_range",
        "color_space", "color_trc", "format", "height", "level", "profile",
        "sample_rate", "width"
    ].forEach(function(key) {
        if (key in codecpar)
            CAccessors["AVCodecParameters_" + key + "_s"](codecparPtr, codecpar[key]);
    });

    if (codecpar.extradata)
        ff_copyin_codecpar_extradata(codecparPtr, codecpar.extradata);
};

// Copy in codec parameter extradata. Used internally by ff_copyin_codecpar.
var ff_copyin_codecpar_extradata = Module.ff_copyin_codecpar_extradata = function(codecparPtr, extradata) {
    var extradataPtr = malloc(extradata.length);
    copyin_u8(extradataPtr, extradata);
    AVCodecParameters_extradata_s(codecparPtr, extradataPtr);
    AVCodecParameters_extradata_size_s(codecparPtr, extradata.length);
};

/**
 * Allocate and copy in a 32-bit int list.
 * @param list  List of numbers to copy in
 */
/// @types ff_malloc_int32_list@sync(list: number[]): @promise@number@
var ff_malloc_int32_list = Module.ff_malloc_int32_list = function(list) {
    var ptr = malloc(list.length * 4);
    if (ptr === 0)
        throw new Error("Failed to malloc");
    var arr = new Uint32Array(Module.HEAPU8.buffer, ptr, list.length);
    for (var i = 0; i < list.length; i++)
        arr[i] = list[i];
    return ptr;
};

/**
 * Allocate and copy in a 64-bit int list.
 * @param list  List of numbers to copy in
 */
/// @types ff_malloc_int64_list@sync(list: number[]): @promise@number@
var ff_malloc_int64_list = Module.ff_malloc_int64_list = function(list) {
    var ptr = malloc(list.length * 8);
    if (ptr === 0)
        throw new Error("Failed to malloc");
    var arr = new Int32Array(Module.HEAPU8.buffer, ptr, list.length*2);
    for (var i = 0; i < list.length; i++) {
        arr[i*2] = list[i];
        arr[i*2+1] = (list[i]<0)?-1:0;
    }
    return ptr;
};

/**
 * Allocate and copy in a string array. The resulting array will be
 * NULL-terminated.
 * @param arr  Array of strings to copy in.
 */
/// @types ff_malloc_string_array@sync(arr: string[]): @promise@number@
var ff_malloc_string_array = Module.ff_malloc_string_array = function(arr) {
    var ptr = malloc((arr.length + 1) * 4);
    if (ptr === 0)
        throw new Error("Failed to malloc");
    var inArr = new Uint32Array(Module.HEAPU8.buffer, ptr, arr.length + 1);
    var i;
    for (i = 0; i < arr.length; i++)
        inArr[i] = av_strdup(arr[i]);
    inArr[i] = 0;
    return ptr;
};

/**
 * Free a string array allocated by ff_malloc_string_array.
 * @param ptr  Pointer to the array to free.
 */
/// @types ff_free_string_array@sync(ptr: number): @promise@void@
var ff_free_string_array = Module.ff_free_string_array = function(ptr) {
    var iPtr = ptr / 4;
    for (;; iPtr++) {
        var elPtr = Module.HEAPU32[iPtr];
        if (!elPtr)
            break;
        free(elPtr);
    }
    free(ptr);
};

// Convert arguments to an array of string arguments (internal)
function convertArgs(argv0, args) {
    var ret = [argv0];
    ret = ret.concat(Array.prototype.slice.call(args, 0));
    for (var i = 0; i < ret.length; i++) {
        var arg = ret[i];
        if (typeof arg !== "string") {
            if ("length" in arg) {
                // Array of strings
                ret.splice.apply(ret, [i, 1].concat(arg));
            } else {
                // Just stringify it
                ret[i] = "" + arg;
            }
        }
    }
    return ret;
}

// Helper to run a main()
function runMain(main, name, args) {
    args = convertArgs(name, args);
    var argv = ff_malloc_string_array(args);
    Module.fsThrownError = null;
    var ret = null;
    try {
        ret = main(args.length, argv);
    } catch (ex) {
        if (ex && ex.name === "ExitStatus")
            ret = ex.status;
        else if (ex === "unwind")
            ret = EXITSTATUS;
        else
            throw ex;
    }

    function cleanup() {
        ff_free_string_array(argv);
    }

    if (ret && ret.then) {
        return ret.then(function(ret) {
            cleanup();
            return ret;
        }).catch(function(ex) {
            cleanup();
            if (ex && ex.name === "ExitStatus")
                return Promise.resolve(ex.status);
            else if (ex === "unwind")
                return Promise.resolve(EXITSTATUS);
            else
                return Promise.reject(ex);
        }).then(function(ret) {
            if (Module.fsThrownError) {
                var thr = Module.fsThrownError;
                Module.fsThrownError = null;
                throw thr;
            }
            return ret;
        });
    } else {
        cleanup();
        if (Module.fsThrownError) {
            var thr = Module.fsThrownError;
            Module.fsThrownError = null;
            throw thr;
        }
        return ret;
    }
}

/**
 * Frontend to the ffmpeg CLI (if it's compiled in). Pass arguments as strings,
 * or you may intermix arrays of strings for multiple arguments.
 *
 * NOTE: ffmpeg 6.0 and later require threads for the ffmpeg CLI. libav.js
 * *does* support the ffmpeg CLI on unthreaded environments, but to do so, it
 * uses an earlier version of the CLI, from 5.1.3. The libraries are still
 * modern, and if running libav.js in threaded mode, the ffmpeg CLI is modern as
 * well. As time passes, these two versions will drift apart, so make sure you
 * know whether you're running in threaded mode or not!
 */
/// @types ffmpeg@sync(...args: (string | string[])[]): @promsync@number@
var ffmpeg = Module.ffmpeg = function() {
    return runMain(ffmpeg_main, "ffmpeg", arguments);
};

/**
 * Frontend to the ffprobe CLI (if it's compiled in). Pass arguments as strings,
 * or you may intermix arrays of strings for multiple arguments.
 */
/// @types ffprobe@sync(...args: (string | string[])[]): @promsync@number@
var ffprobe = Module.ffprobe = function() {
    return runMain(ffprobe_main, "ffprobe", arguments);
};
