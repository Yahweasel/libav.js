const libav = await h.LibAV();

try {
    await libav.avcodec_receive_frame(-1, -1);
    throw new Error("Forced crash test failed to crash!");
} catch (ex) {}
