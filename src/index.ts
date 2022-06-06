import { ethers } from "ethers";
import {
    getEthTx,
    getNftTransfers,
    getErc20Transfers,
    getDonationTransfers,
    getInOutTransfers,
    isInTransfer,
    formatTokens,
    isOutTransfer,
    formatToken,
    isEthereumSource,
    useSample,
    isMirrorSource,
    formatNftNotes,
    getNftActionType,
} from "./utils";

const sampleRes = useSample(0);

const actionHashes: string[] = []; // actions are sorted as tsp des order in this array
const id2Feeds: MapFromString2Feeds = {}; // final feed object

const feedFromPoapNote = (note: Note): FeedItem | null => {
    if (note.tags?.includes("POAP")) {
        return {
            actionType: "claim poap",
            summary: "claim poap " + note.title,
        };
    } else {
        console.log("unexpected");
        return null;
    }
};

const tagNftNotes = (notes: Note[]) => {
    const mintNftNotes: Note[] = [];
    const getNftNotes: Note[] = [];
    const burnNftNotes: Note[] = [];
    const sendNftNotes: Note[] = [];
    for (const note of notes) {
        if (isInTransfer(note)) {
            if (note.metadata.from === ethers.constants.AddressZero) {
                mintNftNotes.push(note);
            } else {
                getNftNotes.push(note);
            }
        } else if (isOutTransfer(note)) {
            if (note.metadata.to === ethers.constants.AddressZero) {
                burnNftNotes.push(note);
            } else {
                sendNftNotes.push(note);
            }
        } else {
            console.log("unexpected");
        }
    }
    return { mintNftNotes, getNftNotes, burnNftNotes, sendNftNotes };
};

const feedFromEthereumAction = (action: Action): FeedItem => {
    let actionType: ActionType = "unknown";
    let summary: string = "";

    const ethTx = getEthTx(action)!;
    const nftTransfers = getNftTransfers(action);
    const erc20Transfers = getErc20Transfers(action);
    const donationTransfers = getDonationTransfers(action);
    const payETH = ethers.BigNumber.from(ethTx.metadata.amount).gt(0);

    const { sendTokenNotes, receiveTokenNotes } =
        getInOutTransfers(erc20Transfers);
    if (payETH) {
        sendTokenNotes.push(ethTx);
    }

    if (nftTransfers.length > 0) {
        const { mintNftNotes, getNftNotes, burnNftNotes, sendNftNotes } =
            tagNftNotes(nftTransfers);

        const paid = sendTokenNotes.length > 0;
        let paymentDesc = "";
        if (paid) {
            paymentDesc = " with " + formatTokens(sendTokenNotes);
        }
        // TODO: currently we only assume there's one type of nft action in one feed item
        // and if that's an compound activity, we just pick the first one we interpreted.
        if (mintNftNotes.length > 0) {
            actionType = getNftActionType(
                paid,
                mintNftNotes.length > 1,
                "mint"
            );
            summary = "mint nft " + formatNftNotes(mintNftNotes) + paymentDesc;
        } else if (getNftNotes.length > 0) {
            actionType = getNftActionType(paid, getNftNotes.length > 1, "get");
            if (paid) {
                summary =
                    "buy nft " +
                    formatNftNotes(getNftNotes, true) +
                    paymentDesc;
            } else {
                summary = "get nft " + formatNftNotes(getNftNotes, true);
            }
        } else if (burnNftNotes.length > 0) {
            actionType = getNftActionType(
                paid,
                burnNftNotes.length > 1,
                "burn"
            );
            summary = "burn nft " + formatNftNotes(burnNftNotes);
        } else if (sendNftNotes.length > 0) {
            actionType = getNftActionType(
                paid,
                sendNftNotes.length > 1,
                "send"
            );
            summary = "send nft " + formatNftNotes(burnNftNotes, false, true);
        }
        return { actionType, summary };
    } else if (donationTransfers.length > 0) {
        if (donationTransfers.length == 1) {
            actionType = "donate";
            summary =
                "donate to " +
                donationTransfers[0].attachments?.find(
                    (att) => att.type == "title"
                )?.content;
        } else {
            actionType = "bulk donate";
            summary = "bulk donate to ";
            for (const note of donationTransfers) {
                summary += note.attachments?.find(
                    (att) => att.type == "title"
                )?.content;
                summary += "\n";
            }
        }
        return { actionType, summary };
    } else if (erc20Transfers.length > 0) {
        if (erc20Transfers.length === 1 && !payETH) {
            const note = erc20Transfers[0];
            if (isInTransfer(note)) {
                actionType = "receive";
                summary =
                    "receive " +
                    formatToken(note) +
                    " from " +
                    note.metadata.from;
            } else if (isOutTransfer(note)) {
                actionType = "send";
                summary =
                    "send " + formatToken(note) + " to " + note.metadata.to;
            } else {
                console.log("unexpected");
            }
        } else {
            // (erc20Transfers.length == 1 && payETH) || erc20Transfers.length > 1
            if (receiveTokenNotes.length == 0) {
                summary = "send ";
                if (sendTokenNotes.length > 1) actionType = "bulk send";
                else actionType = "send";
                for (const t of sendTokenNotes) {
                    summary += formatToken(t) + " to " + t.metadata.to + ", ";
                }
            } else if (sendTokenNotes.length == 0) {
                summary = "receive ";

                if (receiveTokenNotes.length > 1) actionType = "bulk receive";
                else actionType = "receive";

                for (const t of receiveTokenNotes) {
                    summary +=
                        formatToken(t) + " from " + t.metadata.from + ", ";
                }
            } else {
                actionType = "swap";
                summary =
                    "swap " +
                    formatTokens(sendTokenNotes) +
                    " for " +
                    formatTokens(receiveTokenNotes);
            }
        }
        return { actionType, summary };
    } else if (payETH) {
        if (isInTransfer(ethTx)) {
            actionType = "receive";
            summary =
                "receive " +
                formatToken(ethTx) +
                " from " +
                ethTx.metadata.from;
        } else if (isOutTransfer(ethTx)) {
            actionType = "send";
            summary = "send " + formatToken(ethTx) + " to " + ethTx.metadata.to;
        } else {
            console.log("unexpected");
        }
    } else {
        console.log("fail to interpret " + ethTx.metadata.proof);
    }
    return { actionType, summary };
};

