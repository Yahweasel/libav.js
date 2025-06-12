LIBVPX_VERSION=1.15.2

build/inst/%/lib/pkgconfig/vpx.pc: build/libvpx-$(LIBVPX_VERSION)/build-%/Makefile
	-cd build/libvpx-$(LIBVPX_VERSION)/build-$* && \
		$(MAKE)
	cd build/libvpx-$(LIBVPX_VERSION)/build-$* && \
		for i in gtest vp9rc vpx vpxrc ; do \
			emranlib lib$${i}_g.a ; \
			cp lib$${i}_g.a lib$${i}.a ; \
		done
	cd build/libvpx-$(LIBVPX_VERSION)/build-$* && \
		$(MAKE) install

build/libvpx-$(LIBVPX_VERSION)/build-%/Makefile: build/libvpx-$(LIBVPX_VERSION)/configure | build/inst/%/cflags.txt
	tools/libvpx-emcc-version-check.sh
	mkdir -p build/libvpx-$(LIBVPX_VERSION)/build-$*
	cd build/libvpx-$(LIBVPX_VERSION)/build-$* && \
		emconfigure ../../libvpx-$(LIBVPX_VERSION)/configure \
			--prefix="$(PWD)/build/inst/$*" \
			--target=generic-gnu \
			--extra-cflags="-Oz `cat $(PWD)/build/inst/$*/cflags.txt`" \
			--enable-static --disable-shared \
			--disable-webm-io \
			--disable-examples --disable-tools --disable-docs
	sed 's/^.* cfg = ".*/static const char* const cfg = "";/' < build/libvpx-$(LIBVPX_VERSION)/build-$*/vpx_config.c > build/libvpx-$(LIBVPX_VERSION)/build-$*/vpx_config.c.tmp
	mv build/libvpx-$(LIBVPX_VERSION)/build-$*/vpx_config.c.tmp build/libvpx-$(LIBVPX_VERSION)/build-$*/vpx_config.c

extract: build/libvpx-$(LIBVPX_VERSION)/configure

build/libvpx-$(LIBVPX_VERSION)/configure: build/libvpx-$(LIBVPX_VERSION).tar.gz
	cd build && tar zxf libvpx-$(LIBVPX_VERSION).tar.gz
	touch $@

build/libvpx-$(LIBVPX_VERSION).tar.gz:
	mkdir -p build
	curl https://github.com/webmproject/libvpx/archive/refs/tags/v$(LIBVPX_VERSION).tar.gz -L -o $@

libvpx-release:
	cp build/libvpx-$(LIBVPX_VERSION).tar.gz $(RELEASE_DIR)/libav.js-$(LIBAVJS_VERSION)$(RELEASE_SUFFIX)/sources/

.PRECIOUS: \
	build/inst/%/lib/pkgconfig/vpx.pc \
	build/libvpx-$(LIBVPX_VERSION)/build-%/Makefile \
	build/libvpx-$(LIBVPX_VERSION)/configure
