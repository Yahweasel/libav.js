

# NOTE: This file is generated by m4! Make sure you're editing the .m4 version,
# not the generated version!

LIBAVJS_VERSION=3.9.23
EMCC=emcc
MINIFIER=node_modules/.bin/uglifyjs -m
CFLAGS=-Oz
EFLAGS=\
	--memory-init-file 0 --post-js post.js --extern-post-js extern-post.js \
	-s "EXPORT_NAME='LibAVFactory'" \
	-s "EXPORTED_FUNCTIONS=@exports.json" \
	-s "EXTRA_EXPORTED_RUNTIME_METHODS=['cwrap']" \
	-s MODULARIZE=1 \
	-s ASYNCIFY \
	-s "ASYNCIFY_IMPORTS=['libavjs_wait_reader']" \
	-s ALLOW_MEMORY_GROWTH=1

all: build-default

include mk/*.mk


build-%: libav-$(LIBAVJS_VERSION)-%.js
	true

libav-$(LIBAVJS_VERSION)-%.js: libav-$(LIBAVJS_VERSION).js \
	libav-$(LIBAVJS_VERSION)-%.wasm.js \
	node_modules/.bin/uglifyjs
	sed "s/@CONFIG/$*/g" < $< | $(MINIFIER) > $@
	chmod a-x *.wasm


# General build rule for any target
# Use: buildrule(target file name, target inst name, CFLAGS, 


# asm.js version

libav-$(LIBAVJS_VERSION)-%.asm.js: ffmpeg-$(FFMPEG_VERSION)/build-base-%/libavformat/libavformat.a \
	exports.json post.js extern-post.js bindings.c
	$(EMCC) $(CFLAGS) $(EFLAGS) -s WASM=0 \
		-Iffmpeg-$(FFMPEG_VERSION) -Iffmpeg-$(FFMPEG_VERSION)/build-base-$(*) \
		`test ! -e configs/$(*)/link-flags.txt || cat configs/$(*)/link-flags.txt` \
		bindings.c \
                `grep LIBAVJS_WITH_CLI configs/$(*)/link-flags.txt > /dev/null 2>&1 && echo ' \
		ffmpeg-$(FFMPEG_VERSION)/build-base-$(*)/fftools/ffmpeg.o \
		ffmpeg-$(FFMPEG_VERSION)/build-base-$(*)/fftools/ffmpeg_filter.o \
		ffmpeg-$(FFMPEG_VERSION)/build-base-$(*)/fftools/ffmpeg_hw.o \
		ffmpeg-$(FFMPEG_VERSION)/build-base-$(*)/fftools/ffmpeg_mux.o \
		ffmpeg-$(FFMPEG_VERSION)/build-base-$(*)/fftools/ffmpeg_opt.o \
		ffmpeg-$(FFMPEG_VERSION)/build-base-$(*)/fftools/ffprobe.o \
		ffmpeg-$(FFMPEG_VERSION)/build-base-$(*)/fftools/cmdutils.o \
		ffmpeg-$(FFMPEG_VERSION)/build-base-$(*)/fftools/opt_common.o \
		ffmpeg-$(FFMPEG_VERSION)/build-base-$(*)/libavdevice/libavdevice.a \
		'` \
		ffmpeg-$(FFMPEG_VERSION)/build-base-$(*)/libavformat/libavformat.a \
		ffmpeg-$(FFMPEG_VERSION)/build-base-$(*)/libavfilter/libavfilter.a \
		ffmpeg-$(FFMPEG_VERSION)/build-base-$(*)/libavcodec/libavcodec.a \
		ffmpeg-$(FFMPEG_VERSION)/build-base-$(*)/libswresample/libswresample.a \
		ffmpeg-$(FFMPEG_VERSION)/build-base-$(*)/libavutil/libavutil.a \
		`grep LIBAVJS_WITH_SWSCALE configs/$(*)/link-flags.txt > /dev/null 2>&1 && echo 'ffmpeg-$(FFMPEG_VERSION)/build-base-$(*)/libswscale/libswscale.a'` \
		`test ! -e configs/$(*)/libs.txt || sed 's/@TARGET/base/' configs/$(*)/libs.txt` -o $(@)
	cat configs/$(*)/license.js $(@) > $(@).tmp
	mv $(@).tmp $(@)

