/* Test that the CLI is working, from a high level. Actually, since we used the
 * CLI to do all our initial conversion, just checks all the files that
 * 002-formats made. */
for (const file of h.files) {
    if (/^bbb/.test(file))
        await h.utils.compareAudio("bbb.mp4", file.name);
}
