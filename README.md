# DSH 插件精选 · dsh-market

一份**人工筛选、逐条校验**的 DeepSeek Harness 插件索引。DSH 的「发现 / Discover」页直接读它，装插件时不用记包名。

- 索引地址（加进 DSH 就用这个）：**https://d-sp-wq.github.io/dsh-market/index.json**
- 浏览页：https://d-sp-wq.github.io/dsh-market/

## 为什么不是又一个"插件仓库"

DSH 的插件市场由三样东西组成：官方的**索引格式**、官方的**读取服务**、以及**索引内容**。前两样 DSH 自带，缺的是内容。这个仓库只做内容，并把它钉死在官方规则上：

| 保证 | 做法 |
|---|---|
| **格式一定合法** | 每次构建都调用官方解析器 `@deepseek-ai/dsh-plugin-market-index`（与 DSH 运行时同一份代码）；不合法直接构建失败，CI 也跑这一步 |
| **条目一定可装** | 只收声明了 `dsh.bundle` 的 npm 包；不声明的一律跳过（它们只能进 feed，不能进市场） |
| **版本一定真实** | `version` / `publishTimestamp` 全部取自 npm registry，不手写 |
| **不会悄悄过期** | CI 校验 `docs/index.json` 与 `plugins.json` 一致，改了源没重新生成就会失败 |

## 在 DSH 里用

1. **启用发现页**：设置 → 插件，启用实验性组合包 **插件市场 / Plugin Market**（`@deepseek-ai/dsh-experimental-plugin-market-bundle`）。它是官方 bundle，默认不装。
2. **添加索引**：在发现页把 `https://d-sp-wq.github.io/dsh-market/index.json` 加进去。
3. **安装**：浏览、搜索、点安装；也可以直接 `pnpm add <包名>@<版本>`。

> 索引必须是 http(s) 地址、且**不跟随重定向**（DSH 的安全选择）。GitHub Pages 的地址满足这两点。

## 收录范围

- 只收 **DSH 插件（bundle）**，不收 MCP server、不收 CLI 工具、不收"目录/feed"类包。
- 当前 9 个条目、61 个版本，分五类：诊断排障 / 工具增强 / 界面体验 / 模型接入 / 市场目录。
- 中文优先，同时提供英文；作者与仓库信息来自 npm，未经作者认领。

## 提交插件

改 `plugins.json`，在 `plugins` 数组里加一项：

```json
{
  "name": "your-package",
  "category": "tooling",
  "labels": ["community"],
  "title": { "zh": "中文名", "en": "English name" },
  "description": { "zh": "一句话说明", "en": "One line." },
  "versions": 8
}
```

然后：

```bash
npm install          # 仅首次：装官方校验器
npm run build        # 生成 docs/index.json 并校验
npm run serve        # 本地预览 http://127.0.0.1:8787/
```

要求：包已发布到 npm、`package.json` 里声明了 `dsh.bundle`、`version` 是合法 SemVer。提 PR 时 CI 会跑 `npm run check`。

## 目录

```
plugins.json          人工维护的源清单（唯一需要改的文件）
scripts/build.mjs     读源清单 → 抓 npm 元数据 → 生成并校验 docs/index.json
scripts/serve.mjs     本地静态预览
docs/index.html       浏览页（无框架、无构建）
docs/app.js           搜索 / 分类 / 排序 / 展开版本 / 复制安装规格
docs/index.json       生成物，已提交，DSH 读的就是它
```

## 许可证

MIT。索引内容是公开 npm 元数据的汇编；各插件版权归其作者。
