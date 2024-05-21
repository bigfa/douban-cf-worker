export async function dbRequest(url: string, params: any = {}) {
    const headers = {
        Referer:
            "https://servicewechat.com/wx2f9b06c1de1ccfca/84/page-frame.html",
        "user-agent":
            "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 15_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.16(0x18001023) NetType/WIFI Language/zh_CN",
    };

    params = {
        ...params,
        apiKey: "0ac44ae016490db2204ce0a042db2916",
    };

    const requestParams = new URLSearchParams(params);

    return await fetch(url + "?" + requestParams, {
        headers,
    });
}