// ----------- Aggregation -----------

console.log("1. There are " + sampleRes.length + " notes.");

const hash2notes: MapFromString2Notes = {}; // only for Ethereum source notes
const url2notes: MapFromString2Notes = {}; // only for Mirror Entry source notes

// 1. preprocess all notes by source
sampleRes.map((note) => {
    if (isEthereumSource(note)) {
        const hash = note.metadata.proof!.split("-")[0];
        if (!hash2notes[hash]) {
            hash2notes[hash] = [note];
            actionHashes.push(hash);
        } else {
            hash2notes[hash].push(note);
        }
    } else {
        actionHashes.push(note.identifier);
        if (isMirrorSource(note)) {
            const url = note.related_urls?.find((url) =>
                url.includes("mirror.xyz")
            );
            if (!url) return;
            if (!url2notes[url]) {
                url2notes[url] = [note];
            } else {
                url2notes[url].push(note);
            }
        } else {
            const f = feedFromPoapNote(note);
            if (f) {
                id2Feeds[note.identifier] = f;
            }
        }
    }
});

// 2.1 For Ethereum-related notes

// 1) exclude the action not containing an eth tx (passive action)
console.log(
    "2.1.1 After aggregating Ethereum-related notes by hash, there are " +
        actionHashes.length +
        " actions."
);
const filterActiveAction = (hash2notes: MapFromString2Notes) => {
    const hash2ActiveAction: MapFromString2Notes = {};
    for (const hash in hash2notes) {
        const notes = hash2notes[hash];
        let excluded = true;
        for (const note of notes) {
            if (note.source === "Ethereum ETH") {
                if (isOutTransfer(note)) {
                    excluded = false;
                }
            }
        }
        if (!excluded) hash2ActiveAction[hash] = notes;
    }
    return hash2ActiveAction;
};
const hash2ActiveAction = filterActiveAction(hash2notes);

// 2). iterate all active actions and recognize each action
console.log(
    "2.1.2 After excluding all passive actions, there are " +
        Object.keys(hash2ActiveAction).length +
        " active actions."
);

for (const hash in hash2ActiveAction) {
    const action = hash2ActiveAction[hash];
    if (!action) continue;
    const f = feedFromEthereumAction(action);
    if (f) {
        id2Feeds[hash] = f;
    }
}

// 2.2 For Mirror notes
console.log(
    "2.2 After aggregating all mirror articles by digest, " +
        Object.keys(url2notes).length +
        " unique urls."
);

for (const [url, notes] of Object.entries(url2notes)) {
    const l = notes.length;
    const { identifier, title } = notes[l - 1]; // Assume the earliest one is the posted one.
    id2Feeds[identifier] = {
        actionType: "post article",
        summary: "post mirror " + title + " " + url,
    };
    for (let i = 0; i < l - 1; i++) {
        const { identifier, title } = notes[i];
        id2Feeds[identifier] = {
            actionType: "revise article",
            summary: "revise mirror " + title + " " + url,
        };
    }
}

// 3. Print all
let count = 0;
for (const h of actionHashes) {
    if (id2Feeds[h] && id2Feeds[h].actionType !== "unknown") {
        count++;
        console.log(h, id2Feeds[h]);
    }
}
console.log("3. After processing all notes, there are " + count + " actions. ");
