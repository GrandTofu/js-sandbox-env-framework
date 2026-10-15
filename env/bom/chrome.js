/**
 * @env-module chrome
 * @description window.chrome（普通网页中的形态）：loadTimes、csi、app；不含 runtime（仅在安装了对网页开放的扩展时出现）
 * @compatibility Chrome 120+
 *
 * 仅当 navigator.vendor 为 'Google Inc.'（Chrome / Edge）时定义，避免与其他浏览器的 profile 矛盾。
 * 依赖：navigator.js、performance.js（时间基准取 performance.timeOrigin）。
 */
(function () {
    'use strict';

    const markNative = window.safefunction;
    if (!window.navigator || window.navigator.vendor !== 'Google Inc.') return;

    const perf = window.performance;
    const timeOrigin = perf && typeof perf.timeOrigin === 'number' ? perf.timeOrigin : Date.now();

    // loadTimes 的时间单位是秒（带小数），与 Chrome 一致
    function loadTimes() {
        const start = timeOrigin / 1000;
        return {
            requestTime: start,
            startLoadTime: start,
            commitLoadTime: start + 0.05,
            finishDocumentLoadTime: start + 0.16,
            finishLoadTime: start + 0.22,
            firstPaintTime: start + 0.12,
            firstPaintAfterLoadTime: 0,
            navigationType: 'Other',
            wasFetchedViaSpdy: true,
            wasNpnNegotiated: true,
            npnNegotiatedProtocol: 'h2',
            wasAlternateProtocolAvailable: false,
            connectionInfo: 'h2'
        };
    }

    // csi 的时间单位是毫秒
    function csi() {
        return {
            startE: Math.floor(timeOrigin),
            onloadT: Math.floor(timeOrigin) + 220,
            pageT: Date.now() - timeOrigin,
            tran: 15
        };
    }

    const app = {
        isInstalled: false,
        getDetails: function getDetails() { return null; },
        getIsInstalled: function getIsInstalled() { return false; },
        installState: function installState(callback) {
            if (typeof callback === 'function') callback('not_installed');
        },
        runningState: function runningState() { return 'cannot_run'; },
        InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
        RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' }
    };
    for (const key of ['getDetails', 'getIsInstalled', 'installState', 'runningState']) {
        markNative(app[key], key);
    }

    const chrome = {
        loadTimes: markNative(loadTimes, 'loadTimes'),
        csi: markNative(csi, 'csi'),
        app
    };

    // Chrome 中 window.chrome 是普通的可写、可枚举、可配置数据属性
    Object.defineProperty(window, 'chrome', {
        value: chrome, writable: true, enumerable: true, configurable: true
    });
})();
