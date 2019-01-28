LIBVORBIS_VERSION=1.3.6

tmp-inst/lib/pkgconfig/vorbis.pc: libvorbis-$(LIBVORBIS_VERSION)/config.h
	cd libvorbis-$(LIBVORBIS_VERSION) ; \
		emmake $(MAKE) install
	# This .pc file assumes .so semantics :(
	sed 's/-lvorbisenc/-lvorbisenc -lvorbis -logg/g' -i tmp-inst/lib/pkgconfig/vorbisenc.pc

libvorbis-$(LIBVORBIS_VERSION)/config.h: libvorbis-$(LIBVORBIS_VERSION)/configure tmp-inst/lib/pkgconfig/ogg.pc
	cd libvorbis-$(LIBVORBIS_VERSION) ; \
		emconfigure env PKG_CONFIG_PATH="$(PWD)/tmp-inst/lib/pkgconfig" \
			./configure --prefix="$(PWD)/tmp-inst" --host=mipsel-sysv \
			--disable-shared \
			CFLAGS=-Oz && \
		touch config.h

libvorbis-$(LIBVORBIS_VERSION)/configure: libvorbis-$(LIBVORBIS_VERSION).tar.xz
	tar Jxf libvorbis-$(LIBVORBIS_VERSION).tar.xz
	touch libvorbis-$(LIBVORBIS_VERSION)/configure

libvorbis-$(LIBVORBIS_VERSION).tar.xz:
	curl https://downloads.xiph.org/releases/vorbis/libvorbis-$(LIBVORBIS_VERSION).tar.xz -L -o $@
