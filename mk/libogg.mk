LIBOGG_VERSION=1.3.5

tmp-inst%/lib/pkgconfig/ogg.pc: libogg-$(LIBOGG_VERSION)/build%/config.h
	cd libogg-$(LIBOGG_VERSION)/build$* ; \
		emmake $(MAKE) install

libogg-$(LIBOGG_VERSION)/build%/config.h: tmp-inst%/cflags.txt libogg-$(LIBOGG_VERSION)/configure
	mkdir -p libogg-$(LIBOGG_VERSION)/build$*
	cd libogg-$(LIBOGG_VERSION)/build$* ; \
		emconfigure ../configure --prefix="$(PWD)/tmp-inst$*" --host=mipsel-sysv \
			--disable-shared \
			CFLAGS="-Oz `cat $(PWD)/tmp-inst$*/cflags.txt`" && \
		touch config.h

libogg-$(LIBOGG_VERSION)/configure: libogg-$(LIBOGG_VERSION).tar.xz
	tar Jxf libogg-$(LIBOGG_VERSION).tar.xz
	touch libogg-$(LIBOGG_VERSION)/configure

libogg-$(LIBOGG_VERSION).tar.xz:
	curl https://downloads.xiph.org/releases/ogg/libogg-$(LIBOGG_VERSION).tar.xz -L -o $@

libogg-release:
	cp libogg-$(LIBOGG_VERSION).tar.xz libav.js-$(LIBAVJS_VERSION)/sources/
