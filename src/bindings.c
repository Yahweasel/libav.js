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

#include <stdio.h>
#include <string.h>

#include <malloc.h>

#ifdef __EMSCRIPTEN_PTHREADS__
#include <emscripten.h>
#include <pthread.h>
#endif

#include "libavcodec/avcodec.h"
#include "libavformat/avformat.h"
#include "libavfilter/avfilter.h"
#include "libavfilter/buffersink.h"
#include "libavutil/avutil.h"
#include "libavutil/opt.h"
#include "libavutil/pixdesc.h"
#include "libavutil/version.h"

#define A(struc, type, field) \
    type struc ## _ ## field(struc *a) { return a->field; } \
    void struc ## _ ## field ## _s(struc *a, type b) { a->field = b; }

#define AL(struc, type, field) \
    uint32_t struc ## _ ## field(struc *a) { return (uint32_t) a->field; } \
    uint32_t struc ## _ ## field ## hi(struc *a) { return (uint32_t) (a->field >> 32); } \
    void struc ## _ ## field ## _s(struc *a, uint32_t b) { a->field = b; } \
    void struc ## _ ## field ## hi_s(struc *a, uint32_t b) { a->field |= (((type) b) << 32); }

#define AA(struc, type, field) \
    type struc ## _ ## field ## _a(struc *a, size_t c) { return a->field[c]; } \
    void struc ## _ ## field ## _a_s(struc *a, size_t c, type b) { ((type *) a->field)[c] = b; }

#define RAT(struc, field) \
    int struc ## _ ## field ## _num(struc *a) { return a->field.num; } \
    int struc ## _ ## field ## _den(struc *a) { return a->field.den; } \
    void struc ## _ ## field ## _num_s(struc *a, int b) { a->field.num = b; } \
    void struc ## _ ## field ## _den_s(struc *a, int b) { a->field.den = b; } \
    void struc ## _ ## field ## _s(struc *a, int n, int d) { a->field.num = n; a->field.den = d; }

#define RAT_FAKE(struc, field, num, den) \
    int struc ## _ ## field ## _num(struc *a) { (void) a; return num; } \
    int struc ## _ ## field ## _den(struc *a) { (void) a; return den; } \
    void struc ## _ ## field ## _num_s(struc *a, int b) { (void) a; (void) b; } \
    void struc ## _ ## field ## _den_s(struc *a, int b) { (void) a; (void) b; } \
    void struc ## _ ## field ## _s(struc *a, int n, int d) { (void) a; (void) n; (void) d; }

/* Either way we expose the old channel layout API, but if the new channel
 * layout API is available, we use it */
#if LIBAVUTIL_VERSION_INT > AV_VERSION_INT(57, 23, 100)
/* New API */
#define CHL(struc) \
void struc ## _channel_layoutmask_s(struc *a, uint32_t bl, uint32_t bh) { \
    uint64_t mask =  (((uint64_t) bl)) | (((uint64_t) bh) << 32); \
    av_channel_layout_uninit(&a->ch_layout); \
    av_channel_layout_from_mask(&a->ch_layout, mask);\
} \
uint64_t struc ## _channel_layoutmask(struc *a) { \
    return a->ch_layout.u.mask; \
}\
int struc ## _channels(struc *a) { \
    return a->ch_layout.nb_channels; \
} \
void struc ## _channels_s(struc *a, int b) { \
    a->ch_layout.nb_channels = b; \
}\
int struc ## _ch_layout_nb_channels(struc *a) { \
    return a->ch_layout.nb_channels; \
}\
void struc ## _ch_layout_nb_channels_s(struc *a, int b) { \
    a->ch_layout.nb_channels = b; \
}\
uint32_t struc ## _channel_layout(struc *a) { \
    return (uint32_t) a->ch_layout.u.mask; \
}\
uint32_t struc ##_channel_layouthi(struc *a) { \
    return (uint32_t) (a->ch_layout.u.mask >> 32);\
}\
void struc ##_channel_layout_s(struc *a, uint32_t b) { \
    a->ch_layout.u.mask = (a->ch_layout.u.mask & (0xFFFFFFFFull << 32)) | (((uint64_t) b));\
    uint64_t mask = a->ch_layout.u.mask;\
    av_channel_layout_uninit(&a->ch_layout);\
    av_channel_layout_from_mask(&a->ch_layout, mask);\
}\
void struc ##_channel_layouthi_s(struc *a, uint32_t b) { \
    a->ch_layout.u.mask = (a->ch_layout.u.mask & 0xFFFFFFFFull) | (((uint64_t) b) << 32);\
    uint64_t mask = a->ch_layout.u.mask;\
    av_channel_layout_uninit(&a->ch_layout);\
    av_channel_layout_from_mask(&a->ch_layout, mask);\
}

#else
/* Old API */
#define CHL(struc) \
void struc ## _channel_layoutmask_s(struc *a, uint32_t bl, uint32_t bh) { \
    a->channel_layout = ((uint16_t) bh << 32) | bl; \
} \
uint64_t struc ## _channel_layoutmask(struc *a) { \
    return a->channel_layout; \
}\
int struc ## _channels(struc *a) { \
    return a->channels; \
} \
void struc ## _channels_s(struc *a, int b) { \
    a->channels = b; \
}\
int struc ## _ch_layout_nb_channels(struc *a) { \
    return a->channels; \
}\
void struc ## _ch_layout_nb_channels_s(struc *a, int b) { \
    a->channels = b; \
}\
uint32_t struc ## _channel_layout(struc *a) { \
    return a->channel_layout; \
}\
uint32_t struc ##_channel_layouthi(struc *a) { \
    return a->channel_layout >> 32; \
}\
void struc ##_channel_layout_s(struc *a, uint32_t b) { \
    a->channel_layout = \
        (a->channel_layout & (0xFFFFFFFFull << 32)) | \
        ((uint64_t) b); \
}\
void struc ##_channel_layouthi_s(struc *a, uint32_t b) { \
    a->channel_layout = \
        (((uint64_t) b) << 32) | \
        (a->channel_layout & 0xFFFFFFFFull); \
}

