<div align="center">

# 📈 Stock News App

**AI 驱动的全球股市新闻聚合 · AI-powered global stock news aggregator**

追踪美股、港股、A 股热点 — 多源抓取（含中文新闻）、相似度去重、DeepSeek 中文摘要、Vercel Cron 每小时更新

Tracks US, Hong Kong, and A-share markets — multi-source fetching (incl. Chinese-language news), similarity dedup, DeepSeek Chinese summaries, hourly Vercel Cron refresh

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel)](https://vercel.com/)

**📖 语言 / Language:** [简体中文](#-简体中文) · [English](#-english)

</div>

---

<a id="-简体中文"></a>

## 🇨🇳 简体中文

> [跳转到 English ↓](#-english)

### ✨ 项目简介

**Stock News App** 是一个全球股市新闻聚合与摘要应用，专门针对中文读者优化。它会自动从多个新闻源抓取自选股相关新闻，按标题相似度聚类去重，并调用 DeepSeek 生成简短的中文要点摘要。整个系统部署在 Vercel + Vercel Postgres 的免费层，靠 Vercel Cron 自动维护数据新鲜度。

设计目标很简单：**让一个普通投资者在 30 秒之内，对自己持仓里发生了什么有一个准确、可核验、不被市场情绪带偏的认知。**

### 🎯 核心特性

- **🌍 多市场覆盖** — 美股（AAPL/NVDA/TSLA/BRK.B/MU/INTC/ASML/TSM/PLTR）、A 股（茅台 / 承德露露）、港股（腾讯 / 泡泡玛特），以及 S&P 500 / 纳斯达克 / 沪深 300 指数。
- **📰 多源并发抓取** — 支持 Finnhub、Google News RSS、Yahoo Finance，以及国内源**东方财富（EastMoney）**、**财联社（CLS）**与**新浪财经（Sina）**，最大化覆盖率与可核验性，支持配置开关按需启停。
- **🌐 中英双语新闻** — 港股 / A 股同时发起英文和中文（`zh-CN`）Google News 查询及国内本土快讯源抓取，补齐境内中文报道，结果自动去重合并。
- **🔗 多源核验** — 同一新闻被两个及以上独立源报道时标记为 ✅ 已核验，只看主流信息可一键过滤。
- **🤖 通用 OpenAI 兼容 LLM** — 支持任意兼容 OpenAI 规范的大模型（OpenAI、DeepSeek、Ollama、OneAPI、Qwen、Claude Proxy 等），通过环境变量动态配置模型端点与凭据。
- **🧠 AI 中文摘要与过滤** — 大模型对所有市场新闻进行相关性过滤并生成 1–2 句中文要点摘要与关键事实清单，附带指数退避重试与思考标签清洗。
- **📊 动态自选股管理** — 数据库驱动的自选股池，提供 `/api/stocks` CRUD 接口与前端可视化管理弹窗（可动态新增、启停、删除自选股）。
- **🤖 Hermes 投研开放 API** — 提供 `/api/v1/hermes/*` 规范 REST 接口（Bearer Token 鉴权），配套 OpenAPI/Hermes Agent Tool 描述（`hermes-tool.json`）与完整开发文档。
- **🔄 智能刷新** — 每天 UTC 0 点由 Vercel Cron 全量刷新；用户访问时若数据超过 65 分钟未更新，页面加载会自动触发懒刷新兜底。
- **🌙 暗色优先 UI** — Tailwind v4，移动端友好。

### 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│  浏览器 (Next.js App Router · React 19 · Tailwind v4)       │
└──────────────┬──────────────────────┬───────────────────────┘
               │                      │
       /api/news │              /api/market │  /api/cron/fetch-news
               │                      │           （Vercel Cron 触发）
┌──────────────▼──────────────────────▼───────────────────────┐
│              Pipeline 层 (lib/pipeline/*)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  fetch-all   │→ │    dedup     │→ │  summarize       │   │
│  │  三源并发抓取 │  │ 标题相似度聚类 │  │ DeepSeek 摘要+过滤 │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└──────────────┬──────────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────────┐
│   Prisma 7 + PostgreSQL (Vercel Postgres / Neon)            │
│   Stock · Article · NewsCluster · ClusterArticle            │
└──────────────────────────────────────────────────────────────┘
       ▲                  ▲                  ▲
       │                  │                  │
   Finnhub API    Google News RSS        Yahoo Finance v1/v8
                  (en-US + zh-CN)
```

**关键目录与文件**

| 路径 | 作用 |
|------|------|
| `app/`                       | Next.js App Router 页面 + API 路由 |
| `app/api/news/route.ts`       | 新闻列表 API（含懒刷新） |
| `app/api/market/route.ts`     | 自选股快照 API |
| `app/api/stocks/route.ts`     | 自选股增删查 API（支持按市场筛选与启停） |
| `app/api/v1/hermes/`          | Hermes 智能体专用 REST API（含 news / stocks / trigger-fetch） |
| `app/api/cron/fetch-news/`    | Vercel Cron 入口（Bearer 鉴权） |
| `lib/llm/client.ts`           | 通用 OpenAI 兼容 LLM 客户端（含超时、重试、标签清洗与降级容错） |
| `lib/sources/`                | 可插拔资讯源（finnhub / googlenews / yahoo / eastmoney / cls / sina） |
| `lib/pipeline/fetch-all.ts`   | 抓取-去重-入库主流水线 |
| `lib/pipeline/dedup.ts`       | 基于 Jaccard 词袋的标题相似度去重 |
| `lib/pipeline/summarize.ts`   | 大模型相关性过滤 + 中文要点事实摘要 |
| `lib/stocks-seed.ts`          | 自选股初始数据 Seed 种子机制 |
| `components/StockManagerModal.tsx` | 前端自选股可视化管理面板组件 |
| `docs/hermes-api.md`          | Hermes API 开放标准与集成指南 |
| `hermes-tool.json`            | Hermes / Agent Tool Function 声明契约 |
| `prisma/schema.prisma`        | 数据库模型（Stock / Article / NewsCluster / ClusterArticle） |

### 🚀 快速开始

#### 1. 克隆并安装依赖

```bash
git clone https://github.com/1708004874a-star/stock-news-app.git
cd stock-news-app
npm install
```

#### 2. 配置环境变量

复制环境变量模板并填入你自己的值：

```bash
cp .env.example .env.local
```

打开 `.env.local`，根据需要配置环境变量：

| 变量 | 必填 | 默认值 / 说明 |
|------|------|-------------|
| `DATABASE_URL`      | ✅ | Postgres 连接串，本地可用 Docker / 远程 Neon / Vercel Postgres |
| `LLM_BASE_URL`      | ⚪ | `https://api.openai.com/v1`（兼容 OpenAI 规范的任何端点） |
| `LLM_API_KEY`       | ⚪ | 大模型 API Key（留空则尝试回退 `DEEPSEEK_API_KEY`，均无时跳过 AI 摘要） |
| `LLM_MODEL`         | ⚪ | `gpt-4o-mini` 或 `deepseek-chat` 等 |
| `DEEPSEEK_API_KEY`  | ⚪ | 兼容旧版配置（若未配 `LLM_API_KEY`，自动映射为 DeepSeek） |
| `ENABLED_NEWS_SOURCES` | ⚪ | 启用的资讯源列表，逗号分隔（`googlenews,yahoo,finnhub,eastmoney,cls,sina`） |
| `FINNHUB_API_KEY`   | ⚪ | [Finnhub 免费 key](https://finnhub.io/register)，用于美股行情与新闻 |
| `HERMES_API_KEY`    | ⚪ | Hermes Agent REST 接口鉴权密钥（未配置时本地开发放行） |
| `CRON_SECRET`       | ✅ | 任意随机字符串，保护 cron 定时调度端点 |

> ⚠️ **不要把 `.env.local` 提交到 git** — 已通过 `.gitignore` 屏蔽。

#### 3. 初始化数据库

```bash
npx prisma db push
```

这会把 `prisma/schema.prisma` 里的表结构推送到你的 Postgres 实例。

#### 4. 本地运行

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)。第一次打开会触发一次懒抓取，几秒后页面上会出现新闻。

#### 5. 手动触发一次全量抓取（可选）

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
     "http://localhost:3000/api/cron/fetch-news?batch=0"
```

`batch` 参数循环 0…N-1 可以遍历所有自选股（单次 Vercel 函数 10 秒上限内只跑一小批）。

### ☁️ 部署到 Vercel

1. 在 [Vercel](https://vercel.com/new) 导入这个仓库。
2. 在项目 **Settings → Environment Variables** 里加入 `DATABASE_URL` / `FINNHUB_API_KEY` / `DEEPSEEK_API_KEY` / `CRON_SECRET`（三个环境都加）。
3. 给项目挂上 **Vercel Postgres** 或 **Neon**，会自动注入 `DATABASE_URL`。
4. 部署。`vercel.json` 已定义每日 UTC 0 点触发的 cron：

   ```json
   {
     "crons": [
       { "path": "/api/cron/fetch-news", "schedule": "0 0 * * *" }
     ]
   }
   ```

   Vercel Cron 会自动以 `Authorization: Bearer $CRON_SECRET` 调用该端点。

> 💡 **白嫖小贴士**：Vercel Hobby 限制每日只能有一次 Cron 触发、`pg` 连接数上限为 1、函数执行时长 10 秒。本项目默认 `BATCH_SIZE=2`、`pg pool max=1`，并在用户访问时通过懒刷新（超过 65 分钟未更新自动补刷）弥补单次 Cron 的覆盖不足。API 响应已加 `Cache-Control: s-maxage=300` 降低数据库压力。如需更高频率的 Cron，升级至 Pro 套餐即可。

### 📝 自选股动态管理 (Web UI & API)

系统现已由数据库全面驱动自选股监控池：
1. **页面可视化管理**：点击主页导航栏右侧的「⚙️ 管理自选」，可在弹窗中即时添加新标的（支持美股、港股、A股、指数）、切换监控开关、删除标的。
2. **REST API 管理**：
   - `GET /api/stocks`：获取自选股（支持 `?all=true` 及 `?market=CN` 过滤）。
   - `POST /api/stocks`：添加自选股。
   - `PATCH /api/stocks/[id]`：启停或重命名标的。
   - `DELETE /api/stocks/[id]`：移除自选股。
3. **种子预置机制**：首次启动若数据库为空，会自动加载 `lib/stocks.ts` 中的预置股票池进行初始化（开箱即用）。

### 🤖 Hermes 开放 API 与 Agent 集成

面向自动化智能体（如 Hermes、投研 Agent）提供开放接口：
- **认证**：通过 HTTP 请求头 `Authorization: Bearer <HERMES_API_KEY>` 校验。
- **接口文档**：详见 [`docs/hermes-api.md`](docs/hermes-api.md)。
- **Tool 契约**：工具声明定义文件位于 [`hermes-tool.json`](hermes-tool.json)，可直接导入 Agent 框架。
- **端点清单**：
  - `GET /api/v1/hermes/news`：结构化聚合新闻与 AI 事实摘要
  - `GET /api/v1/hermes/stocks`：自选监控池与实时行情快照
  - `POST /api/v1/hermes/stocks`：动态添加标的
  - `POST /api/v1/hermes/trigger-fetch`：按需触发增量抓取与分析

### 🔐 关于安全

- `.env.local`、`.env.vercel`、`.vercel/` 全部已被 `.gitignore` 排除，不会进入仓库。
- 代码里所有 API key 都从 `process.env` 读取，没有任何硬编码。
- cron 端点强制要求 `Authorization: Bearer $CRON_SECRET`，任何匿名请求返回 401。
- 如果你曾经把真实 key 泄露过 — **立刻去对应控制台 revoke 并重新生成**，仅靠 `git rm` 在历史里去掉是不够的。

### 🛣️ Roadmap

- [ ] 用户自选股（账号体系 + 个人 watchlist）
- [ ] 推送通知（Telegram / 飞书 webhook）
- [ ] 情绪打分 + 历史趋势图
- [ ] 更多数据源（彭博 / 路透 / 财联社）
- [ ] 多语言摘要（en / zh-TW）

### 📜 许可证

MIT — 详见 `LICENSE`。

### 🙏 致谢

- [Finnhub](https://finnhub.io/) — 公司新闻 + 实时行情
- [Google News RSS](https://news.google.com/) — 通用新闻
- [Yahoo Finance](https://finance.yahoo.com/) — 行情兜底
- [DeepSeek](https://platform.deepseek.com/) — 高性价比的中文摘要 LLM
- [Vercel](https://vercel.com/) — 部署 / Postgres / Cron 一站式

---

<a id="-english"></a>

## 🇬🇧 English

> [回到中文 ↑](#-简体中文)

### ✨ Overview

**Stock News App** is a global-market news aggregator and summarizer, optimized for Chinese-speaking readers. It pulls news for a curated watchlist from multiple sources, clusters near-duplicate stories by title similarity, and uses DeepSeek to produce concise Chinese-language summaries with bullet-point facts. The whole stack runs on Vercel + Vercel Postgres free tier, kept fresh by Vercel Cron.

The product goal is simple: **let a regular retail investor understand, in under 30 seconds, what's actually happening in their portfolio — accurately, with cross-source verification, and without market-sentiment noise.**

### 🎯 Features

- **🌍 Multi-market coverage** — US (AAPL/NVDA/TSLA/BRK.B/MU/INTC/ASML/TSM/PLTR), A-share (Moutai, Chengde Lolo), HK (Tencent, Pop Mart), plus S&P 500 / NASDAQ / CSI 300 indices.
- **📰 Multi-source parallel fetching** — Finnhub, Google News RSS, and Yahoo Finance, plus domestic Chinese adapters **EastMoney**, **CLS (Cailian)**, and **Sina Finance**, maximizing coverage with switchable source controls.
- **🌐 Bilingual news for CN/HK** — Google News is queried in both English and Chinese (`zh-CN`) alongside domestic Chinese financial news adapters, surfacing high-value domestic coverage.
- **🔗 Cross-source verification** — Stories reported by two or more independent sources get a ✅ Verified badge; a single-tap filter narrows the feed to verified only.
- **🤖 Universal OpenAI-compatible LLM** — Drop-in support for any OpenAI-compatible LLM endpoint (OpenAI, DeepSeek, Ollama, OneAPI, Qwen, Claude proxy, etc.) configured via environment variables.
- **🧠 AI relevance filter & Chinese summaries** — LLM removes ticker-collision noise, generic chatter, and generates 1–2 sentence Chinese summaries with bullet-point facts, featuring exponential backoff retries and think-tag stripping.
- **📊 Dynamic watchlist management** — Database-driven tracking pool with `/api/stocks` CRUD APIs and an intuitive modal UI to add, toggle, and remove tickers on the fly.
- **🤖 Hermes Agent REST API** — Dedicated `/api/v1/hermes/*` endpoints secured via Bearer Token auth, accompanied by `docs/hermes-api.md` and standard `hermes-tool.json` Agent tool definitions.
- **🔄 Smart refresh** — A Vercel Cron runs daily at 00:00 UTC, complemented by lazy background refreshes (if older than 65 minutes).
- **🌙 Dark-first UI** — Tailwind v4, mobile-friendly.

### 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (Next.js App Router · React 19 · Tailwind v4)      │
└──────────────┬──────────────────────┬───────────────────────┘
               │                      │
       /api/news │              /api/market │  /api/cron/fetch-news
               │                      │           (triggered by Vercel Cron)
┌──────────────▼──────────────────────▼───────────────────────┐
│                Pipeline layer (lib/pipeline/*)              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  fetch-all   │→ │    dedup     │→ │  summarize       │   │
│  │ parallel pull│  │ title-jaccard│  │ DeepSeek filter+ │   │
│  │ 3 sources    │  │ clustering   │  │ Chinese summary  │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└──────────────┬──────────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────────┐
│   Prisma 7 + PostgreSQL (Vercel Postgres / Neon)            │
│   Stock · Article · NewsCluster · ClusterArticle            │
└──────────────────────────────────────────────────────────────┘
       ▲                  ▲                  ▲
       │                  │                  │
   Finnhub API    Google News RSS        Yahoo Finance v1/v8
                  (en-US + zh-CN)
```

**Key directories & files**

| Path | Purpose |
|------|---------|
| `app/`                       | Next.js App Router pages + API routes |
| `app/api/news/route.ts`       | News list API (with lazy refresh) |
| `app/api/market/route.ts`     | Watchlist snapshot API |
| `app/api/stocks/route.ts`     | Watchlist CRUD API (market filters, toggle active) |
| `app/api/v1/hermes/`          | Hermes Agent dedicated REST API (news / stocks / trigger-fetch) |
| `app/api/cron/fetch-news/`    | Vercel Cron entry (Bearer auth) |
| `lib/llm/client.ts`           | Universal OpenAI-compatible LLM client (retries, timeouts, parsing) |
| `lib/sources/`                | Source adapters (finnhub / googlenews / yahoo / eastmoney / cls / sina) |
| `lib/pipeline/fetch-all.ts`   | Fetch → cluster → persist orchestration |
| `lib/pipeline/dedup.ts`       | Bag-of-words Jaccard title similarity |
| `lib/pipeline/summarize.ts`   | LLM relevance filter + Chinese bullet-point summary |
| `lib/stocks-seed.ts`          | Watchlist auto-seeding mechanism |
| `components/StockManagerModal.tsx` | Front-end watchlist manager modal component |
| `docs/hermes-api.md`          | Hermes API integration & developer guide |
| `hermes-tool.json`            | Hermes / Agent Tool schema definition |
| `prisma/schema.prisma`        | Database models (Stock / Article / NewsCluster / ClusterArticle) |

### 🚀 Getting Started

#### 1. Clone & install

```bash
git clone https://github.com/1708004874a-star/stock-news-app.git
cd stock-news-app
npm install
```

#### 2. Configure environment

Copy the template and fill in your own values:

```bash
cp .env.example .env.local
```

Open `.env.local` and configure your environment variables:

| Variable | Required | Default / Description |
|----------|----------|-----------------------|
| `DATABASE_URL`      | ✅ | Postgres connection string (Docker, Neon, or Vercel Postgres) |
| `LLM_BASE_URL`      | ⚪ | `https://api.openai.com/v1` (Any OpenAI-compatible base URL) |
| `LLM_API_KEY`       | ⚪ | Universal LLM API key (falls back to `DEEPSEEK_API_KEY`) |
| `LLM_MODEL`         | ⚪ | Model ID (e.g. `gpt-4o-mini`, `deepseek-chat`) |
| `DEEPSEEK_API_KEY`  | ⚪ | Legacy fallback key for DeepSeek |
| `ENABLED_NEWS_SOURCES` | ⚪ | Comma-separated list (`googlenews,yahoo,finnhub,eastmoney,cls,sina`) |
| `FINNHUB_API_KEY`   | ⚪ | Free key from [Finnhub](https://finnhub.io/register) |
| `HERMES_API_KEY`    | ⚪ | Bearer token secret for Hermes Agent REST API |
| `CRON_SECRET`       | ✅ | Any random string protecting the cron endpoint |

> ⚠️ **Never commit `.env.local`** — it's already in `.gitignore`.

#### 3. Initialize the database

```bash
npx prisma db push
```

This pushes `prisma/schema.prisma` to your Postgres instance.

#### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The first hit triggers a lazy fetch — news will appear after a few seconds.

#### 5. Trigger a manual full refresh (optional)

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
     "http://localhost:3000/api/cron/fetch-news?batch=0"
```

Loop `batch` from 0 to N-1 to cover the full watchlist (small batches keep each call under Vercel's 10s function limit).

### ☁️ Deploy to Vercel

1. Import the repo from [Vercel](https://vercel.com/new).
2. Under **Settings → Environment Variables**, add `DATABASE_URL`, `FINNHUB_API_KEY`, `DEEPSEEK_API_KEY`, and `CRON_SECRET` for all three environments.
3. Attach **Vercel Postgres** or **Neon** — `DATABASE_URL` gets injected automatically.
4. Deploy. `vercel.json` defines a daily cron at 00:00 UTC:

   ```json
   {
     "crons": [
       { "path": "/api/cron/fetch-news", "schedule": "0 0 * * *" }
     ]
   }
   ```

   Vercel Cron calls the endpoint with `Authorization: Bearer $CRON_SECRET`.

> 💡 **Free-tier tips**: Vercel Hobby allows only one cron trigger per day and caps `pg` connections at 1 and function duration at 10s. The repo defaults to `BATCH_SIZE=2`, `pg pool max=1`. A 65-minute lazy-refresh fallback fires on page load to supplement the daily cron. API responses carry `Cache-Control: s-maxage=300` to reduce database load. Upgrade to Pro to unlock higher-frequency cron schedules.

### 📝 Dynamic Watchlist Management (Web UI & API)

The stock tracking pool is now completely database-driven:
1. **Interactive Web UI**: Click the **"⚙️ 管理自选" (Manage Watchlist)** button in the top navigation bar to open the management modal. You can add new symbols (US, HK, A-shares, indices), toggle active monitoring status, or delete custom tickers in real time.
2. **REST API Management**:
   - `GET /api/stocks`: Retrieve tracked stocks (supports `?all=true` and `?market=CN` filtering).
   - `POST /api/stocks`: Add a new tracked stock with deduplication checks.
   - `PATCH /api/stocks/[id]`: Toggle active status or update names.
   - `DELETE /api/stocks/[id]`: Remove a tracked stock and cascade cleanups.
3. **Auto-seeding**: On first run or empty database, default blue chips and indices from `lib/stocks.ts` are automatically seeded.

### 🤖 Hermes Open REST API & Agent Integration

Dedicated high-performance API for autonomous financial agents (such as Hermes):
- **Authentication**: Validated via HTTP Header `Authorization: Bearer <HERMES_API_KEY>`.
- **API Documentation**: Detailed guide at [`docs/hermes-api.md`](docs/hermes-api.md).
- **Tool Schema**: OpenAPI / Hermes Agent tool definitions provided in [`hermes-tool.json`](hermes-tool.json).
- **Endpoints**:
  - `GET /api/v1/hermes/news`: Clustered financial news with AI summaries & cross-verification badges.
  - `GET /api/v1/hermes/stocks`: Monitored stock pool with real-time price & latest headlines.
  - `POST /api/v1/hermes/stocks`: Dynamically add or reactivate monitored tickers.
  - `POST /api/v1/hermes/trigger-fetch`: Trigger immediate on-demand news fetching and AI analysis.

### 🔐 Security notes

- `.env.local`, `.env.vercel`, and `.vercel/` are all gitignored and never enter the repository.
- Every API key is read from `process.env` — no hardcoded secrets anywhere in the source.
- The cron endpoint requires `Authorization: Bearer $CRON_SECRET`; anonymous requests get a 401.
- If you ever leak a real key — **revoke it in the provider's console and rotate immediately**. Removing it from git history is not enough.

### 🛣️ Roadmap

- [ ] User accounts + per-user watchlist
- [ ] Push notifications (Telegram / Feishu webhook)
- [ ] Sentiment scoring + historical trend chart
- [ ] More sources (Bloomberg / Reuters / Cailian)
- [ ] Multi-language summaries (en / zh-TW)

### 📜 License

MIT — see `LICENSE`.

### 🙏 Acknowledgements

- [Finnhub](https://finnhub.io/) — company news + real-time quotes
- [Google News RSS](https://news.google.com/) — broad news coverage
- [Yahoo Finance](https://finance.yahoo.com/) — quote fallback
- [DeepSeek](https://platform.deepseek.com/) — cost-effective Chinese-summary LLM
- [Vercel](https://vercel.com/) — hosting / Postgres / Cron, all in one

---

<div align="center">

Made with ☕ and 🤖 — issues & PRs welcome

</div>

<!-- vercel auto deploy trigger -->
