#!/bin/bash
set -ex
cd "$(dirname "$0")/.."
VERSION="$(make print-version)"
make extract
make dist/libav-$VERSION-all.wasm.js -j9
cd configs
test -e one-cli || ./mkconfigs.js --create-ones

targets=dist/libav-$VERSION-empty.wasm.js
for i in empty one-*
do
    targets="$targets dist/libav-$VERSION-$i.wasm.js"
done

cd ..
make $targets -j9 -k

cd configs
for i in empty one-*
do
    printf '%s,' "$i"
    wc -c < ../dist/libav-$VERSION-$i.wasm.wasm
done | sed 's/^one-//' > ../tests/fragment-sizes.csv
