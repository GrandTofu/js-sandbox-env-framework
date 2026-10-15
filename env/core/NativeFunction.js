/** Mark modeled browser functions while leaving user script functions inspectable. */
(function () {
    'use strict';
    const original = Function.prototype.toString;
    const nativeSources = new WeakMap();

    function safefunction(fn, name = fn.name) {
        if (typeof fn !== 'function') return fn;
        nativeSources.set(fn, `function ${name || ''}() { [native code] }`);
        return fn;
    }

    const toString = function toString() {
        if (typeof this !== 'function') return original.call(this);
        return nativeSources.get(this) || original.call(this);
    };
    Object.defineProperty(Function.prototype, 'toString', {
        value: toString, writable: true, configurable: true
    });
    safefunction(toString, 'toString');

    // 已登记的函数保持原名：别名（如 webkitURL === URL）不能覆盖真实名称
    function markIfNew(fn, name) {
        if (typeof fn === 'function' && !nativeSources.has(fn)) safefunction(fn, name);
    }

    function markOwnMethods(object) {
        if (!object || (typeof object !== 'object' && typeof object !== 'function')) return;
        for (const key of Object.getOwnPropertyNames(object)) {
            if (key === 'constructor' || key === 'caller' || key === 'arguments') continue;
            const descriptor = Object.getOwnPropertyDescriptor(object, key);
            if (!descriptor) continue;
            markIfNew(descriptor.value, key);
            markIfNew(descriptor.get, `get ${key}`);
            markIfNew(descriptor.set, `set ${key}`);
        }
    }

    Object.defineProperty(globalThis, 'safefunction', { value: safefunction, configurable: true });
    Object.defineProperty(globalThis, '__markBrowserFunctions__', {
        value() {
            const names = [
                'navigator', 'location', 'history', 'screen', 'document', 'localStorage',
                'sessionStorage', 'performance', 'crypto', 'XMLHttpRequest', 'Document',
                'Navigator', 'NavigatorUAData', 'Screen', 'Location', 'History', 'Storage', 'StorageEvent', 'HTMLDocument', 'Window',
                'Element', 'HTMLElement', 'HTMLCanvasElement', 'CanvasRenderingContext2D',
                'WebGLRenderingContext', 'AudioContext', 'OfflineAudioContext',
                'TextEncoder', 'TextDecoder', 'URL', 'URLSearchParams', 'Blob'
            ];
            for (const name of names) {
                const object = globalThis[name];
                markOwnMethods(object);
                if (object && typeof object === 'object') {
                    for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(object))) {
                        if (descriptor.value && typeof descriptor.value === 'object') {
                            markOwnMethods(descriptor.value);
                        }
                    }
                }
                if (typeof object === 'function') {
                    safefunction(object, name);
                    markOwnMethods(object.prototype);
                }
            }
            for (const name of ['caches', 'customElements', 'speechSynthesis', 'chrome']) {
                markOwnMethods(globalThis[name]);
            }
            markOwnMethods(Date.prototype);
            safefunction(Intl.DateTimeFormat, 'DateTimeFormat');
            // The window mock has many methods; only mark those already present now.
            markOwnMethods(globalThis);
        },
        configurable: true
    });
})();
