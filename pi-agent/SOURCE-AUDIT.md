# 当前源码对照记录

## 基准与范围

- 第一事实来源：`D:\llm\pi`，`main`，提交 `898ab804050730e9dcefb4443875d5a932aa6a32`。
- 修改对象：本仓库学习文章、网页 MDX、下载版 Markdown 及相关示例/图示；不修改 pi 源码。
- Python 版本是 TypeScript 实现的教学改写，不是官方 Python SDK。
- 以函数/类型名定位实现；涉及行号的引用需要绑定上述提交，不能把旧版本行号当成当前事实。

## 核验状态

以下状态是进度记录，不代表尚未核验的章节已经正确。

| 内容 | 状态 |
|---|---|
| 源码精读 01–02：概览、架构 | 待核验 |
| 源码精读 03：Agent Loop | 已修正 TS/Python 网页及 Markdown；调度、网页构建及浏览器冒烟验证通过 |
| 源码精读 04：模型调用 | 已修正 TS/Python 网页及 Markdown；静态检查、网页构建及浏览器冒烟验证通过，未调用真实 provider |
| 源码精读 05：工具系统 | 待核验 |
| 源码精读 06–07：消息、事件 | 待核验 |
| 源码精读 08–10：上下文、压缩、会话 | 待核验 |
| 实战 01–07、配套代码 | 待核验 |
| skills SDK 参考与场景文档 | 待核验 |
| 图示、notebook、网页与下载版同步 | 03/04 共 9 组图示已同步；notebook 和其他章节图示待核验 |

## 已确认的差异

### Agent Loop

证据：`packages/agent/src/agent-loop.ts`、`agent.ts`、`README.md`。

- `stopReason` 不是唯一续跑条件；工具结果、steering、follow-up 和 `finishTurn` 都参与调度。
- `length` 且含工具调用时，不执行工具，使用 `failToolCallsFromTruncatedMessage` 生成错误结果；批次 `terminate: false`，允许模型重试。
- `shouldTerminateToolBatch` 使用非空批次的 `every`，不是任一工具结果 `terminate: true` 即停止。
- 工具批次终止只取消工具触发的续跑，不跳过消息队列或显式继续决定。
- 当前使用 `finishTurn`，不再使用 `shouldStopAfterTurn`；回调先于 `turn_end` 执行。
- `error` / `aborted` 也执行 `finishTurn` 收尾，但忽略其调度决定并硬退出。
- `prepareNextTurn` 只在已经选定下一轮时执行，位于后续 `turn_start` 之前；`prepareRequest` 在每次请求前执行，包括首轮。
- 当前用跨外层循环保留的 `lastCompletedTurn`，不是每次外层循环重置 `firstTurn`。
- `AgentContext` 包含消息与可执行工具；系统提示词、工具声明保存在 system 消息中。默认消息转换保留 system/user/assistant/toolResult 四种角色。
- `createContextSnapshot` 只浅拷贝数组；Agent 原始状态通过事件处理同步更新，不能说完全不受循环影响。
- 并行预检中拦截一个工具不自动拦截后续工具；执行与 after hook 可以并发，结果按调用顺序入历史。
- `StopReason` 当前还有 `pending` / `deferred`，不能把五个常见值视为完整类型；`endTurn` 不参与这个循环的控制流。

### 模型调用

证据：`packages/ai/src/index.ts`、`models.ts`、`types.ts`、`providers/anthropic.ts`、`providers/openai.ts`、`api/anthropic-messages.ts`、`api/lazy.ts`、`api/simple-options.ts`、`utils/overflow.ts`。

- 当前主入口是实例式 `Models`；旧全局注册表 API 在 compat 子路径，不应作为当前主流程介绍。
- Models 按 `model.provider` 查找 Provider，并处理上下文规范化和认证；Provider 再选择 API 实现，不能只讲按 `model.api` 查全局表。
- API 层接收 `TranscriptContext`，不是带独立 systemPrompt/tools 的旧上下文。公开 Models 方法仍接受便捷 Context。
- 内建 OpenAI 使用 Responses；Chat Completions 的工具结果格式不是所有 OpenAI 请求的格式。
- Anthropic 接受字符串或块数组，并非 content 必须是数组；实现用 SDK 发请求，再自行解析 SSE，不能解释成缺少 SDK。
- 非终止事件的 partial 是共享的可变对象，不是逐事件不可变快照；done/error 使用 message/error 字段。内容块事件可以交错。
- Anthropic 的 message_delta 更新状态，完整消费并验证流后才发送 done。
- 当前思考级别包含 max；AI 层 ThinkingLevel 不含 off，Agent 层包含。模型映射可选，预算模式和 effort 模式不能混为一谈。
- Models.streamSimple 与 Models.stream 分别分派，不是前者统一 clamp 后调用后者。
- 新兼容服务可以组合已有 API；不是每个新模型都必须编写新协议实现。
- Anthropic 缓存标记依赖 compat 和转换后的末条消息，不能写成固定三处及必然命中。
- 错误编码到流不代表 Agent Loop 不停止；溢出检测也是判断函数，不自动执行恢复。

