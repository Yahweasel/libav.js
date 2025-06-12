ZLIB_VERSION=1.3.1

build/inst/%/lib/pkgconfig/zlib.pc: build/zlib-$(ZLIB_VERSION)/build-%/config.h
	cd build/zlib-$(ZLIB_VERSION)/build-$* && \
		$(MAKE) install

build/zlib-$(ZLIB_VERSION)/build-%/config.h: build/zlib-$(ZLIB_VERSION)/configure | build/inst/%/cflags.txt
	mkdir -p build/zlib-$(ZLIB_VERSION)/build-$*
	cd build/zlib-$(ZLIB_VERSION)/build-$* && \
		env CFLAGS="$(OPTFLAGS) `cat $(PWD)/build/inst/$*/cflags.txt`" \
		CHOST=emscripten \
		emconfigure ../../zlib-$(ZLIB_VERSION)/configure \
			--prefix="$(PWD)/build/inst/$*" \
			--static
	touch $@

extract: build/zlib-$(ZLIB_VERSION)/configure

build/zlib-$(ZLIB_VERSION)/configure: build/zlib-$(ZLIB_VERSION).tar.gz
	cd build && tar zxf zlib-$(ZLIB_VERSION).tar.gz
	touch $@

build/zlib-$(ZLIB_VERSION).tar.gz:
	mkdir -p build
	curl https://www.zlib.net/fossils/zlib-$(ZLIB_VERSION).tar.gz -L -o $@

zlib-release:
	cp build/zlib-$(ZLIB_VERSION).tar.gz $(RELEASE_DIR)/libav.js-$(LIBAVJS_VERSION)$(RELEASE_SUFFIX)/sources/

.PRECIOUS: \
	build/inst/%/lib/pkgconfig/zlib.pc \
	build/zlib-$(ZLIB_VERSION)/build-%/config.h \
	build/zlib-$(ZLIB_VERSION)/configure
