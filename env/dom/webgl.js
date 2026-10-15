/**
 * @env-module webgl
 * @description WebGLRenderingContext / WebGL2RenderingContext：按 WebGL IDL 定义，常量同时挂在接口对象与原型上，
 * 方法带监控与 mock 钩子，范围类参数返回类型化数组，扩展对象按上下文缓存。WebGL2 与 WebGL1 是两个独立接口
 * （WebGL2 不继承 WebGL1，二者都 include WebGLRenderingContextBase）。
 * @compatibility Chrome 120+
 *
 * 依赖：WebIDL.js、EnvMonitor.js（window.__EnvMonitor__）。
 * 上下文只能由 HTMLCanvasElement.getContext 经 window.__webglInternals__.createContext 创建。
 */
(function () {
    'use strict';

    const idl = window.__webidl__;
    const Monitor = window.__EnvMonitor__ || {
        log() {}, logCall() {}, logCreate() {}, hasMock() { return false; },
        executeMock() { return { mocked: false }; }, pushChain() {}, popChain() {}
    };

    // ==================== 常量表 ====================
    const CONSTANTS = {
        DEPTH_BUFFER_BIT: 0x00000100, STENCIL_BUFFER_BIT: 0x00000400, COLOR_BUFFER_BIT: 0x00004000,
        POINTS: 0x0000, LINES: 0x0001, LINE_LOOP: 0x0002, LINE_STRIP: 0x0003,
        TRIANGLES: 0x0004, TRIANGLE_STRIP: 0x0005, TRIANGLE_FAN: 0x0006,
        ZERO: 0, ONE: 1, SRC_COLOR: 0x0300, ONE_MINUS_SRC_COLOR: 0x0301,
        SRC_ALPHA: 0x0302, ONE_MINUS_SRC_ALPHA: 0x0303, DST_ALPHA: 0x0304, ONE_MINUS_DST_ALPHA: 0x0305,
        DST_COLOR: 0x0306, ONE_MINUS_DST_COLOR: 0x0307, SRC_ALPHA_SATURATE: 0x0308,
        FUNC_ADD: 0x8006, BLEND_EQUATION: 0x8009, BLEND_EQUATION_RGB: 0x8009, BLEND_EQUATION_ALPHA: 0x883D,
        FUNC_SUBTRACT: 0x800A, FUNC_REVERSE_SUBTRACT: 0x800B,
        BLEND_DST_RGB: 0x80C8, BLEND_SRC_RGB: 0x80C9, BLEND_DST_ALPHA: 0x80CA, BLEND_SRC_ALPHA: 0x80CB,
        CONSTANT_COLOR: 0x8001, ONE_MINUS_CONSTANT_COLOR: 0x8002, CONSTANT_ALPHA: 0x8003,
        ONE_MINUS_CONSTANT_ALPHA: 0x8004, BLEND_COLOR: 0x8005,
        ARRAY_BUFFER: 0x8892, ELEMENT_ARRAY_BUFFER: 0x8893,
        ARRAY_BUFFER_BINDING: 0x8894, ELEMENT_ARRAY_BUFFER_BINDING: 0x8895,
        STREAM_DRAW: 0x88E0, STATIC_DRAW: 0x88E4, DYNAMIC_DRAW: 0x88E8,
        BUFFER_SIZE: 0x8764, BUFFER_USAGE: 0x8765, CURRENT_VERTEX_ATTRIB: 0x8626,
        FRONT: 0x0404, BACK: 0x0405, FRONT_AND_BACK: 0x0408,
        CULL_FACE: 0x0B44, BLEND: 0x0BE2, DITHER: 0x0BD0, STENCIL_TEST: 0x0B90, DEPTH_TEST: 0x0B71,
        SCISSOR_TEST: 0x0C11, POLYGON_OFFSET_FILL: 0x8037, SAMPLE_ALPHA_TO_COVERAGE: 0x809E, SAMPLE_COVERAGE: 0x80A0,
        NO_ERROR: 0, INVALID_ENUM: 0x0500, INVALID_VALUE: 0x0501, INVALID_OPERATION: 0x0502,
        OUT_OF_MEMORY: 0x0505, CONTEXT_LOST_WEBGL: 0x9242, INVALID_FRAMEBUFFER_OPERATION: 0x0506,
        CW: 0x0900, CCW: 0x0901, LINE_WIDTH: 0x0B21,
        ALIASED_POINT_SIZE_RANGE: 0x846D, ALIASED_LINE_WIDTH_RANGE: 0x846E,
        CULL_FACE_MODE: 0x0B45, FRONT_FACE: 0x0B46,
        DEPTH_RANGE: 0x0B70, DEPTH_WRITEMASK: 0x0B72, DEPTH_CLEAR_VALUE: 0x0B73, DEPTH_FUNC: 0x0B74,
        STENCIL_CLEAR_VALUE: 0x0B91, STENCIL_FUNC: 0x0B92, STENCIL_FAIL: 0x0B94,
        STENCIL_PASS_DEPTH_FAIL: 0x0B95, STENCIL_PASS_DEPTH_PASS: 0x0B96, STENCIL_REF: 0x0B97,
        STENCIL_VALUE_MASK: 0x0B93, STENCIL_WRITEMASK: 0x0B98, STENCIL_BACK_FUNC: 0x8800,
        STENCIL_BACK_FAIL: 0x8801, STENCIL_BACK_PASS_DEPTH_FAIL: 0x8802, STENCIL_BACK_PASS_DEPTH_PASS: 0x8803,
        STENCIL_BACK_REF: 0x8CA3, STENCIL_BACK_VALUE_MASK: 0x8CA4, STENCIL_BACK_WRITEMASK: 0x8CA5,
        VIEWPORT: 0x0BA2, SCISSOR_BOX: 0x0C10, COLOR_CLEAR_VALUE: 0x0C22, COLOR_WRITEMASK: 0x0C23,
        UNPACK_ALIGNMENT: 0x0CF5, PACK_ALIGNMENT: 0x0D05,
        MAX_TEXTURE_SIZE: 0x0D33, MAX_VIEWPORT_DIMS: 0x0D3A,
        SUBPIXEL_BITS: 0x0D50, RED_BITS: 0x0D52, GREEN_BITS: 0x0D53, BLUE_BITS: 0x0D54,
        ALPHA_BITS: 0x0D55, DEPTH_BITS: 0x0D56, STENCIL_BITS: 0x0D57,
        POLYGON_OFFSET_UNITS: 0x2A00, POLYGON_OFFSET_FACTOR: 0x8038,
        TEXTURE_BINDING_2D: 0x8069, SAMPLE_BUFFERS: 0x80A8, SAMPLES: 0x80A9,
        SAMPLE_COVERAGE_VALUE: 0x80AA, SAMPLE_COVERAGE_INVERT: 0x80AB, COMPRESSED_TEXTURE_FORMATS: 0x86A3,
        DONT_CARE: 0x1100, FASTEST: 0x1101, NICEST: 0x1102, GENERATE_MIPMAP_HINT: 0x8192,
        BYTE: 0x1400, UNSIGNED_BYTE: 0x1401, SHORT: 0x1402, UNSIGNED_SHORT: 0x1403,
        INT: 0x1404, UNSIGNED_INT: 0x1405, FLOAT: 0x1406, HALF_FLOAT: 0x140B,
        DEPTH_COMPONENT: 0x1902, ALPHA: 0x1906, RGB: 0x1907, RGBA: 0x1908,
        LUMINANCE: 0x1909, LUMINANCE_ALPHA: 0x190A,
        UNSIGNED_SHORT_4_4_4_4: 0x8033, UNSIGNED_SHORT_5_5_5_1: 0x8034, UNSIGNED_SHORT_5_6_5: 0x8363,
        FRAGMENT_SHADER: 0x8B30, VERTEX_SHADER: 0x8B31,
        MAX_VERTEX_ATTRIBS: 0x8869, MAX_VERTEX_UNIFORM_VECTORS: 0x8DFB, MAX_VARYING_VECTORS: 0x8DFC,
        MAX_COMBINED_TEXTURE_IMAGE_UNITS: 0x8B4D, MAX_VERTEX_TEXTURE_IMAGE_UNITS: 0x8B4C,
        MAX_TEXTURE_IMAGE_UNITS: 0x8872, MAX_FRAGMENT_UNIFORM_VECTORS: 0x8DFD,
        SHADER_TYPE: 0x8B4F, DELETE_STATUS: 0x8B80, LINK_STATUS: 0x8B82, VALIDATE_STATUS: 0x8B83,
        ATTACHED_SHADERS: 0x8B85, ACTIVE_UNIFORMS: 0x8B86, ACTIVE_ATTRIBUTES: 0x8B89,
        SHADING_LANGUAGE_VERSION: 0x8B8C, CURRENT_PROGRAM: 0x8B8D, COMPILE_STATUS: 0x8B81,
        VENDOR: 0x1F00, RENDERER: 0x1F01, VERSION: 0x1F02,
        FLOAT_VEC2: 0x8B50, FLOAT_VEC3: 0x8B51, FLOAT_VEC4: 0x8B52,
        INT_VEC2: 0x8B53, INT_VEC3: 0x8B54, INT_VEC4: 0x8B55,
        BOOL: 0x8B56, BOOL_VEC2: 0x8B57, BOOL_VEC3: 0x8B58, BOOL_VEC4: 0x8B59,
        FLOAT_MAT2: 0x8B5A, FLOAT_MAT3: 0x8B5B, FLOAT_MAT4: 0x8B5C,
        SAMPLER_2D: 0x8B5E, SAMPLER_CUBE: 0x8B60,
        NEAREST: 0x2600, LINEAR: 0x2601, NEAREST_MIPMAP_NEAREST: 0x2700, LINEAR_MIPMAP_NEAREST: 0x2701,
        NEAREST_MIPMAP_LINEAR: 0x2702, LINEAR_MIPMAP_LINEAR: 0x2703,
        TEXTURE_MAG_FILTER: 0x2800, TEXTURE_MIN_FILTER: 0x2801, TEXTURE_WRAP_S: 0x2802, TEXTURE_WRAP_T: 0x2803,
        TEXTURE_2D: 0x0DE1, TEXTURE: 0x1702,
        TEXTURE_CUBE_MAP: 0x8513, TEXTURE_BINDING_CUBE_MAP: 0x8514,
        TEXTURE_CUBE_MAP_POSITIVE_X: 0x8515, TEXTURE_CUBE_MAP_NEGATIVE_X: 0x8516,
        TEXTURE_CUBE_MAP_POSITIVE_Y: 0x8517, TEXTURE_CUBE_MAP_NEGATIVE_Y: 0x8518,
        TEXTURE_CUBE_MAP_POSITIVE_Z: 0x8519, TEXTURE_CUBE_MAP_NEGATIVE_Z: 0x851A,
        MAX_CUBE_MAP_TEXTURE_SIZE: 0x851C,
        REPEAT: 0x2901, CLAMP_TO_EDGE: 0x812F, MIRRORED_REPEAT: 0x8370,
        ACTIVE_TEXTURE: 0x84E0, MAX_RENDERBUFFER_SIZE: 0x84E8,
        DEPTH_STENCIL: 0x84F9, UNSIGNED_INT_24_8: 0x84FA, DEPTH_STENCIL_ATTACHMENT: 0x821A,
        FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE: 0x8CD0, FRAMEBUFFER_ATTACHMENT_OBJECT_NAME: 0x8CD1,
        FRAMEBUFFER_ATTACHMENT_TEXTURE_LEVEL: 0x8CD2, FRAMEBUFFER_ATTACHMENT_TEXTURE_CUBE_MAP_FACE: 0x8CD3,
        FRAMEBUFFER_ATTACHMENT_TEXTURE_LAYER: 0x8CD4,
        FRAMEBUFFER_COMPLETE: 0x8CD5, FRAMEBUFFER_INCOMPLETE_ATTACHMENT: 0x8CD6,
        FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT: 0x8CD7, FRAMEBUFFER_INCOMPLETE_DIMENSIONS: 0x8CD9,
        FRAMEBUFFER_UNSUPPORTED: 0x8CDD,
        FRAMEBUFFER: 0x8D40, RENDERBUFFER: 0x8D41,
        RENDERBUFFER_WIDTH: 0x8D42, RENDERBUFFER_HEIGHT: 0x8D43, RENDERBUFFER_INTERNAL_FORMAT: 0x8D44,
        RENDERBUFFER_RED_SIZE: 0x8D50, RENDERBUFFER_GREEN_SIZE: 0x8D51, RENDERBUFFER_BLUE_SIZE: 0x8D52,
        RENDERBUFFER_ALPHA_SIZE: 0x8D53, RENDERBUFFER_DEPTH_SIZE: 0x8D54, RENDERBUFFER_STENCIL_SIZE: 0x8D55,
        FRAMEBUFFER_BINDING: 0x8CA6, RENDERBUFFER_BINDING: 0x8CA7,
        COLOR_ATTACHMENT0: 0x8CE0, DEPTH_ATTACHMENT: 0x8D00, STENCIL_ATTACHMENT: 0x8D20,
        NONE: 0,
        UNPACK_FLIP_Y_WEBGL: 0x9240, UNPACK_PREMULTIPLY_ALPHA_WEBGL: 0x9241,
        UNPACK_COLORSPACE_CONVERSION_WEBGL: 0x9243, BROWSER_DEFAULT_WEBGL: 0x9244,
        MAX_CLIENT_WAIT_TIMEOUT_WEBGL: 0x9247,
        DEPTH24_STENCIL8: 0x88F0, STENCIL_INDEX8: 0x8D48,
        DEPTH_COMPONENT16: 0x81A5, DEPTH_COMPONENT24: 0x81A6,
        RGB565: 0x8D62, RGBA4: 0x8056, RGB5_A1: 0x8057,
        IMPLEMENTATION_COLOR_READ_TYPE: 0x8B9A, IMPLEMENTATION_COLOR_READ_FORMAT: 0x8B9B,
        LOW_FLOAT: 0x8DF0, MEDIUM_FLOAT: 0x8DF1, HIGH_FLOAT: 0x8DF2,
        LOW_INT: 0x8DF3, MEDIUM_INT: 0x8DF4, HIGH_INT: 0x8DF5
    };

    const WEBGL2_CONSTANTS = {
        READ_BUFFER: 0x0C02, UNPACK_ROW_LENGTH: 0x0CF2, UNPACK_SKIP_ROWS: 0x0CF3, UNPACK_SKIP_PIXELS: 0x0CF4,
        PACK_ROW_LENGTH: 0x0D02, PACK_SKIP_ROWS: 0x0D03, PACK_SKIP_PIXELS: 0x0D04,
        TEXTURE_BINDING_3D: 0x806A, UNPACK_SKIP_IMAGES: 0x806D, UNPACK_IMAGE_HEIGHT: 0x806E,
        MAX_3D_TEXTURE_SIZE: 0x8073, MAX_ELEMENTS_VERTICES: 0x80E8, MAX_ELEMENTS_INDICES: 0x80E9,
        MAX_TEXTURE_LOD_BIAS: 0x84FD, MAX_FRAGMENT_UNIFORM_COMPONENTS: 0x8B49, MAX_VERTEX_UNIFORM_COMPONENTS: 0x8B4A,
        MAX_ARRAY_TEXTURE_LAYERS: 0x88FF, MIN_PROGRAM_TEXEL_OFFSET: 0x8904, MAX_PROGRAM_TEXEL_OFFSET: 0x8905,
        MAX_VARYING_COMPONENTS: 0x8B4B, FRAGMENT_SHADER_DERIVATIVE_HINT: 0x8B8B, RASTERIZER_DISCARD: 0x8C89,
        VERTEX_ARRAY_BINDING: 0x85B5, MAX_VERTEX_OUTPUT_COMPONENTS: 0x9122, MAX_FRAGMENT_INPUT_COMPONENTS: 0x9125,
        MAX_SERVER_WAIT_TIMEOUT: 0x9111, MAX_ELEMENT_INDEX: 0x8D6B,
        RED: 0x1903, RGB8: 0x8051, RGBA8: 0x8058, RGB10_A2: 0x8059, RGB10_A2UI: 0x906F,
        TEXTURE_3D: 0x806F, TEXTURE_WRAP_R: 0x8072,
        TEXTURE_MIN_LOD: 0x813A, TEXTURE_MAX_LOD: 0x813B, TEXTURE_BASE_LEVEL: 0x813C, TEXTURE_MAX_LEVEL: 0x813D,
        TEXTURE_COMPARE_MODE: 0x884C, TEXTURE_COMPARE_FUNC: 0x884D, COMPARE_REF_TO_TEXTURE: 0x884E,
        SRGB: 0x8C40, SRGB8: 0x8C41, SRGB8_ALPHA8: 0x8C43,
        RGBA32F: 0x8814, RGB32F: 0x8815, RGBA16F: 0x881A, RGB16F: 0x881B,
        RGBA32I: 0x8D82, RGBA16I: 0x8D88, RGBA8I: 0x8D8E, RGB32I: 0x8D83, RGB16I: 0x8D89, RGB8I: 0x8D8F,
        RGBA32UI: 0x8D70, RGBA16UI: 0x8D76, RGBA8UI: 0x8D7C, RGB32UI: 0x8D71, RGB16UI: 0x8D77, RGB8UI: 0x8D7D,
        R8: 0x8229, R8_SNORM: 0x8F94, R16F: 0x822D, R32F: 0x822E,
        R8I: 0x8231, R8UI: 0x8232, R16I: 0x8233, R16UI: 0x8234, R32I: 0x8235, R32UI: 0x8236,
        RG: 0x8227, RG_INTEGER: 0x8228, RG8: 0x822B, RG8_SNORM: 0x8F95,
        RG8I: 0x8237, RG8UI: 0x8238, RG16I: 0x8239, RG16UI: 0x823A, RG32I: 0x823B, RG32UI: 0x823C,
        RG16F: 0x822F, RG32F: 0x8230, RGB8_SNORM: 0x8F96, RGBA8_SNORM: 0x8F97,
        R11F_G11F_B10F: 0x8C3A, RGB9_E5: 0x8C3D,
        UNSIGNED_INT_10F_11F_11F_REV: 0x8C3B, UNSIGNED_INT_5_9_9_9_REV: 0x8C3E,
        UNSIGNED_INT_2_10_10_10_REV: 0x8368, UNSIGNED_INT_10_10_10_2: 0x8DF6, INT_2_10_10_10_REV: 0x8D9F,
        DEPTH_COMPONENT32F: 0x8CAC, DEPTH32F_STENCIL8: 0x8CAD, FLOAT_32_UNSIGNED_INT_24_8_REV: 0x8DAD,
        TEXTURE_IMMUTABLE_FORMAT: 0x912F, TEXTURE_IMMUTABLE_LEVELS: 0x82DF,
        VERTEX_ATTRIB_ARRAY_DIVISOR: 0x88FE,
        MAX_DRAW_BUFFERS: 0x8824, MAX_COLOR_ATTACHMENTS: 0x8CDF,
        DRAW_FRAMEBUFFER: 0x8CA9, READ_FRAMEBUFFER: 0x8CA8,
        RENDERBUFFER_SAMPLES: 0x8CAB, FRAMEBUFFER_INCOMPLETE_MULTISAMPLE: 0x8D56, MAX_SAMPLES: 0x8D57,
        TEXTURE_2D_MULTISAMPLE: 0x9100, TEXTURE_2D_MULTISAMPLE_ARRAY: 0x9102,
        TEXTURE_BINDING_2D_MULTISAMPLE: 0x9104, TEXTURE_BINDING_2D_MULTISAMPLE_ARRAY: 0x9105,
        MAX_COLOR_TEXTURE_SAMPLES: 0x910E, MAX_DEPTH_TEXTURE_SAMPLES: 0x910F, MAX_INTEGER_SAMPLES: 0x9110,
        MAX_VERTEX_ATTRIB_STRIDE: 0x82E5,
        COPY_READ_BUFFER: 0x8F36, COPY_WRITE_BUFFER: 0x8F37,
        PIXEL_PACK_BUFFER: 0x88EB, PIXEL_UNPACK_BUFFER: 0x88EC,
        PIXEL_PACK_BUFFER_BINDING: 0x88ED, PIXEL_UNPACK_BUFFER_BINDING: 0x88EF,
        UNIFORM_BUFFER: 0x8A11, UNIFORM_BUFFER_BINDING: 0x8A28, UNIFORM_BUFFER_START: 0x8A29,
        UNIFORM_BUFFER_SIZE: 0x8A2A, MAX_VERTEX_UNIFORM_BLOCKS: 0x8A2B, MAX_FRAGMENT_UNIFORM_BLOCKS: 0x8A2D,
        MAX_COMBINED_UNIFORM_BLOCKS: 0x8A2E, MAX_UNIFORM_BUFFER_BINDINGS: 0x8A2F, MAX_UNIFORM_BLOCK_SIZE: 0x8A30,
        MAX_COMBINED_VERTEX_UNIFORM_COMPONENTS: 0x8A31, MAX_COMBINED_FRAGMENT_UNIFORM_COMPONENTS: 0x8A33,
        UNIFORM_BUFFER_OFFSET_ALIGNMENT: 0x8A34,
        UNIFORM_TYPE: 0x8A37, UNIFORM_SIZE: 0x8A38, UNIFORM_BLOCK_INDEX: 0x8A3A, UNIFORM_OFFSET: 0x8A3B,
        UNIFORM_ARRAY_STRIDE: 0x8A3C, UNIFORM_MATRIX_STRIDE: 0x8A3D, UNIFORM_IS_ROW_MAJOR: 0x8A3E,
        UNIFORM_BLOCK_BINDING: 0x8A3F, UNIFORM_BLOCK_DATA_SIZE: 0x8A40, UNIFORM_BLOCK_ACTIVE_UNIFORMS: 0x8A42,
        UNIFORM_BLOCK_ACTIVE_UNIFORM_INDICES: 0x8A43,
        UNIFORM_BLOCK_REFERENCED_BY_VERTEX_SHADER: 0x8A44, UNIFORM_BLOCK_REFERENCED_BY_FRAGMENT_SHADER: 0x8A46,
        INVALID_INDEX: 0xFFFFFFFF,
        TRANSFORM_FEEDBACK: 0x8E22, TRANSFORM_FEEDBACK_BUFFER: 0x8C8E, TRANSFORM_FEEDBACK_BUFFER_BINDING: 0x8C8F,
        TRANSFORM_FEEDBACK_BUFFER_MODE: 0x8C7F, TRANSFORM_FEEDBACK_BUFFER_SIZE: 0x8C85,
        TRANSFORM_FEEDBACK_BUFFER_START: 0x8C84, TRANSFORM_FEEDBACK_PAUSED: 0x8E23,
        TRANSFORM_FEEDBACK_ACTIVE: 0x8E24, TRANSFORM_FEEDBACK_BINDING: 0x8E25,
        INTERLEAVED_ATTRIBS: 0x8C8C, SEPARATE_ATTRIBS: 0x8C8D,
        TRANSFORM_FEEDBACK_VARYING_MAX_LENGTH: 0x8C76, TRANSFORM_FEEDBACK_VARYINGS: 0x8C83,
        MAX_TRANSFORM_FEEDBACK_SEPARATE_ATTRIBS: 0x8C8B, MAX_TRANSFORM_FEEDBACK_SEPARATE_COMPONENTS: 0x8C80,
        MAX_TRANSFORM_FEEDBACK_INTERLEAVED_COMPONENTS: 0x8C8A, MAX_TRANSFORM_FEEDBACK_BUFFERS: 0x8E70,
        ANY_SAMPLES_PASSED: 0x8C2F, ANY_SAMPLES_PASSED_CONSERVATIVE: 0x8D6A,
        CURRENT_QUERY: 0x8865, QUERY_RESULT: 0x8866, QUERY_RESULT_AVAILABLE: 0x8867,
        SAMPLER_BINDING: 0x8919,
        SAMPLER_2D: 0x8B5E, SAMPLER_3D: 0x8B5F, SAMPLER_CUBE: 0x8B60, SAMPLER_2D_SHADOW: 0x8B62,
        SAMPLER_2D_ARRAY: 0x8DC1, SAMPLER_2D_ARRAY_SHADOW: 0x8DC4, SAMPLER_CUBE_SHADOW: 0x8DC5,
        UNSIGNED_INT_VEC2: 0x8DC6, UNSIGNED_INT_VEC3: 0x8DC7, UNSIGNED_INT_VEC4: 0x8DC8,
        INT_SAMPLER_2D: 0x8DCA, INT_SAMPLER_3D: 0x8DCB, INT_SAMPLER_CUBE: 0x8DCC, INT_SAMPLER_2D_ARRAY: 0x8DCF,
        UNSIGNED_INT_SAMPLER_2D: 0x8DD2, UNSIGNED_INT_SAMPLER_3D: 0x8DD3,
        UNSIGNED_INT_SAMPLER_CUBE: 0x8DD4, UNSIGNED_INT_SAMPLER_2D_ARRAY: 0x8DD7,
        TEXTURE_CUBE_MAP_ARRAY: 0x9009, TEXTURE_BINDING_CUBE_MAP_ARRAY: 0x900A,
        FRAMEBUFFER_SRGB: 0x8DB9,
        SYNC_FLUSH_COMMANDS_BIT: 0x00000001,
        OBJECT_TYPE: 0x9112, SYNC_CONDITION: 0x9113, SYNC_STATUS: 0x9114, SYNC_FLAGS: 0x9115,
        SYNC_FENCE: 0x9116, SYNC_GPU_COMMANDS_COMPLETE: 0x9117,
        UNSIGNALED: 0x9118, SIGNALED: 0x9119, ALREADY_SIGNALED: 0x911A,
        TIMEOUT_EXPIRED: 0x911B, CONDITION_SATISFIED: 0x911C, WAIT_FAILED: 0x911D
    };

    for (let i = 0; i <= 31; i++) CONSTANTS['TEXTURE' + i] = 0x84C0 + i;
    for (let i = 0; i <= 15; i++) CONSTANTS['COLOR_ATTACHMENT' + i] = 0x8CE0 + i;
    for (let i = 0; i <= 15; i++) WEBGL2_CONSTANTS['DRAW_BUFFER' + i] = 0x8825 + i;

    const ALL_CONSTANTS = Object.assign({}, CONSTANTS, WEBGL2_CONSTANTS);
    const KNOWN_PARAMETER_VALUES = new Set(Object.values(ALL_CONSTANTS)
        .filter(value => typeof value === 'number' && value !== 0));

    // 该上下文类型下合法的 pname（含扩展常量）：profile 里混入的非法 pname 不应被回显
    const WEBGL1_PARAMETER_VALUES = new Set(Object.values(CONSTANTS)
        .filter(value => typeof value === 'number' && value !== 0));
    const WEBGL2_PARAMETER_VALUES = new Set(Object.values(ALL_CONSTANTS)
        .filter(value => typeof value === 'number' && value !== 0));

    const PARAMETER_ARRAYS = {
        3386: Int32Array, 2978: Int32Array, 3088: Int32Array, 34467: Uint32Array, 3107: Array,
        33901: Float32Array, 33902: Float32Array, 3106: Float32Array, 2928: Float32Array, 32773: Float32Array
    };
    const BOOLEAN_ARRAYS = new Set([3107]); // COLOR_WRITEMASK

    const STRING_PARAMETERS = {
        7936: 'vendor', 7937: 'renderer', 7938: 'version', 35724: 'shadingLanguageVersion',
        37445: 'unmaskedVendor', 37446: 'unmaskedRenderer'
    };

    const VERSION_DEFAULTS = {
        webgl: { 7938: 'WebGL 1.0 (OpenGL ES 2.0 Chromium)', 35724: 'WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)' },
        webgl2: { 7938: 'WebGL 2.0 (OpenGL ES 3.0 Chromium)', 35724: 'WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)' }
    };

    // profile 未提供这些参数时的兜底值
    const DEFAULT_PARAMETERS = {
        webgl: {
            7936: 'WebKit', 7937: 'WebKit WebGL',
            7938: VERSION_DEFAULTS.webgl[7938], 35724: VERSION_DEFAULTS.webgl[35724],
            3379: 16384, 34076: 16384, 34024: 16384, 3386: [32767, 32767],
            34921: 16, 34930: 16, 35660: 16, 35661: 32,
            36347: 4096, 36349: 1024, 36348: 30,
            33901: [1, 1024], 33902: [1, 1],
            3410: 8, 3411: 8, 3412: 8, 3413: 8, 3414: 24, 3415: 0,
            34467: []
        },
        webgl2: {
            7938: VERSION_DEFAULTS.webgl2[7938], 35724: VERSION_DEFAULTS.webgl2[35724],
            32883: 2048, 35071: 2048, 36063: 8, 34852: 8,
            35371: 12, 35373: 12, 35374: 24, 35375: 72, 35376: 65536, 35380: 256,
            37154: 128, 37157: 128, 36203: 4294967295, 34045: 15
        }
    };

    // ==================== WebGLContextEvent ====================
    if (window.Event) {
        idl.defineInterface('WebGLContextEvent', {
            parent: 'Event',
            length: 1,
            construct(type, eventInitDict = {}) {
                window.__eventInternals__.setup(this, type, eventInitDict);
                const status = eventInitDict === undefined || eventInitDict === null ? undefined : eventInitDict.statusMessage;
                idl.internal(this).statusMessage = status === undefined ? '' : String(status);
            },
            attributes: {
                statusMessage() { return idl.internal(this).statusMessage; }
            }
        });
    }

    // 上下文丢失/恢复与浏览器一致：在任务中派发事件，preventDefault 可阻止上下文丢失
    function dispatchContextEvent(context, type) {
        const canvas = idl.internal(context).canvas;
        if (!canvas || typeof canvas.dispatchEvent !== 'function') return;
        const EventCtor = window.WebGLContextEvent;
        const init = { statusMessage: '', cancelable: type === 'webglcontextlost' };
        const event = EventCtor ? new EventCtor(type, init) : new window.Event(type, init);
        window.setTimeout(() => canvas.dispatchEvent(event), 0);
    }

    // ==================== 扩展 ====================
    const EXTENSION_INTERFACES = {
        ANGLE_instanced_arrays: { name: 'ANGLEInstancedArrays' },
        EXT_blend_minmax: { name: 'EXTBlendMinMax', constants: { MIN_EXT: 0x8007, MAX_EXT: 0x8008 } },
        EXT_color_buffer_half_float: { name: 'EXTColorBufferHalfFloat' },
        EXT_disjoint_timer_query: {
            name: 'EXTDisjointTimerQuery',
            constants: {
                QUERY_COUNTER_BITS_EXT: 0x8864, CURRENT_QUERY_EXT: 0x8865, QUERY_RESULT_EXT: 0x8866,
                QUERY_RESULT_AVAILABLE_EXT: 0x8867, TIME_ELAPSED_EXT: 0x88BF, TIMESTAMP_EXT: 0x8E28,
                GPU_DISJOINT_EXT: 0x8FBB
            }
        },
        EXT_float_blend: { name: 'EXTFloatBlend' },
        EXT_frag_depth: { name: 'EXTFragDepth' },
        EXT_shader_texture_lod: { name: 'EXTShaderTextureLOD' },
        EXT_sRGB: { name: 'EXTSRGB', constants: { SRGB_EXT: 0x8C40, SRGB_ALPHA_EXT: 0x8C42, SRGB8_ALPHA8_EXT: 0x8C43, FRAMEBUFFER_SRGB_EXT: 0x8DB9 } },
        EXT_texture_compression_bptc: { name: 'EXTTextureCompressionBPTC' },
        EXT_texture_compression_rgtc: { name: 'EXTTextureCompressionRGTC' },
        EXT_texture_filter_anisotropic: {
            name: 'EXTTextureFilterAnisotropic',
            constants: { TEXTURE_MAX_ANISOTROPY_EXT: 0x84FE, MAX_TEXTURE_MAX_ANISOTROPY_EXT: 0x84FF }
        },
        KHR_parallel_shader_compile: { name: 'KHRParallelShaderCompile', constants: { COMPLETION_STATUS_KHR: 0x91B1 } },
        OES_element_index_uint: { name: 'OESElementIndexUint' },
        OES_fbo_render_mipmap: { name: 'OESFboRenderMipmap' },
        OES_standard_derivatives: { name: 'OESStandardDerivatives', constants: { FRAGMENT_SHADER_DERIVATIVE_HINT_OES: 0x8B8B } },
        OES_texture_float: { name: 'OESTextureFloat' },
        OES_texture_float_linear: { name: 'OESTextureFloatLinear' },
        OES_texture_half_float: { name: 'OESTextureHalfFloat', constants: { HALF_FLOAT_OES: 0x8D61 } },
        OES_texture_half_float_linear: { name: 'OESTextureHalfFloatLinear' },
        OES_vertex_array_object: { name: 'OESVertexArrayObject', constants: { VERTEX_ARRAY_BINDING_OES: 0x85B5 } },
        WEBGL_color_buffer_float: {
            name: 'WebGLColorBufferFloat',
            constants: { RGBA32F_EXT: 0x8814, FRAMEBUFFER_ATTACHMENT_COMPONENT_TYPE_EXT: 0x8211, UNSIGNED_NORMALIZED_EXT: 0x8C17 }
        },
        WEBGL_compressed_texture_s3tc: {
            name: 'WEBGLCompressedTextureS3TC',
            constants: {
                COMPRESSED_RGB_S3TC_DXT1_EXT: 0x83F0, COMPRESSED_RGBA_S3TC_DXT1_EXT: 0x83F1,
                COMPRESSED_RGBA_S3TC_DXT3_EXT: 0x83F2, COMPRESSED_RGBA_S3TC_DXT5_EXT: 0x83F3
            }
        },
        WEBGL_compressed_texture_s3tc_srgb: { name: 'WEBGLCompressedTextureS3TCSRGB' },
        WEBGL_debug_renderer_info: {
            name: 'WEBGLDebugRendererInfo',
            constants: { UNMASKED_VENDOR_WEBGL: 0x9245, UNMASKED_RENDERER_WEBGL: 0x9246 }
        },
        WEBGL_debug_shaders: { name: 'WEBGLDebugShaders' },
        WEBGL_depth_texture: { name: 'WEBGLDepthTexture', constants: { UNSIGNED_INT_24_8_WEBGL: 0x84FA } },
        WEBGL_draw_buffers: {
            name: 'WEBGLDrawBuffers',
            constants: { COLOR_ATTACHMENT0_WEBGL: 0x8CE0, DRAW_BUFFER0_WEBGL: 0x8825, MAX_DRAW_BUFFERS_WEBGL: 0x8824 }
        },
        WEBGL_lose_context: { name: 'WebGLLoseContext' },
        WEBGL_multi_draw: { name: 'WEBGLMultiDraw' },
        EXT_clip_control: { name: 'EXTClipControl' },
        EXT_color_buffer_float: { name: 'EXTColorBufferFloat' },
        EXT_texture_norm16: { name: 'EXTTextureNorm16' },
        OES_draw_buffers_indexed: { name: 'OESDrawBuffersIndexed' },
        WEBGL_blend_equation_advanced_coherent: { name: 'WEBGLBlendEquationAdvancedCoherent' },
        WEBGL_provoking_vertex: { name: 'WEBGLProvokingVertex' },
        WEBGL_stencil_texturing: { name: 'WEBGLStencilTexturing' }
    };

    const DEFAULT_EXTENSIONS = {
        webgl: [
            'ANGLE_instanced_arrays', 'EXT_blend_minmax', 'EXT_color_buffer_half_float', 'EXT_disjoint_timer_query',
            'EXT_float_blend', 'EXT_frag_depth', 'EXT_shader_texture_lod', 'EXT_texture_compression_bptc',
            'EXT_texture_compression_rgtc', 'EXT_texture_filter_anisotropic', 'EXT_sRGB', 'KHR_parallel_shader_compile',
            'OES_element_index_uint', 'OES_fbo_render_mipmap', 'OES_standard_derivatives', 'OES_texture_float',
            'OES_texture_float_linear', 'OES_texture_half_float', 'OES_texture_half_float_linear',
            'OES_vertex_array_object', 'WEBGL_color_buffer_float', 'WEBGL_compressed_texture_s3tc',
            'WEBGL_compressed_texture_s3tc_srgb', 'WEBGL_debug_renderer_info', 'WEBGL_debug_shaders',
            'WEBGL_depth_texture', 'WEBGL_draw_buffers', 'WEBGL_lose_context', 'WEBGL_multi_draw'
        ],
        webgl2: [
            'EXT_color_buffer_float', 'EXT_color_buffer_half_float', 'EXT_disjoint_timer_query_webgl2',
            'EXT_float_blend', 'EXT_texture_compression_bptc', 'EXT_texture_compression_rgtc',
            'EXT_texture_filter_anisotropic', 'EXT_texture_norm16', 'KHR_parallel_shader_compile',
            'OES_draw_buffers_indexed', 'OES_texture_float_linear', 'WEBGL_blend_equation_advanced_coherent',
            'WEBGL_compressed_texture_s3tc', 'WEBGL_compressed_texture_s3tc_srgb', 'WEBGL_debug_renderer_info',
            'WEBGL_debug_shaders', 'WEBGL_depth_texture', 'WEBGL_draw_buffers', 'WEBGL_lose_context',
            'WEBGL_multi_draw', 'WEBGL_provoking_vertex', 'WEBGL_stencil_texturing'
        ]
    };

    for (const definition of Object.values(EXTENSION_INTERFACES)) {
        for (const value of Object.values(definition.constants || {})) {
            WEBGL1_PARAMETER_VALUES.add(value);
            WEBGL2_PARAMETER_VALUES.add(value);
        }
    }

    // ==================== 对象类型 ====================
    idl.defineInterface('WebGLObject', { expose: false });
    idl.defineInterface('WebGLBuffer', { parent: 'WebGLObject' });
    idl.defineInterface('WebGLFramebuffer', { parent: 'WebGLObject' });
    idl.defineInterface('WebGLProgram', { parent: 'WebGLObject' });
    idl.defineInterface('WebGLRenderbuffer', { parent: 'WebGLObject' });
    idl.defineInterface('WebGLShader', { parent: 'WebGLObject' });
    idl.defineInterface('WebGLTexture', { parent: 'WebGLObject' });
    idl.defineInterface('WebGLQuery', { parent: 'WebGLObject' });
    idl.defineInterface('WebGLSampler', { parent: 'WebGLObject' });
    idl.defineInterface('WebGLSync', { parent: 'WebGLObject' });
    idl.defineInterface('WebGLTransformFeedback', { parent: 'WebGLObject' });
    idl.defineInterface('WebGLVertexArrayObject', { parent: 'WebGLObject' });
    idl.defineInterface('WebGLVertexArrayObjectOES', { parent: 'WebGLObject', expose: false });
    idl.defineInterface('WebGLTimerQueryEXT', { parent: 'WebGLObject', expose: false });
    idl.defineInterface('WebGLUniformLocation', {
        attributes: {
            program() { return idl.internal(this).program; },
            location() { return idl.internal(this).location; }
        }
    });
    idl.defineInterface('WebGLActiveInfo', {
        attributes: {
            size() { return idl.internal(this).size; },
            type() { return idl.internal(this).type; },
            name() { return idl.internal(this).name; }
        }
    });
    idl.defineInterface('WebGLShaderPrecisionFormat', {
        attributes: {
            rangeMin() { return idl.internal(this).rangeMin; },
            rangeMax() { return idl.internal(this).rangeMax; },
            precision() { return idl.internal(this).precision; }
        }
    });

    // ==================== 扩展接口（按需定义） ====================
    function extensionNameFor(name) {
        return name.split('_').map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join('');
    }

    function extensionMethods(extension) {
        switch (extension) {
            case 'WEBGL_lose_context':
                return {
                    loseContext() {
                        const context = idl.internal(this).context;
                        if (idl.internal(context).lost) return;
                        dispatchContextEvent(context, 'webglcontextlost');
                        // 事件未被 preventDefault 时，上下文才真正丢失（与规范的排队顺序一致）
                        window.setTimeout(() => {
                            const state = idl.internal(context);
                            if (!state.lost) { state.lost = true; state.error = 0x9242; }
                        }, 0);
                    },
                    restoreContext() {
                        const context = idl.internal(this).context;
                        const state = idl.internal(context);
                        if (!state.lost) return;
                        state.lost = false;
                        state.error = 0;
                        dispatchContextEvent(context, 'webglcontextrestored');
                    }
                };
            case 'OES_vertex_array_object':
                return {
                    createVertexArrayOES() { return createObject(idl.internal(this).context, 'WebGLVertexArrayObjectOES', {}); },
                    deleteVertexArrayOES(object) { markDeleted(idl.internal(this).context, object); },
                    isVertexArrayOES(object) { return isLiveObject(idl.internal(this).context, object, 'WebGLVertexArrayObjectOES'); },
                    bindVertexArrayOES() {}
                };
            case 'ANGLE_instanced_arrays':
                return {
                    drawArraysInstancedANGLE() {}, drawElementsInstancedANGLE() {}, vertexAttribDivisorANGLE() {}
                };
            case 'WEBGL_draw_buffers':
                return { drawBuffersWEBGL() {} };
            case 'EXT_disjoint_timer_query':
                return {
                    createQueryEXT() { return createObject(idl.internal(this).context, 'WebGLTimerQueryEXT', {}); },
                    deleteQueryEXT(object) { markDeleted(idl.internal(this).context, object); },
                    isQueryEXT(object) { return isLiveObject(idl.internal(this).context, object, 'WebGLTimerQueryEXT'); },
                    beginQueryEXT() {}, endQueryEXT() {}, queryCounterEXT() {},
                    getQueryEXT() { return null; }, getQueryParameterEXT() { return 0; }, getQueryObjectEXT() { return null; }
                };
            case 'WEBGL_debug_shaders':
                return {
                    getTranslatedShaderSource(shader) {
                        const state = objectState(idl.internal(this).context, shader, 'WebGLShader');
                        return state ? state.source : '';
                    }
                };
            case 'WEBGL_multi_draw':
                return {
                    multiDrawArraysWEBGL() {}, multiDrawElementsWEBGL() {},
                    multiDrawArraysInstancedWEBGL() {}, multiDrawElementsInstancedWEBGL() {}
                };
            case 'OES_draw_buffers_indexed':
                return {
                    enableiOES() {}, disableiOES() {}, blendEquationiOES() {}, blendEquationSeparateiOES() {},
                    blendFunciOES() {}, blendFuncSeparateiOES() {}, colorMaskiOES() {}
                };
            default:
                return {};
        }
    }

    const definedExtensions = new Set();
    function ensureExtensionInterface(extension) {
        if (definedExtensions.has(extension)) return;
        definedExtensions.add(extension);
        const definition = EXTENSION_INTERFACES[extension];
        idl.defineInterface(definition ? definition.name : extensionNameFor(extension), {
            expose: false,
            constants: definition && definition.constants,
            methods: extensionMethods(extension)
        });
    }

    function createExtension(context, extension) {
        ensureExtensionInterface(extension);
        const definition = EXTENSION_INTERFACES[extension];
        return idl.create(definition ? definition.name : extensionNameFor(extension), { context, name: extension });
    }

    // ==================== 上下文内部状态管理 ====================
    function profileWebgl(type) {
        const profile = window.__profile__ || {};
        const base = profile.webgl || {};
        if (type !== 'webgl2') return base;
        const overlay = profile.webgl2 || {};
        const overlayParameters = overlay.parameters || {};
        const parameters = Object.assign({}, base.parameters, overlayParameters);
        // 基础 profile 是 WebGL1 数据：覆盖层没有显式给出的版本字段应回落到 WebGL2 默认值
        if (overlayParameters[7938] === undefined) delete parameters[7938];
        if (overlayParameters[35724] === undefined) delete parameters[35724];
        const merged = Object.assign({}, base, overlay, { parameters });
        if (overlay.version === undefined) delete merged.version;
        if (overlay.shadingLanguageVersion === undefined) delete merged.shadingLanguageVersion;
        return merged;
    }

    function supportedExtensions(context) {
        const profile = profileWebgl(idl.internal(context).type);
        if (Array.isArray(profile.extensions)) return profile.extensions.slice();
        return (DEFAULT_EXTENSIONS[idl.internal(context).type] || []).slice();
    }

    function createObject(context, interfaceName, fields) {
        const object = idl.create(interfaceName, Object.assign({ context, deleted: false }, fields));
        idl.internal(context).objects.add(object);
        return object;
    }

    function objectState(context, object, interfaceName) {
        if (!object || !idl.is(object, interfaceName)) return null;
        const state = idl.internal(object);
        if (!state || state.context !== context || state.deleted) return null;
        return state;
    }

    function isLiveObject(context, object, interfaceName) {
        return !!objectState(context, object, interfaceName);
    }

    function markDeleted(context, object) {
        if (!object || !idl.is(object, 'WebGLObject')) return;
        const state = idl.internal(object);
        if (state && state.context === context) state.deleted = true;
    }

    function setError(context, code) {
        const state = idl.internal(context);
        if (state && !state.error) state.error = code;
    }

    function convertParameter(pname, value) {
        if (BOOLEAN_ARRAYS.has(pname)) return Array.from(value, Boolean);
        const Ctor = PARAMETER_ARRAYS[pname];
        if (Ctor && Array.isArray(value)) return new Ctor(value);
        return value;
    }

    // 随调用变化的参数
    function dynamicParameter(context, pname) {
        const canvas = idl.internal(context).canvas;
        const width = canvas ? canvas.width : 0;
        const height = canvas ? canvas.height : 0;
        switch (pname) {
            case 0x0BA2: case 0x0C10: return new Int32Array([0, 0, width, height]); // VIEWPORT / SCISSOR_BOX
            case 0x0C22: return new Float32Array([0, 0, 0, 0]); // COLOR_CLEAR_VALUE
            case 0x0C23: return [true, true, true, true]; // COLOR_WRITEMASK
            case 0x0B70: return new Float32Array([0, 1]); // DEPTH_RANGE
            case 0x0B73: return 1; // DEPTH_CLEAR_VALUE
            case 0x0B72: return true; // DEPTH_WRITEMASK
            case 0x0B74: return 0x0201; // DEPTH_FUNC = LESS
            case 0x0B91: return 0; // STENCIL_CLEAR_VALUE
            case 0x0B92: return 0x0200; // STENCIL_FUNC = ALWAYS
            case 0x0B97: case 0x8CA3: return 0; // STENCIL_REF / STENCIL_BACK_REF
            case 0x0B93: case 0x0B98: case 0x8CA4: case 0x8CA5: return -1; // 掩码类
            case 0x0B21: return 1; // LINE_WIDTH
            case 0x0B45: return 0x0405; // CULL_FACE_MODE = BACK
            case 0x0B46: return 0x0901; // FRONT_FACE = CCW
            case 0x0B44: case 0x0BE2: case 0x0B71: case 0x0B90: case 0x0C11: case 0x8037:
            case 0x809E: case 0x80A0: case 0x80AB: case 0x8C89:
                return false; // 各种可开关能力
            case 0x0BD0: return true; // DITHER
            case 0x80A8: return 0; // SAMPLE_BUFFERS
            case 0x80A9: return 4; // SAMPLES
            case 0x80AA: return 1; // SAMPLE_COVERAGE_VALUE
            case 0x84E0: return 0x84C0; // ACTIVE_TEXTURE = TEXTURE0
            case 0x8B8D: case 0x8894: case 0x8895: case 0x8069: case 0x8514: case 0x8CA6:
            case 0x8CA7: case 0x8CA8: case 0x8CA9: case 0x85B5: case 0x8C8F: case 0x8A28:
            case 0x88ED: case 0x88EF: case 0x8865: case 0x8919:
                return null; // 绑定类 / 当前对象
            case 0x8192: return 0x1102; // GENERATE_MIPMAP_HINT = NICEST
            case 0x0CF5: case 0x0D05: return 4; // PACK/UNPACK_ALIGNMENT
            case 0x9240: case 0x9241: return false; // UNPACK_FLIP_Y / PREMULTIPLY_ALPHA
            case 0x9243: return 0x9244; // BROWSER_DEFAULT_WEBGL
            case 0x8B9A: return 0x1401; // IMPLEMENTATION_COLOR_READ_TYPE
            case 0x8B9B: return 0x1908; // IMPLEMENTATION_COLOR_READ_FORMAT
            case 0x8B4B: return 28; // MAX_VARYING_COMPONENTS
            case 0x0C02: return 0x0405; // READ_BUFFER = BACK
            default: return undefined;
        }
    }

    // ==================== GLSL 解析 ====================
    const GLSL_TYPES = {
        float: 0x1406, vec2: 0x8B50, vec3: 0x8B51, vec4: 0x8B52,
        int: 0x1404, ivec2: 0x8B53, ivec3: 0x8B54, ivec4: 0x8B55,
        bool: 0x8B56, bvec2: 0x8B57, bvec3: 0x8B58, bvec4: 0x8B59,
        mat2: 0x8B5A, mat3: 0x8B5B, mat4: 0x8B5C,
        sampler2D: 0x8B5E, samplerCube: 0x8B60
    };

    function parseDeclarations(source, keyword) {
        const declarations = [];
        const pattern = new RegExp(keyword +
            '\\s+(?:(?:lowp|mediump|highp)\\s+)?([A-Za-z_]\\w*)\\s+([A-Za-z_]\\w*)\\s*(?:\\[\\s*(\\d+)\\s*\\])?\\s*;', 'g');
        let match;
        while ((match = pattern.exec(source)) !== null) {
            const type = GLSL_TYPES[match[1]];
            if (type === undefined) continue;
            const size = match[3] ? Number(match[3]) : 1;
            declarations.push({ name: size > 1 ? match[2] + '[0]' : match[2], type, size });
        }
        return declarations;
    }

    // 程序的活动属性来自顶点着色器的 attribute / in 声明
    function programAttributes(program) {
        const vertex = idl.internal(program).shaders.find(shader => idl.internal(shader).type === 0x8B31);
        if (!vertex) return [];
        const source = idl.internal(vertex).source;
        return parseDeclarations(source, 'attribute').concat(parseDeclarations(source, 'in'));
    }

    // 活动统一变量来自全部已附加着色器，按名称去重
    function programUniforms(program) {
        const uniforms = [];
        const seen = new Set();
        for (const shader of idl.internal(program).shaders) {
            for (const declaration of parseDeclarations(idl.internal(shader).source, 'uniform')) {
                if (seen.has(declaration.name)) continue;
                seen.add(declaration.name);
                uniforms.push(declaration);
            }
        }
        return uniforms;
    }

    // ==================== 方法实现 ====================
    const noop = function () {};

    const SPECIAL = {
        getContextAttributes() {
            const state = idl.internal(this);
            return Object.assign({
                alpha: true, antialias: true, depth: true, desynchronized: false,
                failIfMajorPerformanceCaveat: false, powerPreference: 'default',
                premultipliedAlpha: true, preserveDrawingBuffer: false, stencil: false, xrCompatible: false
            }, state.attributes);
        },
        getError() {
            const state = idl.internal(this);
            const error = state.error;
            state.error = 0;
            return error;
        },
        isContextLost() { return !!idl.internal(this).lost; },
        getSupportedExtensions() { return supportedExtensions(this); },
        getExtension(name) {
            const state = idl.internal(this);
            const key = String(name).toUpperCase();
            const canonical = supportedExtensions(this).find(ext => ext.toUpperCase() === key);
            if (!canonical) return null;
            if (state.extensions.has(canonical)) return state.extensions.get(canonical);
            const object = createExtension(this, canonical);
            state.extensions.set(canonical, object);
            if (canonical === 'WEBGL_debug_renderer_info') state.debugEnabled = true;
            return object;
        },
        getParameter(pname) {
            const state = idl.internal(this);
            const key = Number(pname);
            if ((key === 0x9245 || key === 0x9246) && !state.debugEnabled) {
                setError(this, 0x0500);
                return null;
            }
            const profile = profileWebgl(state.type);
            const parameters = profile.parameters || {};
            const validValues = state.type === 'webgl2' ? WEBGL2_PARAMETER_VALUES : WEBGL1_PARAMETER_VALUES;
            let value;
            if (parameters[key] !== undefined && validValues.has(key)) value = parameters[key];
            else if (profile[STRING_PARAMETERS[key]] !== undefined && validValues.has(key)) {
                value = profile[STRING_PARAMETERS[key]];
            } else if (DEFAULT_PARAMETERS[state.type] && DEFAULT_PARAMETERS[state.type][key] !== undefined) {
                value = DEFAULT_PARAMETERS[state.type][key];
            } else {
                value = dynamicParameter(this, key);
            }
            if (value === undefined) {
                if (!KNOWN_PARAMETER_VALUES.has(key)) setError(this, 0x0500);
                return null;
            }
            return convertParameter(key, value);
        },
        getShaderPrecisionFormat(shaderType, precisionType) {
            if (shaderType !== 0x8B31 && shaderType !== 0x8B30) { setError(this, 0x0500); return null; }
            const precision = { 0x8DF2: 'high', 0x8DF1: 'medium', 0x8DF0: 'low' };
            const isInt = precisionType >= 0x8DF3 && precisionType <= 0x8DF5;
            if (!precision[precisionType] && !isInt) { setError(this, 0x0500); return null; }
            const profile = profileWebgl(idl.internal(this).type).precision;
            const stage = shaderType === 0x8B31 ? 'vertex' : 'fragment';
            const chosen = profile && profile[stage] && profile[stage][precision[precisionType] || 'high'];
            return idl.create('WebGLShaderPrecisionFormat', chosen ? Object.assign({}, chosen) :
                (isInt ? { rangeMin: 31, rangeMax: 30, precision: 0 } : { rangeMin: 127, rangeMax: 127, precision: 23 }));
        },
        createShader(type) {
            if (type !== 0x8B31 && type !== 0x8B30) { setError(this, 0x0500); return null; }
            return createObject(this, 'WebGLShader', { type, source: '', compiled: false, infoLog: '' });
        },
        shaderSource(shader, source) {
            const state = objectState(this, shader, 'WebGLShader');
            if (state) { state.source = String(source); state.compiled = false; state.infoLog = ''; }
        },
        getShaderSource(shader) {
            const state = objectState(this, shader, 'WebGLShader');
            return state ? state.source : null;
        },
        compileShader(shader) {
            const state = objectState(this, shader, 'WebGLShader');
            if (!state) return;
            state.compiled = /void\s+main\s*\(/.test(state.source);
            state.infoLog = state.compiled ? '' : (state.source.trim()
                ? "ERROR: 0:1: 'main' : function is not defined"
                : "ERROR: 0:1: '' :  Missing entry point");
        },
        getShaderParameter(shader, pname) {
            const state = objectState(this, shader, 'WebGLShader');
            if (!state) return null;
            if (pname === 0x8B81) return state.compiled;
            if (pname === 0x8B4F) return state.type;
            if (pname === 0x8B80) return state.deleted;
            setError(this, 0x0500);
            return null;
        },
        getShaderInfoLog(shader) {
            const state = objectState(this, shader, 'WebGLShader');
            return state ? state.infoLog || '' : null;
        },
        createProgram() {
            return createObject(this, 'WebGLProgram', {
                shaders: [], linked: false, validated: false, infoLog: '', locations: new Map()
            });
        },
        attachShader(program, shader) {
            const programState = objectState(this, program, 'WebGLProgram');
            if (programState && objectState(this, shader, 'WebGLShader')) programState.shaders.push(shader);
        },
        detachShader(program, shader) {
            const programState = objectState(this, program, 'WebGLProgram');
            if (!programState) return;
            const index = programState.shaders.indexOf(shader);
            if (index >= 0) programState.shaders.splice(index, 1);
        },
        linkProgram(program) {
            const state = objectState(this, program, 'WebGLProgram');
            if (!state) return;
            const shaders = state.shaders.map(shader => idl.internal(shader));
            const ready = shader => !!(shader && shader.compiled && !shader.deleted);
            state.linked = ready(shaders.find(shader => shader && shader.type === 0x8B31)) &&
                ready(shaders.find(shader => shader && shader.type === 0x8B30));
            state.infoLog = state.linked ? '' : "ERROR: 'main' : function is not defined";
        },
        validateProgram(program) {
            const state = objectState(this, program, 'WebGLProgram');
            if (state) state.validated = true;
        },
        getProgramParameter(program, pname) {
            const state = objectState(this, program, 'WebGLProgram');
            if (!state) return null;
            if (pname === 0x8B82) return state.linked;
            if (pname === 0x8B83) return state.validated;
            if (pname === 0x8B80) return state.deleted;
            if (pname === 0x8B85) return state.shaders.slice();
            if (pname === 0x8B89) return programAttributes(program).length;
            if (pname === 0x8B86) return programUniforms(program).length;
            setError(this, 0x0500);
            return null;
        },
        getProgramInfoLog(program) {
            const state = objectState(this, program, 'WebGLProgram');
            return state ? state.infoLog || '' : null;
        },
        getAttachedShaders(program) {
            const state = objectState(this, program, 'WebGLProgram');
            return state ? state.shaders.slice() : null;
        },
        getUniformLocation(program, name) {
            const state = objectState(this, program, 'WebGLProgram');
            if (!state) return null;
            const key = String(name);
            const location = programUniforms(program).findIndex(uniform => uniform.name === key);
            if (location < 0) return null;
            if (!state.locations.has(key)) {
                state.locations.set(key, idl.create('WebGLUniformLocation', { program, location }));
            }
            return state.locations.get(key);
        },
        getActiveAttrib(program, index) {
            if (!objectState(this, program, 'WebGLProgram')) return null;
            const attribute = programAttributes(program)[index];
            return attribute ? idl.create('WebGLActiveInfo', attribute) : null;
        },
        getActiveUniform(program, index) {
            if (!objectState(this, program, 'WebGLProgram')) return null;
            const uniform = programUniforms(program)[index];
            return uniform ? idl.create('WebGLActiveInfo', uniform) : null;
        },
        getAttribLocation(program, name) {
            if (!objectState(this, program, 'WebGLProgram')) return -1;
            return programAttributes(program).findIndex(attribute => attribute.name === String(name));
        },
        createBuffer() { return createObject(this, 'WebGLBuffer', {}); },
        createFramebuffer() { return createObject(this, 'WebGLFramebuffer', {}); },
        createRenderbuffer() { return createObject(this, 'WebGLRenderbuffer', {}); },
        createTexture() { return createObject(this, 'WebGLTexture', {}); },
        isBuffer(object) { return isLiveObject(this, object, 'WebGLBuffer'); },
        isFramebuffer(object) { return isLiveObject(this, object, 'WebGLFramebuffer'); },
        isProgram(object) { return isLiveObject(this, object, 'WebGLProgram'); },
        isRenderbuffer(object) { return isLiveObject(this, object, 'WebGLRenderbuffer'); },
        isShader(object) { return isLiveObject(this, object, 'WebGLShader'); },
        isTexture(object) { return isLiveObject(this, object, 'WebGLTexture'); },
        deleteBuffer(object) { markDeleted(this, object); },
        deleteFramebuffer(object) { markDeleted(this, object); },
        deleteProgram(object) { markDeleted(this, object); },
        deleteRenderbuffer(object) { markDeleted(this, object); },
        deleteShader(object) { markDeleted(this, object); },
        deleteTexture(object) { markDeleted(this, object); },
        checkFramebufferStatus() { return 0x8CD5; },
        getVertexAttrib(index, pname) {
            if (pname === 0x8626) return new Float32Array([0, 0, 0, 1]); // CURRENT_VERTEX_ATTRIB
            if (pname === 0x8623) return 4; // VERTEX_ATTRIB_ARRAY_SIZE
            if (pname === 0x8625) return 0x1406; // VERTEX_ATTRIB_ARRAY_TYPE = FLOAT
            if (pname === 0x8624 || pname === 0x88FE) return 0; // STRIDE / DIVISOR
            if (pname === 0x8622 || pname === 0x886A || pname === 0x88FD) return false; // ENABLED / NORMALIZED / INTEGER
            return null;
        },
        readPixels(x, y, width, height, format, type, pixels) {
            if (pixels && pixels.buffer) new Uint8Array(pixels.buffer).fill(0);
        },
        // WebGL2 专属
        createQuery() { return createObject(this, 'WebGLQuery', {}); },
        createSampler() { return createObject(this, 'WebGLSampler', {}); },
        createTransformFeedback() { return createObject(this, 'WebGLTransformFeedback', {}); },
        createVertexArray() { return createObject(this, 'WebGLVertexArrayObject', {}); },
        isQuery(object) { return isLiveObject(this, object, 'WebGLQuery'); },
        isSampler(object) { return isLiveObject(this, object, 'WebGLSampler'); },
        isSync(object) { return isLiveObject(this, object, 'WebGLSync'); },
        isTransformFeedback(object) { return isLiveObject(this, object, 'WebGLTransformFeedback'); },
        isVertexArray(object) { return isLiveObject(this, object, 'WebGLVertexArrayObject'); },
        fenceSync() { return createObject(this, 'WebGLSync', {}); },
        deleteQuery(object) { markDeleted(this, object); },
        deleteSampler(object) { markDeleted(this, object); },
        deleteSync(object) { markDeleted(this, object); },
        deleteTransformFeedback(object) { markDeleted(this, object); },
        deleteVertexArray(object) { markDeleted(this, object); },
        clientWaitSync() { return 0x911A; }, // ALREADY_SIGNALED
        getSyncParameter() { return 0x9119; }, // SIGNALED
        getFragDataLocation() { return -1; },
        getUniformBlockIndex() { return 0xFFFFFFFF; },
        getUniformIndices(program, names) { return Array.from(names, () => 0xFFFFFFFF); },
        getInternalformatParameter() { return new Int32Array([4, 2, 1]); }
    };

    // ==================== 接口构建 ====================
    const BASE_METHOD_LENGTHS = {
        activeTexture: 1, attachShader: 2, bindAttribLocation: 3, bindBuffer: 2, bindFramebuffer: 2,
        bindRenderbuffer: 2, bindTexture: 2, blendColor: 4, blendEquation: 1, blendEquationSeparate: 2,
        blendFunc: 2, blendFuncSeparate: 4, bufferData: 3, bufferSubData: 3, checkFramebufferStatus: 1,
        clear: 1, clearColor: 4, clearDepth: 1, clearStencil: 1, colorMask: 4, compileShader: 1,
        compressedTexImage2D: 7, compressedTexSubImage2D: 8, copyTexImage2D: 8, copyTexSubImage2D: 8,
        createBuffer: 0, createFramebuffer: 0, createProgram: 0, createRenderbuffer: 0, createShader: 1,
        createTexture: 0, cullFace: 1, deleteBuffer: 1, deleteFramebuffer: 1, deleteProgram: 1,
        deleteRenderbuffer: 1, deleteShader: 1, deleteTexture: 1, depthFunc: 1, depthMask: 1, depthRange: 2,
        detachShader: 2, disable: 1, disableVertexAttribArray: 1, drawArrays: 3, drawElements: 4,
        enable: 1, enableVertexAttribArray: 1, finish: 0, flush: 0, framebufferRenderbuffer: 4,
        framebufferTexture2D: 5, frontFace: 1, generateMipmap: 1, getActiveAttrib: 2, getActiveUniform: 2,
        getAttachedShaders: 1, getAttribLocation: 2, getBufferParameter: 2, getContextAttributes: 0,
        getError: 0, getExtension: 1, getFramebufferAttachmentParameter: 3, getParameter: 1,
        getProgramInfoLog: 1, getProgramParameter: 2, getRenderbufferParameter: 2, getShaderInfoLog: 1,
        getShaderParameter: 2, getShaderPrecisionFormat: 2, getShaderSource: 1, getSupportedExtensions: 0,
        getTexParameter: 2, getUniform: 2, getUniformLocation: 2, getVertexAttrib: 2, getVertexAttribOffset: 2,
        hint: 2, isBuffer: 1, isContextLost: 0, isEnabled: 1, isFramebuffer: 1, isProgram: 1,
        isRenderbuffer: 1, isShader: 1, isTexture: 1, lineWidth: 1, linkProgram: 1, pixelStorei: 2,
        polygonOffset: 2, readPixels: 7, renderbufferStorage: 4, sampleCoverage: 2, scissor: 4,
        shaderSource: 2, stencilFunc: 3, stencilFuncSeparate: 4, stencilMask: 1, stencilMaskSeparate: 2,
        stencilOp: 3, stencilOpSeparate: 4, texImage2D: 6, texParameterf: 3, texParameteri: 3,
        texSubImage2D: 7, uniform1f: 2, uniform1fv: 2, uniform1i: 2, uniform1iv: 2,
        uniform2f: 3, uniform2fv: 2, uniform2i: 3, uniform2iv: 2,
        uniform3f: 4, uniform3fv: 2, uniform3i: 4, uniform3iv: 2,
        uniform4f: 5, uniform4fv: 2, uniform4i: 5, uniform4iv: 2,
        uniformMatrix2fv: 3, uniformMatrix3fv: 3, uniformMatrix4fv: 3,
        useProgram: 1, validateProgram: 1,
        vertexAttrib1f: 2, vertexAttrib1fv: 2, vertexAttrib2f: 3, vertexAttrib2fv: 2,
        vertexAttrib3f: 4, vertexAttrib3fv: 2, vertexAttrib4f: 5, vertexAttrib4fv: 2,
        vertexAttribPointer: 6, viewport: 4
    };

    const WEBGL2_METHOD_LENGTHS = {
        bindBufferBase: 3, bindBufferRange: 5, bindSampler: 2, bindTransformFeedback: 2, bindVertexArray: 1,
        blitFramebuffer: 10, clientWaitSync: 3, copyBufferSubData: 5, createQuery: 0, createSampler: 0,
        createTransformFeedback: 0, createVertexArray: 0, deleteQuery: 1, deleteSampler: 1, deleteSync: 1,
        deleteTransformFeedback: 1, deleteVertexArray: 1, drawArraysInstanced: 4, drawBuffers: 1,
        drawElementsInstanced: 5, drawRangeElements: 6, fenceSync: 2, getBufferSubData: 3,
        getFragDataLocation: 2, getInternalformatParameter: 3, getQuery: 2, getQueryParameter: 2,
        getSamplerParameter: 2, getSyncParameter: 2, getTransformFeedbackVarying: 2, getUniformBlockIndex: 2,
        getUniformIndices: 2, invalidateFramebuffer: 2, invalidateSubFramebuffer: 6,
        isQuery: 1, isSampler: 1, isSync: 1, isTransformFeedback: 1, isVertexArray: 1,
        pauseTransformFeedback: 0, readBuffer: 1, renderbufferStorageMultisample: 5, resumeTransformFeedback: 0,
        texImage3D: 9, texStorage2D: 5, texStorage3D: 6, texSubImage3D: 10,
        transformFeedbackVaryings: 3, uniformBlockBinding: 3,
        uniform1ui: 2, uniform1uiv: 2, uniform2ui: 3, uniform2uiv: 2,
        uniform3ui: 4, uniform3uiv: 2, uniform4ui: 5, uniform4uiv: 2,
        uniformMatrix2x3fv: 3, uniformMatrix2x4fv: 3, uniformMatrix3x2fv: 3,
        uniformMatrix3x4fv: 3, uniformMatrix4x2fv: 3, uniformMatrix4x3fv: 3,
        vertexAttribDivisor: 2, vertexAttribI4i: 5, vertexAttribI4iv: 2,
        vertexAttribI4ui: 5, vertexAttribI4uiv: 2, vertexAttribIPointer: 5, waitSync: 3
    };

    // 上下文丢失后仍返回值（而非 undefined）的方法
    const LOST_NULL = new Set(['getSupportedExtensions', 'getExtension', 'getParameter',
        'getContextAttributes', 'getShaderPrecisionFormat', 'getShaderSource', 'getShaderInfoLog',
        'getProgramInfoLog', 'getError', 'getActiveAttrib', 'getActiveUniform', 'getAttachedShaders',
        'getBufferParameter', 'getFramebufferAttachmentParameter', 'getRenderbufferParameter',
        'getTexParameter', 'getUniform', 'getUniformLocation', 'getVertexAttrib', 'getVertexAttribOffset',
        'checkFramebufferStatus']);

    function wrap(interfaceName, name, impl) {
        return function (...args) {
            Monitor.logCall(`${interfaceName}.${name}`, args, null, { canvasId: canvasIdFor(this) });
            const mock = Monitor.executeMock(`${interfaceName}.${name}`, args, this);
            if (mock.mocked) return mock.result;
            const state = idl.internal(this);
            if (state && state.lost) {
                if (name === 'isContextLost') return true;
                if (name.startsWith('create')) return null;
                if (name.startsWith('is')) return false;
                if (LOST_NULL.has(name)) return impl === SPECIAL.getError ? 0x9242 : null;
                return undefined;
            }
            return impl.apply(this, args);
        };
    }

    function canvasIdFor(context) {
        const state = idl.internal(context);
        return state && state.canvas ? window.__nodeIdOf__?.(state.canvas) : undefined;
    }

    function buildMethods(interfaceName, lengthTables) {
        const methods = {};
        for (const table of lengthTables) {
            for (const [name, length] of Object.entries(table)) {
                methods[name] = { value: wrap(interfaceName, name, SPECIAL[name] || noop), length };
            }
        }
        return methods;
    }

    const contextToken = {};

    function contextSpec(interfaceName, constants, lengthTables) {
        return {
            length: 0,
            construct(canvas, token) {
                if (token !== contextToken) throw new TypeError('Illegal constructor');
                Object.assign(idl.internal(this), {
                    canvas,
                    type: interfaceName === 'WebGL2RenderingContext' ? 'webgl2' : 'webgl',
                    error: 0, lost: false, debugEnabled: false,
                    extensions: new Map(), objects: new Set(), attributes: undefined
                });
            },
            constants,
            attributes: {
                canvas() { return idl.internal(this).canvas; },
                drawingBufferWidth() {
                    const canvas = idl.internal(this).canvas;
                    return canvas ? canvas.width : 0;
                },
                drawingBufferHeight() {
                    const canvas = idl.internal(this).canvas;
                    return canvas ? canvas.height : 0;
                },
                drawingBufferColorSpace() { return 'srgb'; },
                unpackColorSpace() { return 'srgb'; }
            },
            methods: buildMethods(interfaceName, lengthTables)
        };
    }

    idl.defineInterface('WebGLRenderingContext', contextSpec('WebGLRenderingContext', CONSTANTS, [BASE_METHOD_LENGTHS]));
    const WebGL2RenderingContext = idl.defineInterface('WebGL2RenderingContext',
        contextSpec('WebGL2RenderingContext', ALL_CONSTANTS, [BASE_METHOD_LENGTHS, WEBGL2_METHOD_LENGTHS]));

    // ==================== 对外工厂 ====================
    function createContext(canvas, type = 'webgl', attributes) {
        const ctor = type === 'webgl2' ? WebGL2RenderingContext : idl.interfaceObject('WebGLRenderingContext');
        const context = new ctor(canvas, contextToken);
        idl.internal(context).attributes = attributes;
        return context;
    }

    Object.defineProperty(window, '__webglInternals__', {
        value: Object.freeze({ createContext }), configurable: true
    });
})();
