LIBVORBIS_VERSION=1.3.7

tmp-inst/%/lib/pkgconfig/vorbis.pc: libvorbis-$(LIBVORBIS_VERSION)/build-%/config.h
	cd libvorbis-$(LIBVORBIS_VERSION)/build-$* ; \
		$(MAKE) install
	# This .pc file assumes .so semantics :(
	sed 's/-lvorbisenc/-lvorbisenc -lvorbis -logg/g' -i tmp-inst/$*/lib/pkgconfig/vorbisenc.pc

libvorbis-$(LIBVORBIS_VERSION)/build-%/config.h: tmp-inst/%/lib/pkgconfig/ogg.pc \
	libvorbis-$(LIBVORBIS_VERSION)/configure
	mkdir -p libvorbis-$(LIBVORBIS_VERSION)/build-$*
	cd libvorbis-$(LIBVORBIS_VERSION)/build-$* ; \
		emconfigure env PKG_CONFIG_PATH="$(PWD)/tmp-inst/$*/lib/pkgconfig" \
			../configure --prefix="$(PWD)/tmp-inst/$*" --host=mipsel-sysv \
			--disable-shared \
			CFLAGS="-Oz `cat $(PWD)/tmp-inst/$*/cflags.txt`"
	touch $@

extract: libvorbis-$(LIBVORBIS_VERSION)/configure

libvorbis-$(LIBVORBIS_VERSION)/configure: libvorbis-$(LIBVORBIS_VERSION).tar.xz
	tar Jxf libvorbis-$(LIBVORBIS_VERSION).tar.xz
	touch $@

libvorbis-$(LIBVORBIS_VERSION).tar.xz:
	curl https://downloads.xiph.org/releases/vorbis/libvorbis-$(LIBVORBIS_VERSION).tar.xz -L -o $@

libvorbis-release:
	cp libvorbis-$(LIBVORBIS_VERSION).tar.xz libav.js-$(LIBAVJS_VERSION)/sources/

.PRECIOUS: \
	tmp-inst/%/lib/pkgconfig/vorbis.pc \
	libvorbis-$(LIBVORBIS_VERSION)/build-%/config.h \
	libvorbis-$(LIBVORBIS_VERSION)/configure
