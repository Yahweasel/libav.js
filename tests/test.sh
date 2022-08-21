#!/bin/sh
for t in test-*.js
do
    b=${t%.js}
    if [ -e correct/$b.txt ]
    then
        printf '%s\n' "$t" >&2
        for target in asm wasm threads simd "threads simd"
        do
            node --experimental-wasm-threads $t $target > tmp.txt 2> /dev/null
            diff -u tmp.txt correct/$b.txt
            rm tmp.txt
        done

    else
        node $t > correct/$b.txt 2> /dev/null

    fi
done
