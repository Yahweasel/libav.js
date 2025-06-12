LAME_VERSION=3.100

build/inst/%/lib/libmp3lame.a: build/lame-$(LAME_VERSION)/build-%/config.h
	cd build/lame-$(LAME_VERSION)/build-$* && \
		$(MAKE) install

build/lame-$(LAME_VERSION)/build-%/config.h: build/lame-$(LAME_VERSION)/configure | build/inst/%/cflags.txt
	mkdir -p build/lame-$(LAME_VERSION)/build-$*
	cd build/lame-$(LAME_VERSION)/build-$* && \
		emconfigure ../../lame-$(LAME_VERSION)/configure \
		--prefix="$(PWD)/build/inst/$*" --host=mipsel-sysv \
		--disable-shared \
		CFLAGS="$(OPTFLAGS) `cat $(PWD)/build/inst/$*/cflags.txt`"
	touch $@

extract: build/lame-$(LAME_VERSION)/configure

build/lame-$(LAME_VERSION)/configure: build/lame-$(LAME_VERSION).tar.gz
	cd build && tar zxf lame-$(LAME_VERSION).tar.gz
	touch $@

build/lame-$(LAME_VERSION).tar.gz:
	mkdir -p build
	curl https://sourceforge.net/projects/lame/files/lame/$(LAME_VERSION)/lame-$(LAME_VERSION).tar.gz -L -o $@

lame-release:
	cp build/lame-$(LAME_VERSION).tar.gz $(RELEASE_DIR)/libav.js-$(LIBAVJS_VERSION)$(RELEASE_SUFFIX)/sources/

.PRECIOUS: \
	build/inst/%/lib/libmp3lame.a \
	build/lame-$(LAME_VERSION)/build-%/config.h \
	build/lame-$(LAME_VERSION)/configure
