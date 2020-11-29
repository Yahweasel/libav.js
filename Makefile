LIBAVJS_VERSION=2.2a.4.3.1
EMCC=emcc
MINIFIER=./node_modules/.bin/minify
MFLAGS=--js
CFLAGS=-Oz
EFLAGS=\
	--memory-init-file 0 --post-js post.js --extern-post-js extern-post.js \
	-s "EXPORT_NAME='LibAVFactory'" \
	-s "EXPORTED_FUNCTIONS=@exports.json" \
	-s "EXTRA_EXPORTED_RUNTIME_METHODS=['cwrap']" \
	-s MODULARIZE=1 \
	-s ALLOW_MEMORY_GROWTH=1

all: build-default

include mk/*

download: ffmpeg-$(FFMPEG_VERSION).tar.xz opus-$(OPUS_VERSION).tar.gz


build-%: libav-$(LIBAVJS_VERSION).js libav-$(LIBAVJS_VERSION).mjs \
	 libav-$(LIBAVJS_VERSION)-%.asm.js libav-$(LIBAVJS_VERSION)-%.wasm.js \
	 $(MINIFIER)
	sed "s/@CONFIG/$*/g" < $< | $(MINIFIER) $(MFLAGS) > libav-$(LIBAVJS_VERSION)-$*.js
	sed "s/@CONFIG/$*/g" < libav-$(LIBAVJS_VERSION).mjs | $(MINIFIER) $(MFLAGS) > libav-$(LIBAVJS_VERSION)-$*.mjs
	chmod a-x *.wasm


libav-$(LIBAVJS_VERSION)-%.asm.js: ffmpeg-$(FFMPEG_VERSION)/build-%/ffmpeg exports.json post.js extern-post.js bindings.c
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

libav-$(LIBAVJS_VERSION)-%.wasm.js: ffmpeg-$(FFMPEG_VERSION)/build-%/ffmpeg exports.json post.js extern-post.js bindings.c
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

libav-$(LIBAVJS_VERSION).js libav-$(LIBAVJS_VERSION).mjs post.js: exports.json
	true

./node_modules/.bin/minify:
	npm install minify

halfclean:
	-rm -f libav-$(LIBAVJS_VERSION)-*.js libav-$(LIBAVJS_VERSION)-*.mjs libav-$(LIBAVJS_VERSION)-*.wasm
	-rm -f exports.json libav-$(LIBAVJS_VERSION).js libav-$(LIBAVJS_VERSION).mjs post.js

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
	-rm -rf node_modules

.PRECIOUS: libav-$(LIBAVJS_VERSION)-%.wasm.js libav-$(LIBAVJS_VERSION)-%.asm.js ffmpeg-$(FFMPEG_VERSION)/build-%/ffmpeg ffmpeg-$(FFMPEG_VERSION)/build-%/ffbuild/config.mak
