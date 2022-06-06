import { ethers } from "ethers";
import { samples } from "./sample";

let sampleAccount = samples[0].account;

// ----------- Utils -----------
export const useSample = (id: number): Note[] => {
    if (id >= samples.length) id = samples.length - 1;
    sampleAccount = samples[id].account;
    return samples[id].response.list;
};

export const isInTransfer = (note: Note) => {
    return note.metadata.to === sampleAccount;
};

export const isOutTransfer = (note: Note) => {
    return note.metadata.from === sampleAccount;
};

const EthereumSources = [
    "Ethereum ETH",
    "Ethereum NFT",
    "Ethereum ERC20",
    "Gitcoin Contribution",
];

export const isMirrorSource = (note: Note) => {
    return note.source === "Mirror Entry";
};

export const isEthereumSource = (note: Note) => {
    return (
        EthereumSources.includes(note.source) && !note.tags?.includes("POAP")
    ); // PAOP is a special case, just a hack here
};

export const getTransfersBySource = (action: Action, source: string) => {
    const notes = [];
    for (const note of action) {
        if (note.source === source) {
            notes.push(note);
        }
    }
    return notes;
};

export const getNftTransfers = (action: Action) => {
    return getTransfersBySource(action, "Ethereum NFT");
};

export const getErc20Transfers = (action: Action) => {
    return getTransfersBySource(action, "Ethereum ERC20");
};

export const getDonationTransfers = (action: Action) => {
    return getTransfersBySource(action, "Gitcoin Contribution");
};

export const getEthTx = (action: Action) => {
    // one has can only has one eth tx
    for (const note of action) {
        if (note.source === "Ethereum ETH") return note;
    }
};
export const formatToken = (note: Note) => {
    return (
        ethers.utils.formatUnits(
            note.metadata.amount || 0,
            note.metadata.decimal
        ) +
        " " +
        note.metadata.token_symbol
    );
};

export const formatTokens = (notes: Note[]) => {
    let res = "";
    notes.map((note) => {
        res += formatToken(note) + ", ";
    });
    return res;
};

export const formatNftNote = (
    note: Note,
    from: boolean = false,
    to: boolean = false
) => {
    let res =
        note.metadata.collection_name +
        ":" +
        note.metadata.collection_address +
        "-" +
        note.metadata.token_id;
    if (from) res += " from " + note.metadata.from;
    if (to) res += " to " + note.metadata.to;
    return res;
};

export const formatNftNotes = (
    notes: Note[],
    from: boolean = false,
    to: boolean = false
) => {
    let res = "";
    if (notes.length == 1) {
        return formatNftNote(notes[0], from);
    }
    notes.map((note) => {
        res += formatNftNote(note, from) + ", ";
    });
    return res;
};

export const getInOutTransfers = (erc20Transfers: Note[]) => {
    const sendTokenNotes = [];
    const receiveTokenNotes = [];
    for (const transfer of erc20Transfers) {
        if (isOutTransfer(transfer)) {
            sendTokenNotes.push(transfer);
        } else if (isInTransfer(transfer)) {
            receiveTokenNotes.push(transfer);
        } else {
            console.log("unexpected");
        }
    }
    return { sendTokenNotes, receiveTokenNotes };
};

export const getNftActionType = (
    paid: boolean,
    bulk: boolean,
    basicAction: string
): ActionType => {
    if (basicAction === "burn") {
        if (bulk) return "bulk burn nft";
        else return "burn nft";
    } else if (basicAction === "send") {
        if (bulk) return "bulk send nft";
        else return "send nft";
    } else if (basicAction === "get") {
        if (paid) {
            if (bulk) {
                return "bulk buy nft";
            } else {
                return "buy nft";
            }
        } else {
            if (bulk) {
                return "bulk get nft";
            } else {
                return "get nft";
            }
        }
    } else if (basicAction === "mint") {
        if (paid) {
            if (bulk) {
                return "pay to bulk mint nft";
            } else {
                return "pay to mint nft";
            }
        } else {
            if (bulk) {
                return "bulk mint nft";
            } else {
                return "mint nft";
            }
        }
    } else {
        return "unknown";
    }
};
