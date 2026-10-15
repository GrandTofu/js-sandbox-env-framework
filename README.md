# JS Sandbox Env Framework

在 Node.js 里调试依赖浏览器对象的 JavaScript：加载指纹配置、浏览器环境模块与网页 HTML，再运行指定脚本。适合**复现具体调用链**，不提供完整渲染或安全隔离。

## 安装

需要 Node.js 22.8+（沙箱用 `vm.constants.DONT_CONTEXTIFY` 创建普通全局对象，避免宿主 realm 泄漏）。

```bash
npm ci
```

## 用法一：命令行直接跑脚本

```bash
# 用示例指纹配置（Chrome 120 / Windows 10）运行脚本
node standalone-runner.js --profile default your-script.js

# 直接执行一段代码
node standalone-runner.js --code "console.log(navigator.userAgent)"

# 自定义指纹配置（从任意路径加载 JSON）
node standalone-runner.js --profile-file ./my-profile.json your-script.js
```

常用选项（完整见 `node standalone-runner.js --help`）：

| 选项 | 作用 |
| --- | --- |
| `--profile <名称>` | 从 `profiles/` 加载指纹配置 |
| `--profile-file <路径>` | 加载自定义指纹配置 JSON |
| `--html-url <URL>` | 请求网页 HTML 并解析成 `document` |
| `--html-file <文件>` | 加载本地 HTML（`--page-url` 指定其原始地址以解析相对 URL） |
| `--env <文件>` | 合并采集的环境快照 |
| `--detect` / `-d` | 自动检测脚本调用了哪些尚未实现的 API |
| `--proxy` / `-p` | 记录所有属性访问，便于排查缺失字段 |
| `--code "<JS>"` | 直接执行代码字符串 |

```bash
# 网页 HTML + 你提供的脚本
node standalone-runner.js --profile default --html-url https://example.com/page your-script.js

# 本地 HTML 结合环境快照
node standalone-runner.js --profile default --env captured.json \
  --html-file page.html --page-url https://example.com/page --proxy your-script.js
```

- HTML 内联/外部脚本**不会自动执行**，请明确传入要调试的 JS。`--html-url` 上限 2 MiB、超时 12 秒。
- 指纹字段（UA、UA Client Hints、屏幕、时区、Canvas/WebGL…）应来自**同一台**目标浏览器；只改 UA 会形成矛盾指纹。

## 用法二：HTTP 服务

```bash
npm start          # 启动 http://localhost:3000
```

`POST /api/sandbox/run`：

```json
{
  "code": "document.title",
  "html": "<title>Example</title>",
  "pageURL": "https://example.com/",
  "profile": { "...": "指纹配置，可省略，默认用服务内置配置" }
}
```

返回 `{ "success": true, "result": "..." }`。含 `html` 的请求使用独立沙箱，不复用其他请求的 DOM；服务端**不会**根据你传入的 URL 代为请求网站，需由调用方提供 HTML。

## 用法三：编程调用

```javascript
import { SimpleSandbox } from './server/sandbox/SimpleSandbox.js';
import { readFileSync } from 'node:fs';

const profile = JSON.parse(readFileSync('profiles/default.json', 'utf8'));
const sandbox = new SimpleSandbox().init({ profile });
sandbox.loadHTML(readFileSync('page.html', 'utf8'), 'https://example.com/page');
const result = await sandbox.execute('document.querySelector("title")?.textContent');
console.log(result);
```

## 网络请求（mock）

`fetch` 由 `env/webapi/apis.js` 提供，XHR 由 `env/webapi/xhr.js` 提供，两者**都不发送真实网络请求**，默认返回空的 200 模拟响应。可用监控系统配置响应：

```js
__setMock__('XMLHttpRequest.send', {
    handler(body, url, method) {
        return { status: 200, headers: { 'content-type': 'application/json' },
            body: { ok: true }, delay: 5 };
    }
});
```

- XHR 支持 `readyState` 状态机、loadstart/progress/load/error/abort/timeout/loadend 事件、upload 进度、`abort()`、`timeout`，以及 text/JSON/ArrayBuffer/Blob/Document 响应读取。
- mock 返回 `error` 或 `status: 0` 触发错误事件；`delay` 用于验证 `timeout` 与 `abort()`。
- 同步 XHR 只同步完成模拟响应，不等待真实网络或 mock 延迟。
- Request/Response 按 body（字符串 / URLSearchParams / Blob / FormData）推导 Content-Type，显式设置的值优先。

## 采集环境快照（可选）

```bash
pip install -r collector/requirements.txt
python collector/website-env-collector.py --url https://example.com/page \
  --output captured.json --format json
node standalone-runner.js --profile default --env captured.json your-script.js
```

采集器找不到浏览器时，用 `--browser-path /path/to/chrome` 或环境变量 `BROWSER_PATH` 指定。

## 范围与边界

- 当前模拟常见 DOM、BOM、Storage、导航和部分指纹 API；布局/字体测量、Canvas/GPU、事件循环、网络请求头及 TLS 指纹等仍无法完整复现。
- **Node `vm` 不能用于隔离不可信脚本。** 能否跑通某个站点取决于其 JS 实际调用的 API、页面状态与网络依赖。请先固定目标浏览器版本，按脚本调用链与真实浏览器对照补齐差异。
- 旧 `env/webapi/fetch.js`、`network.js`、`env/bom/console.js`、`observers.js` 已移除，统一通过 `server/sandbox/envModules.js` 的 `browserEnvModules` 加载；旧 network 模块的 `__NetworkMock__` / `__NetworkStore__` 请迁移到现有 `__setMock__` 与监控日志。

## 测试

```bash
npm test                                   # 本地 60 项测试
python -m unittest discover -s test -p 'test_collector.py'
```

许可：MIT。
