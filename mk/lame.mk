LAME_VERSION=3.100

tmp-inst/lib/libmp3lame.a: lame-$(LAME_VERSION)/config.h
	cd lame-$(LAME_VERSION) ; \
		emmake $(MAKE) install

lame-$(LAME_VERSION)/config.h: lame-$(LAME_VERSION)/configure
	cd lame-$(LAME_VERSION) ; \
		emconfigure ./configure --prefix="$(PWD)/tmp-inst" \
			--host=mipsel-sysv --disable-shared CFLAGS=-Oz && \
		touch config.h

lame-$(LAME_VERSION)/configure: lame-$(LAME_VERSION).tar.gz
	tar zxf lame-$(LAME_VERSION).tar.gz
	touch lame-$(LAME_VERSION)/configure

lame-$(LAME_VERSION).tar.gz:
	curl https://sourceforge.net/projects/lame/files/lame/$(LAME_VERSION)/lame-$(LAME_VERSION).tar.gz -L -o $@

lame-release:
	cp lame-$(LAME_VERSION).tar.gz libav.js-$(LIBAVJS_VERSION)/sources/
