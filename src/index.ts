import { Hono } from "hono";
import { sync } from "./controllers";
import { Douban } from "./routers";
import { Bindings } from "./types";
import { errorHandler, notFound } from "./middlewares";

const app = new Hono<{ Bindings: Bindings }>();

app.route("/", Douban);

// Error Handler
app.onError((err, c) => {
    const error = errorHandler(c);
    return error;
});

// Not Found Handler
app.notFound((c) => {
    const error = notFound(c);
    return error;
});

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
