# 把本市场加入 DSH

索引地址（复制这一行）：

```
https://d-sp-wq.github.io/dsh-market/index.json
```

## 步骤

1. **重启 DSH**（本次安装了「插件市场 / Plugin Market」实验性组合包，必须重启才会挂载）。

2. 打开 **设置 → 插件 → 发现 / Discover**（如果没有这个标签页，说明组合包没启用：
   在插件列表里找 **插件市场 / Plugin Market**，勾选后重启）。

3. 在发现页添加索引源，填入上面的地址。

4. 浏览、搜索、一键安装。

## 不想用界面的话

在会话里直接对我说：

> 把插件市场索引加到 https://d-sp-wq.github.io/dsh-market/index.json

我会调用 `plugin_market` 的 `setIndexes` 写进你的 profile 设置（同样需要先重启 DSH）。

## 命令行直接装

索引里每个插件都带精确版本，安装规格形如：

```bash
pnpm add dsh-plugin-health@3.0.7
pnpm add dsh-plugin-upgrader@1.8.0
```

## 索引内容

当前 **9 个插件 / 61 个版本**，分五类：

| 分类 | 插件 |
|---|---|
| 诊断排障 | dsh-plugin-health、dsh-plugin-debugging、dsh-plugin-ops-bundle |
| 工具增强 | dsh-plugin-upgrader、dsh-plugin-share |
| 界面体验 | dsh-plugin-appshot、dsh-plugin-guide |
| 模型接入 | dsh-our-free-model |
| 市场目录 | dsh-plugin |

浏览页：https://d-sp-wq.github.io/dsh-market/

## 收录标准

- 包必须已发布到 npm；
- 必须声明 `dsh.bundle`（否则只是 feed，装不成插件）；
- 版本号必须是合法 SemVer；
- 构建时用官方解析器 `@deepseek-ai/dsh-plugin-market-index` 校验——和 DSH 运行时同一份代码，不通过就发不出去。

## 注意

- 索引内容是**对公开 npm 元数据的汇编**，插件本身归各作者，行为与风险请自行评估。
- 索引**不带签名**：DSH 装什么由已安装包的 manifest 决定，不是由索引决定。
- 想收录自己的插件：改 `plugins.json` 后 `npm run build`，提 PR 即可（CI 会校验）。
