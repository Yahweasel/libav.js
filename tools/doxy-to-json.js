#!/usr/bin/env node
/*
 * Copyright (C) 2023 Yahweasel and contributors
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY
 * SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION
 * OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN
 * CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */

const {XMLParser} = require("fast-xml-parser");

const fs = require("fs/promises");

const ffmpegVersion = process.argv[2];

async function main() {
    const parser = new XMLParser({ignoreAttributes: false});
    const dir = `build/ffmpeg-${ffmpegVersion}/build-base-default/doc/doxy/xml`;
    const types = {};
    for (const file of await fs.readdir(dir)) {
        if (!/^.*h\.xml$/.test(file))
            continue;

        // Import the XML data
        const xmlData = await fs.readFile(`${dir}/${file}`);
        const xml = parser.parse(xmlData);
        if (!xml.doxygen)
            continue;
        const compound = xml.doxygen.compounddef;
        if (!compound)
            continue;

        // Get the sections
        let sections = compound.sectiondef;
        if (!sections)
            continue;
        if (!(sections instanceof Array))
            sections = [sections];

        for (const section of sections) {
            // Get the members declared in this section
            let members = section.memberdef;
            if (!members)
                continue;
            if (!(members instanceof Array))
                members = [members];

            for (const member of members) {
                if (member.name && member.type) {
                    if (types[member.name]) {
                        console.error(
                            `WARNING: Duplicate definition of ${member.name}`);
                    }
                    types[member.name] = member;

                    // Try to extract the raw documentation
                    if (member.location) {
                        try {
                            const file = await fs.readFile(
                                `build/ffmpeg-${ffmpegVersion}/${member.location["@_file"]}`,
                                "utf8");
                            const lines = file.split("\n");
                            let startLine = +member.location["@_line"] - 1;

                            // Find the start line
                            for (; startLine >= 0; startLine--) {
                                if (/\/\*/.test(lines[startLine]))
                                    break;
                            }

                            // Find the end line
                            let endLine = startLine;
                            for (; endLine < lines.length; endLine++) {
                                if (/\*\//.test(lines[endLine]))
                                    break;
                            }

                            // And combine those into the raw comment
                            member.raw = lines.slice(startLine, endLine + 1).join("\n");
                        } catch (ex) {
                            console.error(ex);
                        }
                    }
                }
            }
        }
    }

    await fs.writeFile("mk/doxygen.json", JSON.stringify(types, null, 1));
}

main();
