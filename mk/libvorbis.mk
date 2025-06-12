LIBVORBIS_VERSION=1.3.7

build/inst/%/lib/pkgconfig/vorbis.pc: build/libvorbis-$(LIBVORBIS_VERSION)/build-%/config.h
	cd build/libvorbis-$(LIBVORBIS_VERSION)/build-$* && \
		$(MAKE) install
	# This .pc file assumes .so semantics :(
	sed 's/-lvorbisenc/-lvorbisenc -lvorbis -logg/g' < build/inst/$*/lib/pkgconfig/vorbisenc.pc > build/inst/$*/lib/pkgconfig/vorbisenc.pc.tmp
	mv build/inst/$*/lib/pkgconfig/vorbisenc.pc.tmp build/inst/$*/lib/pkgconfig/vorbisenc.pc

build/libvorbis-$(LIBVORBIS_VERSION)/build-%/config.h: build/inst/%/lib/pkgconfig/ogg.pc \
	build/libvorbis-$(LIBVORBIS_VERSION)/configure \
	| build/inst/%/cflags.txt
	mkdir -p build/libvorbis-$(LIBVORBIS_VERSION)/build-$*
	cd build/libvorbis-$(LIBVORBIS_VERSION)/build-$* && \
		emconfigure env PKG_CONFIG_PATH="$(PWD)/build/inst/$*/lib/pkgconfig" \
			../../libvorbis-$(LIBVORBIS_VERSION)/configure \
			--prefix="$(PWD)/build/inst/$*" --host=mipsel-sysv \
			--disable-shared \
			CFLAGS="$(OPTFLAGS) `cat $(PWD)/build/inst/$*/cflags.txt`"
	touch $@

extract: build/libvorbis-$(LIBVORBIS_VERSION)/configure

build/libvorbis-$(LIBVORBIS_VERSION)/configure: build/libvorbis-$(LIBVORBIS_VERSION).tar.xz
	cd build && tar Jxf libvorbis-$(LIBVORBIS_VERSION).tar.xz
	touch $@

build/libvorbis-$(LIBVORBIS_VERSION).tar.xz:
	mkdir -p build
	curl https://downloads.xiph.org/releases/vorbis/libvorbis-$(LIBVORBIS_VERSION).tar.xz -L -o $@

libvorbis-release:
	cp build/libvorbis-$(LIBVORBIS_VERSION).tar.xz $(RELEASE_DIR)/libav.js-$(LIBAVJS_VERSION)$(RELEASE_SUFFIX)/sources/

.PRECIOUS: \
	build/inst/%/lib/pkgconfig/vorbis.pc \
	build/libvorbis-$(LIBVORBIS_VERSION)/build-%/config.h \
	build/libvorbis-$(LIBVORBIS_VERSION)/configure
