# API 文档（中文）

本文档描述当前 Worker 已实现接口，字段与行为与现有代码保持一致。

## 基础信息

- 基础地址：`<WORKER_URL>`
- 鉴权方式：仅 `/init` 需要 Bearer Token
- 内容类型：默认 `application/json`（图片接口返回图片二进制）

## 1. 初始化同步

- 方法：`GET`
- 路径：`/init`
- 鉴权：`Authorization: Bearer <TOKEN>`
- 查询参数：
  - `paged`：页码，默认 `0`
  - `type`：条目类型，默认 `movie`，可选 `movie|drama|book|music|game`
  - `status`：状态，默认 `done`，可选 `done|mark|doing`

### 成功响应（文本）

- `Synced`：本页同步完成
- `No more data`：当前分页无更多数据

### 失败响应

- `401`：Token 不正确（由中间件返回）
- `500`：数据库写入等异常（JSON：`{ "err": ... }`）

### 示例

```bash
curl -H "Authorization: Bearer richiscool" \
  "https://your-worker.example.com/init?paged=0&type=movie&status=done"
```

## 2. 条目列表

- 方法：`GET`
- 路径：`/list`
- 查询参数：
  - `type`：默认 `movie`
  - `status`：默认 `done`
  - `paged`：默认 `1`

### 成功响应（JSON）

```json
{
  "results": [
    {
      "subject_id": "1292052",
      "name": "肖申克的救赎",
      "poster": "https://db.wpista.com/movie/1292052.jpg",
      "card_subtitle": "1994 / 美国 / 剧情 犯罪",
      "create_time": "2024-01-01 12:00:00",
      "douban_score": "9.7",
      "link": "https://movie.douban.com/subject/1292052/",
      "pubdate": "",
      "year": "",
      "type": "movie",
      "status": "done"
    }
  ]
}
```

说明：

- 当条目已缓存封面时，`poster` 指向 `R2DOMAIN/type/subject_id.jpg`
- 未缓存时，`poster` 指向 `WOKRERDOMAIN/type/subject_id.jpg`

### 示例

```bash
curl "https://your-worker.example.com/list?type=movie&status=done&paged=1"
```

## 3. 单个条目信息

- 方法：`GET`
- 路径：`/:type/:id`

路径参数：

- `type`：`movie|drama|book|music|game`
- `id`：豆瓣条目 ID

### 成功响应（JSON）

返回 `douban_objects` 单条记录对象，常见字段：

- `subject_id`
- `name`
- `poster`
- `card_subtitle`
- `create_time`
- `douban_score`
- `link`
- `pubdate`
- `year`
- `type`
- `status`

说明：

- 若数据库不存在该条目，会先请求豆瓣详情并入库，再返回对象。
- 若对象 `poster` 为空，返回 `WOKRERDOMAIN/type/id.jpg`。
- 若对象 `poster` 不为空，返回 `R2DOMAIN/<poster字段值>`。

### 失败响应（文本）

- `Not found`

### 示例

```bash
curl "https://your-worker.example.com/movie/1292052"
```

## 4. 封面本地化接口

- 方法：`GET`
- 路径：`/:type/:id.jpg`
- 用途：封面懒加载缓存到 R2。通常由前端请求 `poster` URL 时自动触发。

路径参数：

- `type`：`movie|drama|book|music|game`
- `id.jpg`：如 `1292052.jpg`

### 返回

- 成功：图片二进制流（带 `etag` 和对象元数据）

### 失败响应（文本）

- `ID not found`
- `Error 522`
- `Not found`

### 示例

```bash
curl -o poster.jpg "https://your-worker.example.com/movie/1292052.jpg"
```

## 5. 其他响应

未匹配路由时返回：

```json
{
  "success": false,
  "message": "Not Found - [METHOD] URL"
}
```
