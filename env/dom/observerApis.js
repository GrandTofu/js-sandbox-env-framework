/**
 * @env-module observerApis
 * @description MutationObserver / MutationRecord / ResizeObserver / IntersectionObserver：按 WebIDL 定义；
 * MutationObserver 按 DOM 规范在微任务中投递 document.js 上报的 childList / attributes / characterData 变更
 * @compatibility Chrome 120+
 *
 * document.js 通过 window.__mutationQueue__.queue(type, target, fields) 上报变更。
 * 依赖：WebIDL.js、GlobalScope.js（__host__.reportException）、timeout.js、document.js（NodeList、DOMRect，运行时使用）。
 */
(function () {
    'use strict';

    const idl = window.__webidl__;
    const reportException = window.__host__.reportException;

    function isNode(value) {
        return value !== null && typeof value === 'object' && value !== window &&
            idl.is(value, 'EventTarget') && typeof value.nodeType === 'number';
    }

    function nodeList(nodes) {
        const list = Object.create(window.NodeList.prototype);
        nodes.forEach((node, index) => Object.defineProperty(list, index,
            { value: node, enumerable: true, configurable: true }));
        Object.defineProperty(list, 'length', { value: nodes.length });
        return list;
    }

    function field(key) {
        return function () { return idl.internal(this)[key]; };
    }

    function invokeCallback(callback, thisArg, args) {
        try {
            callback.apply(thisArg, args);
        } catch (error) {
            reportException(error);
        }
    }

    // ==================== MutationObserver ====================
    idl.defineInterface('MutationRecord', {
        attributes: {
            type: field('type'),
            target: field('target'),
            addedNodes: field('addedNodes'),
            removedNodes: field('removedNodes'),
            previousSibling: field('previousSibling'),
            nextSibling: field('nextSibling'),
            attributeName: field('attributeName'),
            attributeNamespace: field('attributeNamespace'),
            oldValue: field('oldValue')
        }
    });

    // 节点 → [{ observer, options }]
    const registrations = new WeakMap();
    const pendingObservers = new Set();
    let notifyScheduled = false;

    function registrationsOf(node) {
        let list = registrations.get(node);
        if (!list) {
            list = [];
            registrations.set(node, list);
        }
        return list;
    }

    function notifyObservers() {
        notifyScheduled = false;
        const observers = Array.from(pendingObservers);
        pendingObservers.clear();
        for (const observer of observers) {
            const state = idl.internal(observer);
            const records = state.records.splice(0);
            if (records.length) invokeCallback(state.callback, observer, [records, observer]);
        }
    }

    function interested(options, type, target, node, fields) {
        if (node !== target && !options.subtree) return false;
        if (type === 'attributes') {
            if (!options.attributes) return false;
            return !options.attributeFilter || options.attributeFilter.includes(fields.attributeName);
        }
        if (type === 'characterData') return !!options.characterData;
        return !!options.childList;
    }

    function queue(type, target, fields) {
        const matches = new Map();
        for (let node = target; node; node = node.parentNode) {
            for (const { observer, options } of registrations.get(node) || []) {
                if (!interested(options, type, target, node, fields)) continue;
                const wantsOld = type === 'attributes' ? options.attributeOldValue :
                    type === 'characterData' ? options.characterDataOldValue : false;
                if (!matches.has(observer) || wantsOld) matches.set(observer, !!wantsOld || matches.get(observer));
            }
        }
        for (const [observer, wantsOld] of matches) {
            idl.internal(observer).records.push(idl.create('MutationRecord', {
                type,
                target,
                addedNodes: nodeList(fields.addedNodes || []),
                removedNodes: nodeList(fields.removedNodes || []),
                previousSibling: fields.previousSibling ?? null,
                nextSibling: fields.nextSibling ?? null,
                attributeName: fields.attributeName ?? null,
                attributeNamespace: null,
                oldValue: wantsOld ? (fields.oldValue ?? null) : null
            }));
            pendingObservers.add(observer);
        }
        if (matches.size && !notifyScheduled) {
            notifyScheduled = true;
            window.queueMicrotask(notifyObservers);
        }
    }

    function normalizeObserveOptions(options) {
        const init = options === undefined || options === null ? {} : options;
        const result = {
            childList: !!init.childList,
            subtree: !!init.subtree,
            attributeOldValue: init.attributeOldValue === undefined ? undefined : !!init.attributeOldValue,
            characterDataOldValue: init.characterDataOldValue === undefined ? undefined : !!init.characterDataOldValue,
            attributeFilter: init.attributeFilter === undefined ? undefined : Array.from(init.attributeFilter, String),
            attributes: init.attributes === undefined ? undefined : !!init.attributes,
            characterData: init.characterData === undefined ? undefined : !!init.characterData
        };
        const prefix = "Failed to execute 'observe' on 'MutationObserver': ";
        if (result.attributes === undefined && (result.attributeOldValue !== undefined || result.attributeFilter !== undefined)) {
            result.attributes = true;
        }
        if (result.characterData === undefined && result.characterDataOldValue !== undefined) result.characterData = true;
        if (!result.childList && !result.attributes && !result.characterData) {
            throw new TypeError(prefix + "The options object must set at least one of 'attributes', 'characterData', or 'childList' to true.");
        }
        if (result.attributeOldValue && !result.attributes) {
            throw new TypeError(prefix + "The options object may only set 'attributeOldValue' to true when 'attributes' is true or not present.");
        }
        if (result.attributeFilter && !result.attributes) {
            throw new TypeError(prefix + "The options object may only set 'attributeFilter' when 'attributes' is true or not present.");
        }
        if (result.characterDataOldValue && !result.characterData) {
            throw new TypeError(prefix + "The options object may only set 'characterDataOldValue' to true when 'characterData' is true or not present.");
        }
        return result;
    }

    idl.defineInterface('MutationObserver', {
        length: 1,
        construct(callback) {
            if (typeof callback !== 'function') {
                throw new TypeError("Failed to construct 'MutationObserver': parameter 1 is not of type 'MutationCallback'.");
            }
            Object.assign(idl.internal(this), { callback, records: [], targets: new Set() });
        },
        methods: {
            observe(target, options = {}) {
                if (!isNode(target)) {
                    throw new TypeError("Failed to execute 'observe' on 'MutationObserver': parameter 1 is not of type 'Node'.");
                }
                const normalized = normalizeObserveOptions(options);
                const list = registrationsOf(target);
                const existing = list.find(item => item.observer === this);
                if (existing) existing.options = normalized;
                else list.push({ observer: this, options: normalized });
                idl.internal(this).targets.add(target);
            },
            disconnect() {
                const state = idl.internal(this);
                for (const target of state.targets) {
                    const list = registrations.get(target);
                    if (list) registrations.set(target, list.filter(item => item.observer !== this));
                }
                state.targets.clear();
                state.records.length = 0;
                pendingObservers.delete(this);
            },
            takeRecords() {
                return idl.internal(this).records.splice(0);
            }
        }
    });

    Object.defineProperty(window, '__mutationQueue__', {
        value: Object.freeze({ queue }), configurable: true
    });

    // ==================== ResizeObserver ====================
    // 没有布局引擎：尺寸为 0；与浏览器一样在 observe 之后的下一帧投递一次初始观测
    function checkElement(target, interfaceName) {
        if (!isNode(target) || target.nodeType !== 1) {
            throw new TypeError(`Failed to execute 'observe' on '${interfaceName}': parameter 1 is not of type 'Element'.`);
        }
    }

    function nextFrame(callback) {
        setTimeout(callback, 16);
    }

    idl.defineInterface('ResizeObserverSize', {
        attributes: { inlineSize: field('inlineSize'), blockSize: field('blockSize') }
    });

    idl.defineInterface('ResizeObserverEntry', {
        attributes: {
            target: field('target'),
            contentRect: field('contentRect'),
            borderBoxSize: field('borderBoxSize'),
            contentBoxSize: field('contentBoxSize'),
            devicePixelContentBoxSize: field('devicePixelContentBoxSize')
        }
    });

    function resizeEntry(target) {
        const sizes = () => Object.freeze([idl.create('ResizeObserverSize', { inlineSize: 0, blockSize: 0 })]);
        return idl.create('ResizeObserverEntry', {
            target, contentRect: new window.DOMRect(0, 0, 0, 0),
            borderBoxSize: sizes(), contentBoxSize: sizes(), devicePixelContentBoxSize: sizes()
        });
    }

    idl.defineInterface('ResizeObserver', {
        length: 1,
        construct(callback) {
            if (typeof callback !== 'function') {
                throw new TypeError("Failed to construct 'ResizeObserver': parameter 1 is not of type 'ResizeObserverCallback'.");
            }
            Object.assign(idl.internal(this), { callback, targets: new Set() });
        },
        methods: {
            observe(target, options = {}) {
                checkElement(target, 'ResizeObserver');
                const state = idl.internal(this);
                if (state.targets.has(target)) return;
                state.targets.add(target);
                nextFrame(() => {
                    if (state.targets.has(target)) invokeCallback(state.callback, this, [[resizeEntry(target)], this]);
                });
            },
            unobserve(target) {
                checkElement(target, 'ResizeObserver');
                idl.internal(this).targets.delete(target);
            },
            disconnect() {
                idl.internal(this).targets.clear();
            }
        }
    });

    // ==================== IntersectionObserver ====================
    idl.defineInterface('IntersectionObserverEntry', {
        attributes: {
            time: field('time'),
            rootBounds: field('rootBounds'),
            boundingClientRect: field('boundingClientRect'),
            intersectionRect: field('intersectionRect'),
            isIntersecting: field('isIntersecting'),
            intersectionRatio: field('intersectionRatio'),
            target: field('target')
        }
    });

    function thresholdsOf(value) {
        const list = value === undefined ? [0] : (Array.isArray(value) ? value : [value]).map(Number);
        for (const threshold of list) {
            if (!(threshold >= 0 && threshold <= 1)) {
                throw new RangeError("Failed to construct 'IntersectionObserver': Threshold values must be numbers between 0 and 1");
            }
        }
        return Object.freeze(list.slice().sort((a, b) => a - b));
    }

    // 已连接的零尺寸元素位于视口内：isIntersecting 为 true，比例为 1（与 Chrome 对零面积目标的处理一致）
    function intersectionEntry(target) {
        const connected = target.isConnected;
        const box = target.getBoundingClientRect();
        return idl.create('IntersectionObserverEntry', {
            time: window.performance.now(),
            rootBounds: new window.DOMRect(0, 0, window.innerWidth, window.innerHeight),
            boundingClientRect: box,
            intersectionRect: connected ? box : new window.DOMRect(0, 0, 0, 0),
            isIntersecting: connected,
            intersectionRatio: connected ? 1 : 0,
            target
        });
    }

    idl.defineInterface('IntersectionObserver', {
        length: 1,
        construct(callback, options = {}) {
            if (typeof callback !== 'function') {
                throw new TypeError("Failed to construct 'IntersectionObserver': parameter 1 is not of type 'IntersectionObserverCallback'.");
            }
            const init = options === null || options === undefined ? {} : options;
            Object.assign(idl.internal(this), {
                callback, targets: new Set(), records: [],
                root: init.root ?? null,
                rootMargin: init.rootMargin === undefined ? '0px 0px 0px 0px' : String(init.rootMargin),
                thresholds: thresholdsOf(init.threshold)
            });
        },
        attributes: {
            root: field('root'),
            rootMargin: field('rootMargin'),
            thresholds: field('thresholds')
        },
        methods: {
            observe(target) {
                checkElement(target, 'IntersectionObserver');
                const state = idl.internal(this);
                if (state.targets.has(target)) return;
                state.targets.add(target);
                nextFrame(() => {
                    if (!state.targets.has(target)) return;
                    state.records.push(intersectionEntry(target));
                    const records = state.records.splice(0);
                    if (records.length) invokeCallback(state.callback, this, [records, this]);
                });
            },
            unobserve(target) {
                checkElement(target, 'IntersectionObserver');
                idl.internal(this).targets.delete(target);
            },
            disconnect() {
                const state = idl.internal(this);
                state.targets.clear();
                state.records.length = 0;
            },
            takeRecords() {
                return idl.internal(this).records.splice(0);
            }
        }
    });
})();
