# Pi Agent Book

基于 Astro 5 + React 19 + MDX 的双轨电子书，承载 [Pi Agent](https://pi.dev) SDK 的两套教程。

## 两个系列

电子书用一个 Astro content collection（`modules`）承载两个系列，靠 frontmatter 的 `book` 字段区分：

| 系列 | book 值 | 章节前缀 | 规模 | 语言变体 |
|------|---------|----------|------|----------|
| 🚀 实战上手篇 | `practice` | P01–P07 | 7 章 | TypeScript |
| 🔬 源码精读篇 | `internals` | M01–M10 | 10 章 | TypeScript + Python 双版本 |

- **实战上手篇**：用一个真实场景（企业数据分析助手）搭一个能上线的垂直 Agent。无语言切换，每章一张卡、一个「阅读 →」按钮。
- **源码精读篇**：系统拆解 SDK 源码设计。每章 TS + Python 双版本，顶栏一键切换。

> 本仓库站点：https://invictuskai.github.io/pi-study-note/
>
> 原作者站点：https://dg-ai-notes.pages.dev （保留原作者署名与许可证）

## GitHub Pages 自动发布

GitHub 仓库：`https://github.com/invictuskai/pi-study-note`。

1. 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
2. 推送 `main` 后，`.github/workflows/pages.yml` 自动安装锁定依赖、检查、构建并部署。
3. 在仓库 **Actions → Deploy GitHub Pages** 查看结果；也可手动 Run workflow。

站点域名与子路径统一配置于 `site.config.mjs`，当前为：

```js
export const site = 'https://invictuskai.github.io';
export const base = '/pi-study-note';
```

组件与浏览器导航使用 `withBase`，Markdown 链接通过 remark 插件补齐前缀；代码示例中的 URL 不改写。构建产物仍在 `dist/`，不要额外创建 `dist/pi-study-note/`。不需要提交 dist 或单独维护 gh-pages 分支。

发布前本地验证（建议 Node.js 22.22.0，与 CI 一致）：

```bash
npm ci --ignore-scripts --registry=https://registry.npmmirror.com
npm run check
npm run build
npm run check:pages
```

registry 参数匹配现有锁文件的下载来源，不修改全局 npm 配置，也不启用 remote/git 来源或安装生命周期脚本。`check:pages` 检查生成页面中的本地链接、配图、脚本及 Python 路由；不会执行文章中的 SDK 示例或调用模型。构建通过不代表全书内容已经完成源码核验，进度见 `../SOURCE-AUDIT.md`。

---

## 手机布局回归检查

```bash
npm run check:responsive
```

先执行 `npm run build`。检查器启动本地 preview，使用真实浏览器引擎模拟 320/360/390/430/768px 触屏视口，并检查桌面布局；不调用文章里的模型接口。Windows 默认使用已安装的 Edge，也可以通过 `PLAYWRIGHT_CHANNEL` 指定浏览器通道。Linux/CI 先安装锁定版本 Playwright 对应的 Chromium：

```bash
node node_modules/playwright/cli.js install --with-deps chromium
```

GitHub Pages 工作流会在部署前执行这项检查。首页标题在窄屏完整换行、字数另起一行；宽表格只在自身区域滚动；图片按屏宽缩放，点按后提供放大、缩小与适应屏幕按钮。

## 快速开始

```bash
# 安装锁定依赖（首次，不执行安装脚本）
npm ci --ignore-scripts --registry=https://registry.npmmirror.com

# 开发模式（热重载，http://localhost:4321）
npm run dev
# 打开 http://localhost:4321/pi-study-note/

# 生产构建（输出到 dist/）
npm run build

# 预览构建产物（http://localhost:4321）
npm run preview
```

**环境要求**：完整检查流程使用 Node.js 22.22.0 或更新的兼容版本，任意现代浏览器。

---

## 读者使用指南

只想看文档不关心开发？两种方式：

### 方式一：本地起站点（推荐，离线可用）

```bash
npm ci --ignore-scripts --registry=https://registry.npmmirror.com
npm run dev
# 浏览器打开 http://localhost:4321/pi-study-note/
```

### 方式二：直接读源 md 文件

源文档（Markdown 原稿，无需构建）在仓库的 `../pi_source_dive/`（精读篇）与 `../pi_sdk_learn/docs/`（实战篇）目录，按系列组织：
- 实战上手篇：`../pi_sdk_learn/docs/`
- 源码精读 TS 版：`../pi_source_dive/typescript/`
- 源码精读 Python 版：`../pi_source_dive/python/`

### 阅读界面操作

| 操作 | 效果 |
|------|------|
| 首页 **双入口 CTA** | 「实战上手 →」「源码精读 →」分别进入两系列第一章 |
| 首页 **两条路怎么选** | 对比两个系列的目标/切入点/产物，给阅读路径建议 |
| 顶栏 **TS / Python** 切换器 | （仅源码精读篇）同一章在两种语言间跳转，偏好记到 localStorage |
| 顶栏 **☀ / 🌙** 按钮 | 浅色/深色/跟随系统三态循环，`T` 键快捷键 |
| 顶栏 **◧ 沉浸式阅读** 按钮 / **`F`** 键 | 进入沉浸模式：右栏大纲淡出、正文加宽。仅 ≥1280px 可用 |
| 左侧 TOC | **按系列隔离**：读实战篇时显示 P01–P07，读精读篇时显示 M01–M10 |
| 右侧 On-This-Page | 当前页面的标题大纲，滚动时高亮当前节 |
| 点击 SVG 图内节点 | 自动跳转到对应代码块并高亮（源码精读篇已布好锚点） |
| 底部 **← 上章 / 下章 →** | **系列内连续阅读**：两系列互不串台 |

---

## 内容系统设计

### content collection

`src/content/config.ts` 定义一个 `modules` collection，关键字段：

```yaml
book: internals | practice   # 系列（默认 internals）
module: M01..M10 | P01..P07  # 章节号（正则 ^[MP]\d+(\.\d+)?$）
variant: ts | python          # 语言变体（实战篇只有 ts）
counterpart: <slug>           # 源码精读篇：TS↔Python 配对 slug
displayOrder: <number>        # 系列内排序（两系列各自从 1 起）
```

- **系列隔离**：`collection.ts` 的 `getAllModules(book?)`、`getAdjacentModules(order, book)` 都按 `book` 过滤，保证 TOC、prev/next、首页分组互不串台。
- **无 Python 变体**：实战篇不声明 `counterpart`，`ModuleLayout` 的 LanguageSwitcher 自动隐藏。

### mdx 源与 md 快照

- `src/content/modules/` 是 web 富内容源（mdx，27 个文件）
- `../pi_source_dive/` 与 `../pi_sdk_learn/docs/` 是下载版快照（md），改内容以 mdx 为准，手动同步 md

> ⚠️ mdx 比 md 严格：表格/正文里的裸 `{...}` 会被当 JS 表达式执行（须用反引号包裹），`<br>` 须写成自闭合 `<br/>`。

---

## 主要功能

| 能力 | 说明 |
|------|------|
| **三栏阅读布局** | 左 TOC / 正文 / 右大纲，1279px 以下隐藏右栏，767px 以下转汉堡菜单 |
| **沉浸式阅读模式** | `F` 键切换，右栏淡出、正文加宽，CSS transition 平滑过渡。仅 ≥1280px 生效 |
| **双系列首页** | 双入口 Hero + 选路指南 + 两段章节网格（实战篇带强调色背景，排在前） |
| **TS/Python 双版本** | （源码精读篇）每章并排两个 mdx，URL 各自独立，顶栏一键切换 |
| **代码块增强** | Shiki 语法高亮 + 语言标签 + 一键复制 + 30 行以上自动折叠 |
| **SVG 图表联动** | 点击图内节点自动滚动到对应代码块（源码精读篇五步管道图等） |
| **章节字数/阅读时长** | 构建时读 mdx 源文件实时计算（CJK 按字 + 英文按词），改内容自动跟随 |

---

## 构建/校验命令

```bash
npm run check              # 文档同步、双版本元数据和 URL 回归测试
npm run build              # 生产构建（30 页）
npm run check:pages        # 验证构建产物的子路径与本地链接
npm run check:responsive   # 浏览器验证手机/平板文字、图片与触屏缩放
npm run check:counterpart  # 校验源码精读篇 TS/Python frontmatter 一致性
npm run build:pdf          # 导出源码精读篇 PDF（TS + Python）
```

## 许可

代码采用 [MIT License](../LICENSE)，文档采用 [CC-BY-SA-4.0](https://creativecommons.org/licenses/by-sa/4.0/)。
