/**
 * @env-module XMLHttpRequest
 * @description XHR 状态、响应与事件模拟；通过 EnvMonitor 的 XMLHttpRequest.send mock 提供响应，不发真实请求。
 * @compatibility Chrome 120+
 * 依赖：WebIDL.js、eventCore.js、event.js、apis.js、textencoder.js、blob.js。
 */
(function () {
    'use strict';

    const idl = window.__webidl__;
    const internal = idl.internal;
    const Monitor = window.__EnvMonitor__;
    const dispatch = EventTarget.prototype.dispatchEvent;
    const token = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
    const responseTypes = new Set(['', 'text', 'json', 'arraybuffer', 'blob', 'document']);
    const forbiddenHeaders = new Set(['accept-charset', 'accept-encoding', 'access-control-request-headers',
        'access-control-request-method', 'connection', 'content-length', 'cookie', 'cookie2', 'date',
        'dnt', 'expect', 'host', 'keep-alive', 'origin', 'referer', 'te', 'trailer', 'transfer-encoding',
        'upgrade', 'via']);

    function handler(key) {
        return {
            get() { return internal(this)[key] ?? null; },
            set(value) { internal(this)[key] = typeof value === 'function' || (value && typeof value === 'object') ? value : null; }
        };
    }
    const handlers = {};
    for (const type of ['loadstart', 'progress', 'abort', 'error', 'load', 'timeout', 'loadend']) {
        handlers['on' + type] = handler('on' + type);
    }
    idl.defineInterface('XMLHttpRequestEventTarget', { parent: 'EventTarget', attributes: handlers });
    idl.defineInterface('XMLHttpRequestUpload', { parent: 'XMLHttpRequestEventTarget' });

    function fire(target, type, loaded = 0, total = 0) {
        const event = type === 'readystatechange' ? new Event(type) :
            new ProgressEvent(type, { loaded, total, lengthComputable: total > 0 });
        dispatch.call(target, event);
    }
    function resetResponse(state) {
        Object.assign(state, { status: 0, statusText: '', responseURL: '', text: '',
            responseHeaders: new Map(), responseValue: null });
    }
    function cancelTasks(state) {
        for (const timer of state.timers) clearTimeout(timer);
        state.timers.clear();
        state.timeoutTask = undefined;
        state.generation++;
    }
    function schedule(state, callback, delay) {
        const timer = setTimeout(() => { state.timers.delete(timer); callback(); }, delay);
        state.timers.add(timer);
    }
    function active(state, generation) { return state.sent && state.generation === generation; }
    function changeState(xhr, value) {
        internal(xhr).readyState = value;
        fire(xhr, 'readystatechange');
    }
    function invalidState() { throw new DOMException('The object is in an invalid state.', 'InvalidStateError'); }

    function finishError(xhr, type) {
        const state = internal(xhr);
        cancelTasks(state);
        const generation = state.generation;
        const uploadPending = state.uploadPending;
        state.sent = false;
        state.uploadPending = false;
        resetResponse(state);
        changeState(xhr, 4);
        // 监听器可能重新 open/send；旧请求不应继续派发事件或覆盖新请求。
        if (state.generation !== generation) return;
        if (uploadPending) {
            fire(state.upload, type);
            if (state.generation !== generation) return;
            fire(state.upload, 'loadend');
        }
        if (state.generation !== generation) return;
        fire(xhr, type);
        if (state.generation === generation) fire(xhr, 'loadend');
    }

    function responseBytes(body) {
        if (body instanceof Blob) return body._bytes.slice();
        if (body instanceof ArrayBuffer) return new Uint8Array(body.slice(0));
        if (ArrayBuffer.isView(body)) return new Uint8Array(body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength));
        const text = body == null ? '' : typeof body === 'object' ? JSON.stringify(body) : String(body);
        return new TextEncoder().encode(text);
    }

    function complete(xhr, data, generation) {
        const state = internal(xhr);
        if (!active(state, generation)) return;
        if (data.error || data.status === 0) { finishError(xhr, 'error'); return; }
        let bytes;
        try {
            const status = data.status === undefined ? 200 : Number(data.status);
            if (!Number.isInteger(status) || status < 200 || status > 599) throw new TypeError('Invalid status');
            const headers = new Headers(data.headers);
            bytes = responseBytes(state.method === 'HEAD' || [204, 205, 304].includes(status) ? null : data.body);
            data = { ...data, status, headers };
        } catch (_) { finishError(xhr, 'error'); return; }
        if (state.uploadPending && state.async) {
            state.uploadPending = false;
            for (const type of ['progress', 'load', 'loadend']) {
                fire(state.upload, type, state.uploadSize, state.uploadSize);
                if (!active(state, generation)) return;
            }
        }
        state.uploadPending = false;
        state.status = data.status;
        state.statusText = data.statusText === undefined ? (state.status === 200 ? 'OK' : '') : String(data.statusText);
        state.responseURL = state.url;
        state.responseHeaders = new Map([...data.headers].filter(([name]) => !['set-cookie', 'set-cookie2'].includes(name)));
        if (state.async) {
            changeState(xhr, 2);
            if (!active(state, generation)) return;
        } else state.readyState = 2;
        const mime = state.mimeType || state.responseHeaders.get('content-type') || 'text/xml';
        let decoder;
        try { decoder = new TextDecoder(/charset\s*=\s*["']?([^\s;"']+)/i.exec(mime)?.[1] || 'utf-8'); }
        catch (_) { decoder = new TextDecoder(); }
        state.text = decoder.decode(bytes);
        switch (state.responseType) {
            case 'json':
                try { state.responseValue = JSON.parse(state.text); } catch (_) { state.responseValue = null; }
                break;
            case 'arraybuffer': state.responseValue = bytes.buffer; break;
            case 'blob': state.responseValue = new Blob([bytes], { type: mime.split(';')[0].trim().toLowerCase() }); break;
            case 'document':
                state.responseValue = /xml|html/i.test(mime) ? new DOMParser().parseFromString(state.text,
                    /html/i.test(mime) ? 'text/html' : 'application/xml') : null;
                break;
        }
        if (state.async && bytes.length) {
            changeState(xhr, 3);
            if (!active(state, generation)) return;
            fire(xhr, 'progress', bytes.length, bytes.length);
            if (!active(state, generation)) return;
        }
        cancelTasks(state);
        const completed = state.generation;
        state.sent = false;
        changeState(xhr, 4);
        if (state.generation !== completed) return;
        fire(xhr, 'load', bytes.length, bytes.length);
        if (state.generation === completed) fire(xhr, 'loadend', bytes.length, bytes.length);
    }

    idl.defineInterface('XMLHttpRequest', {
        parent: 'XMLHttpRequestEventTarget',
        constants: { UNSENT: 0, OPENED: 1, HEADERS_RECEIVED: 2, LOADING: 3, DONE: 4 },
        construct() {
            const state = internal(this);
            Object.assign(state, { readyState: 0, responseType: '', timeout: 0, withCredentials: false,
                async: true, sent: false, generation: 0, timers: new Set(), requestHeaders: new Map(),
                upload: idl.create('XMLHttpRequestUpload'), uploadPending: false, mimeType: '' });
            resetResponse(state);
        },
        attributes: {
            onreadystatechange: handler('onreadystatechange'),
            readyState() { return internal(this).readyState; },
            status() { return internal(this).status; },
            statusText() { return internal(this).statusText; },
            responseURL() { return internal(this).responseURL; },
            upload() { return internal(this).upload; },
            responseText() {
                const state = internal(this);
                if (state.responseType && state.responseType !== 'text') invalidState();
                return state.readyState >= 3 ? state.text : '';
            },
            response() {
                const state = internal(this);
                if (!state.responseType || state.responseType === 'text') return this.responseText;
                return state.readyState === 4 ? state.responseValue : null;
            },
            responseXML() {
                const state = internal(this);
                if (state.responseType && state.responseType !== 'document') invalidState();
                if (state.readyState !== 4 || !state.status) return null;
                if (state.responseType === 'document') return state.responseValue;
                const mime = state.mimeType || state.responseHeaders.get('content-type') || 'text/xml';
                if (!/xml/i.test(mime)) return null;
                if (!state.responseValue) state.responseValue = new DOMParser().parseFromString(state.text, 'application/xml');
                return state.responseValue;
            },
            responseType: {
                get() { return internal(this).responseType; },
                set(value) {
                    const state = internal(this);
                    if (state.readyState >= 3) invalidState();
                    if (!state.async) throw new DOMException('Synchronous XHR does not support responseType.', 'InvalidAccessError');
                    if (responseTypes.has(String(value))) state.responseType = String(value);
                }
            },
            timeout: {
                get() { return internal(this).timeout; },
                set(value) {
                    const state = internal(this);
                    if (!state.async) throw new DOMException('Synchronous XHR does not support timeout.', 'InvalidAccessError');
                    state.timeout = Number(value) >>> 0;
                    if (state.sent) armTimeout(this);
                }
            },
            withCredentials: {
                get() { return internal(this).withCredentials; },
                set(value) {
                    const state = internal(this);
                    if (state.readyState > 1 || state.sent) invalidState();
                    state.withCredentials = !!value;
                }
            }
        },
        methods: {
            open(method, url, async = true, user = null, password = null) {
                const state = internal(this);
                let verb = String(method);
                if (!token.test(verb)) throw new DOMException('Invalid HTTP method.', 'SyntaxError');
                const upper = verb.toUpperCase();
                if (['CONNECT', 'TRACE', 'TRACK'].includes(upper)) throw new DOMException('Forbidden HTTP method.', 'SecurityError');
                if (['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT'].includes(upper)) verb = upper;
                let parsed;
                try { parsed = new URL(String(url), window.location.href); }
                catch (_) { throw new DOMException('Invalid URL.', 'SyntaxError'); }
                parsed.hash = '';
                if (user !== null) parsed.username = String(user);
                if (password !== null) parsed.password = String(password);
                if (!async && (state.timeout || state.responseType)) throw new DOMException('Invalid synchronous XHR options.', 'InvalidAccessError');
                cancelTasks(state);
                resetResponse(state);
                Object.assign(state, { method: verb, url: parsed.href, async: !!async, sent: false,
                    requestHeaders: new Map(), uploadPending: false, mimeType: '' });
                Monitor?.logCall('XMLHttpRequest.open', [method, url, async]);
                if (state.readyState !== 1) changeState(this, 1);
            },
            setRequestHeader(name, value) {
                const state = internal(this);
                if (state.readyState !== 1 || state.sent) invalidState();
                const key = String(name).toLowerCase();
                const text = String(value).replace(/^[\t ]+|[\t ]+$/g, '');
                if (!token.test(key) || /[\0\r\n]/.test(text)) throw new DOMException('Invalid HTTP header.', 'SyntaxError');
                if (forbiddenHeaders.has(key) || /^(proxy-|sec-)/.test(key)) return;
                state.requestHeaders.set(key, state.requestHeaders.has(key) ? state.requestHeaders.get(key) + ', ' + text : text);
            },
            getResponseHeader(name) {
                const state = internal(this);
                return state.readyState < 2 ? null : state.responseHeaders.get(String(name).toLowerCase()) ?? null;
            },
            getAllResponseHeaders() {
                const state = internal(this);
                return state.readyState < 2 ? '' : [...state.responseHeaders].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
                    .map(([name, value]) => `${name}: ${value}\r\n`).join('');
            },
            overrideMimeType(mime) {
                const state = internal(this);
                if (state.readyState >= 3) invalidState();
                state.mimeType = String(mime);
            },
            send(body = null) {
                const state = internal(this);
                if (state.readyState !== 1 || state.sent) invalidState();
                const request = new Request(state.url, { method: state.method, headers: [...state.requestHeaders],
                    body: state.method === 'GET' || state.method === 'HEAD' ? null : body });
                state.requestHeaders = new Map(request.headers);
                const uploadSize = request.body === null ? 0 : responseBytes(request.body).length;
                state.sent = true;
                state.started = performance.now();
                state.uploadPending = request.body !== null;
                state.uploadSize = uploadSize;
                const generation = state.generation;
                Monitor?.logCall('XMLHttpRequest.send', [body, state.url, state.method]);
                if (state.async) {
                    fire(this, 'loadstart');
                    if (!active(state, generation)) return;
                    if (state.uploadPending) fire(state.upload, 'loadstart');
                    if (!active(state, generation)) return;
                }
                let mock;
                try { mock = Monitor?.executeMock('XMLHttpRequest.send', [request.body, state.url, state.method], this); }
                catch (error) {
                    cancelTasks(state);
                    state.sent = false;
                    state.uploadPending = false;
                    throw error;
                }
                if (!active(state, generation)) return;
                const data = (mock?.mocked ? mock.result : null) || {};
                if (!state.async) { complete(this, data, generation); return; }
                armTimeout(this);
                schedule(state, () => complete(this, data, generation), Math.max(0, Number(data.delay) || 0));
            },
            abort() {
                const state = internal(this);
                if (state.sent) {
                    const nextGeneration = state.generation + 1;
                    finishError(this, 'abort');
                    if (state.generation === nextGeneration && state.readyState === 4) { state.readyState = 0; resetResponse(state); }
                } else if (state.readyState === 4) {
                    cancelTasks(state);
                    state.readyState = 0;
                    resetResponse(state);
                }
            }
        }
    });

    function armTimeout(xhr) {
        const state = internal(xhr);
        if (state.timeoutTask !== undefined) {
            clearTimeout(state.timeoutTask);
            state.timers.delete(state.timeoutTask);
        }
        if (!state.timeout) return;
        const generation = state.generation;
        const timer = setTimeout(() => {
            state.timers.delete(timer);
            if (active(state, generation)) finishError(xhr, 'timeout');
        }, Math.max(0, state.timeout - (performance.now() - state.started)));
        state.timeoutTask = timer;
        state.timers.add(timer);
    }
})();
