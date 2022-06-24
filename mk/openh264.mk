OPENH264_VERSION=2.2.0

tmp-inst/lib/pkgconfig/openh264.pc: openh264-$(OPENH264_VERSION)/PATCHED
	cd openh264-$(OPENH264_VERSION) ; \
		emmake $(MAKE) install-static OS=linux \
		ARCH=mips CFLAGS="-O3 -fno-stack-protector" PREFIX=$(PWD)/tmp-inst

openh264-$(OPENH264_VERSION)/PATCHED: openh264-$(OPENH264_VERSION).tar.gz
	tar zxf openh264-$(OPENH264_VERSION).tar.gz
	cd openh264-$(OPENH264_VERSION) ; patch -p1 -i ../patches/openh264.diff
	touch openh264-$(OPENH264_VERSION)/PATCHED

openh264-$(OPENH264_VERSION).tar.gz:
	curl https://github.com/cisco/openh264/archive/refs/tags/v$(OPENH264_VERSION).tar.gz -L -o $@

openh264-release:
	cp openh264-$(OPENH264_VERSION).tar.gz libav.js-$(LIBAVJS_VERSION)/sources/