# wasm version with no added features

libav-$(LIBAVJS_VERSION)-%.wasm.js: ffmpeg-$(FFMPEG_VERSION)/build-base-%/libavformat/libavformat.a \
	exports.json post.js extern-post.js bindings.c
	$(EMCC) $(CFLAGS) $(EFLAGS)  \
		-Iffmpeg-$(FFMPEG_VERSION) -Iffmpeg-$(FFMPEG_VERSION)/build-base-$(*) \
		`test ! -e configs/$(*)/link-flags.txt || cat configs/$(*)/link-flags.txt` \
		bindings.c \
                `grep LIBAVJS_WITH_CLI configs/$(*)/link-flags.txt > /dev/null 2>&1 && echo ' \
		ffmpeg-$(FFMPEG_VERSION)/build-base-$(*)/fftools/ffmpeg.o \
		ffmpeg-$(FFMPEG_VERSION)/build-base-$(*)/fftools/ffmpeg_filter.o \
		ffmpeg-$(FFMPEG_VERSION)/build-base-$(*)/fftools/ffmpeg_hw.o \
		ffmpeg-$(FFMPEG_VERSION)/build-base-$(*)/fftools/ffmpeg_mux.o \
		ffmpeg-$(FFMPEG_VERSION)/build-base-$(*)/fftools/ffmpeg_opt.o \
		ffmpeg-$(FFMPEG_VERSION)/build-base-$(*)/fftools/ffprobe.o \
		ffmpeg-$(FFMPEG_VERSION)/build-base-$(*)/fftools/cmdutils.o \
		ffmpeg-$(FFMPEG_VERSION)/build-base-$(*)/fftools/opt_common.o \
		ffmpeg-$(FFMPEG_VERSION)/build-base-$(*)/libavdevice/libavdevice.a \
		'` \
		ffmpeg-$(FFMPEG_VERSION)/build-base-$(*)/libavformat/libavformat.a \
		ffmpeg-$(FFMPEG_VERSION)/build-base-$(*)/libavfilter/libavfilter.a \
		ffmpeg-$(FFMPEG_VERSION)/build-base-$(*)/libavcodec/libavcodec.a \
		ffmpeg-$(FFMPEG_VERSION)/build-base-$(*)/libswresample/libswresample.a \
		ffmpeg-$(FFMPEG_VERSION)/build-base-$(*)/libavutil/libavutil.a \
		`grep LIBAVJS_WITH_SWSCALE configs/$(*)/link-flags.txt > /dev/null 2>&1 && echo 'ffmpeg-$(FFMPEG_VERSION)/build-base-$(*)/libswscale/libswscale.a'` \
		`test ! -e configs/$(*)/libs.txt || sed 's/@TARGET/base/' configs/$(*)/libs.txt` -o $(@)
	cat configs/$(*)/license.js $(@) > $(@).tmp
	mv $(@).tmp $(@)

# wasm + threads

