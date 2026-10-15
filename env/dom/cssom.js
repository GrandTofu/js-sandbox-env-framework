/**
 * @env-module cssom
 * @description CSSOM：StyleSheet / CSSStyleSheet / CSSRule / CSSStyleRule / CSSMediaRule / CSSRuleList /
 * StyleSheetList / MediaList，并让 document.styleSheets 与 <style>.sheet 真正反映样式表内容。
 * @compatibility Chrome 120+
 *
 * 依赖：WebIDL.js、document.js（__cssStyleDeclarationClass__）、elements.js（HTMLStyleElement/HTMLLinkElement）。
 */
(function () {
    'use strict';

    const idl = window.__webidl__;
    const Monitor = window.__EnvMonitor__ || { log() {}, logCall() {} };
    const create = idl.create;
    const internal = idl.internal;
    const CSSStyleDeclaration = window.__cssStyleDeclarationClass__;

    // ==================== MediaList ====================
    idl.defineInterface('MediaList', {
        attributes: {
            mediaText: {
                get() { return internal(this).media.join(', '); },
                set(value) {
                    internal(this).media = String(value).split(',').map(part => part.trim()).filter(Boolean);
                }
            },
            length() { return internal(this).media.length; }
        },
        methods: {
            item(index) { return internal(this).media[Number(index)] ?? null; },
            appendMedium(medium) {
                const list = internal(this).media;
                const text = String(medium);
                if (!list.includes(text)) list.push(text);
            },
            deleteMedium(medium) {
                const list = internal(this).media;
                const index = list.indexOf(String(medium));
                if (index >= 0) list.splice(index, 1);
            }
        }
    });

    function mediaList(text) {
        return create('MediaList', {
            media: String(text || '').split(',').map(part => part.trim()).filter(Boolean)
        });
    }

    // ==================== 规则 ====================
    idl.defineInterface('CSSRule', {
        constants: {
            STYLE_RULE: 1, CHARSET_RULE: 2, IMPORT_RULE: 3, MEDIA_RULE: 4, FONT_FACE_RULE: 5,
            PAGE_RULE: 6, KEYFRAMES_RULE: 7, KEYFRAME_RULE: 8, NAMESPACE_RULE: 10,
            SUPPORTS_RULE: 12, DOCUMENT_RULE: 13
        },
        attributes: {
            type() { return internal(this).type; },
            cssText: {
                get() { return internal(this).cssText(); },
                set(value) {
                    const rule = parseRule(String(value));
                    if (rule) Object.assign(internal(this), rule);
                }
            },
            parentStyleSheet() { return internal(this).parentStyleSheet; },
            parentRule() { return internal(this).parentRule; }
        }
    });

    idl.defineInterface('CSSStyleRule', {
        parent: 'CSSRule',
        attributes: {
            selectorText: {
                get() { return internal(this).selectorText; },
                set(value) { internal(this).selectorText = String(value); }
            },
            style() { return internal(this).style; }
        }
    });

    idl.defineInterface('CSSMediaRule', {
        parent: 'CSSRule',
        attributes: {
            media() { return internal(this).media; },
            conditionText() { return internal(this).conditionText; },
            cssRules() { return internal(this).ruleList; }
        },
        methods: {
            insertRule(rule, index = 0) { return insertRuleInto(internal(this).rules, rule, index, internal(this).parentStyleSheet); },
            deleteRule(index) {
                const rules = internal(this).rules;
                const at = Number(index) || 0;
                if (at < 0 || at >= rules.length) {
                    throw new DOMException('Failed to execute \'deleteRule\' on \'CSSMediaRule\': the index is out of range', 'IndexSizeError');
                }
                rules.splice(at, 1);
            }
        }
    });

    // 其余 CSS 规则接口：常量与 CSSRule 一致，属性按需提供，序列化返回空（无采集需求）
    function atRuleInterface(name, extraAttributes = {}) {
        idl.defineInterface(name, {
            parent: 'CSSRule',
            attributes: Object.assign({
                cssText() { return ''; },
                cssRules() { return internal(this).ruleList || ruleList([]); },
                conditionText() { return internal(this).conditionText || ''; }
            }, extraAttributes)
        });
    }
    atRuleInterface('CSSKeyframesRule', {
        name() { return internal(this).name || ''; },
        cssRules() { return internal(this).ruleList || ruleList([]); }
    });
    atRuleInterface('CSSKeyframeRule', {
        keyText() { return internal(this).keyText || ''; }
    });
    atRuleInterface('CSSFontFaceRule');
    atRuleInterface('CSSSupportsRule');
    atRuleInterface('CSSNamespaceRule', {
        namespaceURI() { return internal(this).namespaceURI || ''; },
        prefix() { return internal(this).prefix || ''; }
    });
    atRuleInterface('CSSPageRule');

    // ==================== 列表 ====================
    idl.defineInterface('CSSRuleList', {
        attributes: { length() { return this.__entries__.length; } },
        methods: { item(index) { return this.__entries__[Number(index)] ?? null; } }
    });
    Object.defineProperty(idl.interfaceObject('CSSRuleList').prototype, Symbol.iterator, {
        value: function () { return this.__entries__[Symbol.iterator](); }, configurable: true
    });

    function ruleList(rules) {
        const list = create('CSSRuleList', {});
        Object.defineProperty(list, '__entries__', { value: rules, configurable: true });
        rules.forEach((rule, index) => {
            Object.defineProperty(list, index, { value: rule, enumerable: true, configurable: true });
        });
        return list;
    }

    idl.defineInterface('StyleSheetList', {
        attributes: { length() { return this.__entries__.length; } },
        methods: { item(index) { return this.__entries__[Number(index)] ?? null; } }
    });
    Object.defineProperty(idl.interfaceObject('StyleSheetList').prototype, Symbol.iterator, {
        value: function () { return this.__entries__[Symbol.iterator](); }, configurable: true
    });

    // ==================== 解析 ====================
    function declarationsOf(text) {
        const declaration = new CSSStyleDeclaration(null);
        for (const chunk of String(text).split(';')) {
            const colon = chunk.indexOf(':');
            if (colon < 0) continue;
            const property = chunk.slice(0, colon).trim();
            const value = chunk.slice(colon + 1).trim();
            if (!property || !value) continue;
            declaration.setProperty(property, value.replace(/\s*!important$/i, ''),
                /!important\s*$/i.test(value) ? 'important' : '');
        }
        return declaration;
    }

    function parseRule(text) {
        const source = String(text).trim();
        const open = source.indexOf('{');
        if (open < 0) return null;
        const prelude = source.slice(0, open).trim();
        const close = source.lastIndexOf('}');
        const body = source.slice(open + 1, close < 0 ? source.length : close);
        if (prelude.startsWith('@media')) {
            const condition = prelude.slice(6).trim();
            const rules = parseRuleList(body, null);
            return { type: 4, media: mediaList(condition), conditionText: condition, rules, ruleList: ruleList(rules) };
        }
        if (prelude.startsWith('@')) return null;
        return { type: 1, selectorText: prelude, declaration: declarationsOf(body) };
    }

    function createRule(parsed, parentStyleSheet, parentRule) {
        if (!parsed) return null;
        if (parsed.type === 4) {
            const rule = create('CSSMediaRule', { parentStyleSheet, parentRule });
            Object.assign(internal(rule), parsed, {
                cssText() {
                    const body = this.rules.map(child => internal(child).cssText()).join(' ');
                    return `@media ${this.media.mediaText} { ${body} }`;
                }
            });
            parsed.rules.forEach(child => Object.assign(internal(child), { parentRule: rule }));
            return rule;
        }
        const rule = create('CSSStyleRule', { parentStyleSheet, parentRule, type: 1 });
        Object.assign(internal(rule), {
            selectorText: parsed.selectorText, type: 1,
            style: parsed.declaration,
            cssText() { return `${this.selectorText} { ${this.style.cssText} }`; }
        });
        // 规则样式表的 parentRule 指向所属规则（经内部字段，避免污染 cssText 序列化）
        parsed.declaration._parentRule = rule;
        return rule;
    }

    function parseRuleList(text, sheet) {
        const rules = [];
        let index = 0;
        const source = String(text);
        while (index < source.length) {
            const open = source.indexOf('{', index);
            if (open < 0) break;
            let depth = 0;
            let close = -1;
            for (let i = open; i < source.length; i++) {
                if (source[i] === '{') depth++;
                else if (source[i] === '}') {
                    depth--;
                    if (depth === 0) { close = i; break; }
                }
            }
            if (close < 0) break;
            const rule = createRule(parseRule(source.slice(index, close + 1)), sheet, null);
            if (rule) rules.push(rule);
            index = close + 1;
        }
        return rules;
    }

    function insertRuleInto(rules, ruleText, index, sheet) {
        const at = Number(index) || 0;
        if (at < 0 || at > rules.length) {
            throw new DOMException(`Failed to execute 'insertRule' on 'CSSStyleSheet': the index (${at}) is larger than the length of the rule list.`, 'IndexSizeError');
        }
        const rule = createRule(parseRule(ruleText), sheet, null);
        if (!rule) {
            throw new DOMException(`Failed to execute 'insertRule' on 'CSSStyleSheet': Failed to parse the rule '${ruleText}'.`, 'SyntaxError');
        }
        rules.splice(at, 0, rule);
        return at;
    }

    // ==================== CSSStyleSheet ====================
    idl.defineInterface('StyleSheet', {
        attributes: {
            type() { return internal(this).type; },
            href() { return internal(this).href; },
            title() { return internal(this).title; },
            ownerNode() { return internal(this).ownerNode; },
            parentStyleSheet() { return internal(this).parentStyleSheet; },
            disabled: {
                get() { return internal(this).disabled; },
                set(value) { internal(this).disabled = !!value; }
            }
        }
    });

    idl.defineInterface('CSSStyleSheet', {
        parent: 'StyleSheet',
        methods: {
            insertRule(rule, index = 0) {
                const sheet = internal(this);
                sheet.rules = currentRules(this);
                const inserted = insertRuleInto(sheet.rules, rule, index, this);
                sheet.parsedText = sheet.ownerNode ? sheet.ownerNode.textContent : sheet.parsedText;
                sheet.ruleList = ruleList(sheet.rules);
                return inserted;
            },
            deleteRule(index) {
                const sheet = internal(this);
                sheet.rules = currentRules(this);
                const at = Number(index) || 0;
                if (at < 0 || at >= sheet.rules.length) {
                    throw new DOMException(`Failed to execute 'deleteRule' on 'CSSStyleSheet': the index (${at}) is larger than the length of the rule list.`, 'IndexSizeError');
                }
                sheet.rules.splice(at, 1);
                sheet.ruleList = ruleList(sheet.rules);
            },
            replace(text) {
                const sheet = internal(this);
                sheet.rules = parseRuleList(text, this);
                sheet.parsedText = String(text);
                sheet.ruleList = ruleList(sheet.rules);
                return Promise.resolve(this);
            },
            replaceSync(text) {
                const sheet = internal(this);
                sheet.rules = parseRuleList(text, this);
                sheet.parsedText = String(text);
                sheet.ruleList = ruleList(sheet.rules);
            }
        },
        attributes: {
            cssRules() {
                const sheet = internal(this);
                currentRules(this);
                return sheet.ruleList;
            },
            rules() { return this.cssRules; },
            ownerRule() { return null; },
            media() { return internal(this).media; }
        }
    });

    // 样式表内容来自 <style> 的文本；文本变化时重新解析（insertRule 之后不会再被覆盖）
    function currentRules(sheetObject) {
        const sheet = internal(sheetObject);
        const text = sheet.ownerNode ? sheet.ownerNode.textContent : sheet.parsedText;
        if (sheet.parsedText !== text || !sheet.ruleList) {
            sheet.parsedText = text;
            sheet.rules = parseRuleList(text, sheetObject);
            sheet.ruleList = ruleList(sheet.rules);
        }
        return sheet.rules;
    }

    function createStyleSheet(ownerNode, text) {
        const sheet = create('CSSStyleSheet', {
            type: 'text/css', href: null, title: null, ownerNode, parentStyleSheet: null,
            disabled: false, media: mediaList(ownerNode ? ownerNode.getAttribute('media') || '' : '')
        });
        Object.assign(internal(sheet), { parsedText: null, rules: [], ruleList: null });
        if (text !== undefined) internal(sheet).parsedText = null;
        return sheet;
    }

    const sheets = new WeakMap();
    function sheetOf(element) {
        if (!sheets.has(element)) sheets.set(element, createStyleSheet(element));
        const sheet = sheets.get(element);
        const media = element.getAttribute('media') || '';
        if (internal(sheet).media.mediaText !== media) internal(sheet).media = mediaList(media);
        return sheet;
    }

    // ==================== 接线 ====================
    window.CSSStyleSheet = idl.interfaceObject('CSSStyleSheet');

    Object.defineProperty(document, 'styleSheets', {
        get: window.safefunction(function () {
            const entries = [];
            for (const element of document.querySelectorAll('style, link[rel~="stylesheet"]')) {
                entries.push(element.localName === 'style' ? sheetOf(element) : createStyleSheet(element));
            }
            const list = create('StyleSheetList', {});
            Object.defineProperty(list, '__entries__', { value: entries, configurable: true });
            entries.forEach((sheet, index) => {
                Object.defineProperty(list, index, { value: sheet, enumerable: true, configurable: true });
            });
            return list;
        }, 'get styleSheets'),
        enumerable: false, configurable: true
    });

    const HTMLStyleElement = window.HTMLStyleElement;
    if (HTMLStyleElement) {
        Object.defineProperty(HTMLStyleElement.prototype, 'sheet', {
            get: window.safefunction(function () {
                Monitor.log('CSSOM', 'style.sheet', { elementId: window.__nodeIdOf__?.(this) });
                return sheetOf(this);
            }, 'get sheet'),
            enumerable: true, configurable: true
        });
        Object.defineProperty(HTMLStyleElement.prototype, 'media', {
            get() { return this.getAttribute('media') ?? ''; },
            set(value) { this.setAttribute('media', String(value)); },
            enumerable: true, configurable: true
        });
        Object.defineProperty(HTMLStyleElement.prototype, 'disabled', {
            get() { return internal(sheetOf(this)).disabled; },
            set(value) { internal(sheetOf(this)).disabled = !!value; },
            enumerable: true, configurable: true
        });
    }

    const HTMLLinkElement = window.HTMLLinkElement;
    if (HTMLLinkElement) {
        // 没有网络：link 样式表始终是空的
        Object.defineProperty(HTMLLinkElement.prototype, 'sheet', {
            get: window.safefunction(function () {
                const rel = (this.getAttribute('rel') || '').toLowerCase().split(/\s+/);
                if (!rel.includes('stylesheet')) return null;
                return sheetOf(this);
            }, 'get sheet'),
            enumerable: true, configurable: true
        });
    }

    // 供 getComputedStyle 使用：按文档顺序取出所有生效的样式规则
    Object.defineProperty(window, '__cssom__', {
        value: Object.freeze({
            sheetsOf() {
                const result = [];
                for (const element of document.querySelectorAll('style, link[rel~="stylesheet"]')) {
                    const sheet = sheetOf(element);
                    if (!internal(sheet).disabled) result.push(sheet);
                }
                return result;
            },
            rulesOf(sheetObject) { return currentRules(sheetObject); }
        }),
        configurable: true
    });
})();
