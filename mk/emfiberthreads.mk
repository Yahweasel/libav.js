EMFT_VERSION=1.3

build/inst/%/include/pthread.h: build/inst/%/lib/libemfiberthreads.a
	cd build/emfiberthreads/emfiberthreads-$(EMFT_VERSION) && \
		$(MAKE) install-interpose PREFIX="$(PWD)/build/inst/$*"

build/inst/%/lib/libemfiberthreads.a: \
	build/emfiberthreads/emfiberthreads-$(EMFT_VERSION)/libemfiberthreads.a
	cd build/emfiberthreads/emfiberthreads-$(EMFT_VERSION) && \
		$(MAKE) install PREFIX="$(PWD)/build/inst/$*"

build/emfiberthreads/emfiberthreads-$(EMFT_VERSION)/libemfiberthreads.a: \
	build/emfiberthreads/emfiberthreads-$(EMFT_VERSION)/Makefile
	cd build/emfiberthreads/emfiberthreads-$(EMFT_VERSION) && \
		$(MAKE) STACK_SIZE=1048576

extract: build/emfiberthreads/emfiberthreads-$(EMFT_VERSION)/Makefile

build/emfiberthreads/emfiberthreads-$(EMFT_VERSION)/Makefile: build/emfiberthreads-$(EMFT_VERSION).tar.gz
	mkdir -p build/emfiberthreads
	cd build/emfiberthreads && tar zxf ../emfiberthreads-$(EMFT_VERSION).tar.gz
	touch $@

build/emfiberthreads-$(EMFT_VERSION).tar.gz:
	mkdir -p build
	curl https://github.com/Yahweasel/emfiberthreads/archive/refs/tags/v$(EMFT_VERSION).tar.gz -L -o $@

emfiberthreads-release:
	cp build/emfiberthreads-$(EMFT_VERSION).tar.gz $(RELEASE_DIR)/libav.js-$(LIBAVJS_VERSION)$(RELEASE_SUFFIX)/sources/

.PRECIOUS: \
	build/inst/%/include/pthread.h \
	build/inst/%/lib/libemfiberthreads.a \
	build/emfiberthreads-$(EMFT_VERSION)/libemfiberthreads.a \
	build/emfiberthreads-$(EMFT_VERSION)/Makefile
