import { describe, expect, it, vi } from "vitest";
import { dbRequest } from "../../src/utils/request";

describe("dbRequest", () => {
    it("appends apiKey and forwards query params", async () => {
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValue(new Response("ok"));

        await dbRequest("https://example.com/interests", {
            count: 50,
            start: 100,
            type: "movie",
            status: "done",
            skipUndefined: undefined,
            skipNull: null,
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);

        const [url, options] = fetchMock.mock.calls[0] as [
            string,
            RequestInit | undefined
        ];
        const parsed = new URL(url);

        expect(parsed.origin + parsed.pathname).toBe(
            "https://example.com/interests"
        );
        expect(parsed.searchParams.get("count")).toBe("50");
        expect(parsed.searchParams.get("start")).toBe("100");
        expect(parsed.searchParams.get("type")).toBe("movie");
        expect(parsed.searchParams.get("status")).toBe("done");
        expect(parsed.searchParams.get("apiKey")).toBe(
            "0ac44ae016490db2204ce0a042db2916"
        );
        expect(parsed.searchParams.get("skipUndefined")).toBeNull();
        expect(parsed.searchParams.get("skipNull")).toBeNull();

        expect(options?.headers).toEqual(
            expect.objectContaining({
                Referer:
                    "https://servicewechat.com/wx2f9b06c1de1ccfca/84/page-frame.html",
                "user-agent": expect.any(String),
            })
        );
    });

    it("still sends apiKey when no params are provided", async () => {
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValue(new Response("ok"));

        await dbRequest("https://example.com/object");

        const [url] = fetchMock.mock.calls[0] as [string];
        const parsed = new URL(url);
        expect(parsed.searchParams.get("apiKey")).toBe(
            "0ac44ae016490db2204ce0a042db2916"
        );
    });
});
