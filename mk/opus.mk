OPUS_VERSION=1.3.1

tmp-inst/lib/pkgconfig/opus.pc: opus-$(OPUS_VERSION)/config.h
	cd opus-$(OPUS_VERSION) ; \
		emmake $(MAKE) install

opus-$(OPUS_VERSION)/config.h: opus-$(OPUS_VERSION)/configure
	cd opus-$(OPUS_VERSION) ; \
		emconfigure ./configure --prefix="$(PWD)/tmp-inst" --host=mipsel-sysv \
			--disable-shared \
			CFLAGS=-Oz && \
		touch config.h

opus-$(OPUS_VERSION)/configure: opus-$(OPUS_VERSION).tar.gz
	tar zxf opus-$(OPUS_VERSION).tar.gz
	touch opus-$(OPUS_VERSION)/configure

opus-$(OPUS_VERSION).tar.gz:
	curl https://downloads.xiph.org/releases/opus/opus-$(OPUS_VERSION).tar.gz -L -o $@
