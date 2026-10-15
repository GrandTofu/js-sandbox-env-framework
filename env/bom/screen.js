/**
 * @env-module screen
 * @description Screen / ScreenOrientation：按 WebIDL 定义，属性为原型上的只读 getter，值来自 Profile 配置
 * @compatibility Chrome 120+
 * @version 3.0.0
 *
 * 依赖：WebIDL.js、eventCore.js（EventTarget）。
 * 采集快照通过 window.__applyScreenSnapshot__(data) 写入内部状态（属性本身只读）。
 */

(function() {
    'use strict';

    const idl = window.__webidl__;
    const markNative = window.safefunction;
    const profile = (window.__profile__ && window.__profile__.screen) || {};
    const orientationProfile = profile.orientation || {};

    function pick(value, fallback) {
        return value !== undefined && value !== null ? value : fallback;
    }

    const state = {
        width: pick(profile.width, 1920),
        height: pick(profile.height, 1080),
        availWidth: pick(profile.availWidth, 1920),
        availHeight: pick(profile.availHeight, 1040),
        availLeft: pick(profile.availLeft, 0),
        availTop: pick(profile.availTop, 0),
        colorDepth: pick(profile.colorDepth, 24),
        pixelDepth: pick(profile.pixelDepth, 24),
        isExtended: pick(profile.isExtended, false)
    };
    const numericKeys = new Set(Object.keys(state).filter(key => key !== 'isExtended'));

    // ==================== ScreenOrientation ====================
    const orientationState = {
        type: pick(orientationProfile.type, 'landscape-primary'),
        angle: pick(orientationProfile.angle, 0)
    };

    idl.defineInterface('ScreenOrientation', {
        parent: 'EventTarget',
        attributes: {
            type() { return idl.internal(this).type; },
            angle() { return idl.internal(this).angle; },
            onchange: {
                get() { return idl.internal(this).onchange ?? null; },
                set(value) {
                    const isObject = value !== null && (typeof value === 'object' || typeof value === 'function');
                    idl.internal(this).onchange = isObject ? value : null;
                }
            }
        },
        methods: {
            // 桌面浏览器非全屏时 lock() 被拒绝
            lock(orientation) {
                return Promise.reject(new DOMException('screen.orientation.lock() is not available on this device.', 'NotSupportedError'));
            },
            unlock() {}
        }
    });
    state.orientation = idl.create('ScreenOrientation', orientationState);

    // ==================== Screen ====================
    const attributes = {};
    for (const key of ['availWidth', 'availHeight', 'width', 'height', 'colorDepth', 'pixelDepth',
        'availLeft', 'availTop', 'orientation', 'isExtended']) {
        attributes[key] = function() { return idl.internal(this)[key]; };
    }
    attributes.onchange = {
        get() { return idl.internal(this).onchange ?? null; },
        set(value) {
            const isObject = value !== null && (typeof value === 'object' || typeof value === 'function');
            idl.internal(this).onchange = isObject ? value : null;
        }
    };
    idl.defineInterface('Screen', { parent: 'EventTarget', attributes });
    const screen = idl.create('Screen', state);

    // ==================== 采集快照写入 ====================
    function applySnapshot(data) {
        if (!data || typeof data !== 'object' || Array.isArray(data)) return;
        for (const [key, value] of Object.entries(data)) {
            if (numericKeys.has(key) && typeof value === 'number') state[key] = value;
            else if (key === 'isExtended' && typeof value === 'boolean') state.isExtended = value;
            else if (key === 'orientation' && value && typeof value === 'object') {
                if (typeof value.type === 'string') orientationState.type = value.type;
                if (typeof value.angle === 'number') orientationState.angle = value.angle;
            }
        }
    }
    Object.defineProperty(window, '__applyScreenSnapshot__', {
        value: applySnapshot, writable: true, configurable: true
    });

    // ==================== window.screen ====================
    // [Replaceable]：Chrome 中给 window.screen 赋值会替换成普通数据属性；
    // 旧版采集器的 Object.assign(window, { screen: {...} }) 传入的是普通对象，按快照处理
    const accessors = {
        get screen() { return screen; },
        set screen(value) {
            if (value === screen) return;
            if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
                applySnapshot(value);
                return;
            }
            Object.defineProperty(window, 'screen', {
                value, writable: true, enumerable: true, configurable: true
            });
        }
    };
    const descriptor = Object.getOwnPropertyDescriptor(accessors, 'screen');
    Object.defineProperty(window, 'screen', {
        get: markNative(descriptor.get, 'get screen'),
        set: markNative(descriptor.set, 'set screen'),
        enumerable: true, configurable: true
    });
})();
