import { Hono } from "hono";
import { cors } from "hono/cors";
import { bearerAuth } from "hono/bearer-auth";
import { Bindings } from "../models/dbModule";
import { douban } from "../controllers";

const db = new Hono<{ Bindings: Bindings }>();

db.get(
    "/init",
    bearerAuth({
        verifyToken: async (token, c) => {
            return token === c.env.TOKEN;
        },
    }),
    (c) => douban.initDB(c)
);

db.get(
    "/list",
    cors({
        origin: "*",
    }),
    (c) => douban.getObjects(c)
);

db.get("/:type/:id{.+\\.jpg$}", (c) => douban.fetchDBPoster(c));

// fetch single item
db.get("/:type/:id", (c) => douban.fetchDBObject(c));

export default db;
