LIBOGG_VERSION=1.3.5

build/inst/%/lib/pkgconfig/ogg.pc: build/libogg-$(LIBOGG_VERSION)/build-%/config.h
	cd build/libogg-$(LIBOGG_VERSION)/build-$* ; \
		$(MAKE) install

build/libogg-$(LIBOGG_VERSION)/build-%/config.h: build/inst/%/cflags.txt build/libogg-$(LIBOGG_VERSION)/configure
	mkdir -p build/libogg-$(LIBOGG_VERSION)/build-$*
	cd build/libogg-$(LIBOGG_VERSION)/build-$* ; \
		emconfigure ../configure --prefix="$(PWD)/build/inst/$*" --host=mipsel-sysv \
			--disable-shared \
			CFLAGS="-Oz `cat $(PWD)/build/inst/$*/cflags.txt`"
	touch $@

extract: build/libogg-$(LIBOGG_VERSION)/configure

build/libogg-$(LIBOGG_VERSION)/configure: build/libogg-$(LIBOGG_VERSION).tar.xz
	cd build ; tar Jxf libogg-$(LIBOGG_VERSION).tar.xz
	touch $@

build/libogg-$(LIBOGG_VERSION).tar.xz:
	mkdir -p build
	curl https://downloads.xiph.org/releases/ogg/libogg-$(LIBOGG_VERSION).tar.xz -L -o $@

libogg-release:
	cp build/libogg-$(LIBOGG_VERSION).tar.xz libav.js-$(LIBAVJS_VERSION)/sources/

.PRECIOUS: \
	build/inst/%/lib/pkgconfig/ogg.pc \
	build/libogg-$(LIBOGG_VERSION)/build-%/config.h \
	build/libogg-$(LIBOGG_VERSION)/configure
