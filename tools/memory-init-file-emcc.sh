#!/bin/sh
EMCC_VERSION="$(emcc --version | head -n 1 | sed 's/^emcc ([^)]*) \([0-9\.]*\).*/\1/')"
MAJOR="$(echo "$EMCC_VERSION" | sed 's/^\([0-9]*\)\.\([0-9]*\)\.\([0-9]*\).*/\1/')"
MINOR="$(echo "$EMCC_VERSION" | sed 's/^\([0-9]*\)\.\([0-9]*\)\.\([0-9]*\).*/\2/')"
REV="$(echo "$EMCC_VERSION" | sed 's/^\([0-9]*\)\.\([0-9]*\)\.\([0-9]*\).*/\3/')"

# 3.1.55 removed --memory-init-file, but on earlier versions, we *must* use
# --memory-init-file 0

MIF=" --memory-init-file 0"
if [ "$MAJOR" != 3 ]
then
    MIF=""
elif [ "$MINOR" -gt 1 ]
then
    MIF=""
elif [ "$REV" -gt 54 ]
then
    MIF=""
fi

printf '%s\n' "$MIF"
