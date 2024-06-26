import { DoubanObject } from "../models";
import { fetchDoubanObjects } from "../api";
import { Bindings, ObjectTypes, ObjectStatus } from "../types";

export const sync = async (bindings: Bindings) => {
    const {
        DB,
        DOUBAN_BUCKET,
        FARALLON,
        DOMAIN,
        DBID,
        R2DOMAIN,
        WOKRERDOMAIN,
        PAGESIZE,
        TYPES,
        STATUSES,
    } = bindings;

    const typeList: Array<ObjectTypes> = TYPES.split(",").map(
        (status: string) => status as ObjectTypes
    );

    const statusList: Array<ObjectStatus> = STATUSES.split(",").map(
        (status: string) => status as ObjectStatus
    );

    for (let type of typeList) {
        for (let status of statusList) {
            let confition: boolean = true,
                i: number = 0;
            while (confition) {
                const res: any = await fetchDoubanObjects(
                    DBID,
                    type,
                    status,
                    i
                );
                let data: any = await res.json();
                const interets = data.interests;
                if (interets.length === 0) {
                    confition = false;
                    console.log("No more data");
                } else {
                    for (let interet of interets) {
                        try {
                            const dbobject = await DB.prepare(
                                "SELECT * FROM douban_objects WHERE subject_id = ? AND type = ?"
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
                                if (
                                    interet.subject.title == "未知电视剧" ||
                                    interet.subject.title == "未知电影"
                                )
                                    continue;

                                await DB.prepare(
                                    "INSERT INTO douban_objects (subject_id, name , card_subtitle, create_time, douban_score,link,type,status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
                                )
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
                            } else {
                                if (dbobject.status != interet.status) {
                                    await DB.prepare(
                                        "UPDATE douban_objects SET status = ?, create_time = ? WHERE subject_id = ? AND type = ?"
                                    )
                                        .bind(
                                            interet.status,
                                            interet.create_time,
                                            interet.subject.id,
                                            type
                                        )
                                        .run();
                                } else {
                                    console.log("no new data");
                                    confition = false;
                                    break;
                                }
                            }
                        } catch (e) {
                            console.log(e);
                            return { err: e };
                        }
                    }
                    i++;
                }
            }
        }
    }

    return "Synced";
};
