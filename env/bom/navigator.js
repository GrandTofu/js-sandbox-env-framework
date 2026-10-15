/**
 * @env-module navigator
 * @description 浏览器 navigator 对象模拟：Navigator / NavigatorUAData 按 WebIDL 定义，属性都是原型上的 getter，值来自 Profile 配置
 * @compatibility Chrome 120+
 * @version 3.0.0
 *
 * 依赖：WebIDL.js、plugins.js、navigatorApis.js。
 * 采集快照通过 window.__applyNavigatorSnapshot__(data) 写入内部状态（属性本身只读）。
 */

(function() {
    'use strict';

    const idl = window.__webidl__;
    const markNative = window.safefunction;
    const pluginBuilder = window.__navigatorPlugins__;
    const apiBuilder = window.__navigatorApis__;
    const profile = (window.__profile__ && window.__profile__.navigator) || {};

    // ==================== 内部状态 ====================
    const state = {
        userAgent: profile.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        appCodeName: profile.appCodeName || 'Mozilla',
        appName: profile.appName || 'Netscape',
        appVersion: profile.appVersion || '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        platform: profile.platform || 'Win32',
        product: profile.product || 'Gecko',
        productSub: profile.productSub || '20030107',
        // Firefox 的 vendor 是空字符串，不能用 || 回退
        vendor: profile.vendor !== undefined ? profile.vendor : 'Google Inc.',
        vendorSub: profile.vendorSub || '',
        language: profile.language || 'zh-CN',
        languages: Object.freeze((profile.languages || ['zh-CN', 'zh', 'en']).map(String)),
        onLine: profile.onLine !== undefined ? profile.onLine : true,
        cookieEnabled: profile.cookieEnabled !== undefined ? profile.cookieEnabled : true,
        doNotTrack: profile.doNotTrack !== undefined ? profile.doNotTrack : null,
        hardwareConcurrency: profile.hardwareConcurrency || 8,
        maxTouchPoints: profile.maxTouchPoints !== undefined ? profile.maxTouchPoints : 0,
        deviceMemory: profile.deviceMemory || 8,
        webdriver: profile.webdriver !== undefined ? profile.webdriver : false,
        pdfViewerEnabled: profile.pdfViewerEnabled !== undefined ? profile.pdfViewerEnabled : true
    };
    // buildID 是 Firefox 专有属性，只有 profile 显式配置时才存在
    const hasBuildID = profile.buildID !== undefined;
    if (hasBuildID) state.buildID = profile.buildID;
    const scalarKeys = new Set(Object.keys(state).filter(key => key !== 'languages'));

    // ==================== plugins / mimeTypes ====================
    let pluginDefs = profile.plugins || [];
    let mimeTypeDefs = profile.mimeTypes;
    function rebuildPlugins() {
        const built = pluginBuilder.build(pluginDefs, mimeTypeDefs);
        state.plugins = built.plugins;
        state.mimeTypes = built.mimeTypes;
    }
    rebuildPlugins();

    // ==================== 子对象（接口定义见 navigatorApis.js） ====================
    const apis = apiBuilder.build(profile);
    for (const key of ['connection', 'geolocation', 'permissions', 'mediaDevices', 'serviceWorker',
        'clipboard', 'credentials', 'storage', 'locks', 'wakeLock', 'mediaSession', 'gpu',
        'userActivation', 'mediaCapabilities', 'keyboard', 'mouse', 'bluetooth', 'usb', 'serial',
        'hid', 'xr', 'presentation', 'gamepad', 'midi']) {
        state[key] = apis[key];
    }

    // ==================== NavigatorUAData ====================
    function lowEntropyOf(uaState) {
        return { brands: uaState.brands, mobile: uaState.mobile, platform: uaState.platform };
    }

    idl.defineInterface('NavigatorUAData', {
        attributes: {
            brands() { return idl.internal(this).brands; },
            mobile() { return idl.internal(this).mobile; },
            platform() { return idl.internal(this).platform; }
        },
        methods: {
            getHighEntropyValues(hints) {
                const uaState = idl.internal(this);
                const values = lowEntropyOf(uaState);
                for (const hint of hints) {
                    if (Object.prototype.hasOwnProperty.call(uaState.highEntropy, hint)) {
                        values[hint] = uaState.highEntropy[hint];
                    }
                }
                return Promise.resolve(values);
            },
            toJSON() { return lowEntropyOf(idl.internal(this)); }
        }
    });

    const uadProfile = profile.userAgentData || {};
    const uaState = {
        brands: uadProfile.brands || [
            { brand: 'Not_A Brand', version: '8' },
            { brand: 'Chromium', version: '120' },
            { brand: 'Google Chrome', version: '120' }
        ],
        mobile: uadProfile.mobile !== undefined ? uadProfile.mobile : false,
        platform: uadProfile.platform || 'Windows',
        highEntropy: {
            architecture: uadProfile.architecture || 'x86',
            bitness: uadProfile.bitness || '64',
            fullVersionList: uadProfile.fullVersionList || [
                { brand: 'Not_A Brand', version: '8.0.0.0' },
                { brand: 'Chromium', version: '120.0.6099.130' },
                { brand: 'Google Chrome', version: '120.0.6099.130' }
            ],
            model: uadProfile.model || '',
            platformVersion: uadProfile.platformVersion || '10.0.0',
            uaFullVersion: uadProfile.uaFullVersion || '120.0.6099.130',
            wow64: uadProfile.wow64 ?? false
        }
    };
    state.userAgentData = idl.create('NavigatorUAData', uaState);

    // ==================== Navigator ====================
    const attributes = {};
    const attributeKeys = [
        'vendorSub', 'productSub', 'vendor', 'maxTouchPoints', 'doNotTrack', 'geolocation',
        'connection', 'plugins', 'mimeTypes', 'pdfViewerEnabled', 'hardwareConcurrency',
        'cookieEnabled', 'appCodeName', 'appName', 'appVersion', 'platform', 'product',
        'userAgent', 'language', 'languages', 'onLine', 'webdriver', 'clipboard', 'credentials',
        'mediaDevices', 'storage', 'serviceWorker', 'locks', 'wakeLock', 'mediaSession',
        'deviceMemory', 'permissions', 'userAgentData', 'gpu', 'userActivation',
        'mediaCapabilities', 'keyboard', 'mouse', 'bluetooth', 'usb', 'serial', 'hid', 'xr',
        'presentation', 'gamepad', 'midi'
    ];
    if (hasBuildID) attributeKeys.push('buildID');
    for (const key of attributeKeys) {
        attributes[key] = function() { return idl.internal(this)[key]; };
    }

    idl.defineInterface('Navigator', {
        attributes,
        methods: {
            javaEnabled() { return false; },
            // 桌面 Chrome 上 share 需要用户手势，否则以 AbortError 拒绝；canShare 没有分享目标时返回 false
            share(data = undefined) {
                return Promise.reject(new DOMException("Failed to execute 'share' on 'Navigator': Permission denied", 'AbortError'));
            },
            canShare(data = undefined) { return false; },
            sendBeacon(url, data = null) { return true; },
            vibrate(pattern) { return true; },
            // Chrome 每次调用返回同一个 Promise
            getBattery() { return apis.battery; },
            registerProtocolHandler(scheme, url) {},
            unregisterProtocolHandler(scheme, url) {}
        }
    });
    const navigator = idl.create('Navigator', state);

    // ==================== 采集快照写入 ====================
    function mergeKnown(target, source) {
        for (const [key, value] of Object.entries(source)) {
            if (value !== undefined && Object.prototype.hasOwnProperty.call(target, key) &&
                typeof target[key] !== 'function') {
                target[key] = value;
            }
        }
    }

    function applySnapshot(data) {
        if (!data || typeof data !== 'object' || Array.isArray(data)) return;
        for (const [key, value] of Object.entries(data)) {
            if (value === undefined) continue;
            if (scalarKeys.has(key)) {
                state[key] = value;
            } else if (key === 'languages' && Array.isArray(value)) {
                state.languages = Object.freeze(value.map(String));
            } else if (key === 'connection' && value && typeof value === 'object') {
                // connection 是 WebIDL 对象，数据在内部状态里
                mergeKnown(idl.internal(state.connection), value);
            } else if (key === 'userAgentData' && value && typeof value === 'object') {
                mergeKnown(uaState, value);
                mergeKnown(uaState.highEntropy, value);
            }
        }
        const hasPlugins = Array.isArray(data.plugins);
        const hasMimeTypes = Array.isArray(data.mimeTypes);
        if (hasPlugins) pluginDefs = data.plugins;
        if (hasMimeTypes) mimeTypeDefs = data.mimeTypes;
        if (hasPlugins || hasMimeTypes) rebuildPlugins();
    }

    Object.defineProperty(window, '__applyNavigatorSnapshot__', {
        value: applySnapshot, writable: true, configurable: true
    });

    // ==================== window.navigator / clientInformation ====================
    // navigator 为只读访问器；setter 仅为兼容旧版采集器的 Object.assign(window, { navigator: {...} })
    // clientInformation 是 [Replaceable]：赋值后变成普通数据属性
    const accessors = {
        get navigator() { return navigator; },
        set navigator(value) {
            if (value !== navigator) applySnapshot(value);
        },
        get clientInformation() { return navigator; },
        set clientInformation(value) {
            Object.defineProperty(window, 'clientInformation', {
                value, writable: true, enumerable: true, configurable: true
            });
        }
    };
    for (const key of ['navigator', 'clientInformation']) {
        const descriptor = Object.getOwnPropertyDescriptor(accessors, key);
        Object.defineProperty(window, key, {
            get: markNative(descriptor.get),
            set: markNative(descriptor.set),
            enumerable: true,
            configurable: true
        });
    }
})();
