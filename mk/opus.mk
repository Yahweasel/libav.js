OPUS_VERSION=1.3.1

tmp-inst%/lib/pkgconfig/opus.pc: opus-$(OPUS_VERSION)/build%/config.h
	cd opus-$(OPUS_VERSION)/build$* ; \
		emmake $(MAKE) install

opus-$(OPUS_VERSION)/build%/config.h: tmp-inst%/cflags.txt opus-$(OPUS_VERSION)/configure
	mkdir -p opus-$(OPUS_VERSION)/build$*
	cd opus-$(OPUS_VERSION)/build$* ; \
		emconfigure ../configure --prefix="$(PWD)/tmp-inst$*" --host=mipsel-sysv \
			--disable-shared \
			CFLAGS="-Oz `cat $(PWD)/tmp-inst$*/cflags.txt`" && \
		touch config.h

opus-$(OPUS_VERSION)/configure: opus-$(OPUS_VERSION).tar.gz
	tar zxf opus-$(OPUS_VERSION).tar.gz
	touch opus-$(OPUS_VERSION)/configure

opus-$(OPUS_VERSION).tar.gz:
	curl https://downloads.xiph.org/releases/opus/opus-$(OPUS_VERSION).tar.gz -L -o $@

opus-release:
	cp opus-$(OPUS_VERSION).tar.gz libav.js-$(LIBAVJS_VERSION)/sources/
