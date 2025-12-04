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

/* AVFrame */
#define B(type, field) A(AVFrame, type, field)
#define BL(type, field) AL(AVFrame, type, field)
#define BA(type, field) AA(AVFrame, type, field)
B(size_t, crop_bottom)
B(size_t, crop_left)
B(size_t, crop_right)
B(size_t, crop_top)
BA(uint8_t *, data)

#if LIBAVUTIL_VERSION_INT >= AV_VERSION_INT(57, 30, 100)
BL(int64_t, duration)
#else
uint32_t AVFrame_duration(AVFrame *a) { return (uint32_t) a->pkt_duration; }
uint32_t AVFrame_durationhi(AVFrame *a) { return (uint32_t) (a->pkt_duration >> 32); }
void AVFrame_duration_s(AVFrame *a, uint32_t b) { a->pkt_duration = b; }
void AVFrame_durationhi_s(AVFrame *a, uint32_t b) { a->pkt_duration |= (((int64_t) b) << 32); }
#endif

B(int, flags)
B(int, format)
B(int, height)
BA(int, linesize)
B(int, nb_samples)
B(int, pict_type)
BL(int64_t, pts)
BL(int64_t, best_effort_timestamp)
B(int, sample_rate)
B(int, width)
#undef B
#undef BL
#undef BA

RAT(AVFrame, sample_aspect_ratio)

#if LIBAVUTIL_VERSION_INT > AV_VERSION_INT(57, 10, 101)
RAT(AVFrame, time_base)
#else
RAT_FAKE(AVFrame, time_base, 1, 1000)
#endif

int AVFrame_key_frame(AVFrame *a) { return !!(a->flags & AV_FRAME_FLAG_KEY); }
void AVFrame_key_frame_s(AVFrame *a, int b) {
    a->flags = (a->flags & ~AV_FRAME_FLAG_KEY) | (b ? AV_FRAME_FLAG_KEY : 0);
}

CHL(AVFrame)

/* This isn't in libav because there's only one property to scale, but this
 * scaling is sufficiently painful in JavaScript that it's worth wrapping this
 * up in a helper. */
void ff_frame_rescale_ts_js(
    AVFrame *frame,
    int tb_src_num, int tb_src_den,
    int tb_dst_num, int tb_dst_den
) {
    AVRational tb_src = {tb_src_num, tb_src_den},
               tb_dst = {tb_dst_num, tb_dst_den};
    if (frame->pts != AV_NOPTS_VALUE)
        frame->pts = av_rescale_q(frame->pts, tb_src, tb_dst);
}

/* AVPixFmtDescriptor */
#define B(type, field) A(AVPixFmtDescriptor, type, field)
B(uint64_t, flags)
B(uint8_t, nb_components)
B(uint8_t, log2_chroma_h)
B(uint8_t, log2_chroma_w)
#undef B

int AVPixFmtDescriptor_comp_depth(AVPixFmtDescriptor *fmt, int comp)
{
    return fmt->comp[comp].depth;
}

