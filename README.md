# JS Sandbox Env Framework

用于在 Node.js 中调试依赖浏览器对象的 JavaScript。可以加载指纹配置、浏览器环境模块、采集快照和网页 HTML，再运行指定的脚本。项目适合复现**具体调用链**，不提供完整浏览器渲染或安全隔离。

## 安装与运行

需要 Node.js 22.8+（沙箱用 `vm.constants.DONT_CONTEXTIFY` 创建普通全局对象，避免宿主 realm 泄漏）；采集浏览器指纹时另需 Python 3 和 Chrome/Chromium/Edge。

```bash
npm ci
node standalone-runner.js --profile default your-script.js
```

默认 `profiles/default.json` 是 Chrome 120 / Windows 10 的示例配置。换设备时复制并修改配置，用 `--profile-file ./my-profile.json` 加载。UA、UA Client Hints、屏幕、时区、Canvas/WebGL 等字段应来自同一台目标浏览器；只改 UA 会形成矛盾的指纹。`--proxy` 记录属性访问，`--detect` 报告缺失 API，`--env captured.json` 合并采集快照。

## 网页 HTML 与目标脚本交互

```bash
# 直接请求页面 HTML，再执行你提供的脚本
node standalone-runner.js --profile default --html-url https://example.com/page your-script.js

# 已保存的 HTML：提供原页面地址，以便解析相对 URL 和 <base>
node standalone-runner.js --profile default --html-file page.html \
  --page-url https://example.com/page your-script.js

# 结合网站环境快照排查缺失对象
node standalone-runner.js --profile default --env captured.json \
  --html-file page.html --page-url https://example.com/page --proxy your-script.js
```

HTML 会解析成可访问的 `document` 节点。目标脚本可以查询节点、读取属性和文本、修改 `classList`/`dataset`/`innerHTML`、插入节点并派发基本事件。`querySelectorAll()` 是静态集合，`getElementsByTagName()` 等是动态集合。请求 HTML 的上限为 2 MiB，超时 12 秒。**HTML 中的内联脚本及外部脚本不会自动执行**；请明确传入要调试的 JS 文件。需要会话、请求头或登录状态的页面，可自行请求并保存 HTML 后使用 `--html-file`。

采集示例（可选）：

```bash
pip install -r collector/requirements.txt
python collector/website-env-collector.py --url https://example.com/page \
  --output captured.json --format json
node standalone-runner.js --profile default --env captured.json your-script.js
```

采集器找不到浏览器时，指定 `--browser-path /path/to/chrome` 或环境变量 `BROWSER_PATH`。

## 编程与 Web 接口

```javascript
import { SimpleSandbox } from './server/sandbox/SimpleSandbox.js';
import { readFileSync } from 'node:fs';

const profile = JSON.parse(readFileSync('profiles/default.json', 'utf8'));
const sandbox = new SimpleSandbox().init({ profile });
sandbox.loadHTML(readFileSync('page.html', 'utf8'), 'https://example.com/page');
const result = await sandbox.execute('document.querySelector("title")?.textContent');
console.log(result);
```

`npm start` 打开 `http://localhost:3000`。`POST /api/sandbox/run` 可提交 `{ "code": "document.title", "html": "<title>Example</title>", "pageURL": "https://example.com/", "profile": {...} }`；含 `html` 的请求使用独立沙箱，不复用其他请求的 DOM。服务端不根据用户传入的 URL 代为请求网站，需由调用方提供 HTML。

## 范围与验证

目前主要模拟常见的 DOM、BOM、Storage、导航和部分指纹 API；`fetch`/XHR、布局与字体测量、Canvas/GPU、事件循环、浏览器内部对象、网络请求头及 TLS 指纹仍无法完整复现。Node `vm` **不能用于隔离不可信脚本**。能否跑通某个站点取决于其 JS 实际调用的 API、页面状态和网络依赖。请先固定目标浏览器版本，按脚本调用链与真实浏览器对照并补齐差异。

加载浏览器环境后，`fetch` 由 `env/webapi/apis.js` 提供，XHR 由 `env/webapi/xhr.js` 提供，均不发送真实网络请求。默认返回空的 200 模拟响应；XHR 支持状态转换、进度/上传事件、取消、超时及文本、JSON、ArrayBuffer、Blob、Document 响应。可用现有监控系统配置响应，例如：

```js
__setMock__('XMLHttpRequest.send', {
    handler(body, url, method) {
        return { status: 200, headers: { 'content-type': 'application/json' },
            body: { ok: true }, delay: 5 };
    }
});
```

mock 返回 `error` 或 `status: 0` 会触发错误事件，`delay` 可用于验证 `timeout` 与 `abort()`。同步 XHR 只同步完成模拟响应，不等待真实网络或 mock 延迟。Request/Response 根据字符串、URLSearchParams、Blob、FormData 推导 Content-Type，并保留显式设置的值。`new Response()` 的 `statusText` 默认空串，与浏览器一致。

旧 `env/webapi/fetch.js`、`env/webapi/network.js`、`env/bom/console.js`、`env/bom/observers.js` 已移除；默认加载入口是 `server/sandbox/envModules.js`。console 由 `GlobalScope.js` 提供，观察者由 `observerApis.js` 和 `performance.js` 提供；旧 network 模块的 `__NetworkMock__` / `__NetworkStore__` 应迁移到现有 `__setMock__` 与监控调用日志。

```bash
npm test
python -m unittest discover -s test -p 'test_collector.py'
```

许可：MIT。
