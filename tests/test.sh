#!/bin/sh
for t in test-*.js
do
    b=${t%.js}
    if [ -e correct/$b.txt.xz ]
    then
        printf '%s\n' "$t" >&2
        node $t > tmp.txt
        unxz -c correct/$b.txt.xz | diff -u tmp.txt -
        rm tmp.txt
    fi
done
