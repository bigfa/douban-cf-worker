import { dbRequest } from "../utils";

export const fetchDoubanObject = async <T>(type: string, id: T) => {
    return await dbRequest(`https://frodo.douban.com/api/v2/${type}/${id}`);
};

export const fetchDoubanObjects = async <T>(
    DBID: T,
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