libav-$(LIBAVJS_VERSION)-%.thr.js: ffmpeg-$(FFMPEG_VERSION)/build-thr-%/libavformat/libavformat.a \
	exports.json post.js extern-post.js bindings.c
	$(EMCC) $(CFLAGS) $(EFLAGS) -pthread \
		-Iffmpeg-$(FFMPEG_VERSION) -Iffmpeg-$(FFMPEG_VERSION)/build-thr-$(*) \
		`test ! -e configs/$(*)/link-flags.txt || cat configs/$(*)/link-flags.txt` \
		bindings.c \
                `grep LIBAVJS_WITH_CLI configs/$(*)/link-flags.txt > /dev/null 2>&1 && echo ' \
		ffmpeg-$(FFMPEG_VERSION)/build-thr-$(*)/fftools/ffmpeg.o \
		ffmpeg-$(FFMPEG_VERSION)/build-thr-$(*)/fftools/ffmpeg_filter.o \
		ffmpeg-$(FFMPEG_VERSION)/build-thr-$(*)/fftools/ffmpeg_hw.o \
		ffmpeg-$(FFMPEG_VERSION)/build-thr-$(*)/fftools/ffmpeg_mux.o \
		ffmpeg-$(FFMPEG_VERSION)/build-thr-$(*)/fftools/ffmpeg_opt.o \
		ffmpeg-$(FFMPEG_VERSION)/build-thr-$(*)/fftools/ffprobe.o \
		ffmpeg-$(FFMPEG_VERSION)/build-thr-$(*)/fftools/cmdutils.o \
		ffmpeg-$(FFMPEG_VERSION)/build-thr-$(*)/fftools/opt_common.o \
		ffmpeg-$(FFMPEG_VERSION)/build-thr-$(*)/libavdevice/libavdevice.a \
		'` \
		ffmpeg-$(FFMPEG_VERSION)/build-thr-$(*)/libavformat/libavformat.a \
		ffmpeg-$(FFMPEG_VERSION)/build-thr-$(*)/libavfilter/libavfilter.a \
		ffmpeg-$(FFMPEG_VERSION)/build-thr-$(*)/libavcodec/libavcodec.a \
		ffmpeg-$(FFMPEG_VERSION)/build-thr-$(*)/libswresample/libswresample.a \
		ffmpeg-$(FFMPEG_VERSION)/build-thr-$(*)/libavutil/libavutil.a \
		`grep LIBAVJS_WITH_SWSCALE configs/$(*)/link-flags.txt > /dev/null 2>&1 && echo 'ffmpeg-$(FFMPEG_VERSION)/build-thr-$(*)/libswscale/libswscale.a'` \
		`test ! -e configs/$(*)/libs.txt || sed 's/@TARGET/thr/' configs/$(*)/libs.txt` -o $(@)
	cat configs/$(*)/license.js $(@) > $(@).tmp
	mv $(@).tmp $(@)

# wasm + simd

libav-$(LIBAVJS_VERSION)-%.simd.js: ffmpeg-$(FFMPEG_VERSION)/build-simd-%/libavformat/libavformat.a \
	exports.json post.js extern-post.js bindings.c
	$(EMCC) $(CFLAGS) $(EFLAGS) -msimd128 \
		-Iffmpeg-$(FFMPEG_VERSION) -Iffmpeg-$(FFMPEG_VERSION)/build-simd-$(*) \
		`test ! -e configs/$(*)/link-flags.txt || cat configs/$(*)/link-flags.txt` \
		bindings.c \
                `grep LIBAVJS_WITH_CLI configs/$(*)/link-flags.txt > /dev/null 2>&1 && echo ' \
		ffmpeg-$(FFMPEG_VERSION)/build-simd-$(*)/fftools/ffmpeg.o \
		ffmpeg-$(FFMPEG_VERSION)/build-simd-$(*)/fftools/ffmpeg_filter.o \
		ffmpeg-$(FFMPEG_VERSION)/build-simd-$(*)/fftools/ffmpeg_hw.o \
		ffmpeg-$(FFMPEG_VERSION)/build-simd-$(*)/fftools/ffmpeg_mux.o \
		ffmpeg-$(FFMPEG_VERSION)/build-simd-$(*)/fftools/ffmpeg_opt.o \
		ffmpeg-$(FFMPEG_VERSION)/build-simd-$(*)/fftools/ffprobe.o \
		ffmpeg-$(FFMPEG_VERSION)/build-simd-$(*)/fftools/cmdutils.o \
		ffmpeg-$(FFMPEG_VERSION)/build-simd-$(*)/fftools/opt_common.o \
		ffmpeg-$(FFMPEG_VERSION)/build-simd-$(*)/libavdevice/libavdevice.a \
		'` \
		ffmpeg-$(FFMPEG_VERSION)/build-simd-$(*)/libavformat/libavformat.a \
		ffmpeg-$(FFMPEG_VERSION)/build-simd-$(*)/libavfilter/libavfilter.a \
		ffmpeg-$(FFMPEG_VERSION)/build-simd-$(*)/libavcodec/libavcodec.a \
		ffmpeg-$(FFMPEG_VERSION)/build-simd-$(*)/libswresample/libswresample.a \
		ffmpeg-$(FFMPEG_VERSION)/build-simd-$(*)/libavutil/libavutil.a \
		`grep LIBAVJS_WITH_SWSCALE configs/$(*)/link-flags.txt > /dev/null 2>&1 && echo 'ffmpeg-$(FFMPEG_VERSION)/build-simd-$(*)/libswscale/libswscale.a'` \
		`test ! -e configs/$(*)/libs.txt || sed 's/@TARGET/simd/' configs/$(*)/libs.txt` -o $(@)
	cat configs/$(*)/license.js $(@) > $(@).tmp
	mv $(@).tmp $(@)

