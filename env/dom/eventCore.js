/**
 * @env-module eventCore
 * @description EventTarget / Event / AbortSignal / AbortController：按 WebIDL 定义，属性为原型访问器，isTrusted 为实例上的不可伪造属性，派发状态不暴露在对象上
 * @compatibility Chrome 120+
 *
 * event.js 中仍用旧式构造函数的事件子类（MouseEvent 等）通过 window.__eventInternals__.initLegacy 获得 Event 身份；
 * 自行实现派发的模块（document.js、window.js）通过 update / propagationStopped / immediatePropagationStopped 读写派发状态。
 * 依赖：WebIDL.js、domexception.js、timeout.js、GlobalScope.js（__host__.reportException）、performance.js。
 */
(function () {
    'use strict';

    const idl = window.__webidl__;
    const reportException = window.__host__.reportException;
    const Monitor = window.__EnvMonitor__ || window.__envMonitor__ || { log: function() {} };

    const NONE = 0;
    const CAPTURING_PHASE = 1;
    const AT_TARGET = 2;
    const BUBBLING_PHASE = 3;

    // 事件处理属性（onabort 等）：非对象值存为 null
    function handlerAttribute(key) {
        return {
            get() { return idl.internal(this)[key] ?? null; },
            set(value) {
                const isObject = value !== null && (typeof value === 'object' || typeof value === 'function');
                idl.internal(this)[key] = isObject ? value : null;
            }
        };
    }

    // ==================== EventTarget ====================
    // 目标 → Map<type, listener[]>；监听器不存放在目标对象上
    const listenerMaps = new WeakMap();

    function listenersOf(target, type) {
        let map = listenerMaps.get(target);
        if (!map) {
            map = new Map();
            listenerMaps.set(target, map);
        }
        if (!map.has(type)) map.set(type, []);
        return map.get(type);
    }

    function captureOf(options) {
        if (typeof options === 'boolean') return options;
        return options !== null && typeof options === 'object' && !!options.capture;
    }

    function removeItem(list, item) {
        item.removed = true;
        list.splice(list.indexOf(item), 1);
    }

    // 监听器异常与浏览器一样报告为 Uncaught，不中断后续监听器
    function callListener(target, listener, event) {
        try {
            if (typeof listener === 'function') {
                listener.call(target, event);
            } else if (listener && typeof listener.handleEvent === 'function') {
                listener.handleEvent(event);
            }
        } catch (error) {
            reportException(error);
        }
    }

    // capture 为 true 时只调用捕获监听器；事件处理属性（onxxx）在非捕获监听器之后调用
    function invokeListeners(target, event, state, capture) {
        const list = listenersOf(target, state.type);
        for (const item of list.slice()) {
            if (state.stopImmediate) return;
            if (item.removed || item.capture !== capture) continue;
            if (item.once) removeItem(list, item);
            callListener(target, item.listener, event);
        }
        if (capture || state.stopImmediate) return;
        const handler = target['on' + state.type];
        if (typeof handler === 'function') callListener(target, handler, event);
    }

    // 事件路径：节点沿 parentNode 向上，到达 document 之后再加上 window
    function eventPath(target) {
        const path = [target];
        if (target === window) return path;
        for (let node = target.parentNode; node; node = node.parentNode) path.push(node);
        const last = path[path.length - 1];
        if (last && last.nodeType === 9) path.push(window);
        return path;
    }

    function invokeAt(node, phase, event, state, capture) {
        Object.assign(state, { currentTarget: node, eventPhase: phase });
        invokeListeners(node, event, state, capture);
    }

    const EventTarget = idl.defineInterface('EventTarget', {
        construct() {},
        methods: {
            addEventListener(type, listener, options = {}) {
                if (listener === null || listener === undefined) return;
                const key = String(type);
                const capture = captureOf(options);
                const isDictionary = options !== null && typeof options === 'object';
                const list = listenersOf(this, key);
                if (list.some(item => item.listener === listener && item.capture === capture)) return;
                list.push({ listener, capture, once: isDictionary && !!options.once, removed: false });
                Monitor.log('Event', 'addEventListener', { type: key, capture });
            },
            removeEventListener(type, listener, options = {}) {
                const key = String(type);
                const capture = captureOf(options);
                const list = listenersOf(this, key);
                const item = list.find(entry => entry.listener === listener && entry.capture === capture);
                if (item) removeItem(list, item);
                Monitor.log('Event', 'removeEventListener', { type: key });
            },
            dispatchEvent(event) {
                if (!idl.is(event, 'Event')) {
                    throw new TypeError("Failed to execute 'dispatchEvent' on 'EventTarget': parameter 1 is not of type 'Event'.");
                }
                const state = idl.internal(event);
                if (state.dispatching) {
                    throw new DOMException("Failed to execute 'dispatchEvent' on 'EventTarget': The event is already being dispatched.", 'InvalidStateError');
                }
                const path = eventPath(this);
                Object.assign(state, { dispatching: true, target: this });
                for (let i = path.length - 1; i > 0 && !state.stopPropagation; i--) {
                    invokeAt(path[i], CAPTURING_PHASE, event, state, true);
                }
                // 目标上同一节点的监听器不受 stopPropagation 影响：先捕获、后非捕获
                if (!state.stopPropagation) {
                    invokeAt(this, AT_TARGET, event, state, true);
                    invokeAt(this, AT_TARGET, event, state, false);
                }
                for (let i = 1; state.bubbles && i < path.length && !state.stopPropagation; i++) {
                    invokeAt(path[i], BUBBLING_PHASE, event, state, false);
                }
                Object.assign(state, {
                    dispatching: false, currentTarget: null, eventPhase: NONE,
                    stopPropagation: false, stopImmediate: false
                });
                Monitor.log('Event', 'dispatchEvent', { type: state.type, defaultPrevented: state.canceled });
                return !state.canceled;
            }
        }
    });
    const dispatch = EventTarget.prototype.dispatchEvent;

    // ==================== Event ====================
    function eventState(event) {
        return idl.internal(event);
    }

    function cancel(state) {
        if (state.cancelable) state.canceled = true;
    }

    const Event = idl.defineInterface('Event', {
        construct(type, eventInitDict = {}) {
            setupEvent(this, type, eventInitDict);
        },
        constants: { NONE: 0, CAPTURING_PHASE: 1, AT_TARGET: 2, BUBBLING_PHASE: 3 },
        attributes: {
            type() { return eventState(this).type; },
            target() { return eventState(this).target; },
            currentTarget() { return eventState(this).currentTarget; },
            eventPhase() { return eventState(this).eventPhase; },
            bubbles() { return eventState(this).bubbles; },
            cancelable() { return eventState(this).cancelable; },
            defaultPrevented() { return eventState(this).canceled; },
            composed() { return eventState(this).composed; },
            timeStamp() { return eventState(this).timeStamp; },
            srcElement() { return eventState(this).target; },
            returnValue: {
                get() { return !eventState(this).canceled; },
                set(value) { if (!value) cancel(eventState(this)); }
            },
            cancelBubble: {
                get() { return eventState(this).stopPropagation; },
                set(value) { if (value) eventState(this).stopPropagation = true; }
            }
        },
        methods: {
            composedPath() {
                const state = eventState(this);
                if (state.currentTarget === null) return [];
                const path = [];
                for (let node = state.target; node; node = node.parentNode) path.push(node);
                // 节点树的路径在 document 之后还有 window
                if (path.length && path[path.length - 1].nodeType === 9) path.push(window);
                return path;
            },
            initEvent(type, bubbles = false, cancelable = false) {
                const state = eventState(this);
                if (state.dispatching) return;
                Object.assign(state, {
                    type: String(type), bubbles: !!bubbles, cancelable: !!cancelable, target: null,
                    canceled: false, stopPropagation: false, stopImmediate: false
                });
            },
            preventDefault() {
                const state = eventState(this);
                cancel(state);
                Monitor.log('Event', 'preventDefault', { type: state.type });
            },
            stopImmediatePropagation() {
                const state = eventState(this);
                state.stopPropagation = true;
                state.stopImmediate = true;
            },
            stopPropagation() {
                eventState(this).stopPropagation = true;
            }
        }
    });

    // isTrusted 是 [LegacyUnforgeable]：定义在每个实例上，所有实例共用同一个 getter
    const trustedHolder = idl.defineMembers({}, 'Event', {
        attributes: { isTrusted: { get() { return eventState(this).trusted; }, configurable: false } }
    });
    const trustedDescriptor = Object.getOwnPropertyDescriptor(trustedHolder, 'isTrusted');

    function setupEvent(object, type, eventInitDict) {
        const init = eventInitDict === undefined || eventInitDict === null ? {} : eventInitDict;
        if (typeof init !== 'object' && typeof init !== 'function') {
            throw new TypeError("Failed to construct 'Event': The provided value is not of type 'EventInit'.");
        }
        const perf = window.performance;
        Object.assign(idl.internal(object), {
            type: String(type), bubbles: !!init.bubbles, cancelable: !!init.cancelable, composed: !!init.composed,
            target: null, currentTarget: null, eventPhase: NONE, canceled: false,
            stopPropagation: false, stopImmediate: false, dispatching: false, trusted: false,
            timeStamp: perf && typeof perf.now === 'function' ? perf.now() : 0
        });
        Object.defineProperty(object, 'isTrusted', trustedDescriptor);
        Monitor.log('Event', 'create', { type: String(type), bubbles: !!init.bubbles, cancelable: !!init.cancelable });
    }

    // ==================== AbortSignal / AbortController ====================
    function createSignal() {
        return idl.create('AbortSignal', { aborted: false, reason: undefined, dependents: [] });
    }

    function abortReason(reason) {
        return reason !== undefined ? reason : new DOMException('signal is aborted without reason', 'AbortError');
    }

    // 先派发自身的 abort 事件，再中止由 AbortSignal.any() 派生的信号
    function signalAbort(signal, reason) {
        const state = idl.internal(signal);
        if (state.aborted) return;
        state.aborted = true;
        state.reason = reason;
        const dependents = state.dependents.splice(0);
        dispatch.call(signal, new Event('abort'));
        for (const dependent of dependents) signalAbort(dependent, reason);
    }

    idl.defineInterface('AbortSignal', {
        parent: 'EventTarget',
        attributes: {
            aborted() { return idl.internal(this).aborted; },
            reason() { return idl.internal(this).reason; },
            onabort: handlerAttribute('onabort')
        },
        methods: {
            throwIfAborted() {
                const state = idl.internal(this);
                if (state.aborted) throw state.reason;
            }
        },
        statics: {
            abort(reason = undefined) {
                const signal = createSignal();
                Object.assign(idl.internal(signal), { aborted: true, reason: abortReason(reason) });
                return signal;
            },
            timeout(milliseconds) {
                const signal = createSignal();
                setTimeout(() => signalAbort(signal, new DOMException('signal timed out', 'TimeoutError')), Number(milliseconds));
                return signal;
            },
            any(signals) {
                const sources = Array.from(signals);
                for (const source of sources) {
                    if (!idl.is(source, 'AbortSignal')) {
                        throw new TypeError("Failed to execute 'any' on 'AbortSignal': Failed to convert value to 'AbortSignal'.");
                    }
                }
                const result = createSignal();
                const aborted = sources.find(source => idl.internal(source).aborted);
                if (aborted) {
                    Object.assign(idl.internal(result), { aborted: true, reason: idl.internal(aborted).reason });
                    return result;
                }
                for (const source of sources) idl.internal(source).dependents.push(result);
                return result;
            }
        }
    });

    idl.defineInterface('AbortController', {
        construct() {
            idl.internal(this).signal = createSignal();
        },
        attributes: {
            signal() { return idl.internal(this).signal; }
        },
        methods: {
            abort(reason = undefined) {
                signalAbort(idl.internal(this).signal, abortReason(reason));
                Monitor.log('Event', 'AbortController.abort', { reason: String(reason) });
            }
        }
    });

    // ==================== 内部接口 ====================
    function initLegacy(object, type, eventInitDict) {
        idl.brand(object, 'Event');
        setupEvent(object, type, eventInitDict);
    }

    // 不是 Event 的普通对象（如 history.js 派发的 popstate 占位对象）照旧直接赋值
    const dispatchFields = new Set(['target', 'currentTarget', 'eventPhase']);
    function update(event, fields) {
        const isEvent = idl.is(event, 'Event');
        for (const [key, value] of Object.entries(fields)) {
            if (!dispatchFields.has(key)) continue;
            if (isEvent) eventState(event)[key] = value;
            else event[key] = value;
        }
    }

    function propagationStopped(event) {
        return idl.is(event, 'Event') && eventState(event).stopPropagation;
    }

    function immediatePropagationStopped(event) {
        return idl.is(event, 'Event') && eventState(event).stopImmediate;
    }

    // ==================== Window 继承 EventTarget ====================
    // window.js 先于本文件加载并定义了 Window；这里把原型链接到 EventTarget，并登记全局对象的身份
    if (typeof window.Window === 'function') {
        Object.setPrototypeOf(window.Window.prototype, EventTarget.prototype);
        Object.setPrototypeOf(window.Window, EventTarget);
    }
    idl.brand(window, 'EventTarget');

    Object.defineProperty(window, '__eventInternals__', {
        value: Object.freeze({ setup: setupEvent, initLegacy, update, propagationStopped, immediatePropagationStopped }),
        configurable: true
    });
})();
