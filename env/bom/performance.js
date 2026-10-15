/**
 * @env-module performance
 * @description Performance / PerformanceTiming / PerformanceNavigation / MemoryInfo / PerformanceEntry：按 WebIDL 定义，Performance 继承 EventTarget；now() 取宿主高精度时钟，按 Chrome 精度保留 0.1ms
 * @compatibility Chrome 120+
 *
 * profile.performance 可配置 memory（jsHeapSizeLimit 等）与 navigationOffset（页面加载到脚本执行的毫秒数）。
 * 采集快照通过 window.__applyPerformanceSnapshot__(data) 写入 timing / memory。
 * 依赖：WebIDL.js、GlobalScope.js（__host__.clock）、eventCore.js（EventTarget）。
 */
(function () {
    'use strict';

    const idl = window.__webidl__;
    const clock = window.__host__.clock;
    const markNative = window.safefunction;
    const profile = (window.__profile__ && window.__profile__.performance) || {};

    // 脚本开始执行时页面已加载一段时间，now() 从这个偏移开始计时
    const navigationOffset = typeof profile.navigationOffset === 'number' ? profile.navigationOffset : 220;
    const clockBase = clock.now();
    function elapsed() {
        return clock.now() - clockBase + navigationOffset;
    }
    // Chrome 对 now() / timeOrigin 做 0.1ms 粗化
    function coarsen(value) {
        return Math.round(value * 10) / 10;
    }
    const timeOrigin = coarsen(Date.now() - navigationOffset + (clock.origin() % 1));
    const navigationStart = Math.round(timeOrigin);

    function field(key) {
        return function() { return idl.internal(this)[key]; };
    }

    // ==================== PerformanceTiming ====================
    const timingKeys = [
        'navigationStart', 'unloadEventStart', 'unloadEventEnd', 'redirectStart', 'redirectEnd',
        'fetchStart', 'domainLookupStart', 'domainLookupEnd', 'connectStart', 'connectEnd',
        'secureConnectionStart', 'requestStart', 'responseStart', 'responseEnd', 'domLoading',
        'domInteractive', 'domContentLoadedEventStart', 'domContentLoadedEventEnd', 'domComplete',
        'loadEventStart', 'loadEventEnd'
    ];
    const timingOffsets = {
        navigationStart: 0, unloadEventStart: 0, unloadEventEnd: 0, redirectStart: 0, redirectEnd: 0,
        fetchStart: 2, domainLookupStart: 2, domainLookupEnd: 2, connectStart: 2, connectEnd: 2,
        secureConnectionStart: 0, requestStart: 5, responseStart: 40, responseEnd: 55, domLoading: 60,
        domInteractive: 120, domContentLoadedEventStart: 120, domContentLoadedEventEnd: 125,
        domComplete: 200, loadEventStart: 205, loadEventEnd: 210
    };
    const timingState = {};
    for (const key of timingKeys) {
        const offset = timingOffsets[key];
        // 未发生的阶段（unload、redirect、非 https 之外的 secureConnection）在 Chrome 中为 0
        timingState[key] = offset === 0 && key !== 'navigationStart' ? 0 : navigationStart + offset;
    }

    const timingAttributes = {};
    for (const key of timingKeys) timingAttributes[key] = field(key);
    idl.defineInterface('PerformanceTiming', {
        attributes: timingAttributes,
        methods: {
            toJSON() {
                const state = idl.internal(this);
                const result = {};
                for (const key of timingKeys) result[key] = state[key];
                return result;
            }
        }
    });

    // ==================== PerformanceNavigation ====================
    idl.defineInterface('PerformanceNavigation', {
        constants: { TYPE_NAVIGATE: 0, TYPE_RELOAD: 1, TYPE_BACK_FORWARD: 2, TYPE_RESERVED: 255 },
        attributes: { type: field('type'), redirectCount: field('redirectCount') },
        methods: {
            toJSON() {
                const state = idl.internal(this);
                return { type: state.type, redirectCount: state.redirectCount };
            }
        }
    });

    // ==================== MemoryInfo（Chrome 专有） ====================
    idl.defineInterface('MemoryInfo', {
        attributes: {
            jsHeapSizeLimit: field('jsHeapSizeLimit'),
            totalJSHeapSize: field('totalJSHeapSize'),
            usedJSHeapSize: field('usedJSHeapSize')
        }
    });
    const memoryProfile = profile.memory || {};
    const memoryState = {
        jsHeapSizeLimit: memoryProfile.jsHeapSizeLimit || 4294705152,
        totalJSHeapSize: memoryProfile.totalJSHeapSize || 12500000,
        usedJSHeapSize: memoryProfile.usedJSHeapSize || 9800000
    };

    // ==================== PerformanceEntry / Mark / Measure ====================
    function entryJSON(entry) {
        const state = idl.internal(entry);
        return { name: state.name, entryType: state.entryType, startTime: state.startTime, duration: state.duration };
    }

    idl.defineInterface('PerformanceEntry', {
        attributes: {
            name: field('name'),
            entryType: field('entryType'),
            startTime: field('startTime'),
            duration: field('duration')
        },
        methods: { toJSON() { return entryJSON(this); } }
    });
    const withDetail = {
        attributes: { detail: field('detail') },
        methods: {
            toJSON() { return Object.assign(entryJSON(this), { detail: idl.internal(this).detail }); }
        }
    };
    idl.defineInterface('PerformanceMark', Object.assign({ parent: 'PerformanceEntry' }, withDetail));
    idl.defineInterface('PerformanceMeasure', Object.assign({ parent: 'PerformanceEntry' }, withDetail));

    function cloneDetail(detail) {
        return detail === undefined ? null : structuredClone(detail);
    }

    // ==================== Performance ====================
    const entries = [];

    function markTime(name, method) {
        const found = entries.filter(entry => {
            const state = idl.internal(entry);
            return state.entryType === 'mark' && state.name === name;
        }).pop();
        if (found) return idl.internal(found).startTime;
        if (timingKeys.includes(name)) return timingState[name] ? timingState[name] - navigationStart : 0;
        throw new DOMException(`Failed to execute '${method}' on 'Performance': The mark '${name}' does not exist.`, 'SyntaxError');
    }

    function timeOf(value, method) {
        return typeof value === 'string' ? markTime(value, method) : Number(value);
    }

    function clearEntries(type, name) {
        for (let i = entries.length - 1; i >= 0; i--) {
            const state = idl.internal(entries[i]);
            if (state.entryType === type && (name === undefined || state.name === String(name))) entries.splice(i, 1);
        }
    }

    function listEntries(filter) {
        return entries.filter(entry => filter(idl.internal(entry)))
            .sort((a, b) => idl.internal(a).startTime - idl.internal(b).startTime);
    }

    const perfState = {
        timing: idl.create('PerformanceTiming', timingState),
        navigation: idl.create('PerformanceNavigation', { type: 0, redirectCount: 0 }),
        memory: idl.create('MemoryInfo', memoryState)
    };

    idl.defineInterface('Performance', {
        parent: 'EventTarget',
        attributes: {
            timeOrigin() { return timeOrigin; },
            timing: field('timing'),
            navigation: field('navigation'),
            memory: field('memory'),
            onresourcetimingbufferfull: {
                get() { return idl.internal(this).onresourcetimingbufferfull ?? null; },
                set(value) {
                    const isObject = value !== null && (typeof value === 'object' || typeof value === 'function');
                    idl.internal(this).onresourcetimingbufferfull = isObject ? value : null;
                }
            }
        },
        methods: {
            now() { return coarsen(elapsed()); },
            mark(markName, markOptions = {}) {
                const options = markOptions || {};
                const startTime = options.startTime !== undefined ? Number(options.startTime) : coarsen(elapsed());
                if (startTime < 0) {
                    throw new TypeError(`Failed to execute 'mark' on 'Performance': '${markName}' cannot have a negative start time.`);
                }
                const entry = idl.create('PerformanceMark', {
                    name: String(markName), entryType: 'mark', startTime, duration: 0,
                    detail: cloneDetail(options.detail)
                });
                entries.push(entry);
                return entry;
            },
            measure(measureName, startOrMeasureOptions = {}, endMark = undefined) {
                let start = 0;
                let end = coarsen(elapsed());
                let detail = null;
                const method = 'measure';
                if (startOrMeasureOptions !== null && typeof startOrMeasureOptions === 'object') {
                    const options = startOrMeasureOptions;
                    if (options.start !== undefined) start = timeOf(options.start, method);
                    if (options.end !== undefined) end = timeOf(options.end, method);
                    if (options.duration !== undefined) {
                        if (options.end !== undefined && options.start === undefined) start = end - Number(options.duration);
                        else end = start + Number(options.duration);
                    }
                    detail = cloneDetail(options.detail);
                } else if (startOrMeasureOptions !== undefined) {
                    start = timeOf(String(startOrMeasureOptions), method);
                }
                if (endMark !== undefined) end = timeOf(String(endMark), method);
                const entry = idl.create('PerformanceMeasure', {
                    name: String(measureName), entryType: 'measure', startTime: start, duration: end - start, detail
                });
                entries.push(entry);
                return entry;
            },
            clearMarks(markName = undefined) { clearEntries('mark', markName); },
            clearMeasures(measureName = undefined) { clearEntries('measure', measureName); },
            getEntries() { return listEntries(() => true); },
            getEntriesByType(type) { return listEntries(state => state.entryType === String(type)); },
            getEntriesByName(name, type = undefined) {
                return listEntries(state => state.name === String(name) &&
                    (type === undefined || state.entryType === String(type)));
            },
            clearResourceTimings() { clearEntries('resource'); },
            setResourceTimingBufferSize(maxSize) {},
            toJSON() {
                const state = idl.internal(this);
                return { timeOrigin, timing: state.timing.toJSON(), navigation: state.navigation.toJSON() };
            }
        }
    });
    const performance = idl.create('Performance', perfState);

    // ==================== PerformanceObserver ====================
    function PerformanceObserver(callback) {
        if (!new.target) throw new TypeError("Failed to construct 'PerformanceObserver': Please use the 'new' operator, this DOM object constructor cannot be called as a function.");
        if (typeof callback !== 'function') {
            throw new TypeError("Failed to construct 'PerformanceObserver': parameter 1 is not of type 'Function'.");
        }
        observerStates.set(this, { callback, entryTypes: [] });
    }
    const observerStates = new WeakMap();
    function observerState(object) {
        const state = observerStates.get(object);
        if (!state) throw new TypeError('Illegal invocation');
        return state;
    }
    const observerMethods = {
        observe(options = {}) {
            const state = observerState(this);
            if (options.entryTypes) state.entryTypes = Array.from(options.entryTypes, String);
            else if (options.type) state.entryTypes = [String(options.type)];
        },
        disconnect() { observerState(this).entryTypes = []; },
        takeRecords() { observerState(this); return []; }
    };
    for (const [key, method] of Object.entries(observerMethods)) {
        Object.defineProperty(PerformanceObserver.prototype, key, {
            value: markNative(method, key), writable: true, enumerable: true, configurable: true
        });
    }
    Object.defineProperty(PerformanceObserver.prototype, Symbol.toStringTag, {
        value: 'PerformanceObserver', configurable: true
    });
    const supportedEntryTypes = Object.freeze([
        'element', 'event', 'first-input', 'largest-contentful-paint', 'layout-shift', 'long-animation-frame',
        'longtask', 'mark', 'measure', 'navigation', 'paint', 'resource', 'visibility-state'
    ]);
    const supportedHolder = { get supportedEntryTypes() { return supportedEntryTypes; } };
    Object.defineProperty(PerformanceObserver, 'supportedEntryTypes', {
        get: markNative(Object.getOwnPropertyDescriptor(supportedHolder, 'supportedEntryTypes').get, 'get supportedEntryTypes'),
        enumerable: true, configurable: true
    });
    Object.defineProperty(window, 'PerformanceObserver', {
        value: markNative(PerformanceObserver, 'PerformanceObserver'), writable: true, configurable: true
    });

    // ==================== 采集快照写入 ====================
    Object.defineProperty(window, '__applyPerformanceSnapshot__', {
        value(data) {
            if (!data || typeof data !== 'object' || Array.isArray(data)) return;
            if (data.timing && typeof data.timing === 'object') {
                // 快照是采集时的绝对时间，按相对 navigationStart 的偏移换算到当前时间基准
                const base = Number(data.timing.navigationStart);
                for (const key of timingKeys) {
                    const value = Number(data.timing[key]);
                    if (!Number.isFinite(value)) continue;
                    timingState[key] = value === 0 ? 0 : (Number.isFinite(base) ? navigationStart + value - base : value);
                }
            }
            if (data.memory && typeof data.memory === 'object') {
                for (const key of Object.keys(memoryState)) {
                    if (typeof data.memory[key] === 'number') memoryState[key] = data.memory[key];
                }
            }
        },
        writable: true, configurable: true
    });

    // ==================== window.performance ====================
    // [Replaceable]：赋值后变成普通数据属性
    const accessors = {
        get performance() { return performance; },
        set performance(value) {
            Object.defineProperty(window, 'performance', { value, writable: true, enumerable: true, configurable: true });
        }
    };
    const descriptor = Object.getOwnPropertyDescriptor(accessors, 'performance');
    Object.defineProperty(window, 'performance', {
        get: markNative(descriptor.get, 'get performance'),
        set: markNative(descriptor.set, 'set performance'),
        enumerable: true, configurable: true
    });
})();
