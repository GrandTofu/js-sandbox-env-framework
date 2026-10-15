/**
 * 简化的沙箱管理器 - 专注于核心功能
 * 使用 Node.js 原生 vm 模块，支持复杂的混淆代码
 */

import vm from 'vm';
import fs from 'fs';
import path from 'path';
import { URL } from 'node:url';
import { fileURLToPath } from 'node:url';
import { browserEnvModules } from './envModules.js';
import { createBrowserContext, loadHTMLIntoContext, disposeBrowserContext } from './browserContext.js';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ENV_ROOT = path.join(PROJECT_ROOT, 'env');
const HOST_CONSOLE = { debug: 'log', log: 'log', info: 'info', warn: 'warn', error: 'error' };

export class SimpleSandbox {
    constructor() {
        this.context = null;
        this.undefinedPaths = [];
        this.accessLogs = [];
        this.callLogs = [];
        this.consoleOutput = [];
    }

    /**
     * 初始化沙箱
     */
    init(options = {}) {
        const { timeout = 60000, profile = null } = options;

        this.consoleOutput = [];
        this.context = createBrowserContext({
            profile,
            timeout,
            onConsole: (level, args) => {
                console[HOST_CONSOLE[level] || 'log']('[Sandbox]', ...args);
                this.consoleOutput.push([level, ...args]);
            }
        });
        this.timeout = timeout;
        this.profile = profile;
        this.loadedEnvFiles = new Set();
        if (profile) this._ensureBrowserEnvironment();

        console.log('[SimpleSandbox] 沙箱初始化完成');
        return this;
    }

    /**
     * 执行代码
     */
    execute(code, options = {}) {
        const { timeout = this.timeout } = options;
        const startTime = Date.now();

        const success = (value) => ({
            success: true,
            result: this._serializeResult(value),
            duration: Date.now() - startTime,
            consoleOutput: this.consoleOutput,
            accessLogs: this.accessLogs.slice(-50),
            callLogs: this.callLogs.slice(-50),
            undefinedPaths: []
        });
        const failure = (error) => ({
            success: false,
            error: error.message,
            stack: error.stack,
            duration: Date.now() - startTime,
            consoleOutput: this.consoleOutput,
            accessLogs: this.accessLogs.slice(-50),
            callLogs: this.callLogs.slice(-50),
            undefinedPaths: []
        });

        try {
            // 清空日志
            this.consoleOutput = [];
            this.accessLogs = [];
            this.callLogs = [];

            const result = vm.runInContext(code, this.context, {
                // 默认文件名 evalmachine.<anonymous> 会出现在 error.stack 里，暴露 Node vm
                filename: '<anonymous>',
                timeout,
                displayErrors: true
            });

            if (result && typeof result.then === 'function') {
                let timer;
                return Promise.race([
                    result,
                    new Promise((_, reject) => {
                        timer = setTimeout(() => reject(new Error('异步执行超时')), timeout);
                    })
                ]).then(success, failure).finally(() => clearTimeout(timer));
            }
            return success(result);
        } catch (e) {
            console.error('[SimpleSandbox] Execute error:', e.message);
            return failure(e);
        }
    }

    /**
     * 注入环境对象（从文件或对象）
     */
    injectEnvironment(envData) {
        try {
            if (typeof envData === 'string') {
                // 如果是文件路径
                if (fs.existsSync(envData)) {
                    const fullPath = path.resolve(envData);
                    if (fullPath.startsWith(ENV_ROOT + path.sep)) {
                        return this.loadEnvFile(path.relative(ENV_ROOT, fullPath));
                    }
                    const code = fs.readFileSync(fullPath, 'utf-8');
                    if (fullPath.endsWith('.json')) {
                        return this.injectEnvironment(JSON.parse(code));
                    }
                    this._ensureBrowserEnvironment();
                    vm.runInContext(code, this.context, { timeout: this.timeout, filename: '<anonymous>' });
                } else {
                    // 如果是代码字符串
                    vm.runInContext(envData, this.context, { timeout: this.timeout, filename: '<anonymous>' });
                }
            } else if (envData && typeof envData === 'object') {
                this._ensureBrowserEnvironment();
                vm.runInContext(`window.__applyCollectedEnvironment__(${JSON.stringify(envData)})`,
                    this.context, { timeout: this.timeout, filename: '<anonymous>' });
            }
            vm.runInContext('window.__markBrowserFunctions__()', this.context,
                { timeout: this.timeout, filename: '<anonymous>' });
            return { success: true };
        } catch (e) {
            console.error('[SimpleSandbox] 注入环境失败:', e.message);
            return { success: false, error: e.message };
        }
    }

    inject(code) { return this.injectEnvironment(code); }