#endif /* Channel layout API version */


/* Not part of libav, just used to ensure a round trip to C for async purposes */
void ff_nothing() {}


/****************************************************************
 * libavutil
 ***************************************************************/

#if LIBAVJS_WITH_AVFRAME
#include "b-avframe.c"
#endif

int av_opt_set_int_list_js(void *obj, const char *name, int width, void *val, int term, int flags)
{
    switch (width) {
        case 4:
            return av_opt_set_int_list(obj, name, ((int32_t *) val), term, flags);
        case 8:
            return av_opt_set_int_list(obj, name, ((int64_t *) val), term, flags);
        default:
            return AVERROR(EINVAL);
    }
}

AVDictionary *av_dict_copy_js(
    AVDictionary *dst, const AVDictionary *src, int flags
) {
    av_dict_copy(&dst, src, flags);
    return dst;
}

AVDictionary *av_dict_set_js(
    AVDictionary *pm, const char *key, const char *value, int flags
) {
    av_dict_set(&pm, key, value, flags);
    return pm;
}

int av_compare_ts_js(
    unsigned int ts_a_lo, int ts_a_hi,
    int tb_a_num, int tb_a_den,
    unsigned int ts_b_lo, int ts_b_hi,
    int tb_b_num, int tb_b_den
) {
    int64_t ts_a = (int64_t) ts_a_lo + ((int64_t) ts_a_hi << 32);
    int64_t ts_b = (int64_t) ts_b_lo + ((int64_t) ts_b_hi << 32);
    AVRational tb_a = {tb_a_num, tb_b_den},
               tb_b = {tb_b_num, tb_b_den};
    return av_compare_ts(ts_a, tb_a, ts_b, tb_b);
}


/****************************************************************
 * libavcodec
 ***************************************************************/

#if LIBAVJS_WITH_AVCODEC
#include "b-avcodec.c"
#endif

#if LIBAVJS_WITH_BSF
#include "b-avbsf.c"
#endif

/****************************************************************
 * avformat
 ***************************************************************/

#if LIBAVJS_WITH_AVFORMAT
#include "b-avformat.c"
#endif

/****************************************************************
 * libavfilter
 ***************************************************************/

#if LIBAVJS_WITH_AVFILTER
#include "b-avfilter.c"
#endif

/****************************************************************
 * swscale
 ***************************************************************/
int libavjs_with_swscale() {
#ifdef LIBAVJS_WITH_SWSCALE
    return 1;
#else
    return 0;
#endif
}

#if LIBAVJS_WITH_SWSCALE && LIBAVUTIL_VERSION_INT <= AV_VERSION_INT(57, 4, 101)
/* No sws_scale_frame in this version */
void sws_scale_frame() {}
#endif


/****************************************************************
 * Threading
 ***************************************************************/

#ifdef __EMSCRIPTEN_PTHREADS__
EM_JS(void *, libavjs_main_thread, (void *ignore), {
    // Avoid exiting the runtime so we can receive normal requests
    noExitRuntime = Module.noExitRuntime = true;

    // Hijack the event handler
    var origOnmessage = onmessage;
    onmessage = function(ev) {
        var a;

        function reply(succ, ret) {
            var transfer = [];
            if (typeof ret === "object" && ret && ret.libavjsTransfer)
                transfer = ret.libavjsTransfer;
            postMessage({
                c: "libavjs_ret",
                a: [a[0], a[1], succ, ret]
            }, transfer);
        }

        if (ev.data && ev.data.c === "libavjs_run") {
            a = ev.data.a;
            var succ = true;
            var ret;
            try {
                ret = Module[a[1]].apply(Module, a.slice(2));
            } catch (ex) {
                succ = false;
                ret = ex + "\n" + ex.stack;
            }
            if (succ && ret && ret.then) {
                ret
                    .then(function(ret) { reply(true, ret); })
                    .catch(function(ret) { reply(false, ret + "\n" + ret.stack); });
            } else {
                reply(succ, ret);
            }

        } else if (ev.data && ev.data.c === "libavjs_wait_reader") {
            var name = "" + ev.data.fd;
            var waiters = Module.ff_reader_dev_waiters[name] || [];
            delete Module.ff_reader_dev_waiters[name];
            for (var i = 0; i < waiters.length; i++)
                waiters[i]();

        } else {
            return origOnmessage.apply(this, arguments);
        }
    };

    // And indicate that we're ready
    postMessage({c: "libavjs_ready"});
});

pthread_t libavjs_create_main_thread()
{
    pthread_t ret;
    if (pthread_create(&ret, NULL, libavjs_main_thread, NULL))
        return NULL;
    return ret;
}

#else
void *libavjs_create_main_thread() { return NULL; }

#endif

/****************************************************************
 * Other bindings
 ***************************************************************/
#define ERR_BUF_SZ 256
static char err_buf[ERR_BUF_SZ];

char *ff_error(int err)
{
    av_strerror(err, err_buf, ERR_BUF_SZ - 1);
    return err_buf;
}

int mallinfo_uordblks()
{
    return mallinfo().uordblks;
}

static const int LIBAVUTIL_VERSION_INT_V = LIBAVUTIL_VERSION_INT;
#undef LIBAVUTIL_VERSION_INT
int LIBAVUTIL_VERSION_INT() { return LIBAVUTIL_VERSION_INT_V; }
