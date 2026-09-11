# 变更日志 (CHANGELOG)

所有对本项目的重要修改都会记录在此文件中。
版本规范遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

---

## [v0.2.0] - 2026-09-11 (stock-news-upgrade)

### 🌟 新增功能 (Features)

#### 1. 通用 LLM 适配器与多模型支持 (Universal OpenAI-Compatible LLM)
- **协议标准化**：基于 OpenAI Chat Completions 规范统一封装底层大模型交互，支持任意兼容端点（如 OpenAI、DeepSeek、Ollama、OneAPI、Qwen、Claude Proxy 等）。
- **环境变量化配置**：新增 `LLM_BASE_URL`、`LLM_API_KEY`、`LLM_MODEL`、`LLM_TEMPERATURE`、`LLM_TIMEOUT_MS` 等标准配置。
- **向下兼容与优雅降级**：无感兼容旧版 `DEEPSEEK_API_KEY`；当未配置任何大模型密钥时自动降级跳过摘要，不阻断主数据流。
- **稳健性增强**：集成指数退避重试（Exponential Backoff）、请求超时熔断、`<think>` 思考链标签清除与容错 JSON 解析。

#### 2. 国内权威资讯源与插件化架构 (Plug-and-Play News Sources)
- **新增国内源**：
  - **东方财富 (EastMoney)**：覆盖 A 股/港股 7x24 即时财经快讯与个股资讯。
  - **财联社 (CLS)**：覆盖全市场电报快讯。
  - **新浪财经 (Sina)**：多源聚合与行情热点资讯补充。
- **动态源开关**：支持通过环境变量 `ENABLED_NEWS_SOURCES`（逗号分隔）按需启闭任意资讯源。
- **单源故障隔离**：采用并发 `Promise.allSettled` 执行，单一源超时或失败不影响其他健康数据源。

#### 3. 动态自选股池与可视化管理 UI (Dynamic Stock Management)
- **数据库驱动**：Prisma 模型 `Stock` 新增 `isActive`（启停监控）、`isCustom`（自定义标识）及 `createdAt` 字段。
- **自选股 CRUD API**：提供 `/api/stocks` 及 `/api/stocks/[id]` 接口，支持标的查询、市场筛选、新增查重、更新启停和删除。
- **开箱即用自动 Seed**：首次运行或数据库为空时，自动以经典蓝筹标的作为种子平滑初始化数据库。
- **前端管理弹窗**：新增 `StockManagerModal` 组件，支持快速添加股票、即时切换监控状态、删除及跨组件联动刷新。

#### 4. Hermes 投研智能体开放 REST API (Hermes Agent Integration)
- **标准开放命名空间**：
  - `GET /api/v1/hermes/news`：获取结构化新闻流、AI 摘要、关键事实及多源核验信息。
  - `GET /api/v1/hermes/stocks`：获取受控标的实时价格与最新行情新闻简报。
  - `POST /api/v1/hermes/stocks`：通过 API 动态添加或重新激活监控标的。
  - `POST /api/v1/hermes/trigger-fetch`：按需触发即时增量数据抓取与聚类。
- **安全鉴权**：支持通过 `HERMES_API_KEY` 环境变量统一进行 `Bearer Token` 请求头校验。
- **完整规格与工具清单**：提供 `docs/hermes-api.md` 开发指南与 `hermes-tool.json` Agent Tool 声明。

### 🧪 测试与质量保障 (Testing & Quality)
- 新增全套自动化测试（25 个测试用例全部通过，耗时约 700ms）。
- 覆盖 LLM 客户端、多源适配器与故障隔离、自选股 CRUD、Hermes API 与鉴权全流程。
- 静态检查：TypeScript 编译零错误，ESLint 规范检查零告警。
- 架构制品：交付架构设计规范 `docs/superpowers/specs/stock-news-upgrade-design.md` 与决策记录 `ADR-101`。
