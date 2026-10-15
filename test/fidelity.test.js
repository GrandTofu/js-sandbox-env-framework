import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function evaluate(code) {
    const result = spawnSync(process.execPath,
        ['standalone-runner.js', '--quiet', '--profile', 'default', '--code',
            `Promise.resolve((async () => { ${code} })()).then(value => JSON.stringify(value))`],
        { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const match = result.stdout.match(/📤 返回值:\n([^\n]+)/);
    assert.ok(match, result.stdout);
    return JSON.parse(match[1]);
}

test('Location keeps identity and parses relative URLs consistently', () => {
    const actual = evaluate(`
        const same = location === window.location && location instanceof Location;
        location.assign('/a/b?x=1');
        location.href = '../c#part';
        const afterRelative = [location.href, location.origin, document.URL];
        window.location = '?q=2';
        return { same, afterRelative, final: [location.href, location.search, location.hash],
            descriptor: Object.getOwnPropertyDescriptor(window, 'location').configurable,
            internal: Object.getOwnPropertyNames(location).some(key => key.startsWith('_')),
            tag: Object.prototype.toString.call(location) };
    `);
    assert.deepEqual(actual, {
        same: true,
        afterRelative: ['https://www.example.com/c#part', 'https://www.example.com', 'https://www.example.com/c#part'],
        final: ['https://www.example.com/c?q=2', '?q=2', ''],
        descriptor: false, internal: false, tag: '[object Location]'
    });
});

test('Window and Document have stable browser identities', () => {
    const actual = evaluate(`return {
        windowTag: Object.prototype.toString.call(window),
        windowInstance: window instanceof Window,
        documentTag: Object.prototype.toString.call(document),
        documentInstance: document instanceof HTMLDocument && document instanceof Document && document instanceof Node,
        documentDescriptor: Object.getOwnPropertyDescriptor(window, 'document').configurable,
        documentURL: document.URL === location.href,
        navigatorTag: Object.prototype.toString.call(navigator),
        screenTag: Object.prototype.toString.call(screen)
    };`);
    assert.deepEqual(actual, {
        windowTag: '[object Window]', windowInstance: true,
        documentTag: '[object HTMLDocument]', documentInstance: true,
        documentDescriptor: false, documentURL: true,
        navigatorTag: '[object Navigator]', screenTag: '[object Screen]'
    });
});

test('Storage named properties and methods share one ordered data set', () => {
    const actual = evaluate(`
        localStorage.setItem('alpha', '');
        localStorage.beta = 2;
        localStorage.setItem('gamma', 'three');
        delete localStorage.beta;
        return { keys: Object.keys(localStorage), first: localStorage.key(0),
            stored: localStorage.getItem('alpha'), absent: localStorage.getItem('beta'),
            length: localStorage.length, other: sessionStorage.length,
            tag: Object.prototype.toString.call(localStorage),
            instance: localStorage instanceof Storage,
            native: Function.prototype.toString.call(Storage.prototype.getItem),
            illegal: (() => { try { Storage.prototype.getItem.call({ }, 'alpha'); return false; } catch (e) { return e instanceof TypeError; } })() };
    `);
    assert.deepEqual(actual, {
        keys: ['alpha', 'gamma'], first: 'alpha', stored: '', absent: null,
        length: 2, other: 0, tag: '[object Storage]', instance: true,
        native: 'function getItem() { [native code] }', illegal: true
    });
});

test('History updates URL without exposing internal helpers and rejects cross-origin state', () => {
    const actual = evaluate(`
        history.pushState({ page: 2 }, '', '/next?x=1');
        const current = [history.length, history.state.page, location.href];
        let securityError = false;
        try { history.pushState({}, '', 'https://other.example/'); }
        catch (error) { securityError = error.name === 'SecurityError'; }
        history.back();
        return { current, securityError, previous: location.href,
            privateHelper: '_resolveUrl' in history,
            documentTag: Object.prototype.toString.call(document),
            documentURL: document.URL };
    `);
    assert.deepEqual(actual, {
        current: [2, 2, 'https://www.example.com/next?x=1'], securityError: true,
        previous: 'https://www.example.com/', privateHelper: false,
        documentTag: '[object HTMLDocument]', documentURL: 'https://www.example.com/'
    });
});

test('UA client hints return only requested high entropy keys', () => {
    const actual = evaluate(`
        const low = await navigator.userAgentData.getHighEntropyValues([]);
        const selected = await navigator.userAgentData.getHighEntropyValues(['architecture']);
        return { low: Object.keys(low), selected: Object.keys(selected),
            architecture: selected.architecture,
            json: Object.keys(JSON.parse(JSON.stringify(navigator.userAgentData))),
            tag: Object.prototype.toString.call(navigator.userAgentData),
            native: Function.prototype.toString.call(navigator.userAgentData.getHighEntropyValues) };
    `);
    assert.deepEqual(actual, {
        low: ['brands', 'mobile', 'platform'],
        selected: ['brands', 'mobile', 'platform', 'architecture'], architecture: 'x86',
        json: ['brands', 'mobile', 'platform'], tag: '[object NavigatorUAData]',
        native: 'function getHighEntropyValues() { [native code] }'
    });
});

test('Navigator exposes attributes as prototype getters with browser collection types', () => {
    const actual = evaluate(`
        const getter = Object.getOwnPropertyDescriptor(Navigator.prototype, 'webdriver').get;
        let illegal = null;
        try { getter.call({}); } catch (error) { illegal = error.message; }
        return { own: Object.getOwnPropertyNames(navigator).length,
            getter: Function.prototype.toString.call(getter), illegal,
            buildID: 'buildID' in navigator,
            plugins: Object.prototype.toString.call(navigator.plugins),
            isArray: Array.isArray(navigator.plugins),
            plugin: Object.prototype.toString.call(navigator.plugins[0]),
            mimeTypes: Object.prototype.toString.call(navigator.mimeTypes),
            sharedMime: navigator.plugins[0][0] === navigator.plugins[1][0],
            named: navigator.plugins.namedItem('PDF Viewer').name,
            keys: Object.keys(navigator.plugins).length === navigator.plugins.length };
    `);
    assert.deepEqual(actual, {
        own: 0, getter: 'function get webdriver() { [native code] }', illegal: 'Illegal invocation',
        buildID: false, plugins: '[object PluginArray]', isArray: false, plugin: '[object Plugin]',
        mimeTypes: '[object MimeTypeArray]', sharedMime: true, named: 'PDF Viewer', keys: true
    });
});

test('navigator sub-objects are WebIDL interfaces and window.chrome matches a normal page', () => {
    const actual = evaluate(`
        const status = await navigator.permissions.query({ name: 'notifications' });
        let invalid = null;
        try { await navigator.permissions.query({ name: 'nope' }); } catch (error) { invalid = error.constructor.name; }
        const tag = value => Object.prototype.toString.call(value);
        return { connection: tag(navigator.connection),
            connectionTarget: navigator.connection instanceof EventTarget,
            permissions: tag(navigator.permissions), status: tag(status), state: status.state, invalid,
            geolocation: tag(navigator.geolocation), mediaDevices: tag(navigator.mediaDevices),
            battery: tag(await navigator.getBattery()),
            sameBattery: navigator.getBattery() === navigator.getBattery(),
            chrome: Object.keys(window.chrome),
            loadTimes: Function.prototype.toString.call(chrome.loadTimes) };
    `);
    assert.deepEqual(actual, {
        connection: '[object NetworkInformation]', connectionTarget: true,
        permissions: '[object Permissions]', status: '[object PermissionStatus]', state: 'prompt',
        invalid: 'TypeError', geolocation: '[object Geolocation]', mediaDevices: '[object MediaDevices]',
        battery: '[object BatteryManager]', sameBattery: true,
        chrome: ['loadTimes', 'csi', 'app'], loadTimes: 'function loadTimes() { [native code] }'
    });
});

test('Event and AbortSignal keep state behind prototype accessors', () => {
    const actual = evaluate(`
        const event = new Event('x', { cancelable: true });
        event.preventDefault();
        let noNew = null;
        try { Event('x'); } catch (error) { noNew = error.constructor.name; }
        let newSignal = null;
        try { new AbortSignal(); } catch (error) { newSignal = error.message; }
        const controller = new AbortController();
        let aborts = 0;
        controller.signal.addEventListener('abort', () => aborts++);
        controller.abort();
        return { own: Object.getOwnPropertyNames(event), tag: Object.prototype.toString.call(event),
            defaultPrevented: event.defaultPrevented, noNew, newSignal,
            aborted: controller.signal.aborted, reason: controller.signal.reason.name, aborts,
            signalOwn: Object.getOwnPropertyNames(controller.signal).length,
            custom: Object.prototype.toString.call(new CustomEvent('c', { detail: 1 })),
            mouse: new MouseEvent('click') instanceof Event };
    `);
    assert.deepEqual(actual, {
        own: ['isTrusted'], tag: '[object Event]', defaultPrevented: true, noNew: 'TypeError',
        newSignal: 'Illegal constructor', aborted: true, reason: 'AbortError', aborts: 1,
        signalOwn: 0, custom: '[object CustomEvent]', mouse: true
    });
});

test('DOM nodes, document and window share one EventTarget dispatch path', () => {
    const actual = evaluate(`
        const order = [];
        const div = document.createElement('div');
        document.body.appendChild(div);
        const add = (target, name, capture) =>
            target.addEventListener('ping', () => order.push(name), capture);
        add(window, 'win-cap', true); add(document, 'doc-cap', true); add(div, 'div-cap', true);
        add(div, 'div-bub', false); add(document.body, 'body-bub', false); add(window, 'win-bub', false);
        div.dispatchEvent(new Event('ping', { bubbles: true }));
        let bare = 0;
        addEventListener('bare', () => bare++);
        dispatchEvent(new Event('bare'));
        return { order, bare,
            instances: [window, document, div].map(target => target instanceof EventTarget),
            own: [window, document, div].map(target =>
                Object.prototype.hasOwnProperty.call(target, 'addEventListener')),
            listenersField: '_eventListeners' in div };
    `);
    assert.deepEqual(actual.order.slice(0, 2), ['win-cap', 'doc-cap']);
    assert.deepEqual(actual.order.slice(-3), ['div-bub', 'body-bub', 'win-bub']);
    assert.ok(actual.order.indexOf('div-cap') < actual.order.indexOf('div-bub'));
    assert.deepEqual({ ...actual, order: undefined }, {
        order: undefined, bare: 1, instances: [true, true, true],
        own: [false, false, false], listenersField: false
    });
});

test('script errors do not reveal the Node vm filename', () => {
    const actual = evaluate(`
        try { null.x; } catch (error) { return { evalmachine: error.stack.includes('evalmachine') }; }
    `);
    assert.deepEqual(actual, { evalmachine: false });
});

test('script error stacks contain only sandbox frames', () => {
    const actual = evaluate(`
        const out = {};
        try { null.x; } catch (error) { out.direct = error.stack; }
        try { (() => { const inner = () => { throw new Error('deep'); }; inner(); })(); }
        catch (error) { out.nested = error.stack; }
        return out;
    `);
    for (const stack of [actual.direct, actual.nested]) {
        assert.ok(stack.length > 0);
        // 宿主帧（node:vm、项目文件路径）与 Node 默认脚本名都不能出现
        assert.equal(stack.includes('node:vm'), false, stack);
        assert.equal(stack.includes('standalone-runner.js'), false, stack);
        assert.equal(stack.includes('browserContext.js'), false, stack);
        assert.equal(stack.includes('evalmachine'), false, stack);
        assert.equal(stack.includes('[eval]'), false, stack);
    }
    // 函数名与位置保留，便于定位页面脚本里的问题
    assert.match(actual.direct, /^TypeError: .*\n    at <anonymous> \(<anonymous>:\d+:\d+\)/);
    assert.match(actual.nested, /^Error: deep\n    at inner \(<anonymous>:\d+:\d+\)/);
});

test('unhandled promise rejections are reported without host frames', () => {
    const result = spawnSync(process.execPath,
        ['standalone-runner.js', '--quiet', '--profile', 'default', '--code',
            'setTimeout(() => Promise.reject(new Error("boom")), 0)'],
        { cwd: root, encoding: 'utf8' });
    const reported = result.stderr.match(/Uncaught \(in promise\)[\s\S]*$/m);
    assert.ok(reported, result.stderr);
    const stack = reported[0];
    assert.match(stack, /Error: boom/);
    // 宿主帧（node:vm、项目文件路径）与 Node 默认脚本名都不能出现
    assert.equal(stack.includes('node:vm'), false, stack);
    assert.equal(stack.includes('standalone-runner.js'), false, stack);
    assert.equal(stack.includes('browserContext.js'), false, stack);
    assert.equal(stack.includes('evalmachine'), false, stack);
    assert.equal(stack.includes('[eval]'), false, stack);
});

test('timer errors are reported as Uncaught without host frames', () => {
    const result = spawnSync(process.execPath,
        ['standalone-runner.js', '--quiet', '--profile', 'default', '--code',
            'setTimeout(() => { throw new Error("in timer"); }, 0)'],
        { cwd: root, encoding: 'utf8' });
    const reported = result.stderr.match(/Uncaught[\s\S]*$/m);
    assert.ok(reported, result.stderr);
    const stack = reported[0];
    assert.match(stack, /Error: in timer/);
    assert.equal(stack.includes('node:vm'), false, stack);
    assert.equal(stack.includes('browserContext.js'), false, stack);
    assert.equal(stack.includes('standalone-runner.js'), false, stack);
    assert.equal(stack.includes('evalmachine'), false, stack);
    assert.equal(stack.includes('[eval]'), false, stack);
});

test('node tree relations are read-only prototype getters backed by internal state', () => {
    const actual = evaluate(`
        const div = document.createElement('div');
        const span = document.createElement('span');
        const text = document.createTextNode('t');
        div.appendChild(span);
        div.appendChild(text);
        document.body.appendChild(div);
        const desc = Object.getOwnPropertyDescriptor(Node.prototype, 'parentNode');
        let illegal = null;
        try { desc.get.call({}); } catch (error) { illegal = error.message; }
        span.parentNode = null;
        const clone = div.cloneNode(true);
        return {
            own: ['nodeType', 'parentNode', 'childNodes', 'firstChild', 'children']
                .filter(key => Object.prototype.hasOwnProperty.call(div, key)),
            setter: desc.set === undefined,
            getter: Function.prototype.toString.call(desc.get),
            illegal,
            readOnly: span.parentNode === div,
            relations: [div.firstChild === span, div.lastChild === text, span.nextSibling === text,
                text.previousSibling === span, div.children.length, div.firstElementChild === span,
                div.isConnected, span.ownerDocument === document],
            clone: [clone.childNodes.length, clone.firstChild.nodeName, clone.parentNode],
            types: [document.nodeType, document.nodeName, text.nodeType, document.documentElement.parentNode === document]
        };
    `);
    assert.deepEqual(actual, {
        own: [], setter: true, getter: 'function get parentNode() { [native code] }',
        illegal: 'Illegal invocation', readOnly: true,
        relations: [true, true, true, true, 1, true, true, true],
        clone: [2, 'SPAN', null],
        types: [9, '#document', 3, true]
    });
});

test('element identity, style and classList live on prototypes and clones do not share them', () => {
    const actual = evaluate(`
        const div = document.createElement('div');
        div.className = 'a b';
        div.style.color = 'red';
        const clone = div.cloneNode(false);
        clone.style.color = 'blue';
        clone.classList.add('z');
        div.classList = 'q r';
        div.scrollTop = 30;
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        const chain = [];
        for (let p = Object.getPrototypeOf(div); p; p = Object.getPrototypeOf(p)) chain.push(p.constructor.name);
        return {
            own: ['tagName', 'localName', 'namespaceURI', 'attributes', 'style', 'classList', 'dataset',
                'scrollTop', 'clientWidth', 'offsetWidth'].filter(key => Object.prototype.hasOwnProperty.call(div, key)),
            tag: [div.tagName, div.localName, div.namespaceURI],
            styleOnHTMLElement: Object.prototype.hasOwnProperty.call(HTMLElement.prototype, 'style'),
            isolated: [div.style.color, clone.style.color, clone.className],
            put: [div.className, div.scrollTop],
            svg: [Object.prototype.toString.call(rect), typeof rect.style, rect.tagName],
            tags: [div, document.createTextNode(''), document.createComment(''), document.createDocumentFragment()]
                .map(node => Object.prototype.toString.call(node)),
            chain
        };
    `);
    assert.deepEqual(actual, {
        own: [], tag: ['DIV', 'div', 'http://www.w3.org/1999/xhtml'], styleOnHTMLElement: true,
        isolated: ['red', 'blue', 'a b z'], put: ['q r', 30],
        svg: ['[object SVGElement]', 'object', 'RECT'],
        tags: ['[object HTMLDivElement]', '[object Text]', '[object Comment]', '[object DocumentFragment]'],
        chain: ['HTMLDivElement', 'HTMLElement', 'Element', 'Node', 'EventTarget', 'Object']
    });
});

test('HTMLElement attributes, CharacterData and canvas live on prototypes', () => {
    const actual = evaluate(`
        const div = document.createElement('div');
        div.setAttribute('title', 't');
        div.hidden = true;
        let fired = 0;
        div.onclick = () => { fired++; };
        div.click();
        const text = document.createTextNode('a');
        text.appendData('b');
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        let illegal = null;
        try { new CanvasRenderingContext2D(); } catch (error) { illegal = error.message; }
        return {
            divOwn: ['title', 'hidden', 'onclick', '_attrValues'].filter(key => Object.prototype.hasOwnProperty.call(div, key)),
            reflect: [div.title, div.getAttribute('hidden'), fired, div.tabIndex],
            text: [text.data, text.nodeValue, text.length, text instanceof CharacterData,
                Object.getOwnPropertyNames(text).includes('_data')],
            canvasOwn: ['getContext', 'toDataURL', 'width'].filter(key => Object.prototype.hasOwnProperty.call(canvas, key)),
            canvas: [canvas.getAttribute('width'), typeof HTMLCanvasElement.prototype.toDataURL,
                Object.prototype.toString.call(canvas.getContext('2d')),
                canvas.getContext('2d') === canvas.getContext('2d'), illegal]
        };
    `);
    assert.deepEqual(actual, {
        divOwn: [], reflect: ['t', '', 1, -1],
        text: ['ab', 'ab', 2, true, false],
        canvasOwn: [],
        canvas: ['64', 'function', '[object CanvasRenderingContext2D]', true, 'Illegal constructor']
    });
});

test('document keeps only location as an own property and derives URL state from location', () => {
    const actual = evaluate(`
        document.cookie = 'a=1';
        document.cookie = 'b=2';
        document.cookie = 'a=; max-age=0';
        history.pushState({}, '', '/next?x=1');
        let illegal = null;
        try { Object.getOwnPropertyDescriptor(Document.prototype, 'URL').get.call({}); }
        catch (error) { illegal = error.message; }
        return {
            own: Object.keys(document),
            cookie: document.cookie,
            url: [document.URL === location.href, document.baseURI, document.domain],
            native: [Function.prototype.toString.call(Object.getOwnPropertyDescriptor(Document.prototype, 'URL').get),
                Function.prototype.toString.call(document.createElement)],
            ownCreate: Object.prototype.hasOwnProperty.call(document, 'createElement'),
            locationConfigurable: Object.getOwnPropertyDescriptor(document, 'location').configurable,
            illegal
        };
    `);
    assert.deepEqual(actual, {
        own: ['location'], cookie: 'b=2',
        url: [true, 'https://www.example.com/next?x=1', 'www.example.com'],
        native: ['function get URL() { [native code] }', 'function createElement() { [native code] }'],
        ownCreate: false, locationConfigurable: false, illegal: 'Illegal invocation'
    });
});

test('screen and screen.orientation are WebIDL interfaces backed by the profile', () => {
    const actual = evaluate(`
        let fired = 0;
        screen.orientation.addEventListener('change', () => fired++);
        screen.orientation.dispatchEvent(new Event('change'));
        let illegal = null;
        try { new Screen(); } catch (error) { illegal = error.message; }
        return {
            own: Object.keys(screen), orientationOwn: Object.keys(screen.orientation),
            tags: [Object.prototype.toString.call(screen), Object.prototype.toString.call(screen.orientation)],
            eventTarget: screen.orientation instanceof EventTarget, fired,
            getter: Function.prototype.toString.call(Object.getOwnPropertyDescriptor(Screen.prototype, 'width').get),
            illegal
        };
    `);
    assert.deepEqual(actual, {
        own: [], orientationOwn: [],
        tags: ['[object Screen]', '[object ScreenOrientation]'],
        eventTarget: true, fired: 1,
        getter: 'function get width() { [native code] }',
        illegal: 'Illegal constructor'
    });
});

test('performance is a WebIDL EventTarget with a fractional monotonic clock', () => {
    const actual = evaluate(`
        const a = performance.now();
        const b = performance.now();
        performance.mark('m1');
        const measure = performance.measure('ms', 'm1');
        let ctor = null;
        try { new Performance(); } catch (error) { ctor = error.message; }
        return {
            own: Object.keys(performance),
            tags: [performance, performance.timing, performance.navigation, performance.memory,
                performance.getEntriesByName('m1')[0], measure].map(o => Object.prototype.toString.call(o)),
            eventTarget: performance instanceof EventTarget,
            mono: b >= a,
            json: Object.keys(performance.toJSON()),
            native: Function.prototype.toString.call(performance.now),
            ctor
        };
    `);
    assert.deepEqual(actual, {
        own: [],
        tags: ['[object Performance]', '[object PerformanceTiming]', '[object PerformanceNavigation]',
            '[object MemoryInfo]', '[object PerformanceMark]', '[object PerformanceMeasure]'],
        eventTarget: true, mono: true,
        json: ['timeOrigin', 'timing', 'navigation'],
        native: 'function now() { [native code] }',
        ctor: 'Illegal constructor'
    });
});

test('crypto is a WebIDL Crypto backed by real randomness and SHA digests', () => {
    const actual = evaluate(`
        const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('abc'));
        const hex = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
        let quota = null, mismatch = null, illegal = null;
        try { crypto.getRandomValues(new Uint8Array(65537)); } catch (error) { quota = error.name; }
        try { crypto.getRandomValues(new Float32Array(4)); } catch (error) { mismatch = error.name; }
        try { new Crypto(); } catch (error) { illegal = error.message; }
        return {
            own: Object.keys(crypto),
            tags: [Object.prototype.toString.call(crypto), Object.prototype.toString.call(crypto.subtle)],
            hex, quota, mismatch, illegal,
            uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(crypto.randomUUID())
        };
    `);
    assert.deepEqual(actual, {
        own: [], tags: ['[object Crypto]', '[object SubtleCrypto]'],
        hex: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
        quota: 'QuotaExceededError', mismatch: 'TypeMismatchError', illegal: 'Illegal constructor', uuid: true
    });
});

test('matchMedia returns MediaQueryList evaluated from the profile', () => {
    const actual = evaluate(`
        const mql = matchMedia('(min-width: 1000px) and (max-width: 3000px)');
        let fired = 0;
        mql.addEventListener('change', () => fired++);
        mql.dispatchEvent(new Event('change'));
        let illegal = null;
        try { new MediaQueryList(); } catch (error) { illegal = error.message; }
        return {
            tag: Object.prototype.toString.call(mql), own: Object.keys(mql),
            eventTarget: mql instanceof EventTarget, matches: mql.matches, media: mql.media,
            dark: matchMedia('(prefers-color-scheme: dark)').matches,
            light: matchMedia('(prefers-color-scheme: light)').matches,
            pointer: matchMedia('(pointer: fine)').matches,
            invalid: matchMedia('garbage((').matches,
            fired, illegal,
            native: Function.prototype.toString.call(matchMedia)
        };
    `);
    assert.deepEqual(actual, {
        tag: '[object MediaQueryList]', own: [], eventTarget: true, matches: true,
        media: '(min-width: 1000px) and (max-width: 3000px)',
        dark: false, light: true, pointer: true, invalid: false, fired: 1,
        illegal: 'Illegal constructor',
        native: 'function matchMedia() { [native code] }'
    });
});

test('MutationObserver reports DOM changes and observers are WebIDL interfaces', () => {
    const actual = evaluate(`
        const div = document.createElement('div');
        document.body.appendChild(div);
        const text = document.createTextNode('a');
        const records = [];
        const observer = new MutationObserver(list => records.push(...list));
        observer.observe(div, { childList: true, attributes: true, attributeOldValue: true,
            characterData: true, characterDataOldValue: true, subtree: true });
        div.setAttribute('title', 'a');
        div.setAttribute('title', 'b');
        div.appendChild(text);
        text.data = 'b';
        div.removeChild(text);
        await new Promise(resolve => setTimeout(resolve, 0));
        let io = 0;
        new IntersectionObserver(() => { io++; }).observe(div);
        await new Promise(resolve => setTimeout(resolve, 50));
        let noNew = null;
        try { MutationObserver(() => {}); } catch (error) { noNew = error.constructor.name; }
        return {
            types: records.map(record => record.type),
            oldValues: records.map(record => record.oldValue),
            tags: [Object.prototype.toString.call(observer), Object.prototype.toString.call(records[0])],
            own: [Object.keys(observer).length, Object.keys(records[0]).length],
            io, noNew
        };
    `);
    assert.deepEqual(actual, {
        types: ['attributes', 'attributes', 'childList', 'characterData', 'childList'],
        oldValues: [null, 'a', null, 'a', null],
        tags: ['[object MutationObserver]', '[object MutationRecord]'],
        own: [0, 0], io: 1, noNew: 'TypeError'
    });
});

test('WebGL contexts are WebIDL interfaces with prototype constants and typed-array parameters', () => {
    const actual = evaluate(`
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl');
        const before = gl.getParameter(37446);
        const errorBefore = gl.getError();
        const info = gl.getExtension('WEBGL_debug_renderer_info');
        const again = gl.getExtension('webgl_debug_renderer_info');
        const constructor = (() => {
            try { new WebGLRenderingContext(); return 'no'; } catch (error) { return error.message; }
        })();
        const extensions = gl.getSupportedExtensions();
        return {
            tag: Object.prototype.toString.call(gl),
            own: Object.keys(gl).length,
            constants: [WebGLRenderingContext.DEPTH_BUFFER_BIT, gl.MAX_TEXTURE_SIZE,
                WebGLRenderingContext.prototype.MAX_VERTEX_ATTRIBS],
            native: String(gl.getParameter).includes('native code'),
            constructor,
            typed: [gl.getParameter(gl.ALIASED_LINE_WIDTH_RANGE) instanceof Float32Array,
                gl.getParameter(gl.MAX_VIEWPORT_DIMS) instanceof Int32Array,
                Array.from(gl.getParameter(gl.VIEWPORT))],
            before, errorBefore, after: gl.getParameter(info.UNMASKED_RENDERER_WEBGL),
            stable: info === again,
            extensionTag: Object.prototype.toString.call(info),
            extensionCount: extensions.length,
            copy: extensions !== gl.getSupportedExtensions(),
            viewport: Array.from(gl.getParameter(gl.VIEWPORT)),
            drawingBufferWidth: (canvas.width = 512, gl.drawingBufferWidth),
            renderer: [gl.getParameter(gl.VENDOR), gl.getParameter(gl.RENDERER), gl.getParameter(gl.MAX_TEXTURE_SIZE)]
        };
    `);
    assert.deepEqual(actual, {
        tag: '[object WebGLRenderingContext]',
        own: 0,
        constants: [256, 3379, 34921],
        native: true,
        constructor: 'Illegal constructor',
        typed: [true, true, [0, 0, 300, 150]],
        before: null, errorBefore: 1280,
        after: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)',
        stable: true,
        extensionTag: '[object WEBGLDebugRendererInfo]',
        extensionCount: 29,
        copy: true,
        viewport: [0, 0, 300, 150],
        drawingBufferWidth: 512,
        renderer: ['WebKit', 'WebKit WebGL', 16384]
    });
});

test('WebGL2 is an independent interface and a canvas keeps a single context type', () => {
    const actual = evaluate(`
        const gl = document.createElement('canvas').getContext('webgl');
        const gl2 = document.createElement('canvas').getContext('webgl2');
        const canvas = document.createElement('canvas');
        const first = canvas.getContext('webgl');
        const alias = canvas.getContext('experimental-webgl');
        const arity = (() => {
            try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA); return 'no'; }
            catch (error) { return error.message; }
        })();
        gl.getParameter(99999);
        return {
            tags: [Object.prototype.toString.call(gl2)],
            inherits: WebGL2RenderingContext.prototype instanceof WebGLRenderingContext,
            instanceof: [gl2 instanceof WebGL2RenderingContext, gl2 instanceof WebGLRenderingContext,
                gl instanceof WebGLRenderingContext],
            versions: [gl.getParameter(gl.VERSION), gl2.getParameter(gl.VERSION)],
            webgl2Only: gl.getParameter(36063),
            alias: first === alias,
            differentType: canvas.getContext('2d'),
            secondType: document.createElement('canvas') && (() => {
                const other = document.createElement('canvas');
                other.getContext('2d');
                return other.getContext('webgl');
            })(),
            error: [gl.getError(), gl.getError()],
            arity
        };
    `);
    assert.deepEqual(actual, {
        tags: ['[object WebGL2RenderingContext]'],
        inherits: false,
        instanceof: [true, false, true],
        versions: ['WebGL 1.0 (OpenGL ES 2.0 Chromium)', 'WebGL 2.0 (OpenGL ES 3.0 Chromium)'],
        webgl2Only: null,
        alias: true,
        differentType: null,
        secondType: null,
        error: [1280, 0],
        arity: "Failed to execute 'texImage2D' on 'WebGLRenderingContext': 6 arguments required, but only 3 present."
    });
});

test('WebGL shaders, programs and context loss follow the spec', () => {
    const actual = evaluate(`
        const gl = document.createElement('canvas').getContext('webgl');
        const vertex = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertex, 'attribute vec3 a_position; attribute vec2 a_uv; uniform mat4 u_matrix;' +
            ' void main() { gl_Position = u_matrix * vec4(a_position, 1.0); }');
        gl.compileShader(vertex);
        const fragment = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragment, 'precision mediump float; uniform vec4 u_color; uniform float u_scale[2];' +
            ' void main() { gl_FragColor = u_color * u_scale[0]; }');
        gl.compileShader(fragment);
        const broken = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(broken, 'precision mediump float;');
        gl.compileShader(broken);
        const program = gl.createProgram();
        gl.attachShader(program, vertex);
        gl.attachShader(program, fragment);
        gl.linkProgram(program);
        const unlinked = gl.createProgram();
        gl.linkProgram(unlinked);
        const attribute = gl.getActiveAttrib(program, 0);
        const uniform = gl.getActiveUniform(program, 2);
        const events = [];
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('webgl');
        canvas.addEventListener('webglcontextlost', event => events.push(
            [event.type, event.statusMessage, Object.prototype.toString.call(event), event.cancelable]));
        context.getExtension('WEBGL_lose_context').loseContext();
        await new Promise(resolve => setTimeout(resolve, 10));
        return {
            compile: [gl.getShaderParameter(vertex, gl.COMPILE_STATUS),
                gl.getShaderParameter(broken, gl.COMPILE_STATUS)],
            logs: [gl.getShaderInfoLog(vertex), gl.getShaderInfoLog(broken) !== ''],
            link: [gl.getProgramParameter(program, gl.LINK_STATUS),
                gl.getProgramParameter(unlinked, gl.LINK_STATUS)],
            counts: [gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES),
                gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS)],
            locations: [gl.getAttribLocation(program, 'a_uv'), gl.getAttribLocation(program, 'a_missing'),
                !!gl.getUniformLocation(program, 'u_color'), gl.getUniformLocation(program, 'u_missing')],
            infos: [attribute.name, attribute.type === gl.FLOAT_VEC3, attribute.size,
                uniform.name, uniform.size, Object.prototype.toString.call(uniform)],
            lost: [context.isContextLost(), context.getError() === 0x9242, events]
        };
    `);
    assert.deepEqual(actual, {
        compile: [true, false],
        logs: ['', true],
        link: [true, false],
        counts: [2, 3],
        locations: [1, -1, true, null],
        infos: ['a_position', true, 1, 'u_scale[0]', 2, '[object WebGLActiveInfo]'],
        lost: [true, true, [['webglcontextlost', '', '[object WebGLContextEvent]', true]]]
    });
});

test('element instances carry no own properties and expose their interface names', () => {
    const actual = evaluate(`
        const own = element => Object.getOwnPropertyNames(element).filter(key => !key.startsWith('__'));
        const input = document.createElement('input');
        input.value = 'v';
        input.checked = true;
        input.name = 'n';
        const anchor = document.createElement('a');
        anchor.href = '/x';
        const div = document.createElement('div');
        div.align = 'center';
        const clone = input.cloneNode(false);
        const link = document.createElement('link');
        link.href = '/a.css';
        return {
            own: [input, anchor, div, link, document.body, document.documentElement, document.createElement('canvas')]
                .map(own),
            reads: [input.value, input.checked, input.name, anchor.href, div.align],
            clone: clone.value,
            tags: ['input', 'a', 'body', 'foo', 'my-widget', 'tbody']
                .map(tag => Object.prototype.toString.call(document.createElement(tag))),
            instanceOf: [input instanceof HTMLInputElement, document.body instanceof HTMLBodyElement,
                document.createElement('foo') instanceof HTMLUnknownElement,
                document.createElement('my-widget') instanceof HTMLUnknownElement],
            keys: [Object.keys(input).length, Object.keys(div).length]
        };
    `);
    assert.deepEqual(actual, {
        own: [[], [], [], [], [], [], []],
        reads: ['v', true, 'n', 'https://www.example.com/x', 'center'],
        clone: 'v',
        tags: ['[object HTMLInputElement]', '[object HTMLAnchorElement]', '[object HTMLBodyElement]',
            '[object HTMLUnknownElement]', '[object HTMLElement]', '[object HTMLTableSectionElement]'],
        instanceOf: [true, true, true, false],
        keys: [0, 0]
    });
});

test('legacy event subclasses keep their fields on prototypes', () => {
    const actual = evaluate(`
        const own = event => Object.getOwnPropertyNames(event).filter(key => !key.startsWith('__'));
        const mouse = new MouseEvent('click', { clientX: 5, clientY: 6, button: 1, ctrlKey: true });
        mouse.initMouseEvent('click', true, true, window, 1, 2, 3, 4, 5, true, false, true, false, 2, null);
        const custom = new CustomEvent('x', { detail: { a: 1 } });
        const key = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13 });
        const progress = new ProgressEvent('progress', { loaded: 3, total: 9, lengthComputable: true });
        return {
            own: [mouse, custom, key, progress, new Touch({ identifier: 1, target: document.body }),
                new DataTransfer()].map(own),
            tags: [mouse, key].map(event => Object.prototype.toString.call(event)),
            reads: [mouse.clientX, mouse.ctrlKey, mouse.button, mouse.getModifierState('Control'),
                custom.detail.a, key.key, key.keyCode, progress.loaded, progress.total],
            afterInit: [mouse.screenX, mouse.clientX, mouse.shiftKey, mouse.button],
            instanceOf: [mouse instanceof MouseEvent, mouse instanceof UIEvent, mouse instanceof Event],
            constructorName: mouse.constructor.name,
            baseOwn: own(new Event('click'))
        };
    `);
    assert.deepEqual(actual, {
        own: [['isTrusted'], ['isTrusted'], ['isTrusted'], ['isTrusted'], [], []],
        tags: ['[object MouseEvent]', '[object KeyboardEvent]'],
        reads: [4, true, 2, true, 1, 'Enter', 13, 3, 9],
        afterInit: [2, 4, true, 2],
        instanceOf: [true, true, true],
        constructorName: 'MouseEvent',
        baseOwn: ['isTrusted']
    });
});

test('style, classList and the 2d context keep state off the instance', () => {
    const actual = evaluate(`
        const own = value => Object.getOwnPropertyNames(value).filter(key => !key.startsWith('__'));
        const div = document.createElement('div');
        div.style.color = 'red';
        div.style.setProperty('background-color', 'blue', 'important');
        div.classList.add('a', 'b');
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        context.fillStyle = '#fff';
        context.lineWidth = 3;
        context.save();
        context.restore();
        const clone = div.cloneNode(false);
        return {
            own: [div.style, div.classList, context].map(own),
            keys: [Object.keys(div.style).length, Object.keys(context).length],
            styleReads: [div.style.color, div.style.getPropertyPriority('background-color'), div.style.cssText],
            classReads: [div.classList.length, div.classList.contains('b'), div.className],
            contextReads: [context.fillStyle, context.lineWidth, context.canvas.tagName],
            contextTag: Object.prototype.toString.call(context),
            methods: [typeof context.getImageData, typeof context.fillRect],
            clone: [own(clone.style).length, clone.style.color, clone.className]
        };
    `);
    assert.deepEqual(actual, {
        own: [[], [], []],
        keys: [0, 0],
        styleReads: ['red', 'important', 'color: red; background-color: blue !important;'],
        classReads: [2, true, 'a b'],
        contextReads: ['#fff', 3, 'CANVAS'],
        contextTag: '[object CanvasRenderingContext2D]',
        methods: ['function', 'function'],
        clone: [0, 'red', 'a b']
    });
});

test('element interfaces are not constructible and keep browser interface names', () => {
    const actual = evaluate(`
        const attempt = fn => {
            try { fn(); return 'ok'; } catch (error) { return error.constructor.name + ': ' + error.message; }
        };
        const div = document.createElement('div');
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        return {
            illegal: [attempt(() => new HTMLDivElement()), attempt(() => new HTMLElement()),
                attempt(() => new SVGElement()), attempt(() => new HTMLUnknownElement()),
                attempt(() => HTMLCanvasElement())],
            factories: [attempt(() => new Image(2, 2)), attempt(() => new Option('t')), attempt(() => new Audio())],
            identity: [div instanceof HTMLDivElement, div instanceof HTMLElement, svg instanceof SVGElement,
                div.constructor === HTMLDivElement, div.constructor.name],
            names: ['blockquote', 'q', 'ins', 'del', 'param', 'col', 'summary', 'foo']
                .map(tag => Object.prototype.toString.call(document.createElement(tag))),
            reads: [
                (() => { const blockquote = document.createElement('blockquote'); blockquote.cite = '/c';
                    return [blockquote.cite, blockquote.getAttribute('cite')]; })(),
                (() => { const col = document.createElement('col'); col.span = 4; return [col.span]; })()
            ]
        };
    `);
    assert.deepEqual(actual, {
        illegal: ['TypeError: Illegal constructor', 'TypeError: Illegal constructor',
            'TypeError: Illegal constructor', 'TypeError: Illegal constructor', 'TypeError: Illegal constructor'],
        factories: ['ok', 'ok', 'ok'],
        identity: [true, true, true, true, 'HTMLDivElement'],
        names: ['[object HTMLQuoteElement]', '[object HTMLQuoteElement]', '[object HTMLModElement]',
            '[object HTMLModElement]', '[object HTMLParamElement]', '[object HTMLTableColElement]',
            '[object HTMLElement]', '[object HTMLUnknownElement]'],
        reads: [['/c', '/c'], [4]]
    });
});

test('network, storage and channel APIs exist with browser shapes', () => {
    const actual = evaluate(`
        const types = ['WebSocket', 'EventSource', 'RTCPeerConnection', 'indexedDB', 'caches', 'MessageChannel',
            'MessagePort', 'createImageBitmap', 'ImageBitmap', 'Blob', 'File', 'FileReader', 'FormData',
            'Headers', 'Request', 'Response', 'IDBKeyRange', 'CloseEvent', 'external']
            .map(name => typeof eval(name));
        const blob = new Blob(['abc'], { type: 'text/plain' });
        const form = new FormData();
        form.append('k', 'v');
        const headers = new Headers({ 'X-A': '1' });
        headers.append('x-b', '2');
        const request = new Request('/api', { method: 'post' });
        const messages = [];
        const channel = new MessageChannel();
        channel.port1.onmessage = event => messages.push(event.data);
        channel.port2.postMessage('hi');
        const socketEvents = [];
        const socket = new WebSocket('wss://example.test/x');
        socket.onclose = event => socketEvents.push([event.code, Object.prototype.toString.call(event)]);
        const storage = [];
        const open = indexedDB.open('db');
        open.onerror = () => storage.push(open.error.name);
        await new Promise(resolve => setTimeout(resolve, 10));
        const response = await fetch('/api');
        const responseText = await new Response('payload').text();
        const bitmap = await createImageBitmap({ width: 4, height: 2 });
        const cache = await caches.open('v1');
        await cache.put('https://a.test/1', { ok: true });
        return {
            types,
            own: [blob, socket, response, headers].map(value => Object.getOwnPropertyNames(value).length),
            reads: [blob.size, blob.type, form.get('k'), headers.get('x-a'), Array.from(headers.keys()).join(','),
                request.method, request.url],
            messages, socketEvents, storage,
            response: [response.ok, response.status, response.url, responseText],
            bitmap: [bitmap.width, bitmap.height, Object.prototype.toString.call(bitmap)],
            cache: (await cache.match('https://a.test/1')).ok,
            tags: [Object.prototype.toString.call(socket), Object.prototype.toString.call(channel.port1)],
            invalidSocket: (() => { try { new WebSocket('http://x'); return 'ok'; } catch (error) { return error.name; } })()
        };
    `);
    assert.deepEqual(actual, {
        types: ['function', 'function', 'function', 'object', 'object', 'function', 'function', 'function',
            'function', 'function', 'function', 'function', 'function', 'function', 'function', 'function',
            'function', 'function', 'object'],
        own: [0, 0, 0, 0],
        reads: [3, 'text/plain', 'v', '1', 'x-a,x-b', 'POST', 'https://www.example.com/api'],
        messages: ['hi'],
        socketEvents: [[1006, '[object CloseEvent]']],
        storage: ['UnknownError'],
        response: [true, 200, 'https://www.example.com/api', 'payload'],
        bitmap: [4, 2, '[object ImageBitmap]'],
        cache: true,
        tags: ['[object WebSocket]', '[object MessagePort]'],
        invalidSocket: 'SyntaxError'
    });
});

test('streams and canvas object types are real interfaces', () => {
    const actual = evaluate(`
        const chunks = [];
        const stream = new ReadableStream({
            start(controller) { controller.enqueue('a'); controller.enqueue('b'); controller.close(); }
        });
        const reader = stream.getReader();
        chunks.push((await reader.read()).value, (await reader.read()).value, (await reader.read()).done);
        const doubled = [];
        const transform = new TransformStream({ transform(chunk, controller) { controller.enqueue(chunk * 2); } });
        const writer = transform.writable.getWriter();
        writer.write(2);
        await writer.close();
        const out = transform.readable.getReader();
        doubled.push((await out.read()).value, (await out.read()).done);
        const response = await fetch('/api');
        const bodyChunk = await response.body.getReader().read();
        const context = document.createElement('canvas').getContext('2d');
        const image = context.createImageData(2, 2);
        const gradient = context.createLinearGradient(0, 0, 1, 1);
        gradient.addColorStop(0.5, 'red');
        const metrics = context.measureText('hi');
        return {
            chunks, doubled,
            tags: [Object.prototype.toString.call(stream), Object.prototype.toString.call(transform.readable),
                Object.prototype.toString.call(response.body), Object.prototype.toString.call(image),
                Object.prototype.toString.call(gradient), Object.prototype.toString.call(metrics)],
            types: [typeof ReadableStream, typeof WritableStream, typeof TransformStream],
            image: [image.width, image.height, image.data.length, image instanceof ImageData],
            metrics: [metrics.width, metrics instanceof TextMetrics],
            gradient: [gradient instanceof CanvasGradient, (() => {
                try { gradient.addColorStop(2, 'x'); return 'ok'; } catch (error) { return error.name; }
            })()],
            bodyBytes: [bodyChunk.done, bodyChunk.value instanceof Uint8Array],
            own: [Object.getOwnPropertyNames(reader).length, Object.getOwnPropertyNames(image).length]
        };
    `);
    assert.deepEqual(actual, {
        chunks: ['a', 'b', true],
        doubled: [4, true],
        tags: ['[object ReadableStream]', '[object ReadableStream]', '[object ReadableStream]',
            '[object ImageData]', '[object CanvasGradient]', '[object TextMetrics]'],
        types: ['function', 'function', 'function'],
        image: [2, 2, 16, true],
        metrics: [16, true],
        gradient: [true, 'IndexSizeError'],
        bodyBytes: [false, true],
        own: [0, 0]
    });
});

test('navigator exposes lock, wake lock, media session and speech APIs', () => {
    const actual = evaluate(`
        const events = [];
        const utterance = new SpeechSynthesisUtterance('hi');
        utterance.onend = () => events.push('end');
        speechSynthesis.speak(utterance);
        navigator.mediaSession.metadata = new MediaMetadata({ title: 't' });
        const lock = await navigator.locks.request('db', held => held.name);
        const wake = await navigator.wakeLock.request('screen').then(() => 'ok', error => error.name);
        const share = await navigator.share({}).then(() => 'ok', error => error.name);
        await new Promise(resolve => setTimeout(resolve, 10));
        return {
            events, lock, wake, share, canShare: navigator.canShare({}),
            session: [navigator.mediaSession.metadata.title, navigator.mediaSession.playbackState],
            voices: speechSynthesis.getVoices().length,
            tags: [Object.prototype.toString.call(navigator.locks),
                Object.prototype.toString.call(navigator.wakeLock),
                Object.prototype.toString.call(navigator.mediaSession),
                Object.prototype.toString.call(utterance)],
            own: Object.getOwnPropertyNames(navigator).length
        };
    `);
    assert.deepEqual(actual, {
        events: ['end'], lock: 'db', wake: 'NotAllowedError', share: 'AbortError', canShare: false,
        session: ['t', 'none'], voices: 0,
        tags: ['[object LockManager]', '[object WakeLock]', '[object MediaSession]',
            '[object SpeechSynthesisUtterance]'],
        own: 0
    });
});

test('Range, Selection, TreeWalker, ShadowRoot and DOMParser behave like the browser', () => {
    const actual = evaluate(`
        const div = document.createElement('div');
        div.innerHTML = '<span>a</span><b>c</b>';
        document.body.appendChild(div);
        const range = document.createRange();
        range.setStart(div.firstChild, 0);
        range.setEnd(div.lastChild, 1);
        const contents = document.createRange();
        contents.selectNodeContents(div.firstChild);
        const selection = window.getSelection();
        selection.addRange(contents);
        const walker = document.createTreeWalker(div, NodeFilter.SHOW_ALL, null);
        const visited = [];
        for (let node = walker.nextNode(); node; node = walker.nextNode()) visited.push(node.nodeName);
        const iterator = document.createNodeIterator(div, NodeFilter.SHOW_ELEMENT, null);
        const elementNames = [];
        for (let node = iterator.nextNode(); node; node = iterator.nextNode()) elementNames.push(node.localName);
        const host = document.createElement('div');
        const shadow = host.attachShadow({ mode: 'open' });
        shadow.innerHTML = '<p>shadow</p>';
        const closedHost = document.createElement('div');
        closedHost.attachShadow({ mode: 'closed' });
        const parsed = new DOMParser().parseFromString(
            '<html><head><title>T</title></head><body><p id="x">hi</p></body></html>', 'text/html');
        return {
            tags: [Object.prototype.toString.call(range), Object.prototype.toString.call(selection),
                Object.prototype.toString.call(walker), Object.prototype.toString.call(iterator),
                Object.prototype.toString.call(shadow)],
            globals: ['Range', 'Selection', 'TreeWalker', 'NodeIterator', 'ShadowRoot', 'NodeFilter',
                'DOMParser', 'XMLSerializer'].map(name => typeof window[name]),
            range: [range.collapsed, range.toString(), range.commonAncestorContainer === div,
                contents.toString(), contents.collapsed],
            selection: [selection.rangeCount, selection.getRangeAt(0) === contents, selection.type],
            visited, elementNames,
            shadow: [shadow.mode, shadow.host === host, host.shadowRoot === shadow, closedHost.shadowRoot,
                shadow.innerHTML],
            errors: [(() => { try { host.attachShadow({ mode: 'open' }); return 'ok'; }
                catch (error) { return error.name; } })(),
                (() => { try { document.createElement('img').attachShadow({ mode: 'open' }); return 'ok'; }
                    catch (error) { return error.name; } })()],
            parsed: [parsed.title, parsed.body.firstChild.textContent, parsed.getElementById('x').textContent,
                parsed instanceof Document, Object.prototype.toString.call(parsed)],
            serializer: new XMLSerializer().serializeToString(div),
            documentKeys: Object.keys(document)
        };
    `);
    assert.deepEqual(actual, {
        tags: ['[object Range]', '[object Selection]', '[object TreeWalker]', '[object NodeIterator]',
            '[object ShadowRoot]'],
        globals: ['function', 'function', 'function', 'function', 'function', 'function', 'function', 'function'],
        range: [false, 'ac', true, 'a', false],
        selection: [1, true, 'Range'],
        visited: ['SPAN', '#text', 'B', '#text'],
        elementNames: ['div', 'span', 'b'],
        shadow: ['open', true, true, null, '<p>shadow</p>'],
        errors: ['NotSupportedError', 'NotSupportedError'],
        parsed: ['T', 'hi', 'hi', true, '[object HTMLDocument]'],
        serializer: '<div><span>a</span><b>c</b></div>',
        documentKeys: ['location']
    });
});

test('media capture and push APIs exist with browser shapes', () => {
    const actual = evaluate(`
        const stream = new MediaStream();
        const recorder = new MediaRecorder(stream);
        const events = [];
        recorder.onstart = () => events.push('start');
        recorder.onstop = () => events.push('stop');
        recorder.start();
        recorder.stop();
        const subscription = await navigator.serviceWorker.pushManager.getSubscription();
        await new Promise(resolve => setTimeout(resolve, 10));
        return {
            types: ['MediaStream', 'MediaStreamTrack', 'MediaRecorder', 'PushManager'].map(name => typeof window[name]),
            tags: [Object.prototype.toString.call(stream), Object.prototype.toString.call(recorder),
                Object.prototype.toString.call(navigator.serviceWorker.pushManager)],
            stream: [stream.active, stream.getTracks().length],
            recorder: [recorder.state, MediaRecorder.isTypeSupported('video/webm')],
            events, subscription,
            errors: [
                (() => { try { new MediaRecorder({}); return 'ok'; }
                    catch (error) { return error.constructor.name; } })(),
                (() => { try { new MediaStreamTrack(); return 'ok'; } catch (error) { return error.message; } })()
            ],
            own: [Object.getOwnPropertyNames(stream).length,
                Object.getOwnPropertyNames(navigator.serviceWorker.pushManager).length]
        };
    `);
    assert.deepEqual(actual, {
        types: ['function', 'function', 'function', 'function'],
        tags: ['[object MediaStream]', '[object MediaRecorder]', '[object PushManager]'],
        stream: [false, 0],
        recorder: ['inactive', true],
        events: ['start', 'stop'],
        subscription: null,
        errors: ['TypeError', 'Illegal constructor'],
        own: [0, 0]
    });
});

test('XMLDocument and DocumentType are real interfaces', () => {
    const actual = evaluate(`
        const xml = new DOMParser().parseFromString('<!DOCTYPE note SYSTEM "note.dtd"><root><a/></root>', 'application/xml');
        const html = new DOMParser().parseFromString('<!DOCTYPE html><html><body><p>x</p></body></html>', 'text/html');
        return {
            xml: [Object.prototype.toString.call(xml), xml instanceof XMLDocument, xml.documentElement.localName,
                Object.prototype.toString.call(xml.doctype), xml.doctype.name, xml.doctype.systemId, xml.doctype.nodeType],
            html: [Object.prototype.toString.call(html), html.doctype.name, html.body.firstChild.tagName],
            live: [Object.prototype.toString.call(document.doctype), document.doctype.name,
                document.doctype instanceof DocumentType,
                document.implementation.createDocumentType('svg', 'p', 's').publicId],
            constructorError: (() => { try { new DocumentType(); return 'ok'; }
                catch (error) { return error.message; } })(),
            documentKeys: Object.keys(document)
        };
    `);
    assert.deepEqual(actual, {
        xml: ['[object XMLDocument]', true, 'root', '[object DocumentType]', 'note', 'note.dtd', 10],
        html: ['[object HTMLDocument]', 'html', 'P'],
        live: ['[object DocumentType]', 'html', true, 'p'],
        constructorError: 'Illegal constructor',
        documentKeys: ['location']
    });
});

test('computed style and DOM interfaces match the browser', () => {
    const actual = evaluate(`
        const div = document.createElement('div');
        div.style.color = 'red';
        div.classList.add('a');
        const span = document.createElement('span');
        const meta = document.createElement('meta');
        const anchor = document.createElement('a');
        anchor.relList.add('noopener');
        const form = document.createElement('form');
        const input = document.createElement('input');
        input.id = 'field';
        form.appendChild(input);
        const label = document.createElement('label');
        label.setAttribute('for', 'field');
        form.appendChild(label);
        document.body.appendChild(form);
        document.body.appendChild(div);
        const computed = getComputedStyle(div);
        return {
            tags: [Object.prototype.toString.call(computed), Object.prototype.toString.call(div.style),
                Object.prototype.toString.call(div.classList), Object.prototype.toString.call(div.attributes),
                Object.prototype.toString.call(div.getBoundingClientRect()),
                Object.prototype.toString.call(div.dataset)],
            globals: ['CSSStyleDeclaration', 'DOMTokenList', 'NamedNodeMap', 'DOMStringMap', 'DOMRect']
                .map(name => typeof window[name]),
            computed: [computed.color, computed.display, computed.getPropertyValue('color'),
                computed.length > 5, computed instanceof CSSStyleDeclaration],
            displays: [getComputedStyle(span).display, getComputedStyle(meta).display, getComputedStyle(div).display],
            tokenLists: [div.classList instanceof DOMTokenList, div.classList.value, div.className,
                anchor.relList.value, anchor.getAttribute('rel')],
            label: [label.htmlFor, typeof label.htmlFor, label.control === input, label.form === form],
            rectOwnProperties: Object.getOwnPropertyNames(div.getBoundingClientRect()).length,
            constructors: [
                (() => { try { new DOMTokenList(); return 'ok'; }
                    catch (error) { return error.message; } })(),
                (() => { try { new DOMRect(); return 'ok'; }
                    catch (error) { return error.constructor.name; } })()
            ],
            documentKeys: Object.keys(document)
        };
    `);
    assert.deepEqual(actual, {
        tags: ['[object CSSStyleDeclaration]', '[object CSSStyleDeclaration]', '[object DOMTokenList]',
            '[object NamedNodeMap]', '[object DOMRect]', '[object DOMStringMap]'],
        globals: ['function', 'function', 'function', 'function', 'function'],
        computed: ['red', 'block', 'red', true, true],
        displays: ['inline', 'none', 'block'],
        tokenLists: [true, 'a', 'a', 'noopener', 'noopener'],
        label: ['field', 'string', true, true],
        rectOwnProperties: 0,
        constructors: ['Illegal constructor', 'ok'],
        documentKeys: ['location']
    });
});

test('CSSOM and reflected element attributes match the browser', () => {
    const actual = evaluate(`
        const style = document.createElement('style');
        style.textContent = 'div { color: red } @media screen { p { color: blue } }';
        document.head.appendChild(style);
        const sheet = document.styleSheets[0];
        const rules = sheet.cssRules;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '/a.css';
        document.head.appendChild(link);
        const textarea = document.createElement('textarea');
        textarea.rows = 4;
        textarea.placeholder = 'p';
        textarea.required = true;
        const img = document.createElement('img');
        img.loading = 'lazy';
        img.isMap = true;
        const script = document.createElement('script');
        script.async = true;
        script.src = '/x.js';
        const own = element => Object.getOwnPropertyNames(element).length;
        return {
            tags: [Object.prototype.toString.call(document.styleSheets), Object.prototype.toString.call(sheet),
                Object.prototype.toString.call(rules), Object.prototype.toString.call(rules[0]),
                Object.prototype.toString.call(rules[1]), Object.prototype.toString.call(rules[1].media)],
            globals: ['CSSStyleSheet', 'CSSRule', 'CSSStyleRule', 'CSSMediaRule', 'CSSRuleList', 'StyleSheet',
                'StyleSheetList', 'MediaList'].map(name => typeof window[name]),
            cssom: [document.styleSheets.length, rules.length, rules[0].selectorText, rules[0].style.color,
                rules[0].type, rules[0].cssText, rules[1].media.mediaText, rules[1].cssRules.length,
                CSSRule.STYLE_RULE, CSSRule.MEDIA_RULE],
            insertRule: (() => { const index = sheet.insertRule('.b { padding: 1px }', 1);
                return [index, sheet.cssRules.length, sheet.cssRules[1].selectorText]; })(),
            linkSheet: link.sheet ? Object.prototype.toString.call(link.sheet) : null,
            reflected: [textarea.rows, textarea.getAttribute('rows'), textarea.placeholder, textarea.required,
                textarea.getAttribute('required'), img.loading, img.getAttribute('loading'), img.isMap,
                img.getAttribute('ismap'), script.async, script.getAttribute('async'), script.src,
                script.getAttribute('src')],
            own: [own(textarea), own(img), own(script), own(link)]
        };
    `);
    assert.deepEqual(actual, {
        tags: ['[object StyleSheetList]', '[object CSSStyleSheet]', '[object CSSRuleList]',
            '[object CSSStyleRule]', '[object CSSMediaRule]', '[object MediaList]'],
        globals: ['function', 'function', 'function', 'function', 'function', 'function', 'function', 'function'],
        cssom: [2, 2, 'div', 'red', 1, 'div { color: red; }', 'screen', 1, 1, 4],
        insertRule: [1, 3, '.b'],
        linkSheet: '[object CSSStyleSheet]',
        reflected: [4, '4', 'p', true, '', 'lazy', 'lazy', true, '', true, '',
            'https://www.example.com/x.js', '/x.js'],
        own: [0, 0, 0, 0]
    });
});

test('computed style applies stylesheet rules and inheritance', () => {
    const actual = evaluate(`
        const style = document.createElement('style');
        style.textContent = 'div.card { color: green; font-size: 20px } .parent { font-family: Courier } p { display: inline }';
        document.head.appendChild(style);
        const parent = document.createElement('div');
        parent.className = 'parent';
        parent.style.lineHeight = '2';
        const child = document.createElement('span');
        parent.appendChild(child);
        const card = document.createElement('div');
        card.className = 'card';
        const paragraph = document.createElement('p');
        document.body.appendChild(parent);
        document.body.appendChild(card);
        document.body.appendChild(paragraph);
        const beforeInline = getComputedStyle(card).color;
        card.style.color = 'orange';
        const childStyle = getComputedStyle(child);
        return {
            inherited: [childStyle.fontFamily, childStyle.lineHeight, childStyle.visibility],
            fromRules: [beforeInline, getComputedStyle(card).fontSize, getComputedStyle(paragraph).display],
            inlineWins: getComputedStyle(card).color,
            defaults: [childStyle.display, childStyle.backgroundColor, childStyle.fontSize],
            own: Object.getOwnPropertyNames(childStyle).length,
            instanceOf: childStyle instanceof CSSStyleDeclaration
        };
    `);
    assert.deepEqual(actual, {
        inherited: ['Courier', '2', 'visible'],
        fromRules: ['green', '20px', 'inline'],
        inlineWins: 'orange',
        defaults: ['inline', 'rgba(0, 0, 0, 0)', '16px'],
        own: 8,
        instanceOf: true
    });
});

test('XML parsing keeps namespaces, CDATA and entities, and XSLTProcessor exists', () => {
    const actual = evaluate(`
        const xml = new DOMParser().parseFromString(
            '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="10">'
            + '<!-- comment --><title>T &amp; t</title><![CDATA[cdata <b>]]>'
            + '<g><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#a"/></g></svg>', 'image/svg+xml');
        const root = xml.documentElement;
        const group = root.querySelector('g');
        const use = root.querySelector('use');
        const processor = new XSLTProcessor();
        processor.setParameter('urn:x', 'p', 7);
        const fragment = processor.transformToFragment(root, document);
        return {
            xml: [Object.prototype.toString.call(xml), xml.contentType, root.localName],
            namespace: [root.namespaceURI, group.namespaceURI === root.namespaceURI,
                use.namespaceURI === root.namespaceURI, root.getAttribute('xmlns')],
            content: [root.querySelector('title').textContent,
                Array.from(root.childNodes).some(node => node.nodeType === 8),
                Array.from(root.childNodes).some(node => node.nodeType === 3 && node.data.startsWith('cdata')),
                use.getAttribute('xlink:href')],
            serialized: new XMLSerializer().serializeToString(root)
                .startsWith('<svg xmlns="http://www.w3.org/2000/svg"'),
            xslt: [Object.prototype.toString.call(processor), processor.getParameter('urn:x', 'p'),
                Object.prototype.toString.call(fragment), fragment.firstChild.localName],
            missingGlobals: ['XSLTProcessor', 'XMLDocument', 'DocumentType'].filter(name => typeof window[name] === 'undefined')
        };
    `);
    assert.deepEqual(actual, {
        xml: ['[object XMLDocument]', 'application/xml', 'svg'],
        namespace: ['http://www.w3.org/2000/svg', true, true, 'http://www.w3.org/2000/svg'],
        content: ['T & t', true, true, '#a'],
        serialized: true,
        xslt: ['[object XSLTProcessor]', 7, '[object DocumentFragment]', 'svg'],
        missingGlobals: []
    });
});

test('computed style follows the cascade (specificity and !important)', () => {
    const actual = evaluate(`
        const style = document.createElement('style');
        style.textContent = 'p { color: blue; margin: 1px } .c { color: green } #i { color: red } '
            + 'p.imp { color: purple !important }';
        document.head.appendChild(style);
        const plain = document.createElement('p');
        const classed = document.createElement('p');
        classed.className = 'c';
        const identified = document.createElement('p');
        identified.id = 'i';
        identified.className = 'c';
        const important = document.createElement('p');
        important.className = 'c imp';
        important.style.color = 'orange';
        for (const node of [plain, classed, identified, important]) document.body.appendChild(node);
        const inlineWins = getComputedStyle(important).color;
        important.style.setProperty('color', 'pink', 'important');
        return {
            specificity: [getComputedStyle(plain).color, getComputedStyle(classed).color,
                getComputedStyle(identified).color],
            importantBeatsInline: inlineWins,
            inlineImportantWins: getComputedStyle(important).color,
            otherProperty: getComputedStyle(plain).margin
        };
    `);
    assert.deepEqual(actual, {
        specificity: ['blue', 'green', 'red'],
        importantBeatsInline: 'purple',
        inlineImportantWins: 'pink',
        otherProperty: '1px'
    });
});
