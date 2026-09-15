<div align="center">

# 📈 Stock News App

**AI 驱动的全球股市新闻聚合与投研智能体 · AI-powered Global Stock News & Research Agent**

追踪美股、港股、A 股热点 — 多源并发抓取、中文金融语义去重、多源交叉核验、通用 LLM 结构化摘要、Hermes 智能体开放 API

Tracks US, Hong Kong, and A-share markets — multi-source parallel fetching, Chinese financial semantic dedup, cross-source verification, universal LLM summaries, and Hermes Agent REST APIs.

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

**Stock News App** 是一个全球股市新闻聚合与投研分析平台，专为中文投资者与 AI 智能体设计。系统自动从多个权威金融数据源拉取自选标的之最新公告、媒体研报与盘中异动，利用**中文金融语义算法（字符 2-gram + 关键动作词 + 编辑距离）**聚类去重，并接入**通用大语言模型（OpenAI 兼容协议）**生成客观的事实摘要与核心要点清单。

设计目标：**让普通投资者或智能体在 10 秒之内，对自选股发生的核心事件建立准确、多源核验、不被市场杂音带偏的认知。**

---

### 🎯 核心特性

- **🌍 全球多市场覆盖** — 深度覆盖 A 股（沪深主板/创业板/科创板）、港股、美股与核心市场指数。
- **📰 多源并发抓取矩阵**：
  - **A 股 / 港股**：东方财富官方资讯、同花顺个股深度动态、腾讯自选股官方公告、卖方券商研报、财联社电报、新浪财经。
  - **美股 / 指数**：Finnhub 公司新闻与报价、Google News RSS、Yahoo Finance v8。
- **🧠 中文金融语义聚类去重** — 借鉴专业投研算法，结合双字滑动窗口、金融关键动作词（业绩/回购/增持/立案等）与编辑距离，合并重复通稿，支持卡片内**一键展开查看全部多源报道视角**。
- **🔗 多源交叉核验** — 同一事件被 2 个及以上独立机构报道时自动标记为 `✅ 已核验 (N源)`，支持一键过滤杂音。
- **🤖 通用大模型适配支持** — 兼容任意符合 OpenAI 接口规范的大模型（如 DeepSeek、OpenAI、Gemini Proxy、Qwen、Ollama、OneAPI 等），具备智能补全 `/v1`、思维链 `<think>` 标签清洗、指数退避重试及无 Key 优雅降级能力。
- **📊 动态自选股管理** — 数据库持久化存储自选股池，内置东方财富官方证券代码联想接口，输入代码或名称自动补齐；支持前端一键增删、启停监控与全量清空。
- **📈 实时行情跑马灯** — 毫秒级接入腾讯财经行情源，页面实时呈现股价与符合国内习惯的标准**红涨绿跌**（平盘显示白色）。
- **🤖 Hermes 投研开放 API** — 命名空间 `/api/v1/hermes/*`，提供专为 Agent 上下文优化的结构化数据接口（带 Bearer 鉴权），配套 [`hermes-tool.json`](hermes-tool.json) 与 [`docs/hermes-api.md`](docs/hermes-api.md)。
- **⚡ Serverless 并发加速** — 所有标的与数据源全并发调度，消灭 N+1 查询黑洞，执行效率提升 10 倍，彻底规避 Vercel 超时限制。

---

### 🏗️ 技术架构

```text
┌─────────────────────────────────────────────────────────────┐
│  浏览器 UI (Next.js App Router · React 19 · Tailwind v4)    │
└──────────────┬──────────────────────┬───────────────────────┘
               │                      │
       /api/news │              /api/market │  /api/v1/hermes/* (Agent API)
               │                      │
┌──────────────▼──────────────────────▼───────────────────────┐
│              Pipeline 层 (lib/pipeline/*)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  fetch-all   │→ │    dedup     │→ │  summarize       │   │
│  │ 多源并发并行 │  │ 金融语义聚类 │  │ 通用 LLM 事实提炼│   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└──────────────┬──────────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────────┐
│   Prisma 7 + PostgreSQL (Vercel Postgres / Neon)            │
│   Stock · Article · NewsCluster · ClusterArticle            │
└──────────────────────────────────────────────────────────────┘
       ▲                  ▲                  ▲
       │                  │                  │
 东方财富/同花顺/腾讯    财联社/新浪财经    Finnhub/Google/Yahoo
```

---

### 🚀 快速上手

#### 1. 克隆与依赖安装

```bash
git clone https://github.com/<your-username>/stockinet.git
cd stockinet
npm install
```

#### 2. 配置环境变量

复制环境变量模板文件：
```bash
cp .env.example .env.local
```

打开 `.env.local` 填入您的专属配置（**千万不要把私有密钥提交到公开仓库**）：

