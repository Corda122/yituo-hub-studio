# 嵌入接口 window.YituoStudio（Corda122 fork · zhuozhi 分支）

给 AI 工作台「分发台」公众号页用：工作台把一拓同源嵌在 iframe 里，经这个接口驱动，不再隐藏一拓的编辑框、代点它的按钮。
只调一拓自己的函数，排版、校验、复制、下载、长图逻辑都不变；参数不对一律抛 `Error('YituoStudio：…')`，不静默。

打开方式：`studio.html?embed=1`——`<html>` 加 `yt-embed`，只显示预览（站点顶栏、编辑栏、预览工具条、校验面板、页脚、提示条都隐藏），不载示例文章、不读 AI 创作交接稿。不带 `embed=1` 时一拓原样。

| 方法 | 作用 |
|---|---|
| `version` | 1 |
| `setMarkdown(md)` → Promise | 写进一拓的编辑框并重排；非字符串抛错 |
| `getMarkdown()` | 当前 Markdown |
| `listThemes()` | `[{id,name,desc,group,swatch,library: 'base'|'original'}]` |
| `listLevels()` / `listColorways(themeId?)` | 高级排版视觉等级 / 当前（或指定）主题的配色 |
| `setTheme(id, {levelId?, colorId?, motionEnabled?})` → Promise | 换主题（一拓自己的主题按钮跟着变）；未知主题 / 等级 / 配色抛错，主题不变 |
| `setWidth('fit'|'375'|'402'|'440')` | 预览宽度；其他值抛错 |
| `setAuthor(name)` → Promise | 署名（最多 24 字） |
| `getState()` | `{themeId, themeName, advanced, levelId, colorId, motionEnabled, width, author, html, validation}` |
| `getHtml()` → Promise<string> | 等当前排版完成后的 HTML |
| `copyToWechat()` → Promise<true|'fallback'|false> | 一拓的「复制到公众号」 |
| `downloadHtml()` → Promise<文件名|null> | 一拓的「下载 HTML」（照旧经 `<a download>`） |
| `exportImage()` → Promise<文件名> | 一拓的「导出长图」；失败 reject |
| `onReady(fn)` / `onChange(fn)` | 返回退订函数；首次排版完成后 ready（之后注册立即回调），每次排版完成或失败都 change（失败时 `error` 有值）。另派发 `window` 事件 `yituo:ready` |

测试：`node test-api.js`（jsdom 真跑 studio.html，`npm test` 已包含）。
