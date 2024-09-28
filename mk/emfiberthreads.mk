EMFT_VERSION=1.0

build/inst/%/lib/libemfiberthreads.a: build/emfiberthreads-$(EMFT_VERSION)/libemfiberthreads.a
	cd build/emfiberthreads-$(EMFT_VERSION) && \
		$(MAKE) install PREFIX="$(PWD)/build/inst/$*"

build/emfiberthreads-$(EMFT_VERSION)/libemfiberthreads.a: build/emfiberthreads-$(EMFT_VERSION)/Makefile
	cd build/emfiberthreads-$(EMFT_VERSION) && $(MAKE) STACK_SIZE=1048576

extract: build/emfiberthreads-$(EMFT_VERSION)/Makefile

build/emfiberthreads-$(EMFT_VERSION)/Makefile: build/emfiberthreads-$(EMFT_VERSION).tar.gz
	cd build && tar zxf emfiberthreads-$(EMFT_VERSION).tar.gz
	touch $@

build/emfiberthreads-$(EMFT_VERSION).tar.gz:
	mkdir -p build
	curl https://github.com/Yahweasel/emfiberthreads/archive/refs/tags/v$(EMFT_VERSION).tar.gz -L -o $@

emfiberthreads-release:
	cp build/emfiberthreads-$(EMFT_VERSION).tar.gz dist/release/libav.js-$(LIBAVJS_VERSION)/sources/

.PRECIOUS: \
	build/inst/%/lib/libemfiberthreads.a \
	build/emfiberthreads-$(EMFT_VERSION)/libemfiberthreads.a \
	build/emfiberthreads-$(EMFT_VERSION)/Makefile
