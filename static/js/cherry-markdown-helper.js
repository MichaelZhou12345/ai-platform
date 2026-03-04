// ==================== Cherry Markdown 编辑器辅助工具 ====================

// 存储所有编辑器实例
const cherryEditors = new Map();

/**
 * 创建 Cherry Markdown 编辑器
 * @param {string} id - 容器元素的ID
 * @param {Object} options - 配置选项
 * @returns {Object} Cherry 编辑器实例
 */
function createCherryEditor(id, options = {}) {
    const container = document.getElementById(id);
    if (!container) {
        console.error(`容器元素 #${id} 不存在`);
        return null;
    }

    // 如果已存在编辑器，先销毁
    if (cherryEditors.has(id)) {
        destroyCherryEditor(id);
    }

    // 默认配置
    const defaultConfig = {
        id: id,
        value: options.value || '',
        externals: {
            echarts: window.echarts,
        },
        engine: {
            global: {
                // 是否启用经典换行逻辑
                // true：一个换行会被忽略，两个以上连续换行会分割成段落，
                // false： 一个换行会转成<br>，两个连续换行会分割成段落，三个以上连续换行会转成<br>并分割段落
                classicBr: false,
            },
            syntax: {
                codeBlock: {
                    theme: 'dark',
                },
                table: {
                    enableChart: false,
                },
                mathBlock: {
                    engine: 'MathJax',
                    src: 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js',
                },
                inlineMath: {
                    engine: 'MathJax',
                },
                emoji: {
                    useUnicode: true,
                },
                list: {
                    listNested: false, // 同级列表类型转换后变为子级
                    indentSpace: 2, // 默认2个空格缩进
                },
            },
        },
        toolbars: {
            theme: 'light',
            showToolbar: true,
            toolbar: [
                'bold',
                'italic',
                'strikethrough',
                '|',
                'color',
                'header',
                '|',
                'list',
                {
                    insert: [
                        'image',
                        'audio',
                        'video',
                        'link',
                        'hr',
                        'br',
                        'code',
                        'formula',
                        'toc',
                        'table',
                        'line-table',
                        'bar-table',
                        'pdf',
                        'word',
                    ],
                },
                'graph',
                '|',
                'undo',
                'redo',
                '|',
                'export',
            ],
            bubble: ['bold', 'italic', 'strikethrough', 'sub', 'sup', 'quote', '|', 'size', 'color'],
            float: ['h1', 'h2', 'h3', '|', 'checklist', 'quote', 'quickTable', 'code'],
        },
        editor: {
            defaultModel: 'edit&preview',  // 分栏模式：左边编辑，右边预览
            height: options.height || '400px',
        },
        previewer: {
            dom: false,
            className: 'cherry-markdown',
            enablePreviewerBubble: true,
        },
        keydown: [],
        callback: {
            afterChange: options.onChange || function(text, html) {
                // 默认回调
            },
            afterInit: options.onInit || function() {
                // 默认初始化回调
            },
            beforeImageMounted: options.beforeImageMounted || function(srcProp, src) {
                return { srcProp, src };
            },
        },
        fileUpload: options.fileUpload || cherryFileUploadCallback,
    };

    // 合并用户配置
    const config = deepMerge(defaultConfig, options.config || {});

    try {
        const cherryInstance = new Cherry(config);
        cherryEditors.set(id, cherryInstance);
        return cherryInstance;
    } catch (error) {
        console.error('创建 Cherry 编辑器失败:', error);
        return null;
    }
}

/**
 * 获取编辑器实例
 * @param {string} id - 编辑器ID
 * @returns {Object|null} Cherry 编辑器实例
 */
function getCherryEditor(id) {
    return cherryEditors.get(id) || null;
}

/**
 * 销毁编辑器实例
 * @param {string} id - 编辑器ID
 */
function destroyCherryEditor(id) {
    const editor = cherryEditors.get(id);
    if (editor) {
        try {
            // Cherry 编辑器没有显式的 destroy 方法，清空容器即可
            const container = document.getElementById(id);
            if (container) {
                container.innerHTML = '';
            }
            cherryEditors.delete(id);
        } catch (error) {
            console.error('销毁编辑器失败:', error);
        }
    }
}

/**
 * 获取编辑器内容
 * @param {string} id - 编辑器ID
 * @returns {string} Markdown 文本
 */
