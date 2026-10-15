/**
 * @env-module url
 * @description WHATWG URL 与 URLSearchParams：接口形态按 WebIDL 定义；解析与表单编码委托宿主的 WHATWG 实现，只交换字符串
 * @compatibility Chrome 120+
 */
(function () {
    'use strict';

    const idl = window.__webidl__;
    const bridge = window.__host__.url;
    const markNative = window.safefunction;

    function toUSVString(value) {
        return String(value).toWellFormed();
    }

    // ==================== URLSearchParams ====================
    function queryStateOf(params) {
        return idl.internal(params);
    }

    // 列表变化后同步回关联的 URL（URL 标准 "update steps"）
    function updateURL(state) {
        if (!state.url) return;
        const urlState = idl.internal(state.url);
        urlState.record = bridge.update(urlState.record.href, 'search', bridge.serializeQuery(state.list));
    }

    function listFromInit(init) {
        if (init !== null && (typeof init === 'object' || typeof init === 'function')) {
            if (typeof init[Symbol.iterator] === 'function') {
                const list = [];
                for (const pair of init) {
                    const items = Array.from(pair);
                    if (items.length !== 2) {
                        throw new TypeError("Failed to construct 'URLSearchParams': Sequence initializer must only contain pair elements");
                    }
                    list.push([toUSVString(items[0]), toUSVString(items[1])]);
                }
                return list;
            }
            return Object.keys(init).map(key => [toUSVString(key), toUSVString(init[key])]);
        }
        const query = toUSVString(init);
        return bridge.parseQuery(query.startsWith('?') ? query.slice(1) : query);
    }

    // URLSearchParams 迭代器：原型链 → %IteratorPrototype%，与 Chrome 相同的 toStringTag
    const iteratorStates = new WeakMap();
    const IteratorPrototype = Object.getPrototypeOf(Object.getPrototypeOf([][Symbol.iterator]()));
    const iteratorPrototype = Object.create(IteratorPrototype);
    const nextHolder = {
        next() {
            const iterator = iteratorStates.get(this);
            if (!iterator) throw new TypeError('Illegal invocation');
            const list = iterator.state.list;
            if (iterator.index >= list.length) return { value: undefined, done: true };
            const [name, value] = list[iterator.index++];
            if (iterator.kind === 'key') return { value: name, done: false };
            if (iterator.kind === 'value') return { value, done: false };
            return { value: [name, value], done: false };
        }
    };
    Object.defineProperty(iteratorPrototype, 'next', {
        value: markNative(nextHolder.next), writable: true, enumerable: true, configurable: true
    });
    Object.defineProperty(iteratorPrototype, Symbol.toStringTag, {
        value: 'URLSearchParams Iterator', configurable: true
    });

    function createIterator(params, kind) {
        const iterator = Object.create(iteratorPrototype);
        iteratorStates.set(iterator, { state: queryStateOf(params), kind, index: 0 });
        return iterator;
    }

    const URLSearchParams = idl.defineInterface('URLSearchParams', {
        construct(init = '') {
            const state = queryStateOf(this);
            state.list = listFromInit(init);
            state.url = null;
        },
        attributes: {
            size() { return queryStateOf(this).list.length; }
        },
        methods: {
            append(name, value) {
                const state = queryStateOf(this);
                state.list.push([toUSVString(name), toUSVString(value)]);
                updateURL(state);
            },
            delete(name, value = undefined) {
                const state = queryStateOf(this);
                const key = toUSVString(name);
                const expected = value === undefined ? undefined : toUSVString(value);
                state.list = state.list.filter(([itemName, itemValue]) =>
                    itemName !== key || (expected !== undefined && itemValue !== expected));
                updateURL(state);
            },
            get(name) {
                const key = toUSVString(name);
                const found = queryStateOf(this).list.find(([itemName]) => itemName === key);
                return found ? found[1] : null;
            },
            getAll(name) {
                const key = toUSVString(name);
                return queryStateOf(this).list.filter(([itemName]) => itemName === key).map(item => item[1]);
            },
            has(name, value = undefined) {
                const key = toUSVString(name);
                const expected = value === undefined ? undefined : toUSVString(value);
                return queryStateOf(this).list.some(([itemName, itemValue]) =>
                    itemName === key && (expected === undefined || itemValue === expected));
            },
            set(name, value) {
                const state = queryStateOf(this);
                const key = toUSVString(name);
                const text = toUSVString(value);
                const index = state.list.findIndex(([itemName]) => itemName === key);
                if (index === -1) {
                    state.list.push([key, text]);
                } else {
                    state.list[index] = [key, text];
                    state.list = state.list.filter(([itemName], position) => position <= index || itemName !== key);
                }
                updateURL(state);
            },
            sort() {
                const state = queryStateOf(this);
                // Array.prototype.sort 是稳定排序，按 UTF-16 码元比较名称
                state.list.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
                updateURL(state);
            },
            toString() {
                return bridge.serializeQuery(queryStateOf(this).list);
            },
            forEach(callback, thisArg = undefined) {
                if (typeof callback !== 'function') {
                    throw new TypeError("Failed to execute 'forEach' on 'URLSearchParams': The callback provided as parameter 1 is not a function.");
                }
                const state = queryStateOf(this);
                for (let index = 0; index < state.list.length; index++) {
                    const [name, value] = state.list[index];
                    callback.call(thisArg, value, name, this);
                }
            },
            entries() { return createIterator(this, 'entries'); },
            keys() { return createIterator(this, 'key'); },
            values() { return createIterator(this, 'value'); }
        }
    });
    // WebIDL：@@iterator 与 entries 是同一个函数，且不可枚举
    Object.defineProperty(URLSearchParams.prototype, Symbol.iterator, {
        value: URLSearchParams.prototype.entries, writable: true, enumerable: false, configurable: true
    });

    // ==================== URL ====================
    function urlStateOf(url) {
        return idl.internal(url);
    }

    function setComponent(url, name, value) {
        const state = urlStateOf(url);
        state.record = bridge.update(state.record.href, name, toUSVString(value));
        queryStateOf(state.query).list = bridge.parseQuery(state.record.search.slice(1));
    }

    function componentAttribute(name) {
        return {
            get() { return urlStateOf(this).record[name]; },
            set(value) { setComponent(this, name, value); }
        };
    }

    function parseWithBase(url, base) {
        if (base === undefined) return bridge.parse(toUSVString(url));
        return bridge.parse(toUSVString(url), toUSVString(base));
    }

    function randomUUID() {
        const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16));
        hex[12] = '4';
        hex[16] = (8 + Math.floor(Math.random() * 4)).toString(16);
        const text = hex.join('');
        return `${text.slice(0, 8)}-${text.slice(8, 12)}-${text.slice(12, 16)}-${text.slice(16, 20)}-${text.slice(20)}`;
    }

    const objectURLs = new Set();

    idl.defineInterface('URL', {
        length: 1,
        construct(url, base = undefined) {
            if (base !== undefined && bridge.parse(toUSVString(base)) === null) {
                throw new TypeError("Failed to construct 'URL': Invalid base URL");
            }
            const record = parseWithBase(url, base);
            if (record === null) throw new TypeError("Failed to construct 'URL': Invalid URL");
            const state = urlStateOf(this);
            state.record = record;
            state.query = idl.create('URLSearchParams', {
                list: bridge.parseQuery(record.search.slice(1)), url: this
            });
        },
        attributes: {
            href: {
                get() { return urlStateOf(this).record.href; },
                set(value) {
                    const record = bridge.parse(toUSVString(value));
                    if (record === null) throw new TypeError("Failed to set the 'href' property on 'URL': Invalid URL");
                    const state = urlStateOf(this);
                    state.record = record;
                    queryStateOf(state.query).list = bridge.parseQuery(record.search.slice(1));
                }
            },
            origin() { return urlStateOf(this).record.origin; },
            protocol: componentAttribute('protocol'),
            username: componentAttribute('username'),
            password: componentAttribute('password'),
            host: componentAttribute('host'),
            hostname: componentAttribute('hostname'),
            port: componentAttribute('port'),
            pathname: componentAttribute('pathname'),
            search: componentAttribute('search'),
            searchParams() { return urlStateOf(this).query; },
            hash: componentAttribute('hash')
        },
        methods: {
            toJSON() { return urlStateOf(this).record.href; },
            toString() { return urlStateOf(this).record.href; }
        },
        statics: {
            canParse(url, base = undefined) {
                if (base !== undefined && bridge.parse(toUSVString(base)) === null) return false;
                return parseWithBase(url, base) !== null;
            },
            createObjectURL(object) {
                const origin = window.location ? window.location.origin : 'null';
                const url = `blob:${origin}/${randomUUID()}`;
                objectURLs.add(url);
                return url;
            },
            revokeObjectURL(url) {
                objectURLs.delete(String(url));
            }
        }
    });

    // Chrome 保留的旧别名
    idl.exposeGlobal('webkitURL', window.URL);
})();
