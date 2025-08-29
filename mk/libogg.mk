LIBOGG_VERSION=1.3.6

build/inst/%/lib/pkgconfig/ogg.pc: build/libogg-$(LIBOGG_VERSION)/build-%/config.h
	cd build/libogg-$(LIBOGG_VERSION)/build-$* && \
		$(MAKE) install

build/libogg-$(LIBOGG_VERSION)/build-%/config.h: build/libogg-$(LIBOGG_VERSION)/configure | build/inst/%/cflags.txt
	mkdir -p build/libogg-$(LIBOGG_VERSION)/build-$*
	cd build/libogg-$(LIBOGG_VERSION)/build-$* && \
		emconfigure ../../libogg-$(LIBOGG_VERSION)/configure \
			--prefix="$(PWD)/build/inst/$*" --host=mipsel-sysv \
			--disable-shared \
			CFLAGS="$(OPTFLAGS) `cat $(PWD)/build/inst/$*/cflags.txt`"
	touch $@

extract: build/libogg-$(LIBOGG_VERSION)/configure

build/libogg-$(LIBOGG_VERSION)/configure: build/libogg-$(LIBOGG_VERSION).tar.xz
	cd build && tar Jxf libogg-$(LIBOGG_VERSION).tar.xz
	touch $@

build/libogg-$(LIBOGG_VERSION).tar.xz:
	mkdir -p build
	curl https://downloads.xiph.org/releases/ogg/libogg-$(LIBOGG_VERSION).tar.xz -L -o $@

libogg-release:
	cp build/libogg-$(LIBOGG_VERSION).tar.xz $(RELEASE_DIR)/libav.js-$(LIBAVJS_VERSION)$(RELEASE_SUFFIX)/sources/

.PRECIOUS: \
	build/inst/%/lib/pkgconfig/ogg.pc \
	build/libogg-$(LIBOGG_VERSION)/build-%/config.h \
	build/libogg-$(LIBOGG_VERSION)/configure
