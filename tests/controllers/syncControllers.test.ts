import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/api", () => ({
    fetchDoubanObjects: vi.fn(),
}));

import { sync } from "../../src/controllers/syncControllers";
import { fetchDoubanObjects } from "../../src/api";

type StatementMock = {
    bind: ReturnType<typeof vi.fn>;
    first: ReturnType<typeof vi.fn>;
    run: ReturnType<typeof vi.fn>;
};

const createStatement = (): StatementMock => {
    const statement: StatementMock = {
        bind: vi.fn(),
        first: vi.fn(),
        run: vi.fn(),
    };
    statement.bind.mockReturnValue(statement);
    return statement;
};

const createBindings = () => {
    return {
        DB: {
            prepare: vi.fn(),
        },
        DOUBAN_BUCKET: {} as R2Bucket,
        DOMAIN: "https://domain.example.com",
        DBID: "1000",
        R2DOMAIN: "https://r2.example.com",
        WOKRERDOMAIN: "https://worker.example.com",
        PAGESIZE: 40,
        TYPES: "movie",
        TOKEN: "token",
        STATUSES: "done",
    };
};

describe("syncControllers.sync", () => {
    it("inserts new records and stops when no more data", async () => {
        vi.mocked(fetchDoubanObjects)
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        interests: [
                            {
                                subject: {
                                    id: "1",
                                    title: "标题一",
                                    card_subtitle: "副标题",
                                    rating: { value: "8.8" },
                                    url: "u1",
                                },
                                create_time: "2024-01-01",
                                status: "done",
                            },
                        ],
                    })
                )
            )
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        interests: [],
                    })
                )
            );

        const selectStmt = createStatement();
        selectStmt.first.mockResolvedValue(null);
        const insertStmt = createStatement();
        insertStmt.run.mockResolvedValue({});

        const bindings = createBindings();
        bindings.DB.prepare
            .mockReturnValueOnce(selectStmt)
            .mockReturnValueOnce(insertStmt);

        const result = await sync(bindings as any);

        expect(result).toBe("Synced");
        expect(insertStmt.bind).toHaveBeenCalledWith(
            "1",
            "标题一",
            "副标题",
            "2024-01-01",
            "8.8",
            "u1",
            "movie",
            "done"
        );
        expect(fetchDoubanObjects).toHaveBeenCalledTimes(2);
    });

    it("updates status when changed and then stops on no new data branch", async () => {
        vi.mocked(fetchDoubanObjects)
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        interests: [
                            {
                                subject: {
                                    id: "2",
                                    title: "标题二",
                                    card_subtitle: "副标题二",
                                    rating: { value: "7.5" },
                                    url: "u2",
                                },
                                create_time: "2024-02-01",
                                status: "mark",
                            },
                        ],
                    })
                )
            )
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        interests: [
                            {
                                subject: {
                                    id: "2",
                                    title: "标题二",
                                    card_subtitle: "副标题二",
                                    rating: { value: "7.5" },
                                    url: "u2",
                                },
                                create_time: "2024-02-01",
                                status: "mark",
                            },
                        ],
                    })
                )
            );

        const selectChangedStmt = createStatement();
        selectChangedStmt.first.mockResolvedValue({
            status: "done",
        });
        const updateStmt = createStatement();
        updateStmt.run.mockResolvedValue({});
        const selectNoNewStmt = createStatement();
        selectNoNewStmt.first.mockResolvedValue({
            status: "mark",
        });

        const bindings = createBindings();
        bindings.DB.prepare
            .mockReturnValueOnce(selectChangedStmt)
            .mockReturnValueOnce(updateStmt)
            .mockReturnValueOnce(selectNoNewStmt);

        const result = await sync(bindings as any);

        expect(result).toBe("Synced");
        expect(updateStmt.bind).toHaveBeenCalledWith(
            "mark",
            "2024-02-01",
            "2",
            "movie"
        );
        expect(fetchDoubanObjects).toHaveBeenCalledTimes(2);
    });

    it("skips unknown titles without inserting", async () => {
        vi.mocked(fetchDoubanObjects)
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        interests: [
                            {
                                subject: {
                                    id: "3",
                                    title: "未知电影",
                                    card_subtitle: "x",
                                    rating: { value: "0" },
                                    url: "u3",
                                },
                                create_time: "2024-03-01",
                                status: "done",
                            },
                        ],
                    })
                )
            )
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        interests: [],
                    })
                )
            );

        const selectStmt = createStatement();
        selectStmt.first.mockResolvedValue(null);
        const insertStmt = createStatement();
        insertStmt.run.mockResolvedValue({});

        const bindings = createBindings();
        bindings.DB.prepare
            .mockReturnValueOnce(selectStmt)
            .mockReturnValueOnce(insertStmt);

        const result = await sync(bindings as any);

        expect(result).toBe("Synced");
        expect(insertStmt.run).not.toHaveBeenCalled();
    });
});
