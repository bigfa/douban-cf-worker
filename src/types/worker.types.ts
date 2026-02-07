export type Bindings = {
    DB: D1Database;
    DOUBAN_BUCKET: R2Bucket;
    FARALLON?: KVNamespace;
    DOMAIN: string;
    DBID: string | number;
    R2DOMAIN: string;
    WOKRERDOMAIN: string;
    PAGESIZE: number | string;
    TYPES: string;
    TOKEN: string;
    STATUSES: string;
};
