/**
 * @env-module apis
 * @description 浏览器里存在、沙箱未接入真实后端的接口：WebSocket / EventSource / RTCPeerConnection /
 * indexedDB / caches / MessageChannel / createImageBitmap / window.external。
 * 这些接口「是否存在」本身就是指纹（缺失即暴露为非浏览器），因此给出符合规范的接口形态；
 * 行为按「没有网络 / 没有持久化存储」时的真实结果给出（例如 WebSocket 连接失败、indexedDB 打不开）。
 * @compatibility Chrome 120+
 *
 * 依赖：WebIDL.js、eventCore.js（EventTarget/Event）、event.js（MessageEvent）、domexception.js、timeout.js。
 */
(function () {
    'use strict';

    const idl = window.__webidl__;
    const Monitor = window.__EnvMonitor__ || {
        log() {}, logCall() {}, executeMock() { return { mocked: false }; }
    };
    const defineInterface = idl.defineInterface;
    const define = (name, state) => idl.create(name, state);
    const internal = idl.internal;

    // eventCore 的 dispatchEvent 已经会调用 onxxx 处理函数，这里只需派发
    function fire(target, event) {
        target.dispatchEvent(event);
    }

    function handlerAttribute(key) {
        return {
            get() { return internal(this)[key] ?? null; },
            set(value) {
                const isObject = value !== null && (typeof value === 'object' || typeof value === 'function');
                internal(this)[key] = isObject ? value : null;
            }
        };
    }

    // ==================== CloseEvent ====================
    defineInterface('CloseEvent', {
        parent: 'Event',
        length: 1,
        construct(type, eventInitDict = {}) {
            window.__eventInternals__.setup(this, type, eventInitDict);
            const init = eventInitDict || {};
            Object.assign(internal(this), {
                wasClean: !!init.wasClean, code: init.code === undefined ? 0 : Number(init.code),
                reason: init.reason === undefined ? '' : String(init.reason)
            });
        },
        attributes: {
            wasClean() { return internal(this).wasClean; },
            code() { return internal(this).code; },
            reason() { return internal(this).reason; }
        }
    });

    // ==================== WebSocket ====================
    defineInterface('WebSocket', {
        parent: 'EventTarget',
        length: 1,
        constants: { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 },
        construct(url, protocols) {
            const text = String(url);
            if (!/^wss?:\/\//i.test(text)) {
                throw new DOMException(`Failed to construct 'WebSocket': The URL '${text}' is invalid.`, 'SyntaxError');
            }
            const list = protocols === undefined ? [] : (Array.isArray(protocols) ? protocols : [protocols]).map(String);
            if (new Set(list).size !== list.length) {
                throw new DOMException(`Failed to construct 'WebSocket': The subprotocol '${list[0]}' is invalid.`, 'SyntaxError');
            }
            Object.assign(internal(this), {
                url: text, readyState: 0, protocol: '', extensions: '', binaryType: 'blob', bufferedAmount: 0,
                onopen: null, onerror: null, onclose: null, onmessage: null
            });
            // 沙箱内没有网络：与断网时一致，先 error 再 close(1006)
            window.setTimeout(() => {
                if (internal(this).readyState !== 0) return;
                internal(this).readyState = 3;
                fire(this, new Event('error'));
                fire(this, new window.CloseEvent('close', { code: 1006, wasClean: false }));
            }, 0);
        },
        attributes: {
            url() { return internal(this).url; },
            readyState() { return internal(this).readyState; },
            protocol() { return internal(this).protocol; },
            extensions() { return internal(this).extensions; },
            binaryType() { return internal(this).binaryType; },
            bufferedAmount() { return internal(this).bufferedAmount; },
            onopen: handlerAttribute('onopen'),
            onerror: handlerAttribute('onerror'),
            onclose: handlerAttribute('onclose'),
            onmessage: handlerAttribute('onmessage')
        },
        methods: {
            send(data) {
                Monitor.logCall('WebSocket.send', [data], null);
                if (internal(this).readyState === 0) {
                    throw new DOMException("Failed to execute 'send' on 'WebSocket': Still in CONNECTING state.", 'InvalidStateError');
                }
            },
            close(code = undefined, reason = undefined) {
                Monitor.logCall('WebSocket.close', [code, reason], null);
                const state = internal(this);
                if (state.readyState === 3) return;
                if (code !== undefined && !(code === 1000 || (code >= 3000 && code <= 4999))) {
                    throw new DOMException("Failed to execute 'close' on 'WebSocket': The code must be either 1000, "
                        + 'or between 3000 and 4999.', 'InvalidAccessError');
                }
                state.readyState = 2;
                window.setTimeout(() => {
                    state.readyState = 3;
                    fire(this, new window.CloseEvent('close', { code: 1000, wasClean: true }));
                }, 0);
            }
        }
    });

    // ==================== EventSource ====================
    defineInterface('EventSource', {
        parent: 'EventTarget',
        length: 1,
        constants: { CONNECTING: 0, OPEN: 1, CLOSED: 2 },
        construct(url, eventSourceInitDict = {}) {
            Object.assign(internal(this), {
                url: String(url), readyState: 0, withCredentials: !!eventSourceInitDict.withCredentials,
                onopen: null, onerror: null, onmessage: null
            });
            window.setTimeout(() => {
                if (internal(this).readyState !== 0) return;
                internal(this).readyState = 2;
                fire(this, new Event('error'));
            }, 0);
        },
        attributes: {
            url() { return internal(this).url; },
            readyState() { return internal(this).readyState; },
            withCredentials() { return internal(this).withCredentials; },
            onopen: handlerAttribute('onopen'),
            onerror: handlerAttribute('onerror'),
            onmessage: handlerAttribute('onmessage')
        },
        methods: {
            close() { internal(this).readyState = 2; }
        }
    });

    // ==================== MessageChannel / MessagePort ====================
    defineInterface('MessagePort', {
        parent: 'EventTarget',
        attributes: { onmessage: handlerAttribute('onmessage'), onmessageerror: handlerAttribute('onmessageerror') },
        methods: {
            postMessage(message) {
                const state = internal(this);
                const target = state.other;
                if (!target) return;
                const event = new MessageEvent('message', { data: message, origin: location.origin, source: null });
                window.setTimeout(() => { if (!internal(target).closed) fire(target, event); }, 0);
            },
            start() { internal(this).started = true; },
            close() { internal(this).closed = true; }
        }
    });

    defineInterface('MessageChannel', {
        construct() {
            const port1 = define('MessagePort', { started: false, closed: false, onmessage: null, onmessageerror: null });
            const port2 = define('MessagePort', { started: false, closed: false, onmessage: null, onmessageerror: null });
            internal(port1).other = port2;
            internal(port2).other = port1;
            Object.assign(internal(this), { port1, port2 });
        },
        attributes: {
            port1() { return internal(this).port1; },
            port2() { return internal(this).port2; }
        }
    });

    // ==================== ImageBitmap ====================
    defineInterface('ImageBitmap', {
        attributes: {
            width() { return internal(this).width; },
            height() { return internal(this).height; }
        },
        methods: { close() { Object.assign(internal(this), { width: 0, height: 0 }); } }
    });

    window.createImageBitmap = window.safefunction(function createImageBitmap(image, options) {
        Monitor.logCall('createImageBitmap', [image, options], 'Promise');
        const width = Number(image && (image.width ?? image.naturalWidth ?? image.videoWidth) || 0);
        const height = Number(image && (image.height ?? image.naturalHeight ?? image.videoHeight) || 0);
        const crop = (options && options.resizeWidth)
            ? { width: Number(options.resizeWidth), height: Number(options.resizeHeight || height) }
            : { width, height };
        return Promise.resolve(define('ImageBitmap', crop));
    }, 'createImageBitmap');

    // ==================== CacheStorage / Cache ====================
    defineInterface('Cache', {
        methods: {
            match(request) { return Promise.resolve(internal(this).entries.get(String(request && request.url || request))); },
            matchAll() { return Promise.resolve(Array.from(internal(this).entries.values())); },
            add() { return Promise.reject(new TypeError("Failed to execute 'add' on 'Cache': Request failed")); },
            addAll() { return Promise.reject(new TypeError("Failed to execute 'addAll' on 'Cache': Request failed")); },
            put(request, response) {
                internal(this).entries.set(String(request && request.url || request), response);
                return Promise.resolve();
            },
            delete(request) {
                return Promise.resolve(internal(this).entries.delete(String(request && request.url || request)));
            },
            keys() { return Promise.resolve(Array.from(internal(this).entries.keys())); }
        }
    });

    defineInterface('CacheStorage', {
        methods: {
            open(name) {
                const state = internal(this);
                const key = String(name);
                if (!state.caches.has(key)) state.caches.set(key, define('Cache', { entries: new Map() }));
                return Promise.resolve(state.caches.get(key));
            },
            has(name) { return Promise.resolve(internal(this).caches.has(String(name))); },
            delete(name) { return Promise.resolve(internal(this).caches.delete(String(name))); },
            keys() { return Promise.resolve(Array.from(internal(this).caches.keys())); },
            match() { return Promise.resolve(undefined); }
        }
    });

    Object.defineProperty(window, 'caches', {
        value: define('CacheStorage', { caches: new Map() }), writable: true, enumerable: true, configurable: true
    });

    // ==================== IndexedDB（沙箱没有持久化存储，open 会失败） ====================
    defineInterface('IDBRequest', {
        parent: 'EventTarget',
        attributes: {
            result() { return internal(this).result; },
            error() { return internal(this).error; },
            source() { return internal(this).source; },
            transaction() { return internal(this).transaction; },
            readyState() { return internal(this).readyState; },
            onsuccess: handlerAttribute('onsuccess'),
            onerror: handlerAttribute('onerror')
        }
    });
    defineInterface('IDBOpenDBRequest', {
        parent: 'IDBRequest',
        attributes: { onblocked: handlerAttribute('onblocked'), onupgradeneeded: handlerAttribute('onupgradeneeded') }
    });
    defineInterface('IDBKeyRange', {
        statics: {
            only(value) { return define('IDBKeyRange', { lower: value, upper: value, lowerOpen: false, upperOpen: false }); },
            lowerBound(lower, open = false) { return define('IDBKeyRange', { lower, upper: undefined, lowerOpen: !!open, upperOpen: true }); },
            upperBound(upper, open = false) { return define('IDBKeyRange', { lower: undefined, upper, lowerOpen: true, upperOpen: !!open }); },
            bound(lower, upper, lowerOpen = false, upperOpen = false) {
                return define('IDBKeyRange', { lower, upper, lowerOpen: !!lowerOpen, upperOpen: !!upperOpen });
            }
        },
        attributes: {
            lower() { return internal(this).lower; },
            upper() { return internal(this).upper; },
            lowerOpen() { return internal(this).lowerOpen; },
            upperOpen() { return internal(this).upperOpen; }
        }
    });

    defineInterface('IDBFactory', {
        attributes: {
            onabort: handlerAttribute('onabort'),
            onerror: handlerAttribute('onerror')
        },
        methods: {
            open(name = undefined, version = undefined) {
                Monitor.logCall('IDBFactory.open', [name, version], '[IDBOpenDBRequest]');
                const request = define('IDBOpenDBRequest', {
                    result: undefined, error: null, source: null, transaction: null, readyState: 'pending',
                    onsuccess: null, onerror: null, onblocked: null, onupgradeneeded: null
                });
                window.setTimeout(() => {
                    const state = internal(request);
                    state.readyState = 'done';
                    state.error = new DOMException(
                        `Failed to execute 'open' on 'IDBFactory': The sandbox has no persistent storage.`, 'UnknownError');
                    fire(request, new Event('error'));
                }, 0);
                return request;
            },
            deleteDatabase(name = undefined) {
                const request = define('IDBOpenDBRequest', {
                    result: undefined, error: null, source: null, transaction: null, readyState: 'pending',
                    onsuccess: null, onerror: null, onblocked: null, onupgradeneeded: null
                });
                window.setTimeout(() => {
                    const state = internal(request);
                    state.readyState = 'done';
                    state.error = new DOMException('The sandbox has no persistent storage.', 'UnknownError');
                    fire(request, new Event('error'));
                }, 0);
                return request;
            },
            databases() { return Promise.resolve([]); },
            cmp(first, second) { return first < second ? -1 : first > second ? 1 : 0; }
        }
    });

    Object.defineProperty(window, 'indexedDB', {
        value: define('IDBFactory', { onabort: null, onerror: null }),
        writable: true, enumerable: true, configurable: true
    });

    // ==================== WebRTC ====================
    defineInterface('RTCSessionDescription', {
        length: 0,
        construct(descriptionInitDict = {}) {
            Object.assign(internal(this), {
                type: descriptionInitDict.type === undefined ? null : String(descriptionInitDict.type),
                sdp: descriptionInitDict.sdp === undefined ? '' : String(descriptionInitDict.sdp)
            });
        },
        attributes: {
            type() { return internal(this).type; },
            sdp() { return internal(this).sdp; }
        },
        methods: {
            toJSON() { return { type: internal(this).type, sdp: internal(this).sdp }; }
        }
    });

    defineInterface('RTCIceCandidate', {
        length: 0,
        construct(candidateInitDict = {}) {
            const init = candidateInitDict || {};
            Object.assign(internal(this), {
                candidate: init.candidate === undefined ? '' : String(init.candidate),
                sdpMid: init.sdpMid === undefined ? null : init.sdpMid,
                sdpMLineIndex: init.sdpMLineIndex === undefined ? null : init.sdpMLineIndex,
                foundation: init.foundation === undefined ? null : init.foundation,
                component: init.component === undefined ? null : init.component,
                protocol: init.protocol === undefined ? null : init.protocol,
                priority: init.priority === undefined ? null : init.priority,
                address: init.address === undefined ? null : init.address,
                type: init.type === undefined ? 'host' : init.type
            });
        },
        attributes: {
            candidate() { return internal(this).candidate; },
            sdpMid() { return internal(this).sdpMid; },
            sdpMLineIndex() { return internal(this).sdpMLineIndex; },
            foundation() { return internal(this).foundation; },
            component() { return internal(this).component; },
            protocol() { return internal(this).protocol; },
            priority() { return internal(this).priority; },
            address() { return internal(this).address; },
            type() { return internal(this).type; }
        },
        methods: {
            toJSON() {
                const state = internal(this);
                return { candidate: state.candidate, sdpMid: state.sdpMid, sdpMLineIndex: state.sdpMLineIndex };
            }
        }
    });

    const dataChannel = () => ({
        label: '', ordered: true, readyState: 'connecting', onopen: null, onmessage: null, onclose: null,
        onerror: null, send() {}, close() {}
    });

    defineInterface('RTCDataChannel', {
        parent: 'EventTarget',
        attributes: {
            label() { return internal(this).label; },
            ordered() { return internal(this).ordered; },
            readyState() { return internal(this).readyState; },
            onopen: handlerAttribute('onopen'),
            onmessage: handlerAttribute('onmessage'),
            onclose: handlerAttribute('onclose'),
            onerror: handlerAttribute('onerror')
        },
        methods: { send() {}, close() { internal(this).readyState = 'closed'; } }
    });

    defineInterface('RTCPeerConnection', {
        parent: 'EventTarget',
        length: 0,
        construct(configuration = {}) {
            Object.assign(internal(this), {
                configuration, localDescription: null, remoteDescription: null, pendingLocalDescription: null,
                pendingRemoteDescription: null, currentLocalDescription: null, currentRemoteDescription: null,
                signalingState: 'stable', iceGatheringState: 'new', iceConnectionState: 'new',
                connectionState: 'new', onicecandidate: null, ondatachannel: null, oniceconnectionstatechange: null,
                onconnectionstatechange: null, onsignalingstatechange: null, ontrack: null, channels: []
            });
            Monitor.logCall('RTCPeerConnection', [configuration], '[RTCPeerConnection]');
        },
        attributes: {
            localDescription() { return internal(this).localDescription; },
            remoteDescription() { return internal(this).remoteDescription; },
            pendingLocalDescription() { return internal(this).pendingLocalDescription; },
            pendingRemoteDescription() { return internal(this).pendingRemoteDescription; },
            currentLocalDescription() { return internal(this).currentLocalDescription; },
            currentRemoteDescription() { return internal(this).currentRemoteDescription; },
            signalingState() { return internal(this).signalingState; },
            iceGatheringState() { return internal(this).iceGatheringState; },
            iceConnectionState() { return internal(this).iceConnectionState; },
            connectionState() { return internal(this).connectionState; },
            onicecandidate: handlerAttribute('onicecandidate'),
            ondatachannel: handlerAttribute('ondatachannel'),
            oniceconnectionstatechange: handlerAttribute('oniceconnectionstatechange'),
            onconnectionstatechange: handlerAttribute('onconnectionstatechange'),
            onsignalingstatechange: handlerAttribute('onsignalingstatechange'),
            ontrack: handlerAttribute('ontrack')
        },
        methods: {
            createOffer() { return Promise.resolve(new window.RTCSessionDescription({ type: 'offer', sdp: '' })); },
            createAnswer() { return Promise.resolve(new window.RTCSessionDescription({ type: 'answer', sdp: '' })); },
            setLocalDescription(description = undefined) {
                const state = internal(this);
                state.localDescription = new window.RTCSessionDescription(description || {});
                state.signalingState = 'have-local-offer';
                return Promise.resolve();
            },
            setRemoteDescription(description = undefined) {
                const state = internal(this);
                state.remoteDescription = new window.RTCSessionDescription(description || {});
                return Promise.resolve();
            },
            addIceCandidate(candidate = undefined) {
                if (candidate === undefined || candidate === null) {
                    return Promise.reject(new TypeError("Failed to execute 'addIceCandidate' on 'RTCPeerConnection': "
                        + '2 arguments required, but only 0 present.'));
                }
                return Promise.resolve();
            },
            createDataChannel(label = undefined) {
                const channel = define('RTCDataChannel', dataChannel());
                internal(channel).label = label === undefined ? '' : String(label);
                internal(this).channels.push(channel);
                return channel;
            },
            getStats() { return Promise.resolve(new Map()); },
            getSenders() { return []; },
            getReceivers() { return []; },
            addTrack() { return { stop() {} }; },
            close() {
                Object.assign(internal(this), {
                    connectionState: 'closed', iceConnectionState: 'closed', signalingState: 'closed'
                });
            }
        }
    });

    // ==================== Headers / Request / Response ====================
    function normalizedName(name) {
        const text = String(name);
        if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(text)) throw new TypeError('Invalid header name.');
        return text.toLowerCase();
    }

    function normalizedValue(value) {
        const text = String(value).trim();
        if (/[\u0000\r\n]/.test(text)) {
            throw new TypeError(`Failed to construct 'Headers': Invalid value`);
        }
        return text;
    }

    function fillHeaders(target, init) {
        const map = internal(target).entries;
        if (init === undefined || init === null) return;
        if (idl.is(init, 'Headers')) {
            for (const [name, value] of internal(init).entries) map.set(name, value);
            return;
        }
        if (typeof init[Symbol.iterator] === 'function') {
            for (const pair of init) {
                const entry = Array.from(pair);
                if (entry.length !== 2) throw new TypeError('Each header pair must contain two items.');
                target.append(entry[0], entry[1]);
            }
            return;
        }
        for (const name of Object.keys(init)) target.append(name, init[name]);
    }

    defineInterface('Headers', {
        length: 0,
        construct(init = undefined) {
            Object.assign(internal(this), { entries: new Map() });
            fillHeaders(this, init);
        },
        methods: {
            append(name, value) {
                const map = internal(this).entries;
                const key = normalizedName(name);
                const text = normalizedValue(value);
                map.set(key, map.has(key) ? `${map.get(key)}, ${text}` : text);
            },
            delete(name) { internal(this).entries.delete(normalizedName(name)); },
            get(name) { return internal(this).entries.get(normalizedName(name)) ?? null; },
            has(name) { return internal(this).entries.has(normalizedName(name)); },
            set(name, value) { internal(this).entries.set(normalizedName(name), normalizedValue(value)); },
            forEach(callback, thisArg = undefined) {
                for (const [name, value] of internal(this).entries) callback.call(thisArg, value, name, this);
            },
            keys() { return internal(this).entries.keys(); },
            values() { return internal(this).entries.values(); },
            entries() { return internal(this).entries.entries(); },
            [Symbol.iterator]() { return internal(this).entries.entries(); }
        }
    });

    function headersOf(init) {
        // Request / Response 各自拥有 Headers，自动推导的头部不能写回调用者。
        return new window.Headers(init);
    }

    function prepareBody(body, headers) {
        if (body === null || body === undefined) return null;
        let type = null;
        if (body instanceof URLSearchParams) {
            type = 'application/x-www-form-urlencoded;charset=UTF-8';
            body = String(body);
        } else if (body instanceof Blob) {
            type = body.type || null;
        } else if (body instanceof FormData) {
            const boundary = '----SandboxFormBoundary' + Math.random().toString(36).slice(2);
            const parts = [];
            const escape = text => String(text).replace(/[\r\n"]/g, char =>
                ({ '\r': '%0D', '\n': '%0A', '"': '%22' })[char]);
            for (const [name, value] of body) {
                let header = `--${boundary}\r\nContent-Disposition: form-data; name="${escape(name)}"`;
                if (value instanceof Blob) {
                    header += `; filename="${escape(value.name || 'blob')}"\r\nContent-Type: ${value.type || 'application/octet-stream'}`;
                }
                parts.push(header + '\r\n\r\n', value, '\r\n');
            }
            parts.push(`--${boundary}--\r\n`);
            type = `multipart/form-data; boundary=${boundary}`;
            body = new Blob(parts, { type });
        } else if (!(body instanceof ArrayBuffer) && !ArrayBuffer.isView(body) &&
            !(window.ReadableStream && body instanceof ReadableStream)) {
            body = String(body);
            type = 'text/plain;charset=UTF-8';
        }
        if (type && !headers.has('content-type')) headers.set('content-type', type);
        return body;
    }

    function resolvedURL(value) {
        try {
            return new URL(String(value), location.href).href;
        } catch (error) {
            throw new TypeError(`Failed to construct 'Request': Failed to parse URL from ${value}`);
        }
    }

    defineInterface('Request', {
        length: 1,
        construct(input, init = {}) {
            const options = init || {};
            const source = idl.is(input, 'Request') ? input : null;
            const url = resolvedURL(source ? source.url : input);
            const method = String(options.method || (source && source.method) || 'GET').toUpperCase();
            const headers = headersOf(options.headers ?? (source && source.headers));
            const body = prepareBody(options.body == null ? (source ? internal(source).body : null) : options.body, headers);
            if ((method === 'GET' || method === 'HEAD') && body !== null) {
                throw new TypeError('Request with GET/HEAD method cannot have body.');
            }
            Object.assign(internal(this), {
                url, method,
                headers, body,
                bodyUsed: false,
                credentials: options.credentials || (source && source.credentials) || 'same-origin',
                cache: options.cache || (source && source.cache) || 'default',
                redirect: options.redirect || (source && source.redirect) || 'follow',
                referrer: options.referrer || (source && source.referrer) || 'about:client',
                referrerPolicy: options.referrerPolicy || (source && source.referrerPolicy) || '',
                mode: options.mode || (source && source.mode) || 'cors',
                signal: options.signal || (source && source.signal) || null
            });
        },
        attributes: {
            url() { return internal(this).url; },
            method() { return internal(this).method; },
            headers() { return internal(this).headers; },
            body() { return internal(this).body; },
            bodyUsed() { return internal(this).bodyUsed; },
            credentials() { return internal(this).credentials; },
            cache() { return internal(this).cache; },
            redirect() { return internal(this).redirect; },
            referrer() { return internal(this).referrer; },
            referrerPolicy() { return internal(this).referrerPolicy; },
            mode() { return internal(this).mode; },
            signal() { return internal(this).signal; }
        },
        methods: {
            clone() { return new window.Request(this); }
        }
    });

    function bodyText(body) {
        if (body === null || body === undefined) return Promise.resolve('');
        if (typeof body === 'string') return Promise.resolve(body);
        if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return Promise.resolve(new TextDecoder().decode(body));
        if (body && typeof body.text === 'function') return Promise.resolve(body.text());
        return Promise.resolve(String(body));
    }

    defineInterface('Response', {
        length: 0,
        statics: {
            error() {
                const response = define('Response', { status: 0, statusText: '', headers: new window.Headers(), url: '' });
                Object.assign(internal(response), { type: 'error' });
                return response;
            },
            json(data, init = {}) {
                const headers = headersOf(init.headers);
                if (!headers.has('content-type')) headers.set('content-type', 'application/json');
                const text = JSON.stringify(data);
                if (text === undefined) throw new TypeError('Value is not JSON serializable.');
                const options = Object.assign({}, init, {
                    headers
                });
                return new window.Response(text, options);
            },
            redirect(url, status = 302) {
                const response = new window.Response(null, { status });
                Object.assign(internal(response), { url: resolvedURL(url) });
                return response;
            }
        },
        construct(body = null, init = {}) {
            const options = init || {};
            const status = options.status === undefined ? 200 : Number(options.status);
            if (status < 200 || status > 599) {
                throw new RangeError(`Failed to construct 'Response': The status provided (${status}) is outside the range [200, 599].`);
            }
            const headers = headersOf(options.headers);
            Object.assign(internal(this), {
                status, statusText: options.statusText === undefined ? '' : String(options.statusText),
                headers, body: prepareBody(body, headers), bodyUsed: false,
                url: '', redirected: false, type: 'default'
            });
        },
        attributes: {
            ok() { const status = internal(this).status; return status >= 200 && status <= 299; },
            status() { return internal(this).status; },
            statusText() { return internal(this).statusText; },
            headers() { return internal(this).headers; },
            url() { return internal(this).url; },
            redirected() { return internal(this).redirected; },
            type() { return internal(this).type; },
            bodyUsed() { return internal(this).bodyUsed; },
            body() {
                const state = internal(this);
                if (!state.bodyStream) {
                    const body = state.body;
                    state.bodyStream = new window.ReadableStream({
                        async start(controller) {
                            controller.enqueue(new TextEncoder().encode(await bodyText(body)));
                            controller.close();
                        }
                    });
                }
                return state.bodyStream;
            }
        },
        methods: {
            text() { internal(this).bodyUsed = true; return bodyText(internal(this).body); },
            json() { internal(this).bodyUsed = true; return bodyText(internal(this).body).then(text => JSON.parse(text)); },
            arrayBuffer() {
                internal(this).bodyUsed = true;
                return bodyText(internal(this).body).then(text => new TextEncoder().encode(text).buffer);
            },
            blob() {
                internal(this).bodyUsed = true;
                return bodyText(internal(this).body).then(text => new Blob([text], {
                    type: internal(this).headers.get('content-type') || ''
                }));
            },
            clone() {
                if (internal(this).bodyUsed) throw new TypeError('Body has already been consumed.');
                const clone = new window.Response(internal(this).body, { status: internal(this).status });
                Object.assign(internal(clone), {
                    headers: headersOf(internal(this).headers), statusText: internal(this).statusText,
                    url: internal(this).url, redirected: internal(this).redirected, type: internal(this).type
                });
                return clone;
            }
        }
    });

    // 沙箱没有网络：fetch 与浏览器里一样返回一个 Response 对象（此处按请求成功给出 200）
    window.fetch = window.safefunction(function fetch(input, init = {}) {
        Monitor.logCall('window.fetch', [input, init], 'Promise');
        const mock = Monitor.executeMock('window.fetch', [input, init]);
        if (mock.mocked) return Promise.resolve(mock.result);
        const request = idl.is(input, 'Request') ? input : new window.Request(input, init);
        const response = new window.Response(null, { status: 200, statusText: 'OK' });
        Object.assign(internal(response), { url: request.url });
        return Promise.resolve(response);
    }, 'fetch');

    // ==================== Streams ====================
    function flushReadRequests(stream) {
        const state = internal(stream);
        while (state.pending.length) {
            const request = state.pending[0];
            if (state.queue.length) {
                state.pending.shift();
                request.resolve({ value: state.queue.shift(), done: false });
            } else if (state.error) {
                state.pending.shift();
                request.reject(state.error);
            } else if (state.closed) {
                state.pending.shift();
                request.resolve({ value: undefined, done: true });
            } else {
                break;
            }
        }
    }

    function streamController(stream) {
        return {
            enqueue(chunk) {
                const state = internal(stream);
                if (state.closed) throw new TypeError('Cannot enqueue a chunk into a readable stream that is closed or errored.');
                state.queue.push(chunk);
                flushReadRequests(stream);
                if (typeof state.pull === 'function') state.pull(this);
            },
            close() {
                const state = internal(stream);
                state.closed = true;
                flushReadRequests(stream);
            },
            error(reason) {
                const state = internal(stream);
                state.error = reason === undefined ? new TypeError('stream error') : reason;
                state.closed = true;
                flushReadRequests(stream);
            },
            get desiredSize() {
                const state = internal(stream);
                return state.highWaterMark - state.queue.length;
            }
        };
    }

    defineInterface('ReadableStreamDefaultReader', {
        attributes: { closed() { return internal(this).closedPromise; } },
        methods: {
            read() {
                const state = internal(this);
                if (state.released) {
                    return Promise.reject(new TypeError("Failed to execute 'read' on 'ReadableStreamDefaultReader': "
                        + 'This reader has been released.'));
                }
                return readFromStream(state.stream);
            },
            cancel(reason = undefined) {
                cancelStream(internal(this).stream, reason);
                return Promise.resolve();
            },
            releaseLock() {
                const state = internal(this);
                if (state.released) return;
                state.released = true;
                internal(state.stream).locked = false;
            }
        }
    });

    function readFromStream(stream) {
        const state = internal(stream);
        if (state.queue.length) return Promise.resolve({ value: state.queue.shift(), done: false });
        if (state.error) return Promise.reject(state.error);
        if (state.closed) return Promise.resolve({ value: undefined, done: true });
        return new Promise((resolve, reject) => state.pending.push({ resolve, reject }));
    }

    function cancelStream(stream, reason) {
        const state = internal(stream);
        state.closed = true;
        state.queue.length = 0;
        if (typeof state.cancel === 'function') state.cancel(reason);
        flushReadRequests(stream);
    }

    defineInterface('ReadableStream', {
        length: 0,
        construct(underlyingSource = undefined, strategy = {}) {
            const source = underlyingSource || {};
            Object.assign(internal(this), {
                queue: [], pending: [], closed: false, error: null, locked: false,
                highWaterMark: strategy && strategy.highWaterMark !== undefined ? Number(strategy.highWaterMark) : 1,
                pull: typeof source.pull === 'function' ? source.pull.bind(source) : null,
                cancel: typeof source.cancel === 'function' ? source.cancel.bind(source) : null
            });
            if (typeof source.start === 'function') source.start(streamController(this));
        },
        attributes: { locked() { return internal(this).locked; } },
        methods: {
            getReader() {
                const state = internal(this);
                state.locked = true;
                return define('ReadableStreamDefaultReader',
                    { stream: this, released: false, closedPromise: new Promise(() => {}) });
            },
            cancel(reason = undefined) { cancelStream(this, reason); return Promise.resolve(); },
            tee() {
                const state = internal(this);
                const first = new window.ReadableStream({
                    start(controller) { state.queue.forEach(chunk => controller.enqueue(chunk)); controller.close(); }
                });
                const second = new window.ReadableStream({
                    start(controller) { internal(first).queue.forEach(chunk => controller.enqueue(chunk)); controller.close(); }
                });
                return [first, second];
            },
            async pipeTo(destination, options = undefined) {
                const reader = this.getReader();
                const writer = destination.getWriter();
                try {
                    for (;;) {
                        const { value, done } = await reader.read();
                        if (done) break;
                        await writer.write(value);
                    }
                    await writer.close();
                } catch (error) {
                    await writer.abort(error);
                }
            },
            pipeThrough(transform) {
                this.pipeTo(transform.writable);
                return transform.readable;
            }
        }
    });

    defineInterface('WritableStreamDefaultWriter', {
        attributes: {
            closed() { return internal(this).closedPromise; },
            ready() { return Promise.resolve(); },
            desiredSize() { return 1; }
        },
        methods: {
            write(chunk = undefined) {
                const state = internal(this);
                const sink = internal(state.stream).sink;
                state.chain = state.chain.then(() => (typeof sink.write === 'function' ? sink.write(chunk) : undefined));
                return state.chain;
            },
            close() {
                const state = internal(this);
                const sink = internal(state.stream).sink;
                state.chain = state.chain.then(() => (typeof sink.close === 'function' ? sink.close() : undefined));
                return state.chain;
            },
            abort(reason = undefined) {
                const state = internal(this);
                const sink = internal(state.stream).sink;
                state.released = true;
                return Promise.resolve(typeof sink.abort === 'function' ? sink.abort(reason) : undefined);
            },
            releaseLock() { internal(this).released = true; }
        }
    });

    defineInterface('WritableStream', {
        length: 0,
        construct(underlyingSink = undefined) {
            Object.assign(internal(this), {
                sink: underlyingSink || {}, locked: false, closed: false
            });
            const sink = internal(this).sink;
            if (typeof sink.start === 'function') sink.start(streamController(this));
        },
        attributes: { locked() { return internal(this).locked; } },
        methods: {
            getWriter() {
                internal(this).locked = true;
                return define('WritableStreamDefaultWriter',
                    { stream: this, released: false, chain: Promise.resolve(), closedPromise: new Promise(() => {}) });
            },
            abort(reason = undefined) {
                internal(this).closed = true;
                const sink = internal(this).sink;
                return Promise.resolve(typeof sink.abort === 'function' ? sink.abort(reason) : undefined);
            },
            close() { return this.getWriter().close(); }
        }
    });

    defineInterface('TransformStream', {
        length: 0,
        construct(transformer = undefined) {
            const source = transformer || {};
            let readableController = null;
            const readable = new window.ReadableStream({
                start(controller) { readableController = controller; }
            });
            const controller = streamController(readable);
            readableController = controller;
            const writable = new window.WritableStream({
                write(chunk) {
                    if (typeof source.transform === 'function') {
                        return source.transform(chunk, {
                            enqueue: value => controller.enqueue(value),
                            error: reason => controller.error(reason),
                            terminate() { controller.close(); }
                        });
                    }
                    controller.enqueue(chunk);
                    return undefined;
                },
                close() { if (typeof source.flush === 'function') source.flush(controller); controller.close(); },
                abort(reason) { controller.error(reason); }
            });
            Object.assign(internal(this), { readable, writable });
        },
        attributes: {
            readable() { return internal(this).readable; },
            writable() { return internal(this).writable; }
        }
    });

    // ==================== 语音合成 ====================
    defineInterface('SpeechSynthesisVoice', {
        attributes: {
            default() { return internal(this).isDefault; },
            lang() { return internal(this).lang; },
            localService() { return internal(this).localService; },
            name() { return internal(this).name; },
            voiceURI() { return internal(this).voiceURI; }
        }
    });

    function settable(key) {
        return {
            get() { return internal(this)[key]; },
            set(value) { internal(this)[key] = value; }
        };
    }

    defineInterface('SpeechSynthesisUtterance', {
        parent: 'EventTarget',
        length: 0,
        construct(text = '') {
            Object.assign(internal(this), {
                text: String(text), lang: '', voice: null, volume: 1, rate: 1, pitch: 1,
                onstart: null, onend: null, onerror: null, onboundary: null, onpause: null, onresume: null, onmark: null
            });
        },
        attributes: {
            text: settable('text'), lang: settable('lang'), voice: settable('voice'),
            volume: settable('volume'), rate: settable('rate'), pitch: settable('pitch'),
            onstart: handlerAttribute('onstart'), onend: handlerAttribute('onend'),
            onerror: handlerAttribute('onerror'), onboundary: handlerAttribute('onboundary'),
            onpause: handlerAttribute('onpause'), onresume: handlerAttribute('onresume'),
            onmark: handlerAttribute('onmark')
        }
    });

    defineInterface('SpeechSynthesis', {
        parent: 'EventTarget',
        attributes: {
            pending() { return internal(this).pending; },
            speaking() { return internal(this).speaking; },
            paused() { return internal(this).paused; },
            onvoiceschanged: handlerAttribute('onvoiceschanged')
        },
        methods: {
            speak(utterance) {
                const state = internal(this);
                state.speaking = true;
                state.pending = false;
                Monitor.logCall('SpeechSynthesis.speak', [utterance], null);
                // 沙箱没有语音后端：与「没有可用语音」时一致，立刻结束
                window.setTimeout(() => {
                    state.speaking = false;
                    if (utterance && typeof utterance === 'object') {
                        fire(utterance, new window.Event('end'));
                    }
                }, 0);
            },
            cancel() { Object.assign(internal(this), { speaking: false, pending: false }); },
            pause() { internal(this).paused = true; },
            resume() { internal(this).paused = false; },
            getVoices() { return []; }
        }
    });

    Object.defineProperty(window, 'speechSynthesis', {
        value: define('SpeechSynthesis', { speaking: false, pending: false, paused: false, onvoiceschanged: null }),
        writable: true, enumerable: true, configurable: true
    });

    // ==================== 媒体捕获 ====================
    let trackCounter = 0;
    defineInterface('MediaStreamTrack', {
        parent: 'EventTarget',
        attributes: {
            kind() { return internal(this).kind; },
            id() { return internal(this).id; },
            label() { return internal(this).label; },
            enabled() { return internal(this).enabled; },
            muted() { return internal(this).muted; },
            readyState() { return internal(this).readyState; },
            onended: handlerAttribute('onended'),
            onmute: handlerAttribute('onmute'),
            onunmute: handlerAttribute('onunmute')
        },
        methods: {
            stop() { internal(this).readyState = 'ended'; },
            clone() {
                const state = internal(this);
                return define('MediaStreamTrack', {
                    kind: state.kind, id: `track-${++trackCounter}`, label: state.label,
                    enabled: state.enabled, muted: state.muted, readyState: state.readyState
                });
            },
            getSettings() { return {}; },
            getCapabilities() { return {}; }
        }
    });

    defineInterface('MediaStream', {
        parent: 'EventTarget',
        length: 0,
        construct(streamOrTracks = undefined) {
            const tracks = [];
            if (Array.isArray(streamOrTracks)) tracks.push(...streamOrTracks);
            else if (idl.is(streamOrTracks, 'MediaStream')) tracks.push(...internal(streamOrTracks).tracks);
            Object.assign(internal(this), {
                id: `stream-${++trackCounter}`, tracks, onaddtrack: null, onremovetrack: null
            });
        },
        attributes: {
            id() { return internal(this).id; },
            active() { return internal(this).tracks.some(track => internal(track).readyState === 'live'); },
            onaddtrack: handlerAttribute('onaddtrack'),
            onremovetrack: handlerAttribute('onremovetrack')
        },
        methods: {
            getTracks() { return internal(this).tracks.slice(); },
            getAudioTracks() { return internal(this).tracks.filter(track => internal(track).kind === 'audio'); },
            getVideoTracks() { return internal(this).tracks.filter(track => internal(track).kind === 'video'); },
            getTrackById(id) { return internal(this).tracks.find(track => internal(track).id === String(id)) || null; },
            addTrack(track) {
                const state = internal(this);
                if (!state.tracks.includes(track)) state.tracks.push(track);
            },
            removeTrack(track) {
                const state = internal(this);
                state.tracks = state.tracks.filter(item => item !== track);
            },
            clone() {
                const state = internal(this);
                return define('MediaStream', {
                    id: `stream-${++trackCounter}`, tracks: state.tracks.map(track => track.clone()),
                    onaddtrack: null, onremovetrack: null
                });
            }
        }
    });

    defineInterface('MediaRecorder', {
        parent: 'EventTarget',
        length: 1,
        construct(stream, options = {}) {
            if (!idl.is(stream, 'MediaStream')) {
                throw new TypeError("Failed to construct 'MediaRecorder': parameter 1 is not of type 'MediaStream'.");
            }
            Object.assign(internal(this), {
                stream, state: 'inactive', mimeType: options.mimeType === undefined ? '' : String(options.mimeType),
                audioBitsPerSecond: Number(options.audioBitsPerSecond) || 0,
                videoBitsPerSecond: Number(options.videoBitsPerSecond) || 0,
                ondataavailable: null, onerror: null, onpause: null, onresume: null, onstart: null, onstop: null
            });
        },
        attributes: {
            stream() { return internal(this).stream; },
            mimeType() { return internal(this).mimeType; },
            state() { return internal(this).state; },
            audioBitsPerSecond() { return internal(this).audioBitsPerSecond; },
            videoBitsPerSecond() { return internal(this).videoBitsPerSecond; },
            ondataavailable: handlerAttribute('ondataavailable'),
            onerror: handlerAttribute('onerror'),
            onpause: handlerAttribute('onpause'),
            onresume: handlerAttribute('onresume'),
            onstart: handlerAttribute('onstart'),
            onstop: handlerAttribute('onstop')
        },
        statics: {
            isTypeSupported(type) { return /^(audio|video)\//.test(String(type)); }
        },
        methods: {
            start(timeslice = undefined) {
                const state = internal(this);
                if (state.state !== 'inactive') {
                    throw new DOMException("Failed to execute 'start' on 'MediaRecorder': The MediaRecorder's state is "
                        + "'recording' or 'paused'.", 'InvalidStateError');
                }
                state.state = 'recording';
                window.setTimeout(() => fire(this, new window.Event('start')), 0);
            },
            stop() {
                const state = internal(this);
                if (state.state === 'inactive') return;
                state.state = 'inactive';
                window.setTimeout(() => fire(this, new window.Event('stop')), 0);
            },
            pause() {
                const state = internal(this);
                if (state.state !== 'recording') return;
                state.state = 'paused';
                window.setTimeout(() => fire(this, new window.Event('pause')), 0);
            },
            resume() {
                const state = internal(this);
                if (state.state !== 'paused') return;
                state.state = 'recording';
                window.setTimeout(() => fire(this, new window.Event('resume')), 0);
            },
            requestData() {
                Monitor.logCall('MediaRecorder.requestData', [], null);
            }
        }
    });

    // ==================== Push API ====================
    defineInterface('PushManager', {
        methods: {
            getSubscription() { return Promise.resolve(null); },
            permissionState() { return Promise.resolve('denied'); },
            subscribe() {
                return Promise.reject(new DOMException('Registration failed - push service error', 'AbortError'));
            }
        }
    });
    Object.defineProperty(window, '__pushManager__', {
        value: define('PushManager', {}), configurable: true
    });

    // ==================== XSLTProcessor ====================
    // 沙箱里没有 XSLT 引擎：按恒等变换处理（与 identity stylesheet 的结果一致）
    defineInterface('XSLTProcessor', {
        construct() {
            Object.assign(internal(this), { stylesheet: null, parameters: new Map() });
        },
        methods: {
            importStylesheet(stylesheet) {
                internal(this).stylesheet = stylesheet || null;
            },
            transformToFragment(source, outputDocument) {
                Monitor.logCall('XSLTProcessor.transformToFragment', [], '[DocumentFragment]');
                const document_ = outputDocument || window.document;
                const fragment = document_.createDocumentFragment();
                if (source && source.nodeType === 1) fragment.appendChild(source.cloneNode(true));
                return fragment;
            },
            transformToDocument(source) {
                Monitor.logCall('XSLTProcessor.transformToDocument', [], '[Document]');
                const serialized = source && window.XMLSerializer ? new window.XMLSerializer().serializeToString(source) : '';
                return new window.DOMParser().parseFromString(serialized, 'application/xml');
            },
            setParameter(namespaceURI, localName, value) {
                internal(this).parameters.set(`${namespaceURI ?? ''}|${localName}`, value);
            },
            getParameter(namespaceURI, localName) {
                return internal(this).parameters.get(`${namespaceURI ?? ''}|${localName}`) ?? null;
            },
            removeParameter(namespaceURI, localName) {
                internal(this).parameters.delete(`${namespaceURI ?? ''}|${localName}`);
            },
            clearParameters() { internal(this).parameters.clear(); },
            reset() { Object.assign(internal(this), { stylesheet: null, parameters: new Map() }); }
        }
    });

    // ==================== window.external ====================
    defineInterface('External', {
        methods: {
            AddSearchProvider() {},
            IsSearchProviderInstalled() {}
        }
    });
    Object.defineProperty(window, 'external', {
        value: define('External', {}), writable: true, enumerable: true, configurable: true
    });
})();
