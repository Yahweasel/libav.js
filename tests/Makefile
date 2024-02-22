all: harness.js harness.mjs suite.json

harness.js: harness.in.js
	grep -v '^@E6' $< | sed 's/^@E5/   /' > $@

harness.mjs: harness.in.js
	grep -v '^@E5' $< | sed 's/^@E6/   /' > $@

suite.json: tests/*
	./mksuitejson.js > $@
