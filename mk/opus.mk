OPUS_VERSION=1.5.2

build/inst/%/lib/pkgconfig/opus.pc: build/opus-$(OPUS_VERSION)/build-%/config.h
	cd build/opus-$(OPUS_VERSION)/build-$* && \
		$(MAKE) install

build/opus-$(OPUS_VERSION)/build-%/config.h: build/opus-$(OPUS_VERSION)/configure | build/inst/%/cflags.txt
	mkdir -p build/opus-$(OPUS_VERSION)/build-$*
	cd build/opus-$(OPUS_VERSION)/build-$* && \
		emconfigure ../../opus-$(OPUS_VERSION)/configure \
			--prefix="$(PWD)/build/inst/$*" --host=mipsel-sysv \
			--disable-shared --disable-extra-programs \
			CFLAGS="$(OPTFLAGS) `cat $(PWD)/build/inst/$*/cflags.txt`"
	touch $@

extract: build/opus-$(OPUS_VERSION)/configure

build/opus-$(OPUS_VERSION)/configure: build/opus-$(OPUS_VERSION).tar.gz
	cd build && tar zxf opus-$(OPUS_VERSION).tar.gz
	touch $@

build/opus-$(OPUS_VERSION).tar.gz:
	mkdir -p build
	curl https://downloads.xiph.org/releases/opus/opus-$(OPUS_VERSION).tar.gz -L -o $@

opus-release:
	cp build/opus-$(OPUS_VERSION).tar.gz $(RELEASE_DIR)/libav.js-$(LIBAVJS_VERSION)$(RELEASE_SUFFIX)/sources/

.PRECIOUS: \
	build/inst/%/lib/pkgconfig/opus.pc \
	build/opus-$(OPUS_VERSION)/build-%/config.h \
	build/opus-$(OPUS_VERSION)/configure
