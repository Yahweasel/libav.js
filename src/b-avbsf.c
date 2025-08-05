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

#include "libavcodec/bsf.h"

#define B(type, field) A(AVBSFContext, type, field)
B(AVCodecParameters *, par_in)
B(AVCodecParameters *, par_out) // Read-only, should I just ignore the setter?
RAT(AVBSFContext, time_base_in)
RAT(AVBSFContext, time_base_out) // Read-only, should I just ignore the setter?
#undef B

AVBSFContext *av_bsf_list_parse_str_js(const char *str) {
    AVBSFContext *ret = NULL;
    int res;
    res = av_bsf_list_parse_str(str, &ret);
    if (res < 0) {
        av_bsf_free(&ret);
        return NULL;
    }
    return ret;
}
