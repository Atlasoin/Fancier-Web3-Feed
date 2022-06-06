interface Note {
    identifier: string;
    tags?: string[];
    source: string;
    title?: string;
    related_urls?: string[];
    attachments?: {
        type: string;
        content?: string;
    }[];
    metadata: {
        from?: string;
        to?: string;
        amount?: string;
        decimal?: number;
        token_id?: string;
        token_symbol?: string;
        collection_name?: string;
        collection_address?: string;
        proof?: string;
    };
}

type Action = Note[];

type ActionType =
    | "unknown"
    | "post article"
    | "revise article"
    | "claim poap"
    | "buy nft"
    | "bulk buy nft"
    | "pay to mint nft"
    | "pay to bulk mint nft"
    | "mint nft"
    | "bulk mint nft"
    | "get nft"
    | "bulk get nft"
    | "send nft"
    | "bulk send nft"
    | "burn nft"
    | "bulk burn nft"
    | "donate"
    | "bulk donate"
    | "swap"
    | "send"
    | "bulk send"
    | "receive"
    | "bulk receive";

type MapFromString2Notes = { [h: string]: Note[] };
interface FeedItem {
    actionType: ActionType;
    summary: string;
}
type MapFromString2Feeds = { [h: string]: FeedItem };
