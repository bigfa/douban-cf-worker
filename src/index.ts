import { Hono } from "hono";
import sync from "./controllers/syncControllers";
import { Douban } from "./routers";
import { Bindings } from "./models/dbModule";

const app = new Hono<{ Bindings: Bindings }>();

app.route("/", Douban);

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
