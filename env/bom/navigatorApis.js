/**
 * @env-module navigatorApis
 * @description navigator 子对象接口：NetworkInformation、Permissions/PermissionStatus、Geolocation/GeolocationPositionError、MediaDevices、ServiceWorkerContainer、Clipboard、CredentialsContainer、StorageManager、BatteryManager
 * @compatibility Chrome 120+
 *
 * 只定义接口并提供 window.__navigatorApis__.build(profile)，实例由 navigator.js 放进 Navigator 的内部状态。
 * 依赖：WebIDL.js、domexception.js、eventCore.js（EventTarget）。
 */
(function () {
    'use strict';

    const idl = window.__webidl__;
    const Monitor = window.__EnvMonitor__ || window.__envMonitor__ || { log: function() {} };

    // 继承 EventTarget（eventCore.js 定义），brand check 需要登记 parent
    function defineEventTargetInterface(name, spec) {
        return idl.defineInterface(name, Object.assign({ parent: 'EventTarget' }, spec));
    }

    function field(key) {
        return function() { return idl.internal(this)[key]; };
    }

    // 事件处理属性（onxxx）：非对象值存为 null
    function handler(key) {
        return {
            get() { return idl.internal(this)[key] ?? null; },
            set(value) {
                const isObject = value !== null && (typeof value === 'object' || typeof value === 'function');
                idl.internal(this)[key] = isObject ? value : null;
            }
        };
    }

    function notAllowed() {
        return Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
    }

    // ==================== NetworkInformation ====================
    defineEventTargetInterface('NetworkInformation', {
        attributes: {
            onchange: handler('onchange'),
            effectiveType: field('effectiveType'),
            rtt: field('rtt'),
            downlink: field('downlink'),
            saveData: field('saveData')
        }
    });

    // ==================== Permissions / PermissionStatus ====================
    defineEventTargetInterface('PermissionStatus', {
        attributes: {
            state: field('state'),
            name: field('name'),
            onchange: handler('onchange')
        }
    });

    // Chrome 120 的 PermissionName 枚举值
    const permissionNames = new Set([
        'geolocation', 'notifications', 'push', 'midi', 'camera', 'microphone', 'background-fetch',
        'background-sync', 'persistent-storage', 'ambient-light-sensor', 'accelerometer', 'gyroscope',
        'magnetometer', 'screen-wake-lock', 'nfc', 'display-capture', 'accessibility-events',
        'clipboard-read', 'clipboard-write', 'payment-handler', 'idle-detection',
        'periodic-background-sync', 'system-wake-lock', 'storage-access', 'window-management',
        'window-placement', 'local-fonts', 'top-level-storage-access'
    ]);

    // notifications 与 Notification.permission 保持一致（default 对应 prompt）
    function permissionState(name) {
        if (name !== 'notifications') return 'prompt';
        const notification = window.Notification && window.Notification.permission;
        return notification === 'granted' || notification === 'denied' ? notification : 'prompt';
    }

    idl.defineInterface('Permissions', {
        methods: {
            query(permissionDesc) {
                const prefix = "Failed to execute 'query' on 'Permissions': ";
                const isObject = permissionDesc !== null &&
                    (typeof permissionDesc === 'object' || typeof permissionDesc === 'function');
                if (permissionDesc !== undefined && permissionDesc !== null && !isObject) {
                    return Promise.reject(new TypeError(prefix + "The provided value is not of type 'PermissionDescriptor'."));
                }
                const name = isObject ? permissionDesc.name : undefined;
                const readName = "Failed to read the 'name' property from 'PermissionDescriptor': ";
                if (name === undefined) {
                    return Promise.reject(new TypeError(prefix + readName + 'Required member is undefined.'));
                }
                const key = String(name);
                if (!permissionNames.has(key)) {
                    return Promise.reject(new TypeError(prefix + readName +
                        `The provided value '${key}' is not a valid enum value of type PermissionName.`));
                }
                return Promise.resolve(idl.create('PermissionStatus', { name: key, state: permissionState(key) }));
            }
        }
    });

    // ==================== Geolocation ====================
    idl.defineInterface('GeolocationPositionError', {
        constants: { PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 },
        attributes: {
            code: field('code'),
            message: field('message')
        }
    });

    let lastWatchId = 0;
    // 与浏览器一样异步回调：用户拒绝授权
    function denyPosition(errorCallback) {
        if (typeof errorCallback !== 'function') return;
        const error = idl.create('GeolocationPositionError', { code: 1, message: 'User denied Geolocation' });
        setTimeout(() => errorCallback(error), 0);
    }

    idl.defineInterface('Geolocation', {
        methods: {
            getCurrentPosition(successCallback, errorCallback = null, options = {}) {
                denyPosition(errorCallback);
            },
            watchPosition(successCallback, errorCallback = null, options = {}) {
                denyPosition(errorCallback);
                return ++lastWatchId;
            },
            clearWatch(watchId) {}
        }
    });

    // ==================== MediaDevices ====================
    defineEventTargetInterface('MediaDevices', {
        attributes: {
            ondevicechange: handler('ondevicechange')
        },
        methods: {
            enumerateDevices() { return Promise.resolve([]); },
            getSupportedConstraints() {
                return {
                    aspectRatio: true, deviceId: true, echoCancellation: true,
                    facingMode: true, frameRate: true, height: true, width: true, volume: true
                };
            },
            getUserMedia(constraints = {}) { return notAllowed(); },
            getDisplayMedia(options = {}) { return notAllowed(); }
        }
    });

    // ==================== ServiceWorkerContainer ====================
    defineEventTargetInterface('ServiceWorkerContainer', {
        attributes: {
            controller: field('controller'),
            ready: field('ready'),
            pushManager() { return idl.internal(this).pushManager; },
            oncontrollerchange: handler('oncontrollerchange'),
            onmessage: handler('onmessage'),
            onmessageerror: handler('onmessageerror')
        },
        methods: {
            register(scriptURL, options = {}) {
                return Promise.resolve({ scope: '/', installing: null, waiting: null, active: null });
            },
            getRegistration(clientURL = '') { return Promise.resolve(undefined); },
            getRegistrations() { return Promise.resolve([]); },
            startMessages() {}
        }
    });

    // ==================== Clipboard ====================
    // 保持原有行为：成功返回并记录监控日志
    defineEventTargetInterface('Clipboard', {
        methods: {
            read() {
                Monitor.log('Clipboard', 'read', {});
                return Promise.resolve([]);
            },
            readText() {
                Monitor.log('Clipboard', 'readText', {});
                return Promise.resolve('');
            },
            write(data) {
                Monitor.log('Clipboard', 'write', {});
                return Promise.resolve();
            },
            writeText(data) {
                Monitor.log('Clipboard', 'writeText', { text: String(data).substring(0, 50) });
                return Promise.resolve();
            }
        }
    });

    // ==================== CredentialsContainer ====================
    idl.defineInterface('CredentialsContainer', {
        methods: {
            get(options = {}) { return Promise.resolve(null); },
            store(credential) { return Promise.resolve(credential); },
            create(options = {}) { return Promise.resolve(null); },
            preventSilentAccess() { return Promise.resolve(); }
        }
    });

    // ==================== StorageManager ====================
    idl.defineInterface('StorageManager', {
        methods: {
            persisted() { return Promise.resolve(false); },
            persist() { return Promise.resolve(false); },
            estimate() { return Promise.resolve({ quota: 1073741824, usage: 0 }); }
        }
    });

    // ==================== BatteryManager ====================
    defineEventTargetInterface('BatteryManager', {
        attributes: {
            charging: field('charging'),
            chargingTime: field('chargingTime'),
            dischargingTime: field('dischargingTime'),
            level: field('level'),
            onchargingchange: handler('onchargingchange'),
            onchargingtimechange: handler('onchargingtimechange'),
            ondischargingtimechange: handler('ondischargingtimechange'),
            onlevelchange: handler('onlevelchange')
        }
    });

    /** 按 profile 创建 navigator 的子对象；battery 是 getBattery() 每次返回的同一个 Promise。 */
    // ==================== LockManager (navigator.locks) ====================
    idl.defineInterface('Lock', {
        attributes: {
            name() { return idl.internal(this).name; },
            mode() { return idl.internal(this).mode; }
        }
    });

    idl.defineInterface('LockManager', {
        methods: {
            request(name, options = {}, callback = undefined) {
                if (typeof options === 'function') { callback = options; options = {}; }
                const lock = idl.create('Lock', { name: String(name), mode: options.mode || 'exclusive' });
                // 沙箱内没有真正的并发，回调在微任务中直接拿到锁
                return Promise.resolve().then(() => callback(lock));
            },
            query() { return Promise.resolve({ held: [], pending: [] }); }
        }
    });

    // ==================== WakeLock / MediaSession ====================
    idl.defineInterface('WakeLockSentinel', {
        parent: 'EventTarget',
        attributes: {
            released() { return idl.internal(this).released; },
            type() { return idl.internal(this).type; },
            onrelease: {
                get() { return idl.internal(this).onrelease ?? null; },
                set(value) {
                    const isObject = value !== null && (typeof value === 'object' || typeof value === 'function');
                    idl.internal(this).onrelease = isObject ? value : null;
                }
            }
        },
        methods: {
            release() {
                idl.internal(this).released = true;
                return Promise.resolve();
            }
        }
    });

    idl.defineInterface('WakeLock', {
        methods: {
            // 非用户手势或页面不可见时浏览器会拒绝，这里与之一致
            request(type = 'screen') {
                return Promise.reject(new DOMException(
                    "Failed to execute 'request' on 'WakeLock': Permission denied", 'NotAllowedError'));
            }
        }
    });

    idl.defineInterface('MediaMetadata', {
        length: 0,
        construct(init = {}) {
            Object.assign(idl.internal(this), {
                title: init.title === undefined ? '' : String(init.title),
                artist: init.artist === undefined ? '' : String(init.artist),
                album: init.album === undefined ? '' : String(init.album),
                artwork: Array.isArray(init.artwork) ? init.artwork.slice() : []
            });
        },
        attributes: {
            title() { return idl.internal(this).title; },
            artist() { return idl.internal(this).artist; },
            album() { return idl.internal(this).album; },
            artwork() { return idl.internal(this).artwork; }
        }
    });

    idl.defineInterface('MediaSession', {
        attributes: {
            metadata: {
                get() { return idl.internal(this).metadata ?? null; },
                set(value) {
                    idl.internal(this).metadata = value === null || value === undefined ? null : value;
                }
            },
            playbackState: {
                get() { return idl.internal(this).playbackState || 'none'; },
                set(value) {
                    const text = String(value);
                    idl.internal(this).playbackState =
                        ['none', 'paused', 'playing'].includes(text) ? text : 'none';
                }
            }
        },
        methods: {
            setActionHandler() {},
            setPositionState() {},
            setCameraActive() {},
            setMicrophoneActive() {}
        }
    });

    function build(profile) {
        const conn = profile.connection || {};
        const connection = idl.create('NetworkInformation', {
            effectiveType: conn.effectiveType || '4g',
            rtt: conn.rtt !== undefined ? conn.rtt : 50,
            downlink: conn.downlink !== undefined ? conn.downlink : 10,
            saveData: conn.saveData !== undefined ? conn.saveData : false
        });
        const battery = idl.create('BatteryManager', {
            charging: true, chargingTime: 0, dischargingTime: Infinity, level: 1
        });
        return {
            connection,
            geolocation: idl.create('Geolocation'),
            permissions: idl.create('Permissions'),
            mediaDevices: idl.create('MediaDevices'),
            serviceWorker: idl.create('ServiceWorkerContainer', {
                controller: null, ready: Promise.resolve(),
                // PushManager 在 apis.js 里定义，这里只做关联
                get pushManager() { return window.__pushManager__ || null; }
            }),
            clipboard: idl.create('Clipboard'),
            credentials: idl.create('CredentialsContainer'),
            storage: idl.create('StorageManager'),
            locks: idl.create('LockManager'),
            wakeLock: idl.create('WakeLock'),
            mediaSession: idl.create('MediaSession', { metadata: null, playbackState: 'none' }),
            battery: Promise.resolve(battery)
        };
    }

    Object.defineProperty(window, '__navigatorApis__', {
        value: Object.freeze({ build }), configurable: true
    });
})();
