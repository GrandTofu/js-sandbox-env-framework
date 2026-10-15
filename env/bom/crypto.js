/**
 * @env-module crypto
 * @description Web Crypto：Crypto / SubtleCrypto / CryptoKey 按 WebIDL 定义；随机数与摘要由宿主 node:crypto 计算
 * @compatibility Chrome 120+
 *
 * 宿主只交换十六进制字符串（__host__.crypto），ArrayBuffer 在本 realm 内构造。
 * 除 digest 外的 SubtleCrypto 方法仍是占位实现（返回形状正确的结果），不做真实加解密。
 * 依赖：WebIDL.js、domexception.js、GlobalScope.js（__host__.crypto）。
 */
(function () {
    'use strict';

    const idl = window.__webidl__;
    const hostCrypto = window.__host__.crypto;

    // ==================== 字节转换 ====================
    function hexToBytes(hex) {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
        return bytes;
    }

    function bytesOf(source, method) {
        if (source instanceof ArrayBuffer) return new Uint8Array(source);
        if (ArrayBuffer.isView(source)) return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
        throw new TypeError(`Failed to execute '${method}' on 'SubtleCrypto': 2nd argument is not instance of ArrayBuffer, Buffer, TypedArray, or DataView.`);
    }

    function bytesToHex(bytes) {
        let hex = '';
        for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
        return hex;
    }

    function algorithmName(algorithm) {
        if (typeof algorithm === 'string') return algorithm;
        if (algorithm && typeof algorithm === 'object' && algorithm.name !== undefined) return String(algorithm.name);
        throw new TypeError("Failed to execute on 'SubtleCrypto': Algorithm: name: Missing or not a string");
    }

    // ==================== Crypto ====================
    // Web Crypto 接受整数 TypedArray，包括 BigInt64Array / BigUint64Array。
    const integerArrays = [Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array,
        Int32Array, Uint32Array, BigInt64Array, BigUint64Array];

    function getRandomValues(array) {
        if (!integerArrays.some(Type => array instanceof Type)) {
            throw new DOMException("Failed to execute 'getRandomValues' on 'Crypto': The provided ArrayBufferView is of type '" +
                (array && array.constructor ? array.constructor.name : typeof array) + "', which is not an integer array type.",
            'TypeMismatchError');
        }
        if (array.byteLength > 65536) {
            throw new DOMException(`Failed to execute 'getRandomValues' on 'Crypto': The ArrayBufferView's byte length (${array.byteLength}) exceeds the number of bytes of entropy available via this API (65536).`,
                'QuotaExceededError');
        }
        const random = hexToBytes(hostCrypto.randomHex(array.byteLength));
        new Uint8Array(array.buffer, array.byteOffset, array.byteLength).set(random);
        return array;
    }

    function randomUUID() {
        const bytes = hexToBytes(hostCrypto.randomHex(16));
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = bytesToHex(bytes);
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }

    // ==================== CryptoKey ====================
    idl.defineInterface('CryptoKey', {
        attributes: {
            type() { return idl.internal(this).type; },
            extractable() { return idl.internal(this).extractable; },
            algorithm() { return idl.internal(this).algorithm; },
            usages() { return idl.internal(this).usages; }
        }
    });

    function createKey(type, extractable, algorithm, usages) {
        const normalized = Object.assign({}, typeof algorithm === 'string' ? { name: algorithm } : algorithm);
        return idl.create('CryptoKey', {
            type, extractable: !!extractable, algorithm: normalized,
            usages: Object.freeze(Array.from(usages || [], String))
        });
    }

    const asymmetric = new Set(['RSA-OAEP', 'RSA-PSS', 'RSASSA-PKCS1-v1_5', 'ECDSA', 'ECDH', 'Ed25519', 'X25519']);

    // ==================== SubtleCrypto ====================
    const digestAlgorithms = new Map([['SHA-1', 'sha1'], ['SHA-256', 'sha256'], ['SHA-384', 'sha384'], ['SHA-512', 'sha512']]);

    // 方法体里的同步异常按规范转为 rejected Promise
    function promised(fn) {
        try {
            return Promise.resolve(fn());
        } catch (error) {
            return Promise.reject(error);
        }
    }

    idl.defineInterface('SubtleCrypto', {
        methods: {
            digest(algorithm, data) {
                return promised(() => {
                    const name = algorithmName(algorithm).toUpperCase();
                    const hostName = digestAlgorithms.get(name);
                    if (!hostName) throw new DOMException('Algorithm: Unrecognized name', 'NotSupportedError');
                    const hex = hostCrypto.digest(hostName, bytesToHex(bytesOf(data, 'digest')));
                    return hexToBytes(hex).buffer;
                });
            },
            encrypt(algorithm, key, data) {
                return promised(() => new ArrayBuffer(bytesOf(data, 'encrypt').byteLength + 16));
            },
            decrypt(algorithm, key, data) {
                return promised(() => new ArrayBuffer(Math.max(0, bytesOf(data, 'decrypt').byteLength - 16)));
            },
            sign(algorithm, key, data) {
                return promised(() => new ArrayBuffer(64));
            },
            verify(algorithm, key, signature, data) {
                return promised(() => true);
            },
            generateKey(algorithm, extractable, keyUsages) {
                return promised(() => {
                    const name = algorithmName(algorithm);
                    if (asymmetric.has(name)) {
                        return {
                            publicKey: createKey('public', true, algorithm, keyUsages),
                            privateKey: createKey('private', extractable, algorithm, keyUsages)
                        };
                    }
                    return createKey('secret', extractable, algorithm, keyUsages);
                });
            },
            importKey(format, keyData, algorithm, extractable, keyUsages) {
                return promised(() => createKey(format === 'spki' ? 'public' : format === 'pkcs8' ? 'private' : 'secret',
                    extractable, algorithm, keyUsages));
            },
            exportKey(format, key) {
                return promised(() => (String(format) === 'jwk'
                    ? { kty: 'oct', k: '', alg: '', ext: true }
                    : new ArrayBuffer(32)));
            },
            deriveKey(algorithm, baseKey, derivedKeyType, extractable, keyUsages) {
                return promised(() => createKey('secret', extractable, derivedKeyType, keyUsages));
            },
            deriveBits(algorithm, baseKey, length) {
                return promised(() => new ArrayBuffer(Math.ceil(Number(length) / 8)));
            },
            wrapKey(format, key, wrappingKey, wrapAlgorithm) {
                return promised(() => new ArrayBuffer(48));
            },
            unwrapKey(format, wrappedKey, unwrappingKey, unwrapAlgorithm, unwrappedKeyAlgorithm, extractable, keyUsages) {
                return promised(() => createKey('secret', extractable, unwrappedKeyAlgorithm, keyUsages));
            }
        }
    });

    idl.defineInterface('Crypto', {
        attributes: {
            subtle() { return idl.internal(this).subtle; }
        },
        methods: { getRandomValues, randomUUID }
    });

    const crypto = idl.create('Crypto', { subtle: idl.create('SubtleCrypto') });

    // window.crypto 是只读访问器
    const holder = { get crypto() { return crypto; } };
    Object.defineProperty(window, 'crypto', {
        get: window.safefunction(Object.getOwnPropertyDescriptor(holder, 'crypto').get, 'get crypto'),
        enumerable: true, configurable: true
    });
})();
