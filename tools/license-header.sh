#!/bin/sh
# This is a very simple tool that gets the given license header and appends the
# emcc version for documentation
cat "$1"
emcc --version | head -n 1 | sed 's/^/ * /'
printf ' *\n */\n'
cat
