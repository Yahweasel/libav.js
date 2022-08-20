LIBVPX_VERSION=1.11.0

tmp-inst/%/lib/pkgconfig/vpx.pc: libvpx-$(LIBVPX_VERSION)/build-%/Makefile
	-cd libvpx-$(LIBVPX_VERSION)/build-$* ; \
		emmake $(MAKE)
	cd libvpx-$(LIBVPX_VERSION)/build-$* ; \
		for i in gtest vp9rc vpx ; do \
			emranlib lib$${i}_g.a ; \
			cp lib$${i}_g.a lib$${i}.a ; \
		done
	cd libvpx-$(LIBVPX_VERSION)/build-$* ; \
		emmake $(MAKE) install

libvpx-$(LIBVPX_VERSION)/build-%/Makefile: tmp-inst/%/cflags.txt libvpx-$(LIBVPX_VERSION)/configure
	mkdir -p libvpx-$(LIBVPX_VERSION)/build-$*
	cd libvpx-$(LIBVPX_VERSION)/build-$* ; \
		emconfigure ../configure --prefix="$(PWD)/tmp-inst/$*" \
			--target=generic-gnu \
			--extra-cflags="-Oz `cat $(PWD)/tmp-inst/$*/cflags.txt`" \
			--enable-static --disable-shared \
			--disable-webm-io \
			--disable-examples --disable-tools --disable-docs
	sed 's/^.* cfg = ".*/static const char* const cfg = "";/' -i libvpx-$(LIBVPX_VERSION)/build-$*/vpx_config.c

extract: libvpx-$(LIBVPX_VERSION)/configure

libvpx-$(LIBVPX_VERSION)/configure: libvpx-$(LIBVPX_VERSION).tar.gz
	tar zxf libvpx-$(LIBVPX_VERSION).tar.gz
	touch $@

libvpx-$(LIBVPX_VERSION).tar.gz:
	curl https://github.com/webmproject/libvpx/archive/refs/tags/v$(LIBVPX_VERSION).tar.gz -L -o $@

libvpx-release:
	cp libvpx-$(LIBVPX_VERSION).tar.gz libav.js-$(LIBAVJS_VERSION)/sources/

.PRECIOUS: \
	tmp-inst/%/lib/pkgconfig/vpx.pc \
	libvpx-$(LIBVPX_VERSION)/build-%/Makefile \
	libvpx-$(LIBVPX_VERSION)/configure
