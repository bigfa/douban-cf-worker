import { Hono } from "hono";
import { cors } from "hono/cors";
import { bearerAuth } from "hono/bearer-auth";
import sync from "./sync";
import db from "./db";
import { DoubanObject, Bindings } from "./type";

const app = new Hono<{ Bindings: Bindings }>();

app.route("/", db);

// download poster to bucket
// app.get("/:type/:id{.+\\.jpg$}", async (c) => {
//     // get url from query
//     const type = c.req.param("type");
//     // remove .jpg
//     const id = c.req.param("id").replace(".jpg", "");
//     const key = type + "/" + id + ".jpg";
//     const object: any = await c.env.DOUBAN_BUCKET.get(key);
//     // if object is null or size < 50b, fetch from douban
//     if (object === null || object.size < 50) {
//         const d: any = await fetch(
//             `https://frodo.douban.com/api/v2/${type}/${id}?apiKey=0ac44ae016490db2204ce0a042db2916`,
//             {
//                 headers: {
//                     Referer:
//                         "https://servicewechat.com/wx2f9b06c1de1ccfca/84/page-frame.html",
//                     "user-agent":
//                         "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 15_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.16(0x18001023) NetType/WIFI Language/zh_CN",
//                 },
//             }
//         );

//         const data = await d.json();
//         console.log(data);
//         const poster = data.pic.large;

//         // download douban image and upload to bucket
//         const headers = {
//             Referer: "https://m.douban.com/",
//             "User-Agent":
//                 "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1",
//         };
//         const res = await fetch(poster, { headers });

//         // check if error code: 522
//         if (res.status === 522) {
//             return c.text("Error 522");
//         }

//         const dbobject = await c.env.DB.prepare(
//             "SELECT * FROM douban_objects WHERE subject_id = ? AND type = ?"
//         )
//             .bind(id, type)
//             .first<DoubanObject>();

//         if (dbobject === null) {
//             return c.text("Not found");
//         }

//         // update poster to db

//         await c.env.DB.prepare(
//             "UPDATE douban_objects SET poster = ? WHERE subject_id = ? AND type = ?"
//         )
//             .bind(key, id, type)
//             .run();

//         const buffer = await res.arrayBuffer();
//         await c.env.DOUBAN_BUCKET.put(key, buffer);
//         const obj: any = await c.env.DOUBAN_BUCKET.get(key);
//         const objheaders = new Headers();
//         obj.writeHttpMetadata(objheaders);
//         objheaders.set("etag", obj.httpEtag);

//         return new Response(obj.body, {
//             headers,
//         });
//     } else {
//         const headers = new Headers();
//         object.writeHttpMetadata(headers);
//         headers.set("etag", object.httpEtag);

//         return new Response(object.body, {
//             headers,
//         });
//     }
// });

export default {
    async scheduled(
        event: ScheduledEvent,
        env: Bindings,
        ctx: ExecutionContext
    ): Promise<void> {
        console.log("scheduled");
        const result = await sync(env);
        console.log(result);
    },

    async fetch(request: Request, env: any) {
        return await app.fetch(request, env);
    },
};
