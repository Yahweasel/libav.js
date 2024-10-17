#!/bin/sh
# This is a very simple tool that gets the given license header and appends the
# emcc version for documentation
printf '/*!\n * libav.js %s\n' "$1"
cat "$2"
emcc --version | head -n 1 | sed 's/^/ * /'
printf ' *\n */\n'
cat