| 变量名 | 必填 | 说明 |
|---|---|---|
| `DATABASE_URL` | ✅ 必填 | PostgreSQL 连接串（推荐使用 Vercel Postgres 或 Neon 免费云数据库） |
| `LLM_BASE_URL` | ⚪ 选填 | 大模型 API 地址（如 `https://api.deepseek.com/v1` 或各类代理地址） |
| `LLM_API_KEY` | ⚪ 选填 | 大模型 API 密钥（如 `sk-...`，未配置时系统跳过摘要生成，基础功能照常运行） |
| `LLM_MODEL` | ⚪ 选填 | 模型名称（如 `deepseek-chat`、`gpt-4o-mini` 或 `gemini-3.7-flash`） |
| `ENABLED_NEWS_SOURCES` | ⚪ 选填 | 启用的信源列表，逗号分隔，默认全开（`eastmoney,tencent,ths,cls,sina,googlenews,yahoo,finnhub,research`） |
| `HERMES_API_KEY` | ⚪ 选填 | Hermes Agent 开放接口鉴权 Token（未配置时默认开发模式放行） |
| `CRON_SECRET` | ⚪ 建议 | 定时任务密钥，保护 `/api/cron/fetch-news` |

#### 3. 初始化数据库

```bash
npx prisma db push
```

#### 4. 本地启动开发

```bash
npm run dev
```
打开浏览器访问 [http://localhost:3000](http://localhost:3000)。

---

### ☁️ 部署到 Vercel

1. 在 GitHub 创建您的仓库（建议设置为 **Private 私有仓库**）；
2. 登录 [Vercel](https://vercel.com/new) 导入此仓库，Framework Preset 自动识别为 **Next.js**；
3. 在 Vercel **Storage** 标签下一键创建免费的 **Neon / Postgres** 数据库，并关联到本项目（会自动注入 `DATABASE_URL`）；
4. 在项目的 **Settings → Environment Variables** 中配置您的 `LLM_BASE_URL` 与 `LLM_API_KEY`；
5. 点击 **Deploy**，系统将在 1 分钟内完成构建并分配线上域名。

---

### 🤖 Hermes 智能体接入规范

若需要在 Hermes 等 Agent 中作为 Tool 调用，请将项目根目录下的 [`hermes-tool.json`](hermes-tool.json) 导入您的智能体工具配置中。

- **获取聚合新闻**：
  ```http
  GET /api/v1/hermes/news?symbol=600726.SS&verified=true&limit=10
  Authorization: Bearer <HERMES_API_KEY>
  ```
- **获取自选股池与实时行情**：
  ```http
  GET /api/v1/hermes/stocks?activeOnly=true
  Authorization: Bearer <HERMES_API_KEY>
  ```
- **添加监控标的**：
  ```http
  POST /api/v1/hermes/stocks
  Content-Type: application/json
  Authorization: Bearer <HERMES_API_KEY>

  {"symbol": "002201.SZ", "nameCn": "九鼎新材", "market": "CN"}
  ```
- **按需触发采集**：
  ```http
  POST /api/v1/hermes/trigger-fetch
  ```

详细调用规范请阅读完整的开发者指南：[`docs/hermes-api.md`](docs/hermes-api.md)。

---

### 📜 开源协议

本项目基于 [MIT License](LICENSE) 开源。

---

<a id="-english"></a>

## 🇬🇧 English

> [Back to Chinese ↑](#-简体中文)

### ✨ Overview

**Stock News App** is an AI-driven global stock news aggregation and research platform built for individual investors and automated agents. It fetches financial disclosures, broker reports, and market movements, applies **Chinese financial semantic deduplication (2-gram + action signals + sequence matcher)**, and leverages **universal OpenAI-compatible LLMs** to generate objective factual summaries.

### 🎯 Key Capabilities

- **Multi-Source Fetching Matrix**: Native support for EastMoney, Tonghuashun (THS), Tencent Finance, CLS, Sina Finance, Finnhub, Google News, and Yahoo Finance.
- **Semantic Event Clustering**: Merges syndicated press releases while providing expandable views for multi-angle reporting.
- **Universal LLM Integration**: Fully customizable `LLM_BASE_URL`, `LLM_API_KEY`, and `LLM_MODEL` with thinking tag stripping and automatic `/v1` endpoint resolution.
- **Dynamic Watchlist Management**: Modal UI and `/api/stocks` CRUD endpoints with instant official stock code autocompletion.
- **Hermes Agent Ready**: Production-grade RESTful APIs under `/api/v1/hermes/*` with Bearer token authentication and OpenAPI/Function Calling definitions in [`hermes-tool.json`](hermes-tool.json).
- **Zero Timeout Overhead**: Pure parallel execution avoiding Serverless execution timeouts.