# wasm + threads + simd

libav-$(LIBAVJS_VERSION)-%.thrsimd.js: ffmpeg-$(FFMPEG_VERSION)/build-thrsimd-%/libavformat/libavformat.a \
	exports.json post.js extern-post.js bindings.c
	$(EMCC) $(CFLAGS) $(EFLAGS) -pthread -msimd128 \
		-Iffmpeg-$(FFMPEG_VERSION) -Iffmpeg-$(FFMPEG_VERSION)/build-thrsimd-$(*) \
		`test ! -e configs/$(*)/link-flags.txt || cat configs/$(*)/link-flags.txt` \
		bindings.c \
                `grep LIBAVJS_WITH_CLI configs/$(*)/link-flags.txt > /dev/null 2>&1 && echo ' \
		ffmpeg-$(FFMPEG_VERSION)/build-thrsimd-$(*)/fftools/ffmpeg.o \
		ffmpeg-$(FFMPEG_VERSION)/build-thrsimd-$(*)/fftools/ffmpeg_filter.o \
		ffmpeg-$(FFMPEG_VERSION)/build-thrsimd-$(*)/fftools/ffmpeg_hw.o \
		ffmpeg-$(FFMPEG_VERSION)/build-thrsimd-$(*)/fftools/ffmpeg_mux.o \
		ffmpeg-$(FFMPEG_VERSION)/build-thrsimd-$(*)/fftools/ffmpeg_opt.o \
		ffmpeg-$(FFMPEG_VERSION)/build-thrsimd-$(*)/fftools/ffprobe.o \
		ffmpeg-$(FFMPEG_VERSION)/build-thrsimd-$(*)/fftools/cmdutils.o \
		ffmpeg-$(FFMPEG_VERSION)/build-thrsimd-$(*)/fftools/opt_common.o \
		ffmpeg-$(FFMPEG_VERSION)/build-thrsimd-$(*)/libavdevice/libavdevice.a \
		'` \
		ffmpeg-$(FFMPEG_VERSION)/build-thrsimd-$(*)/libavformat/libavformat.a \
		ffmpeg-$(FFMPEG_VERSION)/build-thrsimd-$(*)/libavfilter/libavfilter.a \
		ffmpeg-$(FFMPEG_VERSION)/build-thrsimd-$(*)/libavcodec/libavcodec.a \
		ffmpeg-$(FFMPEG_VERSION)/build-thrsimd-$(*)/libswresample/libswresample.a \
		ffmpeg-$(FFMPEG_VERSION)/build-thrsimd-$(*)/libavutil/libavutil.a \
		`grep LIBAVJS_WITH_SWSCALE configs/$(*)/link-flags.txt > /dev/null 2>&1 && echo 'ffmpeg-$(FFMPEG_VERSION)/build-thrsimd-$(*)/libswscale/libswscale.a'` \
		`test ! -e configs/$(*)/libs.txt || sed 's/@TARGET/thrsimd/' configs/$(*)/libs.txt` -o $(@)
	cat configs/$(*)/license.js $(@) > $(@).tmp
	mv $(@).tmp $(@)


exports.json: libav.in.js post.in.js funcs.json apply-funcs.js
	./apply-funcs.js $(LIBAVJS_VERSION)

libav-$(LIBAVJS_VERSION).js post.js: exports.json
	touch $@

node_modules/.bin/uglifyjs:
	npm install

# Targets
tmp-inst/base/cflags.txt:
	mkdir -p tmp-inst/base
	touch $@

