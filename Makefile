LIBAVJS_VERSION=1.0.4.1
EMCC=emcc
MINIFIER=closure-compiler
CFLAGS=-Oz
EFLAGS=\
	--memory-init-file 0 --post-js post.js \
	-s "EXPORT_NAME='LibAV'" \
	-s "EXPORTED_FUNCTIONS=@exports.json" \
	-s "EXTRA_EXPORTED_RUNTIME_METHODS=['cwrap']" \
	-s MODULARIZE_INSTANCE=1 \
	-s ALLOW_MEMORY_GROWTH=1

LIBS=\
	bindings.c \
	tmp-inst/lib/libopus.a

all: build-default

include mk/*

download: ffmpeg-$(FFMPEG_VERSION).tar.xz opus-$(OPUS_VERSION).tar.gz


build-%: libav-$(LIBAVJS_VERSION).js libav-$(LIBAVJS_VERSION)-%.asm.js libav-$(LIBAVJS_VERSION)-%.wasm.js
	sed "s/@CONFIG/$*/g" < $< | $(MINIFIER) > libav-$(LIBAVJS_VERSION)-$*.js


libav-$(LIBAVJS_VERSION)-%.asm.js: ffmpeg-$(FFMPEG_VERSION)/build-%/ffmpeg exports.json post.js bindings.c
	$(EMCC) $(CFLAGS) $(EFLAGS) -s WASM=0 \
		-Iffmpeg-$(FFMPEG_VERSION) -Iffmpeg-$(FFMPEG_VERSION)/build-$* \
		bindings.c \
		ffmpeg-$(FFMPEG_VERSION)/build-$*/libavformat/libavformat.a \
		ffmpeg-$(FFMPEG_VERSION)/build-$*/libavfilter/libavfilter.a \
		ffmpeg-$(FFMPEG_VERSION)/build-$*/libavcodec/libavcodec.a \
		ffmpeg-$(FFMPEG_VERSION)/build-$*/libswresample/libswresample.a \
		ffmpeg-$(FFMPEG_VERSION)/build-$*/libavutil/libavutil.a \
		`test ! -e configs/$*/libs.txt || cat configs/$*/libs.txt` -o $@
	cat configs/$*/license.js $@ > $@.tmp
	mv $@.tmp $@

libav-$(LIBAVJS_VERSION)-%.wasm.js: ffmpeg-$(FFMPEG_VERSION)/build-%/ffmpeg exports.json post.js bindings.c
	$(EMCC) $(CFLAGS) $(EFLAGS) \
		-Iffmpeg-$(FFMPEG_VERSION) -Iffmpeg-$(FFMPEG_VERSION)/build-$* \
		bindings.c \
		ffmpeg-$(FFMPEG_VERSION)/build-$*/libavformat/libavformat.a \
		ffmpeg-$(FFMPEG_VERSION)/build-$*/libavfilter/libavfilter.a \
		ffmpeg-$(FFMPEG_VERSION)/build-$*/libavcodec/libavcodec.a \
		ffmpeg-$(FFMPEG_VERSION)/build-$*/libswresample/libswresample.a \
		ffmpeg-$(FFMPEG_VERSION)/build-$*/libavutil/libavutil.a \
		`test ! -e configs/$*/libs.txt || cat configs/$*/libs.txt` -o $@
	cat configs/$*/license.js $@ > $@.tmp
	mv $@.tmp $@

exports.json: libav.in.js post.in.js funcs.json apply-funcs.js
	./apply-funcs.js $(LIBAVJS_VERSION)

libav-$(LIBAVJS_VERSION).js post.js: exports.json
	true

halfclean:
	-rm -f libav-$(LIBAVJS_VERSION)-*.js libav-$(LIBAVJS_VERSION)-*.wasm
	-rm -f exports.json libav-$(LIBAVJS_VERSION).js post.js

clean: halfclean
	-rm -rf tmp-inst
	-rm -rf opus-$(OPUS_VERSION)
	-rm -rf libvorbis-$(LIBVORBIS_VERSION)
	-rm -rf libogg-$(LIBOGG_VERSION)
	-rm -rf lame-$(LAME_VERSION)
	-rm -rf ffmpeg-$(FFMPEG_VERSION)
	-rm -f ffmpeg-$(FFMPEG_VERSION)/ffbuild/config.mak

distclean: clean
	-rm -f opus-$(OPUS_VERSION).tar.gz
	-rm -rf libvorbis-$(LIBVORBIS_VERSION).tar.xz
	-rm -rf libogg-$(LIBOGG_VERSION).tar.xz
	-rm -rf lame-$(LAME_VERSION).tar.gz
	-rm -f ffmpeg-$(FFMPEG_VERSION).tar.xz

.PRECIOUS: libav-$(LIBAVJS_VERSION)-%.wasm.js libav-$(LIBAVJS_VERSION)-%.asm.js ffmpeg-$(FFMPEG_VERSION)/build-%/ffmpeg ffmpeg-$(FFMPEG_VERSION)/build-%/ffbuild/config.mak
