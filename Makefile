LIBAVJS_VERSION=2.3.4.4
EMCC=emcc
MINIFIER=closure-compiler --language_in ECMASCRIPT5
CFLAGS=-Oz
EFLAGS=\
	--memory-init-file 0 --post-js post.js --extern-post-js extern-post.js \
	-s "EXPORT_NAME='LibAVFactory'" \
	-s "EXPORTED_FUNCTIONS=@exports.json" \
	-s "EXTRA_EXPORTED_RUNTIME_METHODS=['cwrap']" \
	-s MODULARIZE=1 \
	-s ALLOW_MEMORY_GROWTH=1

LIBS=\
	bindings.c \
	tmp-inst/lib/libopus.a

all: build-default

include mk/*

download: ffmpeg-$(FFMPEG_VERSION).tar.xz opus-$(OPUS_VERSION).tar.gz


build-%: libav-$(LIBAVJS_VERSION).js libav-$(LIBAVJS_VERSION)-%.asm.js libav-$(LIBAVJS_VERSION)-%.wasm.js
	sed "s/@CONFIG/$*/g" < $< | $(MINIFIER) > libav-$(LIBAVJS_VERSION)-$*.js
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

libav-$(LIBAVJS_VERSION).js post.js: exports.json
	true

release:
	mkdir libav.js-$(LIBAVJS_VERSION)
	for v in default lite fat obsolete opus flac opus-flac webm webm-opus-flac mediarecorder-transcoder; \
	do \
	    $(MAKE) build-$$v; \
	    cp libav-$(LIBAVJS_VERSION)-$$v.js \
	       libav-$(LIBAVJS_VERSION)-$$v.asm.js \
	       libav-$(LIBAVJS_VERSION)-$$v.wasm.js \
	       libav-$(LIBAVJS_VERSION)-$$v.wasm.wasm \
	       libav.js-$(LIBAVJS_VERSION)/; \
	done
	mkdir libav.js-$(LIBAVJS_VERSION)/sources
	for t in ffmpeg lame libogg libvorbis opus; \
	do \
	    $(MAKE) $$t-release; \
	done
	git archive HEAD -o libav.js-$(LIBAVJS_VERSION)/sources/libav.js.tar
	xz libav.js-$(LIBAVJS_VERSION)/sources/libav.js.tar
	zip -r libav.js-$(LIBAVJS_VERSION).zip libav.js-$(LIBAVJS_VERSION)
	rm -rf libav.js-$(LIBAVJS_VERSION)

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
