import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/utils", () => ({
    dbRequest: vi.fn(),
}));

import { fetchDoubanObject, fetchDoubanObjects } from "../../src/api/douban";
import { dbRequest } from "../../src/utils";

describe("douban api helpers", () => {
    it("fetchDoubanObject builds subject URL", async () => {
        const mocked = vi.mocked(dbRequest);
        mocked.mockResolvedValue(new Response("ok"));

        await fetchDoubanObject("movie", "1292052");

        expect(mocked).toHaveBeenCalledWith(
            "https://frodo.douban.com/api/v2/movie/1292052"
        );
    });

    it("fetchDoubanObjects builds interests URL and params", async () => {
        const mocked = vi.mocked(dbRequest);
        mocked.mockResolvedValue(new Response("ok"));

        await fetchDoubanObjects("123", "book", "done", 2);

        expect(mocked).toHaveBeenCalledWith(
            "https://frodo.douban.com/api/v2/user/123/interests",
            {
                count: 50,
                start: 100,
                type: "book",
                status: "done",
            }
        );
    });
});
