X265_VERSION=3.5

tmp-inst/%/lib/pkgconfig/x265.pc: x265_$(X265_VERSION)/build-%/Makefile
	cd x265_$(X265_VERSION)/build-$* ; \
		emmake $(MAKE)
	cd x265_$(X265_VERSION)/build-$* ; \
		emmake $(MAKE) install

x265_$(X265_VERSION)/build-%/Makefile: tmp-inst/%/cflags.txt x265_$(X265_VERSION)/source/CMakeLists.txt
	mkdir -p x265_$(X265_VERSION)/build-$*
	cd x265_$(X265_VERSION)/build-$* ; \
		emcmake cmake ../source \
		-DCMAKE_TOOLCHAIN_FILE="$(PWD)/mk/x265.cmake" \
		-DCMAKE_INSTALL_PREFIX="$(PWD)/tmp-inst/$*" \
		-DCMAKE_C_FLAGS="-Oz `cat $(PWD)/tmp-inst/$*/cflags.txt`" \
		-DCMAKE_CXX_FLAGS="-Oz `cat $(PWD)/tmp-inst/$*/cflags.txt`" \
		-DENABLE_SHARED=OFF

extract: x265_$(X265_VERSION)/source/CMakeLists.txt

x265_$(X265_VERSION)/source/CMakeLists.txt: x265_$(X265_VERSION).tar.gz
	tar zxf x265_$(X265_VERSION).tar.gz
	touch $@

x265_$(X265_VERSION).tar.gz:
	curl https://bitbucket.org/multicoreware/x265_git/downloads/x265_$(X265_VERSION).tar.gz -L -o $@

x265_release:
	cp x265_$(X265_VERSION).tar.gz libav.js-$(LIBAVJS_VERSION)/sources/

.PRECIOUS: \
	tmp-inst/%/lib/pkgconfig/x265.pc \
	x265_$(X265_VERSION)/build-%/Makefile \
	x265_$(X265_VERSION)/configure