    loadEnvFile(file) {
        try {
            const relative = file.startsWith('env/') ? file.slice(4) : file;
            const fullPath = path.resolve(ENV_ROOT, relative);
            if (!fullPath.startsWith(ENV_ROOT + path.sep) || !fullPath.endsWith('.js')) {
                throw new Error('Invalid environment module path');
            }
            if (!fs.existsSync(fullPath)) throw new Error(`Environment module not found: ${file}`);
            if (!this.loadedEnvFiles.has(fullPath)) {
                // 默认文件名 evalmachine.<anonymous> 会出现在 error.stack 里，暴露 Node vm
                vm.runInContext(fs.readFileSync(fullPath, 'utf-8'), this.context,
                    { timeout: this.timeout, filename: '<anonymous>' });
                this.loadedEnvFiles.add(fullPath);
                vm.runInContext('window.__markBrowserFunctions__()', this.context,
                    { timeout: this.timeout, filename: '<anonymous>' });
            }
            return { success: true, file: relative };
        } catch (error) {
            return { success: false, file, error: error.message };
        }
    }

    loadAllEnvFiles() {
        return browserEnvModules.map(modulePath => this.loadEnvFile(modulePath));
    }

    _ensureBrowserEnvironment() {
        const results = this.loadAllEnvFiles();
        const failed = results.find(item => !item.success);
        if (failed) throw new Error(`Failed to load ${failed.file}: ${failed.error}`);
    }

    /** Install a fetched or locally saved HTML document before executing site JavaScript. */
    loadHTML(html, pageURL) {
        if (typeof html !== 'string') throw new TypeError('HTML must be a string');
        if (pageURL !== undefined && !/^https?:$/.test(new URL(pageURL).protocol)) {
            throw new TypeError('Page URL must use HTTP or HTTPS');
        }
        this._ensureBrowserEnvironment();
        return loadHTMLIntoContext(this.context, html, pageURL, this.timeout);
    }

    /**
     * 序列化结果
     */
    _serializeResult(result) {
        if (result === undefined) return 'undefined';
        if (result === null) return 'null';
        if (typeof result === 'function') return '[Function]';
        if (typeof result === 'symbol') return result.toString();
        
        if (typeof result === 'object') {
            try {
                return JSON.stringify(result, null, 2);
            } catch (e) {
                return '[Object]';
            }
        }
        
        return String(result);
    }

    /**
     * 重置沙箱
     */
    reset() {
        this.vm = null;
        this.undefinedPaths = [];
        if (this.context) disposeBrowserContext(this.context);
        this.init({ profile: this.profile, timeout: this.timeout });
    }

    /**
     * 运行文件
     */
    executeFile(filePath) {
        try {
            const code = fs.readFileSync(filePath, 'utf-8');
            return this.execute(code);
        } catch (e) {
            return {
                success: false,
                error: `Failed to read file: ${e.message}`,
                duration: 0,
                consoleOutput: [],
                undefinedPaths: []
            };
        }
    }

    /**
     * 获取统计信息
     */
    getStats() {
        return {
            loadedEnvFiles: Array.from(this.loadedEnvFiles || []).map(file => path.relative(PROJECT_ROOT, file)),
            undefinedPaths: this.undefinedPaths,
            consoleOutputCount: this.consoleOutput.length,
            ready: !!this.context,
            engine: 'Node.js VM'
        };
    }

    /**
     * 获取 undefined 列表
     */
    getUndefinedList() {
        return this.undefinedPaths;
    }

    /**
     * 获取日志（兼容接口）
     */
    getLogger() {
        return {
            getAllLogs: () => ({ 
                access: this.accessLogs, 
                undefined: this.undefinedPaths, 
                calls: this.callLogs 
            }),
            getStats: () => ({ 
                totalAccess: this.accessLogs.length, 
                totalUndefined: this.undefinedPaths.length, 
                totalCalls: this.callLogs.length 
            }),
            getUndefinedList: () => this.undefinedPaths,
            clear: () => { 
                this.undefinedPaths = [];
                this.accessLogs = [];
                this.callLogs = [];
            }
        };
    }

    /**
     * 获取环境信息
     */
    getEnvironmentInfo() {
        try {
            const envInfo = vm.runInContext(`
                JSON.stringify({
                    window: typeof window,
                    document: typeof document,
                    navigator: typeof navigator,
                    location: typeof location,
                    console: typeof console,
                    XMLHttpRequest: typeof XMLHttpRequest,
                    atob: typeof atob,
                    btoa: typeof btoa,
                    customProperties: Object.keys(window).filter(k => 
                        !['console', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 
                         'atob', 'btoa', 'XMLHttpRequest', 'window', 'globalThis', 'self'].includes(k)
                    )
                })
            `, this.context, { filename: '<anonymous>' });
            return JSON.parse(envInfo);
        } catch (e) {
            return { error: e.message };
        }
    }

    /**
     * 销毁沙箱
     */
    dispose() {
        this.vm = null;
        // 取消尚未触发的定时器，避免被丢弃的上下文继续运行
        if (this.context) disposeBrowserContext(this.context);
    }
}

export default SimpleSandbox;
