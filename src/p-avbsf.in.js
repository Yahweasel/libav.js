/*
 * Copyright (C) 2019-2025 Yahweasel and contributors
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

/**
 * Bitstream-filter some number of packets.
 * @param bsf  AVBSFContext(s), input
 * @param pktPtr  AVPacket
 * @param inPackets  Input packets
 * @param config  Options. May be "true" to indicate end of stream.
 */
/* @types
 * ff_bsf_multi@sync(
 *     bsf: number, pktPtr: number, inPackets: (Packet | number)[],
 *     config?: boolean | {
 *         fin?: boolean,
 *         copyoutPacket?: "default"
 *     }
 * ): @promsync@Packet[]@
 * ff_bsf_multi@sync(
 *     bsf: number, pktPtr: number, inPackets: (Packet | number)[],
 *     config?: boolean | {
 *         fin?: boolean,
 *         copyoutPacket: "ptr"
 *     }
 * ): @promsync@number[]@
 */
var ff_bsf_multi = Module.ff_bsf_multi = function(bsf, pktPtr, inPackets, config) {
    var outPackets = [];
    var transfer = [];

    if (typeof config === "boolean") {
        config = {fin: config};
    } else if (typeof config === "undefined") {
        config = {};
    }

    // Choose a packet copier
    var copyoutPacket = ff_copyout_packet;
    if (config.copyoutPacket)
        copyoutPacket = ff_copyout_packet_versions[config.copyoutPacket];

    function handlePacket(inPacket) {
        var ret;
        if (inPacket !== null) {
            ff_copyin_packet(pktPtr, inPacket);
            ret = av_bsf_send_packet(bsf, pktPtr);
        } else {
            ret = av_bsf_flush(bsf);
        }
        if (ret < 0)
            throw new Error("Error while feeding bitstream filter: " + ff_error(ret));
        av_packet_unref(pktPtr);

        while (true) {
            ret = av_bsf_receive_packet(bsf, pktPtr);
            if (ret === -6 /* EAGAIN */ || ret === -0x20464f45 /* AVERROR_EOF */)
                break;
            if (ret < 0)
                throw new Error("Error while receiving a packet from the bitstream filter: " + ff_error(ret));

            var outPacket = copyoutPacket(pktPtr);

            if (outPacket && outPacket.libavjsTransfer && outPacket.libavjsTransfer.length)
                transfer.push.apply(transfer, outPacket.libavjsTransfer);
            outPackets.push(outPacket);
            av_packet_unref(pktPtr);
        }
    }

    // Handle each packet
    for (var pi = 0; pi < inPackets.length; pi++) {
        var inPacket = inPackets[pi];
        handlePacket(inPacket);
    }

    if (config.fin)
        handlePacket(null);

    outPackets.libavjsTransfer = transfer;
    return outPackets;
};
