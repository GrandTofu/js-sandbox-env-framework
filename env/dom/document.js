/**
 * @env-module document
 * @description 浏览器document对象模拟 - 带完整监控功能和灵活mock支持
 * @compatibility Chrome 80+, Firefox 75+, Edge 79+
 * @version 2.0.0
 */

(function() {
    'use strict';
    
    // ==================== 获取监控系统 ====================
    const Monitor = window.__EnvMonitor__ || window.__envMonitor__ || {
        log: function() {},
        logUndefined: function() {},
        logCall: function() {},
        logCreate: function() {},
        hasMock: function() { return false; },
        executeMock: function() { return { mocked: false }; },
        pushChain: function() {},
        popChain: function() {},
        config: { enabled: false }
    };
    
    // ==================== 唯一ID生成器 ====================
    let __elementId__ = 0;
    function generateElementId() {
        return 'el_' + (++__elementId__);
    }
    
    // ==================== 存储创建的元素 ====================
    const __createdElements__ = new Map();
    window.__createdElements__ = __createdElements__;
    
    // ==================== CSSStyleDeclaration ====================
    function CSSStyleDeclaration(element) {
        this._element = element;
        this._styles = {};
        this._importantStyles = {};
        window.__elementProps__?.lift(this);

        return new Proxy(this, {
            get: function(target, prop) {
                if (typeof prop === 'symbol') return target[prop];
                if (prop in target) return target[prop];
                const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
                return target._styles[cssProp] || '';
            },
            set: function(target, prop, value) {
                if (typeof prop === 'symbol') { target[prop] = value; return true; }
                if (prop.startsWith('_')) {
                    target[prop] = value;
                    return true;
                }
                if (prop === 'cssText') {
                    target.cssText = value;
                    return true;
                }
                const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
                target._styles[cssProp] = String(value);
                target._syncAttribute();
                
                Monitor.log('Style', 'setStyle', {
                    elementId: nodeIdOf(target._element),
                    tagName: target._element?.tagName,
                    property: prop,
                    value: value
                });
                return true;
            }
        });
    }
    
    CSSStyleDeclaration.prototype = {
        _syncAttribute: function() {
            if (!this._element?.attributes) return;
            const value = this.cssText;
            const styleState = treeOf(this._element);
            const oldStyle = styleState.attrValues.style ?? null;
            styleState.attrValues.style = value;
            if (!styleRecordSuppressed && oldStyle !== value) {
                notifyMutation('attributes', this._element, { attributeName: 'style', oldValue: oldStyle });
            }
            this._element.attributes.setNamedItem(new Attr('style', value, this._element));
        },
        getPropertyValue: function(prop) { return this._styles[prop] || ''; },
        setProperty: function(prop, value, priority) {
            this._styles[prop] = String(value);
            if (priority === 'important') this._importantStyles[prop] = true;
            this._syncAttribute();
            Monitor.log('Style', 'setProperty', {
                elementId: nodeIdOf(this._element),
                property: prop,
                value: value,
                priority: priority
            });
        },
        removeProperty: function(prop) {
            const value = this._styles[prop];
            delete this._styles[prop];
            delete this._importantStyles[prop];
            this._syncAttribute();
            return value || '';
        },
        getPropertyPriority: function(prop) {
            return this._importantStyles[prop] ? 'important' : '';
        },
        get cssText() {
            return Object.entries(this._styles)
                .filter(([k]) => !k.startsWith('_'))
                .map(([k, v]) => `${k}: ${v}${this._importantStyles[k] ? ' !important' : ''};`)
                .join(' ');
        },
        set cssText(value) {
            this._styles = {};
            this._importantStyles = {};
            if (value) {
                String(value).split(';').forEach(part => {
                    const separator = part.indexOf(':');
                    if (separator < 0) return;
                    const prop = part.slice(0, separator).trim().toLowerCase();
                    const val = part.slice(separator + 1).trim();
                    if (prop && val) this._styles[prop] = val;
                });
            }
            this._syncAttribute();
        },
        get length() {
            return Object.keys(this._styles).filter(k => !k.startsWith('_')).length;
        },
        item: function(index) {
            return Object.keys(this._styles).filter(k => !k.startsWith('_'))[index] || '';
        }
    };
    
    // ==================== DOMTokenList (classList) ====================
    function DOMTokenList(element, attrName) {
        this._element = element;
        this._attrName = attrName;
        const values = (nodeStates.get(element) || {}).attrValues;
        const initial = values && attrName ? values[attrName] : null;
        this._tokens = initial ? String(initial).split(/\s+/).filter(Boolean) : [];
        window.__elementProps__?.lift(this);
    }
    
    DOMTokenList.prototype = {
        _update: function() {
            if (!this._element || !this._attrName) return;
            const value = this._tokens.join(' ');
            if (this._attrName === 'class') this._element.className = value;
            else this._element.setAttribute(this._attrName, value);
        },
        add: function(...tokens) {
            tokens.forEach(token => {
                if (token && !this._tokens.includes(token)) {
                    this._tokens.push(token);
                }
            });
            this._update();
            Monitor.log('Element', 'classList.add', {
                elementId: nodeIdOf(this._element),
                tagName: this._element?.tagName,
                tokens: tokens
            });
        },
        remove: function(...tokens) {
            tokens.forEach(token => {
                const idx = this._tokens.indexOf(token);
                if (idx > -1) this._tokens.splice(idx, 1);
            });
            this._update();
            Monitor.log('Element', 'classList.remove', {
                elementId: nodeIdOf(this._element),
                tagName: this._element?.tagName,
                tokens: tokens
            });
        },
        contains: function(token) { return this._tokens.includes(token); },
        toggle: function(token, force) {
            if (force !== undefined) {
                if (force) this.add(token);
                else this.remove(token);
                return force;
            }
            if (this.contains(token)) {
                this.remove(token);
                return false;
            }
            this.add(token);
            return true;
        },
        replace: function(oldToken, newToken) {
            const idx = this._tokens.indexOf(oldToken);
            if (idx > -1) {
                this._tokens[idx] = newToken;
                this._update();
                return true;
            }
            return false;
        },
        item: function(index) { return this._tokens[index] || null; },
        get length() { return this._tokens.length; },
        get value() { return this._tokens.join(' '); },
        set value(val) {
            this._tokens = val ? val.split(/\s+/).filter(Boolean) : [];
            this._update();
        },
        toString: function() { return this._tokens.join(' '); },
        forEach: function(callback, thisArg) { this._tokens.forEach(callback, thisArg); },
        entries: function() { return this._tokens.entries(); },
        keys: function() { return this._tokens.keys(); },
        values: function() { return this._tokens.values(); },
        [Symbol.iterator]: function() { return this._tokens[Symbol.iterator](); }
    };
    
    // ==================== NamedNodeMap (attributes) ====================
    function NamedNodeMap(element) {
        this._element = element;
        this._attrs = {};
        this.length = 0;
    }
    
    NamedNodeMap.prototype = {
        getNamedItem: function(name) { return this._attrs[name] || null; },
        setNamedItem: function(attr) {
            this._attrs[attr.name] = attr;
            this._updateLength();
            return attr;
        },
        removeNamedItem: function(name) {
            const attr = this._attrs[name];
            delete this._attrs[name];
            this._updateLength();
            return attr;
        },
        item: function(index) {
            return this._attrs[Object.keys(this._attrs)[index]] || null;
        },
        _updateLength: function() {
            this.length = Object.keys(this._attrs).length;
        },
        [Symbol.iterator]: function() {
            const attrs = Object.values(this._attrs);
            let index = 0;
            return {
                next: () => index < attrs.length 
                    ? { value: attrs[index++], done: false } 
                    : { done: true }
            };
        }
    };
    
    // ==================== Attr ====================
    function Attr(name, value, element) {
        this.name = name;
        this.localName = name;
        this.value = value !== undefined ? String(value) : '';
        this.ownerElement = element;
        this.specified = true;
        this.namespaceURI = null;
        this.prefix = null;
    }
    
    // ==================== DOMStringMap (dataset) ====================
    function DOMStringMap(element) {
        this._element = element;
        
        return new Proxy(this, {
            get: function(target, prop) {
                if (typeof prop === 'symbol' || prop.startsWith('_')) return target[prop];
                const attrName = 'data-' + prop.replace(/([A-Z])/g, '-$1').toLowerCase();
                return target._element.getAttribute(attrName);
            },
            set: function(target, prop, value) {
                if (prop.startsWith('_')) {
                    target[prop] = value;
                    return true;
                }
                const attrName = 'data-' + prop.replace(/([A-Z])/g, '-$1').toLowerCase();
                target._element.setAttribute(attrName, value);
                return true;
            },
            deleteProperty: function(target, prop) {
                const attrName = 'data-' + prop.replace(/([A-Z])/g, '-$1').toLowerCase();
                target._element.removeAttribute(attrName);
                return true;
            },
            ownKeys: function(target) {
                const keys = [];
                const attrs = target._element.attributes;
                for (let i = 0; i < attrs.length; i++) {
                    const attr = attrs.item(i);
                    if (attr && attr.name.startsWith('data-')) {
                        keys.push(attr.name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()));
                    }
                }
                return keys;
            },
            getOwnPropertyDescriptor: function(target, prop) {
                return { enumerable: true, configurable: true, value: target[prop] };
            }
        });
    }
    
    // ==================== 接口对象导出 ====================
    // elements.js 复用同一个 DOMTokenList 类（window.DOMTokenList 是不可构造的接口对象）
    Object.defineProperty(window, '__domTokenListClass__', { value: DOMTokenList, configurable: true });
    // cssom.js 复用同一个 CSSStyleDeclaration 类（window.CSSStyleDeclaration 是不可构造的接口对象）
    Object.defineProperty(window, '__cssStyleDeclarationClass__', { value: CSSStyleDeclaration, configurable: true });
    // 这些接口在浏览器里存在但不可直接构造
    for (const [name, Constructor] of [['CSSStyleDeclaration', CSSStyleDeclaration],
        ['DOMTokenList', DOMTokenList], ['NamedNodeMap', NamedNodeMap],
        ['DOMStringMap', DOMStringMap]]) {
        Object.defineProperty(Constructor.prototype, Symbol.toStringTag, { value: name, configurable: true });
        const Interface = function () { throw new TypeError('Illegal constructor'); };
        Object.defineProperty(Interface, 'name', { value: name, configurable: true });
        Object.defineProperty(Interface, 'prototype', { value: Constructor.prototype });
        Object.defineProperty(Constructor.prototype, 'constructor',
            { value: Interface, writable: true, configurable: true });
        window[name] = Interface;
    }

    // ==================== DOMRect ====================
    function DOMRect(x, y, width, height) {
        this.x = x || 0;
        this.y = y || 0;
        this.width = width || 0;
        this.height = height || 0;
        this.top = this.y;
        this.left = this.x;
        this.right = this.x + this.width;
        this.bottom = this.y + this.height;
        // 与浏览器一致：实例上没有自有属性（值存在原型访问器背后）
        window.__elementProps__?.lift(this);
    }
    Object.defineProperty(DOMRect.prototype, Symbol.toStringTag, { value: 'DOMRect', configurable: true });
    window.DOMRect = DOMRect;
    
    // ==================== 节点树内部状态 ====================
    // nodeType、parentNode、childNodes 等在 Chrome 中是原型上的只读 getter；
    // 树关系存放在这里，本文件经 treeOf() 读写，脚本只能通过原型 getter 读取
    const nodeStates = new WeakMap();

    function initNodeState(node, nodeType, nodeName) {
        const state = {
            id: generateElementId(),
            nodeType, nodeName, parent: null, childNodes: [], ownerDocument: null, connected: false,
            first: null, last: null, prev: null, next: null,
            children: [], firstElement: null, lastElement: null, prevElement: null, nextElement: null
        };
        nodeStates.set(node, state);
        return state;
    }

    // 节点 id 只供监控日志使用，不出现在节点对象上
    function nodeIdOf(node) {
        return nodeStates.get(node)?.id;
    }
    Object.defineProperty(window, '__nodeIdOf__', {
        value: window.safefunction(nodeIdOf, 'nodeIdOf'), configurable: true
    });

    function treeOf(node) {
        const state = nodeStates.get(node);
        if (!state) throw new TypeError('Illegal invocation');
        return state;
    }

    // MutationObserver：变更经 observerApis.js 的内部队列投递
    var styleRecordSuppressed = false;
    function notifyMutation(type, target, fields) {
        const mutations = window.__mutationQueue__;
        if (mutations) mutations.queue(type, target, fields);
    }

    function setCharacterData(state, value, node) {
        const oldValue = state.data;
        state.data = value === null ? '' : String(value);
        notifyMutation('characterData', node, { oldValue });
    }

    // 挂到新的父节点下；调用方负责放进 childNodes 并刷新兄弟引用
    function adopt(child, parent) {
        const state = treeOf(child);
        state.parent = parent;
        state.ownerDocument = treeOf(parent).ownerDocument;
    }

    // 值为读取函数，或 { get, set }；set(state, value, node) 用于 Chrome 中可赋值的属性
    function defineTreeGetters(prototype, getters) {
        for (const [key, spec] of Object.entries(getters)) {
            const read = typeof spec === 'function' ? spec : spec.get;
            const write = typeof spec === 'function' ? null : spec.set;
            const holder = {
                get [key]() { return read(treeOf(this)); },
                set [key](value) { write(treeOf(this), value, this); }
            };
            const descriptor = Object.getOwnPropertyDescriptor(holder, key);
            Object.defineProperty(prototype, key, {
                get: window.safefunction(descriptor.get, 'get ' + key),
                set: write ? window.safefunction(descriptor.set, 'set ' + key) : undefined,
                enumerable: true, configurable: true
            });
        }
    }

    const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
    const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

    // Element 自身的数据（标签名、属性集合、样式等）放进节点内部状态
    function initElementState(element, tagName, namespaceURI) {
        const name = String(tagName);
        Object.assign(treeOf(element), {
            tagName: name.toUpperCase(), localName: name.toLowerCase(), nodeName: name.toUpperCase(),
            namespaceURI: namespaceURI || HTML_NAMESPACE, prefix: null,
            attrValues: {},
            attributes: new NamedNodeMap(element),
            style: new CSSStyleDeclaration(element),
            classList: new DOMTokenList(element, 'class'),
            dataset: new DOMStringMap(element),
            scrollTop: 0, scrollLeft: 0
        });
    }

    // ==================== Node 基类 ====================
    function Node() {
        // 登记 EventTarget 身份：事件方法来自 EventTarget.prototype（eventCore.js）
        window.__webidl__.brand(this, 'EventTarget');
        initNodeState(this, 1, '');
    }
    
    Node.prototype = {
        // 节点类型常量
        ELEMENT_NODE: 1,
        ATTRIBUTE_NODE: 2,
        TEXT_NODE: 3,
        CDATA_SECTION_NODE: 4,
        PROCESSING_INSTRUCTION_NODE: 7,
        COMMENT_NODE: 8,
        DOCUMENT_NODE: 9,
        DOCUMENT_TYPE_NODE: 10,
        DOCUMENT_FRAGMENT_NODE: 11,
        
        appendChild: function(child) {
            if (!child || typeof child !== 'object' || child === this || child.contains?.(this)) {
                throw new DOMException('The node cannot be inserted here.', 'HierarchyRequestError');
            }
            if (child.parentNode) child.parentNode.removeChild(child);
            adopt(child, this);
            this.childNodes.push(child);
            this._updateChildReferences();
            child._setConnected(this.nodeType === 9 || this.isConnected);
            notifyMutation('childList', this, { addedNodes: [child], previousSibling: child.previousSibling, nextSibling: null });
            
            Monitor.log('DOM', 'appendChild', {
                parentId: nodeIdOf(this),
                parentTag: this.tagName || this.nodeName,
                childId: nodeIdOf(child),
                childTag: child.tagName || child.nodeName
            });
            return child;
        },
        
        removeChild: function(child) {
            const idx = this.childNodes.indexOf(child);
            if (idx === -1) {
                throw new DOMException("Failed to execute 'removeChild': The node to be removed is not a child of this node.", 'NotFoundError');
            }
            const removedPrevious = child.previousSibling;
            const removedNext = child.nextSibling;
            this.childNodes.splice(idx, 1);
            treeOf(child).parent = null;
            child._setConnected(false);
            this._updateChildReferences();
            notifyMutation('childList', this, { removedNodes: [child], previousSibling: removedPrevious, nextSibling: removedNext });
            
            Monitor.log('DOM', 'removeChild', {
                parentId: nodeIdOf(this),
                childId: nodeIdOf(child)
            });
            return child;
        },
        
        insertBefore: function(newNode, referenceNode) {
            if (!referenceNode) return this.appendChild(newNode);
            if (newNode === referenceNode) return newNode;
            if (newNode === this || newNode.contains?.(this)) {
                throw new DOMException('The node cannot be inserted here.', 'HierarchyRequestError');
            }
            const idx = this.childNodes.indexOf(referenceNode);
            if (idx === -1) {
                throw new DOMException("Failed to execute 'insertBefore': reference node is not a child.", 'NotFoundError');
            }
            if (newNode.parentNode) newNode.parentNode.removeChild(newNode);
            adopt(newNode, this);
            this.childNodes.splice(idx, 0, newNode);
            this._updateChildReferences();
            newNode._setConnected(this.nodeType === 9 || this.isConnected);
            notifyMutation('childList', this, { addedNodes: [newNode], previousSibling: newNode.previousSibling, nextSibling: referenceNode });
            
            Monitor.log('DOM', 'insertBefore', {
                parentId: nodeIdOf(this),
                newNodeId: nodeIdOf(newNode),
                referenceId: nodeIdOf(referenceNode)
            });
            return newNode;
        },
        
        replaceChild: function(newChild, oldChild) {
            if (newChild === oldChild) return oldChild;
            if (newChild === this || newChild.contains?.(this)) {
                throw new DOMException('The node cannot be inserted here.', 'HierarchyRequestError');
            }
            const idx = this.childNodes.indexOf(oldChild);
            if (idx === -1) {
                throw new DOMException("Failed to execute 'replaceChild': old child is not a child.", 'NotFoundError');
            }
            if (newChild.parentNode) newChild.parentNode.removeChild(newChild);
            adopt(newChild, this);
            this.childNodes[idx] = newChild;
            treeOf(oldChild).parent = null;
            this._updateChildReferences();
            oldChild._setConnected(false);
            newChild._setConnected(this.nodeType === 9 || this.isConnected);
            notifyMutation('childList', this, { addedNodes: [newChild], removedNodes: [oldChild], previousSibling: newChild.previousSibling, nextSibling: newChild.nextSibling });
            
            Monitor.log('DOM', 'replaceChild', {
                parentId: nodeIdOf(this),
                newChildId: nodeIdOf(newChild),
                oldChildId: nodeIdOf(oldChild)
            });
            return oldChild;
        },
        
        cloneNode: function(deep) {
            Monitor.log('DOM', 'cloneNode', { elementId: nodeIdOf(this), deep });
            const clone = Object.create(Object.getPrototypeOf(this));
            Object.assign(clone, this);
            // 元素的自有属性已提升到原型，值存在每实例状态里，克隆时一并复制
            window.__elementProps__?.copy(this, clone);
            // 树关系不在自有属性里，克隆体单独建立内部状态
            const source = treeOf(this);
            window.__webidl__.brand(clone, 'EventTarget');
            const cloneState = initNodeState(clone, source.nodeType, source.nodeName);
            cloneState.ownerDocument = source.ownerDocument;
            // 元素的属性集合、样式、classList 要新建，否则会和原元素共用
            if (source.tagName) {
                initElementState(clone, source.localName, source.namespaceURI);
                Object.assign(cloneState, { tagName: source.tagName, nodeName: source.nodeName });
                for (const name of Object.keys(source.attrValues)) clone.setAttribute(name, source.attrValues[name]);
            }

            if (deep && this.childNodes.length) {
                this.childNodes.forEach(child => {
                    if (child.cloneNode) {
                        clone.appendChild(child.cloneNode(true));
                    }
                });
            }
            return clone;
        },
        
        contains: function(node) {
            if (node === this) return true;
            for (const child of this.childNodes) {
                if (child === node || (child.contains && child.contains(node))) {
                    return true;
                }
            }
            return false;
        },
        
        hasChildNodes: function() { return this.childNodes.length > 0; },
        
        normalize: function() {},
        
        compareDocumentPosition: function(other) { return 0; },
        
        isEqualNode: function(other) {
            return this.nodeType === other?.nodeType && this.nodeName === other?.nodeName;
        },
        
        isSameNode: function(other) { return this === other; },
        
        _updateChildReferences: function() {
            const state = treeOf(this);
            state.first = state.childNodes[0] || null;
            state.last = state.childNodes[state.childNodes.length - 1] || null;
            
            for (let i = 0; i < this.childNodes.length; i++) {
                const nodeState = treeOf(state.childNodes[i]);
                nodeState.prev = state.childNodes[i - 1] || null;
                nodeState.next = state.childNodes[i + 1] || null;
            }
        },
        _setConnected: function(value) {
            treeOf(this).connected = value;
            for (const child of this.childNodes) child._setConnected(value);
        }
    };
    // Node 继承 EventTarget：addEventListener / removeEventListener / dispatchEvent 由 eventCore.js 提供
    Object.setPrototypeOf(Node.prototype, window.EventTarget.prototype);
    Object.setPrototypeOf(Node, window.EventTarget);
    // Node.prototype 是对象字面量，没有自己的 constructor，会继承到 EventTarget
    Object.defineProperty(Node.prototype, 'constructor', {
        value: Node, writable: true, enumerable: false, configurable: true
    });
    defineTreeGetters(Node.prototype, {
        nodeType: s => s.nodeType,
        nodeName: s => s.nodeName,
        isConnected: s => s.connected,
        ownerDocument: s => s.ownerDocument,
        parentNode: s => s.parent,
        parentElement: s => (s.parent && nodeStates.get(s.parent)?.nodeType === 1 ? s.parent : null),
        childNodes: s => s.childNodes,
        firstChild: s => s.first,
        lastChild: s => s.last,
        previousSibling: s => s.prev,
        nextSibling: s => s.next
    });

    // ==================== Element 基类 ====================
    function Element(tagName, namespaceURI) {
        Node.call(this);
        // tagName、attributes、style、classList 等由原型 getter 从内部状态读取
        initElementState(this, tagName, namespaceURI);

        // 存储
        __createdElements__.set(nodeIdOf(this), this);
    }
    
    Element.prototype = Object.create(Node.prototype);
    Element.prototype.constructor = Element;
    const parentNodeGetters = {
        children: s => s.children,
        firstElementChild: s => s.firstElement,
        lastElementChild: s => s.lastElement,
        childElementCount: s => s.children.length
    };
    defineTreeGetters(Element.prototype, parentNodeGetters);
    defineTreeGetters(Element.prototype, {
        previousElementSibling: s => s.prevElement,
        nextElementSibling: s => s.nextElement
    });
    // 没有布局引擎：尺寸类属性固定为 0，scrollTop / scrollLeft 可赋值
    defineTreeGetters(Element.prototype, {
        namespaceURI: s => s.namespaceURI,
        prefix: s => s.prefix,
        localName: s => s.localName,
        tagName: s => s.tagName,
        attributes: s => s.attributes,
        // [PutForwards=value]：赋值转写到 class 属性
        classList: { get: s => s.classList, set: (s, value, node) => node.setAttribute('class', String(value)) },
        scrollTop: { get: s => s.scrollTop, set: (s, value) => { s.scrollTop = Number(value) || 0; } },
        scrollLeft: { get: s => s.scrollLeft, set: (s, value) => { s.scrollLeft = Number(value) || 0; } },
        scrollWidth: () => 0,
        scrollHeight: () => 0,
        clientTop: () => 0,
        clientLeft: () => 0,
        clientWidth: () => 0,
        clientHeight: () => 0
    });

    function NodeList() { throw new TypeError('Illegal constructor'); }
    Object.defineProperty(NodeList.prototype, Symbol.toStringTag, { value: 'NodeList' });
    NodeList.prototype.item = function(index) { return this[index] || null; };
    NodeList.prototype.forEach = function(callback, thisArg) {
        for (let i = 0; i < this.length; i++) callback.call(thisArg, this[i], i, this);
    };
    NodeList.prototype[Symbol.iterator] = function*() {
        for (let i = 0; i < this.length; i++) yield this[i];
    };
    function staticNodeList(nodes) {
        const list = Object.create(NodeList.prototype);
        nodes.forEach((node, index) => Object.defineProperty(list, index,
            { value: node, enumerable: true, configurable: true }));
        Object.defineProperty(list, 'length', { value: nodes.length });
        return list;
    }
    window.NodeList = NodeList;

    function HTMLCollection() { throw new TypeError('Illegal constructor'); }
    Object.defineProperty(HTMLCollection.prototype, Symbol.toStringTag, { value: 'HTMLCollection' });
    HTMLCollection.prototype.item = function(index) { return this[index] || null; };
    HTMLCollection.prototype.namedItem = function(name) {
        for (const node of this) {
            if (node.id === String(name) || node.getAttribute('name') === String(name)) return node;
        }
        return null;
    };
    HTMLCollection.prototype[Symbol.iterator] = function*() {
        for (let i = 0; i < this.length; i++) yield this[i];
    };
    function liveCollection(resolve) {
        return new Proxy(Object.create(HTMLCollection.prototype), {
            get(target, key) {
                if (key === 'length') return resolve().length;
                if (typeof key === 'string' && /^(0|[1-9]\d*)$/.test(key)) return resolve()[Number(key)];
                if (typeof key === 'string' && !(key in target)) {
                    return resolve().find(node => node.id === key || node.getAttribute('name') === key);
                }
                return Reflect.get(target, key);
            },
            has(target, key) {
                return key === 'length' || (typeof key === 'string' &&
                    /^(0|[1-9]\d*)$/.test(key) && Number(key) < resolve().length) || key in target;
            },
            ownKeys(target) {
                return [...resolve().map((_, index) => String(index)), ...Reflect.ownKeys(target)];
            },
            getOwnPropertyDescriptor(target, key) {
                if (typeof key === 'string' && /^(0|[1-9]\d*)$/.test(key)) {
                    const node = resolve()[Number(key)];
                    if (node) return { value: node, writable: false, enumerable: true, configurable: true };
                }
                return Reflect.getOwnPropertyDescriptor(target, key);
            }
        });
    }
    window.HTMLCollection = HTMLCollection;

    function findElements(root, predicate, includeRoot = false) {
        const found = [];
        function visit(node) {
            if (node?.nodeType === 1 && predicate(node)) found.push(node);
            for (const child of node?.childNodes || []) visit(child);
        }
        if (includeRoot) visit(root);
        else for (const child of root?.childNodes || []) visit(child);
        return found;
    }
    function hasClasses(node, value) {
        const tokens = String(value).trim().split(/\s+/).filter(Boolean);
        return !!tokens.length && tokens.every(token => node.classList.contains(token));
    }

    function escapeText(value) {
        return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    }
    function serializeNode(node) {
        if (node.nodeType === 3) return escapeText(node.data);
        if (node.nodeType === 8) return `<!--${node.data}-->`;
        if (node.nodeType !== 1) return '';
        const attrs = node.getAttributeNames().map(name =>
            ` ${name}="${String(node.getAttribute(name)).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`).join('');
        const start = `<${node.localName}${attrs}>`;
        if (new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']).has(node.localName)) return start;
        return start + node.childNodes.map(serializeNode).join('') + `</${node.localName}>`;
    }
    Object.defineProperties(Element.prototype, {
        id: {
            get() { return treeOf(this).attrValues.id || ''; },
            set(value) { this.setAttribute('id', value); }, configurable: true, enumerable: true
        },
        className: {
            get() { return treeOf(this).attrValues.class || ''; },
            set(value) { this.setAttribute('class', value); }, configurable: true, enumerable: true
        },
        textContent: {
            get() { return this.childNodes.map(node => node.nodeType === 8 ? '' : node.textContent).join(''); },
            set(value) {
                while (this.firstChild) this.removeChild(this.firstChild);
                if (value != null && String(value)) this.appendChild(this.ownerDocument?.createTextNode(String(value)) || new Text(String(value)));
            }, configurable: true, enumerable: true
        },
        innerText: {
            get() { return this.textContent; },
            set(value) { this.textContent = String(value); },
            configurable: true, enumerable: true
        },
        innerHTML: {
            get() { return this.childNodes.map(serializeNode).join(''); },
            set(value) {
                const bridge = window.__htmlBridge__;
                if (!bridge) throw new Error('HTML parser is unavailable');
                this.replaceChildren(...bridge.parseFragment(String(value)).map(createParsedNode));
            }, configurable: true, enumerable: true
        },
        outerHTML: {
            get() { return serializeNode(this); },
            set(value) {
                if (!this.parentNode) return;
                const bridge = window.__htmlBridge__;
                if (!bridge) throw new Error('HTML parser is unavailable');
                const nodes = bridge.parseFragment(String(value)).map(createParsedNode);
                for (const node of nodes) this.parentNode.insertBefore(node, this);
                this.parentNode.removeChild(this);
            }, configurable: true, enumerable: true
        }
    });

    function createParsedNode(node) {
        if (node.type === 'text') return document.createTextNode(node.value);
        if (node.type === 'comment') return document.createComment(node.value);
        const element = document.createElement(node.name);
        for (const [name, value] of node.attributes) element.setAttribute(name, value);
        for (const child of node.children) element.appendChild(createParsedNode(child));
        // Initial form state reflects parsed attributes; later value/checked changes are
        // independent of the HTML attributes, as they are in browser form controls.
        if (node.name === 'input') {
            element.value = element.defaultValue = element.getAttribute('value') || '';
            element.checked = element.defaultChecked = element.hasAttribute('checked');
        } else if (node.name === 'textarea') {
            element.value = element.defaultValue = element.textContent;
        }
        for (const attribute of ['name', 'type', 'placeholder', 'alt', 'rel', 'target']) {
            const value = element.getAttribute(attribute);
            if (value !== null && attribute in element) element[attribute] = value;
        }
        return element;
    }

    function reflectURL(element, property, attribute) {
        const prototype = Object.getPrototypeOf(element);
        delete element[property];
        // 与浏览器一致：URL 反射属性定义在原型上，实例不留自有属性（覆盖构造时提升的同名访问器）
        Object.defineProperty(prototype, property, {
            configurable: true, enumerable: true,
            get() {
                const raw = this.getAttribute(attribute);
                return raw === null ? '' : new URL(raw, this.ownerDocument?.baseURI || location.href).href;
            },
            set(value) { this.setAttribute(attribute, String(value)); }
        });
    }
    
    // 属性操作
    Element.prototype.getAttribute = function(name) {
        Monitor.log('Attribute', 'getAttribute', {
            elementId: nodeIdOf(this),
            tagName: this.tagName,
            name: name,
            value: treeOf(this).attrValues[name]
        });
        return treeOf(this).attrValues[name] !== undefined ? treeOf(this).attrValues[name] : null;
    };
    
    Element.prototype.setAttribute = function(name, value) {
        const strValue = String(value);
        const oldValue = treeOf(this).attrValues[name] ?? null;
        treeOf(this).attrValues[name] = strValue;
        this.attributes.setNamedItem(new Attr(name, strValue, this));
        
        if (name === 'class') {
            this.classList._tokens = strValue.split(/\s+/).filter(Boolean);
        }
        if (name === 'style') {
            // cssText 会回写 style 属性，这次变更已由 setAttribute 自己上报
            styleRecordSuppressed = true;
            try { this.style.cssText = strValue; } finally { styleRecordSuppressed = false; }
        }
        notifyMutation('attributes', this, { attributeName: name, oldValue });
        
        Monitor.log('Attribute', 'setAttribute', {
            elementId: nodeIdOf(this),
            tagName: this.tagName,
            name: name,
            value: strValue
        });
    };
    
    Element.prototype.removeAttribute = function(name) {
        const existed = name in treeOf(this).attrValues;
        const oldValue = existed ? treeOf(this).attrValues[name] : null;
        delete treeOf(this).attrValues[name];
        this.attributes.removeNamedItem(name);
        if (name === 'class') this.classList._tokens = [];
        if (name === 'style') {
            this.style._styles = {};
            this.style._importantStyles = {};
        }
        
        if (existed) notifyMutation('attributes', this, { attributeName: name, oldValue });
        
        Monitor.log('Attribute', 'removeAttribute', {
            elementId: nodeIdOf(this),
            tagName: this.tagName,
            name: name
        });
    };
    
    Element.prototype.hasAttribute = function(name) { return name in treeOf(this).attrValues; };
    Element.prototype.hasAttributes = function() { return Object.keys(treeOf(this).attrValues).length > 0; };
    Element.prototype.getAttributeNames = function() { return Object.keys(treeOf(this).attrValues); };
    Element.prototype.toggleAttribute = function(name, force) {
        if (force !== undefined) {
            if (force) { this.setAttribute(name, ''); return true; }
            else { this.removeAttribute(name); return false; }
        }
        if (this.hasAttribute(name)) { this.removeAttribute(name); return false; }
        this.setAttribute(name, ''); return true;
    };
    
    // 子元素更新
    Element.prototype._updateChildReferences = function() {
        Node.prototype._updateChildReferences.call(this);
        const state = treeOf(this);
        const elements = state.childNodes.filter(n => n.nodeType === 1);
        state.children = elements;
        state.firstElement = elements[0] || null;
        state.lastElement = elements[elements.length - 1] || null;

        for (let i = 0; i < elements.length; i++) {
            const elementState = treeOf(elements[i]);
            elementState.prevElement = elements[i - 1] || null;
            elementState.nextElement = elements[i + 1] || null;
        }
    };
    
    // DOM 操作
    Element.prototype.append = function(...nodes) {
        nodes.forEach(node => {
            if (typeof node === 'string') {
                this.appendChild(new Text(node));
            } else {
                this.appendChild(node);
            }
        });
    };
    
    Element.prototype.prepend = function(...nodes) {
        const first = this.firstChild;
        nodes.forEach(node => {
            if (typeof node === 'string') {
                this.insertBefore(new Text(node), first);
            } else {
                this.insertBefore(node, first);
            }
        });
    };
    
    Element.prototype.after = function(...nodes) {
        const parent = this.parentNode;
        if (!parent) return;
        const next = this.nextSibling;
        nodes.forEach(node => {
            if (typeof node === 'string') {
                parent.insertBefore(new Text(node), next);
            } else {
                parent.insertBefore(node, next);
            }
        });
    };
    
    Element.prototype.before = function(...nodes) {
        const parent = this.parentNode;
        if (!parent) return;
        nodes.forEach(node => {
            if (typeof node === 'string') {
                parent.insertBefore(new Text(node), this);
            } else {
                parent.insertBefore(node, this);
            }
        });
    };
    
    Element.prototype.remove = function() {
        if (this.parentNode) this.parentNode.removeChild(this);
    };
    
    Element.prototype.replaceWith = function(...nodes) {
        const parent = this.parentNode;
        if (!parent) return;
        const next = this.nextSibling;
        parent.removeChild(this);
        nodes.forEach(node => {
            if (typeof node === 'string') {
                parent.insertBefore(new Text(node), next);
            } else {
                parent.insertBefore(node, next);
            }
        });
    };
    Element.prototype.replaceChildren = function(...nodes) {
        while (this.firstChild) this.removeChild(this.firstChild);
        this.append(...nodes);
    };
    
    // 查询
    Element.prototype.querySelector = function(selector) {
        Monitor.log('DOM', 'querySelector', { elementId: nodeIdOf(this), selector });
        
        const mock = Monitor.executeMock('element.querySelector', [selector], this);
        if (mock.mocked) return mock.result;
        
        return window.__htmlBridge__?.select(this, selector)[0] || null;
    };
    
    Element.prototype.querySelectorAll = function(selector) {
        Monitor.log('DOM', 'querySelectorAll', { elementId: nodeIdOf(this), selector });
        
        const mock = Monitor.executeMock('element.querySelectorAll', [selector], this);
        if (mock.mocked) return mock.result;
        
        return staticNodeList(window.__htmlBridge__?.select(this, selector) || []);
    };
    
    Element.prototype.getElementsByTagName = function(tagName) {
        Monitor.log('DOM', 'getElementsByTagName', { elementId: nodeIdOf(this), tagName });
        return liveCollection(() => window.__htmlBridge__?.select(this, String(tagName)) || []);
    };
    
    Element.prototype.getElementsByClassName = function(className) {
        Monitor.log('DOM', 'getElementsByClassName', { elementId: nodeIdOf(this), className });
        return liveCollection(() => findElements(this, node => hasClasses(node, className)));
    };
    
    Element.prototype.closest = function(selector) {
        Monitor.log('DOM', 'closest', { elementId: nodeIdOf(this), selector });
        for (let node = this; node?.nodeType === 1; node = node.parentElement) {
            if (node.matches(selector)) return node;
        }
        return null;
    };
    
    Element.prototype.matches = function(selector) {
        Monitor.log('DOM', 'matches', { elementId: nodeIdOf(this), selector });
        return window.__htmlBridge__?.matches(this, selector) || false;
    };
    
    // 几何相关
    Element.prototype.getBoundingClientRect = function() {
        Monitor.log('DOM', 'getBoundingClientRect', { elementId: nodeIdOf(this) });
        
        const mock = Monitor.executeMock('element.getBoundingClientRect', [], this);
        if (mock.mocked) return mock.result;
        
        return new DOMRect(0, 0, this.offsetWidth || 100, this.offsetHeight || 100);
    };
    
    Element.prototype.getClientRects = function() {
        Monitor.log('DOM', 'getClientRects', { elementId: nodeIdOf(this) });
        return [this.getBoundingClientRect()];
    };
    
    Element.prototype.scrollIntoView = function(options) {
        Monitor.log('DOM', 'scrollIntoView', { elementId: nodeIdOf(this), options });
    };
    
    Element.prototype.scroll = function(x, y) { this.scrollTop = y; this.scrollLeft = x; };
    Element.prototype.scrollTo = Element.prototype.scroll;
    Element.prototype.scrollBy = function(x, y) { this.scrollTop += y; this.scrollLeft += x; };
    
    // 焦点
    Element.prototype.focus = function(options) {
        Monitor.log('DOM', 'focus', { elementId: nodeIdOf(this) });
    };
    Element.prototype.blur = function() {
        Monitor.log('DOM', 'blur', { elementId: nodeIdOf(this) });
    };
    Element.prototype.click = function() {
        Monitor.log('DOM', 'click', { elementId: nodeIdOf(this) });
        this.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
    };
    
    // addEventListener / removeEventListener / dispatchEvent 继承自 EventTarget.prototype（eventCore.js）
    
    // 其他
    Element.prototype.insertAdjacentHTML = function(position, html) {
        Monitor.log('DOM', 'insertAdjacentHTML', { elementId: nodeIdOf(this), position, html: html?.substring(0, 100) });
        const bridge = window.__htmlBridge__;
        if (!bridge) throw new Error('HTML parser is unavailable');
        const nodes = bridge.parseFragment(String(html)).map(createParsedNode);
        const where = String(position).toLowerCase();
        if (where === 'beforebegin' || where === 'afterend') {
            if (!this.parentNode) return;
            for (const node of nodes) this.parentNode.insertBefore(node,
                where === 'beforebegin' ? this : this.nextSibling);
        } else if (where === 'afterbegin') {
            const first = this.firstChild;
            for (const node of nodes) this.insertBefore(node, first);
        } else if (where === 'beforeend') {
            for (const node of nodes) this.appendChild(node);
        } else {
            throw new DOMException('Invalid position', 'SyntaxError');
        }
    };
    Element.prototype.insertAdjacentElement = function(position, element) {
        Monitor.log('DOM', 'insertAdjacentElement', { elementId: nodeIdOf(this), position });
        const where = String(position).toLowerCase();
        if (where === 'beforebegin' || where === 'afterend') {
            if (!this.parentNode) return null;
            this.parentNode.insertBefore(element, where === 'beforebegin' ? this : this.nextSibling);
        } else if (where === 'afterbegin') {
            this.insertBefore(element, this.firstChild);
        } else if (where === 'beforeend') {
            this.appendChild(element);
        } else {
            throw new DOMException('Invalid position', 'SyntaxError');
        }
        return element;
    };
    Element.prototype.insertAdjacentText = function(position, text) {
        Monitor.log('DOM', 'insertAdjacentText', { elementId: nodeIdOf(this), position });
        this.insertAdjacentElement(position, this.ownerDocument.createTextNode(String(text)));
    };
    Element.prototype.attachShadow = function(options) {
        Monitor.log('DOM', 'attachShadow', { elementId: nodeIdOf(this), options });
        return { mode: options?.mode || 'open', host: this };
    };
    Element.prototype.animate = function(keyframes, options) {
        Monitor.log('DOM', 'animate', { elementId: nodeIdOf(this) });
        return { cancel: function() {}, play: function() {}, pause: function() {} };
    };
    Element.prototype.getAnimations = function() { return []; };
    Element.prototype.requestFullscreen = function() { return Promise.resolve(); };
    
    // ==================== HTMLElement ====================
    function HTMLElement(tagName) {
        Element.call(this, tagName || 'div');
        // title、lang、hidden、onclick 等是原型访问器（htmlElementAttributes.js）
    }
    HTMLElement.prototype = Object.create(Element.prototype);
    HTMLElement.prototype.constructor = HTMLElement;
    window.__htmlElementAttributes__.define(HTMLElement.prototype);
    // style / dataset 属于 HTMLElement 与 SVGElement（ElementCSSInlineStyle、HTMLOrSVGElement），elements.js 会复制到它的原型上
    defineTreeGetters(HTMLElement.prototype, {
        // [PutForwards=cssText]
        style: { get: s => s.style, set: (s, value) => { s.style.cssText = String(value); } },
        dataset: s => s.dataset,
        offsetParent: () => null,
        offsetTop: () => 0,
        offsetLeft: () => 0,
        offsetWidth: () => 0,
        offsetHeight: () => 0
    });

    // ==================== 具体 HTML 元素类型 ====================
    
    // HTMLDivElement
    function HTMLDivElement() {
        HTMLElement.call(this, 'div');
        this.align = '';
    }
    HTMLDivElement.prototype = Object.create(HTMLElement.prototype);
    HTMLDivElement.prototype.constructor = HTMLDivElement;
    
    // HTMLSpanElement
    function HTMLSpanElement() {
        HTMLElement.call(this, 'span');
    }
    HTMLSpanElement.prototype = Object.create(HTMLElement.prototype);
    HTMLSpanElement.prototype.constructor = HTMLSpanElement;
    
    // HTMLParagraphElement
    function HTMLParagraphElement() {
        HTMLElement.call(this, 'p');
        this.align = '';
    }
    HTMLParagraphElement.prototype = Object.create(HTMLElement.prototype);
    HTMLParagraphElement.prototype.constructor = HTMLParagraphElement;
    
    // HTMLHeadingElement (h1-h6)
    function HTMLHeadingElement(level) {
        HTMLElement.call(this, 'h' + (level || 1));
        this.align = '';
    }
    HTMLHeadingElement.prototype = Object.create(HTMLElement.prototype);
    HTMLHeadingElement.prototype.constructor = HTMLHeadingElement;
    
    // HTMLBRElement
    function HTMLBRElement() {
        HTMLElement.call(this, 'br');
        this.clear = '';
    }
    HTMLBRElement.prototype = Object.create(HTMLElement.prototype);
    HTMLBRElement.prototype.constructor = HTMLBRElement;
    
    // HTMLHRElement
    function HTMLHRElement() {
        HTMLElement.call(this, 'hr');
        this.align = '';
        this.color = '';
        this.noShade = false;
        this.size = '';
        this.width = '';
    }
    HTMLHRElement.prototype = Object.create(HTMLElement.prototype);
    HTMLHRElement.prototype.constructor = HTMLHRElement;
    
    // HTMLPreElement
    function HTMLPreElement() {
        HTMLElement.call(this, 'pre');
        this.width = 0;
    }
    HTMLPreElement.prototype = Object.create(HTMLElement.prototype);
    HTMLPreElement.prototype.constructor = HTMLPreElement;
    
    // HTMLScriptElement
    function HTMLScriptElement() {
        HTMLElement.call(this, 'script');
        this.src = '';
        this.type = '';
        this.charset = '';
        this.async = false;
        this.defer = false;
        this.crossOrigin = null;
        this.text = '';
        this.noModule = false;
        this.integrity = '';
        this.referrerPolicy = '';
    }
    HTMLScriptElement.prototype = Object.create(HTMLElement.prototype);
    HTMLScriptElement.prototype.constructor = HTMLScriptElement;
    
    // HTMLCanvasElement
    function HTMLCanvasElement() {
        HTMLElement.call(this, 'canvas');
        this.width = 300;
        this.height = 150;
        this._contexts = {};
    }
    HTMLCanvasElement.prototype = Object.create(HTMLElement.prototype);
    HTMLCanvasElement.prototype.constructor = HTMLCanvasElement;
    
    HTMLCanvasElement.prototype.getContext = function(contextType, contextAttributes) {
        Monitor.pushChain('canvas.getContext');
        Monitor.log('Canvas', 'getContext', {
            elementId: nodeIdOf(this),
            contextType: contextType,
            attributes: contextAttributes
        });
        
        // 检查 mock
        const mock = Monitor.executeMock('canvas.getContext', [contextType, contextAttributes], this);
        if (mock.mocked) {
            Monitor.popChain();
            return mock.result;
        }
        
        if (this._contexts[contextType]) {
            Monitor.popChain();
            return this._contexts[contextType];
        }
        
        let ctx;
        if (contextType === '2d') {
            ctx = new CanvasRenderingContext2D(this);
        } else if (contextType === 'webgl' || contextType === 'webgl2' || contextType === 'experimental-webgl') {
            // WebGL 由 webgl.js 提供；此处是 elements.js 缺失时的兜底路径
            const internals = window.__webglInternals__;
            ctx = internals ? internals.createContext(this, contextType === 'webgl2' ? 'webgl2' : 'webgl') : null;
        } else {
            ctx = null;
        }
        
        this._contexts[contextType] = ctx;
        Monitor.popChain();
        return ctx;
    };
    
    HTMLCanvasElement.prototype.toDataURL = function(type, quality) {
        Monitor.log('Canvas', 'toDataURL', { elementId: nodeIdOf(this), type, quality });
        
        const mock = Monitor.executeMock('canvas.toDataURL', [type, quality], this);
        if (mock.mocked) return mock.result;
        const configured = window.__profile__?.canvas?.toDataURL;
        if (typeof configured === 'string' && (!type || type === 'image/png')) return configured;
        
        return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    };
    
    HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) {
        Monitor.log('Canvas', 'toBlob', { elementId: nodeIdOf(this), type, quality });
        if (callback) {
            setTimeout(() => callback(new Blob([''], { type: type || 'image/png' })), 0);
        }
    };
    
    HTMLCanvasElement.prototype.captureStream = function(frameRate) {
        Monitor.log('Canvas', 'captureStream', { elementId: nodeIdOf(this), frameRate });
        return { getTracks: () => [], getVideoTracks: () => [], getAudioTracks: () => [] };
    };
    
    HTMLCanvasElement.prototype.transferControlToOffscreen = function() {
        Monitor.log('Canvas', 'transferControlToOffscreen', { elementId: nodeIdOf(this) });
        return new OffscreenCanvas(this.width, this.height);
    };
    
    // OffscreenCanvas
    function OffscreenCanvas(width, height) {
        this.width = width || 300;
        this.height = height || 150;
        this._contexts = {};
    }
    OffscreenCanvas.prototype.getContext = function(type, attrs) {
        Monitor.log('OffscreenCanvas', 'getContext', { type });
        if (type === '2d') {
            return new CanvasRenderingContext2D({ width: this.width, height: this.height });
        }
        return null;
    };
    OffscreenCanvas.prototype.convertToBlob = function(options) {
        return Promise.resolve(new Blob([''], { type: options?.type || 'image/png' }));
    };
    OffscreenCanvas.prototype.transferToImageBitmap = function() {
        return { width: this.width, height: this.height, close: function() {} };
    };
    window.OffscreenCanvas = OffscreenCanvas;
    
    // CanvasRenderingContext2D
    function CanvasRenderingContext2D(canvas) {
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
        this.shadowBlur = 0;
        this.shadowColor = 'rgba(0, 0, 0, 0)';
        this.shadowOffsetX = 0;
        this.shadowOffsetY = 0;
        this.imageSmoothingEnabled = true;
        this.imageSmoothingQuality = 'low';
        this.filter = 'none';
        
        this._stack = [];
    }
    
    CanvasRenderingContext2D.prototype = {
        // 路径
        beginPath: function() { Monitor.log('Canvas2D', 'beginPath', {}); },
        closePath: function() { Monitor.log('Canvas2D', 'closePath', {}); },
        moveTo: function(x, y) { Monitor.log('Canvas2D', 'moveTo', { x, y }); },
        lineTo: function(x, y) { Monitor.log('Canvas2D', 'lineTo', { x, y }); },
        bezierCurveTo: function(cp1x, cp1y, cp2x, cp2y, x, y) {},
        quadraticCurveTo: function(cpx, cpy, x, y) {},
        arc: function(x, y, radius, startAngle, endAngle, anticlockwise) {},
        arcTo: function(x1, y1, x2, y2, radius) {},
        ellipse: function(x, y, radiusX, radiusY, rotation, startAngle, endAngle, anticlockwise) {},
        rect: function(x, y, width, height) {},
        roundRect: function(x, y, w, h, radii) {},
        
        // 绘制
        fill: function(fillRule) { Monitor.log('Canvas2D', 'fill', { fillRule }); },
        stroke: function() { Monitor.log('Canvas2D', 'stroke', {}); },
        clip: function(fillRule) {},
        isPointInPath: function(x, y, fillRule) { return false; },
        isPointInStroke: function(x, y) { return false; },
        
        // 矩形
        fillRect: function(x, y, width, height) {
            Monitor.log('Canvas2D', 'fillRect', { x, y, width, height });
        },
        strokeRect: function(x, y, width, height) {
            Monitor.log('Canvas2D', 'strokeRect', { x, y, width, height });
        },
        clearRect: function(x, y, width, height) {
            Monitor.log('Canvas2D', 'clearRect', { x, y, width, height });
        },
        
        // 文本
        fillText: function(text, x, y, maxWidth) {
            Monitor.log('Canvas2D', 'fillText', { text, x, y, maxWidth });
        },
        strokeText: function(text, x, y, maxWidth) {
            Monitor.log('Canvas2D', 'strokeText', { text, x, y, maxWidth });
        },
        measureText: function(text) {
            Monitor.log('Canvas2D', 'measureText', { text });
            return {
                width: text.length * 10,
                actualBoundingBoxLeft: 0,
                actualBoundingBoxRight: text.length * 10,
                actualBoundingBoxAscent: 10,
                actualBoundingBoxDescent: 2,
                fontBoundingBoxAscent: 12,
                fontBoundingBoxDescent: 3,
                emHeightAscent: 10,
                emHeightDescent: 2,
                hangingBaseline: 9,
                alphabeticBaseline: 0,
                ideographicBaseline: -2
            };
        },
        
        // 图像
        drawImage: function(image, ...args) {
            Monitor.log('Canvas2D', 'drawImage', { args });
        },
        createImageData: function(width, height) {
            const data = new Uint8ClampedArray(width * height * 4);
            return { width, height, data, colorSpace: 'srgb' };
        },
        getImageData: function(x, y, width, height, settings) {
            Monitor.log('Canvas2D', 'getImageData', { x, y, width, height });
            
            const mock = Monitor.executeMock('canvas2d.getImageData', [x, y, width, height], this);
            if (mock.mocked) return mock.result;
            
            const data = new Uint8ClampedArray(width * height * 4);
            return { width, height, data, colorSpace: 'srgb' };
        },
        putImageData: function(imageData, dx, dy, ...args) {
            Monitor.log('Canvas2D', 'putImageData', { dx, dy });
        },
        
        // 渐变和图案
        createLinearGradient: function(x0, y0, x1, y1) {
            return {
                addColorStop: function(offset, color) {}
            };
        },
        createRadialGradient: function(x0, y0, r0, x1, y1, r1) {
            return {
                addColorStop: function(offset, color) {}
            };
        },
        createConicGradient: function(startAngle, x, y) {
            return {
                addColorStop: function(offset, color) {}
            };
        },
        createPattern: function(image, repetition) { return {}; },
        
        // 变换
        scale: function(x, y) {},
        rotate: function(angle) {},
        translate: function(x, y) {},
        transform: function(a, b, c, d, e, f) {},
        setTransform: function(a, b, c, d, e, f) {},
        getTransform: function() {
            return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
        },
        resetTransform: function() {},
        
        // 状态
        save: function() { this._stack.push({}); },
        restore: function() { this._stack.pop(); },
        reset: function() {},
        
        // 其他
        setLineDash: function(segments) {},
        getLineDash: function() { return []; },
        createPath2D: function() { return new Path2D(); }
    };
    window.CanvasRenderingContext2D = CanvasRenderingContext2D;
    
    // Path2D
    function Path2D(path) {
        this._path = path || '';
    }
    Path2D.prototype = {
        addPath: function(path, transform) {},
        closePath: function() {},
        moveTo: function(x, y) {},
        lineTo: function(x, y) {},
        bezierCurveTo: function(cp1x, cp1y, cp2x, cp2y, x, y) {},
        quadraticCurveTo: function(cpx, cpy, x, y) {},
        arc: function(x, y, radius, startAngle, endAngle, anticlockwise) {},
        arcTo: function(x1, y1, x2, y2, radius) {},
        ellipse: function(x, y, radiusX, radiusY, rotation, startAngle, endAngle, anticlockwise) {},
        rect: function(x, y, width, height) {},
        roundRect: function(x, y, w, h, radii) {}
    };
    window.Path2D = Path2D;
    
    // HTMLImageElement
    function HTMLImageElement() {
        HTMLElement.call(this, 'img');
        this.src = '';
        this.alt = '';
        this.srcset = '';
        this.sizes = '';
        this.crossOrigin = null;
        this.useMap = '';
        this.isMap = false;
        this.width = 0;
        this.height = 0;
        this.naturalWidth = 0;
        this.naturalHeight = 0;
        this.complete = false;
        this.currentSrc = '';
        this.referrerPolicy = '';
        this.decoding = 'auto';
        this.loading = 'eager';
        this.fetchPriority = 'auto';
        
        // 模拟图片加载
        const self = this;
        Object.defineProperty(this, 'src', {
            get: function() { return this._src || ''; },
            set: function(val) {
                this._src = val;
                this.currentSrc = val;
                Monitor.log('Image', 'setSrc', { elementId: nodeIdOf(self), src: val });
                // 模拟异步加载完成
                setTimeout(() => {
                    self.complete = true;
                    self.naturalWidth = 100;
                    self.naturalHeight = 100;
                    if (self.onload) self.onload.call(self, new Event('load'));
                }, 0);
            }
        });
    }
    HTMLImageElement.prototype = Object.create(HTMLElement.prototype);
    HTMLImageElement.prototype.constructor = HTMLImageElement;
    HTMLImageElement.prototype.decode = function() {
        Monitor.log('Image', 'decode', { elementId: nodeIdOf(this) });
        return Promise.resolve();
    };
    
    // Image 构造函数
    window.Image = function(width, height) {
        const img = new HTMLImageElement();
        if (width !== undefined) img.width = width;
        if (height !== undefined) img.height = height;
        return img;
    };
    
    // HTMLInputElement
    function HTMLInputElement() {
        HTMLElement.call(this, 'input');
        this.type = 'text';
        this.value = '';
        this.defaultValue = '';
        this.checked = false;
        this.defaultChecked = false;
        this.name = '';
        this.disabled = false;
        this.readOnly = false;
        this.required = false;
        this.placeholder = '';
        this.autocomplete = '';
        this.autofocus = false;
        this.min = '';
        this.max = '';
        this.step = '';
        this.pattern = '';
        this.size = 20;
        this.maxLength = -1;
        this.minLength = -1;
        this.multiple = false;
        this.files = null;
        this.form = null;
        this.accept = '';
        this.capture = '';
        this.src = '';
        this.alt = '';
        this.width = 0;
        this.height = 0;
        this.indeterminate = false;
        this.list = null;
        this.validity = {
            valid: true, valueMissing: false, typeMismatch: false,
            patternMismatch: false, tooLong: false, tooShort: false,
            rangeUnderflow: false, rangeOverflow: false, stepMismatch: false,
            badInput: false, customError: false
        };
        this.validationMessage = '';
        this.willValidate = true;
        this.selectionStart = 0;
        this.selectionEnd = 0;
        this.selectionDirection = 'forward';
    }
    HTMLInputElement.prototype = Object.create(HTMLElement.prototype);
    HTMLInputElement.prototype.constructor = HTMLInputElement;
    HTMLInputElement.prototype.select = function() {};
    HTMLInputElement.prototype.setSelectionRange = function(start, end, direction) {
        this.selectionStart = start;
        this.selectionEnd = end;
        this.selectionDirection = direction || 'none';
    };
    HTMLInputElement.prototype.setRangeText = function(replacement, start, end, selectMode) {};
    HTMLInputElement.prototype.stepUp = function(n) {};
    HTMLInputElement.prototype.stepDown = function(n) {};
    HTMLInputElement.prototype.checkValidity = function() { return this.validity.valid; };
    HTMLInputElement.prototype.reportValidity = function() { return this.validity.valid; };
    HTMLInputElement.prototype.setCustomValidity = function(message) {
        this.validationMessage = message;
        this.validity.customError = !!message;
        this.validity.valid = !message;
    };
    
    // HTMLButtonElement
    function HTMLButtonElement() {
        HTMLElement.call(this, 'button');
        this.type = 'submit';
        this.value = '';
        this.name = '';
        this.disabled = false;
        this.autofocus = false;
        this.form = null;
        this.formAction = '';
        this.formEnctype = '';
        this.formMethod = '';
        this.formNoValidate = false;
        this.formTarget = '';
        this.validity = { valid: true };
        this.validationMessage = '';
        this.willValidate = true;
        this.labels = [];
    }
    HTMLButtonElement.prototype = Object.create(HTMLElement.prototype);
    HTMLButtonElement.prototype.constructor = HTMLButtonElement;
    HTMLButtonElement.prototype.checkValidity = function() { return true; };
    HTMLButtonElement.prototype.reportValidity = function() { return true; };
    HTMLButtonElement.prototype.setCustomValidity = function(message) {};
    
    // HTMLTextAreaElement
    function HTMLTextAreaElement() {
        HTMLElement.call(this, 'textarea');
        this.value = '';
        this.defaultValue = '';
        this.name = '';
        this.disabled = false;
        this.readOnly = false;
        this.required = false;
        this.placeholder = '';
        this.autocomplete = '';
        this.autofocus = false;
        this.cols = 20;
        this.rows = 2;
        this.wrap = 'soft';
        this.maxLength = -1;
        this.minLength = -1;
        this.form = null;
        this.textLength = 0;
        this.validity = { valid: true };
        this.validationMessage = '';
        this.willValidate = true;
        this.selectionStart = 0;
        this.selectionEnd = 0;
        this.selectionDirection = 'forward';
    }
    HTMLTextAreaElement.prototype = Object.create(HTMLElement.prototype);
    HTMLTextAreaElement.prototype.constructor = HTMLTextAreaElement;
    HTMLTextAreaElement.prototype.select = function() {};
    HTMLTextAreaElement.prototype.setSelectionRange = function(start, end, direction) {
        this.selectionStart = start;
        this.selectionEnd = end;
        this.selectionDirection = direction || 'none';
    };
    HTMLTextAreaElement.prototype.setRangeText = function(replacement, start, end, selectMode) {};
    HTMLTextAreaElement.prototype.checkValidity = function() { return true; };
    HTMLTextAreaElement.prototype.reportValidity = function() { return true; };
    HTMLTextAreaElement.prototype.setCustomValidity = function(message) {};
    
    // HTMLSelectElement
    function HTMLSelectElement() {
        HTMLElement.call(this, 'select');
        this.name = '';
        this.value = '';
        this.disabled = false;
        this.required = false;
        this.autofocus = false;
        this.multiple = false;
        this.size = 0;
        this.form = null;
        this.options = [];
        this.selectedOptions = [];
        this.selectedIndex = -1;
        this.length = 0;
        this.type = 'select-one';
        this.validity = { valid: true };
        this.validationMessage = '';
        this.willValidate = true;
        this.labels = [];
    }
    HTMLSelectElement.prototype = Object.create(HTMLElement.prototype);
    HTMLSelectElement.prototype.constructor = HTMLSelectElement;
    HTMLSelectElement.prototype.add = function(element, before) {};
    HTMLSelectElement.prototype.remove = function(index) {};
    HTMLSelectElement.prototype.item = function(index) { return this.options[index] || null; };
    HTMLSelectElement.prototype.namedItem = function(name) { return null; };
    HTMLSelectElement.prototype.checkValidity = function() { return true; };
    HTMLSelectElement.prototype.reportValidity = function() { return true; };
    HTMLSelectElement.prototype.setCustomValidity = function(message) {};
    
    // HTMLOptionElement
    function HTMLOptionElement() {
        HTMLElement.call(this, 'option');
        this.value = '';
        this.text = '';
        this.label = '';
        this.disabled = false;
        this.defaultSelected = false;
        this.selected = false;
        this.index = 0;
        this.form = null;
    }
    HTMLOptionElement.prototype = Object.create(HTMLElement.prototype);
    HTMLOptionElement.prototype.constructor = HTMLOptionElement;
    
    // Option 构造函数
    window.Option = function(text, value, defaultSelected, selected) {
        const opt = new HTMLOptionElement();
        if (text !== undefined) opt.text = text;
        if (value !== undefined) opt.value = value;
        if (defaultSelected !== undefined) opt.defaultSelected = defaultSelected;
        if (selected !== undefined) opt.selected = selected;
        return opt;
    };
    
    // HTMLAnchorElement
    function HTMLAnchorElement() {
        HTMLElement.call(this, 'a');
        this.href = '';
        this.target = '';
        this.rel = '';
        this.download = '';
        this.hreflang = '';
        this.type = '';
        this.text = '';
        this.referrerPolicy = '';
        this.origin = '';
        this.protocol = '';
        this.host = '';
        this.hostname = '';
        this.port = '';
        this.pathname = '';
        this.search = '';
        this.hash = '';
        this.ping = '';
    }
    HTMLAnchorElement.prototype = Object.create(HTMLElement.prototype);
    HTMLAnchorElement.prototype.constructor = HTMLAnchorElement;
    HTMLAnchorElement.prototype.toString = function() { return this.href; };
    
    // HTMLFormElement
    function HTMLFormElement() {
        HTMLElement.call(this, 'form');
        this.action = '';
        this.method = 'get';
        this.enctype = 'application/x-www-form-urlencoded';
        this.encoding = 'application/x-www-form-urlencoded';
        this.target = '';
        this.acceptCharset = '';
        this.autocomplete = 'on';
        this.noValidate = false;
        this.name = '';
        this.elements = [];
        this.length = 0;
    }
    HTMLFormElement.prototype = Object.create(HTMLElement.prototype);
    HTMLFormElement.prototype.constructor = HTMLFormElement;
    HTMLFormElement.prototype.submit = function() {
        Monitor.log('Form', 'submit', { elementId: nodeIdOf(this), action: this.action });
    };
    HTMLFormElement.prototype.reset = function() {
        Monitor.log('Form', 'reset', { elementId: nodeIdOf(this) });
    };
    HTMLFormElement.prototype.requestSubmit = function(submitter) {
        this.submit();
    };
    HTMLFormElement.prototype.checkValidity = function() { return true; };
    HTMLFormElement.prototype.reportValidity = function() { return true; };
    
    // HTMLIFrameElement
    function HTMLIFrameElement() {
        HTMLElement.call(this, 'iframe');
        this.src = '';
        this.srcdoc = '';
        this.name = '';
        this.sandbox = '';
        this.allow = '';
        this.allowFullscreen = false;
        this.width = '';
        this.height = '';
        this.referrerPolicy = '';
        this.loading = 'eager';
        this.contentDocument = null;
        this.contentWindow = null;
    }
    HTMLIFrameElement.prototype = Object.create(HTMLElement.prototype);
    HTMLIFrameElement.prototype.constructor = HTMLIFrameElement;
    
    // HTMLVideoElement
    function HTMLVideoElement() {
        HTMLElement.call(this, 'video');
        this.src = '';
        this.currentSrc = '';
        this.poster = '';
        this.width = 0;
        this.height = 0;
        this.videoWidth = 0;
        this.videoHeight = 0;
        this.autoplay = false;
        this.controls = false;
        this.loop = false;
        this.muted = false;
        this.defaultMuted = false;
        this.preload = 'auto';
        this.currentTime = 0;
        this.duration = NaN;
        this.paused = true;
        this.ended = false;
        this.volume = 1;
        this.playbackRate = 1;
        this.defaultPlaybackRate = 1;
        this.readyState = 0;
        this.networkState = 0;
        this.buffered = { length: 0, start: () => 0, end: () => 0 };
        this.played = { length: 0, start: () => 0, end: () => 0 };
        this.seekable = { length: 0, start: () => 0, end: () => 0 };
        this.seeking = false;
        this.error = null;
        this.crossOrigin = null;
        this.playsInline = false;
        this.disablePictureInPicture = false;
        this.textTracks = [];
        this.mediaKeys = null;
    }
    HTMLVideoElement.prototype = Object.create(HTMLElement.prototype);
    HTMLVideoElement.prototype.constructor = HTMLVideoElement;
    HTMLVideoElement.prototype.play = function() {
        Monitor.log('Video', 'play', { elementId: nodeIdOf(this) });
        this.paused = false;
        return Promise.resolve();
    };
    HTMLVideoElement.prototype.pause = function() {
        Monitor.log('Video', 'pause', { elementId: nodeIdOf(this) });
        this.paused = true;
    };
    HTMLVideoElement.prototype.load = function() {
        Monitor.log('Video', 'load', { elementId: nodeIdOf(this) });
    };
    HTMLVideoElement.prototype.canPlayType = function(type) {
        Monitor.log('Video', 'canPlayType', { type });
        return 'maybe';
    };
    HTMLVideoElement.prototype.captureStream = function() {
        return { getTracks: () => [], getVideoTracks: () => [], getAudioTracks: () => [] };
    };
    HTMLVideoElement.prototype.requestPictureInPicture = function() {
        return Promise.resolve({});
    };
    HTMLVideoElement.prototype.getVideoPlaybackQuality = function() {
        return { creationTime: 0, totalVideoFrames: 0, droppedVideoFrames: 0 };
    };
    HTMLVideoElement.prototype.addTextTrack = function(kind, label, language) {
        return { kind, label, language };
    };
    HTMLVideoElement.prototype.setMediaKeys = function(mediaKeys) {
        this.mediaKeys = mediaKeys;
        return Promise.resolve();
    };
    
    // HTMLAudioElement
    function HTMLAudioElement() {
        HTMLVideoElement.call(this);
        Object.assign(treeOf(this), { tagName: 'AUDIO', localName: 'audio', nodeName: 'AUDIO' });
    }
    HTMLAudioElement.prototype = Object.create(HTMLVideoElement.prototype);
    HTMLAudioElement.prototype.constructor = HTMLAudioElement;
    
    // Audio 构造函数
    window.Audio = function(src) {
        const audio = new HTMLAudioElement();
        if (src) audio.src = src;
        return audio;
    };
    
    // HTMLStyleElement
    function HTMLStyleElement() {
        HTMLElement.call(this, 'style');
        this.type = 'text/css';
        this.media = '';
        this.disabled = false;
        this.sheet = null;
    }
    HTMLStyleElement.prototype = Object.create(HTMLElement.prototype);
    HTMLStyleElement.prototype.constructor = HTMLStyleElement;
    
    // HTMLLinkElement
    function HTMLLinkElement() {
        HTMLElement.call(this, 'link');
        this.href = '';
        this.rel = '';
        this.type = '';
        this.media = '';
        this.crossOrigin = null;
        this.referrerPolicy = '';
        this.as = '';
        this.disabled = false;
        this.sheet = null;
        this.integrity = '';
    }
    HTMLLinkElement.prototype = Object.create(HTMLElement.prototype);
    HTMLLinkElement.prototype.constructor = HTMLLinkElement;
    
    // HTMLMetaElement
    function HTMLMetaElement() {
        HTMLElement.call(this, 'meta');
        this.content = '';
        this.httpEquiv = '';
        this.name = '';
        this.charset = '';
    }
    HTMLMetaElement.prototype = Object.create(HTMLElement.prototype);
    HTMLMetaElement.prototype.constructor = HTMLMetaElement;
    
    // HTMLTitleElement
    function HTMLTitleElement() {
        HTMLElement.call(this, 'title');
        this.text = '';
    }
    HTMLTitleElement.prototype = Object.create(HTMLElement.prototype);
    HTMLTitleElement.prototype.constructor = HTMLTitleElement;
    
    // HTMLBaseElement
    function HTMLBaseElement() {
        HTMLElement.call(this, 'base');
        this.href = '';
        this.target = '';
    }
    HTMLBaseElement.prototype = Object.create(HTMLElement.prototype);
    HTMLBaseElement.prototype.constructor = HTMLBaseElement;
    
    // HTMLHeadElement
    function HTMLHeadElement() {
        HTMLElement.call(this, 'head');
    }
    HTMLHeadElement.prototype = Object.create(HTMLElement.prototype);
    HTMLHeadElement.prototype.constructor = HTMLHeadElement;
    
    // HTMLBodyElement
    function HTMLBodyElement() {
        HTMLElement.call(this, 'body');
        this.aLink = '';
        this.background = '';
        this.bgColor = '';
        this.link = '';
        this.text = '';
        this.vLink = '';
    }
    HTMLBodyElement.prototype = Object.create(HTMLElement.prototype);
    HTMLBodyElement.prototype.constructor = HTMLBodyElement;
    
    // HTMLHtmlElement
    function HTMLHtmlElement() {
        HTMLElement.call(this, 'html');
        this.version = '';
    }
    HTMLHtmlElement.prototype = Object.create(HTMLElement.prototype);
    HTMLHtmlElement.prototype.constructor = HTMLHtmlElement;
    
    // HTMLTableElement
    function HTMLTableElement() {
        HTMLElement.call(this, 'table');
        this.caption = null;
        this.tHead = null;
        this.tFoot = null;
        this.tBodies = [];
        this.rows = [];
        this.align = '';
        this.bgColor = '';
        this.border = '';
        this.cellPadding = '';
        this.cellSpacing = '';
        this.frame = '';
        this.rules = '';
        this.summary = '';
        this.width = '';
    }
    HTMLTableElement.prototype = Object.create(HTMLElement.prototype);
    HTMLTableElement.prototype.constructor = HTMLTableElement;
    HTMLTableElement.prototype.createCaption = function() { return new HTMLTableCaptionElement(); };
    HTMLTableElement.prototype.deleteCaption = function() { this.caption = null; };
    HTMLTableElement.prototype.createTHead = function() { return new HTMLTableSectionElement('thead'); };
    HTMLTableElement.prototype.deleteTHead = function() { this.tHead = null; };
    HTMLTableElement.prototype.createTFoot = function() { return new HTMLTableSectionElement('tfoot'); };
    HTMLTableElement.prototype.deleteTFoot = function() { this.tFoot = null; };
    HTMLTableElement.prototype.createTBody = function() { return new HTMLTableSectionElement('tbody'); };
    HTMLTableElement.prototype.insertRow = function(index) { return new HTMLTableRowElement(); };
    HTMLTableElement.prototype.deleteRow = function(index) {};
    
    // HTMLTableSectionElement (thead, tbody, tfoot)
    function HTMLTableSectionElement(tagName) {
        HTMLElement.call(this, tagName || 'tbody');
        this.rows = [];
        this.align = '';
        this.ch = '';
        this.chOff = '';
        this.vAlign = '';
    }
    HTMLTableSectionElement.prototype = Object.create(HTMLElement.prototype);
    HTMLTableSectionElement.prototype.constructor = HTMLTableSectionElement;
    HTMLTableSectionElement.prototype.insertRow = function(index) { return new HTMLTableRowElement(); };
    HTMLTableSectionElement.prototype.deleteRow = function(index) {};
    
    // HTMLTableRowElement
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
    HTMLTableRowElement.prototype.deleteCell = function(index) {};
    
    // HTMLTableCellElement (td, th)
    function HTMLTableCellElement(tagName) {
        HTMLElement.call(this, tagName || 'td');
        this.colSpan = 1;
        this.rowSpan = 1;
        this.headers = '';
        this.cellIndex = -1;
        this.abbr = '';
        this.align = '';
        this.axis = '';
        this.bgColor = '';
        this.ch = '';
        this.chOff = '';
        this.height = '';
        this.noWrap = false;
        this.scope = '';
        this.vAlign = '';
        this.width = '';
    }
    HTMLTableCellElement.prototype = Object.create(HTMLElement.prototype);
    HTMLTableCellElement.prototype.constructor = HTMLTableCellElement;
    
    // HTMLTableCaptionElement
    function HTMLTableCaptionElement() {
        HTMLElement.call(this, 'caption');
        this.align = '';
    }
    HTMLTableCaptionElement.prototype = Object.create(HTMLElement.prototype);
    HTMLTableCaptionElement.prototype.constructor = HTMLTableCaptionElement;
    
    // HTMLUListElement
    function HTMLUListElement() {
        HTMLElement.call(this, 'ul');
        this.compact = false;
        this.type = '';
    }
    HTMLUListElement.prototype = Object.create(HTMLElement.prototype);
    HTMLUListElement.prototype.constructor = HTMLUListElement;
    
    // HTMLOListElement
    function HTMLOListElement() {
        HTMLElement.call(this, 'ol');
        this.compact = false;
        this.reversed = false;
        this.start = 1;
        this.type = '';
    }
    HTMLOListElement.prototype = Object.create(HTMLElement.prototype);
    HTMLOListElement.prototype.constructor = HTMLOListElement;
    
    // HTMLLIElement
    function HTMLLIElement() {
        HTMLElement.call(this, 'li');
        this.type = '';
        this.value = 0;
    }
    HTMLLIElement.prototype = Object.create(HTMLElement.prototype);
    HTMLLIElement.prototype.constructor = HTMLLIElement;
    
    // HTMLDListElement
    function HTMLDListElement() {
        HTMLElement.call(this, 'dl');
        this.compact = false;
    }
    HTMLDListElement.prototype = Object.create(HTMLElement.prototype);
    HTMLDListElement.prototype.constructor = HTMLDListElement;
    
    // HTMLLabelElement
    function HTMLLabelElement() {
        HTMLElement.call(this, 'label');
        this.htmlFor = '';
        this.control = null;
        this.form = null;
    }
    HTMLLabelElement.prototype = Object.create(HTMLElement.prototype);
    HTMLLabelElement.prototype.constructor = HTMLLabelElement;
    
    // HTMLFieldSetElement
    function HTMLFieldSetElement() {
        HTMLElement.call(this, 'fieldset');
        this.disabled = false;
        this.form = null;
        this.name = '';
        this.type = 'fieldset';
        this.elements = [];
        this.validity = { valid: true };
        this.validationMessage = '';
        this.willValidate = false;
    }
    HTMLFieldSetElement.prototype = Object.create(HTMLElement.prototype);
    HTMLFieldSetElement.prototype.constructor = HTMLFieldSetElement;
    HTMLFieldSetElement.prototype.checkValidity = function() { return true; };
    HTMLFieldSetElement.prototype.reportValidity = function() { return true; };
    HTMLFieldSetElement.prototype.setCustomValidity = function(message) {};
    
    // HTMLLegendElement
    function HTMLLegendElement() {
        HTMLElement.call(this, 'legend');
        this.form = null;
        this.align = '';
    }
    HTMLLegendElement.prototype = Object.create(HTMLElement.prototype);
    HTMLLegendElement.prototype.constructor = HTMLLegendElement;
    
    // HTMLProgressElement
    function HTMLProgressElement() {
        HTMLElement.call(this, 'progress');
        this.max = 1;
        this.value = 0;
        this.position = -1;
        this.labels = [];
    }
    HTMLProgressElement.prototype = Object.create(HTMLElement.prototype);
    HTMLProgressElement.prototype.constructor = HTMLProgressElement;
    
    // HTMLMeterElement
    function HTMLMeterElement() {
        HTMLElement.call(this, 'meter');
        this.min = 0;
        this.max = 1;
        this.value = 0;
        this.low = 0;
        this.high = 1;
        this.optimum = 0.5;
        this.labels = [];
    }
    HTMLMeterElement.prototype = Object.create(HTMLElement.prototype);
    HTMLMeterElement.prototype.constructor = HTMLMeterElement;
    
    // HTMLOutputElement
    function HTMLOutputElement() {
        HTMLElement.call(this, 'output');
        this.defaultValue = '';
        this.value = '';
        this.htmlFor = '';
        this.form = null;
        this.name = '';
        this.type = 'output';
        this.validity = { valid: true };
        this.validationMessage = '';
        this.willValidate = false;
        this.labels = [];
    }
    HTMLOutputElement.prototype = Object.create(HTMLElement.prototype);
    HTMLOutputElement.prototype.constructor = HTMLOutputElement;
    HTMLOutputElement.prototype.checkValidity = function() { return true; };
    HTMLOutputElement.prototype.reportValidity = function() { return true; };
    HTMLOutputElement.prototype.setCustomValidity = function(message) {};
    
    // HTMLDetailsElement
    function HTMLDetailsElement() {
        HTMLElement.call(this, 'details');
        this.open = false;
    }
    HTMLDetailsElement.prototype = Object.create(HTMLElement.prototype);
    HTMLDetailsElement.prototype.constructor = HTMLDetailsElement;
    
    // HTMLSummaryElement
    function HTMLSummaryElement() {
        HTMLElement.call(this, 'summary');
    }
    HTMLSummaryElement.prototype = Object.create(HTMLElement.prototype);
    HTMLSummaryElement.prototype.constructor = HTMLSummaryElement;
    
    // HTMLDialogElement
    function HTMLDialogElement() {
        HTMLElement.call(this, 'dialog');
        this.open = false;
        this.returnValue = '';
    }
    HTMLDialogElement.prototype = Object.create(HTMLElement.prototype);
    HTMLDialogElement.prototype.constructor = HTMLDialogElement;
    HTMLDialogElement.prototype.show = function() {
        this.open = true;
        Monitor.log('Dialog', 'show', { elementId: nodeIdOf(this) });
    };
    HTMLDialogElement.prototype.showModal = function() {
        this.open = true;
        Monitor.log('Dialog', 'showModal', { elementId: nodeIdOf(this) });
    };
    HTMLDialogElement.prototype.close = function(returnValue) {
        this.open = false;
        if (returnValue !== undefined) this.returnValue = returnValue;
        Monitor.log('Dialog', 'close', { elementId: nodeIdOf(this), returnValue });
    };
    
    // HTMLSlotElement
    function HTMLSlotElement() {
        HTMLElement.call(this, 'slot');
        this.name = '';
    }
    HTMLSlotElement.prototype = Object.create(HTMLElement.prototype);
    HTMLSlotElement.prototype.constructor = HTMLSlotElement;
    HTMLSlotElement.prototype.assignedNodes = function(options) { return []; };
    HTMLSlotElement.prototype.assignedElements = function(options) { return []; };
    HTMLSlotElement.prototype.assign = function(...nodes) {};
    
    // HTMLTemplateElement
    function HTMLTemplateElement() {
        HTMLElement.call(this, 'template');
        this.content = new DocumentFragment();
    }
    HTMLTemplateElement.prototype = Object.create(HTMLElement.prototype);
    HTMLTemplateElement.prototype.constructor = HTMLTemplateElement;
    
    // HTMLPictureElement
    function HTMLPictureElement() {
        HTMLElement.call(this, 'picture');
    }
    HTMLPictureElement.prototype = Object.create(HTMLElement.prototype);
    HTMLPictureElement.prototype.constructor = HTMLPictureElement;
    
    // HTMLSourceElement
    function HTMLSourceElement() {
        HTMLElement.call(this, 'source');
        this.src = '';
        this.srcset = '';
        this.sizes = '';
        this.type = '';
        this.media = '';
        this.width = 0;
        this.height = 0;
    }
    HTMLSourceElement.prototype = Object.create(HTMLElement.prototype);
    HTMLSourceElement.prototype.constructor = HTMLSourceElement;
    
    // HTMLTrackElement
    function HTMLTrackElement() {
        HTMLElement.call(this, 'track');
        this.kind = 'subtitles';
        this.src = '';
        this.srclang = '';
        this.label = '';
        this.default = false;
        this.readyState = 0;
        this.track = null;
    }
    HTMLTrackElement.prototype = Object.create(HTMLElement.prototype);
    HTMLTrackElement.prototype.constructor = HTMLTrackElement;
    
    // HTMLEmbedElement
    function HTMLEmbedElement() {
        HTMLElement.call(this, 'embed');
        this.src = '';
        this.type = '';
        this.width = '';
        this.height = '';
        this.align = '';
        this.name = '';
    }
    HTMLEmbedElement.prototype = Object.create(HTMLElement.prototype);
    HTMLEmbedElement.prototype.constructor = HTMLEmbedElement;
    HTMLEmbedElement.prototype.getSVGDocument = function() { return null; };
    
    // HTMLObjectElement
    function HTMLObjectElement() {
        HTMLElement.call(this, 'object');
        this.data = '';
        this.type = '';
        this.name = '';
        this.useMap = '';
        this.form = null;
        this.width = '';
        this.height = '';
        this.contentDocument = null;
        this.contentWindow = null;
        this.validity = { valid: true };
        this.validationMessage = '';
        this.willValidate = false;
    }
    HTMLObjectElement.prototype = Object.create(HTMLElement.prototype);
    HTMLObjectElement.prototype.constructor = HTMLObjectElement;
    HTMLObjectElement.prototype.checkValidity = function() { return true; };
    HTMLObjectElement.prototype.reportValidity = function() { return true; };
    HTMLObjectElement.prototype.setCustomValidity = function(message) {};
    HTMLObjectElement.prototype.getSVGDocument = function() { return null; };
    
    // ==================== 元素类型映射 ====================
    const elementConstructors = {
        // 基础元素
        'div': HTMLDivElement,
        'span': HTMLSpanElement,
        'p': HTMLParagraphElement,
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
        
        // 文档结构
        'html': HTMLHtmlElement,
        'head': HTMLHeadElement,
        'body': HTMLBodyElement,
        'title': HTMLTitleElement,
        'base': HTMLBaseElement,
        'meta': HTMLMetaElement,
        'link': HTMLLinkElement,
        'style': HTMLStyleElement,
        'script': HTMLScriptElement,
        
        // 表单
        'form': HTMLFormElement,
        'input': HTMLInputElement,
        'button': HTMLButtonElement,
        'textarea': HTMLTextAreaElement,
        'select': HTMLSelectElement,
        'option': HTMLOptionElement,
        'optgroup': HTMLElement,
        'label': HTMLLabelElement,
        'fieldset': HTMLFieldSetElement,
        'legend': HTMLLegendElement,
        'datalist': HTMLElement,
        'output': HTMLOutputElement,
        'progress': HTMLProgressElement,
        'meter': HTMLMeterElement,
        
        // 表格
        'table': HTMLTableElement,
        'thead': function() { return new HTMLTableSectionElement('thead'); },
        'tbody': function() { return new HTMLTableSectionElement('tbody'); },
        'tfoot': function() { return new HTMLTableSectionElement('tfoot'); },
        'tr': HTMLTableRowElement,
        'td': function() { return new HTMLTableCellElement('td'); },
        'th': function() { return new HTMLTableCellElement('th'); },
        'caption': HTMLTableCaptionElement,
        'colgroup': HTMLElement,
        'col': HTMLElement,
        
        // 列表
        'ul': HTMLUListElement,
        'ol': HTMLOListElement,
        'li': HTMLLIElement,
        'dl': HTMLDListElement,
        'dt': HTMLElement,
        'dd': HTMLElement,
        
        // 媒体
        'img': HTMLImageElement,
        'video': HTMLVideoElement,
        'audio': HTMLAudioElement,
        'source': HTMLSourceElement,
        'track': HTMLTrackElement,
        'picture': HTMLPictureElement,
        'canvas': HTMLCanvasElement,
        'embed': HTMLEmbedElement,
        'object': HTMLObjectElement,
        'iframe': HTMLIFrameElement,
        
        // 链接
        'a': HTMLAnchorElement,
        'area': HTMLElement,
        'map': HTMLElement,
        
        // 交互
        'details': HTMLDetailsElement,
        'summary': HTMLSummaryElement,
        'dialog': HTMLDialogElement,
        
        // Web Components
        'slot': HTMLSlotElement,
        'template': HTMLTemplateElement,
        
        // 语义化标签
        'header': HTMLElement,
        'footer': HTMLElement,
        'main': HTMLElement,
        'nav': HTMLElement,
        'aside': HTMLElement,
        'section': HTMLElement,
        'article': HTMLElement,
        'figure': HTMLElement,
        'figcaption': HTMLElement,
        'mark': HTMLElement,
        'time': HTMLElement,
        'address': HTMLElement,
        'blockquote': HTMLElement,
        'q': HTMLElement,
        'cite': HTMLElement,
        'code': HTMLElement,
        'kbd': HTMLElement,
        'samp': HTMLElement,
        'var': HTMLElement,
        'abbr': HTMLElement,
        'dfn': HTMLElement,
        'em': HTMLElement,
        'strong': HTMLElement,
        'small': HTMLElement,
        'sub': HTMLElement,
        'sup': HTMLElement,
        'i': HTMLElement,
        'b': HTMLElement,
        'u': HTMLElement,
        's': HTMLElement,
        'del': HTMLElement,
        'ins': HTMLElement,
        'wbr': HTMLElement,
        'ruby': HTMLElement,
        'rt': HTMLElement,
        'rp': HTMLElement,
        'bdi': HTMLElement,
        'bdo': HTMLElement,
        'data': HTMLElement,
        'noscript': HTMLElement
    };

    // 映射到基类 HTMLElement 的标签要带上标签名，否则会得到 localName 为 div 的元素
    for (const [tag, Constructor] of Object.entries(elementConstructors)) {
        if (Constructor === HTMLElement) {
            elementConstructors[tag] = function () { return new HTMLElement(tag); };
        }
    }

    // ==================== Text Node ====================
    // ==================== CharacterData ====================
    // Text / Comment 的字符数据存在节点内部状态（data 字段），脚本经原型访问器读写
    function isCharacterData(state) {
        return state.nodeType === 3 || state.nodeType === 8;
    }

    function CharacterData() { throw new TypeError('Illegal constructor'); }
    CharacterData.prototype = Object.create(Node.prototype);
    CharacterData.prototype.constructor = CharacterData;
    Object.setPrototypeOf(CharacterData, Node);
    defineTreeGetters(CharacterData.prototype, {
        data: { get: s => s.data, set: (s, value, node) => { setCharacterData(s, value, node); } },
        length: s => s.data.length
    });
    const characterDataMethods = {
        substringData(offset, count) { return this.data.substring(offset, offset + count); },
        appendData(data) { this.data += String(data); },
        insertData(offset, data) { this.data = this.data.slice(0, offset) + String(data) + this.data.slice(offset); },
        deleteData(offset, count) { this.data = this.data.slice(0, offset) + this.data.slice(offset + count); },
        replaceData(offset, count, data) { this.data = this.data.slice(0, offset) + String(data) + this.data.slice(offset + count); }
    };
    for (const [key, method] of Object.entries(characterDataMethods)) {
        CharacterData.prototype[key] = window.safefunction(method, key);
    }
    window.CharacterData = CharacterData;

    // nodeValue / textContent：字符数据节点返回 data，其他节点 nodeValue 为 null（Element 另有 textContent 实现）
    defineTreeGetters(Node.prototype, {
        nodeValue: {
            get: s => (isCharacterData(s) ? s.data : null),
            set: (s, value, node) => { if (isCharacterData(s)) setCharacterData(s, value, node); }
        },
        textContent: {
            get: s => (isCharacterData(s) ? s.data : null),
            set: (s, value, node) => { if (isCharacterData(s)) setCharacterData(s, value, node); }
        }
    });

    // ==================== Text Node ====================
    function Text(data) {
        Node.call(this);
        Object.assign(treeOf(this), { nodeType: 3, nodeName: '#text', data: data !== undefined ? String(data) : '' });
    }
    Text.prototype = Object.create(CharacterData.prototype);
    Text.prototype.constructor = Text;
    Text.prototype.splitText = function(offset) {
        const newText = new Text(this.data.slice(offset));
        this.data = this.data.slice(0, offset);
        if (this.parentNode) this.parentNode.insertBefore(newText, this.nextSibling);
        return newText;
    };
    Text.prototype.cloneNode = function() { return new Text(this.data); };
    window.Text = Text;

    // ==================== Comment ====================
    function Comment(data) {
        Node.call(this);
        Object.assign(treeOf(this), { nodeType: 8, nodeName: '#comment', data: data !== undefined ? String(data) : '' });
    }
    Comment.prototype = Object.create(CharacterData.prototype);
    Comment.prototype.constructor = Comment;
    Comment.prototype.cloneNode = function() { return new Comment(this.data); };
    window.Comment = Comment;
    
    // ==================== DocumentFragment ====================
    function DocumentFragment() {
        Node.call(this);
        Object.assign(treeOf(this), { nodeType: 11, nodeName: '#document-fragment' });
    }
    DocumentFragment.prototype = Object.create(Node.prototype);
    DocumentFragment.prototype.constructor = DocumentFragment;
    defineTreeGetters(DocumentFragment.prototype, parentNodeGetters);
    DocumentFragment.prototype._updateChildReferences = Element.prototype._updateChildReferences;
    DocumentFragment.prototype.getElementById = function(id) { return null; };
    DocumentFragment.prototype.querySelector = function(selector) { return null; };
    DocumentFragment.prototype.querySelectorAll = function(selector) { return []; };
    DocumentFragment.prototype.append = Element.prototype.append;
    DocumentFragment.prototype.prepend = Element.prototype.prepend;
    DocumentFragment.prototype.replaceChildren = function(...nodes) {
        while (this.firstChild) this.removeChild(this.firstChild);
        this.append(...nodes);
    };
    window.DocumentFragment = DocumentFragment;
    
    // DOMException 由 env/webapi/domexception.js 提供（基础模块，始终先于本文件加载）
    
    // ==================== Document ====================
    const initialDocumentURL = window.location?.href || 'https://example.com/';
    const document = {
        // 文档信息
        documentElement: null,
        head: null,
        body: null,
        title: '',
        characterSet: 'UTF-8',
        charset: 'UTF-8',
        inputEncoding: 'UTF-8',
        contentType: 'text/html',
        doctype: { name: 'html', publicId: '', systemId: '' },
        
        // URL 相关
        URL: initialDocumentURL,
        documentURI: initialDocumentURL,
        baseURI: initialDocumentURL,
        domain: window.location?.hostname || 'example.com',
        referrer: '',
        cookie: '',
        lastModified: new Date().toUTCString(),
        
        // 状态
        readyState: 'complete',
        hidden: false,
        visibilityState: 'visible',
        hasFocus: true,
        fullscreenEnabled: true,
        fullscreenElement: null,
        pictureInPictureEnabled: true,
        pictureInPictureElement: null,
        pointerLockElement: null,
        designMode: 'off',
        dir: '',
        
        // ========== 创建元素（增强监控） ==========
        createElement: function(tagName, options) {
            Monitor.pushChain('document.createElement');
            
            const lowerTag = tagName.toLowerCase();
            
            // 检查 mock
            const mock = Monitor.executeMock('document.createElement', [tagName, options], this);
            if (mock.mocked) {
                Monitor.popChain();
                return mock.result;
            }
            
            let element;
            const Constructor = (window.__elementConstructors__ && window.__elementConstructors__[lowerTag]) || elementConstructors[lowerTag];
            
            if (Constructor) {
                if (typeof Constructor === 'function') {
                    // 检查是否是工厂函数（返回实例）还是构造函数
                    try {
                        element = new Constructor();
                    } catch (e) {
                        // 如果 new 失败，可能是工厂函数
                        element = Constructor();
                    }
                } else {
                    element = new HTMLElement(lowerTag);
                }
            } else {
                element = (window.__unknownElementFactory__ && window.__unknownElementFactory__(lowerTag)) ||
                    new HTMLElement(lowerTag);
            }
            
            treeOf(element).ownerDocument = this;
            // 元素实例不应有自有属性（构造期间写入的搬到原型上）
            window.__elementProps__?.lift(element);
            const urlAttribute = ({ a: 'href', area: 'href', link: 'href', base: 'href',
                form: 'action',
                img: 'src', script: 'src', iframe: 'src', source: 'src' })[lowerTag];
            if (urlAttribute) reflectURL(element, urlAttribute, urlAttribute);
            
            // 记录创建
            Monitor.logCreate(tagName, element, options);
            Monitor.log('DOM', 'createElement', {
                tagName: tagName,
                elementId: nodeIdOf(element),
                options: options
            });
            
            Monitor.popChain();
            return element;
        },
        
        createElementNS: function(namespaceURI, qualifiedName, options) {
            Monitor.pushChain('document.createElementNS');
            
            const mock = Monitor.executeMock('document.createElementNS', [namespaceURI, qualifiedName, options], this);
            if (mock.mocked) {
                Monitor.popChain();
                return mock.result;
            }
            
            // HTML 命名空间与 createElement 相同；SVG 用 SVGElement（elements.js 提供），style / dataset 才可用
            let element;
            if (namespaceURI === HTML_NAMESPACE) {
                element = this.createElement(qualifiedName, options);
            } else if (namespaceURI === SVG_NAMESPACE && typeof window.SVGElement === 'function') {
                // window.SVGElement 是不可构造的接口对象，内部创建用真实构造函数
                const SVGElementCtor = window.__elementInterfaces__.raw(window.SVGElement);
                element = Object.create(SVGElementCtor.prototype);
                SVGElementCtor.call(element, qualifiedName);
            } else {
                element = new Element(qualifiedName, namespaceURI);
            }
            treeOf(element).ownerDocument = this;
            
            Monitor.logCreate(qualifiedName, element, { namespaceURI });
            Monitor.log('DOM', 'createElementNS', {
                namespaceURI: namespaceURI,
                qualifiedName: qualifiedName,
                elementId: nodeIdOf(element)
            });
            
            Monitor.popChain();
            return element;
        },
        
        createTextNode: function(data) {
            const node = new Text(data);
            treeOf(node).ownerDocument = this;
            Monitor.log('DOM', 'createTextNode', { data: data?.substring(0, 50) });
            return node;
        },
        
        createComment: function(data) {
            const node = new Comment(data);
            treeOf(node).ownerDocument = this;
            Monitor.log('DOM', 'createComment', { data: data?.substring(0, 50) });
            return node;
        },
        
        createDocumentFragment: function() {
            const fragment = new DocumentFragment();
            treeOf(fragment).ownerDocument = this;
            Monitor.log('DOM', 'createDocumentFragment', {});
            return fragment;
        },
        
        createEvent: function(type) {
            Monitor.log('DOM', 'createEvent', { type });
            return new Event('');
        },
        
        createRange: function() {
            Monitor.log('DOM', 'createRange', {});
            return {
                startContainer: null,
                startOffset: 0,
                endContainer: null,
                endOffset: 0,
                collapsed: true,
                commonAncestorContainer: null,
                setStart: function(node, offset) { this.startContainer = node; this.startOffset = offset; },
                setEnd: function(node, offset) { this.endContainer = node; this.endOffset = offset; },
                setStartBefore: function(node) {},
                setStartAfter: function(node) {},
                setEndBefore: function(node) {},
                setEndAfter: function(node) {},
                selectNode: function(node) {},
                selectNodeContents: function(node) {},
                collapse: function(toStart) { this.collapsed = true; },
                cloneContents: function() { return document.createDocumentFragment(); },
                deleteContents: function() {},
                extractContents: function() { return document.createDocumentFragment(); },
                insertNode: function(node) {},
                surroundContents: function(node) {},
                cloneRange: function() { return document.createRange(); },
                detach: function() {},
                toString: function() { return ''; },
                createContextualFragment: function(html) { return document.createDocumentFragment(); },
                getBoundingClientRect: function() { return new DOMRect(0, 0, 0, 0); },
                getClientRects: function() { return []; }
            };
        },
        
        createTreeWalker: function(root, whatToShow, filter) {
            Monitor.log('DOM', 'createTreeWalker', { rootId: nodeIdOf(root), whatToShow });
            return {
                root: root,
                whatToShow: whatToShow || 0xFFFFFFFF,
                filter: filter,
                currentNode: root,
                parentNode: function() { return null; },
                firstChild: function() { return null; },
                lastChild: function() { return null; },
                previousSibling: function() { return null; },
                nextSibling: function() { return null; },
                previousNode: function() { return null; },
                nextNode: function() { return null; }
            };
        },
        
        createNodeIterator: function(root, whatToShow, filter) {
            Monitor.log('DOM', 'createNodeIterator', { rootId: nodeIdOf(root) });
            return {
                root: root,
                whatToShow: whatToShow || 0xFFFFFFFF,
                filter: filter,
                referenceNode: root,
                pointerBeforeReferenceNode: true,
                nextNode: function() { return null; },
                previousNode: function() { return null; },
                detach: function() {}
            };
        },
        
        // ========== 查询（增强监控） ==========
        getElementById: function(id) {
            Monitor.pushChain('document.getElementById');
            Monitor.log('DOM', 'getElementById', { id: id });
            
            const mock = Monitor.executeMock('document.getElementById', [id], this);
            Monitor.popChain();
            
            if (mock.mocked) return mock.result;
            return findElements(this.documentElement,
                node => node.getAttribute('id') === String(id), true)[0] || null;
        },
        
        getElementsByName: function(name) {
            Monitor.log('DOM', 'getElementsByName', { name });
            
            const mock = Monitor.executeMock('document.getElementsByName', [name], this);
            if (mock.mocked) return mock.result;
            
            return staticNodeList(findElements(this.documentElement,
                node => node.getAttribute('name') === String(name), true));
        },
        
        getElementsByTagName: function(tagName) {
            Monitor.log('DOM', 'getElementsByTagName', { tagName });
            
            const mock = Monitor.executeMock('document.getElementsByTagName', [tagName], this);
            if (mock.mocked) return mock.result;
            
            return liveCollection(() => window.__htmlBridge__?.select(this.documentElement,
                String(tagName), true) || []);
        },
        
        getElementsByClassName: function(className) {
            Monitor.log('DOM', 'getElementsByClassName', { className });
            
            const mock = Monitor.executeMock('document.getElementsByClassName', [className], this);
            if (mock.mocked) return mock.result;
            
            return liveCollection(() => findElements(this.documentElement,
                node => hasClasses(node, className), true));
        },
        
        querySelector: function(selector) {
            Monitor.log('DOM', 'querySelector', { selector });
            
            const mock = Monitor.executeMock('document.querySelector', [selector], this);
            if (mock.mocked) return mock.result;
            
            return window.__htmlBridge__?.select(this.documentElement, selector, true)[0] || null;
        },
        
        querySelectorAll: function(selector) {
            Monitor.log('DOM', 'querySelectorAll', { selector });
            
            const mock = Monitor.executeMock('document.querySelectorAll', [selector], this);
            if (mock.mocked) return mock.result;
            
            return staticNodeList(window.__htmlBridge__?.select(this.documentElement, selector, true) || []);
        },
        
        // ========== 文档操作 ==========
        write: function(...args) {
            Monitor.log('DOM', 'write', { content: args.join('').substring(0, 100) });
        },
        
        writeln: function(...args) {
            Monitor.log('DOM', 'writeln', { content: args.join('').substring(0, 100) });
        },
        
        open: function(url, name, features) {
            Monitor.log('DOM', 'open', { url, name });
            return this;
        },
        
        close: function() {
            Monitor.log('DOM', 'close', {});
        },
        
        // ========== 其他方法 ==========
        getSelection: function() {
            return {
                anchorNode: null,
                anchorOffset: 0,
                focusNode: null,
                focusOffset: 0,
                isCollapsed: true,
                rangeCount: 0,
                type: 'None',
                addRange: function() {},
                collapse: function() {},
                collapseToEnd: function() {},
                collapseToStart: function() {},
                containsNode: function() { return false; },
                deleteFromDocument: function() {},
                empty: function() {},
                extend: function() {},
                getRangeAt: function() { return null; },
                removeAllRanges: function() {},
                removeRange: function() {},
                selectAllChildren: function() {},
                setBaseAndExtent: function() {},
                setPosition: function() {},
                toString: function() { return ''; }
            };
        },
        
        elementFromPoint: function(x, y) {
            Monitor.log('DOM', 'elementFromPoint', { x, y });
            
            const mock = Monitor.executeMock('document.elementFromPoint', [x, y], this);
            if (mock.mocked) return mock.result;
            
            return null;
        },
        
        elementsFromPoint: function(x, y) {
            Monitor.log('DOM', 'elementsFromPoint', { x, y });
            return [];
        },
        
        caretPositionFromPoint: function(x, y) {
            return null;
        },
        
        caretRangeFromPoint: function(x, y) {
            return null;
        },
        
        createAttribute: function(name) {
            return new Attr(name, '', null);
        },
        
        createAttributeNS: function(namespaceURI, qualifiedName) {
            const attr = new Attr(qualifiedName, '', null);
            attr.namespaceURI = namespaceURI;
            return attr;
        },
        
        importNode: function(node, deep) {
            Monitor.log('DOM', 'importNode', { deep });
            return node.cloneNode(deep);
        },
        
        adoptNode: function(node) {
            Monitor.log('DOM', 'adoptNode', {});
            if (node.parentNode) node.parentNode.removeChild(node);
            treeOf(node).ownerDocument = this;
            return node;
        },
        
        execCommand: function(command, showUI, value) {
            Monitor.log('DOM', 'execCommand', { command, showUI, value });
            return false;
        },
        
        queryCommandEnabled: function(command) { return false; },
        queryCommandIndeterm: function(command) { return false; },
        queryCommandState: function(command) { return false; },
        queryCommandSupported: function(command) { return false; },
        queryCommandValue: function(command) { return ''; },
        
        hasFocus: function() { return true; },
        
        exitFullscreen: function() { return Promise.resolve(); },
        exitPictureInPicture: function() { return Promise.resolve(); },
        exitPointerLock: function() {},
        
        // 事件方法来自 EventTarget.prototype（document 经 Document.prototype → Node.prototype 继承）

        // 其他属性
        defaultView: null,
        implementation: {
            createDocument: function() { return {}; },
            createDocumentType: function() { return {}; },
            createHTMLDocument: function(title) { return {}; },
            hasFeature: function() { return true; }
        },
        
        fonts: {
            ready: Promise.resolve(),
            status: 'loaded',
            check: function() { return true; },
            load: function() { return Promise.resolve([]); },
            add: function() {},
            delete: function() { return false; },
            clear: function() {},
            forEach: function() {},
            entries: function() { return [][Symbol.iterator](); },
            keys: function() { return [][Symbol.iterator](); },
            values: function() { return [][Symbol.iterator](); },
            [Symbol.iterator]: function() { return [][Symbol.iterator](); }
        },
        
        styleSheets: [],
        adoptedStyleSheets: [],
        
        timeline: {
            currentTime: 0
        },
        
        scrollingElement: null,
        
        activeElement: null,
        
        // 兼容性属性
        all: [],
        anchors: [],
        applets: [],
        embeds: [],
        forms: [],
        images: [],
        links: [],
        plugins: [],
        scripts: []
    };
    
    // 初始化文档结构
    function initDocumentStructure() {
        // 创建 html 元素
        document.documentElement = document.createElement('html');
        treeOf(document.documentElement).ownerDocument = document;
        
        // 创建 head 和 body
        document.head = document.createElement('head');
        document.body = document.createElement('body');
        
        document.documentElement.appendChild(document.head);
        document.documentElement.appendChild(document.body);
        document.documentElement._setConnected(true);
        
        // 设置相关引用
        document.defaultView = window;
        document.scrollingElement = document.documentElement;
        document.activeElement = document.body;
    }
    
    // document 不经过 Node()，单独建立内部状态
    initNodeState(document, 9, '#document');

    function attachDocumentElement(root) {
        const state = treeOf(document);
        state.childNodes = [root];
        state.first = root;
        state.last = root;
        treeOf(root).parent = document;
    }

    initDocumentStructure();

    let fallbackTitle = '';
    Object.defineProperty(document, 'title', {
        enumerable: true, configurable: true,
        get() {
            const title = document.head?.querySelector('title');
            return title ? title.textContent : fallbackTitle;
        },
        set(value) {
            fallbackTitle = String(value);
            if (!document.head) return;
            let title = document.head.querySelector('title');
            if (!title) {
                title = document.createElement('title');
                document.head.appendChild(title);
            }
            title.textContent = fallbackTitle;
        }
    });

    attachDocumentElement(document.documentElement);
    for (const [name, selector] of Object.entries({
        images: 'img', forms: 'form', scripts: 'script', links: 'a[href], area[href]',
        anchors: 'a[name]', embeds: 'embed'
    })) {
        Object.defineProperty(document, name, {
            configurable: true, enumerable: true,
            get: () => liveCollection(() => window.__htmlBridge__?.select(document.documentElement,
                selector, true) || [])
        });
    }

    Object.defineProperty(window, '__loadHTML__', {
        configurable: true,
        value: function(tree, pageURL) {
            if (pageURL) window.location.href = pageURL;
            const html = tree.find(node => node.type === 'element' && node.name === 'html');
            if (!html) throw new Error('Parsed HTML has no document element');
            document.documentElement._setConnected(false);
            docState.documentElement = createParsedNode(html);
            attachDocumentElement(document.documentElement);
            document.documentElement._setConnected(true);
            docState.head = document.documentElement.querySelector('head');
            docState.body = document.documentElement.querySelector('body');
            docState.scrollingElement = document.documentElement;
            docState.activeElement = document.body;
            fallbackTitle = document.head?.querySelector('title')?.textContent || '';
            return document;
        }
    });
    
    // ==================== 暴露到全局 ====================
    function Document() { throw new TypeError('Illegal constructor'); }
    Document.prototype = Object.create(Node.prototype);
    Object.defineProperty(Document.prototype, 'constructor', {
        value: Document, writable: true, configurable: true
    });
    function HTMLDocument() { throw new TypeError('Illegal constructor'); }
    HTMLDocument.prototype = Object.create(Document.prototype);
    Object.defineProperties(HTMLDocument.prototype, {
        constructor: { value: HTMLDocument, writable: true, configurable: true },
        [Symbol.toStringTag]: { value: 'HTMLDocument', configurable: true }
    });
    Object.setPrototypeOf(document, HTMLDocument.prototype);
    // document 是对象字面量，不经过 Node()，单独登记 EventTarget 身份
    window.__webidl__.brand(document, 'EventTarget');

    // ==================== Document 属性迁到原型 ====================
    // Chrome 中 document 的自有属性只有 location（[LegacyUnforgeable]），其余都在 Document.prototype 上。
    // 数据放在 docState；URL / baseURI / domain 由 location 计算；cookie 按 cookie 规则读写。
    const docState = {};
    const markNative = window.safefunction;

    function checkDocument(object) {
        if (object !== document) throw new TypeError('Illegal invocation');
    }

    function defineDocumentAccessor(key, get, set) {
        const holder = {
            get [key]() { checkDocument(this); return get(); },
            set [key](value) { checkDocument(this); set(value); }
        };
        const descriptor = Object.getOwnPropertyDescriptor(holder, key);
        Object.defineProperty(Document.prototype, key, {
            get: markNative(descriptor.get, 'get ' + key),
            set: set ? markNative(descriptor.set, 'set ' + key) : undefined,
            enumerable: true, configurable: true
        });
    }

    function defineDocumentMethod(key, impl) {
        const holder = { [key](...args) { checkDocument(this); return impl.apply(this, args); } };
        Object.defineProperty(holder[key], 'length', { value: impl.length });
        Object.defineProperty(Document.prototype, key, {
            value: markNative(holder[key], key), writable: true, enumerable: true, configurable: true
        });
    }

    // document.cookie：写入一条 cookie，读取时拼成 "a=1; b=2"；过期即删除，HttpOnly 的写入被忽略
    const cookieJar = new Map();
    function setCookie(text) {
        const [pair, ...attributes] = String(text).split(';');
        const separator = pair.indexOf('=');
        const name = (separator < 0 ? '' : pair.slice(0, separator)).trim();
        const value = (separator < 0 ? pair : pair.slice(separator + 1)).trim();
        let expired = false;
        for (const attribute of attributes) {
            const [rawKey, ...rest] = attribute.split('=');
            const key = rawKey.trim().toLowerCase();
            const attributeValue = rest.join('=').trim();
            if (key === 'httponly') return;
            if (key === 'max-age' && Number(attributeValue) <= 0) expired = true;
            if (key === 'expires' && Date.parse(attributeValue) <= Date.now()) expired = true;
        }
        if (expired) cookieJar.delete(name);
        else cookieJar.set(name, value);
    }
    function cookieString() {
        return Array.from(cookieJar, ([name, value]) => (name ? name + '=' + value : value)).join('; ');
    }

    function documentBaseURI() {
        const base = docState.head?.querySelector('base[href]')?.getAttribute('href');
        try { return base ? new URL(base, window.location.href).href : window.location.href; }
        catch (_) { return window.location.href; }
    }

    const derivedDocumentAccessors = {
        URL: [() => window.location.href, null],
        documentURI: [() => window.location.href, null],
        baseURI: [documentBaseURI, null],
        // 设置 domain 需要同站校验，这里忽略写入
        domain: [() => window.location.hostname, () => {}],
        cookie: [cookieString, setCookie]
    };
    const writableDocumentKeys = new Set(['designMode', 'dir', 'body']);

    for (const key of Reflect.ownKeys(document)) {
        if (typeof key !== 'string') continue;
        const descriptor = Object.getOwnPropertyDescriptor(document, key);
        delete document[key];
        if (Object.prototype.hasOwnProperty.call(derivedDocumentAccessors, key)) continue;
        if (descriptor.get || descriptor.set) {
            defineDocumentAccessor(key, () => descriptor.get.call(document),
                descriptor.set ? value => descriptor.set.call(document, value) : null);
        } else if (typeof descriptor.value === 'function') {
            defineDocumentMethod(key, descriptor.value);
        } else {
            docState[key] = descriptor.value;
            defineDocumentAccessor(key, () => docState[key],
                writableDocumentKeys.has(key) ? value => { docState[key] = value; } : null);
        }
    }
    for (const [key, [get, set]] of Object.entries(derivedDocumentAccessors)) defineDocumentAccessor(key, get, set);

    // location 是 document 上唯一的自有属性；赋值转写到 location.href
    const locationHolder = {
        get location() { return window.location; },
        set location(value) { window.location.href = String(value); }
    };
    const locationDescriptor = Object.getOwnPropertyDescriptor(locationHolder, 'location');
    Object.defineProperty(document, 'location', {
        get: markNative(locationDescriptor.get, 'get location'),
        set: markNative(locationDescriptor.set, 'set location'),
        enumerable: true, configurable: false
    });

    // 采集快照写入内部状态（属性本身只读）；URL / domain 由 location 快照决定
    const documentSnapshotKeys = new Set(['referrer', 'characterSet', 'charset', 'inputEncoding', 'contentType',
        'readyState', 'hidden', 'visibilityState', 'lastModified', 'designMode', 'dir']);
    Object.defineProperty(window, '__applyDocumentSnapshot__', {
        value(data) {
            if (!data || typeof data !== 'object' || Array.isArray(data)) return;
            for (const [key, value] of Object.entries(data)) {
                if (value === undefined) continue;
                if (documentSnapshotKeys.has(key)) docState[key] = value;
                else if (key === 'title') document.title = String(value);
                else if (key === 'cookie' && typeof value === 'string') {
                    for (const part of value.split(';')) if (part.trim()) setCookie(part);
                }
            }
        },
        writable: true, configurable: true
    });
    Object.defineProperty(window, 'document', {
        enumerable: true, configurable: false, get: () => document
    });
    window.Document = Document;
    window.HTMLDocument = HTMLDocument;
    window.Element = Element;
    window.HTMLElement = HTMLElement;
    window.HTMLDivElement = HTMLDivElement;
    window.HTMLSpanElement = HTMLSpanElement;
    window.HTMLCanvasElement = HTMLCanvasElement;
    window.HTMLImageElement = HTMLImageElement;
    window.HTMLInputElement = HTMLInputElement;
    window.HTMLButtonElement = HTMLButtonElement;
    window.HTMLTextAreaElement = HTMLTextAreaElement;
    window.HTMLSelectElement = HTMLSelectElement;
    window.HTMLOptionElement = HTMLOptionElement;
    window.HTMLAnchorElement = HTMLAnchorElement;
    window.HTMLFormElement = HTMLFormElement;
    window.HTMLIFrameElement = HTMLIFrameElement;
    window.HTMLVideoElement = HTMLVideoElement;
    window.HTMLAudioElement = HTMLAudioElement;
    window.HTMLScriptElement = HTMLScriptElement;
    window.HTMLStyleElement = HTMLStyleElement;
    window.HTMLLinkElement = HTMLLinkElement;
    window.HTMLMetaElement = HTMLMetaElement;
    window.HTMLTableElement = HTMLTableElement;
    window.HTMLTableRowElement = HTMLTableRowElement;
    window.HTMLTableCellElement = HTMLTableCellElement;
    window.HTMLUListElement = HTMLUListElement;
    window.HTMLOListElement = HTMLOListElement;
    window.HTMLLIElement = HTMLLIElement;
    window.HTMLDialogElement = HTMLDialogElement;
    window.HTMLProgressElement = HTMLProgressElement;
    window.HTMLMeterElement = HTMLMeterElement;
    window.HTMLTemplateElement = HTMLTemplateElement;
    // 元素接口：toStringTag 与 window 导出（elements.js 之后会用同名类替换其中一部分）
    const elementInterfaces = {
        HTMLElement,
        HTMLDivElement,
        HTMLSpanElement,
        HTMLParagraphElement,
        HTMLHeadingElement,
        HTMLBRElement,
        HTMLHRElement,
        HTMLPreElement,
        HTMLScriptElement,
        HTMLCanvasElement,
        HTMLImageElement,
        HTMLInputElement,
        HTMLButtonElement,
        HTMLTextAreaElement,
        HTMLSelectElement,
        HTMLOptionElement,
        HTMLAnchorElement,
        HTMLFormElement,
        HTMLIFrameElement,
        HTMLVideoElement,
        HTMLAudioElement,
        HTMLStyleElement,
        HTMLLinkElement,
        HTMLMetaElement,
        HTMLTitleElement,
        HTMLBaseElement,
        HTMLHeadElement,
        HTMLBodyElement,
        HTMLHtmlElement,
        HTMLTableElement,
        HTMLTableSectionElement,
        HTMLTableRowElement,
        HTMLTableCellElement,
        HTMLTableCaptionElement,
        HTMLUListElement,
        HTMLOListElement,
        HTMLLIElement,
        HTMLDListElement,
        HTMLLabelElement,
        HTMLFieldSetElement,
        HTMLLegendElement,
        HTMLProgressElement,
        HTMLMeterElement,
        HTMLOutputElement,
        HTMLDetailsElement,
        HTMLSummaryElement,
        HTMLDialogElement,
        HTMLSlotElement,
        HTMLTemplateElement,
        HTMLPictureElement,
        HTMLSourceElement,
        HTMLTrackElement,
        HTMLEmbedElement,
        HTMLObjectElement
    };
    for (const [name, ctor] of Object.entries(elementInterfaces)) {
        window.__elementInterfaces__.define(ctor, name);
    }

    window.Node = Node;

    // 供 domApis.js 复用 HTML 解析与序列化（Range.createContextualFragment、DOMParser、XMLSerializer）
    Object.defineProperty(window, '__documentParsing__', {
        value: Object.freeze({
            parseNodes(html) {
                const bridge = window.__htmlBridge__;
                if (!bridge) return [];
                return bridge.parseFragment(String(html)).map(createParsedNode);
            },
            serialize(node) { return serializeNode(node); },
            collection(resolve) { return liveCollection(resolve); },
            // 用给定原型创建一个带节点状态的节点（DocumentType 等）
            createNode(prototype, nodeType, nodeName, fields) {
                const node = Object.create(prototype);
                const state = initNodeState(node, nodeType, nodeName);
                state.ownerDocument = document;
                Object.assign(state, fields || {});
                window.__webidl__.brand(node, 'EventTarget', {});
                return node;
            },
            stateOf(node) { return treeOf(node); }
        }),
        configurable: true
    });

})();
