#!/usr/bin/env node
const fs = require("fs");
const la = require(process.argv[2]);
const inp = fs.readFileSync(process.argv[3], "utf8");
process.stdout.write(inp.replace(/@EXPORTS/, Object.keys(la).join(",")));
