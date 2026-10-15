/**
 * 创建浏览器模拟用的 VM 上下文（standalone-runner 与 SimpleSandbox 共用）。
 *
 * 使用 vm.constants.DONT_CONTEXTIFY：全局对象是普通 V8 全局，没有 Node 的拦截器，
 * 访问器里的 this 就是 window，constructor 链也停留在 VM 自己的 realm。
 * 宿主能力（输出、URL 解析、HTML 解析、定时器调度）只通过 env/core/GlobalScope.js 的闭包桥接，
 * 除 VM 自己传入的回调外只交换字符串、数字等原始值。
 */
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { URL, URLSearchParams, fileURLToPath } from 'node:url';
import { randomBytes, createHash } from 'node:crypto';
import { bootstrapEnvModules, coreEnvModules } from './envModules.js';
import { createHtmlBridge } from './htmlBridge.js';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const URL_FIELDS = ['href', 'origin', 'protocol', 'username', 'password', 'host', 'hostname',
    'port', 'pathname', 'search', 'hash'];
const URL_SETTERS = new Set(['href', 'protocol', 'username', 'password', 'host', 'hostname',
    'port', 'pathname', 'search', 'hash']);

function urlRecord(url) {
    const record = {};
    for (const field of URL_FIELDS) record[field] = url[field];
    return JSON.stringify(record);
}

function parseURL(input, base) {
    try {
        const url = base === undefined ? new URL(input) : new URL(input, base);
        return urlRecord(url);
    } catch {
        return null;
    }
}

function updateURL(href, name, value) {
    const url = new URL(href);
    // GlobalScope 只会传入白名单里的组件名；其他名字保持原值
    if (URL_SETTERS.has(name)) url[name] = value;
    return urlRecord(url);
}

// VM 全局对象 → 定时器状态 { handles: Map<id, { handle, keepAlive }>, waiters: Set<Function> }
const timerStates = new WeakMap();

function keepAliveCount(state) {
    let count = 0;
    for (const entry of state.handles.values()) if (entry.keepAlive) count++;
    return count;
}

function notifyWaiters(state) {
    for (const waiter of state.waiters) waiter();
}

/** 定时器桥接：VM 只请求一次性调度，重复、嵌套钳制由 env/timer/timeout.js 处理。 */
function createTimerBridge(state) {
    return {
        schedule(id, delay, keepAlive, callback) {
            const handle = setTimeout(() => {
                state.handles.delete(id);
                // callback 是 VM 内函数，内部已捕获页面异常
                callback();
                notifyWaiters(state);
            }, delay);
            if (!keepAlive) handle.unref();
            state.handles.set(id, { handle, keepAlive });
        },
        cancel(id) {
            const entry = state.handles.get(id);
            if (!entry) return;
            clearTimeout(entry.handle);
            state.handles.delete(id);
            notifyWaiters(state);
        }
    };
}

/** 宿主桥接对象：只在 GlobalScope 安装函数的闭包里使用，不会挂到全局。 */
function createHostBridge(onConsole, timerState) {
    const html = createHtmlBridge();
    return {
        print(level, args) {
            onConsole(level, Array.from(args));
        },
        timers: createTimerBridge(timerState),
        // 单调高精度时钟（毫秒，含小数），供 performance.now() 使用
        clock: {
            origin: () => performance.timeOrigin,
            now: () => performance.now()
        },
        // Web Crypto：随机字节与摘要，输入输出都是十六进制字符串
        crypto: {
            randomHex: length => randomBytes(length).toString('hex'),
            digest: (algorithm, hex) => createHash(algorithm).update(Buffer.from(hex, 'hex')).digest('hex')
        },
        url: {
            parse: parseURL,
            update: updateURL,
            parseQuery: query => JSON.stringify([...new URLSearchParams(query)]),
            serializeQuery: json => new URLSearchParams(JSON.parse(json)).toString()
        },
        html: {
            parseDocument: markup => JSON.stringify(html.parseDocument(markup)),
            parseFragment: markup => JSON.stringify(html.parseFragment(markup)),
            select: (root, selector, includeRoot) => html.select(root, selector, includeRoot),
            matches: (node, selector) => html.matches(node, selector)
        }
    };
}

function runModule(context, relativePath, timeout) {
    const code = fs.readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf-8');
    // 默认文件名 evalmachine.<anonymous> 会出现在 error.stack 里，暴露 Node vm
    return vm.runInContext(code, context, { timeout, filename: '<anonymous>' });
}

/**
 * @param {object} options
 * @param {object|null} options.profile 指纹配置（会在 VM 内重新解析为本 realm 对象）
 * @param {number} options.timeout 单次脚本执行超时（毫秒）
 * @param {(level: string, args: any[]) => void} options.onConsole 接收 console 输出
 * @returns {object} VM 的全局对象（即 window）
 */
export function createBrowserContext({ profile = null, timeout = 60000, onConsole = () => {} } = {}) {
    const context = vm.createContext(vm.constants.DONT_CONTEXTIFY);
    for (const modulePath of bootstrapEnvModules) runModule(context, modulePath, timeout);

    const timerState = { handles: new Map(), waiters: new Set() };
    timerStates.set(context, timerState);
    const installGlobalScope = runModule(context, 'env/core/GlobalScope.js', timeout);
    installGlobalScope(createHostBridge(onConsole, timerState));

    // 宿主对象不能直接放进 VM：用 VM 自己的 JSON.parse 复制一份
    context.__profile__ = profile ? context.JSON.parse(JSON.stringify(profile)) : null;

    for (const modulePath of coreEnvModules) runModule(context, modulePath, timeout);
    return context;
}

/**
 * 等待页面的 setTimeout 全部执行完（setInterval 不计入），最多等待 limit 毫秒。
 * 每次检查前让出一轮宏任务，使回调里排入的微任务有机会再创建定时器。
 */
export function waitForTimers(context, limit) {
    const state = timerStates.get(context);
    if (!state) return Promise.resolve();
    return new Promise(resolve => {
        let done = false;
        const deadline = setTimeout(finish, Math.max(0, limit));
        function finish() {
            if (done) return;
            done = true;
            clearTimeout(deadline);
            state.waiters.delete(check);
            resolve();
        }
        function check() {
            setImmediate(() => {
                if (keepAliveCount(state) === 0) finish();
            });
        }
        state.waiters.add(check);
        check();
    });
}

/** 取消上下文里所有尚未触发的定时器（重置或丢弃沙箱时调用）。 */
export function disposeBrowserContext(context) {
    const state = timerStates.get(context);
    if (!state) return;
    for (const entry of state.handles.values()) clearTimeout(entry.handle);
    state.handles.clear();
    notifyWaiters(state);
}

/** 在 VM 内解析 HTML 并替换 document 树；返回 VM 内的 document。 */
export function loadHTMLIntoContext(context, html, pageURL, timeout) {
    const code = `window.__loadHTML__(window.__htmlBridge__.parseDocument(${JSON.stringify(String(html))}), ` +
        `${JSON.stringify(pageURL || null)})`;
    return vm.runInContext(code, context, { timeout, filename: '<anonymous>' });
}
