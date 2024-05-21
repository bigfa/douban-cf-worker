import { Context } from "hono";

// Error Handler
export const errorHandler = (c: Context) => {
    console.log(c.res.status);

    return c.json({
        success: false,
        message: c.error?.message,
    });
};

// Not Found Handler
export const notFound = (c: Context) => {
    return c.json({
        success: false,
        message: `Not Found - [${c.req.method}] ${c.req.url}`,
    });
};
