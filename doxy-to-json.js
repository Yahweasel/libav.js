#!/usr/bin/env node
const {XMLParser} = require("fast-xml-parser");

const fs = require("fs/promises");

const ffmpegVersion = process.argv[2];

async function main() {
    const parser = new XMLParser();
    const dir = `build/ffmpeg-${ffmpegVersion}/build-base-default/doc/doxy/xml`;
    const types = {};
    for (const file of await fs.readdir(dir)) {
        if (!/^.*h\.xml$/.test(file))
            continue;

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
                }
            }
        }
    }

    await fs.writeFile("mk/doxygen.json", JSON.stringify(types));
}

main();
