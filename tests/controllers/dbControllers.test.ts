import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/api", () => ({
    fetchDoubanObject: vi.fn(),
    fetchDoubanObjects: vi.fn(),
}));

vi.mock("../../src/utils", () => ({
    dbRequest: vi.fn(),
}));

import {
    fetchDBObject,
    fetchDBPoster,
    getObjects,
    initDB,
} from "../../src/controllers/dbControllers";
import { fetchDoubanObject, fetchDoubanObjects } from "../../src/api";
import { dbRequest } from "../../src/utils";

type StatementMock = {
    bind: ReturnType<typeof vi.fn>;
    all: ReturnType<typeof vi.fn>;
    first: ReturnType<typeof vi.fn>;
    run: ReturnType<typeof vi.fn>;
};

const createStatement = (): StatementMock => {
    const statement: StatementMock = {
        bind: vi.fn(),
        all: vi.fn(),
        first: vi.fn(),
        run: vi.fn(),
    };
    statement.bind.mockReturnValue(statement);
    return statement;
};

const createR2Object = (
    body = "image-body",
    size = 128,
    etag = "etag-value"
): R2ObjectBody =>
    ({
        body: new Response(body).body,
        size,
        httpEtag: etag,
        writeHttpMetadata: (headers: Headers) => {
            headers.set("content-type", "image/jpeg");
        },
    } as unknown as R2ObjectBody);

const createContext = (options?: {
    query?: Record<string, string | undefined>;
    params?: Record<string, string>;
    envOverrides?: Record<string, unknown>;
}) => {
    const query = options?.query ?? {};
    const params = options?.params ?? {};

    const env = {
        DB: {
            prepare: vi.fn(),
        },
        DOUBAN_BUCKET: {
            get: vi.fn(),
            put: vi.fn(),
        },
        DOMAIN: "https://domain.example.com",
        DBID: "1000",
        R2DOMAIN: "https://r2.example.com",
        WOKRERDOMAIN: "https://worker.example.com",
        PAGESIZE: 40,
        TYPES: "movie,book,music,game,drama",
        TOKEN: "token",
        STATUSES: "done,mark,doing",
        ...(options?.envOverrides ?? {}),
    };

    const context = {
        req: {
            query: (name: string) => query[name],
            param: (name: string) => params[name],
        },
        env,
        json: (data: unknown, status?: number) =>
            new Response(JSON.stringify(data), {
                status: status ?? 200,
                headers: {
                    "content-type": "application/json",
                },
            }),
        text: (data: string, status?: number) =>
            new Response(data, {
                status: status ?? 200,
            }),
    };

    return context as any;
};

describe("dbControllers.getObjects", () => {
    it("uses default query values and maps poster URLs", async () => {
        const statement = createStatement();
        statement.all.mockResolvedValue({
            results: [
                {
                    subject_id: "1",
                    name: "n1",
                    card_subtitle: "c1",
                    create_time: "1",
                    douban_score: "9",
                    link: "l1",
                    type: "movie",
                    poster: "movie/1.jpg",
                    pubdate: "",
                    year: "",
                    status: "done",
                },
                {
                    subject_id: "2",
                    name: "n2",
                    card_subtitle: "c2",
                    create_time: "2",
                    douban_score: "8",
                    link: "l2",
                    type: "movie",
                    poster: "",
                    pubdate: "",
                    year: "",
                    status: "done",
                },
            ],
        });

        const c = createContext();
        c.env.DB.prepare.mockReturnValue(statement);

        const response = await getObjects(c);
        const payload = (await response.json()) as { poster: string };

        expect(c.env.DB.prepare).toHaveBeenCalledTimes(1);
        expect(statement.bind).toHaveBeenCalledWith("movie", "done", 40, 0);
        expect(payload).toEqual({
            results: [
                expect.objectContaining({
                    subject_id: "1",
                    poster: "https://r2.example.com/movie/1.jpg",
                }),
                expect.objectContaining({
                    subject_id: "2",
                    poster: "https://worker.example.com/movie/2.jpg",
                }),
            ],
        });
    });

    it("applies paged/type/status query values", async () => {
        const statement = createStatement();
        statement.all.mockResolvedValue({ results: [] });

        const c = createContext({
            query: {
                type: "book",
                status: "mark",
                paged: "3",
            },
        });
        c.env.DB.prepare.mockReturnValue(statement);

        await getObjects(c);

        expect(statement.bind).toHaveBeenCalledWith("book", "mark", 40, 80);
    });
});

