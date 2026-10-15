/**
 * @env-module DOMException
 * @description WebIDL DOMException：name/message/code 为原型访问器，旧式错误码常量同时挂在构造函数与原型上，原型继承 Error.prototype
 * @compatibility Chrome 120+
 */
(function () {
    'use strict';

    const idl = window.__webidl__;

    // 旧式错误码常量（WebIDL §DOMException）
    const constants = {
        INDEX_SIZE_ERR: 1, DOMSTRING_SIZE_ERR: 2, HIERARCHY_REQUEST_ERR: 3, WRONG_DOCUMENT_ERR: 4,
        INVALID_CHARACTER_ERR: 5, NO_DATA_ALLOWED_ERR: 6, NO_MODIFICATION_ALLOWED_ERR: 7,
        NOT_FOUND_ERR: 8, NOT_SUPPORTED_ERR: 9, INUSE_ATTRIBUTE_ERR: 10, INVALID_STATE_ERR: 11,
        SYNTAX_ERR: 12, INVALID_MODIFICATION_ERR: 13, NAMESPACE_ERR: 14, INVALID_ACCESS_ERR: 15,
        VALIDATION_ERR: 16, TYPE_MISMATCH_ERR: 17, SECURITY_ERR: 18, NETWORK_ERR: 19, ABORT_ERR: 20,
        URL_MISMATCH_ERR: 21, QUOTA_EXCEEDED_ERR: 22, TIMEOUT_ERR: 23, INVALID_NODE_TYPE_ERR: 24,
        DATA_CLONE_ERR: 25
    };

    // 错误名 → 旧式错误码；不在表中的名字 code 为 0
    const legacyCodes = {
        IndexSizeError: 1, HierarchyRequestError: 3, WrongDocumentError: 4, InvalidCharacterError: 5,
        NoModificationAllowedError: 7, NotFoundError: 8, NotSupportedError: 9, InUseAttributeError: 10,
        InvalidStateError: 11, SyntaxError: 12, InvalidModificationError: 13, NamespaceError: 14,
        InvalidAccessError: 15, TypeMismatchError: 17, SecurityError: 18, NetworkError: 19,
        AbortError: 20, URLMismatchError: 21, QuotaExceededError: 22, TimeoutError: 23,
        InvalidNodeTypeError: 24, DataCloneError: 25
    };

    const DOMException = idl.defineInterface('DOMException', {
        parentPrototype: Error.prototype,
        construct(message = '', name = 'Error') {
            const state = idl.internal(this);
            state.message = String(message);
            state.name = String(name);
            // 与 Chrome 一样带 stack；省略构造函数及其内部调用帧
            Error.captureStackTrace(this, DOMException);
        },
        constants,
        attributes: {
            name() { return idl.internal(this).name; },
            message() { return idl.internal(this).message; },
            code() {
                const name = idl.internal(this).name;
                return Object.prototype.hasOwnProperty.call(legacyCodes, name) ? legacyCodes[name] : 0;
            }
        }
    });
})();
