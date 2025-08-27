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

/* AVFilterInOut */
#define B(type, field) A(AVFilterInOut, type, field)
B(AVFilterContext *, filter_ctx)
B(char *, name)
B(AVFilterInOut *, next)
B(int, pad_idx)
#undef B

/* Buffer sink */
int av_buffersink_get_time_base_num(const AVFilterContext *ctx) {
    return av_buffersink_get_time_base(ctx).num;
}

int av_buffersink_get_time_base_den(const AVFilterContext *ctx) {
    return av_buffersink_get_time_base(ctx).den;
}

#if LIBAVFILTER_VERSION_INT > AV_VERSION_INT(8, 27, 100)
int ff_buffersink_set_ch_layout(AVFilterContext *ctx, unsigned int layoutlo, unsigned int layouthi) {
    uint64_t layout;
    char layoutStr[20];
    layout = ((uint64_t) layouthi << 32) | ((uint64_t) layoutlo);
    sprintf(layoutStr, "0x%llx", layout);
    return av_opt_set(ctx, "ch_layouts", layoutStr, AV_OPT_SEARCH_CHILDREN);
}
#else
int ff_buffersink_set_ch_layout(AVFilterContext *ctx, unsigned int layoutlo, unsigned int layouthi) {
    uint64_t layout[2];
    layout[0] = ((uint64_t) layouthi << 32) | ((uint64_t) layoutlo);
    layout[1] = -1;
    return av_opt_set_int_list(ctx, "channel_layouts", layout, -1, AV_OPT_SEARCH_CHILDREN);
}
#endif

AVFilterContext *avfilter_graph_create_filter_js(const AVFilter *filt,
    const char *name, const char *args, void *opaque, AVFilterGraph *graph_ctx)
{
    AVFilterContext *ret = NULL;
    int err = avfilter_graph_create_filter(&ret, filt, name, args, opaque, graph_ctx);
    if (err < 0)
        fprintf(stderr, "[avfilter_graph_create_filter_js] %s\n", av_err2str(err));
    return ret;
}

static const int LIBAVFILTER_VERSION_INT_V = LIBAVFILTER_VERSION_INT;
#undef LIBAVFILTER_VERSION_INT
int LIBAVFILTER_VERSION_INT() { return LIBAVFILTER_VERSION_INT_V; }
