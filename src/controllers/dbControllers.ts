import { Context } from "hono";
import { DoubanObject } from "../models";
import { dbRequest } from "../utils";

export const getObjects = async (c: Context) => {
    const type: string = c.req.query("type") || "movie";
    const paged: number = parseInt(c.req.query("paged") || "1");
    const status: string = c.req.query("status") || "done";
    console.log(status);
    //@ts-ignore
    const objects = await c.env.DB.prepare(
        "SELECT * FROM douban_objects WHERE type = ? AND status = ? ORDER BY create_time DESC LIMIT ? OFFSET ? "
    )
        .bind(type, status, c.env.PAGESIZE, (paged - 1) * c.env.PAGESIZE)
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
};

export const initDB = async (c: Context) => {
    const paged: number = parseInt(c.req.query("paged") || "0");
    const type: string = c.req.query("type") || "movie";
    const status: string = c.req.query("status") || "done";
    console.log(paged);

    const res: any = await dbRequest(
        `https://frodo.douban.com/api/v2/user/${c.env.DBID}/interests`,
        {
            count: 50,
            start: 50 * paged,
            type,
        }
    );
    let data: any = await res.json();
    const interets = data.interests;
    console.log(type, status, interets.length, paged);
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
                    interet.subject.pubdate ? interet.subject.pubdate[0] : "",
                    interet.subject.year,
                    type
                );
                // 过滤无法显示的内容
                if (
                    interet.subject.title == "未知电视剧" ||
                    interet.subject.title == "未知电影"
                )
                    continue;

                await c.env.DB.prepare(
                    "INSERT INTO douban_objects (subject_id, name , card_subtitle, create_time, douban_score,link,type ,status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
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
            } catch (e) {
                console.log(e);
                return c.json({ err: e }, 500);
            }
        }
    }

    return c.text("Synced");
};

export const fetchDBPoster = async (c: Context) => {
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
        const d: any = await dbRequest(
            `https://frodo.douban.com/api/v2/${type}/${id}`
        );

        const data = await d.json();
        console.log(data);
        const poster = data.pic.large;

        // download douban image and upload to bucket
        const res = await dbRequest(poster);

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
            headers: objheaders,
        });
    } else {
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("etag", object.httpEtag);

        return new Response(object.body, {
            headers,
        });
    }
};

export const fetchDBObject = async (c: Context) => {
    console.log(c.req.param("type"));

    const type = c.req.param("type");
    const id = c.req.param("id");
    // @ts-ignore
    let object = await c.env.DB.prepare(
        "SELECT * FROM douban_objects WHERE type = ? AND subject_id = ?"
    )
        .bind(type, id)
        .first<DoubanObject>();

    console.log(object);

    if (object === null) {
        const d: any = await dbRequest(
            `https://frodo.douban.com/api/v2/${type}/${id}`
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
        // @ts-ignore
        object = await c.env.DB.prepare(
            "SELECT * FROM douban_objects WHERE type = ? AND subject_id = ?"
        )
            .bind(type, id)
            .first<DoubanObject>();

        if (object === null) {
            return c.text("Not found");
        }

        object.poster = `${c.env.WOKRERDOMAIN}/${type}/${id}.jpg`;

        return c.json(object);
    } else {
        if (!object.poster) {
            object.poster = `${c.env.WOKRERDOMAIN}/${type}/${id}.jpg`;
        } else {
            object.poster = `${c.env.R2DOMAIN}/${object.poster}`;
        }
        return c.json(object);
    }
};
