/**
 * @env-module atob/btoa
 * @description Base64 编解码：按 HTML 规范的 forgiving-base64 解码，错误抛 InvalidCharacterError DOMException
 * @compatibility Chrome 120+
 */
(function () {
    'use strict';

    const markNative = window.safefunction;
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const lookup = new Map(Array.from(alphabet, (char, index) => [char, index]));

    function invalidCharacter(message) {
        return new DOMException(message, 'InvalidCharacterError');
    }

    function requireArgument(name, count) {
        if (count < 1) {
            throw new TypeError(`Failed to execute '${name}' on 'Window': 1 argument required, but only 0 present.`);
        }
    }

    function encode(data) {
        let output = '';
        for (let i = 0; i < data.length; i += 3) {
            const a = data.charCodeAt(i);
            const b = i + 1 < data.length ? data.charCodeAt(i + 1) : NaN;
            const c = i + 2 < data.length ? data.charCodeAt(i + 2) : NaN;
            output += alphabet[a >> 2];
            output += alphabet[((a & 3) << 4) | ((b || 0) >> 4)];
            output += Number.isNaN(b) ? '=' : alphabet[((b & 15) << 2) | ((c || 0) >> 6)];
            output += Number.isNaN(c) ? '=' : alphabet[c & 63];
        }
        return output;
    }

    // HTML 规范 forgiving-base64 decode
    function decode(data) {
        let input = data.replace(/[\t\n\f\r ]/g, '');
        if (input.length % 4 === 0) input = input.replace(/={1,2}$/, '');
        if (input.length % 4 === 1 || /[^A-Za-z0-9+/]/.test(input)) return null;

        let output = '';
        let buffer = 0;
        let bits = 0;
        for (const char of input) {
            buffer = (buffer << 6) | lookup.get(char);
            bits += 6;
            if (bits >= 8) {
                bits -= 8;
                output += String.fromCharCode((buffer >> bits) & 0xFF);
            }
        }
        return output;
    }

    const holder = {
        atob(...args) {
            requireArgument('atob', args.length);
            const decoded = decode(String(args[0]));
            if (decoded === null) {
                throw invalidCharacter("Failed to execute 'atob' on 'Window': The string to be decoded is not correctly encoded.");
            }
            return decoded;
        },
        btoa(...args) {
            requireArgument('btoa', args.length);
            const data = String(args[0]);
            if (/[^\u0000-\u00FF]/.test(data)) {
                throw invalidCharacter("Failed to execute 'btoa' on 'Window': The string to be encoded contains characters outside of the Latin1 range.");
            }
            return encode(data);
        }
    };

    for (const name of ['atob', 'btoa']) {
        const operation = holder[name];
        Object.defineProperty(operation, 'length', { value: 1 });
        window[name] = markNative(operation);
    }
})();
