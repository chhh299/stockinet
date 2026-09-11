# ADR-101: stock-news-upgrade 架构演进与关键技术选型

## 状态
**已接受**

## 背景
现有 `stock-news-app` 存在以下架构局限：
1. **LLM绑定单一**：硬编码调用 `api.deepseek.com`，无法自由切换至其他 OpenAI 兼容的本地或云端大模型（如 Ollama、OneAPI、Qwen、Claude proxy、GLM等）。
2. **资讯源覆盖不均**：主要依赖海外及聚合源（Finnhub, Google News RSS, Yahoo Finance），对 A 股、港股的中文权威快讯（东方财富、财联社、新浪财经）缺乏原生直接覆盖。
3. **股票池静态写死**：标的写死在 `TRACKED_STOCKS` 静态数组中，无法通过 UI 或 API 动态添加、删除或启停自选股。
4. **外部集成能力缺失**：外部自动化 Agent（如 Hermes 智能投研助手）缺乏结构化、有鉴权、高内聚的 REST API 与接口规范进行自动化调用。

## 决策

1. **通用 LLM 抽象层（`lib/llm/client.ts`）**：
   - 统一遵循 OpenAI Chat Completions 规范。
   - 环境变量以 `LLM_BASE_URL`、`LLM_API_KEY`、`LLM_MODEL`、`LLM_TEMPERATURE`、`LLM_TIMEOUT_MS` 为核心标准，兼容旧版 `DEEPSEEK_API_KEY` 作为优雅降级。
   - 实现指数退避重试（Exponential Backoff）、流式/超时控制（AbortController）及健壮的 JSON/Markdown 清洗解析器。

2. **可插拔多源适配器架构（`lib/sources/*`）**：
   - 保留规范化接口 `NewsFetcher` 与统一数据结构 `RawArticle`。
   - 扩展 Prisma Schema `Source` 枚举：增加 `eastmoney`（东方财富7x24快讯/个股资讯）与 `cls`（财联社电报快讯）/ `sina`（新浪财经）。
   - 引入动态插件注册表与开关控制 `ENABLED_NEWS_SOURCES`（逗号分隔），默认启用全源，按需启停，网络失败时优雅降级并记录错误，不阻断主流程。

3. **自选股动态化（Prisma + CRUD API + 前端管理 UI）**：
   - Prisma 模型 `Stock` 增加字段：`isActive: Boolean @default(true)`、`isCustom: Boolean @default(false)`、`createdAt: DateTime @default(now())`。
   - 提供 `/api/stocks`（GET 查询全部/活跃股票，POST 新增自选股，DELETE/PATCH 停用或删除）。
   - 数据库初始化与平滑迁移：服务启动或首次运行检测时，自动以 `TRACKED_STOCKS` 作为 Seed 种子保证系统开箱即用。
   - 前端管理 UI：新增自选股管理抽屉/弹窗组件（StockManagerModal），支持快速添加代码、名称、市场分类以及启停自选股，与主面板热点联动。

4. **Hermes 专用标准 REST API（`/api/v1/hermes/*`）**：
   - 路由命名空间：`/api/v1/hermes/news`（获取结构化新闻与研报摘要）、`/api/v1/hermes/stocks`（自选股与行情状态）、`/api/v1/hermes/trigger-fetch`（外部触发增量抓取）。
   - 安全鉴权：全量接入 `Authorization: Bearer <HERMES_API_KEY>` 请求头校验，统一错误处理（401/403/422/500）。
   - 响应结构：标准化为 `{ code: 0, message: "ok", data: T, meta: { ... } }`，提供详尽的集成契约与 OpenAPI/Markdown 文档。

## 理由
- **通用性**：解耦供应商，适应私有化部署、高性价比模型与企业网关。
- **扩展性**：国内高频财经快讯源大幅降低 A/港股延迟与漏报。
- **灵活性**：自选股动态管理满足投研人员自主监控需求。
- **开放性**：Hermes 协议为多智能体金融分析工作流奠定底层数据基础设施。

## 后果
- **正面**：
  - 支持任意兼容 OpenAI 的模型；
  - 增强中文金融资讯质量与时效；
  - 动态自选股与行情抓取无缝衔接；
  - Hermes 接入清晰可信。
- **负面**：
  - 爬虫类资讯源（东方财富、新浪、财联社）需做好反爬策略与 Fallback 处理；
  - Prisma Schema 变更需执行 `prisma db push` / 重新生成 client；
  - 内存与 API 调用需要做好并发控制。

## 实施步骤
1. 编写技术规范设计文档与接口契约；
2. 演进 Prisma Schema 并更新数据迁移机制；
3. 构建 `lib/llm/client.ts` 通用客户端；
4. 实现国内源适配器（`lib/sources/eastmoney.ts`、`lib/sources/cls.ts` 等）；
5. 实现 `/api/stocks` CRUD 与前端自选股管理弹窗；
6. 实现 `/api/v1/hermes/*` 鉴权与业务路由；
7. 输出 Hermes 集成指南与使用示例。
