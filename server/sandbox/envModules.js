/**
 * 创建上下文后最先加载：native toString 与 WebIDL 接口工具（env/core/GlobalScope.js 依赖它们）。
 * 加载方：server/sandbox/browserContext.js。
 */
export const bootstrapEnvModules = [
    'env/core/NativeFunction.js',
    'env/core/WebIDL.js'
];

/** GlobalScope 安装之后总是加载的基础模块（无 profile 时也存在），顺序即依赖顺序。 */
export const coreEnvModules = [
    'env/webapi/domexception.js',
    'env/encoding/atob.js',
    'env/webapi/url.js',
    'env/timer/timeout.js',
    'env/core/applyCollectedEnvironment.js'
];

/** Browser modules in dependency order, shared by CLI and programmatic runners. */
export const browserEnvModules = [
    'env/core/EnvMonitor.js',
    'env/core/MonitorSystem.js',
    'env/bom/timezone.js',
    'env/bom/window.js',
    'env/bom/location.js',
    'env/bom/history.js',
    'env/bom/storage.js',
    'env/bom/crypto.js',
    'env/dom/eventCore.js',
    // Performance 继承 EventTarget
    'env/bom/performance.js',
    'env/dom/event.js',
    'env/bom/screen.js',
    'env/bom/mediaQuery.js',
    // navigator 子对象继承 EventTarget，需在 event.js 之后
    'env/bom/plugins.js',
    'env/bom/navigatorApis.js',
    'env/bom/navigator.js',
    'env/bom/chrome.js',
    'env/dom/htmlElementAttributes.js',
    'env/dom/document.js',
    'env/dom/webgl.js',
    'env/dom/elements.js',
    'env/dom/observerApis.js',
    'env/dom/cssom.js',
    'env/dom/domApis.js',
    'env/webapi/audio.js',
    'env/encoding/textencoder.js',
    // Blob 等在 elements.js 之后加载：实例属性提升依赖 window.__liftOwnProperties__
    'env/webapi/blob.js',
    'env/webapi/apis.js',
    // XHR 复用 Request / Headers 与 EventTarget，不再使用 GlobalScope 占位。
    'env/webapi/xhr.js'
];
