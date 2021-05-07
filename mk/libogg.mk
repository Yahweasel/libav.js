LIBOGG_VERSION=1.3.4

tmp-inst/lib/pkgconfig/ogg.pc: libogg-$(LIBOGG_VERSION)/config.h
	cd libogg-$(LIBOGG_VERSION) ; \
		emmake $(MAKE) install

libogg-$(LIBOGG_VERSION)/config.h: libogg-$(LIBOGG_VERSION)/configure
	cd libogg-$(LIBOGG_VERSION) ; \
		emconfigure ./configure --prefix="$(PWD)/tmp-inst" --host=mipsel-sysv \
			--disable-shared \
			CFLAGS=-Oz && \
		touch config.h

libogg-$(LIBOGG_VERSION)/configure: libogg-$(LIBOGG_VERSION).tar.xz
	tar Jxf libogg-$(LIBOGG_VERSION).tar.xz
	touch libogg-$(LIBOGG_VERSION)/configure

libogg-$(LIBOGG_VERSION).tar.xz:
	curl https://downloads.xiph.org/releases/ogg/libogg-$(LIBOGG_VERSION).tar.xz -L -o $@

libogg-release:
	cp libogg-$(LIBOGG_VERSION).tar.xz libav.js-$(LIBAVJS_VERSION)/sources/
