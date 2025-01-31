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

/* Original versions of all our functions, since the Module version is replaced
 * if we're a Worker */
var CAccessors = {};

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

@FUNCS
