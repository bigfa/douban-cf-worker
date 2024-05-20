const { request } = require("undici");

const { DOUBAN_ID, TYPES, WORKER_URL, TOKEN, STATUSES } = process.env;

const requestOptions = {
    maxRedirections: 2,
    headers: {
        authorization: "",
        "user-agent":
            "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 15_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.16(0x18001023) NetType/WIFI Language/zh_CN",
        referer:
            "https://servicewechat.com/wx2f9b06c1de1ccfca/84/page-frame.html",
    },
};

async function getTotal(type, status) {
    const url = `https://frodo.douban.com/api/v2/user/${DOUBAN_ID}/interests?status=${status}&count=10&start=0&type=${type}&apiKey=0ac44ae016490db2204ce0a042db2916`;

    return request(url, requestOptions).then(({ body }) => body.json());
}

const types = (TYPES ?? "").split(",");
const statuses = (STATUSES ?? "").split(",");
console.info("types", statuses);
async function initObjects(type, status) {
    const res = await getTotal(type, status);
    // @ts-ignore
    const total = res.total;
    const total_page = Math.round(total / 50);
    for (let paged = 0; paged < total_page; paged++) {
        await request(
            WORKER_URL +
                "/init?paged=" +
                paged +
                "&type=" +
                type +
                "&status=" +
                status,
            {
                headers: {
                    Authorization: "Bearer " + TOKEN,
                },
            }
        );
        console.info(DOUBAN_ID, type, status, total, paged, total_page);
    }
}

types.forEach(async (type) => {
    statuses.forEach(async (status) => {
        const res = await getTotal(type, status);
        // @ts-ignore
        const total = res.total;
        const total_page = Math.ceil(total / 50);
        for (let paged = 0; paged < total_page; paged++) {
            await request(
                WORKER_URL +
                    "/init?paged=" +
                    paged +
                    "&type=" +
                    type +
                    "&status=" +
                    status,
                {
                    headers: {
                        Authorization: "Bearer " + TOKEN,
                    },
                }
            );
            console.info(DOUBAN_ID, type, status, total, paged, total_page);
        }
    });
});
