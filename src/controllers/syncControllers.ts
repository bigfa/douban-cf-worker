import { fetchDoubanObjects } from "../api";
import { DoubanObject } from "../models";
import { Bindings, ObjectStatus, ObjectTypes } from "../types";

type DoubanSubject = {
    id: string;
    title: string;
    card_subtitle: string;
    rating: {
        value: string;
    };
    url: string;
    pubdate?: string[];
    year?: string;
};

type DoubanInterest = {
    subject: DoubanSubject;
    create_time: string;
    status: ObjectStatus;
};

type DoubanInterestResponse = {
    interests: DoubanInterest[];
};

const SELECT_OBJECT_BY_SUBJECT_AND_TYPE =
    "SELECT * FROM douban_objects WHERE subject_id = ? AND type = ?";
const INSERT_OBJECT =
    "INSERT INTO douban_objects (subject_id, name , card_subtitle, create_time, douban_score,link,type,status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
const UPDATE_OBJECT_STATUS =
    "UPDATE douban_objects SET status = ?, create_time = ? WHERE subject_id = ? AND type = ?";

const shouldSkipSubject = (title: string): boolean => {
    return title === "未知电视剧" || title === "未知电影";
};

const toObjectTypes = (types: string): ObjectTypes[] => {
    return types.split(",").map((type) => type as ObjectTypes);
};

const toObjectStatuses = (statuses: string): ObjectStatus[] => {
    return statuses.split(",").map((status) => status as ObjectStatus);
};

export const sync = async (
    bindings: Bindings
): Promise<string | { err: unknown }> => {
    const { DB, DBID, TYPES, STATUSES } = bindings;

    const typeList = toObjectTypes(TYPES);
    const statusList = toObjectStatuses(STATUSES);

    for (const type of typeList) {
        for (const status of statusList) {
            let shouldContinue = true;
            let page = 0;

            while (shouldContinue) {
                const res = await fetchDoubanObjects(DBID, type, status, page);
                const data = (await res.json()) as DoubanInterestResponse;
                const interets = data.interests;

                if (interets.length === 0) {
                    shouldContinue = false;
                    console.log("No more data");
                } else {
                    for (const interet of interets) {
                        try {
                            const dbobject = await DB.prepare(
                                SELECT_OBJECT_BY_SUBJECT_AND_TYPE
                            )
                                .bind(interet.subject.id, type)
                                .first<DoubanObject>();

                            if (!dbobject) {
                                console.log(
                                    interet.subject.id,
                                    interet.subject.title,
                                    interet.subject.card_subtitle,
                                    interet.create_time,
                                    interet.subject.rating.value,
                                    interet.subject.url,
                                    interet.subject.pubdate
                                        ? interet.subject.pubdate[0]
                                        : "",
                                    interet.subject.year,
                                    type,
                                    interet.status
                                );

                                if (shouldSkipSubject(interet.subject.title)) {
                                    continue;
                                }

                                await DB.prepare(INSERT_OBJECT)
                                    .bind(
                                        interet.subject.id,
                                        interet.subject.title,
                                        interet.subject.card_subtitle,
                                        interet.create_time,
                                        interet.subject.rating.value,
                                        interet.subject.url,
                                        type,
                                        interet.status
                                    )
                                    .run();
                            } else if (dbobject.status !== interet.status) {
                                await DB.prepare(UPDATE_OBJECT_STATUS)
                                    .bind(
                                        interet.status,
                                        interet.create_time,
                                        interet.subject.id,
                                        type
                                    )
                                    .run();
                            } else {
                                console.log("no new data");
                                shouldContinue = false;
                                break;
                            }
                        } catch (err) {
                            console.log(err);
                            return { err };
                        }
                    }

                    page++;
                }
            }
        }
    }

    return "Synced";
};
