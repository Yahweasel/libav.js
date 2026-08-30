DAV1D_VERSION=1.5.4

build/inst/%/lib/pkgconfig/dav1d.pc: build/dav1d-$(DAV1D_VERSION)/build-%/build.ninja
	meson compile -C build/dav1d-$(DAV1D_VERSION)/build-$*
	meson install -C build/dav1d-$(DAV1D_VERSION)/build-$*

build/dav1d-$(DAV1D_VERSION)/build-%/build.ninja: build/dav1d-$(DAV1D_VERSION)/PATCHED \
	mk/emscripten.meson.cross | build/inst/%/cflags.txt
	mkdir -p build/dav1d-$(DAV1D_VERSION)/build-$*
	cd build/dav1d-$(DAV1D_VERSION)/build-$* && \
		emconfigure meson setup .. \
			--cross-file="$(PWD)/mk/emscripten.meson.cross" \
			--prefix="$(PWD)/build/inst/$*" \
			--libdir=lib \
			--default-library=static \
			--buildtype=release \
			-Dc_args="$(OPTFLAGS) `cat $(PWD)/build/inst/$*/cflags.txt`" \
			-Denable_asm=false \
			-Denable_tools=false \
			-Denable_examples=false \
			-Denable_tests=false \
			-Denable_docs=false

extract: build/dav1d-$(DAV1D_VERSION)/PATCHED

build/dav1d-$(DAV1D_VERSION)/PATCHED: build/dav1d-$(DAV1D_VERSION)/meson.build
	cd build/dav1d-$(DAV1D_VERSION) && ( test -e PATCHED || patch -p1 -i ../../patches/dav1d.diff )
	touch $@

build/dav1d-$(DAV1D_VERSION)/meson.build: build/dav1d-$(DAV1D_VERSION).tar.bz2
	cd build && tar jxf dav1d-$(DAV1D_VERSION).tar.bz2
	touch $@

build/dav1d-$(DAV1D_VERSION).tar.bz2:
	mkdir -p build
	curl https://code.videolan.org/videolan/dav1d/-/archive/$(DAV1D_VERSION)/dav1d-$(DAV1D_VERSION).tar.bz2 -L -o $@

dav1d-release:
	cp build/dav1d-$(DAV1D_VERSION).tar.bz2 $(RELEASE_DIR)/libav.js-$(LIBAVJS_VERSION)$(RELEASE_SUFFIX)/sources/

.PRECIOUS: \
	build/inst/%/lib/pkgconfig/dav1d.pc \
	build/dav1d-$(DAV1D_VERSION)/build-%/build.ninja \
	build/dav1d-$(DAV1D_VERSION)/PATCHED \
	build/dav1d-$(DAV1D_VERSION)/meson.build
