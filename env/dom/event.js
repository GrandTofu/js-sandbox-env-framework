/**
 * @env-module event
 * @description 浏览器事件对象模拟 - 完整事件系统
 * @compatibility Chrome 80+, Firefox 75+, Edge 79+
 * @version 2.0.0
 */

(function() {
    'use strict';
    
    // 获取监控系统
    const Monitor = window.__EnvMonitor__ || window.__envMonitor__ || {
        log: function() {},
        logCall: function() {}
    };
    
    // ==================== Event 基类 ====================
    // Event / EventTarget / AbortSignal / AbortController 由 eventCore.js 按 WebIDL 定义；
    // 下面的旧式子类通过 initLegacyEvent 获得 Event 身份与内部状态
    const Event = window.Event;
    const initLegacyEvent = window.__eventInternals__.initLegacy;
    
    // ==================== CustomEvent ====================
    function CustomEvent(type, eventInitDict) {
        initLegacyEvent(this, type, eventInitDict);
        this.detail = eventInitDict?.detail ?? null;
    }
    CustomEvent.prototype = Object.create(Event.prototype);
    CustomEvent.prototype.constructor = CustomEvent;
    CustomEvent.prototype.initCustomEvent = function(type, bubbles, cancelable, detail) {
        // type/bubbles/cancelable 是 Event.prototype 上的只读属性，经 initEvent 写入内部状态
        this.initEvent(type, bubbles, cancelable);
        this.detail = detail;
    };
    window.CustomEvent = CustomEvent;
    
    // ==================== UIEvent ====================
    function UIEvent(type, eventInitDict) {
        initLegacyEvent(this, type, eventInitDict);
        eventInitDict = eventInitDict || {};
        this.view = eventInitDict.view || window;
        this.detail = eventInitDict.detail || 0;
        this.sourceCapabilities = eventInitDict.sourceCapabilities || null;
    }
    UIEvent.prototype = Object.create(Event.prototype);
    UIEvent.prototype.constructor = UIEvent;
    UIEvent.prototype.initUIEvent = function(type, bubbles, cancelable, view, detail) {
        this.initEvent(type, bubbles, cancelable);
        this.view = view;
        this.detail = detail;
    };
    window.UIEvent = UIEvent;
    
    // ==================== MouseEvent ====================
    function MouseEvent(type, eventInitDict) {
        UIEvent.call(this, type, eventInitDict);
        eventInitDict = eventInitDict || {};
        
        // 坐标
        this.screenX = eventInitDict.screenX || 0;
        this.screenY = eventInitDict.screenY || 0;
        this.clientX = eventInitDict.clientX || 0;
        this.clientY = eventInitDict.clientY || 0;
        this.pageX = eventInitDict.pageX || this.clientX;
        this.pageY = eventInitDict.pageY || this.clientY;
        this.offsetX = eventInitDict.offsetX || 0;
        this.offsetY = eventInitDict.offsetY || 0;
        this.x = this.clientX;
        this.y = this.clientY;
        this.movementX = eventInitDict.movementX || 0;
        this.movementY = eventInitDict.movementY || 0;
        
        // 按钮
        this.button = eventInitDict.button || 0;
        this.buttons = eventInitDict.buttons || 0;
        
        // 修饰键
        this.ctrlKey = !!eventInitDict.ctrlKey;
        this.shiftKey = !!eventInitDict.shiftKey;
        this.altKey = !!eventInitDict.altKey;
        this.metaKey = !!eventInitDict.metaKey;
        
        // 相关目标
        this.relatedTarget = eventInitDict.relatedTarget || null;
        
        Monitor.log('Event', 'createMouseEvent', { 
            type: type, 
            clientX: this.clientX, 
            clientY: this.clientY,
            button: this.button
        });
    }
    MouseEvent.prototype = Object.create(UIEvent.prototype);
    MouseEvent.prototype.constructor = MouseEvent;
    MouseEvent.prototype.getModifierState = function(keyArg) {
        const modifiers = {
            'Alt': this.altKey,
            'Control': this.ctrlKey,
            'Meta': this.metaKey,
            'Shift': this.shiftKey
        };
        return !!modifiers[keyArg];
    };
    MouseEvent.prototype.initMouseEvent = function(type, bubbles, cancelable, view, detail,
        screenX, screenY, clientX, clientY, ctrlKey, altKey, shiftKey, metaKey, button, relatedTarget) {
        this.initUIEvent(type, bubbles, cancelable, view, detail);
        this.screenX = screenX;
        this.screenY = screenY;
        this.clientX = clientX;
        this.clientY = clientY;
        this.ctrlKey = ctrlKey;
        this.altKey = altKey;
        this.shiftKey = shiftKey;
        this.metaKey = metaKey;
        this.button = button;
        this.relatedTarget = relatedTarget;
    };
    window.MouseEvent = MouseEvent;
    
    // ==================== PointerEvent ====================
    function PointerEvent(type, eventInitDict) {
        MouseEvent.call(this, type, eventInitDict);
        eventInitDict = eventInitDict || {};
        
        this.pointerId = eventInitDict.pointerId || 0;
        this.width = eventInitDict.width || 1;
        this.height = eventInitDict.height || 1;
        this.pressure = eventInitDict.pressure || 0;
        this.tangentialPressure = eventInitDict.tangentialPressure || 0;
        this.tiltX = eventInitDict.tiltX || 0;
        this.tiltY = eventInitDict.tiltY || 0;
        this.twist = eventInitDict.twist || 0;
        this.pointerType = eventInitDict.pointerType || 'mouse';
        this.isPrimary = eventInitDict.isPrimary !== undefined ? eventInitDict.isPrimary : true;
        this.altitudeAngle = eventInitDict.altitudeAngle || Math.PI / 2;
        this.azimuthAngle = eventInitDict.azimuthAngle || 0;
    }
    PointerEvent.prototype = Object.create(MouseEvent.prototype);
    PointerEvent.prototype.constructor = PointerEvent;
    PointerEvent.prototype.getCoalescedEvents = function() { return []; };
    PointerEvent.prototype.getPredictedEvents = function() { return []; };
    window.PointerEvent = PointerEvent;
    
    // ==================== WheelEvent ====================
    function WheelEvent(type, eventInitDict) {
        MouseEvent.call(this, type, eventInitDict);
        eventInitDict = eventInitDict || {};
        
        this.deltaX = eventInitDict.deltaX || 0;
        this.deltaY = eventInitDict.deltaY || 0;
        this.deltaZ = eventInitDict.deltaZ || 0;
        this.deltaMode = eventInitDict.deltaMode || 0;
    }
    WheelEvent.prototype = Object.create(MouseEvent.prototype);
    WheelEvent.prototype.constructor = WheelEvent;
    WheelEvent.DOM_DELTA_PIXEL = 0;
    WheelEvent.DOM_DELTA_LINE = 1;
    WheelEvent.DOM_DELTA_PAGE = 2;
    window.WheelEvent = WheelEvent;
    
    // ==================== KeyboardEvent ====================
    function KeyboardEvent(type, eventInitDict) {
        UIEvent.call(this, type, eventInitDict);
        eventInitDict = eventInitDict || {};
        
        this.key = eventInitDict.key || '';
        this.code = eventInitDict.code || '';
        this.location = eventInitDict.location || 0;
        this.repeat = !!eventInitDict.repeat;
        this.isComposing = !!eventInitDict.isComposing;
        
        // 修饰键
        this.ctrlKey = !!eventInitDict.ctrlKey;
        this.shiftKey = !!eventInitDict.shiftKey;
        this.altKey = !!eventInitDict.altKey;
        this.metaKey = !!eventInitDict.metaKey;
        
        // 已弃用但仍常用
        this.keyCode = eventInitDict.keyCode || 0;
        this.charCode = eventInitDict.charCode || 0;
        this.which = eventInitDict.which || this.keyCode;
        
        Monitor.log('Event', 'createKeyboardEvent', { 
            type: type, 
            key: this.key, 
            code: this.code,
            keyCode: this.keyCode
        });
    }
    KeyboardEvent.prototype = Object.create(UIEvent.prototype);
    KeyboardEvent.prototype.constructor = KeyboardEvent;
    KeyboardEvent.prototype.getModifierState = function(keyArg) {
        const modifiers = {
            'Alt': this.altKey,
            'Control': this.ctrlKey,
            'Meta': this.metaKey,
            'Shift': this.shiftKey,
            'CapsLock': false,
            'NumLock': false,
            'ScrollLock': false
        };
        return !!modifiers[keyArg];
    };
    KeyboardEvent.prototype.initKeyboardEvent = function(type, bubbles, cancelable, view, key, location, modifiers, repeat) {
        this.initUIEvent(type, bubbles, cancelable, view, 0);
        this.key = key;
        this.location = location;
        this.repeat = repeat;
    };
    KeyboardEvent.DOM_KEY_LOCATION_STANDARD = 0;
    KeyboardEvent.DOM_KEY_LOCATION_LEFT = 1;
    KeyboardEvent.DOM_KEY_LOCATION_RIGHT = 2;
    KeyboardEvent.DOM_KEY_LOCATION_NUMPAD = 3;
    window.KeyboardEvent = KeyboardEvent;
    
    // ==================== InputEvent ====================
    function InputEvent(type, eventInitDict) {
        UIEvent.call(this, type, eventInitDict);
        eventInitDict = eventInitDict || {};
        
        this.data = eventInitDict.data || null;
        this.dataTransfer = eventInitDict.dataTransfer || null;
        this.inputType = eventInitDict.inputType || '';
        this.isComposing = !!eventInitDict.isComposing;
    }
    InputEvent.prototype = Object.create(UIEvent.prototype);
    InputEvent.prototype.constructor = InputEvent;
    InputEvent.prototype.getTargetRanges = function() { return []; };
    window.InputEvent = InputEvent;
    
    // ==================== FocusEvent ====================
    function FocusEvent(type, eventInitDict) {
        UIEvent.call(this, type, eventInitDict);
        this.relatedTarget = eventInitDict?.relatedTarget || null;
    }
    FocusEvent.prototype = Object.create(UIEvent.prototype);
    FocusEvent.prototype.constructor = FocusEvent;
    window.FocusEvent = FocusEvent;
    
    // ==================== TouchEvent ====================
    function Touch(touchInitDict) {
        touchInitDict = touchInitDict || {};
        this.identifier = touchInitDict.identifier || 0;
        this.target = touchInitDict.target || null;
        this.screenX = touchInitDict.screenX || 0;
        this.screenY = touchInitDict.screenY || 0;
        this.clientX = touchInitDict.clientX || 0;
        this.clientY = touchInitDict.clientY || 0;
        this.pageX = touchInitDict.pageX || this.clientX;
        this.pageY = touchInitDict.pageY || this.clientY;
        this.radiusX = touchInitDict.radiusX || 0;
        this.radiusY = touchInitDict.radiusY || 0;
        this.rotationAngle = touchInitDict.rotationAngle || 0;
        this.force = touchInitDict.force || 0;
        this.altitudeAngle = touchInitDict.altitudeAngle || Math.PI / 2;
        this.azimuthAngle = touchInitDict.azimuthAngle || 0;
        this.touchType = touchInitDict.touchType || 'direct';
    }
    window.Touch = Touch;
    
    function TouchList(touches) {
        this._touches = touches || [];
        this.length = this._touches.length;
        
        // 创建数字索引
        for (let i = 0; i < this._touches.length; i++) {
            this[i] = this._touches[i];
        }
    }
    TouchList.prototype.item = function(index) {
        return this._touches[index] || null;
    };
    TouchList.prototype[Symbol.iterator] = function() {
        return this._touches[Symbol.iterator]();
    };
    window.TouchList = TouchList;
    
    function TouchEvent(type, eventInitDict) {
        UIEvent.call(this, type, eventInitDict);
        eventInitDict = eventInitDict || {};
        
        this.touches = eventInitDict.touches || new TouchList([]);
        this.targetTouches = eventInitDict.targetTouches || new TouchList([]);
        this.changedTouches = eventInitDict.changedTouches || new TouchList([]);
        
        this.ctrlKey = !!eventInitDict.ctrlKey;
        this.shiftKey = !!eventInitDict.shiftKey;
        this.altKey = !!eventInitDict.altKey;
        this.metaKey = !!eventInitDict.metaKey;
    }
    TouchEvent.prototype = Object.create(UIEvent.prototype);
    TouchEvent.prototype.constructor = TouchEvent;
    TouchEvent.prototype.getModifierState = function(keyArg) {
        return KeyboardEvent.prototype.getModifierState.call(this, keyArg);
    };
    window.TouchEvent = TouchEvent;
    
    // ==================== CompositionEvent ====================
    function CompositionEvent(type, eventInitDict) {
        UIEvent.call(this, type, eventInitDict);
        this.data = eventInitDict?.data || '';
    }
    CompositionEvent.prototype = Object.create(UIEvent.prototype);
    CompositionEvent.prototype.constructor = CompositionEvent;
    CompositionEvent.prototype.initCompositionEvent = function(type, bubbles, cancelable, view, data) {
        this.initUIEvent(type, bubbles, cancelable, view, 0);
        this.data = data;
    };
    window.CompositionEvent = CompositionEvent;
    
    // ==================== DragEvent ====================
    function DataTransfer() {
        this.dropEffect = 'none';
        this.effectAllowed = 'uninitialized';
        this.items = [];
        this.types = [];
        this.files = [];
        this._data = {};
    }
    DataTransfer.prototype = {
        setData: function(format, data) {
            this._data[format] = data;
            if (!this.types.includes(format)) {
                this.types.push(format);
            }
        },
        getData: function(format) {
            return this._data[format] || '';
        },
        clearData: function(format) {
            if (format) {
                delete this._data[format];
                this.types = this.types.filter(t => t !== format);
            } else {
                this._data = {};
                this.types = [];
            }
        },
        setDragImage: function(image, xOffset, yOffset) {}
    };
    window.DataTransfer = DataTransfer;
    
    function DataTransferItem(kind, type) {
        this.kind = kind;
        this.type = type;
    }
    DataTransferItem.prototype = {
        getAsString: function(callback) {
            if (callback) callback('');
        },
        getAsFile: function() {
            return null;
        }
    };
    window.DataTransferItem = DataTransferItem;
    
    function DataTransferItemList() {
        this._items = [];
        this.length = 0;
    }
    DataTransferItemList.prototype = {
        add: function(data, type) {
            const item = new DataTransferItem(typeof data === 'string' ? 'string' : 'file', type);
            this._items.push(item);
            this.length = this._items.length;
            return item;
        },
        remove: function(index) {
            this._items.splice(index, 1);
            this.length = this._items.length;
        },
        clear: function() {
            this._items = [];
            this.length = 0;
        },
        item: function(index) {
            return this._items[index] || null;
        },
        [Symbol.iterator]: function() {
            return this._items[Symbol.iterator]();
        }
    };
    window.DataTransferItemList = DataTransferItemList;
    
    function DragEvent(type, eventInitDict) {
        MouseEvent.call(this, type, eventInitDict);
        this.dataTransfer = eventInitDict?.dataTransfer || new DataTransfer();
    }
    DragEvent.prototype = Object.create(MouseEvent.prototype);
    DragEvent.prototype.constructor = DragEvent;
    window.DragEvent = DragEvent;
    
    // ==================== ClipboardEvent ====================
    function ClipboardEvent(type, eventInitDict) {
        initLegacyEvent(this, type, eventInitDict);
        this.clipboardData = eventInitDict?.clipboardData || new DataTransfer();
    }
    ClipboardEvent.prototype = Object.create(Event.prototype);
    ClipboardEvent.prototype.constructor = ClipboardEvent;
    window.ClipboardEvent = ClipboardEvent;
    
    // ==================== MessageEvent ====================
    function MessageEvent(type, eventInitDict) {
        initLegacyEvent(this, type, eventInitDict);
        eventInitDict = eventInitDict || {};
        
        this.data = eventInitDict.data ?? null;
        this.origin = eventInitDict.origin || '';
        this.lastEventId = eventInitDict.lastEventId || '';
        this.source = eventInitDict.source || null;
        this.ports = eventInitDict.ports || [];
        
        Monitor.log('Event', 'createMessageEvent', { type, origin: this.origin });
    }
    MessageEvent.prototype = Object.create(Event.prototype);
    MessageEvent.prototype.constructor = MessageEvent;
    MessageEvent.prototype.initMessageEvent = function(type, bubbles, cancelable, data, origin, lastEventId, source, ports) {
        this.initEvent(type, bubbles, cancelable);
        this.data = data;
        this.origin = origin;
        this.lastEventId = lastEventId;
        this.source = source;
        this.ports = ports || [];
    };
    window.MessageEvent = MessageEvent;
    
    // ==================== ErrorEvent ====================
    function ErrorEvent(type, eventInitDict) {
        initLegacyEvent(this, type, eventInitDict);
        eventInitDict = eventInitDict || {};
        
        this.message = eventInitDict.message || '';
        this.filename = eventInitDict.filename || '';
        this.lineno = eventInitDict.lineno || 0;
        this.colno = eventInitDict.colno || 0;
        this.error = eventInitDict.error || null;
    }
    ErrorEvent.prototype = Object.create(Event.prototype);
    ErrorEvent.prototype.constructor = ErrorEvent;
    window.ErrorEvent = ErrorEvent;
    
    // ==================== ProgressEvent ====================
    function ProgressEvent(type, eventInitDict) {
        initLegacyEvent(this, type, eventInitDict);
        eventInitDict = eventInitDict || {};
        
        this.lengthComputable = !!eventInitDict.lengthComputable;
        this.loaded = eventInitDict.loaded || 0;
        this.total = eventInitDict.total || 0;
    }
    ProgressEvent.prototype = Object.create(Event.prototype);
    ProgressEvent.prototype.constructor = ProgressEvent;
    window.ProgressEvent = ProgressEvent;
    
    // ==================== StorageEvent ====================
    function StorageEvent(type, eventInitDict) {
        initLegacyEvent(this, type, eventInitDict);
        eventInitDict = eventInitDict || {};
        
        this.key = eventInitDict.key || null;
        this.oldValue = eventInitDict.oldValue || null;
        this.newValue = eventInitDict.newValue || null;
        this.url = eventInitDict.url || '';
        this.storageArea = eventInitDict.storageArea || null;
    }
    StorageEvent.prototype = Object.create(Event.prototype);
    StorageEvent.prototype.constructor = StorageEvent;
    StorageEvent.prototype.initStorageEvent = function(type, bubbles, cancelable, key, oldValue, newValue, url, storageArea) {
        this.initEvent(type, bubbles, cancelable);
        this.key = key;
        this.oldValue = oldValue;
        this.newValue = newValue;
        this.url = url;
        this.storageArea = storageArea;
    };
    window.StorageEvent = StorageEvent;
    
    // ==================== HashChangeEvent ====================
    function HashChangeEvent(type, eventInitDict) {
        initLegacyEvent(this, type, eventInitDict);
        eventInitDict = eventInitDict || {};
        
        this.oldURL = eventInitDict.oldURL || '';
        this.newURL = eventInitDict.newURL || '';
    }
    HashChangeEvent.prototype = Object.create(Event.prototype);
    HashChangeEvent.prototype.constructor = HashChangeEvent;
    window.HashChangeEvent = HashChangeEvent;
    
    // ==================== PopStateEvent ====================
    function PopStateEvent(type, eventInitDict) {
        initLegacyEvent(this, type, eventInitDict);
        this.state = eventInitDict?.state ?? null;
    }
    PopStateEvent.prototype = Object.create(Event.prototype);
    PopStateEvent.prototype.constructor = PopStateEvent;
    window.PopStateEvent = PopStateEvent;
    
    // ==================== PageTransitionEvent ====================
    function PageTransitionEvent(type, eventInitDict) {
        initLegacyEvent(this, type, eventInitDict);
        this.persisted = !!eventInitDict?.persisted;
    }
    PageTransitionEvent.prototype = Object.create(Event.prototype);
    PageTransitionEvent.prototype.constructor = PageTransitionEvent;
    window.PageTransitionEvent = PageTransitionEvent;
    
    // ==================== AnimationEvent ====================
    function AnimationEvent(type, eventInitDict) {
        initLegacyEvent(this, type, eventInitDict);
        eventInitDict = eventInitDict || {};
        
        this.animationName = eventInitDict.animationName || '';
        this.elapsedTime = eventInitDict.elapsedTime || 0;
        this.pseudoElement = eventInitDict.pseudoElement || '';
    }
    AnimationEvent.prototype = Object.create(Event.prototype);
    AnimationEvent.prototype.constructor = AnimationEvent;
    window.AnimationEvent = AnimationEvent;
    
    // ==================== TransitionEvent ====================
    function TransitionEvent(type, eventInitDict) {
        initLegacyEvent(this, type, eventInitDict);
        eventInitDict = eventInitDict || {};
        
        this.propertyName = eventInitDict.propertyName || '';
        this.elapsedTime = eventInitDict.elapsedTime || 0;
        this.pseudoElement = eventInitDict.pseudoElement || '';
    }
    TransitionEvent.prototype = Object.create(Event.prototype);
    TransitionEvent.prototype.constructor = TransitionEvent;
    window.TransitionEvent = TransitionEvent;
    
    // ==================== BeforeUnloadEvent ====================
    function BeforeUnloadEvent(type, eventInitDict) {
        initLegacyEvent(this, type || 'beforeunload', eventInitDict);
    }
    BeforeUnloadEvent.prototype = Object.create(Event.prototype);
    BeforeUnloadEvent.prototype.constructor = BeforeUnloadEvent;
    // BeforeUnloadEvent 的 returnValue 是字符串，遮蔽 Event.prototype 上的布尔版本
    const beforeUnloadAccessors = {
        get returnValue() { return window.__webidl__.internal(this)?.unloadReturnValue ?? ''; },
        set returnValue(value) {
            const state = window.__webidl__.internal(this);
            if (!state) throw new TypeError('Illegal invocation');
            state.unloadReturnValue = String(value);
            if (state.unloadReturnValue && state.cancelable) state.canceled = true;
        }
    };
    const beforeUnloadDescriptor = Object.getOwnPropertyDescriptor(beforeUnloadAccessors, 'returnValue');
    Object.defineProperty(BeforeUnloadEvent.prototype, 'returnValue', {
        get: window.safefunction(beforeUnloadDescriptor.get, 'get returnValue'),
        set: window.safefunction(beforeUnloadDescriptor.set, 'set returnValue'),
        enumerable: true, configurable: true
    });
    window.BeforeUnloadEvent = BeforeUnloadEvent;
    
    // ==================== SecurityPolicyViolationEvent ====================
    function SecurityPolicyViolationEvent(type, eventInitDict) {
        initLegacyEvent(this, type, eventInitDict);
        eventInitDict = eventInitDict || {};
        
        this.documentURI = eventInitDict.documentURI || '';
        this.referrer = eventInitDict.referrer || '';
        this.blockedURI = eventInitDict.blockedURI || '';
        this.violatedDirective = eventInitDict.violatedDirective || '';
        this.effectiveDirective = eventInitDict.effectiveDirective || '';
        this.originalPolicy = eventInitDict.originalPolicy || '';
        this.disposition = eventInitDict.disposition || 'enforce';
        this.sourceFile = eventInitDict.sourceFile || '';
        this.statusCode = eventInitDict.statusCode || 0;
        this.lineNumber = eventInitDict.lineNumber || 0;
        this.columnNumber = eventInitDict.columnNumber || 0;
        this.sample = eventInitDict.sample || '';
    }
    SecurityPolicyViolationEvent.prototype = Object.create(Event.prototype);
    SecurityPolicyViolationEvent.prototype.constructor = SecurityPolicyViolationEvent;
    window.SecurityPolicyViolationEvent = SecurityPolicyViolationEvent;
    
    // ==================== PromiseRejectionEvent ====================
    function PromiseRejectionEvent(type, eventInitDict) {
        initLegacyEvent(this, type, eventInitDict);
        eventInitDict = eventInitDict || {};
        
        this.promise = eventInitDict.promise || null;
        this.reason = eventInitDict.reason;
    }
    PromiseRejectionEvent.prototype = Object.create(Event.prototype);
    PromiseRejectionEvent.prototype.constructor = PromiseRejectionEvent;
    window.PromiseRejectionEvent = PromiseRejectionEvent;
    
    // ==================== FormDataEvent ====================
    function FormDataEvent(type, eventInitDict) {
        initLegacyEvent(this, type, eventInitDict);
        this.formData = eventInitDict?.formData || new FormData();
    }
    FormDataEvent.prototype = Object.create(Event.prototype);
    FormDataEvent.prototype.constructor = FormDataEvent;
    window.FormDataEvent = FormDataEvent;
    
    // ==================== SubmitEvent ====================
    function SubmitEvent(type, eventInitDict) {
        initLegacyEvent(this, type, eventInitDict);
        this.submitter = eventInitDict?.submitter || null;
    }
    SubmitEvent.prototype = Object.create(Event.prototype);
    SubmitEvent.prototype.constructor = SubmitEvent;
    window.SubmitEvent = SubmitEvent;
    
    // ResizeObserverEntry / IntersectionObserverEntry / MutationRecord 由 env/dom/observerApis.js 提供

    // ==================== DOMRect (如果尚未定义) ====================
    if (!window.DOMRect) {
        function DOMRect(x, y, width, height) {
            this.x = x || 0;
            this.y = y || 0;
            this.width = width || 0;
            this.height = height || 0;
            this.top = this.y;
            this.left = this.x;
            this.right = this.x + this.width;
            this.bottom = this.y + this.height;
        }
        Object.defineProperty(DOMRect.prototype, Symbol.toStringTag, { value: 'DOMRect', configurable: true });
    DOMRect.fromRect = function(rect) {
            return new DOMRect(rect?.x, rect?.y, rect?.width, rect?.height);
        };
        window.DOMRect = DOMRect;
    }

    // 旧式子类的原型没有自己的 toStringTag，否则会继承 Event.prototype 的 '[object Event]'
    const legacyEventNames = [
        'CustomEvent', 'UIEvent', 'MouseEvent', 'PointerEvent', 'WheelEvent', 'KeyboardEvent',
        'InputEvent', 'FocusEvent', 'TouchEvent', 'CompositionEvent', 'DragEvent', 'ClipboardEvent',
        'MessageEvent', 'ErrorEvent', 'ProgressEvent', 'StorageEvent', 'HashChangeEvent',
        'PopStateEvent', 'PageTransitionEvent', 'AnimationEvent', 'TransitionEvent',
        'BeforeUnloadEvent', 'SecurityPolicyViolationEvent', 'PromiseRejectionEvent',
        'FormDataEvent', 'SubmitEvent'
    ];
    // 事件实例与浏览器一致，只保留 isTrusted 一个自有属性：构造后把子类字段提升到原型
    function liftEvent(instance) {
        window.__elementProps__?.lift(instance);
        return instance;
    }
    for (const name of legacyEventNames) {
        const Constructor = window[name];
        if (typeof Constructor !== 'function' || !Constructor.prototype) continue;
        Object.defineProperty(Constructor.prototype, Symbol.toStringTag, { value: name, configurable: true });
        const wrapper = function (...args) {
            return liftEvent(new Constructor(...args));
        };
        Object.defineProperty(wrapper, 'name', { value: name, configurable: true });
        Object.defineProperty(wrapper, 'prototype', { value: Constructor.prototype });
        Object.defineProperty(Constructor.prototype, 'constructor',
            { value: wrapper, writable: true, configurable: true });
        window[name] = wrapper;
    }
    // 同一处理：Touch / DataTransfer 系列实例也应只在原型上有属性
    for (const name of ['Touch', 'TouchList', 'DataTransfer', 'DataTransferItem', 'DataTransferItemList']) {
        const Constructor = window[name];
        if (typeof Constructor !== 'function' || !Constructor.prototype) continue;
        const wrapper = function (...args) {
            return liftEvent(new Constructor(...args));
        };
        Object.defineProperty(wrapper, 'name', { value: name, configurable: true });
        Object.defineProperty(wrapper, 'prototype', { value: Constructor.prototype });
        Object.defineProperty(Constructor.prototype, 'constructor',
            { value: wrapper, writable: true, configurable: true });
        window[name] = wrapper;
    }
})();
