const { request } = require("undici");

const { DOUBAN_ID, TYPES, WORKER_URL } = process.env;

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

async function getTotal(type) {
    const url = `https://frodo.douban.com/api/v2/user/${DOUBAN_ID}/interests?count=10&start=0&type=${type}&apiKey=0ac44ae016490db2204ce0a042db2916`;

    return request(url, requestOptions).then(({ body }) => body.json());
}

const types = (TYPES ?? "").split(",");
types.forEach(async (type) => {
    const res = await getTotal(type);
    // @ts-ignore
    const total = res.total;
    const total_page = Math.ceil(total / 50);
    for (let paged = 0; paged < total_page; paged++) {
        request(WORKER_URL + "/init?paged=" + paged + "&type=" + type, {
            headers: {
                Authorization: "Bearer " + process.env.TOKEN,
            },
        });
        console.info(DOUBAN_ID, type, total, paged, total_page);
    }
});
