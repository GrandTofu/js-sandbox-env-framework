/**
 * @env-module htmlElementAttributes
 * @description HTMLElement 的反射属性（title、lang、hidden、tabIndex 等）与 GlobalEventHandlers（onclick 等）：定义为原型访问器，反射属性读写对应的 HTML 属性
 * @compatibility Chrome 120+
 *
 * 只提供 window.__htmlElementAttributes__.define(prototype)；document.js 与 elements.js 各有一个 HTMLElement，分别调用。
 * 依赖：NativeFunction.js、WebIDL.js、domexception.js；访问器运行时依赖 Element.prototype.getAttribute / setAttribute。
 */
(function () {
    'use strict';

    const idl = window.__webidl__;
    const markNative = window.safefunction;

    // 只接受元素节点；window、普通对象等抛 Illegal invocation
    function checkElement(object) {
        if (!idl.is(object, 'EventTarget') || object === window || object.nodeType !== 1) {
            throw new TypeError('Illegal invocation');
        }
        return object;
    }

    function defineAccessor(prototype, key, get, set) {
        const holder = {
            get [key]() { return get(checkElement(this)); },
            set [key](value) { set(checkElement(this), value); }
        };
        const descriptor = Object.getOwnPropertyDescriptor(holder, key);
        Object.defineProperty(prototype, key, {
            get: markNative(descriptor.get, 'get ' + key),
            set: set ? markNative(descriptor.set, 'set ' + key) : undefined,
            enumerable: true, configurable: true
        });
    }

    // ==================== 反射规则 ====================
    function stringReflect(attribute) {
        return {
            get: element => element.getAttribute(attribute) ?? '',
            set: (element, value) => element.setAttribute(attribute, String(value))
        };
    }

    function booleanReflect(attribute) {
        return {
            get: element => element.hasAttribute(attribute),
            set: (element, value) => {
                if (value) element.setAttribute(attribute, '');
                else element.removeAttribute(attribute);
            }
        };
    }

    // 属性值为 onValue / offValue 时分别为 true / false，其余情况取默认值
    function toggleReflect(attribute, onValue, offValue, defaultOf) {
        return {
            get: element => {
                const value = (element.getAttribute(attribute) ?? '').toLowerCase();
                if (value === onValue || (onValue === 'true' && value === '' && element.hasAttribute(attribute))) return true;
                if (value === offValue) return false;
                return defaultOf(element);
            },
            set: (element, value) => element.setAttribute(attribute, value ? onValue : offValue)
        };
    }

    // a[href]、button、input、select、textarea 等默认可聚焦，tabIndex 为 0
    const focusableTags = new Set(['button', 'input', 'select', 'textarea', 'iframe', 'object', 'summary']);
    function defaultTabIndex(element) {
        if (focusableTags.has(element.localName)) return 0;
        if ((element.localName === 'a' || element.localName === 'area') && element.hasAttribute('href')) return 0;
        return -1;
    }

    function isDraggableByDefault(element) {
        if (element.localName === 'img') return true;
        return element.localName === 'a' && element.hasAttribute('href');
    }

    const contentEditableValues = new Map([['', 'true'], ['true', 'true'], ['false', 'false'], ['plaintext-only', 'plaintext-only']]);
    function contentEditableOf(element) {
        if (!element.hasAttribute('contenteditable')) return 'inherit';
        const value = element.getAttribute('contenteditable').toLowerCase();
        return contentEditableValues.get(value) || 'inherit';
    }

    const reflected = {
        title: stringReflect('title'),
        lang: stringReflect('lang'),
        accessKey: stringReflect('accesskey'),
        autocapitalize: stringReflect('autocapitalize'),
        inputMode: stringReflect('inputmode'),
        enterKeyHint: stringReflect('enterkeyhint'),
        nonce: stringReflect('nonce'),
        hidden: booleanReflect('hidden'),
        inert: booleanReflect('inert'),
        autofocus: booleanReflect('autofocus'),
        dir: {
            get: element => {
                const value = (element.getAttribute('dir') ?? '').toLowerCase();
                return ['ltr', 'rtl', 'auto'].includes(value) ? value : '';
            },
            set: (element, value) => element.setAttribute('dir', String(value))
        },
        tabIndex: {
            get: element => {
                const value = parseInt(element.getAttribute('tabindex') ?? '', 10);
                return Number.isNaN(value) ? defaultTabIndex(element) : value;
            },
            set: (element, value) => element.setAttribute('tabindex', String(Math.trunc(Number(value)) || 0))
        },
        draggable: toggleReflect('draggable', 'true', 'false', isDraggableByDefault),
        spellcheck: toggleReflect('spellcheck', 'true', 'false', () => true),
        translate: toggleReflect('translate', 'yes', 'no', () => true),
        contentEditable: {
            get: contentEditableOf,
            set: (element, value) => {
                const key = String(value).toLowerCase();
                if (key === 'inherit') element.removeAttribute('contenteditable');
                else if (key === 'true' || key === 'false' || key === 'plaintext-only') element.setAttribute('contenteditable', key);
                else throw new DOMException(`Failed to set the 'contentEditable' property on 'HTMLElement': The value provided ('${value}') is not one of 'true', 'false', 'plaintext-only', or 'inherit'.`, 'SyntaxError');
            }
        },
        isContentEditable: { get: element => ['true', 'plaintext-only'].includes(contentEditableOf(element)) },
        accessKeyLabel: { get: () => '' }
    };

    // ==================== GlobalEventHandlers ====================
    // 事件处理属性存在 WeakMap 中；非对象值存为 null
    const handlers = new WeakMap();
    const handlerNames = [
        'onabort', 'onanimationend', 'onanimationiteration', 'onanimationstart', 'onauxclick', 'onbeforeinput',
        'onblur', 'oncancel', 'oncanplay', 'oncanplaythrough', 'onchange', 'onclick', 'onclose', 'oncontextmenu',
        'oncopy', 'oncut', 'ondblclick', 'ondrag', 'ondragend', 'ondragenter', 'ondragleave', 'ondragover',
        'ondragstart', 'ondrop', 'ondurationchange', 'onended', 'onerror', 'onfocus', 'onfocusin', 'onfocusout',
        'oninput', 'oninvalid', 'onkeydown', 'onkeypress', 'onkeyup', 'onload', 'onloadeddata', 'onloadedmetadata',
        'onloadstart', 'onmousedown', 'onmouseenter', 'onmouseleave', 'onmousemove', 'onmouseout', 'onmouseover',
        'onmouseup', 'onmousewheel', 'onpaste', 'onpause', 'onplay', 'onplaying', 'onpointercancel', 'onpointerdown',
        'onpointerenter', 'onpointerleave', 'onpointermove', 'onpointerout', 'onpointerover', 'onpointerup',
        'onprogress', 'onreset', 'onresize', 'onscroll', 'onscrollend', 'onselect', 'onselectionchange',
        'onselectstart', 'onsubmit', 'ontoggle', 'ontouchcancel', 'ontouchend', 'ontouchmove', 'ontouchstart',
        'ontransitionend', 'onwheel'
    ];

    function handlerAccessor(name) {
        return {
            get: element => handlers.get(element)?.[name] ?? null,
            set: (element, value) => {
                let map = handlers.get(element);
                if (!map) {
                    map = {};
                    handlers.set(element, map);
                }
                const isObject = value !== null && (typeof value === 'object' || typeof value === 'function');
                map[name] = isObject ? value : null;
            }
        };
    }

    // ==================== 元素接口导出 ====================
    // 浏览器里元素接口不能直接 new（Illegal constructor），只有 Image / Option / Audio 等构造器例外；
    // 这里把原型上的 toStringTag、全局导出、constructor 与「不可构造」一次做完。
    // 包装函数 → 真实构造函数，供环境内部（如 createElementNS）创建元素使用
    const rawConstructors = new WeakMap();

    function defineElementInterface(Constructor, name) {
        if (!Object.prototype.hasOwnProperty.call(Constructor.prototype, Symbol.toStringTag)) {
            Object.defineProperty(Constructor.prototype, Symbol.toStringTag, { value: name, configurable: true });
        }
        const wrapper = function () {
            throw new TypeError('Illegal constructor');
        };
        Object.defineProperty(wrapper, 'name', { value: name, configurable: true });
        Object.defineProperty(wrapper, 'prototype', { value: Constructor.prototype });
        Object.defineProperty(Constructor.prototype, 'constructor',
            { value: wrapper, writable: true, configurable: true });
        rawConstructors.set(wrapper, Constructor);
        window[name] = wrapper;
        return wrapper;
    }

    // 取回被包装接口的真实构造函数（只供内部使用）
    function rawElementConstructor(interfaceObject) {
        return rawConstructors.get(interfaceObject) || interfaceObject;
    }

    function define(prototype) {
        for (const [key, spec] of Object.entries(reflected)) defineAccessor(prototype, key, spec.get, spec.set);
        for (const name of handlerNames) {
            const spec = handlerAccessor(name);
            defineAccessor(prototype, name, spec.get, spec.set);
        }
    }

    Object.defineProperty(window, '__htmlElementAttributes__', {
        value: Object.freeze({ define }), configurable: true
    });
    Object.defineProperty(window, '__elementInterfaces__', {
        value: Object.freeze({ define: defineElementInterface, raw: rawElementConstructor }), configurable: true
    });
})();