tmp-inst/thr/cflags.txt:
	mkdir -p tmp-inst/thr
	echo '-pthread' > $@

tmp-inst/simd/cflags.txt:
	mkdir -p tmp-inst/simd
	echo '-msimd128' > $@

tmp-inst/thrsimd/cflags.txt:
	mkdir -p tmp-inst/thrsimd
	echo '-pthread -msimd128' > $@

release:
	mkdir libav.js-$(LIBAVJS_VERSION)
	for v in default lite fat obsolete opus flac opus-flac webm webm-opus-flac mediarecorder-transcoder open-media; \
	do \
	    $(MAKE) build-$$v; \
	    cp libav-$(LIBAVJS_VERSION)-$$v.js \
	       libav-$(LIBAVJS_VERSION)-$$v.asm.js \
	       libav-$(LIBAVJS_VERSION)-$$v.wasm.js \
	       libav-$(LIBAVJS_VERSION)-$$v.wasm.wasm \
	       libav-$(LIBAVJS_VERSION)-$$v.simd.js \
	       libav-$(LIBAVJS_VERSION)-$$v.simd.wasm \
	       libav.js-$(LIBAVJS_VERSION)/; \
	done
	mkdir libav.js-$(LIBAVJS_VERSION)/sources
	for t in ffmpeg lame libaom libogg libvorbis libvpx opus; \
	do \
	    $(MAKE) $$t-release; \
	done
	cp libav.types.d.ts libav.js-$(LIBAVJS_VERSION)/
	git archive HEAD -o libav.js-$(LIBAVJS_VERSION)/sources/libav.js.tar
	xz libav.js-$(LIBAVJS_VERSION)/sources/libav.js.tar
	zip -r libav.js-$(LIBAVJS_VERSION).zip libav.js-$(LIBAVJS_VERSION)
	rm -rf libav.js-$(LIBAVJS_VERSION)

publish:
	unzip libav.js-$(LIBAVJS_VERSION).zip
	( cd libav.js-$(LIBAVJS_VERSION) && \
	  cp ../package.json ../README.md . && \
	  npm publish )
	rm -rf libav.js-$(LIBAVJS_VERSION)

halfclean:
	-rm -f libav-$(LIBAVJS_VERSION)-*.js libav-$(LIBAVJS_VERSION)-*.wasm
	-rm -f exports.json libav-$(LIBAVJS_VERSION).js post.js libav.types.d.ts

clean: halfclean
	-rm -rf tmp-inst
	-rm -rf opus-$(OPUS_VERSION)
	-rm -rf libaom-$(LIBAOM_VERSION)
	-rm -rf libvorbis-$(LIBVORBIS_VERSION)
	-rm -rf libogg-$(LIBOGG_VERSION)
	-rm -rf libvpx-$(LIBVPX_VERSION)
	-rm -rf lame-$(LAME_VERSION)
	-rm -rf openh264-$(OPENH264_VERSION)
	-rm -rf ffmpeg-$(FFMPEG_VERSION)

distclean: clean
	-rm -f opus-$(OPUS_VERSION).tar.gz
	-rm -f libaom-$(LIBAOM_VERSION).tar.gz
	-rm -f libvorbis-$(LIBVORBIS_VERSION).tar.xz
	-rm -f libogg-$(LIBOGG_VERSION).tar.xz
	-rm -f libvpx-$(LIBVPX_VERSION).tar.gz
	-rm -f lame-$(LAME_VERSION).tar.gz
	-rm -rf openh264-$(OPENH264_VERSION).tar.gz
	-rm -f ffmpeg-$(FFMPEG_VERSION).tar.xz

.PRECIOUS: \
	libav-$(LIBAVJS_VERSION)-%.js \
	libav-$(LIBAVJS_VERSION)-%.asm.js \
	libav-$(LIBAVJS_VERSION)-%.wasm.js \
	libav-$(LIBAVJS_VERSION)-%.thr.js \
	libav-$(LIBAVJS_VERSION)-%.simd.js \
	libav-$(LIBAVJS_VERSION)-%.thrsimd.js
