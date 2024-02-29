#!/bin/sh
# Copyright (C) 2023 Yahweasel and contributors
#
# Permission to use, copy, modify, and/or distribute this software for any
# purpose with or without fee is hereby granted.
#
# THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
# WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
# MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY
# SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
# WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION
# OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN
# CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

set -ex
cd "$(dirname "$0")/.."
VERSION="$(make print-version)"
make extract
make dist/libav-$VERSION-all.wasm.js -j9
cd configs
test -e configs/one-cli || ./mkconfigs.js --create-ones

cd configs
targets=dist/libav-$VERSION-empty.wasm.js
for i in empty one-*
do
    targets="$targets dist/libav-$VERSION-$i.wasm.js"
done

cd ../..
make $targets -j9 -k

cd configs/configs
for i in empty one-*
do
    printf '%s,' "$i"
    wc -c < ../../dist/libav-$VERSION-$i.wasm.wasm
done | sed 's/^one-//' > ../../docs/fragment-sizes.csv