## 检查记录

- 修改前 `node pi-agent/web/scripts/check-sync.mjs`：27 对全部同步。
- 修改前 `node pi-agent/web/scripts/check-counterpart.mjs`：无法运行，缺少 `gray-matter`（网页依赖尚未安装）。
- 修改后 `node pi-agent/web/scripts/check-sync.mjs`：27 对全部同步。这里只证明网页与快照一致，不证明未核验章节正确。
- 用临时 Node 脚本提取实际 `runLoop` / `shouldTerminateToolBatch` 并替换模型、工具边界：12 个调度场景通过，加上空批次/全部/混合/未设置 terminate 的判断通过。覆盖无工具、正常工具续跑、length 有/无工具、全部 terminate、terminate 后 follow-up、steering、显式 continue、工具满足 continue、finishTurn end、error、aborted。它不是完整集成测试，没有网络和真实工具副作用。
- 03/04 四个 MDX 的双向 counterpart、元数据（含 diagrams）、代码围栏、图示路径、固定提交源码链接检查通过。这个临时静态检查不替代仓库的 gray-matter/YAML 或 MDX 编译检查。
- 9 组配图的 HTML 内嵌 SVG、TS/Python 下载版及网页副本一致性通过；Windows XML 解析器验证 9 个 SVG 通过。未做浏览器视觉检查。
- `git diff --check` 通过；pi 源码工作区保持未修改。
- 首次网页依赖安装 `npm ci --ignore-scripts` 遇到 `EALLOWREMOTE`：锁文件使用 npmmirror，而本机 registry 为 npmjs。后续使用 `npm ci --ignore-scripts --registry=https://registry.npmmirror.com` 安装成功，没有放宽 remote/git 来源策略或执行安装脚本。
- GitHub Pages 配置后，`npm run check` 通过：27 对文档同步、官方 counterpart 检查、5 个 URL/Markdown 回归测试。
- `npm run build` 通过，生成 30 个页面；`npm run check:pages` 验证 687 个本地链接/资源及 `/pi-study-note/` 子路径通过。第 8 章只修正了网页中的跨章节链接，不计入源码语义核验完成范围。
- 用本机 Edge/Playwright 检查首页 17 个章节入口、第一章“关键数字”锚点、主题切换、第 3/4 章 SVG 注入、TS/Python 切换与上下章导航，通过；没有本地资源 HTTP 错误或页面 JavaScript 异常。
- 未运行 pi Vitest，也没有调用真实模型。网页部署验证不替代其余章节的源码核验。

## 尚未完成

本次源码语义修订仅覆盖源码精读第 3、4 章（4/27 个网页文章及其下载版），**不是全书校验完成**。其他章节、实战示例、skills 参考和 notebook 仍须逐项对照源码；已知跨章节的 system 消息、模型实例入口、事件与回调变化也需要继续核验，不能仅批量替换名称。

## 全书图示与网页展示更新

后续按要求，将 155 处字符图与 1 处 Mermaid 图替换成 SVG；复用后为 91 张独立图片。全部 27 篇网页文章已清点，26 篇存在待转换图示，对应 52 个 MDX/Markdown 文件已同步。代码字符串、HTTP 示例、摘要模板及伪代码保留可复制形式。

图示转换仅调整展示，不扩大上述源码语义核验范围。原图文字、行列、分支符号和箭头方向保存在 `web/diagrams/manifest.json`，生成物有完整性与结构回归检查。针对原提交反向还原全部 52 个文档后，确认除了图示、必要组件导入和一段个人推广说明，其余正文及 592 处剩余代码围栏内容未变。

网页作者卡片、二维码和个人推广说明已移除；仓库 README/LICENSE 中的来源及许可证仍保留，网页仅提供通用的“源码与许可证”入口。具体验证与维护方式见 `web/diagrams/README.md`。
