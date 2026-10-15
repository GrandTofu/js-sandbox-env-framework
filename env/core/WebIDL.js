/**
 * @env-module WebIDL
 * @description 按 WebIDL 规则定义浏览器接口：原型访问器、brand check、Illegal constructor、Symbol.toStringTag 与 native toString
 * @compatibility Chrome 120+
 *
 * 用法（在其他 env 模块加载时捕获引用）：
 *   const idl = window.__webidl__;
 *   idl.defineInterface('Navigator', {
 *       parent: null,
 *       attributes: { userAgent() { return idl.internal(this).userAgent; } },
 *       methods: { javaEnabled() { return false; } }
 *   });
 *   const navigator = idl.create('Navigator', { userAgent: '...' });
 *
 * 约定：
 * - attributes 的值可以是 getter 函数，或 { get, set, configurable }；没有 set 即只读。
 * - methods 的值可以是实现函数（必填参数个数取函数 length，可用默认参数标记可选参数），
 *   或 { value, length, configurable, writable }。
 * - 实现函数里的 this 是已通过 brand check 的真实对象，内部状态用 idl.internal(this) 读取。
 */
(function () {
    'use strict';

    const markNative = globalThis.safefunction;
    // 实例 → 接口记录；只有经由本工具创建或登记的对象才能通过 brand check
    const brands = new WeakMap();
    // 实例 → 内部状态（对应 WebIDL 的内部槽）
    const states = new WeakMap();
    // 接口名 → { name, parent, global, ctor, prototype }
    const records = new Map();

    function illegalInvocation() {
        return new TypeError('Illegal invocation');
    }

    function argumentsMessage(required, present) {
        const noun = required === 1 ? 'argument' : 'arguments';
        return `${required} ${noun} required, but only ${present} present.`;
    }

    function keyName(key) {
        return typeof key === 'symbol' ? `[${key.description}]` : String(key);
    }

    function recordOf(name) {
        const record = records.get(name);
        if (!record) throw new Error(`[WebIDL] 未定义的接口: ${name}`);
        return record;
    }

    function isObject(value) {
        return value !== null && (typeof value === 'object' || typeof value === 'function');
    }

    function isBranded(object, record) {
        let current = isObject(object) ? brands.get(object) : undefined;
        while (current) {
            if (current === record) return true;
            current = current.parent;
        }
        return false;
    }

    // WebIDL：this 为 undefined/null 时改用全局对象（脚本里裸调 addEventListener(...) 作用于 window）
    function receiverOf(self, record) {
        const missing = self === undefined || self === null;
        const target = missing ? globalThis : self;
        if (!isBranded(target, record)) throw illegalInvocation();
        return target;
    }

    function ownEntries(object) {
        if (!object) return [];
        return Reflect.ownKeys(object).map(key => [key, object[key]]);
    }

    function createGetter(key, record, impl) {
        const holder = {
            get [key]() {
                return impl.call(receiverOf(this, record));
            }
        };
        return markNative(Object.getOwnPropertyDescriptor(holder, key).get);
    }

    function createSetter(key, record, impl) {
        const holder = {
            set [key](value) {
                impl.call(receiverOf(this, record), value);
            }
        };
        return markNative(Object.getOwnPropertyDescriptor(holder, key).set);
    }

    // record 为 null 表示静态方法：不做 brand check
    function createOperation(key, interfaceName, record, length, impl) {
        const holder = {
            [key](...args) {
                const self = record ? receiverOf(this, record) : this;
                if (args.length < length) {
                    const message = argumentsMessage(length, args.length);
                    throw new TypeError(`Failed to execute '${keyName(key)}' on '${interfaceName}': ${message}`);
                }
                return impl.apply(self, args);
            }
        };
        const operation = holder[key];
        Object.defineProperty(operation, 'length', { value: length });
        return markNative(operation);
    }

    function defineConstant(target, key, value) {
        Object.defineProperty(target, key, {
            value, writable: false, enumerable: true, configurable: false
        });
    }

    function defineAttribute(target, key, record, spec) {
        const accessor = typeof spec === 'function' ? { get: spec } : spec;
        Object.defineProperty(target, key, {
            get: createGetter(key, record, accessor.get),
            set: accessor.set ? createSetter(key, record, accessor.set) : undefined,
            enumerable: true,
            // [LegacyUnforgeable] 成员传 configurable: false
            configurable: accessor.configurable !== false
        });
    }

    function defineOperation(target, key, interfaceName, record, spec) {
        const impl = typeof spec === 'function' ? spec : spec.value;
        const length = typeof spec === 'function' ? spec.length : (spec.length ?? impl.length);
        Object.defineProperty(target, key, {
            value: createOperation(key, interfaceName, record, length, impl),
            writable: spec.writable !== false,
            enumerable: true,
            configurable: spec.configurable !== false
        });
    }

    /**
     * 在 target 上按接口 name 定义常量、属性和方法（brand check 针对该接口）。
     * 普通接口由 defineInterface 自动调用；[Global]/[LegacyUnforgeable] 成员可直接定义在实例上。
     */
    function defineMembers(target, name, spec = {}) {
        const record = recordOf(name);
        for (const [key, value] of ownEntries(spec.constants)) defineConstant(target, key, value);
        for (const [key, attribute] of ownEntries(spec.attributes)) defineAttribute(target, key, record, attribute);
        for (const [key, operation] of ownEntries(spec.methods)) defineOperation(target, key, name, record, operation);
        return target;
    }

    function exposeGlobal(name, value) {
        Object.defineProperty(globalThis, name, {
            value, writable: true, enumerable: false, configurable: true
        });
        return value;
    }

    /**
     * 定义接口对象与接口原型对象。
     * spec: { parent, parentPrototype, construct, length, attributes, methods, constants, statics, global, expose }
     * - construct 存在时可 new，this 为新实例，内部状态已初始化为 {}；否则抛 Illegal constructor。
     * - parentPrototype 仅在没有 parent 时使用，例如 DOMException.prototype 继承 Error.prototype。
     */
    function defineInterface(name, spec = {}) {
        if (records.has(name)) throw new Error(`[WebIDL] 接口重复定义: ${name}`);
        const parent = spec.parent ? recordOf(spec.parent) : null;
        const record = { name, parent, global: !!spec.global, ctor: null, prototype: null };
        const construct = spec.construct || null;
        const ctorLength = spec.length ?? (construct ? construct.length : 0);

        const holder = {
            [name]: function (...args) {
                if (!construct) throw new TypeError('Illegal constructor');
                if (new.target === undefined) {
                    throw new TypeError(`Failed to construct '${name}': Please use the 'new' operator, this DOM object constructor cannot be called as a function.`);
                }
                if (args.length < ctorLength) {
                    throw new TypeError(`Failed to construct '${name}': ${argumentsMessage(ctorLength, args.length)}`);
                }
                const object = Object.create(new.target.prototype);
                brands.set(object, record);
                states.set(object, {});
                construct.apply(object, args);
                return object;
            }
        };
        const ctor = holder[name];
        const parentPrototype = parent ? parent.prototype : (spec.parentPrototype || Object.prototype);
        const prototype = Object.create(parentPrototype);

        Object.defineProperty(ctor, 'length', { value: ctorLength });
        Object.defineProperty(ctor, 'prototype', { value: prototype, writable: false });
        if (parent) Object.setPrototypeOf(ctor, parent.ctor);

        record.ctor = ctor;
        record.prototype = prototype;
        records.set(name, record);

        for (const [key, value] of ownEntries(spec.constants)) defineConstant(ctor, key, value);
        for (const [key, operation] of ownEntries(spec.statics)) defineOperation(ctor, key, name, null, operation);
        defineMembers(prototype, name, spec);
        Object.defineProperty(prototype, 'constructor', {
            value: ctor, writable: true, enumerable: false, configurable: true
        });
        Object.defineProperty(prototype, Symbol.toStringTag, { value: name, configurable: true });

        markNative(ctor);
        if (spec.expose !== false) exposeGlobal(name, ctor);
        return ctor;
    }

    /** 创建接口实例（不经过构造函数），state 作为其内部状态。 */
    function create(name, state = {}) {
        const record = recordOf(name);
        const object = Object.create(record.prototype);
        brands.set(object, record);
        states.set(object, state);
        return object;
    }

    /** 把已有对象（例如全局对象）登记为接口实例，并接到接口原型上。 */
    function implement(object, name, state = {}) {
        const record = recordOf(name);
        Object.setPrototypeOf(object, record.prototype);
        brands.set(object, record);
        states.set(object, state);
        return object;
    }

    /** 登记对象的接口身份与内部状态，不改变原型（供仍用旧式构造函数的子类使用）。 */
    function brand(object, name, state = {}) {
        brands.set(object, recordOf(name));
        states.set(object, state);
        return object;
    }

    function internal(object) {
        return isObject(object) ? states.get(object) : undefined;
    }

    function is(object, name) {
        return isBranded(object, recordOf(name));
    }

    function interfaceObject(name) {
        return recordOf(name).ctor;
    }

    const api = Object.freeze({
        defineInterface, defineMembers, create, implement, brand, internal, is,
        interfaceObject, exposeGlobal
    });
    Object.defineProperty(globalThis, '__webidl__', { value: api, configurable: true });
})();
