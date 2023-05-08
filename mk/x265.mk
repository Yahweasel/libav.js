X265_VERSION=3.5

build/inst/%/lib/pkgconfig/x265.pc: build/x265_$(X265_VERSION)/build-%/Makefile
	cd build/x265_$(X265_VERSION)/build-$* ; \
		$(MAKE)
	cd build/x265_$(X265_VERSION)/build-$* ; \
		$(MAKE) install

build/x265_$(X265_VERSION)/build-%/Makefile: build/inst/%/cflags.txt build/x265_$(X265_VERSION)/source/CMakeLists.txt
	mkdir -p build/x265_$(X265_VERSION)/build-$*
	cd build/x265_$(X265_VERSION)/build-$* ; \
		emcmake cmake ../source \
		-DCMAKE_TOOLCHAIN_FILE="$(PWD)/mk/x265.cmake" \
		-DCMAKE_INSTALL_PREFIX="$(PWD)/build/inst/$*" \
		-DCMAKE_C_FLAGS="-Oz `cat $(PWD)/build/inst/$*/cflags.txt`" \
		-DCMAKE_CXX_FLAGS="-Oz `cat $(PWD)/build/inst/$*/cflags.txt`" \
		-DENABLE_SHARED=OFF

extract: build/x265_$(X265_VERSION)/source/CMakeLists.txt

build/x265_$(X265_VERSION)/source/CMakeLists.txt: build/x265_$(X265_VERSION).tar.gz
	cd build ; tar zxf x265_$(X265_VERSION).tar.gz
	touch $@

build/x265_$(X265_VERSION).tar.gz:
	mkdir -p build
	curl https://bitbucket.org/multicoreware/x265_git/downloads/x265_$(X265_VERSION).tar.gz -L -o $@

x265_release:
	cp build/x265_$(X265_VERSION).tar.gz libav.js-$(LIBAVJS_VERSION)/sources/

.PRECIOUS: \
	build/inst/%/lib/pkgconfig/x265.pc \
	build/x265_$(X265_VERSION)/build-%/Makefile \
	build/x265_$(X265_VERSION)/configure