describe("dbControllers.initDB", () => {
    it("returns No more data when interests are empty", async () => {
        vi.mocked(fetchDoubanObjects).mockResolvedValue(
            new Response(
                JSON.stringify({
                    interests: [],
                })
            )
        );

        const c = createContext();
        const response = await initDB(c);

        expect(await response.text()).toBe("No more data");
    });

    it("inserts valid interests and skips unknown titles", async () => {
        vi.mocked(fetchDoubanObjects).mockResolvedValue(
            new Response(
                JSON.stringify({
                    interests: [
                        {
                            subject: {
                                id: "100",
                                title: "未知电影",
                                card_subtitle: "s1",
                                rating: { value: "0" },
                                url: "u1",
                            },
                            create_time: "1",
                            status: "done",
                        },
                        {
                            subject: {
                                id: "200",
                                title: "正常标题",
                                card_subtitle: "s2",
                                rating: { value: "8.8" },
                                url: "u2",
                            },
                            create_time: "2",
                            status: "doing",
                        },
                    ],
                })
            )
        );

        const insertStmt = createStatement();
        insertStmt.run.mockResolvedValue({});

        const c = createContext();
        c.env.DB.prepare.mockReturnValue(insertStmt);

        const response = await initDB(c);

        expect(c.env.DB.prepare).toHaveBeenCalledTimes(1);
        expect(insertStmt.bind).toHaveBeenCalledWith(
            "200",
            "正常标题",
            "s2",
            "2",
            "8.8",
            "u2",
            "movie",
            "doing"
        );
        expect(await response.text()).toBe("Synced");
    });
});

describe("dbControllers.fetchDBObject", () => {
    it("returns DB object and worker poster URL when poster is empty", async () => {
        const selectStmt = createStatement();
        selectStmt.first.mockResolvedValue({
            subject_id: "300",
            name: "title",
            card_subtitle: "subtitle",
            create_time: "1",
            douban_score: "8",
            link: "link",
            type: "movie",
            poster: "",
            pubdate: "",
            year: "",
            status: "done",
        });

        const c = createContext({
            params: {
                type: "movie",
                id: "300",
            },
        });
        c.env.DB.prepare.mockReturnValue(selectStmt);

        const response = await fetchDBObject(c);
        const payload = (await response.json()) as { poster: string };

        expect(payload.poster).toBe("https://worker.example.com/movie/300.jpg");
        expect(fetchDoubanObject).not.toHaveBeenCalled();
    });

    it("fetches and inserts object when missing in DB", async () => {
        const selectMissingStmt = createStatement();
        selectMissingStmt.first.mockResolvedValueOnce(null);

        const insertStmt = createStatement();
        insertStmt.run.mockResolvedValue({});

        const selectAfterInsertStmt = createStatement();
        selectAfterInsertStmt.first.mockResolvedValue({
            subject_id: "500",
            name: "name",
            card_subtitle: "subtitle",
            create_time: "",
            douban_score: "9.1",
            link: "https://douban.com/subject/500",
            type: "book",
            poster: "",
            pubdate: "",
            year: "",
            status: "",
        });

        const c = createContext({
            params: {
                type: "book",
                id: "500",
            },
        });
        c.env.DB.prepare
            .mockReturnValueOnce(selectMissingStmt)
            .mockReturnValueOnce(insertStmt)
            .mockReturnValueOnce(selectAfterInsertStmt);

        vi.mocked(fetchDoubanObject).mockResolvedValue(
            new Response(
                JSON.stringify({
                    id: "500",
                    title: "name",
                    card_subtitle: "subtitle",
                    rating: { value: "9.1" },
                    url: "https://douban.com/subject/500",
                })
            )
        );

        const response = await fetchDBObject(c);
        const payload = (await response.json()) as { poster: string };

        expect(insertStmt.bind).toHaveBeenCalledWith(
            "500",
            "name",
            "subtitle",
            "9.1",
            "https://douban.com/subject/500",
            "book"
        );
        expect(payload.poster).toBe("https://worker.example.com/book/500.jpg");
    });
});

