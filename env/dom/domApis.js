/**
 * @env-module domApis
 * @description Range / Selection / TreeWalker / NodeIterator / NodeFilter / ShadowRoot / DOMParser / XMLSerializer：
 * 按 WebIDL 定义（接口名、原型成员、toStringTag 与浏览器一致），实现委托给 document.js 的既有 DOM 机制。
 * @compatibility Chrome 120+
 *
 * 依赖：WebIDL.js、document.js（document、DocumentFragment、__documentParsing__）、elements.js（Element.prototype）。
 */
(function () {
    'use strict';

    const idl = window.__webidl__;
    const Monitor = window.__EnvMonitor__ || {
        log() {}, logCall() {}, executeMock() { return { mocked: false }; }
    };
    const internal = idl.internal;
    const create = idl.create;
    const parsing = window.__documentParsing__;

    // ==================== NodeFilter ====================
    idl.defineInterface('NodeFilter', {
        constants: {
            FILTER_ACCEPT: 1, FILTER_REJECT: 2, FILTER_SKIP: 3,
            SHOW_ALL: 0xFFFFFFFF, SHOW_ELEMENT: 0x1, SHOW_ATTRIBUTE: 0x2, SHOW_TEXT: 0x4,
            SHOW_CDATA_SECTION: 0x8, SHOW_ENTITY_REFERENCE: 0x10, SHOW_ENTITY: 0x20,
            SHOW_PROCESSING_INSTRUCTION: 0x40, SHOW_COMMENT: 0x80, SHOW_DOCUMENT: 0x100,
            SHOW_DOCUMENT_TYPE: 0x200, SHOW_DOCUMENT_FRAGMENT: 0x400, SHOW_NOTATION: 0x800
        }
    });

    function accepted(walker, node) {
        const state = internal(walker);
        if (!(state.whatToShow & (1 << (node.nodeType - 1)))) return 3;
        const filter = state.filter;
        if (typeof filter === 'function') return Number(filter(node)) || 1;
        if (filter && typeof filter.acceptNode === 'function') return Number(filter.acceptNode(node)) || 1;
        return 1;
    }

    // ==================== TreeWalker ====================
    idl.defineInterface('TreeWalker', {
        attributes: {
            root() { return internal(this).root; },
            whatToShow() { return internal(this).whatToShow; },
            filter() { return internal(this).filter; },
            currentNode: {
                get() { return internal(this).currentNode; },
                set(value) { internal(this).currentNode = value; }
            }
        },
        methods: {
            parentNode() {
                const state = internal(this);
                let node = state.currentNode;
                while (node && node !== state.root) {
                    node = node.parentNode;
                    if (node && accepted(this, node) === 1) { state.currentNode = node; return node; }
                }
                return null;
            },
            firstChild() { return childInDirection(this, true); },
            lastChild() { return childInDirection(this, false); },
            previousSibling() { return siblingInDirection(this, false); },
            nextSibling() { return siblingInDirection(this, true); },
            previousNode() {
                const state = internal(this);
                let node = state.currentNode;
                while (node !== state.root) {
                    let sibling = node.previousSibling;
                    if (sibling) {
                        while (sibling.lastChild) sibling = sibling.lastChild;
                        node = sibling;
                    } else {
                        node = node.parentNode;
                        if (!node || node === state.root) return null;
                    }
                    if (accepted(this, node) === 1) { state.currentNode = node; return node; }
                }
                return null;
            },
            nextNode() {
                const state = internal(this);
                let node = state.currentNode;
                for (;;) {
                    if (node.firstChild) {
                        node = node.firstChild;
                    } else {
                        while (node !== state.root && !node.nextSibling) node = node.parentNode;
                        if (!node || node === state.root) return null;
                        node = node.nextSibling;
                    }
                    if (accepted(this, node) === 1) { state.currentNode = node; return node; }
                }
            }
        }
    });

    function childInDirection(walker, forward) {
        const state = internal(walker);
        let node = forward ? state.currentNode.firstChild : state.currentNode.lastChild;
        while (node) {
            if (accepted(walker, node) === 1) { state.currentNode = node; return node; }
            node = forward ? node.nextSibling : node.previousSibling;
        }
        return null;
    }

    function siblingInDirection(walker, forward) {
        const state = internal(walker);
        let node = state.currentNode;
        while (node && node !== state.root) {
            node = forward ? node.nextSibling : node.previousSibling;
            if (!node) return null;
            if (accepted(walker, node) === 1) { state.currentNode = node; return node; }
        }
        return null;
    }

    // ==================== NodeIterator ====================
    idl.defineInterface('NodeIterator', {
        attributes: {
            root() { return internal(this).root; },
            whatToShow() { return internal(this).whatToShow; },
            filter() { return internal(this).filter; },
            referenceNode() { return internal(this).referenceNode; },
            pointerBeforeReferenceNode() { return internal(this).pointerBeforeReferenceNode; }
        },
        methods: {
            nextNode() {
                const state = internal(this);
                let node = state.referenceNode;
                let before = state.pointerBeforeReferenceNode;
                for (;;) {
                    if (before) before = false;
                    else if (node.firstChild) node = node.firstChild;
                    else {
                        while (node !== state.root && !node.nextSibling) node = node.parentNode;
                        if (node === state.root) break;
                        node = node.nextSibling;
                    }
                    if (accepted(this, node) === 1) {
                        state.referenceNode = node;
                        state.pointerBeforeReferenceNode = before;
                        return node;
                    }
                }
                return null;
            },
            previousNode() {
                const state = internal(this);
                let node = state.referenceNode;
                while (node !== state.root) {
                    if (!state.pointerBeforeReferenceNode) {
                        state.pointerBeforeReferenceNode = true;
                    } else if (node.previousSibling) {
                        node = node.previousSibling;
                        while (node.lastChild) node = node.lastChild;
                    } else {
                        node = node.parentNode;
                        if (!node || node === state.root) break;
                    }
                    if (accepted(this, node) === 1) {
                        state.referenceNode = node;
                        return node;
                    }
                }
                return null;
            },
            detach() {}
        }
    });

    // ==================== Range ====================
    function boundaryOf(node, offset) {
        if (!node || typeof node.nodeType !== 'number') {
            throw new TypeError("Failed to execute 'setStart' on 'Range': parameter 1 is not of type 'Node'.");
        }
        return { node, offset: Number(offset) || 0 };
    }

    function startIsAfterEnd(state) {
        if (!state.startContainer || !state.endContainer) return false;
        if (state.startContainer === state.endContainer) return state.startOffset > state.endOffset;
        return false;
    }

    idl.defineInterface('Range', {
        constants: { START_TO_START: 0, START_TO_END: 1, END_TO_END: 2, END_TO_START: 3 },
        attributes: {
            startContainer() { return internal(this).startContainer; },
            startOffset() { return internal(this).startOffset; },
            endContainer() { return internal(this).endContainer; },
            endOffset() { return internal(this).endOffset; },
            collapsed() {
                const state = internal(this);
                return state.startContainer === state.endContainer && state.startOffset === state.endOffset;
            },
            commonAncestorContainer() {
                const state = internal(this);
                if (!state.startContainer) return null;
                if (state.startContainer === state.endContainer) return state.startContainer;
                let node = state.startContainer;
                while (node) {
                    if (node.contains && node.contains(state.endContainer)) return node;
                    node = node.parentNode;
                }
                return null;
            }
        },
        methods: {
            setStart(node, offset = 0) { Object.assign(internal(this), { startContainer: node, startOffset: Number(offset) || 0 }); },
            setEnd(node, offset = 0) { Object.assign(internal(this), { endContainer: node, endOffset: Number(offset) || 0 }); },
            setStartBefore(node) {
                Object.assign(internal(this), { startContainer: node.parentNode, startOffset: indexOf(node) });
            },
            setStartAfter(node) {
                Object.assign(internal(this), { startContainer: node.parentNode, startOffset: indexOf(node) + 1 });
            },
            setEndBefore(node) {
                Object.assign(internal(this), { endContainer: node.parentNode, endOffset: indexOf(node) });
            },
            setEndAfter(node) {
                Object.assign(internal(this), { endContainer: node.parentNode, endOffset: indexOf(node) + 1 });
            },
            collapse(toStart = false) {
                const state = internal(this);
                if (toStart) {
                    state.endContainer = state.startContainer;
                    state.endOffset = state.startOffset;
                } else {
                    state.startContainer = state.endContainer;
                    state.startOffset = state.endOffset;
                }
            },
            selectNode(node) {
                const parent = node.parentNode;
                const index = indexOf(node);
                Object.assign(internal(this), {
                    startContainer: parent, startOffset: index, endContainer: parent, endOffset: index + 1
                });
            },
            selectNodeContents(node) {
                const length = node.childNodes ? node.childNodes.length : 0;
                Object.assign(internal(this), {
                    startContainer: node, startOffset: 0, endContainer: node, endOffset: length
                });
            },
            compareBoundaryPoints() { return 0; },
            deleteContents() {
                const state = internal(this);
                if (state.startContainer === state.endContainer && state.startContainer && state.startContainer.nodeType === 3) {
                    state.startContainer.data = state.startContainer.data.slice(0, state.startOffset);
                    state.endOffset = state.startOffset;
                }
            },
            extractContents() { return contentsOf(this, true); },
            cloneContents() { return contentsOf(this, false); },
            insertNode(node) {
                const state = internal(this);
                let container = state.startContainer;
                if (!container) return;
                if (container.nodeType === 3) container = container.parentNode;
                const reference = state.startContainer.nodeType === 3
                    ? state.startContainer : (state.startContainer.childNodes || [])[state.startOffset] || null;
                container.insertBefore(node, reference);
            },
            surroundContents(node) {
                const range = this.cloneRange();
                this.extractContents().childNodes.forEach(child => node.appendChild(child));
                this.insertNode(node);
            },
            cloneRange() {
                const state = internal(this);
                return create('Range', {
                    startContainer: state.startContainer, startOffset: state.startOffset,
                    endContainer: state.endContainer, endOffset: state.endOffset
                });
            },
            detach() {},
            isPointInRange(node, offset = 0) { return !!node; },
            comparePoint() { return 0; },
            intersectsNode(node) { return !!node; },
            toString() {
                const state = internal(this);
                const { startContainer, endContainer, startOffset, endOffset } = state;
                if (!startContainer || !endContainer) return '';
                if (startContainer === endContainer) {
                    if (startContainer.nodeType === 3) return String(startContainer.data).slice(startOffset, endOffset);
                    return Array.from(startContainer.childNodes || [])
                        .slice(startOffset, endOffset)
                        .map(child => child.textContent || '')
                        .join('');
                }
                // 两端不在同一容器：取共同祖先中两端之间的子节点文本
                const common = this.commonAncestorContainer;
                if (common && (startContainer.parentNode === common || endContainer.parentNode === common)) {
                    const children = Array.from(common.childNodes);
                    const from = startContainer.parentNode === common ? children.indexOf(startContainer) :
                        startOffset;
                    const to = endContainer.parentNode === common ? children.indexOf(endContainer) + 1 :
                        endOffset;
                    return children.slice(from, to).map(child => child.textContent || '').join('');
                }
                return common ? String(common.textContent || '') : '';
            },
            createContextualFragment(fragment) {
                const fragmentNode = document.createDocumentFragment();
                for (const node of parsing ? parsing.parseNodes(fragment) : []) fragmentNode.appendChild(node);
                return fragmentNode;
            },
            getBoundingClientRect() { return new DOMRect(0, 0, 0, 0); },
            getClientRects() { return []; }
        }
    });

    function indexOf(node) {
        const siblings = node.parentNode ? node.parentNode.childNodes : [];
        return Array.prototype.indexOf.call(siblings, node);
    }

    function contentsOf(range, extract) {
        const state = internal(range);
        const container = state.startContainer;
        const fragment = document.createDocumentFragment();
        if (!container) return fragment;
        // 同一文本节点内的选区：按偏移取子串（浏览器里 cloneContents 会返回被拆分的文本节点）
        if (container === state.endContainer && container.nodeType === 3) {
            const text = String(container.data);
            fragment.appendChild(document.createTextNode(text.slice(state.startOffset, state.endOffset)));
            if (extract) {
                container.data = text.slice(0, state.startOffset) + text.slice(state.endOffset);
                state.endOffset = state.startOffset;
            }
            return fragment;
        }
        const nodes = container.childNodes || [];
        for (let i = state.startOffset; i < nodes.length; i++) {
            const node = nodes[i];
            fragment.appendChild(extract ? node : node.cloneNode(true));
        }
        return fragment;
    }

    // ==================== Selection ====================
    idl.defineInterface('Selection', {
        attributes: {
            anchorNode() { return internal(this).anchorNode; },
            anchorOffset() { return internal(this).anchorOffset; },
            focusNode() { return internal(this).focusNode; },
            focusOffset() { return internal(this).focusOffset; },
            isCollapsed() {
                const state = internal(this);
                return state.anchorNode === state.focusNode && state.anchorOffset === state.focusOffset;
            },
            rangeCount() { return internal(this).ranges.length; },
            type() { return internal(this).ranges.length ? 'Range' : 'Caret'; },
            direction() { return internal(this).direction || 'forward'; }
        },
        methods: {
            getRangeAt(index) {
                const range = internal(this).ranges[index];
                if (!range) throw new DOMException(`Failed to execute 'getRangeAt' on 'Selection': ${index} is not a valid index.`, 'IndexSizeError');
                return range;
            },
            addRange(range) {
                const state = internal(this);
                if (!state.ranges.includes(range)) state.ranges.push(range);
                Object.assign(state, {
                    anchorNode: range.startContainer, anchorOffset: range.startOffset,
                    focusNode: range.endContainer, focusOffset: range.endOffset
                });
            },
            removeRange(range) {
                const state = internal(this);
                state.ranges = state.ranges.filter(item => item !== range);
            },
            removeAllRanges() { internal(this).ranges = []; },
            empty() { internal(this).ranges = []; },
            collapse(node = null, offset = 0) {
                const state = internal(this);
                state.ranges = [];
                Object.assign(state, { anchorNode: node, anchorOffset: offset, focusNode: node, focusOffset: offset });
            },
            setPosition(node = null, offset = 0) { this.collapse(node, offset); },
            collapseToStart() {
                const range = internal(this).ranges[0];
                if (range) this.collapse(range.startContainer, range.startOffset);
            },
            collapseToEnd() {
                const range = internal(this).ranges[0];
                if (range) this.collapse(range.endContainer, range.endOffset);
            },
            extend(node, offset = 0) {
                Object.assign(internal(this), { focusNode: node, focusOffset: offset });
            },
            setBaseAndExtent(anchorNode, anchorOffset, focusNode, focusOffset) {
                Object.assign(internal(this), { anchorNode, anchorOffset, focusNode, focusOffset });
            },
            selectAllChildren(node) {
                this.collapse(node, 0);
                this.extend(node, node.childNodes ? node.childNodes.length : 0);
            },
            deleteFromDocument() {
                for (const range of internal(this).ranges) range.deleteContents();
            },
            containsNode(node, allowPartialContainment = false) {
                const state = internal(this);
                return state.anchorNode === node || state.focusNode === node;
            },
            toString() {
                return internal(this).ranges.map(range => range.toString()).join('');
            }
        }
    });

    let windowSelection = null;
    function selection() {
        if (!windowSelection) {
            windowSelection = create('Selection', {
                ranges: [], anchorNode: null, anchorOffset: 0, focusNode: null, focusOffset: 0, direction: 'forward'
            });
        }
        return windowSelection;
    }

    const getSelectionFn = window.safefunction(function getSelection() { return selection(); }, 'getSelection');
    window.getSelection = getSelectionFn;
    // document 的方法在原型上，这里用不可枚举自有属性覆盖，避免 document 出现新的可枚举自有属性
    for (const [key, fn] of [['getSelection', getSelectionFn]]) {
        Object.defineProperty(document, key, { value: fn, writable: true, enumerable: false, configurable: true });
    }
    if (!window.__selectionFactory__) {
        Object.defineProperty(window, '__selectionFactory__', { value: selection, configurable: true });
    }

    // createRange / createTreeWalker / createNodeIterator 返回真正的接口实例
    const createRangeFn = window.safefunction(function createRange() {
        Monitor.log('DOM', 'createRange', {});
        return create('Range', {
            startContainer: null, startOffset: 0, endContainer: null, endOffset: 0
        });
    }, 'createRange');

    const createTreeWalkerFn = window.safefunction(function createTreeWalker(root, whatToShow = 0xFFFFFFFF, filter = null) {
        Monitor.log('DOM', 'createTreeWalker', { rootId: window.__nodeIdOf__?.(root), whatToShow });
        return create('TreeWalker', { root, whatToShow, filter, currentNode: root });
    }, 'createTreeWalker');

    const createNodeIteratorFn = window.safefunction(function createNodeIterator(root, whatToShow = 0xFFFFFFFF, filter = null) {
        Monitor.log('DOM', 'createNodeIterator', { rootId: window.__nodeIdOf__?.(root), whatToShow });
        return create('NodeIterator', {
            root, whatToShow, filter, referenceNode: root, pointerBeforeReferenceNode: true
        });
    }, 'createNodeIterator');

    for (const [key, fn] of [['createRange', createRangeFn], ['createTreeWalker', createTreeWalkerFn],
        ['createNodeIterator', createNodeIteratorFn]]) {
        Object.defineProperty(document, key, { value: fn, writable: true, enumerable: false, configurable: true });
    }

    // ==================== ShadowRoot ====================
    idl.defineInterface('ShadowRoot', {
        parent: 'EventTarget',
        attributes: {
            mode() { return internal(this).mode; },
            host() { return internal(this).host; },
            delegatesFocus() { return internal(this).delegatesFocus; },
            slotAssignment() { return internal(this).slotAssignment; },
            clonable() { return false; },
            serializable() { return false; }
        }
    });
    // 影子根同时是 DocumentFragment：保留片段与节点的方法
    Object.setPrototypeOf(idl.interfaceObject('ShadowRoot').prototype,
        Object.getPrototypeOf(document.createDocumentFragment()));

    // 不能挂影子根的宿主元素（与浏览器一致）
    const shadowHostExclusions = new Set(['a', 'area', 'base', 'br', 'col', 'embed', 'head', 'hr', 'img',
        'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
    const shadowRoots = new WeakMap();

    const innerHTMLDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    if (innerHTMLDescriptor) Object.defineProperty(idl.interfaceObject('ShadowRoot').prototype, 'innerHTML', innerHTMLDescriptor);

    Element.prototype.attachShadow = window.safefunction(function attachShadow(options = {}) {
        Monitor.log('DOM', 'attachShadow', { elementId: window.__nodeIdOf__?.(this), options });
        if (shadowHostExclusions.has(this.localName)) {
            throw new DOMException(`Failed to execute 'attachShadow' on 'Element': This element does not support attachShadow`,
                'NotSupportedError');
        }
        if (shadowRoots.has(this)) {
            throw new DOMException(`Failed to execute 'attachShadow' on 'Element': Shadow root cannot be created on a host `
                + 'which already hosts a shadow tree.', 'NotSupportedError');
        }
        const root = document.createDocumentFragment();
        idl.implement(root, 'ShadowRoot', {
            mode: options.mode === 'closed' ? 'closed' : 'open',
            host: this, delegatesFocus: !!options.delegatesFocus,
            slotAssignment: options.slotAssignment === 'manual' ? 'manual' : 'named'
        });
        shadowRoots.set(this, root);
        return root;
    }, 'attachShadow');

    Object.defineProperty(Element.prototype, 'shadowRoot', {
        get: window.safefunction(function () {
            const root = shadowRoots.get(this);
            return root && internal(root).mode === 'open' ? root : null;
        }, 'get shadowRoot'),
        enumerable: true, configurable: true
    });

    // ==================== DocumentType / XMLDocument ====================
    const Node = window.Node;
    const stateOf = node => parsing.stateOf(node);

    function DocumentType() { throw new TypeError('Illegal constructor'); }
    DocumentType.prototype = Object.create(Node.prototype);
    DocumentType.prototype.constructor = DocumentType;
    Object.defineProperty(DocumentType.prototype, Symbol.toStringTag, { value: 'DocumentType', configurable: true });
    for (const key of ['name', 'publicId', 'systemId']) {
        Object.defineProperty(DocumentType.prototype, key, {
            get() { return stateOf(this)[key]; },
            enumerable: true, configurable: true
        });
    }
    window.DocumentType = DocumentType;

    function createDocumentType(name, publicId = '', systemId = '') {
        return parsing.createNode(DocumentType.prototype, 10, String(name),
            { name: String(name), publicId: String(publicId), systemId: String(systemId) });
    }

    // document.doctype 是真正的 DocumentType 节点
    const documentPrototype = Object.getPrototypeOf(document);
    const documentImplementation = document.implementation;
    if (documentImplementation && typeof documentImplementation.createDocumentType === 'function') {
        document.implementation.createDocumentType = window.safefunction(function createDocumentTypeMethod(name, publicId, systemId) {
            return createDocumentType(name, publicId, systemId);
        }, 'createDocumentType');
    }
    Object.defineProperty(document, 'doctype', {
        value: createDocumentType('html'), writable: true, enumerable: false, configurable: true
    });

    function XMLDocument() { throw new TypeError('Illegal constructor'); }
    XMLDocument.prototype = Object.create(Object.getPrototypeOf(documentPrototype));
    XMLDocument.prototype.constructor = XMLDocument;
    Object.defineProperty(XMLDocument.prototype, Symbol.toStringTag, { value: 'XMLDocument', configurable: true });
    window.XMLDocument = XMLDocument;

    // ==================== XML 解析 ====================
    // text/html 之外的类型走这个小型 XML 解析器（支持命名空间、CDATA、注释、PI、实体）
    const elementNamespaces = new WeakMap();
    function internalNamespaces(element) { return elementNamespaces.get(element) || []; }

    const XML_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: String.fromCharCode(39), nbsp: '\u00a0' };

    function decodeXML(text) {
        return String(text).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (all, entity) => {
            if (entity[0] === '#') {
                const code = entity[1] === 'x' || entity[1] === 'X'
                    ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
                return Number.isFinite(code) ? String.fromCodePoint(code) : all;
            }
            return XML_ENTITIES[entity] !== undefined ? XML_ENTITIES[entity] : all;
        });
    }

    function parseXMLInto(text, documentObject) {
        const source = String(text);
        const stack = [];
        let root = null;
        let index = 0;
        const push = node => {
            const parent = stack[stack.length - 1];
            if (parent) parent.appendChild(node);
            else if (!root && node.nodeType === 1) root = node;
        };
        while (index < source.length) {
            const open = source.indexOf('<', index);
            if (open < 0) {
                const text_ = source.slice(index);
                if (text_.trim() && stack.length) push(document.createTextNode(decodeXML(text_)));
                break;
            }
            if (open > index && stack.length) {
                const text_ = source.slice(index, open);
                if (text_.trim()) push(document.createTextNode(decodeXML(text_)));
            }
            if (source.startsWith('<!--', open)) {
                const end = source.indexOf('-->', open);
                const value = source.slice(open + 4, end < 0 ? source.length : end);
                push(document.createComment(value));
                index = end < 0 ? source.length : end + 3;
                continue;
            }
            if (source.startsWith('<![CDATA[', open)) {
                const end = source.indexOf(']]>', open);
                const value = source.slice(open + 9, end < 0 ? source.length : end);
                push(document.createTextNode(value));
                index = end < 0 ? source.length : end + 3;
                continue;
            }
            if (source.startsWith('<!DOCTYPE', open) || source.startsWith('<?', open)) {
                const end = source.indexOf('>', open);
                index = end < 0 ? source.length : end + 1;
                continue;
            }
            const close = source.indexOf('>', open);
            if (close < 0) break;
            const tag = source.slice(open + 1, close);
            if (tag.startsWith('/')) {
                stack.pop();
                index = close + 1;
                continue;
            }
            const selfClosing = tag.endsWith('/');
            const body = selfClosing ? tag.slice(0, -1) : tag;
            const nameMatch = body.match(/^([^\s]+)/);
            if (!nameMatch) { index = close + 1; continue; }
            const qualified = nameMatch[1];
            const attributes = [];
            const attributePattern = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
            let attribute;
            while ((attribute = attributePattern.exec(body)) !== null) {
                attributes.push([attribute[1], decodeXML(attribute[3] !== undefined ? attribute[3] : attribute[4] || '')]);
            }
            // 命名空间作用域：xmlns / xmlns:prefix 在元素上生效
            const namespaces = new Map(stack.length ? internalNamespaces(stack[stack.length - 1]) : []);
            for (const [attributeName, value] of attributes) {
                if (attributeName === 'xmlns') namespaces.set('', value);
                else if (attributeName.startsWith('xmlns:')) namespaces.set(attributeName.slice(6), value);
            }
            const prefix = qualified.includes(':') ? qualified.slice(0, qualified.indexOf(':')) : '';
            const element = documentObject.createElementNS(namespaces.get(prefix) || null, qualified);
            elementNamespaces.set(element, namespaces);
            for (const [attributeName, value] of attributes) element.setAttribute(attributeName, value);
            push(element);
            if (!selfClosing) stack.push(element);
            index = close + 1;
        }
        return root;
    }

    // ==================== DOMParser / XMLSerializer ====================
    // 片段解析会丢掉 html/head/body 外壳（与 innerHTML 一致），这里按 HTML 解析规则重建文档结构
    const HEAD_TAGS = new Set(['title', 'meta', 'link', 'style', 'base']);

    function doctypeOf(source) {
        const match = /<!DOCTYPE\s+([^\s>]+)(?:(?:\s+PUBLIC\s+"([^"]*)"(?:\s+"([^"]*)")?)|(?:\s+SYSTEM\s+"([^"]*)"))?/i
            .exec(String(source || ''));
        if (!match) return null;
        return createDocumentType(match[1], match[2] || '', match[3] || match[4] || '');
    }

    function createParsedDocument(nodes, type, source) {
        const isXML = String(type).toLowerCase() !== 'text/html';
        const parsed = Object.create(isXML ? XMLDocument.prototype : documentPrototype);
        Object.defineProperty(parsed, 'doctype', {
            value: doctypeOf(source), enumerable: true, configurable: true
        });
        let documentElement;
        let head = null;
        let body = null;
        if (isXML) {
            documentElement = nodes.find(node => node.nodeType === 1) || document.createElement('parsererror');
        } else {
            documentElement = document.createElement('html');
            head = document.createElement('head');
            body = document.createElement('body');
            documentElement.appendChild(head);
            documentElement.appendChild(body);
            for (const node of nodes) {
                if (node.nodeType === 1 && HEAD_TAGS.has(node.localName)) head.appendChild(node);
                else if (node.nodeType === 3 && !String(node.data).trim()) continue;
                else body.appendChild(node);
            }
        }
        const titleElement = head ? Array.from(head.getElementsByTagName('title'))[0] : null;
        Object.defineProperties(parsed, {
            nodeType: { value: 9, enumerable: true, configurable: true },
            nodeName: { value: '#document', enumerable: true, configurable: true },
            documentElement: { value: documentElement, enumerable: true, configurable: true },
            head: { value: head, enumerable: true, configurable: true },
            body: { value: body, enumerable: true, configurable: true },
            contentType: { value: isXML ? 'application/xml' : 'text/html', enumerable: true, configurable: true },
            characterSet: { value: 'UTF-8', enumerable: true, configurable: true },
            compatMode: { value: isXML ? 'CSS1Compat' : 'BackCompat', enumerable: true, configurable: true },
            readyState: { value: 'complete', enumerable: true, configurable: true },
            URL: { value: location.href, enumerable: true, configurable: true },
            documentURI: { value: location.href, enumerable: true, configurable: true },
            location: { value: location, enumerable: true, configurable: true },
            defaultView: { value: window, enumerable: true, configurable: true },
            title: {
                get() { return titleElement ? titleElement.textContent : ''; },
                set(value) {
                    if (!head) return;
                    let element = Array.from(head.getElementsByTagName('title'))[0];
                    if (!element) {
                        element = document.createElement('title');
                        head.appendChild(element);
                    }
                    element.textContent = String(value);
                },
                enumerable: true, configurable: true
            },
            querySelector: { value: selector => documentElement.querySelector(selector), enumerable: true, configurable: true },
            querySelectorAll: { value: selector => documentElement.querySelectorAll(selector), enumerable: true, configurable: true },
            getElementById: { value: id => documentElement.querySelector(`#${id}`), enumerable: true, configurable: true },
            getElementsByTagName: { value: name => documentElement.getElementsByTagName(name), enumerable: true, configurable: true },
            getElementsByClassName: { value: name => documentElement.getElementsByClassName(name), enumerable: true, configurable: true },
            createElement: { value: name => document.createElement(name), enumerable: true, configurable: true },
            createTextNode: { value: text => document.createTextNode(text), enumerable: true, configurable: true },
            createDocumentFragment: { value: () => document.createDocumentFragment(), enumerable: true, configurable: true },
            addEventListener: { value: () => {}, enumerable: true, configurable: true },
            removeEventListener: { value: () => {}, enumerable: true, configurable: true },
            dispatchEvent: { value: () => true, enumerable: true, configurable: true }
        });
        idl.brand(parsed, 'EventTarget', { ownerDocument: document });
        return parsed;
    }

    function createXMLDocument(parsed, root, source, type) {
        const isHTML = String(type || '').toLowerCase() === 'text/html';
        const doctype = doctypeOf(source);
        Object.defineProperties(parsed, {
            nodeType: { value: 9, enumerable: true, configurable: true },
            nodeName: { value: '#document', enumerable: true, configurable: true },
            documentElement: { value: root, enumerable: true, configurable: true },
            doctype: { value: doctype, enumerable: true, configurable: true },
            head: { value: null, enumerable: true, configurable: true },
            body: { value: null, enumerable: true, configurable: true },
            contentType: { value: isHTML ? 'text/html' : 'application/xml', enumerable: true, configurable: true },
            characterSet: { value: 'UTF-8', enumerable: true, configurable: true },
            compatMode: { value: 'CSS1Compat', enumerable: true, configurable: true },
            readyState: { value: 'complete', enumerable: true, configurable: true },
            URL: { value: location.href, enumerable: true, configurable: true },
            documentURI: { value: location.href, enumerable: true, configurable: true },
            location: { value: location, enumerable: true, configurable: true },
            defaultView: { value: window, enumerable: true, configurable: true },
            title: { get() { return ''; }, set() {}, enumerable: true, configurable: true },
            querySelector: { value: selector => root.querySelector(selector), enumerable: true, configurable: true },
            querySelectorAll: { value: selector => root.querySelectorAll(selector), enumerable: true, configurable: true },
            getElementById: { value: id => root.querySelector(`#${id}`), enumerable: true, configurable: true },
            getElementsByTagName: { value: name => root.getElementsByTagName(name), enumerable: true, configurable: true },
            getElementsByTagNameNS: {
                value: (namespace, name) => root.getElementsByTagNameNS
                    ? root.getElementsByTagNameNS(namespace, name) : root.getElementsByTagName(name),
                enumerable: true, configurable: true
            },
            createElement: { value: name => document.createElement(name), enumerable: true, configurable: true },
            createElementNS: { value: (ns, name) => document.createElementNS(ns, name), enumerable: true, configurable: true },
            createTextNode: { value: text => document.createTextNode(text), enumerable: true, configurable: true },
            createDocumentFragment: { value: () => document.createDocumentFragment(), enumerable: true, configurable: true },
            addEventListener: { value: () => {}, enumerable: true, configurable: true },
            removeEventListener: { value: () => {}, enumerable: true, configurable: true },
            dispatchEvent: { value: () => true, enumerable: true, configurable: true }
        });
        idl.brand(parsed, 'EventTarget', { ownerDocument: document });
        return parsed;
    }

    idl.defineInterface('DOMParser', {
        construct() {},
        methods: {
            parseFromString(string, type = 'text/html') {
                Monitor.logCall('DOMParser.parseFromString', [type], '[Document]');
                const text = String(string);
                if (String(type).toLowerCase() === 'text/html') {
                    return createParsedDocument(parsing ? parsing.parseNodes(text) : [], type, text);
                }
                const parsed = Object.create(XMLDocument.prototype);
                const root = parseXMLInto(text, document);
                if (!root) {
                    const error = document.createElementNS(null, 'parsererror');
                    error.textContent = 'XML parsing error';
                    return createXMLDocument(parsed, error, text, type);
                }
                return createXMLDocument(parsed, root, text, type);
            }
        }
    });

    // ==================== Document 的 ParentNode 成员 ====================
    function elementChildren(node) {
        return Array.from(node.childNodes).filter(child => child.nodeType === 1);
    }
    for (const [key, get] of [
        ['children', () => parsing.collection(() => elementChildren(document))],
        ['firstElementChild', () => elementChildren(document)[0] || null],
        ['lastElementChild', () => elementChildren(document).slice(-1)[0] || null],
        ['childElementCount', () => elementChildren(document).length]
    ]) {
        Object.defineProperty(document, key, {
            get: window.safefunction(get, 'get ' + key), enumerable: false, configurable: true
        });
    }

    // ==================== getComputedStyle ====================
    // 计算样式在浏览器里是只读的 CSSStyleDeclaration：先把行内样式与默认值算好，再按属性名读取
    const NONE_DISPLAY_TAGS = new Set(['head', 'meta', 'link', 'title', 'style', 'script', 'base',
        'template', 'param', 'source', 'track', 'datalist']);
    const INLINE_DISPLAY_TAGS = new Set(['span', 'a', 'b', 'i', 'em', 'strong', 'small', 'code',
        'label', 'img', 'input', 'select', 'textarea', 'button', 'br', 'output', 'time',
        'data', 'slot', 'sub', 'sup', 'u', 's', 'mark', 'abbr', 'cite', 'q', 'dfn',
        'kbd', 'samp', 'var', 'ruby', 'rt', 'wbr']);
    const COMPUTED_DEFAULTS = {
        position: 'static', visibility: 'visible', opacity: '1', color: 'rgb(0, 0, 0)',
        backgroundColor: 'rgba(0, 0, 0, 0)', fontSize: '16px', fontFamily: 'sans-serif',
        fontWeight: '400', lineHeight: 'normal', textAlign: 'start', width: 'auto', height: 'auto',
        margin: '0px', padding: '0px', border: '', transform: 'none', transition: '',
        overflow: 'visible', float: 'none', cursor: 'auto', zIndex: 'auto',
        boxSizing: 'content-box', direction: 'ltr', whiteSpace: 'normal', textTransform: 'none',
        letterSpacing: 'normal', wordSpacing: '0px', verticalAlign: 'baseline', maxWidth: 'none',
        maxHeight: 'none', minWidth: '0px', minHeight: '0px'
    };

    function displayOf(element) {
        const tag = element.localName;
        if (NONE_DISPLAY_TAGS.has(tag)) return 'none';
        if (tag === 'html' || tag === 'body') return 'block';
        return INLINE_DISPLAY_TAGS.has(tag) ? 'inline' : 'block';
    }

    // 会被继承的属性（计算子元素时先取祖先的声明）
    const INHERITED_PROPERTIES = new Set(['color', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle',
        'fontVariant', 'lineHeight', 'textAlign', 'visibility', 'direction', 'letterSpacing',
        'wordSpacing', 'whiteSpace', 'textTransform', 'cursor', 'textIndent', 'listStyleType',
        'quotes', 'textRendering']);

    function camelOf(property) {
        return String(property).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    }

    // 简化版选择器权重：#id 最高，.class/[attr]/:pseudo 次之，标签最低
    function specificityOf(selector) {
        const ids = (selector.match(/#[\w-]+/g) || []).length;
        const classes = (selector.match(/\.[\w-]+|\[[^\]]*\]|:[\w-]+/g) || []).length;
        const types = (selector.match(/(^|[\s>+~,])[a-zA-Z][\w-]*/g) || []).length;
        return ids * 10000 + classes * 100 + types;
    }

    function applyDeclaration(style, cascade, inheritedOnly) {
        if (!style) return;
        const count = style.length || 0;
        for (let index = 0; index < count; index++) {
            const property = style.item(index);
            if (!property) continue;
            const key = camelOf(property);
            if (inheritedOnly && !INHERITED_PROPERTIES.has(key)) continue;
            const important = style.getPropertyPriority(property) === 'important';
            // 已被 !important 定下的值，普通声明不能覆盖
            if (cascade.important.has(key) && !important) continue;
            cascade.properties.set(key, style.getPropertyValue(property));
            if (important) cascade.important.add(key);
        }
    }

    // 收集命中的规则（含 @media 内嵌套），带权重与文档顺序
    function collectRules(rules, element, matched, counter, inheritedOnly) {
        for (const rule of rules) {
            const state = internal(rule);
            if (!state) continue;
            if (state.type === 4 && state.rules) {
                collectRules(state.rules, element, matched, counter, inheritedOnly);
                continue;
            }
            if (state.type !== 1 || !state.selectorText) continue;
            let isMatch = false;
            try { isMatch = element.matches(state.selectorText); } catch (error) { isMatch = false; }
            if (!isMatch) continue;
            // 祖先元素只参与可继承属性，权重固定为 0（继承值总在最底层）
            matched.push({
                specificity: inheritedOnly ? 0 : specificityOf(state.selectorText),
                order: counter.value++, style: state.style
            });
        }
    }

    // 计算样式 = 祖先与自身的样式表规则 + 行内样式，再回落到默认值
    function computedDeclaration(element, pseudoElement) {
        const properties = new Map();
        const chain = [];
        for (let node = element; node && node.nodeType === 1; node = node.parentNode) chain.unshift(node);
        const cssom = window.__cssom__;
        const cascade = { properties, important: new Set() };
        for (const node of chain) {
            const isSelf = node === element;
            const inheritedOnly = !isSelf;
            const matched = [];
            const counter = { value: 0 };
            if (cssom) {
                // 文档顺序在前：只有权重相同才看顺序
                for (const sheet of cssom.sheetsOf()) collectRules(cssom.rulesOf(sheet), node, matched, counter, inheritedOnly);
            }
            matched.sort((first, second) => first.specificity - second.specificity || first.order - second.order);
            for (const entry of matched) applyDeclaration(entry.style, cascade, inheritedOnly);
            // 行内样式权重最高
            applyDeclaration(node.style, cascade, inheritedOnly);
        }
        for (const [key, fallback] of Object.entries(COMPUTED_DEFAULTS)) {
            if (!properties.has(key)) properties.set(key, fallback);
        }
        // display 不继承：没有规则/行内样式时按标签给出默认值
        if (!properties.get('display')) properties.set('display', displayOf(element));
        properties.set('pseudoElement', pseudoElement === undefined || pseudoElement === null ? '' : String(pseudoElement));

        const target = Object.create(window.CSSStyleDeclaration.prototype);
        Object.defineProperties(target, {
            length: { get: () => properties.size, enumerable: true, configurable: true },
            cssText: { get: () => '', enumerable: true, configurable: true },
            parentRule: { get: () => null, enumerable: true, configurable: true },
            getPropertyValue: {
                value: property => properties.get(String(property)) ?? '',
                writable: true, enumerable: true, configurable: true
            },
            getPropertyPriority: { value: () => '', writable: true, enumerable: true, configurable: true },
            setProperty: { value: () => {}, writable: true, enumerable: true, configurable: true },
            removeProperty: { value: () => '', writable: true, enumerable: true, configurable: true },
            item: {
                value: index => Array.from(properties.keys())[Number(index)] ?? '',
                writable: true, enumerable: true, configurable: true
            }
        });
        return new Proxy(target, {
            get(object, key) {
                if (typeof key === 'symbol' || key in object) return Reflect.get(object, key);
                if (typeof key === 'string') {
                    if (properties.has(key)) return properties.get(key);
                    const dashed = key.replace(/([A-Z])/g, '-$1').toLowerCase();
                    if (properties.has(dashed)) return properties.get(dashed);
                    return '';
                }
                return undefined;
            }
        });
    }

    window.getComputedStyle = window.safefunction(function getComputedStyle(element, pseudoElement = null) {
        const WindowMonitor = window.__EnvMonitor__;
        WindowMonitor?.log('Window', 'getComputedStyle', {
            elementId: window.__nodeIdOf__?.(element), pseudoElement
        });
        const mock = WindowMonitor?.executeMock('window.getComputedStyle', [element, pseudoElement]);
        if (mock && mock.mocked) return mock.result;
        if (!element || element.nodeType !== 1) {
            throw new TypeError("Failed to execute 'getComputedStyle' on 'Window': parameter 1 is not of type 'Element'.");
        }
        return computedDeclaration(element, pseudoElement);
    }, 'getComputedStyle');

    idl.defineInterface('XMLSerializer', {
        construct() {},
        methods: {
            serializeToString(node) {
                Monitor.logCall('XMLSerializer.serializeToString', [node], 'string');
                if (!node || typeof node.nodeType !== 'number') {
                    throw new TypeError("Failed to execute 'serializeToString' on 'XMLSerializer': parameter 1 is not of type 'Node'.");
                }
                return parsing ? parsing.serialize(node) : '';
            }
        }
    });
})();
