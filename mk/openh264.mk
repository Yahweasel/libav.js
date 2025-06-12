OPENH264_VERSION=2.5.1

build/inst/%/lib/pkgconfig/openh264.pc: build/openh264-$(OPENH264_VERSION)/PATCHED | build/inst/%/cflags.txt
	mkdir -p build/openh264-$(OPENH264_VERSION)/build-$*
	cd build/openh264-$(OPENH264_VERSION)/build-$* && \
		emmake $(MAKE) -j9 -f ../../openh264-$(OPENH264_VERSION)/Makefile \
		install-static OS=linux ARCH=mips \
		CFLAGS="$(OPTFLAGS) -fno-stack-protector `cat $(PWD)/build/inst/$*/cflags.txt`" \
		PREFIX="$(PWD)/build/inst/$*"

extract: build/openh264-$(OPENH264_VERSION)/PATCHED

build/openh264-$(OPENH264_VERSION)/PATCHED: build/openh264-$(OPENH264_VERSION)/Makefile
	cd build/openh264-$(OPENH264_VERSION) && ( test -e PATCHED || patch -p1 -i ../../patches/openh264.diff )
	touch $@

build/openh264-$(OPENH264_VERSION)/Makefile: build/openh264-$(OPENH264_VERSION).tar.gz
	cd build && tar zxf openh264-$(OPENH264_VERSION).tar.gz
	touch $@

build/openh264-$(OPENH264_VERSION).tar.gz:
	mkdir -p build
	curl https://github.com/cisco/openh264/archive/refs/tags/$(OPENH264_VERSION).tar.gz -L -o $@

openh264-release:
	cp build/openh264-$(OPENH264_VERSION).tar.gz $(RELEASE_DIR)/libav.js-$(LIBAVJS_VERSION)$(RELEASE_SUFFIX)/sources/

.PRECIOUS: \
	build/inst/%/lib/pkgconfig/openh264.pc \
	build/openh264-$(OPENH264_VERSION)/PATCHED \
	build/openh264-$(OPENH264_VERSION)/Makefile
