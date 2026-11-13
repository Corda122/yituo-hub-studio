/* window.YituoStudio 接口测试（Corda122 fork）：在 jsdom 里真跑 studio.html + app.js，逐个调接口。
 * 用法：node test-api.js；失败时退出码 1，并打印是哪个接口、什么行为错了。 */
const path = require('path');
const { JSDOM } = require('jsdom');

let failed = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : ''));
  if (!ok) failed++;
}
async function rejects(fn) { try { await fn(); return null; } catch (e) { return e; } }

async function open(query) {
  const dom = await JSDOM.fromFile(path.join(__dirname, 'studio.html'), {
    url: 'file://' + path.join(__dirname, 'studio.html') + (query || ''),
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
    beforeParse(w) { w.HTMLCanvasElement.prototype.getContext = function () { return null; }; }
  });
  const w = dom.window;
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('studio.html 10 秒内没有 yituo:ready')), 10000);
    w.addEventListener('yituo:ready', () => { clearTimeout(t); resolve(); });
  });
  return w;
}

(async () => {
  const w = await open('?embed=1');
  const S = w.YituoStudio;
  check('接口存在且 version=1', !!S && S.version === 1);
  const methods = ['setMarkdown', 'getMarkdown', 'listThemes', 'listLevels', 'listColorways', 'setTheme', 'setWidth', 'setAuthor', 'getState', 'getHtml', 'copyToWechat', 'downloadHtml', 'exportImage', 'onReady', 'onChange'];
  const missing = methods.filter((m) => typeof (S && S[m]) !== 'function');
  check('15 个方法都在', missing.length === 0, missing.join(','));
  check('embed=1：html 带 yt-embed、不载示例', w.document.documentElement.classList.contains('yt-embed') && S.getMarkdown() === '');

  let ready = null;
  S.onReady((st) => { ready = st; });
  check('onReady 在已就绪后注册也会立刻回调', !!ready && ready.themeId === 'zhuozhi', ready && ready.themeId);

  const changes = [];
  const off = S.onChange((st) => changes.push(st));
  await S.setMarkdown('# 标题一\n\n第一段 **重点** 文字。');
  const html1 = await S.getHtml();
  check('setMarkdown → getHtml 出排好的 HTML', /第一段/.test(html1) && /<section|<p/.test(html1), html1.slice(0, 60));
  check('setMarkdown 触发 onChange（带 validation）', changes.length >= 1 && changes[changes.length - 1].validation && changes[changes.length - 1].validation.ok === true);
  check('编辑框里是同一份字', w.document.getElementById('editor').value === '# 标题一\n\n第一段 **重点** 文字。');

  const themes = S.listThemes();
  const ids = themes.map((t) => t.id);
  check('listThemes 含拙知 / 石墨极简 / 橄榄手记', ['zhuozhi', 'graphite', 'olive'].every((x) => ids.includes(x)), themes.length + ' 套');
  check('listThemes 分基础 / 高级两个库', themes.some((t) => t.library === 'base') && themes.some((t) => t.library === 'original'));
  await S.setTheme('graphite');
  check('setTheme(graphite) 生效', S.getState().themeId === 'graphite' && S.getState().themeName === '石墨极简');
  const html2 = await S.getHtml();
  check('换主题后 HTML 变了', html2 !== html1);
  check('一拓自己的主题按钮也跟着变', /石墨极简/.test(w.document.getElementById('themePickerSlot').textContent));

  let e = await rejects(() => S.setTheme('no-such-theme'));
  check('未知主题抛错（不静默）', !!e && /no-such-theme/.test(e.message), e && e.message);
  check('抛错后主题不变', S.getState().themeId === 'graphite');
  e = await rejects(() => S.setTheme('graphite', { levelId: 'x' }));
  check('未知视觉等级抛错', !!e && /视觉等级/.test(e.message));
  e = await rejects(() => S.setMarkdown(42));
  check('setMarkdown 非字符串抛错', !!e && /字符串/.test(e.message));

  S.setWidth('402');
  check('setWidth(402) → 预览按 402 设备宽', S.getState().width === '402' && w.document.getElementById('previewWrap').classList.contains('device')
    && w.document.querySelector('[data-preview-width="402"]').getAttribute('aria-pressed') === 'true');
  e = await rejects(() => S.setWidth('500'));
  check('setWidth 非法值抛错', !!e && /宽度/.test(e.message));

  await S.setAuthor('柯');
  check('setAuthor 写进署名框并重排', w.document.getElementById('authorInput').value === '柯' && S.getState().author === '柯');

  const adv = themes.find((t) => t.library === 'original');
  const lv = S.listLevels().find((l) => l.order < 3);
  await S.setTheme(adv.id, { levelId: lv.id });
  check('高级排版 + 视觉等级', S.getState().advanced === true && S.getState().levelId === lv.id, adv.id + ' / ' + lv.id);
  check('listColorways 给当前高级主题的配色', S.listColorways().length >= 1);

  // 下载：一拓自己建 Blob、点 <a download>（工作台的 hookDownloads 就挂在这一步）
  let clicked = null;
  w.URL.createObjectURL = () => 'blob:test'; w.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = function () { clicked = this.download; };
  const name = await S.downloadHtml();
  check('downloadHtml 走一拓自己的下载（<a download>）', !!name && clicked === name && /\.html$/.test(name), name);

  let copied = null;
  w.navigator.clipboard = { write: (items) => { copied = items; return Promise.resolve(); } };
  w.ClipboardItem = function (x) { this.types = Object.keys(x); };
  const ok = await S.copyToWechat();
  check('copyToWechat 写富文本 + 纯文本', ok === true && copied && copied[0].types.includes('text/html') && copied[0].types.includes('text/plain'));

  e = await rejects(() => S.exportImage());
  check('exportImage 失败时 reject（不静默）', !!e && e.message.length > 0, e && e.message);

  off();
  const n = changes.length;
  await S.setMarkdown('# 再来\n\n一段。');
  check('onChange 返回的函数能退订', changes.length === n);
  e = await rejects(() => S.onChange('x'));
  check('onChange 非函数抛错', !!e);

  // 非嵌入模式：一拓原样（示例文章、工具条都在）
  const w2 = await open('');
  check('不带 embed：照旧载示例、无 yt-embed', !w2.document.documentElement.classList.contains('yt-embed') && w2.YituoStudio.getMarkdown().length > 100);

  console.log(failed ? `\n${failed} 项失败` : '\nYituoStudio 接口全部通过');
  process.exit(failed ? 1 : 0);
})().catch((err) => { console.error('FAIL 运行出错', err); process.exit(1); });
