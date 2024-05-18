import { Bindings, DoubanObject } from "./type";

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
    } = bindings;

    const types: string = "music";
    const typeList = types.split(",");
    console.log(typeList);
    for (let type of typeList) {
        let confition = true,
            i = 0;
        while (confition) {
            console.log(type);
            const res: any = await fetch(
                `https://m.douban.com/rexxar/api/v2/user/${DBID}/interests?count=50&start=${
                    50 * i
                }&type=${type}`,
                {
                    headers: {
                        Referer: "https://m.douban.com/",
                        "User-Agent":
                            "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1",
                    },
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
                                type
                            );
                            if (
                                interet.subject.title == "未知电视剧" ||
                                interet.subject.title == "未知电影"
                            )
                                continue;

                            await DB.prepare(
                                "INSERT INTO douban_objects (subject_id, name , card_subtitle, create_time, douban_score,link,type) VALUES (?, ?, ?, ?, ?, ?, ?)"
                            )
                                .bind(
                                    interet.subject.id,
                                    interet.subject.title,
                                    interet.subject.card_subtitle,
                                    interet.create_time,
                                    interet.subject.rating.value,
                                    interet.subject.url,
                                    type
                                )
                                .run();
                        } else {
                            console.log("no new data");
                            confition = false;
                            break;
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

    return "Synced";
};

export default sync;