# stock-news-upgrade 架构升级与技术设计规范

## 1. 概述与升级背景

`stock-news-app` 是一个以金融热点聚合、AI 摘要、交叉核验为核心的全球股票资讯系统。本次升级（`stock-news-upgrade`）旨在突破现有系统的四大关键瓶颈：
1. **单一 LLM 绑定**：由强绑定 `deepseek-chat` 升级为**支持任意 OpenAI 兼容协议的大语言模型**（如 OpenAI、Ollama、OneAPI、Qwen、Claude Proxy、DeepSeek等），并支持环境变量动态切换与降级容错。
2. **缺乏国内权威金融快讯**：在现存 Finnhub、Google News、Yahoo 基础上，设计插件化多源架构，引入**东方财富（EastMoney）** 与 **财联社（CLS）/ 新浪财经（Sina）** 原生适配器，并通过环境变量实现源级别开关与故障隔离。
3. **股票池静态死板**：将静态硬编码在代码中的 `TRACKED_STOCKS` 演进为**数据库驱动的自选股动态管理机制**，提供自选股 CRUD API（增、删、改、查、启停状态切换）、开箱即用的自动种子（Seed）机制以及前端可视化管理 UI。
4. **缺乏对智能 Agent 的开放集成能力**：提供对 Hermes 友好的标准 REST API（命名空间 `/api/v1/hermes/*`），采用 Bearer Token 安全鉴权机制，输出规范严谨的结构化金融新闻、自选股标的与分析结果。

---

## 2. 总体架构拓扑与模块划分

### 2.1 系统拓扑图

