/**
 * @env-module timers
 * @description HTML 定时器与微任务：setTimeout/setInterval/clearTimeout/clearInterval/queueMicrotask，
 *              经宿主事件循环真实调度；嵌套超过 5 层且间隔小于 4ms 时按 HTML 规范钳制为 4ms
 * @compatibility Chrome 120+
 */
(function () {
    'use strict';

    const markNative = window.safefunction;
    const host = window.__host__;
    // 加载时捕获内建函数，页面脚本改写 Promise.prototype.then / Reflect 不影响调度
    const apply = Reflect.apply;
    const promiseThen = Promise.prototype.then;
    const resolvedPromise = Promise.resolve();
    const indirectEval = eval;

    const active = new Map();   // 定时器 id → 定时器记录
    let lastId = 0;
    // 正在执行的定时器任务的嵌套层级；不在定时器任务中时为 0
    let currentNesting = 0;

    function requireArguments(name, count) {
        if (count < 1) {
            throw new TypeError(`Failed to execute '${name}' on 'Window': 1 argument required, but only 0 present.`);
        }
    }

    // WebIDL long 转换（ToInt32），负数按 0 处理
    function toTimeout(value) {
        const timeout = Number(value) | 0;
        return timeout < 0 ? 0 : timeout;
    }

    // HTML 规范 "timer initialization steps" 中的嵌套层级与 4ms 钳制
    function schedule(timer) {
        timer.nesting = currentNesting + 1;
        const delay = timer.nesting > 5 && timer.timeout < 4 ? 4 : timer.timeout;
        // setTimeout 让宿主保持等待；setInterval 不阻止宿主在空闲时结束
        host.timers.schedule(timer.id, delay, !timer.repeat, () => run(timer));
    }

    function invoke(timer) {
        if (typeof timer.handler === 'function') {
            apply(timer.handler, window, timer.args);
        } else {
            indirectEval(timer.handler);
        }
    }

    function run(timer) {
        if (active.get(timer.id) !== timer) return;
        if (!timer.repeat) active.delete(timer.id);
        currentNesting = timer.nesting;
        try {
            invoke(timer);
        } catch (error) {
            host.reportException(error);
        }
        if (timer.repeat && active.get(timer.id) === timer) schedule(timer);
        currentNesting = 0;
    }

    function start(handler, timeout, args, repeat) {
        const timer = {
            id: ++lastId,
            // 非函数的 handler 按 DOMString 处理，触发时在全局作用域求值
            handler: typeof handler === 'function' ? handler : String(handler),
            timeout: toTimeout(timeout),
            args,
            repeat,
            nesting: 0
        };
        active.set(timer.id, timer);
        schedule(timer);
        return timer.id;
    }

    function stop(id) {
        const key = Number(id) | 0;
        if (!active.has(key)) return;
        active.delete(key);
        host.timers.cancel(key);
    }

    const holder = {
        setTimeout(handler, timeout = 0, ...args) {
            requireArguments('setTimeout', arguments.length);
            return start(handler, timeout, args, false);
        },
        clearTimeout(id = 0) {
            stop(id);
        },
        setInterval(handler, timeout = 0, ...args) {
            requireArguments('setInterval', arguments.length);
            return start(handler, timeout, args, true);
        },
        clearInterval(id = 0) {
            stop(id);
        },
        queueMicrotask(callback) {
            requireArguments('queueMicrotask', arguments.length);
            if (typeof callback !== 'function') {
                throw new TypeError("Failed to execute 'queueMicrotask' on 'Window': The callback provided as parameter 1 is not a function.");
            }
            apply(promiseThen, resolvedPromise, [() => {
                try {
                    callback();
                } catch (error) {
                    host.reportException(error);
                }
            }]);
        }
    };

    for (const name of Object.keys(holder)) {
        window[name] = markNative(holder[name]);
    }
})();
