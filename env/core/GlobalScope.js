/**
 * @env-module GlobalScope
 * @description 在 VM 自身 realm 内建立全局作用域：window/self 访问器、console 输出转发、宿主桥接（URL、HTML 解析、定时器调度）与基础占位 API
 * @compatibility Chrome 120+
 *
 * 与其他 env 模块不同，本文件的求值结果是一个安装函数，由 server/sandbox/browserContext.js 传入宿主桥接对象后调用。
 * 宿主对象只保存在闭包里；暴露给脚本的都是本 realm 的函数，并且与宿主之间只交换字符串等原始值，
 * 因此脚本无法通过 constructor 链拿到宿主 realm 的 Function / process。
 * 依赖：NativeFunction.js（safefunction）、WebIDL.js。
 */
(function installGlobalScope(host) {
    'use strict';

    const markNative = globalThis.safefunction;
    const idl = globalThis.__webidl__;

    // 内部对象：不可枚举，供后续 env 模块在加载时取用
    function defineInternal(name, value) {
        Object.defineProperty(globalThis, name, { value, writable: true, configurable: true });
    }

    function getterOf(object, key) {
        return markNative(Object.getOwnPropertyDescriptor(object, key).get);
    }

    function setterOf(object, key) {
        return markNative(Object.getOwnPropertyDescriptor(object, key).set);
    }

    // ==================== window / self ====================
    // window 是 [LegacyUnforgeable]（不可配置、无 setter）；self 是 [Replaceable]
    const windowAccessor = { get window() { return globalThis; } };
    Object.defineProperty(globalThis, 'window', {
        get: getterOf(windowAccessor, 'window'), enumerable: true, configurable: false
    });

    const selfAccessor = {
        get self() { return globalThis; },
        set self(value) {
            Object.defineProperty(globalThis, 'self', {
                value, writable: true, enumerable: true, configurable: true
            });
        }
    };
    Object.defineProperty(globalThis, 'self', {
        get: getterOf(selfAccessor, 'self'), set: setterOf(selfAccessor, 'self'),
        enumerable: true, configurable: true
    });

    // ==================== console ====================
    // 保留 V8 自带的 console 对象（形态与 Chrome 一致），只替换会产生输出的方法：
    // 先调用原生方法（调试器仍可见），再把参数转发给宿主输出
    const nativeConsole = globalThis.console;
    const forwardedLevels = {
        debug: 'debug', error: 'error', info: 'info', log: 'log', warn: 'warn',
        dir: 'log', dirxml: 'log', table: 'log', trace: 'log'
    };
    function forwardConsole(name, level) {
        const native = nativeConsole[name];
        const holder = {
            [name](...args) {
                native.apply(nativeConsole, args);
                host.print(level, args);
            }
        };
        nativeConsole[name] = markNative(holder[name]);
    }
    for (const [name, level] of Object.entries(forwardedLevels)) forwardConsole(name, level);

    const nativeAssert = nativeConsole.assert;
    const assertHolder = {
        assert(...args) {
            nativeAssert.apply(nativeConsole, args);
            if (!args[0]) host.print('error', ['Assertion failed:', ...args.slice(1)]);
        }
    };
    nativeConsole.assert = markNative(assertHolder.assert);

    // ==================== 宿主桥接 ====================
    // URL：宿主的 WHATWG URL 负责解析，这里只收发 JSON 字符串
    const urlBridge = Object.freeze({
        parse(input, base) {
            const json = host.url.parse(String(input), base === undefined ? undefined : String(base));
            return json === null ? null : JSON.parse(json);
        },
        update(href, name, value) {
            return JSON.parse(host.url.update(String(href), String(name), String(value)));
        },
        parseQuery(query) {
            return JSON.parse(host.url.parseQuery(String(query)));
        },
        serializeQuery(pairs) {
            return host.url.serializeQuery(JSON.stringify(pairs));
        }
    });
    // 定时器：宿主事件循环只负责一次性调度；keepAlive 为 false 时不阻止宿主等待空闲
    const timerBridge = Object.freeze({
        schedule(id, delay, keepAlive, callback) {
            host.timers.schedule(Number(id), Number(delay), keepAlive === true, callback);
        },
        cancel(id) {
            host.timers.cancel(Number(id));
        }
    });

    // ==================== 错误 stack ====================
    // 宿主通过 vm.runInContext 执行脚本，V8 会把 node:vm 与宿主文件的帧追加到 stack 上。
    // 按浏览器习惯只保留本 realm 的帧（Chrome 里 window.onerror 的 stack 也不含 Node 内部帧）。
    function isHostFrame(frame) {
        const fileName = frame.getFileName();
        // null / undefined：本 realm 的匿名或 eval 帧
        if (fileName === null || fileName === undefined) return false;
        // 宿主 Node 内建模块（node:vm、node:internal/...）与宿主项目文件（file://...）
        return fileName.startsWith('node:') || fileName.startsWith('file://') || fileName === '[eval]';
    }

    function formatFrame(frame) {
        const name = frame.getFunctionName() || frame.getMethodName() || '<anonymous>';
        const fileName = frame.getFileName() || '<anonymous>';
        return `    at ${name} (${fileName}:${frame.getLineNumber()}:${frame.getColumnNumber()})`;
    }

    const prepareStackTrace = function (error, stack) {
        const frames = stack.filter(frame => !isHostFrame(frame));
        return `${error.name}: ${error.message}\n${frames.map(formatFrame).join('\n')}`;
    };
    Object.defineProperty(Error, 'prepareStackTrace', {
        value: markNative(prepareStackTrace, 'prepareStackTrace'),
        writable: true, configurable: true
    });

    // 未捕获异常（定时器、微任务回调等）按浏览器习惯输出为 "Uncaught ..."
    function reportException(error) {
        host.print('error', ['Uncaught', error]);
    }

    const clockBridge = Object.freeze({
        origin() { return Number(host.clock.origin()); },
        now() { return Number(host.clock.now()); }
    });

    const cryptoBridge = Object.freeze({
        randomHex(length) { return String(host.crypto.randomHex(Number(length))); },
        digest(algorithm, hex) { return String(host.crypto.digest(String(algorithm), String(hex))); }
    });

    defineInternal('__host__', Object.freeze({
        url: urlBridge, timers: timerBridge, clock: clockBridge, crypto: cryptoBridge, reportException
    }));

    // HTML：宿主 parse5 解析为 JSON 树，css-select 在本 realm 的 DOM 节点上做选择
    function invalidSelector(selector) {
        return new DOMException(`'${selector}' is not a valid selector.`, 'SyntaxError');
    }
    const htmlBridge = Object.freeze({
        parseDocument(html) {
            return JSON.parse(host.html.parseDocument(String(html)));
        },
        parseFragment(html) {
            return JSON.parse(host.html.parseFragment(String(html)));
        },
        select(root, selector, includeRoot = false) {
            let found;
            try {
                found = host.html.select(root, String(selector), includeRoot === true);
            } catch (_) {
                throw invalidSelector(selector);
            }
            return Array.from(found);
        },
        matches(node, selector) {
            try {
                return host.html.matches(node, String(selector)) === true;
            } catch (_) {
                throw invalidSelector(selector);
            }
        }
    });
    defineInternal('__htmlBridge__', htmlBridge);

    // ==================== 基础占位 API（无 profile 时也存在） ====================
    // XMLHttpRequest 占位：只接受调用，不发请求
    idl.defineInterface('XMLHttpRequest', {
        construct() {},
        methods: {
            open(method, url) {},
            send(body = null) {},
            setRequestHeader(name, value) {}
        }
    });
})
