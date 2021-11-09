#!/bin/sh
for t in test-*.js
do
    b=${t%.js}
    if [ -e correct/$b.txt ]
    then
        printf '%s\n' "$t" >&2
        node $t > tmp.txt 2> /dev/null
        diff -u tmp.txt correct/$b.txt
        rm tmp.txt

    else
        node $t > correct/$b.txt 2> /dev/null

    fi
done