function getCherryValue(id) {
    const editor = getCherryEditor(id);
    if (editor) {
        return editor.getValue();
    }
    return '';
}

/**
 * 设置编辑器内容
 * @param {string} id - 编辑器ID
 * @param {string} value - Markdown 文本
 */
function setCherryValue(id, value) {
    const editor = getCherryEditor(id);
    if (editor) {
        editor.setValue(value || '');
    }
}

/**
 * 在编辑器中插入文本
 * @param {string} id - 编辑器ID
 * @param {string} text - 要插入的文本
 */
function insertCherryText(id, text) {
    const editor = getCherryEditor(id);
    if (editor) {
        editor.insert(text);
    }
}

/**
 * 上传图片文件（使用现有的 COS 上传接口）
 * @param {File} file - 图片文件
 * @returns {Promise<string>} 图片URL
 */
async function uploadImageFile(file) {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
    if (!allowedTypes.includes(file.type)) {
        throw new Error('不支持的图片格式');
    }
    
    if (file.size > 5 * 1024 * 1024) {
        throw new Error('图片大小不能超过5MB');
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '上传失败');
    }
    
    const data = await response.json();
    return data.url;
}

/**
 * Cherry 编辑器的文件上传回调（用于工具栏上传按钮）
 * @param {File} file - 上传的文件
 * @param {Function} callback - 回调函数，接收上传后的URL
 */
function cherryFileUploadCallback(file, callback) {
    if (file.type.startsWith('image/')) {
        uploadImageFile(file).then(url => {
            callback(url);
            if (typeof showToast === 'function') {
                showToast('图片上传成功', 'success');
            }
        }).catch(error => {
            console.error('图片上传失败:', error);
            if (typeof showToast === 'function') {
                showToast(error.message || '图片上传失败', 'error');
            }
        });
    } else {
        if (typeof showToast === 'function') {
            showToast('仅支持图片上传', 'error');
        }
    }
}

/**
 * 深度合并对象
 * @param {Object} target - 目标对象
 * @param {Object} source - 源对象
 * @returns {Object} 合并后的对象
 */
function deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
        if (source.hasOwnProperty(key)) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = deepMerge(result[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
    }
    
    return result;
}

/**
 * 创建简化版编辑器（用于小型输入框）
 * @param {string} id - 容器元素的ID
 * @param {Object} options - 配置选项
 * @returns {Object} Cherry 编辑器实例
 */
function createSimpleCherryEditor(id, options = {}) {
    return createCherryEditor(id, {
        ...options,
        config: {
            engine: {
                global: {
                    // 是否启用经典换行逻辑
                    // true：一个换行会被忽略，两个以上连续换行会分割成段落，
                    // false： 一个换行会转成<br>，两个连续换行会分割成段落，三个以上连续换行会转成<br>并分割段落
                    classicBr: false,
                },
                syntax: {
                    codeBlock: {
                        theme: 'dark',
                    },
                    table: {
                        enableChart: false,
                    },
                    mathBlock: {
                        engine: 'MathJax',
                        src: 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js',
                    },
                    inlineMath: {
                        engine: 'MathJax',
                    },
                    emoji: {
                        useUnicode: true,
                    },
                    list: {
                        listNested: false, // 同级列表类型转换后变为子级
                        indentSpace: 2, // 默认2个空格缩进
                    },
                },
            },
            editor: {
                defaultModel: 'edit&preview',  // 分栏模式：左边编辑，右边预览
                height: options.height || '200px',
            },
            toolbars: {
                theme: 'light',
                showToolbar: true,
                toolbar: [
                    'bold',
                    'italic',
                    'strikethrough',
                    '|',
                    'color',
                    'header',
                    '|',
                    'list',
                    {
                        insert: [
                            'image',
                            'link',
                            'hr',
                            'code',
                            'table',
                        ],
                    },
                    '|',
                    'undo',
                    'redo',
                    '|',
                    'fullScreen'
                ],
            },
            ...(options.config || {}),
        },
    });
}

/**
 * 创建全功能编辑器（用于大型编辑区域）
 * @param {string} id - 容器元素的ID
 * @param {Object} options - 配置选项
 * @returns {Object} Cherry 编辑器实例
 */
function createFullCherryEditor(id, options = {}) {
    return createCherryEditor(id, {
        ...options,
        config: {
            editor: {
                defaultModel: 'edit&preview',
                height: options.height || '500px',
            },
            ...(options.config || {}),
        },
    });
}