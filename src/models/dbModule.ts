export type Bindings = {
    // Add your bindings here
    DB: D1Database;
    DOUBAN_BUCKET: R2Bucket;
    FARALLON: KVNamespace;
    DOMAIN: string;
    DBID: string;
    R2DOMAIN: string;
    WOKRERDOMAIN: string;
    PAGESIZE: number;
    TYPES: string;
    TOKEN: string;
    STATUSES: string;
};

export interface DoubanObject {
    subject_id: string;
    name: string;
    card_subtitle: string;
    create_time: number;
    douban_score: string;
    link: string;
    type: string;
    poster: string;
    pubdate: string;
    year: string;
    status: string;
}
