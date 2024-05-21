import { Bindings, DoubanObject } from "../models";
import { dbRequest } from "../utils/request";

const sync = async (bindings: Bindings) => {
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

    const types: string = TYPES;
    const typeList = types.split(",");
    const status: string = STATUSES;
    const statusList = status.split(",");
    console.log(typeList);
    for (let type of typeList) {
        for (let status of statusList) {
            let confition = true,
                i = 0;
            while (confition) {
                console.log(type);
                console.log(type);
                const res: any = await dbRequest(
                    `https://frodo.douban.com/api/v2/user/${DBID}/interests`,
                    {
                        count: 50,
                        start: 50 * i,
                        type,
                    }
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
                                        "UPDATE douban_objects SET status = ? WHERE subject_id = ? AND type = ?"
                                    )
                                        .bind(
                                            interet.status,
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

export default sync;
