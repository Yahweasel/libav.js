ZLIB_VERSION=1.3

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

build/zlib-$(ZLIB_VERSION)/configure: build/zlib-$(ZLIB_VERSION).tar.xz
	cd build && tar Jxf zlib-$(ZLIB_VERSION).tar.xz
	touch $@

build/zlib-$(ZLIB_VERSION).tar.xz:
	mkdir -p build
	curl https://www.zlib.net/zlib-$(ZLIB_VERSION).tar.xz -L -o $@

zlib-release:
	cp build/zlib-$(ZLIB_VERSION).tar.xz libav.js-$(LIBAVJS_VERSION)/sources/

.PRECIOUS: \
	build/inst/%/lib/pkgconfig/zlib.pc \
	build/zlib-$(ZLIB_VERSION)/build-%/config.h \
	build/zlib-$(ZLIB_VERSION)/configure
