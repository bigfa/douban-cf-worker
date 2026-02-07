import { Context } from "hono";
import { fetchDoubanObject, fetchDoubanObjects } from "../api";
import { DoubanObject } from "../models";
import { ObjectStatus, ObjectTypes, Bindings } from "../types";
import { dbRequest } from "../utils";

type WorkerContext = Context<{ Bindings: Bindings }>;

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

type DoubanObjectResponse = {
    id: string;
    title: string;
    card_subtitle: string;
    rating: {
        value: string;
    };
    url: string;
    pic: {
        large: string;
    };
};

const SELECT_OBJECTS_BY_TYPE_STATUS =
    "SELECT * FROM douban_objects WHERE type = ? AND status = ? ORDER BY create_time DESC LIMIT ? OFFSET ?";
const INSERT_OBJECT =
    "INSERT INTO douban_objects (subject_id, name , card_subtitle, create_time, douban_score,link,type ,status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
const SELECT_OBJECT_BY_SUBJECT_AND_TYPE =
    "SELECT * FROM douban_objects WHERE subject_id = ? AND type = ?";
const UPDATE_OBJECT_POSTER =
    "UPDATE douban_objects SET poster = ? WHERE subject_id = ? AND type = ?";
const SELECT_OBJECT_BY_TYPE_AND_SUBJECT =
    "SELECT * FROM douban_objects WHERE type = ? AND subject_id = ?";
const INSERT_OBJECT_WITHOUT_STATUS =
    "INSERT INTO douban_objects (subject_id, name , card_subtitle, douban_score,link,type) VALUES (?, ?, ?, ?, ?, ?)";

const parsePaged = (value: string | undefined, fallback: number): number => {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isNaN(parsed) ? fallback : parsed;
};

const toPageSize = (value: number | string): number => {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
};

const toListPosterUrl = (
    c: WorkerContext,
    type: ObjectTypes,
    object: DoubanObject
): string => {
    return object.poster
        ? `${c.env.R2DOMAIN}/${type}/${object.subject_id}.jpg`
        : `${c.env.WOKRERDOMAIN}/${type}/${object.subject_id}.jpg`;
};

const toObjectPosterUrl = (
    c: WorkerContext,
    type: ObjectTypes,
    object: DoubanObject
): string => {
    return object.poster
        ? `${c.env.R2DOMAIN}/${object.poster}`
        : `${c.env.WOKRERDOMAIN}/${type}/${object.subject_id}.jpg`;
};

const shouldSkipSubject = (title: string): boolean => {
    return title === "未知电视剧" || title === "未知电影";
};

export const getObjects = async (c: WorkerContext) => {
    const type = (c.req.query("type") as ObjectTypes) || "movie";
    const paged = parsePaged(c.req.query("paged"), 1);
    const status = (c.req.query("status") as ObjectStatus) || "done";
    const pageSize = toPageSize(c.env.PAGESIZE);

    console.log(status);

    const objects = await c.env.DB.prepare(SELECT_OBJECTS_BY_TYPE_STATUS)
        .bind(type, status, pageSize, (paged - 1) * pageSize)
        .all<DoubanObject>();

    console.log(objects.results);

    const results = Array.isArray(objects.results)
        ? objects.results.map((object) => ({
              ...object,
              poster: toListPosterUrl(c, type, object),
          }))
        : [];

    return c.json({ results });
};

export const initDB = async (c: WorkerContext) => {
    const paged = parsePaged(c.req.query("paged"), 0);
    const type = (c.req.query("type") as ObjectTypes) || "movie";
    const status = (c.req.query("status") as ObjectStatus) || "done";

    console.log(paged);

    const res = await fetchDoubanObjects(c.env.DBID, type, status, paged);
    const data = (await res.json()) as DoubanInterestResponse;
    const interets = data.interests;

    console.log(type, status, interets.length, paged);

    if (interets.length === 0) {
        return c.text("No more data");
    }

    for (const interet of interets) {
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

            if (shouldSkipSubject(interet.subject.title)) {
                continue;
            }

            await c.env.DB.prepare(INSERT_OBJECT)
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
        } catch (err) {
            console.log(err);
            return c.json({ err }, 500);
        }
    }

    return c.text("Synced");
};

export const fetchDBPoster = async (c: WorkerContext) => {
    const type = (c.req.param("type") as ObjectTypes) || "movie";
    console.log(c.req.query("type"));

    const id = c.req.param("id").replace(".jpg", "");
    if (!id) {
        return c.text("ID not found");
    }

    const key = `${type}/${id}.jpg`;
    const object = await c.env.DOUBAN_BUCKET.get(key);

    if (object === null || object.size < 50) {
        const detailResponse = await fetchDoubanObject(type, id);
        const data = (await detailResponse.json()) as DoubanObjectResponse;
        console.log(data);

        const res = await dbRequest(data.pic.large);
        if (res.status === 522) {
            return c.text("Error 522");
        }

        const dbobject = await c.env.DB.prepare(SELECT_OBJECT_BY_SUBJECT_AND_TYPE)
            .bind(id, type)
            .first<DoubanObject>();

        if (dbobject === null) {
            return c.text("Not found");
        }

        await c.env.DB.prepare(UPDATE_OBJECT_POSTER).bind(key, id, type).run();

        const buffer = await res.arrayBuffer();
        await c.env.DOUBAN_BUCKET.put(key, buffer);

        const storedObject = (await c.env.DOUBAN_BUCKET.get(key)) as R2ObjectBody;
        const headers = new Headers();
        storedObject.writeHttpMetadata(headers);
        headers.set("etag", storedObject.httpEtag);

        return new Response(storedObject.body, {
            headers,
        });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);

    return new Response(object.body, {
        headers,
    });
};

export const fetchDBObject = async (c: WorkerContext) => {
    const type = (c.req.param("type") as ObjectTypes) || "movie";
    const id = c.req.param("id");

    let object = await c.env.DB.prepare(SELECT_OBJECT_BY_TYPE_AND_SUBJECT)
        .bind(type, id)
        .first<DoubanObject>();

    console.log(object);

    if (object === null) {
        const detailResponse = await fetchDoubanObject(type, id);
        const data = (await detailResponse.json()) as DoubanObjectResponse;

        await c.env.DB.prepare(INSERT_OBJECT_WITHOUT_STATUS)
            .bind(
                data.id,
                data.title,
                data.card_subtitle,
                data.rating.value,
                data.url,
                type
            )
            .run();

        object = await c.env.DB.prepare(SELECT_OBJECT_BY_TYPE_AND_SUBJECT)
            .bind(type, id)
            .first<DoubanObject>();

        if (object === null) {
            return c.text("Not found");
        }

        object.poster = `${c.env.WOKRERDOMAIN}/${type}/${id}.jpg`;
        return c.json(object);
    }

    object.poster = toObjectPosterUrl(c, type, object);
    return c.json(object);
};
