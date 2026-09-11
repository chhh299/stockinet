# Hermes 开放 API 集成规范与开发者指南

`stock-news-app` 为 Hermes 等智能金融/投研 Agent 提供了基于 HTTP REST 协议的高性能开放接口，命名空间统一为 `/api/v1/hermes/*`。

---

## 1. 鉴权机制与安全性 (Authentication)

### 1.1 环境变量配置
在部署服务（或 `.env.local`）中设置：
```bash
HERMES_API_KEY="your-secret-hermes-api-token"
```

### 1.2 请求头规范
所有发往 `/api/v1/hermes/*` 的 HTTP 请求均须附带请求头：
```http
Authorization: Bearer <HERMES_API_KEY>
```
*注：若服务端未设置 `HERMES_API_KEY`（如本地开发测试环境），鉴权校验将自动放行。*

### 1.3 错误状态码对照表
| HTTP 状态码 | 业务 Code | 说明 |
|---|---|---|
| `200 OK` | `0` | 成功 |
| `201 Created` | `0` | 标的新增成功 |
| `400 Bad Request` | `400` | 参数缺失或格式错误 |
| `401 Unauthorized` | `401` | 未携带 Token 或 Token 无效 |
| `409 Conflict` | `409` | 标的代码已存在 |
| `500 Server Error` | `500` | 服务端数据库或运行时异常 |

---

## 2. 端点参考指南 (API Endpoints)

### 2.1 获取聚合新闻与 AI 事实摘要
- **端点**: `GET /api/v1/hermes/news`
- **Query 参数**:
  - `symbol` (string, 可选): 股票代码（如 `AAPL`, `NVDA`, `600519.SS`）。
  - `market` (string, 可选): 市场分类（`US`, `HK`, `CN`, `INDEX`）。
  - `verified` (string, 可选): `true` 或 `false`，仅返回经两个及以上独立信源交叉核验的新闻。
  - `limit` (number, 可选): 单页返回条数，1~100，默认 `20`。
  - `days` (number, 可选): 查询最近天数，默认 `3`。
  - `cursor` (string, 可选): 分页游标。

- **响应格式**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "id": 108,
        "title": "贵州茅台发布2026半年度经营公告，营收平稳增长",
        "aiSummary": "贵州茅台半年度实现两位数增长，直销比例进一步提升，经营性现金流健康稳定。",
        "keyPoints": [
          "直销渠道贡献超40%营收",
          "核心单品批价维持平稳",
          "海外市场销售额同比增长超25%"
        ],
        "verificationStatus": "verified",
        "sourceCount": 3,
        "publishedAt": "2026-09-11T08:00:00.000Z",
        "stock": {
          "symbol": "600519.SS",
          "name": "Kweichow Moutai",
          "nameCn": "贵州茅台",
          "market": "CN",
          "price": 1780.0,
          "changePct": 1.15
        },
        "sources": [
          { "name": "eastmoney", "title": "...", "url": "https://...", "publishedAt": "..." },
          { "name": "cls", "title": "...", "url": "https://...", "publishedAt": "..." }
        ]
      }
    ],
    "nextCursor": "107",
    "hasMore": true
  },
  "meta": {
    "totalActiveStocks": 17,
    "serverTime": "2026-09-11T08:30:00.000Z"
  }
}
```

---

### 2.2 获取受监控自选股与最新行情简报
- **端点**: `GET /api/v1/hermes/stocks`
- **Query 参数**:
  - `activeOnly` (string, 可选): 默认 `true` 只返回参与日常调度与监控的标的；`false` 返回全部。
  - `market` (string, 可选): 按市场筛选 (`US`, `HK`, `CN`, `INDEX`)。

- **响应格式**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "stocks": [
      {
        "id": 1,
        "symbol": "NVDA",
        "name": "NVIDIA",
        "nameCn": "英伟达",
        "market": "US",
        "price": 125.8,
        "changePct": 3.42,
        "isActive": true,
        "isCustom": false,
        "latestHeadline": "英伟达新一代架构算力提升",
        "latestAiSummary": "英伟达在发布会展示最新旗舰架构性能，多家云厂商扩大订单...",
        "latestNewsAt": "2026-09-11T06:00:00.000Z"
      }
    ],
    "total": 1
  },
  "meta": {
    "serverTime": "2026-09-11T08:30:00.000Z"
  }
}
```

---

### 2.3 添加自选监控标的
- **端点**: `POST /api/v1/hermes/stocks`
- **Request Body**:
```json
{
  "symbol": "BABA",
  "nameCn": "阿里巴巴",
  "name": "Alibaba",
  "market": "US"
}
```
- **响应示例**:
```json
{
  "code": 0,
  "message": "Stock added successfully",
  "data": {
    "id": 18,
    "symbol": "BABA",
    "name": "Alibaba",
    "nameCn": "阿里巴巴",
    "market": "US",
    "isActive": true,
    "isCustom": true
  }
}
```

---

### 2.4 按需触发增量新闻抓取
- **端点**: `POST /api/v1/hermes/trigger-fetch`
- **Request Body**:
```json
{
  "skipAi": false
}
```
- **响应格式**:
```json
{
  "code": 0,
  "message": "Fetch process triggered successfully",
  "data": {
    "articlesFetched": 24,
    "clustersCreated": 8,
    "elapsedMs": 1420,
    "errors": []
  },
  "meta": {
    "serverTime": "2026-09-11T08:30:00.000Z"
  }
}
```

---

## 3. 语言调用示例 (Agent Integration Examples)

### 3.1 Python (httpx / requests)
```python
import httpx

HERMES_API_BASE = "http://localhost:3000/api/v1/hermes"
HERMES_API_KEY = "your-secret-hermes-api-token"

headers = {
    "Authorization": f"Bearer {HERMES_API_KEY}",
    "Content-Type": "application/json",
}

with httpx.Client(headers=headers, timeout=15.0) as client:
    # 1. 查询英伟达最新多源核验新闻
    res = client.get(f"{HERMES_API_BASE}/news", params={"symbol": "NVDA", "verified": "true"})
    news_data = res.json()
    for item in news_data.get("data", {}).get("items", []):
        print(f"[{item['publishedAt']}] {item['title']}")
        print(f"  AI 摘要: {item['aiSummary']}")
        for kp in item.get("keyPoints", []):
            print(f"  - {kp}")
```

### 3.2 TypeScript / Node.js
```typescript
const HERMES_API_BASE = "http://localhost:3000/api/v1/hermes";
const HERMES_API_KEY = "your-secret-hermes-api-token";

async function fetchVerifiedNews(symbol: string) {
  const url = `${HERMES_API_BASE}/news?symbol=${encodeURIComponent(symbol)}&verified=true`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${HERMES_API_KEY}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP Error ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();
  return json.data.items;
}
```
