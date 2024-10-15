#!/bin/sh
EMCC_VERSION="$(emcc --version | head -n 1 | sed 's/^emcc ([^)]*) \([0-9\.]*\).*/\1/')"
MAJOR="$(echo "$EMCC_VERSION" | sed 's/^\([0-9]*\)\.\([0-9]*\)\.\([0-9]*\).*/\1/')"
MINOR="$(echo "$EMCC_VERSION" | sed 's/^\([0-9]*\)\.\([0-9]*\)\.\([0-9]*\).*/\2/')"
REV="$(echo "$EMCC_VERSION" | sed 's/^\([0-9]*\)\.\([0-9]*\)\.\([0-9]*\).*/\3/')"

BAD=no
if [ "$MAJOR" = 3 -a "$MINOR" = 1 ]
then
    if [ "$REV" -gt 50 -a "$REV" -lt 65 ]
    then
        BAD=yes
    fi
fi

if [ "$BAD" = "yes" ]
then
    # libvpx with > 3.1.50 < 3.1.65 produces a working build, but nasty, broken
    # output.
    # Test 611 shows the issue.
    echo 'libvpx is known to compile incorrectly with emcc versions > 3.1.50 < 3.1.65. Please upgrade.'
    exit 1
fi

exit 0
