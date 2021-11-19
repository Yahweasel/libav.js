# 3.2.0
LIBAOM_VERSION=6bbe6ae7

tmp-inst/lib/pkgconfig/aom.pc: libaom-$(LIBAOM_VERSION)/bld/Makefile
	cd libaom-$(LIBAOM_VERSION)/bld ; \
		emmake $(MAKE) install

libaom-$(LIBAOM_VERSION)/bld/Makefile: libaom-$(LIBAOM_VERSION)/PATCHED
	mkdir -p libaom-$(LIBAOM_VERSION)/bld
	cd libaom-$(LIBAOM_VERSION)/bld ; \
		emcmake cmake .. -DCMAKE_INSTALL_PREFIX="$(PWD)/tmp-inst" \
		-DAOM_TARGET_CPU=generic \
		-DCMAKE_BUILD_TYPE=Release \
		-DENABLE_DOCS=0 \
		-DENABLE_TESTS=0 \
		-DENABLE_EXAMPLES=0 \
		-DCONFIG_MULTITHREAD=0 \
		-DCONFIG_RUNTIME_CPU_DETECT=0 \
		-DCONFIG_WEBM_IO=0

libaom-$(LIBAOM_VERSION)/PATCHED: libaom-$(LIBAOM_VERSION)/CMakeLists.txt
	cd libaom-$(LIBAOM_VERSION) ; patch -p1 -i ../patches/libaom.diff

libaom-$(LIBAOM_VERSION)/CMakeLists.txt: libaom-$(LIBAOM_VERSION).tar.gz
	mkdir -p libaom-$(LIBAOM_VERSION)
	cd libaom-$(LIBAOM_VERSION) ; \
		tar zxf ../libaom-$(LIBAOM_VERSION).tar.gz
	touch libaom-$(LIBAOM_VERSION)/CMakeLists.txt

libaom-$(LIBAOM_VERSION).tar.gz:
	curl https://aomedia.googlesource.com/aom/+archive/$(LIBAOM_VERSION).tar.gz -L -o $@

libaom-release:
	cp libaom-$(LIBAOM_VERSION).tar.gz libav.js-$(LIBAVJS_VERSION)/sources/