```
+-----------------------------------------------------------------------------------+
|                                  客户端与外部调用                                   |
|                                                                                   |
|  +--------------------+   +-----------------------+   +------------------------+  |
|  |   Web UI (Next.js) |   | Hermes Agent (投研助手)|   | Vercel Cron / CI 调度器 |  |
|  | (自选股/新闻流/看板)|   | (Bearer Token 鉴权)   |   | (Bearer CRON_SECRET)   |  |
|  +---------+----------+   +-----------+-----------+   +-----------+------------+  |
+------------|--------------------------|---------------------------|---------------+
             | (Internal API)           | (REST API /v1/hermes/*)   | (/api/cron/*)
             v                          v                           v
+-----------------------------------------------------------------------------------+
|                            Next.js App Router 服务端运行时                         |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | API 路由与安全鉴权层 (Route Handlers & Middlewares)                         |  |
|  | - /api/stocks (自选股管理)         - /api/news (前端展示流)                 |  |
|  | - /api/v1/hermes/* (Hermes 开放API, Bearer Auth: HERMES_API_KEY)            |  |
|  | - /api/cron/fetch-news (定时调度任务)                                       |  |
|  +-----------------------------------------------------------------------------+  |
|                                       |                                           |
|  +------------------------------------+----------------------------------------+  |
|  | 核心业务与流水线引擎 (Pipeline & Core Engine)                                |  |
|  |                                                                             |  |
|  |  +---------------------+   +---------------------+   +-------------------+  |  |
|  |  | 多资讯源收集调度器   |-->| 文本去重与聚合引擎   |-->| AI 摘要与相关度过滤|  |  |
|  |  | (Source Manager)    |   | (Levenshtein Dedup) |   | (Summarizer)      |  |  |
|  |  +----------+----------+   +---------------------+   +---------+---------+  |  |
|  +-------------|--------------------------------------------------|------------+  |
|                |                                                  |               |
|  +-------------v----------------------------+   +-----------------v------------+  |
|  | 可插拔数据源适配层 (lib/sources/*)        |   | 通用 LLM 客户端层            |  |
|  | - FinnhubAdapter      - GoogleNews       |   | (lib/llm/client.ts)          |  |
|  | - YahooAdapter        - EastMoneyAdapter |   | - OpenAI 兼容 ChatCompletion |  |
|  | - CLSAdapter (财联社) - SinaAdapter      |   | - 指数退避重试与超时控制      |  |
|  | - 开关配置: ENABLED_NEWS_SOURCES        |   | - 格式清洗与安全 JSON 解析   |  |
|  +------------------------------------------+   +------------------------------+  |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | 数据持久化层 (Prisma ORM + PostgreSQL / Vercel Postgres / Neon)             |  |
|  | - Stock (新增 isActive, isCustom)   - Article (扩展 Source 枚举)            |  |
|  | - NewsCluster (智能聚合与摘要)       - ClusterArticle (多对多关联)           |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

### 2.2 核心模块职责划分

| 模块名称 | 文件路径 | 核心职责 |
|---|---|---|
| **通用 LLM 适配器** | `lib/llm/client.ts` | 统一封装 OpenAI 规范的 Chat Completions，提供超时重试、大模型输出清洗与容错解析、向下兼容旧版 DeepSeek 配置 |
| **流水线摘要与过滤** | `lib/pipeline/summarize.ts` | 依托通用 LLM 客户端，实现股票相关度判定（Filter）与新闻聚簇事实摘要生成（Summarize） |
| **可插拔资讯源架构** | `lib/sources/` | 定义 `SourceAdapter` 统一契约，实现东方财富（EastMoney）、财联社（CLS）等适配器，并通过注册中心与环境变量开关动态加载 |
| **流水线抓取调度** | `lib/pipeline/fetch-all.ts` | 动态从数据库读取启用的自选股与启用的资讯源，分批并发抓取、聚合去重与持久化 |
| **自选股数据库模型** | `prisma/schema.prisma` | 扩充 `Stock` 表属性（`isActive`, `isCustom`, `createdAt`），扩展 `Source` 枚举 |
| **自选股管理 API** | `app/api/stocks/route.ts` | 提供自选股的列表查询、新增、修改、逻辑启停及删除功能，附带数据有效性校验与防重检测 |
| **自选股数据初始化** | `lib/stocks-seed.ts` | 首次运行或检测到无数据时，将经典蓝筹和指数作为种子平滑灌入数据库 |
| **前端自选股管理 UI** | `components/StockManagerModal.tsx` | 提供友好的弹窗/抽屉管理面板，支持实时新增标的、开关启停、删除及分类切换 |
| **Hermes 专用 REST API** | `app/api/v1/hermes/*` | 面向智能体（Hermes）的标准 API，统一 Bearer Token 校验，输出符合投研要求的新闻与标的详情 |

---

## 3. 模块具体设计方案

### 3.1 通用 LLM 适配层（`lib/llm/client.ts`）

#### 3.1.1 环境变量规范
统一遵循标准化环境变量规范，并提供对遗留 `DEEPSEEK_API_KEY` 的向下兼容：

```bash
# 通用 LLM 配置
LLM_BASE_URL="https://api.openai.com/v1"      # 兼容端点 Base URL，如 https://api.deepseek.com/v1, http://localhost:11434/v1
LLM_API_KEY="sk-xxxxxxxxxxxxxxxxxxxxxxxx"     # API 密钥
LLM_MODEL="deepseek-chat"                     # 模型名称 (如 gpt-4o-mini, deepseek-chat, qwen-2.5-72b-instruct 等)
LLM_TEMPERATURE="0.2"                         # 采样温度，默认为 0.2 (财经分析建议低温)
LLM_MAX_TOKENS="800"                          # 单次请求最大返回 Token 限制
LLM_TIMEOUT_MS="20000"                        # 单次请求超时时间 (毫秒)，默认 20000 (20s)
LLM_MAX_RETRIES="3"                           # 失败重试次数，默认 3 次

# 兼容性降级配置（若未配置 LLM_API_KEY 时生效）
DEEPSEEK_API_KEY=""                           # 存在时自动映射为 BASE_URL=https://api.deepseek.com, MODEL=deepseek-chat
```

#### 3.1.2 客户端核心设计规范
1. **标准化请求构建**：
   - 使用标准 fetch 构造 POST 到 `${LLM_BASE_URL.replace(/\/$/, '')}/chat/completions`。
   - 请求头统一携带 `Authorization: Bearer ${LLM_API_KEY}` 和 `Content-Type: application/json`。
2. **超时与重试（Exponential Backoff with Jitter）**：
   - 使用 `AbortController` 绑定 `LLM_TIMEOUT_MS`，超时抛出规范的 `TimeoutError`。
   - 针对 HTTP 429（限流）、500、502、503、504 及网络抛错进行自动重试。
   - 重试间隔公式：`backoffMs = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 300, 8000)`。
3. **输出清洗与 JSON 解析器**：
   - 大模型常见输出包括：带 ```json ``` 代码块包裹、混杂思考过程 `<think>...</think>`（如 DeepSeek-R1）、首尾包含闲聊文字。
   - 针对结构化提取，实现两套提取逻辑：
     - `extractJsonObject<T>(rawText: string): T | null`
     - `extractJsonArray<T>(rawText: string): T[] | null`
   - 清洗管道：先剔除 `<think>[\s\S]*?<\/think>`，再匹配最外层 `{[\s\S]*}` 或 `\[[\s\S]*\]`，最后进行 `JSON.parse`。若解析失败尝试修复多余末尾逗号等通用语法缺陷。
4. **优雅降级（Graceful Degradation）**：
   - 当未配置任何 LLM Key，或重试耗尽仍然失败时，`filterRelevantArticles` 降级为全量保留，`summarizeArticles` 返回 `null`，确保抓取主流水线继续运行，不中断新闻入库。

---

### 3.2 国内资讯源与插件架构

#### 3.2.1 架构接口契约（`lib/sources/types.ts`）

扩展后的数据源类型与接口契约：

```typescript
export type SourceType =
  | "finnhub"
  | "googlenews"
  | "yahoo"
  | "eastmoney"
  | "cls"
  | "sina";

export interface RawArticle {
  title: string;
  snippet: string;
  url: string;
  source: SourceType;
  publishedAt: Date;
  stockId: number;
}

export interface FetchNewsParams {
  symbol: string;
  name: string;
  nameCn: string;
  market: "US" | "HK" | "CN" | "INDEX";
  stockId: number;
}

export interface SourceAdapter {
  id: SourceType;
  name: string;
  /**
   * 是否支持特定市场 (如 EastMoney/CLS 主要支持 CN/HK/INDEX，GoogleNews 支持全部)
   */
  supportsMarket(market: string): boolean;
  fetch(params: FetchNewsParams): Promise<RawArticle[]>;
}
```

#### 3.2.2 国内资讯源实现设计

1. **东方财富适配器（`lib/sources/eastmoney.ts`）**：
   - **数据定位**：支持 A 股、港股的个股公告、新闻与 7x24 快讯。
   - **数据抓取机制**：
     - 使用东方财富开放快讯 HTTP API，例如：
       `https://np-listapi.eastmoney.com/comm/web/getFastNewsList?client=web&biz=web_724&pageSize=20`
     - 或东方财富个股新闻搜索 API：
       `https://search-api-web.eastmoney.com/search/json?cb=&param={"keyword":"${nameCn}","pageIndex":1,"pageSize":10,"type":"cmsArticleWebOld"}`
     - 备用：基于东方财富 RSS 或网页正文抓取提取。
   - **内容清洗**：提取标题、富文本摘要（去除 HTML 标签），将时间戳（如毫秒或 YYYY-MM-DD HH:mm:ss）转为标准 `Date` 对象。
