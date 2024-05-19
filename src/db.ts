import { Hono } from "hono";
import { cors } from "hono/cors";
import { bearerAuth } from "hono/bearer-auth";
import { DoubanObject, Bindings } from "./type";

const db = new Hono<{ Bindings: Bindings }>();

db.get(
    "/init",
    bearerAuth({
        verifyToken: async (token, c) => {
            return token === c.env.TOKEN;
        },
    }),
    async (c) => {
        const paged: number = parseInt(c.req.query("paged") || "0");
        const type: string = c.req.query("type") || "movie";
        console.log(paged);

        const res: any = await fetch(
            `https://m.douban.com/rexxar/api/v2/user/${
                c.env.DBID
            }/interests?count=50&start=${50 * paged}&type=${type}`,
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
            return c.text("No more data");
        } else {
            for (let interet of interets) {
                try {
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

                    await c.env.DB.prepare(
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

                    // } else {
                    //     confition = false;
                    // }
                } catch (e) {
                    console.log(e);
                    return c.json({ err: e }, 500);
                }
            }
        }

        return c.text("Synced");
    }
);

db.get(
    "/list",
    cors({
        origin: "*",
    }),
    async (c) => {
        const type: string = c.req.query("type") || "movie";
        const paged: number = parseInt(c.req.query("paged") || "1");
        const objects = await c.env.DB.prepare(
            "SELECT * FROM douban_objects WHERE type = ? ORDER BY create_time DESC LIMIT ? OFFSET ? "
        )
            .bind(type, c.env.PAGESIZE, (paged - 1) * c.env.PAGESIZE)
            .all<DoubanObject>();

        console.log(objects.results);

        const results = Array.isArray(objects.results)
            ? objects.results.map((movie: DoubanObject) => {
                  movie.poster = movie.poster
                      ? `${c.env.R2DOMAIN}/${type}/${movie.subject_id}.jpg`
                      : `${c.env.WOKRERDOMAIN}/${type}/${movie.subject_id}.jpg`;
                  return movie;
              })
            : [];

        return c.json({ results });
    }
);

db.get("/:type/:id{.+\\.jpg$}", async (c) => {
    // get url from query
    const type = c.req.param("type");
    const typeList = ["movie", "book", "music", "drama", "game"];
    if (!typeList.includes(type)) {
        return c.text("Type not found");
    }
    // remove .jpg
    const id = c.req.param("id").replace(".jpg", "");

    if (!id) {
        return c.text("ID not found");
    }

    const key = type + "/" + id + ".jpg";
    const object: any = await c.env.DOUBAN_BUCKET.get(key);
    // if object is null or size < 50b, fetch from douban
    if (object === null || object.size < 50) {
        const d: any = await fetch(
            `https://frodo.douban.com/api/v2/${type}/${id}?apiKey=0ac44ae016490db2204ce0a042db2916`,
            {
                headers: {
                    Referer:
                        "https://servicewechat.com/wx2f9b06c1de1ccfca/84/page-frame.html",
                    "user-agent":
                        "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 15_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.16(0x18001023) NetType/WIFI Language/zh_CN",
                },
            }
        );

        const data = await d.json();
        console.log(data);
        const poster = data.pic.large;

        // download douban image and upload to bucket
        const headers = {
            Referer: "https://m.douban.com/",
            "User-Agent":
                "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1",
        };
        const res = await fetch(poster, { headers });

        // check if error code: 522
        if (res.status === 522) {
            return c.text("Error 522");
        }

        const dbobject = await c.env.DB.prepare(
            "SELECT * FROM douban_objects WHERE subject_id = ? AND type = ?"
        )
            .bind(id, type)
            .first();

        if (dbobject === null) {
            return c.text("Not found");
        }

        // update poster to db

        await c.env.DB.prepare(
            "UPDATE douban_objects SET poster = ? WHERE subject_id = ? AND type = ?"
        )
            .bind(key, id, type)
            .run();

        const buffer = await res.arrayBuffer();
        await c.env.DOUBAN_BUCKET.put(key, buffer);
        const obj: any = await c.env.DOUBAN_BUCKET.get(key);
        const objheaders = new Headers();
        obj.writeHttpMetadata(objheaders);
        objheaders.set("etag", obj.httpEtag);

        return new Response(obj.body, {
            headers,
        });
    } else {
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("etag", object.httpEtag);

        return new Response(object.body, {
            headers,
        });
    }
});

// fetch single item
db.get("/:type/:id", async (c) => {
    console.log(c.req.param("type"));

    const type = c.req.param("type");
    const id = c.req.param("id");

    let object = await c.env.DB.prepare(
        "SELECT * FROM douban_objects WHERE type = ? AND subject_id = ?"
    )
        .bind(type, id)
        .first<DoubanObject>();

    console.log(object);

    if (object === null) {
        const d: any = await fetch(
            `https://frodo.douban.com/api/v2/${type}/${id}?apiKey=0ac44ae016490db2204ce0a042db2916&ck=xgtY&for_mobile=1`,
            {
                headers: {
                    Referer:
                        "https://servicewechat.com/wx2f9b06c1de1ccfca/84/page-frame.html",
                    "user-agent":
                        "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 15_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.16(0x18001023) NetType/WIFI Language/zh_CN",
                },
            }
        );

        const data = await d.json();
        console.log(data);

        await c.env.DB.prepare(
            "INSERT INTO douban_objects (subject_id, name , card_subtitle, douban_score,link,type) VALUES (?, ?, ?, ?, ?, ?)"
        )
            .bind(
                data.id,
                data.title,
                data.card_subtitle,
                data.rating.value,
                data.url,
                type
            )
            .run();

        object = await c.env.DB.prepare(
            "SELECT * FROM douban_objects WHERE type = ? AND subject_id = ?"
        )
            .bind(type, id)
            .first<DoubanObject>();

        if (object === null) {
            return c.text("Not found");
        }

        object.poster = `${c.env.WOKRERDOMAIN}/db/${type}/${id}.jpg`;

        return c.json(object);
    } else {
        if (!object.poster) {
            object.poster = `${c.env.WOKRERDOMAIN}/db/${type}/${id}.jpg`;
        } else {
            object.poster = `${c.env.R2DOMAIN}/${object.poster}`;
        }

        return c.json(object);
    }
});

export default db;
