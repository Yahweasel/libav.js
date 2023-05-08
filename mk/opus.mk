OPUS_VERSION=1.3.1

build/inst/%/lib/pkgconfig/opus.pc: build/opus-$(OPUS_VERSION)/build-%/config.h
	cd build/opus-$(OPUS_VERSION)/build-$* ; \
		$(MAKE) install

build/opus-$(OPUS_VERSION)/build-%/config.h: build/inst/%/cflags.txt build/opus-$(OPUS_VERSION)/configure
	mkdir -p build/opus-$(OPUS_VERSION)/build-$*
	cd build/opus-$(OPUS_VERSION)/build-$* ; \
		emconfigure ../configure --prefix="$(PWD)/build/inst/$*" --host=mipsel-sysv \
			--disable-shared \
			CFLAGS="-Oz `cat $(PWD)/build/inst/$*/cflags.txt`"
	touch $@

extract: build/opus-$(OPUS_VERSION)/configure

build/opus-$(OPUS_VERSION)/configure: build/opus-$(OPUS_VERSION).tar.gz
	cd build ; tar zxf opus-$(OPUS_VERSION).tar.gz
	touch $@

build/opus-$(OPUS_VERSION).tar.gz:
	mkdir -p build
	curl https://downloads.xiph.org/releases/opus/opus-$(OPUS_VERSION).tar.gz -L -o $@

opus-release:
	cp build/opus-$(OPUS_VERSION).tar.gz libav.js-$(LIBAVJS_VERSION)/sources/

.PRECIOUS: \
	build/inst/%/lib/pkgconfig/opus.pc \
	build/opus-$(OPUS_VERSION)/build-%/config.h \
	build/opus-$(OPUS_VERSION)/configure
