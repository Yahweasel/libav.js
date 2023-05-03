LAME_VERSION=3.100

tmp-inst/%/lib/libmp3lame.a: lame-$(LAME_VERSION)/build-%/config.h
	cd lame-$(LAME_VERSION)/build-$* ; \
		$(MAKE) install

lame-$(LAME_VERSION)/build-%/config.h: tmp-inst/%/cflags.txt lame-$(LAME_VERSION)/configure
	mkdir -p lame-$(LAME_VERSION)/build-$*
	cd lame-$(LAME_VERSION)/build-$* ; \
		emconfigure ../configure --prefix="$(PWD)/tmp-inst/$*" \
			--host=mipsel-sysv --disable-shared CFLAGS="-Oz `cat $(PWD)/tmp-inst/$*/cflags.txt`"
	touch $@

extract: lame-$(LAME_VERSION)/configure

lame-$(LAME_VERSION)/configure: lame-$(LAME_VERSION).tar.gz
	tar zxf lame-$(LAME_VERSION).tar.gz
	touch $@

lame-$(LAME_VERSION).tar.gz:
	curl https://sourceforge.net/projects/lame/files/lame/$(LAME_VERSION)/lame-$(LAME_VERSION).tar.gz -L -o $@

lame-release:
	cp lame-$(LAME_VERSION).tar.gz libav.js-$(LIBAVJS_VERSION)/sources/

.PRECIOUS: \
	tmp-inst/%/lib/libmp3lame.a \
	lame-$(LAME_VERSION)/build-%/config.h \
	lame-$(LAME_VERSION)/configure