2. **财联社适配器（`lib/sources/cls.ts`） / 新浪财经适配器（`lib/sources/sina.ts`）**：
   - **财联社（CLS）**：
     - 数据定位：国内最具影响力的财经即时电报快讯（7x24 电报）。
     - 请求端点：`https://www.cls.cn/api/sw?app=CRApi&os=web&sv=8.4.0&type=telegram&keyword=${encodeURIComponent(nameCn)}`。
     - 若关键词为空，抓取最新电报并利用标题与内容中的股票名进行模糊匹配。
   - **新浪财经（Sina Finance）**：
     - 数据端点：`https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2509&k=${encodeURIComponent(nameCn)}&num=15`。
     - 备用行情新闻：针对 A 股和港股提供稳定支持。
3. **插件注册与开关机制（`lib/sources/index.ts`）**：
   - 环境变量开关：`ENABLED_NEWS_SOURCES="googlenews,yahoo,finnhub,eastmoney,cls"`。
   - 若环境变量未配置，默认开启全部已注册的数据源。
   - 提供 `getActiveAdapters(market?: string): SourceAdapter[]`，根据当前股票所属市场与激活配置动态路由。单个源报错自动捕获记录，不影响其余源。

#### 3.2.3 Prisma Schema 枚举演进
在 `prisma/schema.prisma` 中更新 `Source` 枚举：
```prisma
enum Source {
  finnhub
  googlenews
  yahoo
  eastmoney
  cls
  sina
}
```

---

### 3.3 自选股动态化（Prisma + CRUD API + 前端管理 UI）

#### 3.3.1 Prisma Schema 变更设计
更新 `model Stock`，引入动态标识与时间追踪：

```prisma
model Stock {
  id         Int       @id @default(autoincrement())
  symbol     String    @unique
  name       String
  nameCn     String    @map("name_cn")
  market     Market
  price      Float?
  changePct  Float?    @map("change_pct")
  updatedAt  DateTime? @map("updated_at")
  isActive   Boolean   @default(true) @map("is_active")     // 是否参与调度抓取与展示
  isCustom   Boolean   @default(false) @map("is_custom")   // 是否为用户自定义添加（非系统预置种子）
  createdAt  DateTime  @default(now()) @map("created_at")

  articles   Article[]

  @@index([isActive])
  @@index([market])
}
```

