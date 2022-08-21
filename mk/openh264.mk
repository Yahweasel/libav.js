OPENH264_VERSION=2.3.0

tmp-inst/%/lib/pkgconfig/openh264.pc: tmp-inst/%/cflags.txt openh264-$(OPENH264_VERSION)/PATCHED
	mkdir -p openh264-$(OPENH264_VERSION)/build-$*
	cd openh264-$(OPENH264_VERSION)/build-$* ; \
		emmake $(MAKE) -f ../Makefile install-static OS=linux \
		ARCH=mips CFLAGS="-Oz -fno-stack-protector `cat $(PWD)/tmp-inst/$*/cflags.txt`" \
		PREFIX="$(PWD)/tmp-inst/$*"

extract: openh264-$(OPENH264_VERSION)/PATCHED

openh264-$(OPENH264_VERSION)/PATCHED: openh264-$(OPENH264_VERSION)/Makefile
	cd openh264-$(OPENH264_VERSION) ; test -e PATCHED || patch -p1 -i ../patches/openh264.diff
	touch $@

openh264-$(OPENH264_VERSION)/Makefile: openh264-$(OPENH264_VERSION).tar.gz
	tar zxf openh264-$(OPENH264_VERSION).tar.gz
	touch $@

openh264-$(OPENH264_VERSION).tar.gz:
	curl https://github.com/cisco/openh264/archive/refs/tags/v$(OPENH264_VERSION).tar.gz -L -o $@

openh264-release:
	cp openh264-$(OPENH264_VERSION).tar.gz libav.js-$(LIBAVJS_VERSION)/sources/

.PRECIOUS: \
	tmp-inst/%/lib/pkgconfig/openh264.pc \
	openh264-$(OPENH264_VERSION)/PATCHED \
	openh264-$(OPENH264_VERSION)/Makefile
