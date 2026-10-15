/**
 * @env-module mediaQuery
 * @description window.matchMedia / MediaQueryList：按 Media Queries Level 4 求值，媒体特征取自 profile（window、screen、media 三节）
 * @compatibility Chrome 120+
 *
 * profile.media 可覆盖：colorScheme、reducedMotion、pointer、hover、anyPointer、anyHover、colorGamut、
 * contrast、forcedColors、displayMode、dynamicRange。
 * 依赖：WebIDL.js、eventCore.js（EventTarget）、screen.js。
 */
(function () {
    'use strict';

    const idl = window.__webidl__;
    const media = (window.__profile__ && window.__profile__.media) || {};

    // 离散特征的当前值
    const discrete = {
        'prefers-color-scheme': media.colorScheme || 'light',
        'prefers-reduced-motion': media.reducedMotion || 'no-preference',
        'prefers-reduced-transparency': 'no-preference',
        'prefers-contrast': media.contrast || 'no-preference',
        'forced-colors': media.forcedColors || 'none',
        'inverted-colors': 'none',
        'pointer': media.pointer || 'fine',
        'hover': media.hover || 'hover',
        'any-pointer': media.anyPointer || media.pointer || 'fine',
        'any-hover': media.anyHover || media.hover || 'hover',
        'color-gamut': media.colorGamut || 'srgb',
        'dynamic-range': media.dynamicRange || 'standard',
        'video-dynamic-range': media.dynamicRange || 'standard',
        'display-mode': media.displayMode || 'browser',
        'scripting': 'enabled',
        'update': 'fast',
        'overflow-block': 'scroll',
        'overflow-inline': 'scroll',
        'grid': '0'
    };
    // 离散特征在布尔上下文中为假的取值
    const falsy = new Set(['none', 'no-preference', 'standard', '0']);

    function screenValue(key, fallback) {
        const value = window.screen && window.screen[key];
        return typeof value === 'number' ? value : fallback;
    }

    // 范围特征：返回数值（长度为 px，分辨率为 dppx）
    const ranges = {
        'width': () => window.innerWidth,
        'height': () => window.innerHeight,
        'device-width': () => screenValue('width', 1920),
        'device-height': () => screenValue('height', 1080),
        'aspect-ratio': () => window.innerWidth / window.innerHeight,
        'device-aspect-ratio': () => screenValue('width', 1920) / screenValue('height', 1080),
        'resolution': () => window.devicePixelRatio || 1,
        '-webkit-device-pixel-ratio': () => window.devicePixelRatio || 1,
        'color': () => Math.floor(screenValue('colorDepth', 24) / 3),
        'color-index': () => 0,
        'monochrome': () => 0
    };

    const lengthUnits = { px: 1, em: 16, rem: 16, pt: 4 / 3, pc: 16, in: 96, cm: 96 / 2.54, mm: 96 / 25.4, q: 96 / 101.6 };
    const resolutionUnits = { dppx: 1, x: 1, dpi: 1 / 96, dpcm: 2.54 / 96 };

    // 解析特征值；无法识别时返回 NaN
    function parseValue(feature, raw) {
        const text = raw.trim().toLowerCase();
        if (feature.endsWith('aspect-ratio')) {
            const match = text.match(/^(\d*\.?\d+)\s*(?:\/\s*(\d*\.?\d+))?$/);
            return match ? Number(match[1]) / Number(match[2] ?? 1) : NaN;
        }
        if (feature === 'color' || feature === 'color-index' || feature === 'monochrome' ||
            feature === '-webkit-device-pixel-ratio') {
            return /^\d*\.?\d+$/.test(text) ? Number(text) : NaN;
        }
        const match = text.match(/^(-?\d*\.?\d+)([a-z]*)$/);
        if (!match) return NaN;
        const table = feature === 'resolution' ? resolutionUnits : lengthUnits;
        if (!match[2]) return Number(match[1]) === 0 && table === lengthUnits ? 0 : NaN;
        const factor = table[match[2]];
        return factor === undefined ? NaN : Number(match[1]) * factor;
    }

    function compare(actual, operator, expected) {
        switch (operator) {
            case '<': return actual < expected;
            case '<=': return actual <= expected;
            case '>': return actual > expected;
            case '>=': return actual >= expected;
            default: return Math.abs(actual - expected) < 1e-9;
        }
    }

    // 单个 (feature) / (feature: value) / (feature op value) / (value op feature op value)；非法返回 null
    function evaluateFeature(body) {
        const text = body.trim().toLowerCase();
        const colon = text.indexOf(':');
        if (colon < 0 && !/[<>=]/.test(text)) {
            if (text in discrete) return !falsy.has(discrete[text]);
            if (text in ranges) return ranges[text]() !== 0;
            if (text === 'orientation') return true;
            return null;
        }
        if (colon >= 0) {
            let feature = text.slice(0, colon).trim();
            const value = text.slice(colon + 1).trim();
            if (feature === 'orientation') {
                const current = window.innerHeight >= window.innerWidth ? 'portrait' : 'landscape';
                return value === 'portrait' || value === 'landscape' ? value === current : null;
            }
            if (feature in discrete) return discrete[feature] === value;
            let operator = '=';
            if (feature.startsWith('min-')) { operator = '>='; feature = feature.slice(4); }
            else if (feature.startsWith('max-')) { operator = '<='; feature = feature.slice(4); }
            else if (feature.startsWith('-webkit-min-device-pixel-ratio')) { operator = '>='; feature = '-webkit-device-pixel-ratio'; }
            else if (feature.startsWith('-webkit-max-device-pixel-ratio')) { operator = '<='; feature = '-webkit-device-pixel-ratio'; }
            if (!(feature in ranges)) return null;
            const expected = parseValue(feature, value);
            return Number.isNaN(expected) ? null : compare(ranges[feature](), operator, expected);
        }
        // 范围语法：(400px <= width < 800px)、(width > 600px)
        const parts = text.split(/\s*(<=|>=|<|>|=)\s*/);
        const flip = { '<': '>', '<=': '>=', '>': '<', '>=': '<=', '=': '=' };
        if (parts.length === 3) {
            const [left, op, right] = parts;
            if (left in ranges) {
                const expected = parseValue(left, right);
                return Number.isNaN(expected) ? null : compare(ranges[left](), op, expected);
            }
            if (right in ranges) {
                const expected = parseValue(right, left);
                return Number.isNaN(expected) ? null : compare(ranges[right](), flip[op], expected);
            }
            return null;
        }
        if (parts.length === 5 && parts[2] in ranges) {
            const [low, op1, feature, op2, high] = parts;
            const a = parseValue(feature, low);
            const b = parseValue(feature, high);
            if (Number.isNaN(a) || Number.isNaN(b)) return null;
            const actual = ranges[feature]();
            return compare(actual, flip[op1], a) && compare(actual, op2, b);
        }
        return null;
    }

    const mediaTypes = new Set(['all', 'screen', 'print', 'tty', 'tv', 'projection', 'handheld',
        'braille', 'embossed', 'aural', 'speech']);

    // 条件部分：用 and / or / not 连接的括号表达式；非法返回 null
    function evaluateCondition(text) {
        const tokens = [];
        let depth = 0;
        let start = -1;
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (ch === '(') {
                if (depth === 0) start = i;
                depth++;
            } else if (ch === ')') {
                depth--;
                if (depth < 0) return null;
                if (depth === 0) tokens.push({ group: text.slice(start + 1, i) });
            } else if (depth === 0 && /\S/.test(ch)) {
                const word = text.slice(i).match(/^[a-z]+/i);
                if (!word) return null;
                tokens.push({ word: word[0].toLowerCase() });
                i += word[0].length - 1;
            }
        }
        if (depth !== 0 || !tokens.length) return null;

        function groupValue(token) {
            const inner = token.group.trim();
            return inner.startsWith('(') || /^not\b/i.test(inner) ? evaluateCondition(inner) : evaluateFeature(inner);
        }

        let index = 0;
        let negate = false;
        if (tokens[0].word === 'not') { negate = true; index = 1; }
        if (!tokens[index] || !tokens[index].group) return null;
        let result = groupValue(tokens[index++]);
        if (result === null) return null;
        let joiner = null;
        while (index < tokens.length) {
            const op = tokens[index++].word;
            if ((op !== 'and' && op !== 'or') || (joiner && joiner !== op) || negate) return null;
            joiner = op;
            const next = tokens[index++];
            if (!next || !next.group) return null;
            const value = groupValue(next);
            if (value === null) return null;
            result = op === 'and' ? result && value : result || value;
        }
        return negate ? !result : result;
    }

    // 单个媒体查询：[only|not] type [and condition] 或 condition
    function evaluateQuery(query) {
        const text = query.trim();
        if (!text) return true;
        const match = text.match(/^(?:(only|not)\s+)?([a-z-]+)(?:\s+and\s+([\s\S]+))?$/i);
        if (match && !['and', 'or', 'not', 'only'].includes(match[2].toLowerCase())) {
            const type = match[2].toLowerCase();
            if (!mediaTypes.has(type)) return false;
            let result = type === 'all' || type === 'screen';
            if (match[3]) {
                const condition = evaluateCondition(match[3]);
                if (condition === null) return false;
                result = result && condition;
            }
            return match[1] && match[1].toLowerCase() === 'not' ? !result : result;
        }
        const condition = evaluateCondition(text);
        return condition === true;
    }

    // 逗号分隔的列表：任一匹配即匹配（括号内的逗号不拆分）
    function splitList(text) {
        const list = [];
        let depth = 0;
        let start = 0;
        for (let i = 0; i < text.length; i++) {
            if (text[i] === '(') depth++;
            else if (text[i] === ')') depth--;
            else if (text[i] === ',' && depth === 0) {
                list.push(text.slice(start, i));
                start = i + 1;
            }
        }
        list.push(text.slice(start));
        return list;
    }

    function evaluate(text) {
        return splitList(text).some(evaluateQuery);
    }

    // Chrome 序列化：去掉多余空白，冒号后一个空格
    function serialize(text) {
        return splitList(text).map(part => part.trim().replace(/\s+/g, ' ')
            .replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').replace(/\s*:\s*/g, ': ')).join(', ');
    }

    function handlerAttribute(key) {
        return {
            get() { return idl.internal(this)[key] ?? null; },
            set(value) {
                const isObject = value !== null && (typeof value === 'object' || typeof value === 'function');
                idl.internal(this)[key] = isObject ? value : null;
            }
        };
    }

    idl.defineInterface('MediaQueryList', {
        parent: 'EventTarget',
        attributes: {
            media() { return idl.internal(this).media; },
            matches() { return evaluate(idl.internal(this).query); },
            onchange: handlerAttribute('onchange')
        },
        methods: {
            // 旧式 API：等价于 addEventListener('change', …)
            addListener(callback) {
                if (typeof callback === 'function' || (callback && typeof callback === 'object')) {
                    window.EventTarget.prototype.addEventListener.call(this, 'change', callback);
                }
            },
            removeListener(callback) {
                window.EventTarget.prototype.removeEventListener.call(this, 'change', callback);
            }
        }
    });

    const holder = {
        matchMedia(query) {
            if (arguments.length < 1) {
                throw new TypeError("Failed to execute 'matchMedia' on 'Window': 1 argument required, but only 0 present.");
            }
            const text = String(query);
            // 解析失败的查询按不匹配处理；matchMedia 不因 CSS 语法错误抛异常。
            return idl.create('MediaQueryList', { query: text, media: serialize(text), onchange: null });
        }
    };
    Object.defineProperty(window, 'matchMedia', {
        value: window.safefunction(holder.matchMedia, 'matchMedia'),
        writable: true, enumerable: true, configurable: true
    });
})();