#### 3.3.2 自动 Seed 机制（`lib/stocks-seed.ts`）
- 保持系统开箱即用：应用在启动、查询自选股或执行抓取前，若检测到 `Stock` 表记录数为 0，则自动执行 `seedInitialStocks()`。
- 将原本静态 `TRACKED_STOCKS` 数组作为种子数据批量 `upsert`，默认设置 `isActive: true, isCustom: false`。

#### 3.3.3 自选股 CRUD API 规范（`app/api/stocks/route.ts` & `/api/stocks/[id]/route.ts`）

1. **GET `/api/stocks`**：
   - **请求参数**：
     - `all=true`：查询所有自选股（包括已停用的）；默认 `false` 只返回 `isActive: true`。
     - `market=US|HK|CN|INDEX`：按市场筛选。
   - **响应格式**：
     ```json
     {
       "stocks": [
         {
           "id": 1,
           "symbol": "AAPL",
           "name": "Apple",
           "nameCn": "苹果",
           "market": "US",
           "price": 220.5,
           "changePct": 1.25,
           "isActive": true,
           "isCustom": false,
           "updatedAt": "2026-09-11T08:00:00.000Z"
         }
       ]
     }
     ```
2. **POST `/api/stocks`**：
   - **请求 Body**：
     ```json
     {
       "symbol": "BABA",
       "name": "Alibaba",
       "nameCn": "阿里巴巴",
       "market": "US"
     }
     ```
   - **校验规则**：
     - `symbol` 非空，字母/数字/点/中划线，统一去除首尾空格并转换为大写（除后缀外标准格式）。
     - `nameCn` 非空，字符串长度 1~30。
     - `market` 必须为 `US` | `HK` | `CN` | `INDEX`。
     - 查重检测：`symbol` 存在时返回 409 Conflict（若已存在且为非激活状态，返回提示或支持重新激活）。
   - **状态码**：201 Created，返回创建的实体。
3. **PATCH `/api/stocks/[id]`**：
   - 支持更新 `isActive` 状态（启停调度）、更新 `name` / `nameCn`。
4. **DELETE `/api/stocks/[id]`**：
   - **删除策略**：
     - 若该股票已关联大量历史文章，提供物理删除（级联删除文章/聚簇）或逻辑删除（`isActive = false`）。
     - 默认支持 DELETE 直接删除该股票及其关联的未聚簇孤立文章（利用 Prisma `onDelete: Cascade`）。

#### 3.3.4 前端自选股管理 UI 设计（`components/StockManagerModal.tsx`）
- **触发入口**：在主页面头部或 Ticker 栏右侧增加「⚙️ 管理自选」按钮。
- **界面结构**：
  - **顶部**：快速添加表单（代码输入框、中文简称、英文名、市场选择下拉框、[+ 添加] 按钮）。
  - **中部**：自选股列表表格，包含列：代码、中文名称、市场标签、最新价格、监控状态开关（Toggle Switch）、操作（删除按钮）。
  - **状态联动**：添加或删除、启停自选股后，自动通知主页面刷新 TickerStrip、NewsFeed 与 MarketOverview，无需整页刷新。

---

### 3.4 Hermes REST API 与集成规范

#### 3.4.1 安全鉴权机制
- **环境变量**：`HERMES_API_KEY="hermes-secret-key-token"`。
- **鉴权规则**：
  - 检查 HTTP 请求头 `Authorization: Bearer <HERMES_API_KEY>`。
  - 缺少 Header 或 Key 不匹配时，返回统一错误：`HTTP 401 Unauthorized`：
    ```json
    {
      "code": 401,
      "message": "Unauthorized: invalid or missing HERMES_API_KEY",
      "data": null
    }
    ```

#### 3.4.2 路由规范与接口设计

统一路径前缀：`/api/v1/hermes/`

##### 接口 1: 获取智能聚合新闻流
- **URL**: `GET /api/v1/hermes/news`
- **查询参数**：
  - `symbol` (可选): 如 `NVDA`，按单只股票筛选。
  - `market` (可选): `US` | `HK` | `CN` | `INDEX`。
  - `verified` (可选): `true` | `false`，是否仅包含多源核验的新闻。
  - `limit` (可选): 默认 20，最大 100。
  - `cursor` (可选): 分页游标。
  - `days` (可选): 限制最近 N 天，默认 3。
