FFMPEG_VERSION=5.0.1

FFMPEG_CONFIG=--prefix=/opt/ffmpeg \
	--target-os=linux \
	--cc=emcc --ranlib=emranlib \
	--enable-small --disable-doc \
	--disable-stripping --disable-pthreads \
	--disable-programs \
	--disable-ffplay --disable-ffprobe --disable-network --disable-iconv --disable-xlib \
	--disable-sdl2 \
	--disable-everything


ffmpeg-$(FFMPEG_VERSION)/build-%/libavformat/libavformat.a: \
	ffmpeg-$(FFMPEG_VERSION)/build-%/ffbuild/config.mak
	cd ffmpeg-$(FFMPEG_VERSION)/build-$* ; emmake $(MAKE)

# ffmpeg WITHOUT simd
ffmpeg-$(FFMPEG_VERSION)/build-%/ffbuild/config.mak: tmp-inst-base/cflags.txt \
	ffmpeg-$(FFMPEG_VERSION)/PATCHED configs/%/ffmpeg-config.txt
	test ! -e configs/$*/deps.txt || $(MAKE) `sed 's/@TARGET/base/g' configs/$*/deps.txt`
	mkdir -p ffmpeg-$(FFMPEG_VERSION)/build-$* ; \
	cd ffmpeg-$(FFMPEG_VERSION)/build-$* ; \
	emconfigure env PKG_CONFIG_PATH="$(PWD)/tmp-inst-base/lib/pkgconfig" \
		../configure $(FFMPEG_CONFIG) \
		--arch=emscripten \
		--extra-cflags="-I$(PWD)/tmp-inst-base/include" \
		--extra-ldflags="-L$(PWD)/tmp-inst-base/lib" \
		`cat ../../configs/$*/ffmpeg-config.txt`

# ffmpeg WITH simd
ffmpeg-$(FFMPEG_VERSION)/build-simd-%/ffbuild/config.mak: tmp-inst-base/cflags.txt \
	ffmpeg-$(FFMPEG_VERSION)/PATCHED configs/%/ffmpeg-config.txt
	test ! -e configs/$*/deps.txt || $(MAKE) `sed 's/@TARGET/simd/g' configs/$*/deps.txt`
	mkdir -p ffmpeg-$(FFMPEG_VERSION)/build-simd-$* ; \
	cd ffmpeg-$(FFMPEG_VERSION)/build-simd-$* ; \
	emconfigure env PKG_CONFIG_PATH="$(PWD)/tmp-inst-simd/lib/pkgconfig" \
		../configure $(FFMPEG_CONFIG) \
		--arch=x86 --disable-inline-asm --disable-x86asm \
		--extra-cflags="-I$(PWD)/tmp-inst-simd/include -msimd128" \
		--extra-ldflags="-L$(PWD)/tmp-inst-simd/lib -msimd128" \
		`cat ../../configs/$*/ffmpeg-config.txt`

ffmpeg-$(FFMPEG_VERSION)/PATCHED: ffmpeg-$(FFMPEG_VERSION)/configure
	cd ffmpeg-$(FFMPEG_VERSION) ; patch -p1 -i ../patches/ffmpeg.diff

ffmpeg-$(FFMPEG_VERSION)/configure: ffmpeg-$(FFMPEG_VERSION).tar.xz
	tar Jxf ffmpeg-$(FFMPEG_VERSION).tar.xz
	touch ffmpeg-$(FFMPEG_VERSION)/configure

ffmpeg-$(FFMPEG_VERSION).tar.xz:
	curl https://ffmpeg.org/releases/ffmpeg-$(FFMPEG_VERSION).tar.xz -o $@

ffmpeg-release:
	cp ffmpeg-$(FFMPEG_VERSION).tar.xz libav.js-$(LIBAVJS_VERSION)/sources/
