import { dbRequest } from "../utils";
import { Bindings } from "../models";

export const fetchDoubanObject = async (type: string, id: string) => {
    return await dbRequest(`https://frodo.douban.com/api/v2/${type}/${id}`);
};

export const fetchDoubanObjects = async (
    DBID: string,
    type: string,
    status: string,
    paged: number
) => {
    return await dbRequest(
        `https://frodo.douban.com/api/v2/user/${DBID}/interests`,
        {
            count: 50,
            start: 50 * paged,
            type,
            status,
        }
    );
};