describe("dbControllers.fetchDBPoster", () => {
    it("returns cached poster when object exists in R2", async () => {
        const cachedObject = createR2Object("cached-image", 120, "cached-etag");
        const c = createContext({
            params: {
                type: "movie",
                id: "777.jpg",
            },
        });
        c.env.DOUBAN_BUCKET.get.mockResolvedValue(cachedObject);

        const response = await fetchDBPoster(c);
        const body = await response.text();

        expect(c.env.DOUBAN_BUCKET.get).toHaveBeenCalledWith("movie/777.jpg");
        expect(response.headers.get("etag")).toBe("cached-etag");
        expect(body).toBe("cached-image");
    });

    it("downloads poster, updates DB and caches when R2 misses", async () => {
        const storedObject = createR2Object("stored-image", 128, "stored-etag");
        const c = createContext({
            params: {
                type: "music",
                id: "888.jpg",
            },
        });
        c.env.DOUBAN_BUCKET.get
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(storedObject);
        c.env.DOUBAN_BUCKET.put.mockResolvedValue(undefined);

        vi.mocked(fetchDoubanObject).mockResolvedValue(
            new Response(
                JSON.stringify({
                    pic: {
                        large: "https://img.example.com/888.jpg",
                    },
                })
            )
        );

        const imageResponse = new Response("image-binary", { status: 200 });
        vi.mocked(dbRequest).mockResolvedValue(imageResponse);

        const selectStmt = createStatement();
        selectStmt.first.mockResolvedValue({
            subject_id: "888",
        });

        const updateStmt = createStatement();
        updateStmt.run.mockResolvedValue({});

        c.env.DB.prepare
            .mockReturnValueOnce(selectStmt)
            .mockReturnValueOnce(updateStmt);

        const response = await fetchDBPoster(c);

        expect(dbRequest).toHaveBeenCalledWith("https://img.example.com/888.jpg");
        expect(updateStmt.bind).toHaveBeenCalledWith(
            "music/888.jpg",
            "888",
            "music"
        );
        expect(c.env.DOUBAN_BUCKET.put).toHaveBeenCalledTimes(1);
        expect(response.headers.get("etag")).toBe("stored-etag");
        expect(await response.text()).toBe("stored-image");
    });

    it("returns Error 522 when poster download fails with 522", async () => {
        const c = createContext({
            params: {
                type: "game",
                id: "999.jpg",
            },
        });
        c.env.DOUBAN_BUCKET.get.mockResolvedValue(null);

        vi.mocked(fetchDoubanObject).mockResolvedValue(
            new Response(
                JSON.stringify({
                    pic: {
                        large: "https://img.example.com/999.jpg",
                    },
                })
            )
        );

        vi.mocked(dbRequest).mockResolvedValue(new Response("", { status: 522 }));

        const response = await fetchDBPoster(c);

        expect(await response.text()).toBe("Error 522");
    });

    it("returns ID not found when jpg id becomes empty", async () => {
        const c = createContext({
            params: {
                type: "movie",
                id: ".jpg",
            },
        });

        const response = await fetchDBPoster(c);
        expect(await response.text()).toBe("ID not found");
    });
});
