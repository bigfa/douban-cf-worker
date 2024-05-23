# 同步豆瓣书影音

> 本功能直接解决豆瓣书影音记录两大痛点，自动同步和封面本地化，对于普通用户来说，Cloudflare 的免费版足够了，非常推荐使用。

之前我自己用 nodejs + mysql 写了一个同步豆瓣书影音的服务，但只在一个很隐蔽的地方公开了，主要是流量和数据库压力太大，提供公共服务成本实在是太高，最近在研究 Cloudflare Worker，试着把服务迁移过去，过程中发现几个问题。

-   D1 单次请求操作次数是有限制的，最多一千次，读写都算。
-   Worker 子请求数最多就是 50 次，下载图片是占用这个次数的，初始化的时候如果下载图片基本都会超限失败。
-   Worker 直接读取 R2 输出图片的话速度很慢。

不过多次测试之后还是找到了使用方法，虽然免费版有各种限制，但限制的都是单次请求，初始化的时候数据比较多，只需要在本地分页之后调用初始化接口就行了，后续使用定时任务同步不会因为请求过多而超限，除非在短时间内标记了大量内容。

自动同步使用了 Cloudflare 的 cron 触发器，实测还是比较好用的。同步时间可以根据自己的需求设置，默认配置是每 30 分钟同步一次。

```
crons = ["*/30 * * * *"]
```

> 如果未进行初始化直接进行同步，可能会因为 D1 操作次数过多报错而无法同步老数据，这时需要清空数据重新初始化，建议 worker 部署后第一时间初始化。

### 配置文件

`wrangler.toml`

```

[vars]
DOMAIN = "https://bigfa.github.io" // 跨域域名
DBID = 54529369 // 你的豆瓣ID
R2DOMAIN = "https://db.wpista.com" // R2 绑定域名
WOKRERDOMAIN = "https://dbapi.wpista.com" // worker 绑定域名
PAGESIZE = 40 // 每页显示数量
TYPES = "movie,book,music,game,drama" //初始化数据类型，支持五种，根据你的需要自行设置
STATUSES = "done,mark,doing" // 状态类型
TOKEN = "richiscool" // 初始化密钥，为了避免有人恶意调用同步接口，增加了一个token 验证

[[r2_buckets]]
binding = "DOUBAN_BUCKET"
bucket_name = "douban"

[[d1_databases]]
binding = "DB"
database_name = "douban"
database_id = "c3f4fe6b-4fb2-4513-b7e9-3b264d3e3634"

[triggers]
crons = ["*/30 * * * *"] // 自动同步任务设置规则
```

变量部分写了注释，r2 和 d1 绑定信息可在 Cloudflare 后台自行查看。

### 部署方法

安装依赖

```
npm install
```

初始化数据库，也可在后台创建。

```
npx wrangler d1 create douban

```

本地

```
npx wrangler d1 execute douban --local --file=./schema.sql
```

远程

```
npx wrangler d1 execute douban --remote --file=./schema.sql
```

修改配置文件后部署

```
npm run deploy
```

### Github Action 自动部署

clone 本项目或者直接 use this template

进入 Github 项目的设置，`Settings->Secrets and variables->Actions->Repository secret`，新增一个 `secret`，命名为 `CLOUDFLARE_API_TOKEN`。如果需要修改数据库名需要编辑`.github/workflows/deploy.yml`,douban 就是数据库名。

```
wrangler d1 execute douban --file=./schema.sql
```

[密钥设置地址](https://dash.cloudflare.com/profile/api-tokens)，注意要给 D1 的编辑权限。

这样 main 分支有更新的时候就会自动部署了，部署前记得修改`wrangler.toml`配置文件。

### 初始化方法

**即使自动部署，初始化还是需要在本地完成，除非你的数据比较少，等着定时任务自动同步就好了。**

配置文件`config.env`

```
DOUBAN_ID=54529369 // 你的豆瓣ID
TYPES=movie,music,book,game,drama //初始化数据类型，支持五种，根据你的需要自行设置
WORKER_URL=https://dbapi.wpista.com // worker 绑定域名
TOKEN=richiscool // 初始化密钥，为了避免有人恶意调用同步接口，增加了一个token 验证
STATUSES = done,mark,doing // 状态类型
```

命令

```
npm run init
```

等待完成即可。

### 接口

Worker 对外提供了 3 个接口，标记条目列表、单个条目信息、本地化条目封面。

-   条目列表`/list`，支持两个参数 `type` 和 `paged`,`type` 为条目类型，`status` 为状态类型，`paged` 为页码，`get` 请求。
-   单个条目为`/:type/:id`,`type` 为类型，`id` 为条目 `id`。
-   本地化封面接口无序主动调用，在调用上面两个接口时会根据具体情况自动调用。

### 前端展示

和以前一样，强烈建议使用本人全家桶，如果想自行调用则可以参考主题目录下 `assets/ts/db.ts` 和页面模版文件`layout/section.movies.html` 的文件。或者直接用 worker 接口自行开发。
