/**
 * @env-module elements
 * @description HTML元素类型库 - 完整的HTML元素模拟（带监控）
 * @version 2.0.0
 * @compatibility Chrome 80+, Firefox 75+, Edge 79+
 */

(function() {
    'use strict';
    
    // ==================== 获取监控系统 ====================
    const Monitor = window.__EnvMonitor__ || {
        log: function() {},
        logCall: function() {},
        logCreate: function() {},
        hasMock: function() { return false; },
        executeMock: function() { return { mocked: false }; },
        pushChain: function() {},
        popChain: function() {}
    };
    
    // ==================== 获取基础类 ====================
    const Element = window.Element;
    const Node = window.Node;
    // document.js 的 HTMLElement 原型上定义了 style / dataset / offset* 访问器，本文件的 HTMLElement 会替换它，先取出来复用
    const baseHTMLPrototype = window.HTMLElement && window.HTMLElement.prototype;
    function copyAccessors(target, keys) {
        if (!baseHTMLPrototype) return;
        for (const key of keys) {
            const descriptor = Object.getOwnPropertyDescriptor(baseHTMLPrototype, key);
            if (descriptor) Object.defineProperty(target, key, descriptor);
        }
    }

    if (!Element) {
        console.error('[elements.js] Element class not found, please load document.js first');
        return;
    }
    
    // ==================== HTMLElement 基类 ====================
    function HTMLElement(tagName) {
        Element.call(this, tagName || 'div');
        // title、lang、hidden、onclick 等是原型访问器（htmlElementAttributes.js）
    }
    
    HTMLElement.prototype = Object.create(Element.prototype);
    HTMLElement.prototype.constructor = HTMLElement;
    window.__htmlElementAttributes__.define(HTMLElement.prototype);
    copyAccessors(HTMLElement.prototype, ['style', 'dataset', 'offsetParent', 'offsetTop', 'offsetLeft', 'offsetWidth', 'offsetHeight']);

    // HTMLElement 方法
    HTMLElement.prototype.click = function() {
        Monitor.logCall('HTMLElement.click', [], null, { elementId: window.__nodeIdOf__?.(this) });
        this.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
    };
    
    HTMLElement.prototype.focus = function() {
        Monitor.logCall('HTMLElement.focus', [], null, { elementId: window.__nodeIdOf__?.(this) });
        if (this.onfocus) this.onfocus(new Event('focus'));
    };
    
    HTMLElement.prototype.blur = function() {
        Monitor.logCall('HTMLElement.blur', [], null, { elementId: window.__nodeIdOf__?.(this) });
        if (this.onblur) this.onblur(new Event('blur'));
    };
    
    HTMLElement.prototype.attachInternals = function() {
        Monitor.logCall('HTMLElement.attachInternals', [], null, { elementId: window.__nodeIdOf__?.(this) });
        return {
            form: null,
            labels: [],
            validationMessage: '',
            validity: { valid: true },
            willValidate: false,
            setFormValue: function() {},
            setValidity: function() {},
            checkValidity: function() { return true; },
            reportValidity: function() { return true; }
        };
    };
    
    window.__elementInterfaces__.define(HTMLElement, "HTMLElement");
    
    // ==================== HTMLDivElement ====================
    function HTMLDivElement() {
        HTMLElement.call(this, 'div');
        this.align = '';
    }
    HTMLDivElement.prototype = Object.create(HTMLElement.prototype);
    HTMLDivElement.prototype.constructor = HTMLDivElement;
    window.__elementInterfaces__.define(HTMLDivElement, "HTMLDivElement");
    
    // ==================== HTMLSpanElement ====================
    function HTMLSpanElement() {
        HTMLElement.call(this, 'span');
    }
    HTMLSpanElement.prototype = Object.create(HTMLElement.prototype);
    HTMLSpanElement.prototype.constructor = HTMLSpanElement;
    window.__elementInterfaces__.define(HTMLSpanElement, "HTMLSpanElement");
    
    // ==================== HTMLParagraphElement ====================
    function HTMLParagraphElement() {
        HTMLElement.call(this, 'p');
        this.align = '';
    }
    HTMLParagraphElement.prototype = Object.create(HTMLElement.prototype);
    HTMLParagraphElement.prototype.constructor = HTMLParagraphElement;
    window.__elementInterfaces__.define(HTMLParagraphElement, "HTMLParagraphElement");
    
    // ==================== HTMLHeadingElement (h1-h6) ====================
    function HTMLHeadingElement(level) {
        HTMLElement.call(this, 'h' + (level || 1));
        this.align = '';
    }
    HTMLHeadingElement.prototype = Object.create(HTMLElement.prototype);
    HTMLHeadingElement.prototype.constructor = HTMLHeadingElement;
    window.__elementInterfaces__.define(HTMLHeadingElement, "HTMLHeadingElement");
    
    // ==================== HTMLAnchorElement ====================
    function HTMLAnchorElement() {
        HTMLElement.call(this, 'a');
        this.href = '';
        this.relList = new DOMTokenList(this, 'rel');
        this.text = '';
        this.origin = '';
        this.protocol = '';
        this.username = '';
        this.password = '';
        this.host = '';
        this.hostname = '';
        this.port = '';
        this.pathname = '';
        this.search = '';
        this.hash = '';
    }
    HTMLAnchorElement.prototype = Object.create(HTMLElement.prototype);
    HTMLAnchorElement.prototype.constructor = HTMLAnchorElement;
    HTMLAnchorElement.prototype.toString = function() { return this.href; };
    window.__elementInterfaces__.define(HTMLAnchorElement, "HTMLAnchorElement");
    
    // ==================== HTMLImageElement ====================
    function HTMLImageElement() {
        HTMLElement.call(this, 'img');
        this.src = '';
        this.width = 0;
        this.height = 0;
        this.naturalWidth = 0;
        this.naturalHeight = 0;
        this.complete = true;
        this.currentSrc = '';
        this.x = 0;
        this.y = 0;
    }
    HTMLImageElement.prototype = Object.create(HTMLElement.prototype);
    HTMLImageElement.prototype.constructor = HTMLImageElement;
    HTMLImageElement.prototype.decode = function() { 
        Monitor.logCall('HTMLImageElement.decode', [], 'Promise', { elementId: window.__nodeIdOf__?.(this) });
        return Promise.resolve(); 
    };
    window.__elementInterfaces__.define(HTMLImageElement, "HTMLImageElement");
    window.Image = function(width, height) {
        const img = new HTMLImageElement();
        liftOwnProperties(img);
        if (width !== undefined) img.width = width;
        if (height !== undefined) img.height = height;
        Monitor.logCreate('img', img, { width, height });
        return img;
    };
    
    // ==================== HTMLInputElement ====================
    function HTMLInputElement() {
        HTMLElement.call(this, 'input');
        this.checked = false;
        this.defaultChecked = false;
        this.defaultValue = '';
        this.dirName = '';
        this.files = null;
        this.form = null;
        this.formAction = '';
        this.formEnctype = '';
        this.formMethod = '';
        this.formNoValidate = false;
        this.formTarget = '';
        this.height = 0;
        this.indeterminate = false;
        this.labels = [];
        this.list = null;
        this.selectionDirection = null;
        this.selectionEnd = null;
        this.selectionStart = null;
        this.src = '';
        this.validationMessage = '';
        this.validity = {
            badInput: false,
            customError: false,
            patternMismatch: false,
            rangeOverflow: false,
            rangeUnderflow: false,
            stepMismatch: false,
            tooLong: false,
            tooShort: false,
            typeMismatch: false,
            valid: true,
            valueMissing: false
        };
        this.value = '';
        this.valueAsDate = null;
        this.valueAsNumber = NaN;
        this.width = 0;
        this.willValidate = true;
    }
    HTMLInputElement.prototype = Object.create(HTMLElement.prototype);
    HTMLInputElement.prototype.constructor = HTMLInputElement;
    HTMLInputElement.prototype.checkValidity = function() { return true; };
    HTMLInputElement.prototype.reportValidity = function() { return true; };
    HTMLInputElement.prototype.select = function() {
        Monitor.logCall('HTMLInputElement.select', [], null, { elementId: window.__nodeIdOf__?.(this) });
    };
    HTMLInputElement.prototype.setCustomValidity = function(message) {
        this.validationMessage = message;
        this.validity.customError = !!message;
        this.validity.valid = !message;
    };
    HTMLInputElement.prototype.setRangeText = function(replacement, start, end, selectMode) {
        Monitor.logCall('HTMLInputElement.setRangeText', [replacement, start, end, selectMode], null);
    };
    HTMLInputElement.prototype.setSelectionRange = function(start, end, direction) {
        this.selectionStart = start;
        this.selectionEnd = end;
        this.selectionDirection = direction || 'none';
    };
    HTMLInputElement.prototype.stepDown = function(n) { };
    HTMLInputElement.prototype.stepUp = function(n) { };
    HTMLInputElement.prototype.showPicker = function() { };
    window.__elementInterfaces__.define(HTMLInputElement, "HTMLInputElement");
    
    // ==================== HTMLButtonElement ====================
    function HTMLButtonElement() {
        HTMLElement.call(this, 'button');
        this.form = null;
        this.labels = [];
        this.validationMessage = '';
        this.validity = { valid: true };
        this.willValidate = true;
    }
    HTMLButtonElement.prototype = Object.create(HTMLElement.prototype);
    HTMLButtonElement.prototype.constructor = HTMLButtonElement;
    HTMLButtonElement.prototype.checkValidity = function() { return true; };
    HTMLButtonElement.prototype.reportValidity = function() { return true; };
    HTMLButtonElement.prototype.setCustomValidity = function(message) { };
    window.__elementInterfaces__.define(HTMLButtonElement, "HTMLButtonElement");
    
    // ==================== HTMLSelectElement ====================
    function HTMLSelectElement() {
        HTMLElement.call(this, 'select');
        this.form = null;
        this.labels = [];
        this.length = 0;
        this.options = [];
        this.selectedIndex = -1;
        this.selectedOptions = [];
        this.type = 'select-one';
        this.validationMessage = '';
        this.validity = { valid: true };
        this.value = '';
        this.willValidate = true;
    }
    HTMLSelectElement.prototype = Object.create(HTMLElement.prototype);
    HTMLSelectElement.prototype.constructor = HTMLSelectElement;
    HTMLSelectElement.prototype.add = function(option, before) {
        this.options.push(option);
        this.length = this.options.length;
    };
    HTMLSelectElement.prototype.remove = function(index) {
        this.options.splice(index, 1);
        this.length = this.options.length;
    };
    HTMLSelectElement.prototype.item = function(index) { return this.options[index] || null; };
    HTMLSelectElement.prototype.namedItem = function(name) { 
        return this.options.find(o => o.name === name || o.id === name) || null; 
    };
    HTMLSelectElement.prototype.checkValidity = function() { return true; };
    HTMLSelectElement.prototype.reportValidity = function() { return true; };
    HTMLSelectElement.prototype.setCustomValidity = function(message) { };
    window.__elementInterfaces__.define(HTMLSelectElement, "HTMLSelectElement");
    
    // ==================== HTMLOptionElement ====================
    function HTMLOptionElement() {
        HTMLElement.call(this, 'option');
        this.disabled = false;
        this.form = null;
        this.index = 0;
        this.selected = false;
        this.text = '';
    }
    HTMLOptionElement.prototype = Object.create(HTMLElement.prototype);
    HTMLOptionElement.prototype.constructor = HTMLOptionElement;
    window.__elementInterfaces__.define(HTMLOptionElement, "HTMLOptionElement");
    window.Option = function(text, value, defaultSelected, selected) {
        const option = new HTMLOptionElement();
        liftOwnProperties(option);
        if (text !== undefined) option.text = text;
        if (value !== undefined) option.value = value;
        if (defaultSelected !== undefined) option.defaultSelected = defaultSelected;
        if (selected !== undefined) option.selected = selected;
        return option;
    };
    
    // ==================== HTMLTextAreaElement ====================
    function HTMLTextAreaElement() {
        HTMLElement.call(this, 'textarea');
        this.defaultValue = '';
        this.dirName = '';
        this.form = null;
        this.labels = [];
        this.selectionDirection = 'none';
        this.selectionEnd = 0;
        this.selectionStart = 0;
        this.textLength = 0;
        this.type = 'textarea';
        this.validationMessage = '';
        this.validity = { valid: true };
        this.value = '';
        this.willValidate = true;
    }
    HTMLTextAreaElement.prototype = Object.create(HTMLElement.prototype);
    HTMLTextAreaElement.prototype.constructor = HTMLTextAreaElement;
    HTMLTextAreaElement.prototype.checkValidity = function() { return true; };
    HTMLTextAreaElement.prototype.reportValidity = function() { return true; };
    HTMLTextAreaElement.prototype.select = function() { };
    HTMLTextAreaElement.prototype.setCustomValidity = function(message) { };
    HTMLTextAreaElement.prototype.setRangeText = function() { };
    HTMLTextAreaElement.prototype.setSelectionRange = function(start, end, direction) {
        this.selectionStart = start;
        this.selectionEnd = end;
        this.selectionDirection = direction || 'none';
    };
    window.__elementInterfaces__.define(HTMLTextAreaElement, "HTMLTextAreaElement");
    
    // ==================== HTMLFormElement ====================
    function HTMLFormElement() {
        HTMLElement.call(this, 'form');
        this.acceptCharset = '';
        this.autocomplete = 'on';
        this.elements = [];
        this.encoding = '';
        this.length = 0;
        this.enctype = 'application/x-www-form-urlencoded';
    }
    HTMLFormElement.prototype = Object.create(HTMLElement.prototype);
    HTMLFormElement.prototype.constructor = HTMLFormElement;
    HTMLFormElement.prototype.checkValidity = function() { return true; };
    HTMLFormElement.prototype.reportValidity = function() { return true; };
    HTMLFormElement.prototype.reset = function() {
        Monitor.logCall('HTMLFormElement.reset', [], null, { elementId: window.__nodeIdOf__?.(this) });
        if (this.onreset) this.onreset(new Event('reset'));
    };
    HTMLFormElement.prototype.submit = function() {
        Monitor.logCall('HTMLFormElement.submit', [], null, { elementId: window.__nodeIdOf__?.(this) });
        if (this.onsubmit) this.onsubmit(new Event('submit'));
    };
    HTMLFormElement.prototype.requestSubmit = function(submitter) {
        Monitor.logCall('HTMLFormElement.requestSubmit', [submitter], null);
        if (this.onsubmit) this.onsubmit(new Event('submit'));
    };
    window.__elementInterfaces__.define(HTMLFormElement, "HTMLFormElement");
    
    // ==================== HTMLLabelElement ====================
    function HTMLLabelElement() {
        HTMLElement.call(this, 'label');
    }
    HTMLLabelElement.prototype = Object.create(HTMLElement.prototype);
    HTMLLabelElement.prototype.constructor = HTMLLabelElement;
    // htmlFor 是反射字符串属性（不是 token list），control / form 由 DOM 关系推导
    reflectString(HTMLLabelElement.prototype, 'htmlFor', 'for');
    Object.defineProperty(HTMLLabelElement.prototype, 'control', {
        get() {
            const id = this.getAttribute('for');
            if (!id) return null;
            const owner = this.ownerDocument || window.document;
            return owner.getElementById(id);
        },
        enumerable: true, configurable: true
    });
    Object.defineProperty(HTMLLabelElement.prototype, 'form', {
        get() { return typeof this.closest === 'function' ? this.closest('form') : null; },
        enumerable: true, configurable: true
    });
    window.__elementInterfaces__.define(HTMLLabelElement, "HTMLLabelElement");
    
    // ==================== HTMLScriptElement ====================
    function HTMLScriptElement() {
        HTMLElement.call(this, 'script');
        this.charset = '';
        this.event = '';
        this.text = '';
    }
    HTMLScriptElement.prototype = Object.create(HTMLElement.prototype);
    HTMLScriptElement.prototype.constructor = HTMLScriptElement;
    HTMLScriptElement.supports = function(type) {
        return type === 'classic' || type === 'module' || type === 'importmap';
    };
    window.__elementInterfaces__.define(HTMLScriptElement, "HTMLScriptElement");
    
    // ==================== HTMLStyleElement ====================
    function HTMLStyleElement() {
        HTMLElement.call(this, 'style');
        this.type = 'text/css';
        // disabled / media / sheet 由 cssom.js 提供（sheet 是只读访问器）
    }
    HTMLStyleElement.prototype = Object.create(HTMLElement.prototype);
    HTMLStyleElement.prototype.constructor = HTMLStyleElement;
    window.__elementInterfaces__.define(HTMLStyleElement, "HTMLStyleElement");
    
    // ==================== HTMLLinkElement ====================
    function HTMLLinkElement() {
        HTMLElement.call(this, 'link');
        this.href = '';
        this.relList = new DOMTokenList(this, 'rel');
        // sheet 由 cssom.js 提供（只读访问器）
    }
    HTMLLinkElement.prototype = Object.create(HTMLElement.prototype);
    HTMLLinkElement.prototype.constructor = HTMLLinkElement;
    window.__elementInterfaces__.define(HTMLLinkElement, "HTMLLinkElement");
    
    // ==================== HTMLMetaElement ====================
    function HTMLMetaElement() {
        HTMLElement.call(this, 'meta');
        this.scheme = '';
    }
    HTMLMetaElement.prototype = Object.create(HTMLElement.prototype);
    HTMLMetaElement.prototype.constructor = HTMLMetaElement;
    window.__elementInterfaces__.define(HTMLMetaElement, "HTMLMetaElement");
    
    // ==================== HTMLTitleElement ====================
    function HTMLTitleElement() {
        HTMLElement.call(this, 'title');
        this.text = '';
    }
    HTMLTitleElement.prototype = Object.create(HTMLElement.prototype);
    HTMLTitleElement.prototype.constructor = HTMLTitleElement;
    window.__elementInterfaces__.define(HTMLTitleElement, "HTMLTitleElement");
    
    // ==================== HTMLBaseElement ====================
    function HTMLBaseElement() {
        HTMLElement.call(this, 'base');
        this.href = '';
    }
    HTMLBaseElement.prototype = Object.create(HTMLElement.prototype);
    HTMLBaseElement.prototype.constructor = HTMLBaseElement;
    window.__elementInterfaces__.define(HTMLBaseElement, "HTMLBaseElement");
    
    // ==================== Canvas 对象类型 ====================
    const canvasIdl = window.__webidl__;

    canvasIdl.defineInterface('ImageData', {
        length: 1,
        construct(first, second, third) {
            let data;
            let width;
            let height;
            if (typeof first === 'number') {
                width = Math.trunc(first);
                height = second === undefined ? 0 : Math.trunc(second);
                if (width <= 0 || height <= 0) {
                    throw new DOMException("Failed to construct 'ImageData': The source width is zero or not a number.", 'IndexSizeError');
                }
                data = new Uint8ClampedArray(width * height * 4);
            } else if (first && first.buffer) {
                data = first;
                width = Math.trunc(second);
                height = Math.trunc(third);
                if (data.length !== width * height * 4) {
                    throw new DOMException("Failed to construct 'ImageData': The input data length is not equal to (4 * width * height).", 'IndexSizeError');
                }
            } else {
                throw new TypeError("Failed to construct 'ImageData': Overload resolution failed.");
            }
            Object.assign(canvasIdl.internal(this), { data, width, height, colorSpace: 'srgb' });
        },
        attributes: {
            data() { return canvasIdl.internal(this).data; },
            width() { return canvasIdl.internal(this).width; },
            height() { return canvasIdl.internal(this).height; },
            colorSpace() { return canvasIdl.internal(this).colorSpace; }
        }
    });

    canvasIdl.defineInterface('CanvasGradient', {
        methods: {
            addColorStop(offset, color) {
                const value = Number(offset);
                if (!(value >= 0 && value <= 1)) {
                    throw new DOMException("Failed to execute 'addColorStop' on 'CanvasGradient': The provided value is outside the range [0, 1].", 'IndexSizeError');
                }
                canvasIdl.internal(this).stops.push([value, String(color)]);
            }
        }
    });

    canvasIdl.defineInterface('CanvasPattern', {
        methods: { setTransform(transform = {}) {} }
    });

    const textMetricKeys = ['width', 'actualBoundingBoxLeft', 'actualBoundingBoxRight',
        'actualBoundingBoxAscent', 'actualBoundingBoxDescent', 'fontBoundingBoxAscent',
        'fontBoundingBoxDescent', 'emHeightAscent', 'emHeightDescent',
        'hangingBaseline', 'alphabeticBaseline', 'ideographicBaseline'];
    const textMetricsAttributes = {};
    for (const key of textMetricKeys) {
        textMetricsAttributes[key] = function() { return canvasIdl.internal(this)[key]; };
    }
    canvasIdl.defineInterface('TextMetrics', { attributes: textMetricsAttributes });

    function imageDataOf(data, width, height) {
        return canvasIdl.create('ImageData', { data, width, height, colorSpace: 'srgb' });
    }

    function textMetricsOf(width) {
        return canvasIdl.create('TextMetrics', {
            width, actualBoundingBoxAscent: 10, actualBoundingBoxDescent: 2,
            actualBoundingBoxLeft: 0, actualBoundingBoxRight: width,
            fontBoundingBoxAscent: 12, fontBoundingBoxDescent: 3,
            emHeightAscent: 10, emHeightDescent: 2,
            hangingBaseline: 10, alphabeticBaseline: 0, ideographicBaseline: -2
        });
    }

    function canvasGradient() { return canvasIdl.create('CanvasGradient', { stops: [] }); }
    function canvasPattern() { return canvasIdl.create('CanvasPattern', {}); }

    // ==================== HTMLCanvasElement ====================
    // 上下文对象存放在 WeakMap 中，不在实例上留下 _context2d 等字段；一个 canvas 只允许一种上下文
    const canvasContexts = new WeakMap();
    function contextsOf(canvas) {
        if (!(canvas instanceof HTMLCanvasElement)) throw new TypeError('Illegal invocation');
        let contexts = canvasContexts.get(canvas);
        if (!contexts) {
            contexts = { kind: null, context: null };
            canvasContexts.set(canvas, contexts);
        }
        return contexts;
    }

    function HTMLCanvasElement() {
        HTMLElement.call(this, 'canvas');
    }
    HTMLCanvasElement.prototype = Object.create(HTMLElement.prototype);
    HTMLCanvasElement.prototype.constructor = HTMLCanvasElement;

    // width / height 反射同名属性，缺省或非法时为 300 / 150
    function canvasDimension(name, fallback) {
        const holder = {
            get [name]() {
                contextsOf(this);
                const value = parseInt(this.getAttribute(name) ?? '', 10);
                return Number.isNaN(value) || value < 0 ? fallback : value;
            },
            set [name](value) {
                contextsOf(this);
                const number = Math.trunc(Number(value));
                this.setAttribute(name, String(Number.isFinite(number) && number >= 0 ? number : fallback));
            }
        };
        const descriptor = Object.getOwnPropertyDescriptor(holder, name);
        Object.defineProperty(HTMLCanvasElement.prototype, name, {
            get: window.safefunction(descriptor.get, 'get ' + name),
            set: window.safefunction(descriptor.set, 'set ' + name),
            enumerable: true, configurable: true
        });
    }
    canvasDimension('width', 300);
    canvasDimension('height', 150);

    const canvasMethods = {
        getContext(contextId, options) {
            const contexts = contextsOf(this);
            if (arguments.length < 1) {
                throw new TypeError("Failed to execute 'getContext' on 'HTMLCanvasElement': 1 argument required, but only 0 present.");
            }
            Monitor.logCall('HTMLCanvasElement.getContext', [contextId, options], '[Context]', { elementId: window.__nodeIdOf__?.(this) });
            const mock = Monitor.executeMock('HTMLCanvasElement.getContext', [contextId, options], this);
            if (mock.mocked) return mock.result;
            const id = String(contextId);
            // webgl / experimental-webgl 是同一上下文；canvas 一旦有某类上下文，再取其它类型返回 null
            const kind = id === 'experimental-webgl' ? 'webgl' : id;
            if (contexts.kind && contexts.kind !== kind) return null;
            if (contexts.context) return contexts.context;
            let context = null;
            if (kind === '2d') context = new CanvasRenderingContext2D(this, contextToken);
            else if (kind === 'webgl' || kind === 'webgl2') {
                context = window.__webglInternals__.createContext(this, kind, options);
            }
            if (!context) return null;
            contexts.kind = kind;
            contexts.context = context;
            return context;
        },
        toDataURL(type, quality) {
            contextsOf(this);
            Monitor.logCall('HTMLCanvasElement.toDataURL', [type, quality], 'data:image/png;base64,...');
            const mock = Monitor.executeMock('HTMLCanvasElement.toDataURL', [type, quality], this);
            if (mock.mocked) return mock.result;
            const canvasProfile = window.__profile__ && window.__profile__.canvas;
            if (canvasProfile && canvasProfile.toDataURL) return canvasProfile.toDataURL;
            return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
        },
        toBlob(callback, type, quality) {
            contextsOf(this);
            if (typeof callback !== 'function') {
                throw new TypeError("Failed to execute 'toBlob' on 'HTMLCanvasElement': parameter 1 is not of type 'Function'.");
            }
            Monitor.logCall('HTMLCanvasElement.toBlob', [callback, type, quality], null);
            const mock = Monitor.executeMock('HTMLCanvasElement.toBlob', [callback, type, quality], this);
            if (mock.mocked) { callback(mock.result); return; }
            callback(new Blob([''], { type: type || 'image/png' }));
        },
        captureStream(frameRate) {
            contextsOf(this);
            Monitor.logCall('HTMLCanvasElement.captureStream', [frameRate], '[MediaStream]');
            return {};
        },
        transferControlToOffscreen() {
            contextsOf(this);
            Monitor.logCall('HTMLCanvasElement.transferControlToOffscreen', [], '[OffscreenCanvas]');
            return {};
        }
    };
    const canvasMethodLengths = { getContext: 1, toDataURL: 0, toBlob: 1, captureStream: 0, transferControlToOffscreen: 0 };
    for (const [key, method] of Object.entries(canvasMethods)) {
        Object.defineProperty(method, 'length', { value: canvasMethodLengths[key] });
        Object.defineProperty(HTMLCanvasElement.prototype, key, {
            value: window.safefunction(method, key), writable: true, enumerable: true, configurable: true
        });
    }
    
    window.__elementInterfaces__.define(HTMLCanvasElement, "HTMLCanvasElement");
    
    // 上下文只能由 getContext 创建：脚本直接 new 时缺少内部令牌，抛 Illegal constructor
    const contextToken = {};
    function checkContextToken(token) {
        if (token !== contextToken) throw new TypeError('Illegal constructor');
    }

    // ==================== CanvasRenderingContext2D ====================
    function CanvasRenderingContext2D(canvas, token) {
        checkContextToken(token);
        this.canvas = canvas;

        // 状态
        this.fillStyle = '#000000';
        this.strokeStyle = '#000000';
        this.lineWidth = 1;
        this.lineCap = 'butt';
        this.lineJoin = 'miter';
        this.miterLimit = 10;
        this.lineDashOffset = 0;
        this.font = '10px sans-serif';
        this.textAlign = 'start';
        this.textBaseline = 'alphabetic';
        this.direction = 'ltr';
        this.globalAlpha = 1;
        this.globalCompositeOperation = 'source-over';
        this.imageSmoothingEnabled = true;
        this.imageSmoothingQuality = 'low';
        this.shadowBlur = 0;
        this.shadowColor = 'rgba(0, 0, 0, 0)';
        this.shadowOffsetX = 0;
        this.shadowOffsetY = 0;
        this.filter = 'none';

        // 状态栈
        this._stateStack = [];

        // 直接在实例上定义关键指纹方法
        var self = this;

        this.getImageData = function(sx, sy, sw, sh) {
            Monitor.logCall('CanvasRenderingContext2D.getImageData', [sx, sy, sw, sh], null, { canvasId: window.__nodeIdOf__?.(canvas) });
            var mock = Monitor.executeMock('CanvasRenderingContext2D.getImageData', [sx, sy, sw, sh], self);
            if (mock.mocked) return mock.result;
            var width = sw || 1;
            var height = sh || 1;
            var data = new Uint8ClampedArray(width * height * 4);
            var canvasProfile = window.__profile__ && window.__profile__.canvas;
            if (canvasProfile && canvasProfile.fingerprint && canvasProfile.fingerprint.seed) {
                var s = canvasProfile.fingerprint.seed;
                for (var i = 0; i < data.length; i++) {
                    s = Math.imul(s, 1664525) + 1013904223 | 0;
                    data[i] = (s >>> 24) & 0xFF;
                }
            }
            return imageDataOf(data, width, height);
        };

        this.measureText = function(text) {
            Monitor.logCall('CanvasRenderingContext2D.measureText', [text], null, { canvasId: window.__nodeIdOf__?.(canvas) });
            var mock = Monitor.executeMock('CanvasRenderingContext2D.measureText', [text], self);
            if (mock.mocked) return mock.result;
            var w = (text ? text.length : 0) * 8;
            return textMetricsOf(w);
        };

        this.createImageData = function(widthOrData, height) {
            var w = typeof widthOrData === 'number' ? widthOrData : (widthOrData ? widthOrData.width : 1);
            var h = typeof height === 'number' ? height : (widthOrData ? widthOrData.height : 1);
            return imageDataOf(new Uint8ClampedArray(w * h * 4), w, h);
        };

        this.isPointInPath = function() { return false; };
        this.isPointInStroke = function() { return false; };
        this.isContextLost = function() { return false; };
        this.getLineDash = function() { return []; };
        this.getTransform = function() { return new DOMMatrix(); };
        this.getContextAttributes = function() {
            return { alpha: true, colorSpace: 'srgb', desynchronized: false, willReadFrequently: false };
        };

        // 实例不留自有属性（与浏览器一致）
        window.__elementProps__?.lift(this);
    }
    
    // Canvas 2D 方法
    const context2dMethods = [
        'arc', 'arcTo', 'beginPath', 'bezierCurveTo', 'clearRect', 'clip',
        'closePath', 'createConicGradient', 'createImageData', 'createLinearGradient',
        'createPattern', 'createRadialGradient', 'drawFocusIfNeeded', 'drawImage',
        'ellipse', 'fill', 'fillRect', 'fillText', 'getContextAttributes',
        'getImageData', 'getLineDash', 'getTransform', 'isContextLost', 'isPointInPath',
        'isPointInStroke', 'lineTo', 'measureText', 'moveTo', 'putImageData',
        'quadraticCurveTo', 'rect', 'reset', 'resetTransform', 'restore',
        'rotate', 'roundRect', 'save', 'scale', 'scrollPathIntoView', 'setLineDash',
        'setTransform', 'stroke', 'strokeRect', 'strokeText', 'transform', 'translate'
    ];
    
    context2dMethods.forEach(method => {
        CanvasRenderingContext2D.prototype[method] = function(...args) {
            Monitor.logCall(`CanvasRenderingContext2D.${method}`, args, null, {
                canvasId: window.__nodeIdOf__?.(this.canvas)
            });
            
            const mock = Monitor.executeMock(`CanvasRenderingContext2D.${method}`, args, this);
            if (mock.mocked) return mock.result;
            
            // 特殊处理某些方法
            if (method === 'measureText') {
                return textMetricsOf(args[0]?.length * 8 || 0);
            }
            if (method === 'getImageData') {
                const width = args[2] || 1;
                const height = args[3] || 1;
                const data = new Uint8ClampedArray(width * height * 4);
                var canvasProfile = window.__profile__ && window.__profile__.canvas;
                if (canvasProfile && canvasProfile.fingerprint && canvasProfile.fingerprint.seed) {
                    var s = canvasProfile.fingerprint.seed;
                    for (var i = 0; i < data.length; i++) {
                        s = (s * 1664525 + 1013904223) & 0xFFFFFFFF;
                        data[i] = (s >>> 24) & 0xFF;
                    }
                }
                return imageDataOf(data, width, height);
            }
            if (method === 'createImageData') {
                const width = typeof args[0] === 'number' ? args[0] : args[0]?.width || 1;
                const height = typeof args[1] === 'number' ? args[1] : args[0]?.height || 1;
                return imageDataOf(new Uint8ClampedArray(width * height * 4), width, height);
            }
            if (method === 'createLinearGradient' || method === 'createRadialGradient' || method === 'createConicGradient') {
                return canvasGradient();
            }
            if (method === 'createPattern') {
                return canvasPattern();
            }
            if (method === 'save') {
                this._stateStack.push({});
                return;
            }
            if (method === 'restore') {
                this._stateStack.pop();
                return;
            }
            if (method === 'getLineDash') {
                return [];
            }
            if (method === 'getTransform') {
                return new DOMMatrix();
            }
            if (method === 'isPointInPath' || method === 'isPointInStroke') {
                return false;
            }
            if (method === 'getContextAttributes') {
                return {
                    alpha: true,
                    colorSpace: 'srgb',
                    desynchronized: false,
                    willReadFrequently: false
                };
            }
            if (method === 'isContextLost') {
                return false;
            }
            
            return undefined;
        };
    });
    
    window.CanvasRenderingContext2D = CanvasRenderingContext2D;
    
    // CanvasRenderingContext2D 的 toStringTag（WebGL 上下文由 webgl.js 定义）
    Object.defineProperty(CanvasRenderingContext2D.prototype, Symbol.toStringTag,
        { value: 'CanvasRenderingContext2D', configurable: true });

    // ==================== HTMLVideoElement ====================
    function HTMLVideoElement() {
        HTMLElement.call(this, 'video');
        this.buffered = { length: 0, start: function() { return 0; }, end: function() { return 0; } };
        this.currentSrc = '';
        this.currentTime = 0;
        this.defaultMuted = false;
        this.defaultPlaybackRate = 1;
        this.disableRemotePlayback = false;
        this.duration = NaN;
        this.ended = false;
        this.error = null;
        this.mediaKeys = null;
        this.networkState = 0;
        this.paused = true;
        this.playbackRate = 1;
        this.played = { length: 0, start: function() { return 0; }, end: function() { return 0; } };
        this.preservesPitch = true;
        this.readyState = 0;
        this.remote = {};
        this.seekable = { length: 0, start: function() { return 0; }, end: function() { return 0; } };
        this.seeking = false;
        this.sinkId = '';
        this.src = '';
        this.srcObject = null;
        this.textTracks = [];
        this.volume = 1;
        this.videoHeight = 0;
        this.videoWidth = 0;
        this.disablePictureInPicture = false;
        // 媒体属性
        // 视频特有属性
    }
    HTMLVideoElement.prototype = Object.create(HTMLElement.prototype);
    HTMLVideoElement.prototype.constructor = HTMLVideoElement;
    
    // 媒体方法
    HTMLVideoElement.prototype.play = function() {
        Monitor.logCall('HTMLVideoElement.play', [], 'Promise');
        this.paused = false;
        return Promise.resolve();
    };
    HTMLVideoElement.prototype.pause = function() {
        Monitor.logCall('HTMLVideoElement.pause', [], null);
        this.paused = true;
    };
    HTMLVideoElement.prototype.load = function() {
        Monitor.logCall('HTMLVideoElement.load', [], null);
    };
    HTMLVideoElement.prototype.canPlayType = function(type) {
        Monitor.logCall('HTMLVideoElement.canPlayType', [type], 'maybe');
        return 'maybe';
    };
    HTMLVideoElement.prototype.addTextTrack = function(kind, label, language) {
        Monitor.logCall('HTMLVideoElement.addTextTrack', [kind, label, language], null);
        return {};
    };
    HTMLVideoElement.prototype.captureStream = function() {
        Monitor.logCall('HTMLVideoElement.captureStream', [], '[MediaStream]');
        return {};
    };
    HTMLVideoElement.prototype.getVideoPlaybackQuality = function() {
        Monitor.logCall('HTMLVideoElement.getVideoPlaybackQuality', [], '[Object]');
        return {
            creationTime: performance.now(),
            droppedVideoFrames: 0,
            totalVideoFrames: 0,
            corruptedVideoFrames: 0
        };
    };
    HTMLVideoElement.prototype.requestPictureInPicture = function() {
        Monitor.logCall('HTMLVideoElement.requestPictureInPicture', [], 'Promise');
        return Promise.resolve({});
    };
    HTMLVideoElement.prototype.setSinkId = function(sinkId) {
        Monitor.logCall('HTMLVideoElement.setSinkId', [sinkId], 'Promise');
        return Promise.resolve();
    };
    HTMLVideoElement.prototype.setMediaKeys = function(mediaKeys) {
        Monitor.logCall('HTMLVideoElement.setMediaKeys', [mediaKeys], 'Promise');
        return Promise.resolve();
    };
    window.__elementInterfaces__.define(HTMLVideoElement, "HTMLVideoElement");
    
    // ==================== HTMLAudioElement ====================
    function HTMLAudioElement() {
        HTMLElement.call(this, 'audio');
        this.currentSrc = '';
        this.currentTime = 0;
        this.duration = NaN;
        this.ended = false;
        this.paused = true;
        this.playbackRate = 1;
        this.src = '';
        this.volume = 1;
        // 继承媒体属性（简化版）
    }
    HTMLAudioElement.prototype = Object.create(HTMLElement.prototype);
    HTMLAudioElement.prototype.constructor = HTMLAudioElement;
    HTMLAudioElement.prototype.play = function() { 
        this.paused = false;
        return Promise.resolve(); 
    };
    HTMLAudioElement.prototype.pause = function() { this.paused = true; };
    HTMLAudioElement.prototype.load = function() {};
    HTMLAudioElement.prototype.canPlayType = function(type) { return 'maybe'; };
    window.__elementInterfaces__.define(HTMLAudioElement, "HTMLAudioElement");
    window.Audio = function(src) {
        const audio = new HTMLAudioElement();
        liftOwnProperties(audio);
        if (src) audio.src = src;
        return audio;
    };
    
    // ==================== HTMLIFrameElement ====================
    function HTMLIFrameElement() {
        HTMLElement.call(this, 'iframe');
        this.allowFullscreen = false;
        this.contentDocument = null;
        this.contentWindow = null;
        this.csp = '';
        this.featurePolicy = {};
        this.sandbox = new DOMTokenList(this, 'sandbox');
    }
    HTMLIFrameElement.prototype = Object.create(HTMLElement.prototype);
    HTMLIFrameElement.prototype.constructor = HTMLIFrameElement;
    HTMLIFrameElement.prototype.getSVGDocument = function() { return null; };
    window.__elementInterfaces__.define(HTMLIFrameElement, "HTMLIFrameElement");
    
    // ==================== HTMLTableElement ====================
    function HTMLTableElement() {
        HTMLElement.call(this, 'table');
        this.caption = null;
        this.tHead = null;
        this.tFoot = null;
        this.tBodies = [];
        this.rows = [];
        this.align = '';
        this.bgColor = '';
        this.cellPadding = '';
        this.cellSpacing = '';
        this.frame = '';
        this.rules = '';
        this.summary = '';
        this.width = '';
    }
    HTMLTableElement.prototype = Object.create(HTMLElement.prototype);
    HTMLTableElement.prototype.constructor = HTMLTableElement;
    HTMLTableElement.prototype.createCaption = function() { return new HTMLElement('caption'); };
    HTMLTableElement.prototype.deleteCaption = function() { this.caption = null; };
    HTMLTableElement.prototype.createTHead = function() { return new HTMLElement('thead'); };
    HTMLTableElement.prototype.deleteTHead = function() { this.tHead = null; };
    HTMLTableElement.prototype.createTFoot = function() { return new HTMLElement('tfoot'); };
    HTMLTableElement.prototype.deleteTFoot = function() { this.tFoot = null; };
    HTMLTableElement.prototype.createTBody = function() { return new HTMLElement('tbody'); };
    HTMLTableElement.prototype.insertRow = function(index) { return new HTMLTableRowElement(); };
    HTMLTableElement.prototype.deleteRow = function(index) { };
    window.__elementInterfaces__.define(HTMLTableElement, "HTMLTableElement");
    
    // ==================== HTMLTableRowElement ====================
    function HTMLTableRowElement() {
        HTMLElement.call(this, 'tr');
        this.cells = [];
        this.rowIndex = -1;
        this.sectionRowIndex = -1;
        this.align = '';
        this.bgColor = '';
        this.ch = '';
        this.chOff = '';
        this.vAlign = '';
    }
    HTMLTableRowElement.prototype = Object.create(HTMLElement.prototype);
    HTMLTableRowElement.prototype.constructor = HTMLTableRowElement;
    HTMLTableRowElement.prototype.insertCell = function(index) { return new HTMLTableCellElement(); };
    HTMLTableRowElement.prototype.deleteCell = function(index) { };
    window.__elementInterfaces__.define(HTMLTableRowElement, "HTMLTableRowElement");
    
    // ==================== HTMLTableCellElement ====================
    function HTMLTableCellElement() {
        HTMLElement.call(this, 'td');
        this.cellIndex = -1;
        this.headers = '';
        this.scope = '';
        this.abbr = '';
        this.align = '';
        this.axis = '';
        this.bgColor = '';
        this.ch = '';
        this.chOff = '';
        this.height = '';
        this.noWrap = false;
        this.vAlign = '';
        this.width = '';
    }
    HTMLTableCellElement.prototype = Object.create(HTMLElement.prototype);
    HTMLTableCellElement.prototype.constructor = HTMLTableCellElement;
    window.__elementInterfaces__.define(HTMLTableCellElement, "HTMLTableCellElement");
    
    // ==================== HTMLUListElement / HTMLOListElement / HTMLLIElement ====================
    function HTMLUListElement() {
        HTMLElement.call(this, 'ul');
        this.compact = false;
    }
    HTMLUListElement.prototype = Object.create(HTMLElement.prototype);
    HTMLUListElement.prototype.constructor = HTMLUListElement;
    window.__elementInterfaces__.define(HTMLUListElement, "HTMLUListElement");
    
    function HTMLOListElement() {
        HTMLElement.call(this, 'ol');
        this.compact = false;
        this.reversed = false;
        this.start = 1;
    }
    HTMLOListElement.prototype = Object.create(HTMLElement.prototype);
    HTMLOListElement.prototype.constructor = HTMLOListElement;
    window.__elementInterfaces__.define(HTMLOListElement, "HTMLOListElement");
    
    function HTMLLIElement() {
        HTMLElement.call(this, 'li');
    }
    HTMLLIElement.prototype = Object.create(HTMLElement.prototype);
    HTMLLIElement.prototype.constructor = HTMLLIElement;
    window.__elementInterfaces__.define(HTMLLIElement, "HTMLLIElement");
    
    // ==================== HTMLPreElement ====================
    function HTMLPreElement() {
        HTMLElement.call(this, 'pre');
    }
    HTMLPreElement.prototype = Object.create(HTMLElement.prototype);
    HTMLPreElement.prototype.constructor = HTMLPreElement;
    window.__elementInterfaces__.define(HTMLPreElement, "HTMLPreElement");
    
    // ==================== HTMLBRElement ====================
    function HTMLBRElement() {
        HTMLElement.call(this, 'br');
        this.clear = '';
    }
    HTMLBRElement.prototype = Object.create(HTMLElement.prototype);
    HTMLBRElement.prototype.constructor = HTMLBRElement;
    window.__elementInterfaces__.define(HTMLBRElement, "HTMLBRElement");

    // ==================== HTMLUnknownElement ====================
    // 未定义且不是合法自定义元素名的标签用 HTMLUnknownElement（合法自定义元素名仍是 HTMLElement）
    function HTMLUnknownElement(tagName) {
        HTMLElement.call(this, tagName || 'div');
    }
    HTMLUnknownElement.prototype = Object.create(HTMLElement.prototype);
    HTMLUnknownElement.prototype.constructor = HTMLUnknownElement;
    Object.defineProperty(HTMLUnknownElement.prototype, Symbol.toStringTag,
        { value: 'HTMLUnknownElement', configurable: true });
    window.__elementInterfaces__.define(HTMLUnknownElement, "HTMLUnknownElement");

    const customElementName = /^[a-z][a-z0-9._]*-[a-z0-9._-]*$/;
    window.__unknownElementFactory__ = function (tagName) {
        return customElementName.test(String(tagName))
            ? new HTMLElement(String(tagName)) : new HTMLUnknownElement(String(tagName));
    };

    // ==================== 其余元素接口 ====================
    // 反射字符串属性（浏览器里这些属性同样在原型上，读写反射到 HTML 属性）
    function reflectString(prototype, key, attribute) {
        Object.defineProperty(prototype, key, {
            get() { return this.getAttribute(attribute) ?? ''; },
            set(value) { this.setAttribute(attribute, String(value)); },
            enumerable: true, configurable: true
        });
    }

    function HTMLQuoteElement(tagName) {
        HTMLElement.call(this, tagName || 'q');
    }
    HTMLQuoteElement.prototype = Object.create(HTMLElement.prototype);
    HTMLQuoteElement.prototype.constructor = HTMLQuoteElement;
    reflectString(HTMLQuoteElement.prototype, 'cite', 'cite');
    window.__elementInterfaces__.define(HTMLQuoteElement, 'HTMLQuoteElement');

    function HTMLModElement(tagName) {
        HTMLElement.call(this, tagName || 'ins');
    }
    HTMLModElement.prototype = Object.create(HTMLElement.prototype);
    HTMLModElement.prototype.constructor = HTMLModElement;
    reflectString(HTMLModElement.prototype, 'cite', 'cite');
    reflectString(HTMLModElement.prototype, 'dateTime', 'datetime');
    window.__elementInterfaces__.define(HTMLModElement, 'HTMLModElement');

    function HTMLTableColElement(tagName) {
        HTMLElement.call(this, tagName || 'col');
    }
    HTMLTableColElement.prototype = Object.create(HTMLElement.prototype);
    HTMLTableColElement.prototype.constructor = HTMLTableColElement;
    Object.defineProperty(HTMLTableColElement.prototype, 'span', {
        get() {
            const value = parseInt(this.getAttribute('span') ?? '', 10);
            return Number.isNaN(value) || value < 1 ? 1 : Math.min(value, 1000);
        },
        set(value) {
            const span = Math.trunc(Number(value));
            this.setAttribute('span', String(Number.isFinite(span) && span >= 1 ? Math.min(span, 1000) : 1));
        },
        enumerable: true, configurable: true
    });
    window.__elementInterfaces__.define(HTMLTableColElement, 'HTMLTableColElement');

    function HTMLParamElement() {
        HTMLElement.call(this, 'param');
    }
    HTMLParamElement.prototype = Object.create(HTMLElement.prototype);
    HTMLParamElement.prototype.constructor = HTMLParamElement;
    for (const key of ['name', 'value', 'type', 'valueType']) reflectString(HTMLParamElement.prototype, key, key.toLowerCase());
    window.__elementInterfaces__.define(HTMLParamElement, 'HTMLParamElement');
    
    // ==================== HTMLHRElement ====================
    function HTMLHRElement() {
        HTMLElement.call(this, 'hr');
        this.align = '';
        this.color = '';
        this.noShade = false;
    }
    HTMLHRElement.prototype = Object.create(HTMLElement.prototype);
    HTMLHRElement.prototype.constructor = HTMLHRElement;
    window.__elementInterfaces__.define(HTMLHRElement, "HTMLHRElement");
    
    // ==================== HTMLProgressElement ====================
    function HTMLProgressElement() {
        HTMLElement.call(this, 'progress');
        this.labels = [];
        this.position = -1;
    }
    HTMLProgressElement.prototype = Object.create(HTMLElement.prototype);
    HTMLProgressElement.prototype.constructor = HTMLProgressElement;
    window.__elementInterfaces__.define(HTMLProgressElement, "HTMLProgressElement");
    
    // ==================== HTMLMeterElement ====================
    function HTMLMeterElement() {
        HTMLElement.call(this, 'meter');
        this.high = 0;
        this.labels = [];
        this.low = 0;
        this.optimum = 0;
    }
    HTMLMeterElement.prototype = Object.create(HTMLElement.prototype);
    HTMLMeterElement.prototype.constructor = HTMLMeterElement;
    window.__elementInterfaces__.define(HTMLMeterElement, "HTMLMeterElement");
    
    // ==================== HTMLDetailsElement ====================
    function HTMLDetailsElement() {
        HTMLElement.call(this, 'details');
    }
    HTMLDetailsElement.prototype = Object.create(HTMLElement.prototype);
    HTMLDetailsElement.prototype.constructor = HTMLDetailsElement;
    window.__elementInterfaces__.define(HTMLDetailsElement, "HTMLDetailsElement");
    
    // ==================== HTMLDialogElement ====================
    function HTMLDialogElement() {
        HTMLElement.call(this, 'dialog');
        this.returnValue = '';
    }
    HTMLDialogElement.prototype = Object.create(HTMLElement.prototype);
    HTMLDialogElement.prototype.constructor = HTMLDialogElement;
    HTMLDialogElement.prototype.show = function() { 
        Monitor.logCall('HTMLDialogElement.show', [], null);
        this.open = true; 
    };
    HTMLDialogElement.prototype.showModal = function() { 
        Monitor.logCall('HTMLDialogElement.showModal', [], null);
        this.open = true; 
    };
    HTMLDialogElement.prototype.close = function(returnValue) { 
        Monitor.logCall('HTMLDialogElement.close', [returnValue], null);
        if (returnValue !== undefined) this.returnValue = returnValue;
        this.open = false; 
    };
    window.__elementInterfaces__.define(HTMLDialogElement, "HTMLDialogElement");
    
    // ==================== HTMLTemplateElement ====================
    function HTMLTemplateElement() {
        HTMLElement.call(this, 'template');
        this.content = document.createDocumentFragment();
    }
    HTMLTemplateElement.prototype = Object.create(HTMLElement.prototype);
    HTMLTemplateElement.prototype.constructor = HTMLTemplateElement;
    window.__elementInterfaces__.define(HTMLTemplateElement, "HTMLTemplateElement");
    
    // ==================== HTMLSlotElement ====================
    function HTMLSlotElement() {
        HTMLElement.call(this, 'slot');
    }
    HTMLSlotElement.prototype = Object.create(HTMLElement.prototype);
    HTMLSlotElement.prototype.constructor = HTMLSlotElement;
    HTMLSlotElement.prototype.assignedNodes = function(options) { return []; };
    HTMLSlotElement.prototype.assignedElements = function(options) { return []; };
    HTMLSlotElement.prototype.assign = function(...nodes) { };
    window.__elementInterfaces__.define(HTMLSlotElement, "HTMLSlotElement");
    
    // ==================== HTMLDataElement ====================
    function HTMLDataElement() {
        HTMLElement.call(this, 'data');
    }
    HTMLDataElement.prototype = Object.create(HTMLElement.prototype);
    HTMLDataElement.prototype.constructor = HTMLDataElement;
    window.__elementInterfaces__.define(HTMLDataElement, "HTMLDataElement");
    
    // ==================== HTMLTimeElement ====================
    function HTMLTimeElement() {
        HTMLElement.call(this, 'time');
    }
    HTMLTimeElement.prototype = Object.create(HTMLElement.prototype);
    HTMLTimeElement.prototype.constructor = HTMLTimeElement;
    window.__elementInterfaces__.define(HTMLTimeElement, "HTMLTimeElement");
    
    // ==================== HTMLOutputElement ====================
    function HTMLOutputElement() {
        HTMLElement.call(this, 'output');
        this.defaultValue = '';
        this.form = null;
        this.htmlFor = new DOMTokenList(this, 'for');
        this.labels = [];
        this.type = 'output';
        this.validationMessage = '';
        this.validity = { valid: true };
        this.value = '';
        this.willValidate = false;
    }
    HTMLOutputElement.prototype = Object.create(HTMLElement.prototype);
    HTMLOutputElement.prototype.constructor = HTMLOutputElement;
    HTMLOutputElement.prototype.checkValidity = function() { return true; };
    HTMLOutputElement.prototype.reportValidity = function() { return true; };
    HTMLOutputElement.prototype.setCustomValidity = function() { };
    window.__elementInterfaces__.define(HTMLOutputElement, "HTMLOutputElement");
    
    // ==================== HTMLFieldSetElement ====================
    function HTMLFieldSetElement() {
        HTMLElement.call(this, 'fieldset');
        this.disabled = false;
        this.elements = [];
        this.form = null;
        this.type = 'fieldset';
        this.validationMessage = '';
        this.validity = { valid: true };
        this.willValidate = false;
    }
    HTMLFieldSetElement.prototype = Object.create(HTMLElement.prototype);
    HTMLFieldSetElement.prototype.constructor = HTMLFieldSetElement;
    HTMLFieldSetElement.prototype.checkValidity = function() { return true; };
    HTMLFieldSetElement.prototype.reportValidity = function() { return true; };
    HTMLFieldSetElement.prototype.setCustomValidity = function() { };
    window.__elementInterfaces__.define(HTMLFieldSetElement, "HTMLFieldSetElement");
    
    // ==================== HTMLLegendElement ====================
    function HTMLLegendElement() {
        HTMLElement.call(this, 'legend');
        this.align = '';
        this.form = null;
    }
    HTMLLegendElement.prototype = Object.create(HTMLElement.prototype);
    HTMLLegendElement.prototype.constructor = HTMLLegendElement;
    window.__elementInterfaces__.define(HTMLLegendElement, "HTMLLegendElement");
    
    // ==================== HTMLDataListElement ====================
    function HTMLDataListElement() {
        HTMLElement.call(this, 'datalist');
        this.options = [];
    }
    HTMLDataListElement.prototype = Object.create(HTMLElement.prototype);
    HTMLDataListElement.prototype.constructor = HTMLDataListElement;
    window.__elementInterfaces__.define(HTMLDataListElement, "HTMLDataListElement");
    
    // ==================== HTMLOptGroupElement ====================
    function HTMLOptGroupElement() {
        HTMLElement.call(this, 'optgroup');
    }
    HTMLOptGroupElement.prototype = Object.create(HTMLElement.prototype);
    HTMLOptGroupElement.prototype.constructor = HTMLOptGroupElement;
    window.__elementInterfaces__.define(HTMLOptGroupElement, "HTMLOptGroupElement");
    
    // ==================== HTMLObjectElement ====================
    function HTMLObjectElement() {
        HTMLElement.call(this, 'object');
        this.align = '';
        this.archive = '';
        this.border = '';
        this.code = '';
        this.codeBase = '';
        this.codeType = '';
        this.contentDocument = null;
        this.contentWindow = null;
        this.declare = false;
        this.form = null;
        this.height = '';
        this.hspace = 0;
        this.standby = '';
        this.validationMessage = '';
        this.validity = { valid: true };
        this.vspace = 0;
        this.width = '';
        this.willValidate = false;
    }
    HTMLObjectElement.prototype = Object.create(HTMLElement.prototype);
    HTMLObjectElement.prototype.constructor = HTMLObjectElement;
    HTMLObjectElement.prototype.checkValidity = function() { return true; };
    HTMLObjectElement.prototype.reportValidity = function() { return true; };
    HTMLObjectElement.prototype.setCustomValidity = function() { };
    HTMLObjectElement.prototype.getSVGDocument = function() { return null; };
    window.__elementInterfaces__.define(HTMLObjectElement, "HTMLObjectElement");
    
    // ==================== HTMLEmbedElement ====================
    function HTMLEmbedElement() {
        HTMLElement.call(this, 'embed');
        this.align = '';
        this.height = '';
        this.name = '';
        this.width = '';
    }
    HTMLEmbedElement.prototype = Object.create(HTMLElement.prototype);
    HTMLEmbedElement.prototype.constructor = HTMLEmbedElement;
    HTMLEmbedElement.prototype.getSVGDocument = function() { return null; };
    window.__elementInterfaces__.define(HTMLEmbedElement, "HTMLEmbedElement");
    
    // ==================== HTMLSourceElement ====================
    function HTMLSourceElement() {
        HTMLElement.call(this, 'source');
    }
    HTMLSourceElement.prototype = Object.create(HTMLElement.prototype);
    HTMLSourceElement.prototype.constructor = HTMLSourceElement;
    window.__elementInterfaces__.define(HTMLSourceElement, "HTMLSourceElement");
    
    // ==================== HTMLTrackElement ====================
    function HTMLTrackElement() {
        HTMLElement.call(this, 'track');
        this.readyState = 0;
        this.track = null;
        this.NONE = 0;
        this.LOADING = 1;
        this.LOADED = 2;
        this.ERROR = 3;
        
        // 常量
    }
    HTMLTrackElement.prototype = Object.create(HTMLElement.prototype);
    HTMLTrackElement.prototype.constructor = HTMLTrackElement;
    HTMLTrackElement.NONE = 0;
    HTMLTrackElement.LOADING = 1;
    HTMLTrackElement.LOADED = 2;
    HTMLTrackElement.ERROR = 3;
    window.__elementInterfaces__.define(HTMLTrackElement, "HTMLTrackElement");
    
    // ==================== HTMLPictureElement ====================
    function HTMLPictureElement() {
        HTMLElement.call(this, 'picture');
    }
    HTMLPictureElement.prototype = Object.create(HTMLElement.prototype);
    HTMLPictureElement.prototype.constructor = HTMLPictureElement;
    window.__elementInterfaces__.define(HTMLPictureElement, "HTMLPictureElement");
    
    // ==================== HTMLMapElement ====================
    function HTMLMapElement() {
        HTMLElement.call(this, 'map');
        this.areas = [];
    }
    HTMLMapElement.prototype = Object.create(HTMLElement.prototype);
    HTMLMapElement.prototype.constructor = HTMLMapElement;
    window.__elementInterfaces__.define(HTMLMapElement, "HTMLMapElement");
    
    // ==================== HTMLAreaElement ====================
    function HTMLAreaElement() {
        HTMLElement.call(this, 'area');
        this.coords = '';
        this.hash = '';
        this.host = '';
        this.hostname = '';
        this.href = '';
        this.noHref = false;
        this.origin = '';
        this.password = '';
        this.pathname = '';
        this.port = '';
        this.protocol = '';
        this.relList = new DOMTokenList(this, 'rel');
        this.search = '';
        this.shape = '';
        this.username = '';
    }
    HTMLAreaElement.prototype = Object.create(HTMLElement.prototype);
    HTMLAreaElement.prototype.constructor = HTMLAreaElement;
    HTMLAreaElement.prototype.toString = function() { return this.href; };
    window.__elementInterfaces__.define(HTMLAreaElement, "HTMLAreaElement");
    
    // ==================== SVGElement ====================
    function SVGElement(tagName) {
        Element.call(this, tagName || 'svg', 'http://www.w3.org/2000/svg');
    }
    SVGElement.prototype = Object.create(Element.prototype);
    SVGElement.prototype.constructor = SVGElement;
    copyAccessors(SVGElement.prototype, ['style', 'dataset']);
    window.__elementInterfaces__.define(SVGElement, "SVGElement");
    
    // ==================== SVGSVGElement ====================
    function SVGSVGElement() {
        SVGElement.call(this, 'svg');
        this.currentScale = 1;
        this.currentTranslate = { x: 0, y: 0 };
        this.height = { baseVal: { value: 150 }, animVal: { value: 150 } };
        this.width = { baseVal: { value: 300 }, animVal: { value: 300 } };
        this.x = { baseVal: { value: 0 }, animVal: { value: 0 } };
        this.y = { baseVal: { value: 0 }, animVal: { value: 0 } };
        this.viewBox = { baseVal: { x: 0, y: 0, width: 300, height: 150 } };
    }
    SVGSVGElement.prototype = Object.create(SVGElement.prototype);
    SVGSVGElement.prototype.constructor = SVGSVGElement;
    SVGSVGElement.prototype.createSVGPoint = function() { return { x: 0, y: 0 }; };
    SVGSVGElement.prototype.createSVGRect = function() { return { x: 0, y: 0, width: 0, height: 0 }; };
    SVGSVGElement.prototype.createSVGMatrix = function() { return new DOMMatrix(); };
    SVGSVGElement.prototype.createSVGTransform = function() { return {}; };
    SVGSVGElement.prototype.createSVGLength = function() { return { value: 0 }; };
    SVGSVGElement.prototype.createSVGAngle = function() { return { value: 0 }; };
    SVGSVGElement.prototype.createSVGNumber = function() { return { value: 0 }; };
    SVGSVGElement.prototype.getElementById = function(id) { return null; };
    SVGSVGElement.prototype.getIntersectionList = function() { return []; };
    SVGSVGElement.prototype.getEnclosureList = function() { return []; };
    SVGSVGElement.prototype.checkIntersection = function() { return false; };
    SVGSVGElement.prototype.checkEnclosure = function() { return false; };
    SVGSVGElement.prototype.deselectAll = function() { };
    SVGSVGElement.prototype.suspendRedraw = function() { return 0; };
    SVGSVGElement.prototype.unsuspendRedraw = function() { };
    SVGSVGElement.prototype.unsuspendRedrawAll = function() { };
    SVGSVGElement.prototype.forceRedraw = function() { };
    SVGSVGElement.prototype.pauseAnimations = function() { };
    SVGSVGElement.prototype.unpauseAnimations = function() { };
    SVGSVGElement.prototype.animationsPaused = function() { return false; };
    SVGSVGElement.prototype.getCurrentTime = function() { return 0; };
    SVGSVGElement.prototype.setCurrentTime = function() { };
    window.__elementInterfaces__.define(SVGSVGElement, "SVGSVGElement");
    

    // ==================== 反射属性表 ====================
    // 浏览器里这些属性读写的是对应的 HTML 属性（此前是实例状态，与属性脱节）
    function reflectBoolean(prototype, key, attribute) {
        Object.defineProperty(prototype, key, {
            get() { return this.hasAttribute(attribute); },
            set(value) {
                if (value) this.setAttribute(attribute, '');
                else this.removeAttribute(attribute);
            },
            enumerable: true, configurable: true
        });
    }

    function reflectNumber(prototype, key, attribute, fallback) {
        Object.defineProperty(prototype, key, {
            get() {
                const value = parseInt(this.getAttribute(attribute) ?? '', 10);
                return Number.isNaN(value) ? fallback : value;
            },
            set(value) {
                const number = Math.trunc(Number(value));
                this.setAttribute(attribute, String(Number.isFinite(number) ? number : fallback));
            },
            enumerable: true, configurable: true
        });
    }

    const reflectedAttributes = {
        "HTMLAnchorElement": {
            "strings": {
                "target": "target",
                "download": "download",
                "hreflang": "hreflang",
                "type": "type",
                "rel": "rel",
                "ping": "ping",
                "referrerPolicy": "referrerpolicy"
            }
        },
        "HTMLImageElement": {
            "strings": {
                "alt": "alt",
                "srcset": "srcset",
                "sizes": "sizes",
                "crossOrigin": "crossorigin",
                "useMap": "usemap",
                "decoding": "decoding",
                "loading": "loading",
                "referrerPolicy": "referrerpolicy",
                "fetchPriority": "fetchpriority"
            },
            "booleans": {
                "isMap": "ismap"
            }
        },
        "HTMLLinkElement": {
            "strings": {
                "rel": "rel",
                "type": "type",
                "hreflang": "hreflang",
                "media": "media",
                "sizes": "sizes",
                "integrity": "integrity",
                "crossOrigin": "crossorigin",
                "referrerPolicy": "referrerpolicy",
                "as": "as",
                "fetchPriority": "fetchpriority",
                "imageSrcset": "imagesrcset",
                "imageSizes": "imagesizes",
                "blocking": "blocking"
            },
            "booleans": {
                "disabled": "disabled"
            }
        },
        "HTMLScriptElement": {
            "strings": {
                "src": "src",
                "type": "type",
                "crossOrigin": "crossorigin",
                "integrity": "integrity",
                "referrerPolicy": "referrerpolicy",
                "nonce": "nonce",
                "fetchPriority": "fetchpriority",
                "blocking": "blocking"
            },
            "booleans": {
                "async": "async",
                "defer": "defer",
                "noModule": "nomodule"
            }
        },
        "HTMLMetaElement": {
            "strings": {
                "name": "name",
                "content": "content",
                "httpEquiv": "http-equiv",
                "charset": "charset",
                "media": "media"
            }
        },
        "HTMLIFrameElement": {
            "strings": {
                "src": "src",
                "name": "name",
                "srcdoc": "srcdoc",
                "width": "width",
                "height": "height",
                "allow": "allow",
                "referrerPolicy": "referrerpolicy",
                "loading": "loading",
                "fetchPriority": "fetchpriority"
            }
        },
        "HTMLFormElement": {
            "strings": {
                "action": "action",
                "method": "method",
                "enctype": "enctype",
                "target": "target",
                "name": "name"
            },
            "booleans": {
                "noValidate": "novalidate"
            }
        },
        "HTMLInputElement": {
            "strings": {
                "type": "type",
                "name": "name",
                "placeholder": "placeholder",
                "accept": "accept",
                "autocomplete": "autocomplete",
                "alt": "alt",
                "pattern": "pattern",
                "step": "step",
                "min": "min",
                "max": "max"
            },
            "booleans": {
                "required": "required",
                "readOnly": "readonly",
                "disabled": "disabled",
                "multiple": "multiple",
                "autofocus": "autofocus"
            },
            "numbers": {
                "maxLength": "maxlength",
                "minLength": "minlength",
                "size": "size"
            }
        },
        "HTMLButtonElement": {
            "strings": {
                "type": "type",
                "name": "name",
                "value": "value",
                "formAction": "formaction",
                "formMethod": "formmethod",
                "formEnctype": "formenctype",
                "formTarget": "formtarget"
            },
            "booleans": {
                "disabled": "disabled",
                "autofocus": "autofocus",
                "formNoValidate": "formnovalidate"
            }
        },
        "HTMLSelectElement": {
            "strings": {
                "name": "name",
                "autocomplete": "autocomplete"
            },
            "booleans": {
                "multiple": "multiple",
                "required": "required",
                "disabled": "disabled",
                "autofocus": "autofocus"
            },
            "numbers": {
                "size": "size"
            }
        },
        "HTMLTextAreaElement": {
            "strings": {
                "name": "name",
                "placeholder": "placeholder",
                "wrap": "wrap",
                "autocomplete": "autocomplete"
            },
            "booleans": {
                "required": "required",
                "readOnly": "readonly",
                "disabled": "disabled",
                "autofocus": "autofocus"
            },
            "numbers": {
                "rows": "rows",
                "cols": "cols",
                "maxLength": "maxlength",
                "minLength": "minlength"
            }
        },
        "HTMLOptionElement": {
            "strings": {
                "value": "value",
                "label": "label"
            },
            "booleans": {
                "defaultSelected": "selected"
            }
        },
        "HTMLSourceElement": {
            "strings": {
                "src": "src",
                "srcset": "srcset",
                "sizes": "sizes",
                "type": "type",
                "media": "media",
                "width": "width",
                "height": "height"
            }
        },
        "HTMLTrackElement": {
            "strings": {
                "src": "src",
                "srclang": "srclang",
                "label": "label",
                "kind": "kind"
            },
            "booleans": {
                "default": "default"
            }
        },
        "HTMLVideoElement": {
            "strings": {
                "poster": "poster",
                "preload": "preload",
                "crossOrigin": "crossorigin"
            },
            "booleans": {
                "autoplay": "autoplay",
                "loop": "loop",
                "muted": "muted",
                "controls": "controls",
                "playsInline": "playsinline"
            },
            "numbers": {
                "width": "width",
                "height": "height"
            }
        },
        "HTMLAudioElement": {
            "strings": {
                "preload": "preload",
                "crossOrigin": "crossorigin"
            },
            "booleans": {
                "autoplay": "autoplay",
                "loop": "loop",
                "muted": "muted",
                "controls": "controls"
            }
        },
        "HTMLObjectElement": {
            "strings": {
                "data": "data",
                "type": "type",
                "name": "name",
                "useMap": "usemap"
            }
        },
        "HTMLEmbedElement": {
            "strings": {
                "src": "src",
                "type": "type"
            }
        },
        "HTMLDataElement": {
            "strings": {
                "value": "value"
            }
        },
        "HTMLTimeElement": {
            "strings": {
                "dateTime": "datetime"
            }
        },
        "HTMLOutputElement": {
            "strings": {
                "name": "name"
            }
        },
        "HTMLFieldSetElement": {
            "strings": {
                "name": "name"
            }
        },
        "HTMLDetailsElement": {
            "booleans": {
                "open": "open"
            }
        },
        "HTMLDialogElement": {
            "booleans": {
                "open": "open"
            }
        },
        "HTMLSlotElement": {
            "strings": {
                "name": "name"
            }
        },
        "HTMLMediaElement": {
            "strings": {
                "src": "src"
            }
        },
        "HTMLTableCellElement": {
            "numbers": {
                "colSpan": "colspan",
                "rowSpan": "rowspan"
            }
        },
        "HTMLTableElement": {
            "strings": {
                "border": "border"
            }
        },
        "HTMLBaseElement": {
            "strings": {
                "target": "target"
            }
        }
    };
    const reflectedProperties = new Set();
    for (const [interfaceName, spec] of Object.entries(reflectedAttributes)) {
        const Constructor = window[interfaceName];
        if (typeof Constructor !== 'function' || !Constructor.prototype) continue;
        for (const [key, attribute] of Object.entries(spec.strings || {})) {
            reflectString(Constructor.prototype, key, attribute);
            reflectedProperties.add(key);
        }
        for (const [key, attribute] of Object.entries(spec.booleans || {})) {
            reflectBoolean(Constructor.prototype, key, attribute);
            reflectedProperties.add(key);
        }
        for (const [key, attribute] of Object.entries(spec.numbers || {})) {
            reflectNumber(Constructor.prototype, key, attribute, 0);
            reflectedProperties.add(key);
        }
    }

    // ==================== 自有属性提升 ====================
    // 浏览器里元素实例没有自有属性：构造函数写入的数据属性在创建后搬到原型上（访问器 + 每实例状态）
    const elementPropertyState = new WeakMap();
    function propertyStateOf(element) {
        let state = elementPropertyState.get(element);
        if (!state) {
            state = new Map();
            elementPropertyState.set(element, state);
        }
        return state;
    }

    function defineLiftedAccessor(prototype, key) {
        const holder = {
            get [key]() { return propertyStateOf(this).get(key); },
            set [key](value) { propertyStateOf(this).set(key, value); }
        };
        const descriptor = Object.getOwnPropertyDescriptor(holder, key);
        Object.defineProperty(prototype, key, {
            get: window.safefunction(descriptor.get, 'get ' + key),
            set: window.safefunction(descriptor.set, 'set ' + key),
            enumerable: true, configurable: true
        });
    }

    function liftOwnProperties(element) {
        const prototype = Object.getPrototypeOf(element);
        const state = propertyStateOf(element);
        for (const key of Object.getOwnPropertyNames(element)) {
            if (key.startsWith('__')) continue;
            const descriptor = Object.getOwnPropertyDescriptor(element, key);
            // 只提升可写可配置的数据属性；只读/不可配置的属于内部状态
            if (!descriptor || !('value' in descriptor) || !descriptor.writable || !descriptor.configurable) continue;
            if (!Object.prototype.hasOwnProperty.call(prototype, key)) defineLiftedAccessor(prototype, key);
            state.set(key, descriptor.value);
            delete element[key];
        }
    }

    function copyElementState(source, target) {
        const state = elementPropertyState.get(source);
        if (!state) return;
        const targetState = propertyStateOf(target);
        for (const [key, value] of state) targetState.set(key, value);
    }

    Object.defineProperty(window, '__elementProps__', {
        value: Object.freeze({ lift: liftOwnProperties, copy: copyElementState }),
        configurable: true
    });
    // 通用版：任何「实例不留自有属性」的对象（元素、事件、Blob 等）都可以用
    Object.defineProperty(window, '__liftOwnProperties__', {
        value: liftOwnProperties, configurable: true
    });

    // document.js 在加载时已创建 html / head / body，补做一次提升
    for (const node of [document.documentElement, document.head, document.body]) {
        if (node) liftOwnProperties(node);
    }

    // ==================== 元素构造函数映射表 ====================
    const elementConstructors = {
        // 基础元素
        'div': HTMLDivElement,
        'span': HTMLSpanElement,
        'p': HTMLParagraphElement,
        'a': HTMLAnchorElement,
        'img': HTMLImageElement,
        'br': HTMLBRElement,
        'hr': HTMLHRElement,
        'pre': HTMLPreElement,
        
        // 标题
        'h1': function() { return new HTMLHeadingElement(1); },
        'h2': function() { return new HTMLHeadingElement(2); },
        'h3': function() { return new HTMLHeadingElement(3); },
        'h4': function() { return new HTMLHeadingElement(4); },
        'h5': function() { return new HTMLHeadingElement(5); },
        'h6': function() { return new HTMLHeadingElement(6); },
        
        // 表单元素
        'form': HTMLFormElement,
        'input': HTMLInputElement,
        'button': HTMLButtonElement,
        'select': HTMLSelectElement,
        'option': HTMLOptionElement,
        'optgroup': HTMLOptGroupElement,
        'textarea': HTMLTextAreaElement,
        'label': HTMLLabelElement,
        'fieldset': HTMLFieldSetElement,
        'legend': HTMLLegendElement,
        'datalist': HTMLDataListElement,
        'output': HTMLOutputElement,
        'progress': HTMLProgressElement,
        'meter': HTMLMeterElement,
        
        // 表格元素
        'table': HTMLTableElement,
        'tr': HTMLTableRowElement,
        'td': HTMLTableCellElement,
        'th': HTMLTableCellElement,
        
        // 列表元素
        'ul': HTMLUListElement,
        'ol': HTMLOListElement,
        'li': HTMLLIElement,
        
        // 媒体元素
        'video': HTMLVideoElement,
        'audio': HTMLAudioElement,
        'source': HTMLSourceElement,
        'track': HTMLTrackElement,
        'picture': HTMLPictureElement,
        'canvas': HTMLCanvasElement,
        
        // 嵌入元素
        'iframe': HTMLIFrameElement,
        'embed': HTMLEmbedElement,
        'object': HTMLObjectElement,
        
        // 文档元素
        'script': HTMLScriptElement,
        'style': HTMLStyleElement,
        'link': HTMLLinkElement,
        'meta': HTMLMetaElement,
        'title': HTMLTitleElement,
        'base': HTMLBaseElement,
        
        // 交互元素
        'details': HTMLDetailsElement,
        'dialog': HTMLDialogElement,
        
        // 其他
        'blockquote': function() { return new HTMLQuoteElement('blockquote'); },
        'q': function() { return new HTMLQuoteElement('q'); },
        'ins': function() { return new HTMLModElement('ins'); },
        'del': function() { return new HTMLModElement('del'); },
        'col': function() { return new HTMLTableColElement('col'); },
        'colgroup': function() { return new HTMLTableColElement('colgroup'); },
        'param': HTMLParamElement,
        'summary': function() { return new HTMLElement('summary'); },
        'template': HTMLTemplateElement,
        'slot': HTMLSlotElement,
        'data': HTMLDataElement,
        'time': HTMLTimeElement,
        'map': HTMLMapElement,
        'area': HTMLAreaElement,
        
        // SVG
        'svg': SVGSVGElement
    };
    
    // 暴露构造函数映射表
    // 经 createElement 创建的元素同样没有自有属性
    for (const tag of Object.keys(elementConstructors)) {
        const Constructor = elementConstructors[tag];
        elementConstructors[tag] = function () {
            const element = new Constructor();
            liftOwnProperties(element);
            return element;
        };
    }

    window.__elementConstructors__ = elementConstructors;
    
    // DOMTokenList 由 document.js 提供：classList / relList / htmlFor 共用同一个类
    const DOMTokenList = window.__domTokenListClass__;

    // ==================== DOMMatrix (如果不存在) ====================
    if (!window.DOMMatrix) {
        function DOMMatrix(init) {
            this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
            this.m11 = 1; this.m12 = 0; this.m13 = 0; this.m14 = 0;
            this.m21 = 0; this.m22 = 1; this.m23 = 0; this.m24 = 0;
            this.m31 = 0; this.m32 = 0; this.m33 = 1; this.m34 = 0;
            this.m41 = 0; this.m42 = 0; this.m43 = 0; this.m44 = 1;
            this.is2D = true;
            this.isIdentity = true;
        }
        DOMMatrix.prototype = {
            multiply: function() { return new DOMMatrix(); },
            translate: function() { return new DOMMatrix(); },
            scale: function() { return new DOMMatrix(); },
            rotate: function() { return new DOMMatrix(); },
            inverse: function() { return new DOMMatrix(); },
            transformPoint: function(point) { return { x: point?.x || 0, y: point?.y || 0, z: 0, w: 1 }; },
            toString: function() { return `matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})`; }
        };
        window.DOMMatrix = DOMMatrix;
        window.DOMMatrixReadOnly = DOMMatrix;
    }
    
    // 继承 Node 的接口原型没有自己的 Symbol.toStringTag 时会继承到 EventTarget 的；按接口名补上
    for (const name of Object.getOwnPropertyNames(window)) {
        const descriptor = Object.getOwnPropertyDescriptor(window, name);
        const ctor = descriptor && descriptor.value;
        if (typeof ctor !== 'function' || !ctor.prototype || ctor.name !== name) continue;
        const proto = ctor.prototype;
        if (proto !== Node.prototype && !Node.prototype.isPrototypeOf(proto)) continue;
        if (Object.prototype.hasOwnProperty.call(proto, Symbol.toStringTag)) continue;
        Object.defineProperty(proto, Symbol.toStringTag, { value: name, configurable: true });
    }

    console.log('[elements.js] HTML元素类型库加载完成，共注册', Object.keys(elementConstructors).length, '种元素类型');
    
})();