- **响应示例**：
  ```json
  {
    "code": 0,
    "message": "success",
    "data": {
      "items": [
        {
          "id": 1024,
          "title": "英伟达发布新一代Blackwell芯片，算力性能提升30倍",
          "aiSummary": "英伟达在年度GTC大会正式公布Blackwell架构GPU，预计下半年大规模出货，多家云巨头已下达大额订单。",
          "keyPoints": [
            "新架构在百亿级大模型推理任务中能耗显著下降",
            "微软、亚马逊、谷歌将作为首批部署客户",
            "管理层预期数据中心营收维持高复合增长"
          ],
          "verificationStatus": "verified",
          "sourceCount": 3,
          "publishedAt": "2026-09-11T07:30:00.000Z",
          "stock": {
            "symbol": "NVDA",
            "name": "NVIDIA",
            "nameCn": "英伟达",
            "market": "US",
            "price": 125.8,
            "changePct": 3.42
          },
          "sources": [
            { "name": "EastMoney", "title": "...", "url": "https://..." },
            { "name": "GoogleNews", "title": "...", "url": "https://..." }
          ]
        }
      ],
      "nextCursor": "1023",
      "hasMore": true
    },
    "meta": {
      "totalActiveStocks": 16,
      "serverTime": "2026-09-11T08:15:00.000Z"
    }
  }
  ```

##### 接口 2: 获取受监控自选股标的与市场状态
- **URL**: `GET /api/v1/hermes/stocks`
- **查询参数**：`activeOnly=true|false`
- **响应格式**：返回受监控股票的实时快照、最新涨跌幅以及最新关联新闻摘要。

##### 接口 3: 触发实时增量抓取分析（Agent 驱动任务）
- **URL**: `POST /api/v1/hermes/trigger-fetch`
- **请求体**：
  ```json
  {
    "symbol": "NVDA",      // 可选，指定仅抓取某个标的；不传则抓取当前活跃批次
    "skipAi": false        // 是否跳过 AI 摘要生成（用于快速入库）
  }
  ```
- **响应格式**：返回抓取和聚类统计信息（`articlesFetched`, `clustersCreated`, `elapsedMs`）。

---

## 4. 质量门禁检查与自检（QG-ARCH-001）

依照系统架构师质量门禁标准（QG-ARCH-001）进行逐项检视：

| 门禁维度 | 检视要求 | 评估结果 | 架构实现支撑说明 |
|---|---|---|---|
| **Topology (拓扑清晰)** | 系统拓扑完整，服务间数据流转清晰，依赖关系闭环 | ✅ **通过** | 绘制了清晰的客户端、服务端、适配层、流水线引擎与数据库拓扑图，标明通信协议与认证边界 |
| **Interface (接口完整)** | 接口签名明确，包含路径、方法、参数、状态码与响应体 | ✅ **通过** | 详细定义了 `/api/stocks` CRUD、`/api/v1/hermes/*` 接口契约，以及 `SourceAdapter` 和通用 LLM 的 TypeScript 接口签名 |
| **Selection (技术选型)** | 选型有充分客观事实支撑，考虑向前向后兼容性 | ✅ **通过** | 选型遵循 OpenAI 开放协议、Prisma Schema 渐进迁移、东方财富/财联社国内源以及标准 Bearer Auth，详见 ADR-101 |
| **Tech Spec (规范明确)** | 环境变量规范、降级策略、容错重试与异常处理详尽 | ✅ **通过** | 明确规定了 `LLM_*` 系列环境变量、指数退避重试算法、清洗解析流程与无配置降级运行方案 |

---

## 5. Hermes 集成规范文档大纲（供后续生成与提供给使用方）

该大纲将落实为 `docs/hermes-api.md`：
1. **认证与授权**：
   - 密钥获取与配置（`HERMES_API_KEY`）
   - HTTP 请求头设置规范：`Authorization: Bearer <token>`
   - 错误代码对照表（401 Unauthorized, 403 Forbidden, 429 Too Many Requests, 500 Server Error）
2. **端点参考指南**：
   - `GET /api/v1/hermes/news`：参数说明、返回字段含义（`aiSummary` 与 `keyPoints` 最佳解析建议）
   - `GET /api/v1/hermes/stocks`：获取股票池元数据
   - `POST /api/v1/hermes/trigger-fetch`：按需驱动数据采集
3. **Hermes Python / TypeScript Agent 调用示例**：
   - 基于 `requests` / `httpx` 的 Python 示例代码
   - 基于 Node.js `fetch` 的 TypeScript 示例代码
4. **最佳实践**：
   - 轮询策略与 Webhook 规划
   - 结合 Hermes 自身 LLM 进行二次投资研报生成与事件驱动预警
