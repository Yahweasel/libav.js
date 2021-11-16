LIBVPX_VERSION=1.11.0

tmp-inst/lib/pkgconfig/vpx.pc: libvpx-$(LIBVPX_VERSION)/Makefile
	-cd libvpx-$(LIBVPX_VERSION) ; \
		emmake $(MAKE)
	cd libvpx-$(LIBVPX_VERSION) ; \
		for i in gtest vp9rc vpx ; do \
			emranlib lib$${i}_g.a ; \
			cp lib$${i}_g.a lib$${i}.a ; \
		done
	cd libvpx-$(LIBVPX_VERSION) ; \
		emmake $(MAKE) install

libvpx-$(LIBVPX_VERSION)/Makefile: libvpx-$(LIBVPX_VERSION)/configure
	cd libvpx-$(LIBVPX_VERSION) ; \
		emconfigure ./configure --prefix="$(PWD)/tmp-inst" \
			--target=generic-gnu \
			--extra-cflags=-Oz \
			--enable-static --disable-shared \
			--disable-webm-io \
			--disable-examples --disable-tools --disable-docs
	sed 's/^.* cfg = ".*/static const char* const cfg = "";/' -i libvpx-$(LIBVPX_VERSION)/vpx_config.c

libvpx-$(LIBVPX_VERSION)/configure: libvpx-$(LIBVPX_VERSION).tar.gz
	tar zxf libvpx-$(LIBVPX_VERSION).tar.gz
	touch libvpx-$(LIBVPX_VERSION)/configure

libvpx-$(LIBVPX_VERSION).tar.gz:
	curl https://github.com/webmproject/libvpx/archive/refs/tags/v$(LIBVPX_VERSION).tar.gz -L -o $@

libvpx-release:
	cp libvpx-$(LIBVPX_VERSION).tar.gz libav.js-$(LIBAVJS_VERSION)/sources/
