import { dbRequest } from "../utils";
import { ObjectTypes, ObjectStatus } from "../types";

export const fetchDoubanObject = async <T>(type: ObjectTypes, id: T) => {
    return await dbRequest(`https://frodo.douban.com/api/v2/${type}/${id}`);
};

export const fetchDoubanObjects = async <T>(
    DBID: T,
    type: ObjectTypes,
    status: ObjectStatus,
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
