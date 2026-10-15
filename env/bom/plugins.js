/**
 * @env-module plugins
 * @description PluginArray / Plugin / MimeTypeArray / MimeType：按 WebIDL 定义；索引属性可枚举、命名属性不可枚举，MimeType 对象在各插件之间共享
 * @compatibility Chrome 120+
 *
 * 只提供构建函数 window.__navigatorPlugins__.build(pluginDefs, mimeTypeDefs)，由 navigator.js 调用。
 * 依赖：WebIDL.js。
 */
(function () {
    'use strict';

    const idl = window.__webidl__;

    function itemOf(list, index) {
        // WebIDL unsigned long 转换
        return list[index >>> 0] || null;
    }

    function namedItemOf(list, field, name) {
        const key = String(name);
        return list.find(item => idl.internal(item)[field] === key) || null;
    }

    // 索引属性可枚举；命名属性不可枚举，且不遮蔽原型上的成员（LegacyUnenumerableNamedProperties）
    function defineSupportedProperties(target, list, field) {
        list.forEach((item, index) => {
            Object.defineProperty(target, index, {
                value: item, writable: false, enumerable: true, configurable: true
            });
        });
        for (const item of list) {
            const name = idl.internal(item)[field];
            if (!name || name in target) continue;
            Object.defineProperty(target, name, {
                value: item, writable: false, enumerable: false, configurable: true
            });
        }
    }

    // 有索引 getter 的接口按 WebIDL 获得 %Array.prototype.values% 作为迭代器
    function defineIterator(ctor) {
        Object.defineProperty(ctor.prototype, Symbol.iterator, {
            value: Array.prototype.values, writable: true, enumerable: false, configurable: true
        });
    }

    idl.defineInterface('MimeType', {
        attributes: {
            type() { return idl.internal(this).type; },
            suffixes() { return idl.internal(this).suffixes; },
            description() { return idl.internal(this).description; },
            enabledPlugin() { return idl.internal(this).plugin; }
        }
    });

    const Plugin = idl.defineInterface('Plugin', {
        attributes: {
            name() { return idl.internal(this).name; },
            filename() { return idl.internal(this).filename; },
            description() { return idl.internal(this).description; },
            length() { return idl.internal(this).mimeTypes.length; }
        },
        methods: {
            item(index) { return itemOf(idl.internal(this).mimeTypes, index); },
            namedItem(name) { return namedItemOf(idl.internal(this).mimeTypes, 'type', name); }
        }
    });
    defineIterator(Plugin);

    const PluginArray = idl.defineInterface('PluginArray', {
        attributes: {
            length() { return idl.internal(this).list.length; }
        },
        methods: {
            item(index) { return itemOf(idl.internal(this).list, index); },
            namedItem(name) { return namedItemOf(idl.internal(this).list, 'name', name); },
            refresh() {}
        }
    });
    defineIterator(PluginArray);

    const MimeTypeArray = idl.defineInterface('MimeTypeArray', {
        attributes: {
            length() { return idl.internal(this).list.length; }
        },
        methods: {
            item(index) { return itemOf(idl.internal(this).list, index); },
            namedItem(name) { return namedItemOf(idl.internal(this).list, 'type', name); }
        }
    });
    defineIterator(MimeTypeArray);

    /**
     * pluginDefs: [{ name, description, filename, mimeTypes?: [{ type, suffixes, description }] }]
     * mimeTypeDefs: 采集快照里独立的 mimeTypes 列表；没有自带 mimeTypes 的插件使用这份列表。
     * 同一 type 只创建一个 MimeType，enabledPlugin 指向第一个包含它的插件（与 Chrome 的 PDF 插件一致）。
     */
    function build(pluginDefs, mimeTypeDefs) {
        const sharedTypes = new Map();
        function mimeTypeFor(def, plugin) {
            const type = String(def.type ?? '');
            if (!sharedTypes.has(type)) {
                sharedTypes.set(type, idl.create('MimeType', {
                    type,
                    suffixes: String(def.suffixes ?? ''),
                    description: String(def.description ?? ''),
                    plugin
                }));
            }
            return sharedTypes.get(type);
        }

        const plugins = [];
        for (const def of pluginDefs || []) {
            const state = {
                name: String(def.name ?? ''),
                filename: String(def.filename ?? ''),
                description: String(def.description ?? ''),
                mimeTypes: []
            };
            const plugin = idl.create('Plugin', state);
            const ownDefs = Array.isArray(def.mimeTypes) ? def.mimeTypes : (mimeTypeDefs || []);
            state.mimeTypes = ownDefs.map(mimeDef => mimeTypeFor(mimeDef, plugin));
            defineSupportedProperties(plugin, state.mimeTypes, 'type');
            plugins.push(plugin);
        }
        for (const def of mimeTypeDefs || []) mimeTypeFor(def, null);

        const mimeTypes = Array.from(sharedTypes.values());
        const pluginArray = idl.create('PluginArray', { list: plugins });
        defineSupportedProperties(pluginArray, plugins, 'name');
        const mimeTypeArray = idl.create('MimeTypeArray', { list: mimeTypes });
        defineSupportedProperties(mimeTypeArray, mimeTypes, 'type');
        return { plugins: pluginArray, mimeTypes: mimeTypeArray };
    }

    Object.defineProperty(window, '__navigatorPlugins__', {
        value: Object.freeze({ build }), configurable: true
    });
})();
