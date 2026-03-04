// ==================== 团队周报相关 ====================

let currentReportContent = '';
let isGeneratingReport = false;
let currentEditingReportId = null; // 当前正在编辑的周报ID
let reportCherryEditor = null; // Cherry Markdown 编辑器实例
let reportGenerationAbortController = null; // 用于取消AI生成的控制器

// 加载团队周报列表
async function loadTeamReports() {
    // 显示骨架屏
    showSkeleton('teamReportsList', 'reports');
    
    try {
        const response = await fetch('/api/team-reports');
        if (!response.ok) {
            throw new Error('加载周报列表失败');
        }
        const data = await response.json();
        
        // 根据权限显示或隐藏生成按钮
        const generateBtn = document.querySelector('[onclick="openGenerateReportModal()"]');
        if (generateBtn) {
            if (currentUser && currentUser.EngName === window.LEADER) {
                generateBtn.classList.remove('hidden');
            } else {
                generateBtn.classList.add('hidden');
            }
        }
        
        renderTeamReports(data.reports);
    } catch (error) {
        console.error('加载周报失败:', error);
        showToast('加载周报失败', 'error');
    }
}

// 渲染团队周报列表
function renderTeamReports(reports) {
    const container = document.getElementById('teamReportsList');
    
    if (!reports || reports.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-500 py-12">
                <i class="fas fa-file-alt text-6xl mb-4 opacity-50"></i>
                <p>暂无周报，点击右上角"生成本周周报"开始创建</p>
            </div>
        `;
        return;
    }
    
    // 判断是否为管理员
    const isAdmin = currentUser && currentUser.EngName === window.LEADER;
    
    container.innerHTML = `
        <div class="bg-white rounded-lg shadow-sm border overflow-hidden">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">标题</th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建人</th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建时间</th>
                        <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                    ${reports.map(report => `
                        <tr class="hover:bg-gray-50 transition-colors">
                            <td class="px-6 py-4">
                                <div class="text-sm font-medium text-gray-900">${escapeHtml(report.title)}</div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <div class="text-sm text-gray-900">${escapeHtml(report.created_by)}</div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <div class="text-sm text-gray-500">${formatDate(report.created_at)}</div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div class="flex justify-end space-x-2">
                                    <button onclick="viewReport(${report.id})" 
                                            class="text-indigo-600 hover:text-indigo-900 px-3 py-1 rounded border border-indigo-300 hover:bg-indigo-50 transition-colors"
                                            title="查看">
                                        <i class="fas fa-eye mr-1"></i>查看
                                    </button>
                                    ${isAdmin ? `
                                    <button onclick="editReport(${report.id})" 
                                            class="text-blue-600 hover:text-blue-900 px-3 py-1 rounded border border-blue-300 hover:bg-blue-50 transition-colors"
                                            title="编辑">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button onclick="deleteReport(${report.id})" 
                                            class="text-red-600 hover:text-red-900 px-3 py-1 rounded border border-red-300 hover:bg-red-50 transition-colors"
                                            title="删除">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                    ` : ''}
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// 查看周报详情（全屏显示）
let currentViewReportId = null; // 当前查看的周报ID
let reportFontSize = 100; // 周报字体大小百分比
let viewReportCherryEditor = null; // 查看模式的Cherry编辑器实例

async function viewReport(reportId) {
    showLoading();
    try {
        const response = await fetch(`/api/team-reports/${reportId}`);
        if (!response.ok) {
            throw new Error('加载周报失败');
        }
        const report = await response.json();
        
        // 保存当前查看的周报ID
        currentViewReportId = reportId;
        
        // 重置字体大小
        reportFontSize = 100;
        updateReportFontSize();
        
        // 在阅读模式显示AI悬浮按钮
        const aiFab = document.getElementById('ai-fab');
        const aiChatWindow = document.getElementById('ai-chat-window');
        if (aiFab) aiFab.style.display = '';
        if (aiChatWindow && aiChatWindow.classList.contains('active')) {
            // 如果聊天窗口已打开，保持打开状态
        }
        
        // 显示周报详情模态框（全屏）
        document.getElementById('viewReportTitle').textContent = report.title;
        document.getElementById('viewReportMeta').innerHTML = `
            <span><i class="far fa-user mr-1"></i>${escapeHtml(report.created_by)}</span>
            <span class="mx-2">|</span>
            <span><i class="far fa-calendar mr-1"></i>${formatDate(report.created_at)}</span>
        `;
        
        // 初始化查看模式的Cherry编辑器
        initViewReportCherryEditor(report.content);
        
        // 处理周报中的链接（不同设备不同体验）
        setupReportLinks();
        
        // 根据权限显示编辑按钮
        const editBtn = document.getElementById('viewReportEditBtn');
        if (editBtn && currentUser && currentUser.EngName === window.LEADER) {
            editBtn.classList.remove('hidden');
        } else if (editBtn) {
            editBtn.classList.add('hidden');
        }
        
        // 初始化目录侧边栏状态
        initReportSidebarState();
        
        openModal('viewReportModal');
        
        // 延迟生成目录和初始化滚动监听（等待Cherry编辑器渲染完成）
        setTimeout(() => {
            generateReportToc();
            initReportScrollSpy();
        }, 300);
    } catch (error) {
        console.error('加载周报失败:', error);
        showToast('加载周报失败', 'error');
    } finally {
        hideLoading();
    }
}

// 初始化查看模式的Cherry编辑器
function initViewReportCherryEditor(content) {
    // 销毁旧的编辑器实例
    if (viewReportCherryEditor) {
        try {
            const container = document.getElementById('viewReportCherryEditor');
            if (container) {
                container.innerHTML = '';
            }
            viewReportCherryEditor = null;
        } catch (error) {
            console.error('销毁查看编辑器失败:', error);
        }
    }
    
    // 创建新的纯预览模式编辑器
    viewReportCherryEditor = new Cherry({
        id: 'viewReportCherryEditor',
        value: content || '',
        editor: {
            defaultModel: 'previewOnly', // 纯预览模式
            height: 'auto',
        },
        toolbars: {
            showToolbar: false, // 隐藏工具栏
            // 定义侧边栏，默认为空
            sidebar: ['theme', 'mobilePreview'],
            // 定义顶部右侧工具栏，默认为空
            toolbarRight: ['fullScreen', 'export']
        },
        previewer: {
            dom: false,
            className: 'cherry-markdown gray', // 添加沉稳主题类名
            enablePreviewerBubble: false, // 关闭预览区的编辑功能
        },
        engine: {
            syntax: {
                codeBlock: {
                    theme: 'dark', // 使用暗色主题的代码块
                },
                table: {
                    enableChart: false, // 禁用图表功能
                },
                header: {
                    /**
                     * 标题的样式：
                     *  - default       默认样式，标题前面有锚点
                     *  - autonumber    标题前面有自增序号锚点
                     *  - none          标题没有锚点
                     */
                    anchorStyle: 'none',
                },
                list: {
                    listNested: false, // 同级列表类型转换后变为子级
                    indentSpace: 2, // 默认2个空格缩进
                },
            },
            // 自定义链接渲染器
            customSyntax: {
                link: {
                    syntaxClass: 'link-preview-handler', // 添加自定义类名用于事件监听
                },
            },
        },
        // 自定义图片点击处理
        callback: {
            afterInit: function() {
                // 为渲染后的图片添加点击放大事件
                setTimeout(() => {
                    const container = document.getElementById('viewReportCherryEditor');
                    if (container) {
                        // 为所有图片添加点击放大事件
                        const images = container.querySelectorAll('img');
                        images.forEach(img => {
                            img.style.cursor = 'pointer';
                            img.addEventListener('click', function(e) {
                                e.stopPropagation();
                                openImageModal(this.src);
                            });
                        });
                        
                        // 为所有链接添加图标和点击预览事件
                        const links = container.querySelectorAll('a');
                        links.forEach(link => {
                            // 为链接添加图标（对齐 marked.js 的渲染逻辑）
                            const href = link.getAttribute('href');
                            // 判断是否为页内锚点链接
                            if (href && !href.startsWith('#')) {
                                // 检查是否已经插入了图标（检查第一个子节点）
                                const firstChild = link.firstChild;
                                const hasIcon = firstChild && firstChild.nodeType === 1 && 
                                    (firstChild.classList.contains('fa-file-word') || 
                                     firstChild.classList.contains('mr-1'));
                                
                                if (!hasIcon) {
                                    // 判断链接类型并添加相应的图标
                                    let icon = '';
                                    if (href.startsWith('https://doc.weixin.qq.com')) {
                                        // 微信文档链接 - 使用 office 图标
                                        icon = '<i class="far fa-file-word mr-1"></i>';
                                    } else {
                                        // 其他链接 - 使用链接图标
                                        icon = '<span class="mr-1">🔗</span>';
                                    }
                                    // 在链接内容前插入图标
                                    link.insertAdjacentHTML('afterbegin', icon);
                                }
                            }
                            
                            link.addEventListener('click', function(e) {
                                e.preventDefault();
                                const href = this.getAttribute('href');
                                if (href) {
                                    openLinkPreviewPanel(href, this.textContent);
                                }
                            });
                        });
                    }
                }, 100);
            },
        },
    });
}

// 调整周报字体大小
function adjustReportFontSize(delta) {
    reportFontSize += delta * 10;
    reportFontSize = Math.max(60, Math.min(200, reportFontSize)); // 限制在60%-200%之间
    updateReportFontSize();
}

// 重置周报字体大小
function resetReportFontSize() {
    reportFontSize = 100;
    updateReportFontSize();
}

// 更新周报字体大小显示
function updateReportFontSize() {
    const display = document.getElementById('reportFontSizeDisplay');
    
    if (display) {
        display.textContent = `${reportFontSize}%`;
    }
    
    // 应用字体大小到Cherry编辑器的预览区域
    if (viewReportCherryEditor) {
        const container = document.getElementById('viewReportCherryEditor');
        if (container) {
            const previewer = container.querySelector('.cherry-previewer');
            if (previewer) {
                previewer.style.fontSize = `${reportFontSize}%`;
            }
        }
    }
}

// 从查看模式进入编辑模式
function editReportFromView() {
    if (currentViewReportId) {
        closeModal('viewReportModal');
        editReport(currentViewReportId);
    }
}

// 编辑周报
async function editReport(reportId) {
    showLoading();
    try {
        const response = await fetch(`/api/team-reports/${reportId}`);
        if (!response.ok) {
            throw new Error('加载周报失败');
        }
        const report = await response.json();
        
        // 设置为编辑模式
        currentEditingReportId = reportId;
        currentReportContent = report.content;
        isGeneratingReport = false;
        
        // 在编辑状态隐藏AI悬浮按钮和聊天窗口
        const aiFab = document.getElementById('ai-fab');
        const aiChatWindow = document.getElementById('ai-chat-window');
        if (aiFab) aiFab.style.display = 'none';
        if (aiChatWindow) {
            aiChatWindow.classList.remove('active');
            aiChatWindow.style.display = 'none';
        }
        
        // 填充表单
        document.getElementById('reportTitle').value = report.title;
        document.getElementById('reportOptimizePrompt').value = '';
        
        // 显示模态框
        const modal = document.getElementById('generateReportModal');
        modal.classList.add('active');
        
        // 初始化编辑器并设置内容
        setTimeout(() => {
            initReportCherryEditor(report.content);
        }, 100);
    } catch (error) {
        console.error('加载周报失败:', error);
        showToast('加载周报失败', 'error');
    } finally {
        hideLoading();
    }
}

// 删除周报
async function deleteReport(reportId) {
    if (!confirm('确认删除该周报？删除后将无法恢复。')) return;
    
    showLoading();
    try {
        const response = await fetch(`/api/team-reports/${reportId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showToast('删除成功', 'success');
            await loadTeamReports();
        } else {
            throw new Error('删除失败');
        }
    } catch (error) {
        console.error('删除周报失败:', error);
        showToast('删除失败', 'error');
    } finally {
        hideLoading();
    }
}

// 打开生成周报界面
function openGenerateReportModal() {
    // 重置状态
    currentReportContent = '';
    isGeneratingReport = false;
    currentEditingReportId = null; // 重置编辑ID
    
    // 在编辑状态隐藏AI悬浮按钮和聊天窗口
    const aiFab = document.getElementById('ai-fab');
    const aiChatWindow = document.getElementById('ai-chat-window');
    if (aiFab) aiFab.style.display = 'none';
    if (aiChatWindow) {
        aiChatWindow.classList.remove('active');
        aiChatWindow.style.display = 'none';
    }
    
    // 设置默认标题（当前日期）
    const now = new Date();
    const title = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日周报`;
    document.getElementById('reportTitle').value = title;
    
    // 清空优化输入框
    document.getElementById('reportOptimizePrompt').value = '';
    
    // 显示模态框
    const modal = document.getElementById('generateReportModal');
    modal.classList.add('active');
    
    // 初始化 Cherry Markdown 编辑器
    setTimeout(() => {
        initReportCherryEditor('');
        // 自动开始生成
        startGenerateReport();
    }, 100);
}

// 初始化 Cherry Markdown 编辑器
function initReportCherryEditor(initialValue = '', isStreamingMode = false) {
    // 如果已存在编辑器，先销毁
    if (reportCherryEditor) {
        try {
            const container = document.getElementById('reportCherryEditor');
            if (container) {
                container.innerHTML = '';
            }
            reportCherryEditor = null;
        } catch (error) {
            console.error('销毁编辑器失败:', error);
        }
    }
    
    // 流式模式配置
    const streamingConfig = isStreamingMode ? {
        engine: {
            global: {
                // 开启流式渲染模式
                flowSessionContext: true,
                // 流式会话时，在最后位置增加一个光标
                flowSessionCursor: "default",
            },
        },
        previewer: {
            // 关闭预览区的编辑功能
            enablePreviewerBubble: false,
        },
    } : {};
    
    // 创建新的编辑器实例
    const cherryConfig = {
        id: 'reportCherryEditor',
        value: initialValue || (isStreamingMode ? '' : '等待生成周报...'),
        editor: {
            defaultModel: isStreamingMode ? 'previewOnly' : 'edit&preview',
            height: '100%',
        },
        engine: {
            syntax: {
                codeBlock: {
                    theme: 'dark', // 使用暗色主题的代码块
                },
                table: {
                    enableChart: false, // 禁用图表功能
                },
                header: {
                    /**
                     * 标题的样式：
                     *  - default       默认样式，标题前面有锚点
                     *  - autonumber    标题前面有自增序号锚点
                     *  - none          标题没有锚点
                     */
                    anchorStyle: 'none',
                },
                list: {
                    listNested: false, // 同级列表类型转换后变为子级
                    indentSpace: 2, // 默认2个空格缩进
                },
            },
            // 自定义链接渲染器
            customSyntax: {
                link: {
                    syntaxClass: 'link-preview-handler', // 添加自定义类名用于事件监听
                },
            },
        },
        toolbars: isStreamingMode ? {
            showToolbar: false, // 流式模式隐藏工具栏
        } : {
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
                        'panel',      // 信息面板
                        'detail',     // 手风琴
                    ],
                },
                '|',
                'togglePreview',
                '|',
                'undo',
                'redo',
            ],
            toc: true,
            // 定义侧边栏，默认为空
            sidebar: ['theme', 'mobilePreview'],
            // 定义顶部右侧工具栏，默认为空
            toolbarRight: ['fullScreen', 'export'],
        },
        callback: {
            afterChange: function(text, html) {
                if (!isStreamingMode) {
                    currentReportContent = text;
                    
                    // 为链接添加图标（对齐 marked.js 的渲染逻辑）
                    setTimeout(() => {
                        const container = document.getElementById('reportCherryEditor');
                        if (container) {
                            const previewer = container.querySelector('.cherry-previewer');
                            if (previewer) {
                                const links = previewer.querySelectorAll('a');
                                links.forEach(link => {
                                    const href = link.getAttribute('href');
                                    // 判断是否为页内锚点链接
                                    if (href && !href.startsWith('#')) {
                                        // 检查是否已经插入了图标（检查第一个子节点）
                                        const firstChild = link.firstChild;
                                        const hasIcon = firstChild && firstChild.nodeType === 1 && 
                                            (firstChild.classList.contains('fa-file-word') || 
                                             firstChild.classList.contains('mr-1'));
                                        
                                        if (!hasIcon) {
                                            // 判断链接类型并添加相应的图标
                                            let icon = '';
                                            if (href.startsWith('https://doc.weixin.qq.com')) {
                                                // 微信文档链接 - 使用 office 图标
                                                icon = '<i class="far fa-file-word mr-1"></i>';
                                            } else {
                                                // 其他链接 - 使用链接图标
                                                icon = '<span class="mr-1">🔗</span>';
                                            }
                                            // 在链接内容前插入图标
                                            link.insertAdjacentHTML('afterbegin', icon);
                                        }
                                    }
                                });
                            }
                        }
                    }, 100);
                }
            },
        },
        fileUpload: async function(file, callback) {
            if (file.type.startsWith('image/')) {
                try {
                    const url = await uploadImageForReport(file);
                    callback(url);
                    showToast('图片上传成功', 'success');
                } catch (error) {
                    console.error('图片上传失败:', error);
                    showToast(error.message || '图片上传失败', 'error');
                }
            } else {
                showToast('仅支持图片上传', 'error');
            }
        },
    };
    
    // 合并流式模式配置
    Object.assign(cherryConfig, streamingConfig);
    
    reportCherryEditor = new Cherry(cherryConfig);
}

// 上传图片（用于Cherry编辑器）
async function uploadImageForReport(file) {
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

// 开始生成周报
async function startGenerateReport() {
    if (isGeneratingReport) return;
    
    isGeneratingReport = true;
    currentReportContent = '';
    
    // 创建新的 AbortController
    reportGenerationAbortController = new AbortController();
    
    // 初始化流式模式编辑器
    initReportCherryEditor('', true);
    
    // 设置初始提示
    if (reportCherryEditor) {
        reportCherryEditor.setValue('# 正在生成周报...\n\n<i class="fas fa-spinner fa-spin"></i>');
    }
    
    try {
        const response = await fetch('/api/ai/generate-team-report', {
            signal: reportGenerationAbortController.signal
        });
        
        if (!response.ok) {
            throw new Error('生成失败');
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        // 先清空初始提示
        currentReportContent = '';
        if (reportCherryEditor) {
            reportCherryEditor.setValue('');
        }
        
        while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            currentReportContent += chunk;
            
            // 使用Cherry的setValue方法更新内容（流式模式会自动处理增量渲染）
            if (reportCherryEditor) {
                reportCherryEditor.setValue(currentReportContent);
                
                // 自动滚动到底部
                autoScrollToBottom();
            }
        }
        
        showToast('周报生成完成', 'success');
        
        // 生成完成后，切换为可编辑模式
        setTimeout(() => {
            if (reportCherryEditor && currentReportContent) {
                initReportCherryEditor(currentReportContent, false);
            }
        }, 500);
    } catch (error) {
        // 如果是用户主动取消，不显示错误提示
        if (error.name === 'AbortError') {
            console.log('周报生成已取消');
            if (reportCherryEditor) {
                reportCherryEditor.setValue('# 生成已取消\n\n<i class="fas fa-times-circle"></i>');
            }
        } else {
            console.error('生成周报失败:', error);
            showToast('生成失败: ' + error.message, 'error');
            if (reportCherryEditor) {
                reportCherryEditor.setValue('# 生成失败，请重试\n\n<i class="fas fa-exclamation-circle"></i>');
            }
        }
    } finally {
        isGeneratingReport = false;
        reportGenerationAbortController = null;
    }
}

// 自动滚动到底部
function autoScrollToBottom() {
    const cherryContainer = document.getElementById('reportCherryEditor');
    if (!cherryContainer) return;
    
    // 查找 Cherry 编辑器的预览区域
    const previewArea = cherryContainer.querySelector('.cherry-previewer');
    if (!previewArea) return;
    
    // 平滑滚动到底部
    previewArea.scrollTo({
        top: previewArea.scrollHeight,
        behavior: 'smooth'
    });
}

// 优化周报内容
async function optimizeReport() {
    const optimizePrompt = document.getElementById('reportOptimizePrompt').value.trim();
    
    if (!optimizePrompt) {
        showToast('请输入优化要求', 'error');
        return;
    }
    
    if (!currentReportContent) {
        showToast('请先生成周报', 'error');
        return;
    }
    
    if (isGeneratingReport) {
        showToast('正在生成中，请稍候', 'error');
        return;
    }
    
    isGeneratingReport = true;
    
    // 创建新的 AbortController
    reportGenerationAbortController = new AbortController();
    
    // 保存当前内容作为备份
    const backupContent = currentReportContent;
    currentReportContent = '';
    
    // 初始化流式模式编辑器
    initReportCherryEditor('', true);
    
    // 设置优化中提示
    if (reportCherryEditor) {
        reportCherryEditor.setValue('# 正在优化周报...\n\n<i class="fas fa-spinner fa-spin"></i>');
    }
    
    try {
        // 调用后端优化接口
        const response = await fetch('/api/ai/optimize-team-report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: backupContent,
                prompt: optimizePrompt
            }),
            signal: reportGenerationAbortController.signal
        });
        
        if (!response.ok) {
            throw new Error('优化失败');
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        // 先清空初始提示
        currentReportContent = '';
        if (reportCherryEditor) {
            reportCherryEditor.setValue('');
        }
        
        while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            currentReportContent += chunk;
            
            // 使用Cherry的setValue方法更新内容（流式模式会自动处理增量渲染）
            if (reportCherryEditor) {
                reportCherryEditor.setValue(currentReportContent);
                
                // 自动滚动到底部
                autoScrollToBottom();
            }
        }
        
        // 清空优化输入框
        document.getElementById('reportOptimizePrompt').value = '';
        
        showToast('优化完成', 'success');
        
        // 优化完成后，切换为可编辑模式
        setTimeout(() => {
            if (reportCherryEditor && currentReportContent) {
                initReportCherryEditor(currentReportContent, false);
            }
        }, 500);
    } catch (error) {
        // 如果是用户主动取消，不显示错误提示
        if (error.name === 'AbortError') {
            console.log('周报优化已取消');
            // 恢复备份内容并切换为编辑模式
            currentReportContent = backupContent;
            setTimeout(() => {
                if (reportCherryEditor && backupContent) {
                    initReportCherryEditor(backupContent, false);
                }
            }, 500);
        } else {
            console.error('优化周报失败:', error);
            showToast('优化失败: ' + error.message, 'error');
            
            // 恢复备份内容并切换为编辑模式
            currentReportContent = backupContent;
            setTimeout(() => {
                if (reportCherryEditor && backupContent) {
                    initReportCherryEditor(backupContent, false);
                }
            }, 500);
        }
    } finally {
        isGeneratingReport = false;
        reportGenerationAbortController = null;
    }
}

// 监听Markdown编辑器变化
function handleReportMarkdownChange() {
    const markdownEditor = document.getElementById('reportMarkdown');
    const previewContainer = document.getElementById('reportPreview');
    
    currentReportContent = markdownEditor.value;
    previewContainer.innerHTML = marked.parse(currentReportContent);
}

// 处理周报编辑器的粘贴事件
async function handleReportPaste(event) {
    const items = event.clipboardData?.items;
    if (!items) return;
    
    for (const item of items) {
        if (item.type.startsWith('image/')) {
            event.preventDefault();
            const file = item.getAsFile();
            if (file) {
                await uploadAndInsertImageToReport(file);
            }
            break;
        }
    }
}

// 处理周报编辑器的拖拽事件
async function handleReportDrop(event) {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (file.type.startsWith('image/')) {
        await uploadAndInsertImageToReport(file);
    } else {
        showToast('请拖拽图片文件', 'error');
    }
}

// 上传图片并插入到周报编辑器
async function uploadAndInsertImageToReport(file) {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
    if (!allowedTypes.includes(file.type)) {
        showToast('不支持的图片格式，请上传jpg、png、gif、webp或bmp格式的图片', 'error');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
        showToast('图片大小不能超过5MB', 'error');
        return;
    }
    
    showLoading();
    
    try {
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
        
        const textarea = document.getElementById('reportMarkdown');
        if (textarea) {
            const startPos = textarea.selectionStart;
            const endPos = textarea.selectionEnd;
            const textBefore = textarea.value.substring(0, startPos);
            const textAfter = textarea.value.substring(endPos, textarea.value.length);
            
            const imageMarkdown = `
![图片描述](${data.url})
`;
            
            textarea.value = textBefore + imageMarkdown + textAfter;
            
            textarea.selectionStart = textarea.selectionEnd = startPos + imageMarkdown.length;
            textarea.focus();
            
            // 触发变化事件以更新预览
            handleReportMarkdownChange();
        }
        
        showToast('图片上传成功', 'success');
    } catch (error) {
        console.error('图片上传失败:', error);
        showToast(error.message || '图片上传失败', 'error');
    } finally {
        hideLoading();
    }
}

// 打开周报图片上传
function openReportImageUpload() {
    const fileInput = document.getElementById('reportImageUploadInput');
    if (fileInput) {
        fileInput.click();
    }
}

// 处理周报图片上传文件选择
async function handleReportImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    await uploadAndInsertImageToReport(file);
    event.target.value = '';
}

// 保存周报
async function saveReport() {
    const title = document.getElementById('reportTitle').value.trim();
    
    // 从Cherry编辑器获取内容
    let content = '';
    if (reportCherryEditor) {
        content = reportCherryEditor.getValue().trim();
    } else {
        content = currentReportContent.trim();
    }
    
    if (!title) {
        showToast('请输入周报标题', 'error');
        return;
    }
    
    if (!content) {
        showToast('周报内容不能为空', 'error');
        return;
    }
    
    showLoading();
    try {
        let response;
        
        // 如果是编辑模式，使用PUT方法；否则使用POST方法
        if (currentEditingReportId) {
            response = await fetch(`/api/team-reports/${currentEditingReportId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: title,
                    content: content
                })
            });
        } else {
            response = await fetch('/api/team-reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: title,
                    content: content,
                    created_by: currentUser.EngName
                })
            });
        }
        
        if (response.ok) {
            showToast(currentEditingReportId ? '更新成功' : '保存成功', 'success');
            closeGenerateReportModal();
            await loadTeamReports();
        } else {
            throw new Error(currentEditingReportId ? '更新失败' : '保存失败');
        }
    } catch (error) {
        console.error('保存周报失败:', error);
        showToast('保存失败', 'error');
    } finally {
        hideLoading();
    }
}

// 关闭生成周报模态框
function closeGenerateReportModal() {
    if (isGeneratingReport) {
        if (!confirm('周报正在生成中，确认关闭？')) {
            return;
        }
        
        // 中止正在进行的AI生成
        if (reportGenerationAbortController) {
            reportGenerationAbortController.abort();
            reportGenerationAbortController = null;
        }
    }
    
    const modal = document.getElementById('generateReportModal');
    modal.classList.remove('active');
    
    // 销毁Cherry编辑器实例
    if (reportCherryEditor) {
        try {
            const container = document.getElementById('reportCherryEditor');
            if (container) {
                container.innerHTML = '';
            }
            reportCherryEditor = null;
        } catch (error) {
            console.error('销毁编辑器失败:', error);
        }
    }
    
    // 重新显示AI悬浮按钮和聊天窗口（退出编辑状态）
    const aiFab = document.getElementById('ai-fab');
    const aiChatWindow = document.getElementById('ai-chat-window');
    if (aiFab) aiFab.style.display = '';
    if (aiChatWindow) aiChatWindow.style.display = '';
    
    // 重置状态
    currentReportContent = '';
    isGeneratingReport = false;
    currentEditingReportId = null; // 重置编辑ID
}

// 从周报快速创建TODO
function openQuickTodoFromReport() {
    // 清空表单（只清空描述字段）
    document.getElementById('todoDescription').value = '';
    
    // 默认指派给当前用户
    if (currentUser) {
        document.getElementById('todoAssigneeEng').value = currentUser.EngName || '';
        document.getElementById('todoAssigneeChn').value = currentUser.ChnName || '';
    }
    
    // 加载成员列表到下拉框
    if (typeof window.loadMemberOptionsForTodo === 'function') {
        window.loadMemberOptionsForTodo();
    } else {
        console.error('loadMemberOptionsForTodo function not available');
    }
    
    // 打开待办弹窗（z-index 已在 CSS 中设置为 10050）
    openModal('todoModal');
}

// ==================== 链接预览相关 ====================

let currentPreviewUrl = '';

// 检测是否为移动设备
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
}

// 处理周报中的链接（不同设备不同体验）
function setupReportLinks() {
    // 链接图标和事件处理已经在 initViewReportCherryEditor 的 afterInit 回调中完成
    // 此函数保留作为占位符，避免其他地方的调用报错
    console.log('setupReportLinks called - 链接处理已在 afterInit 回调中完成');
}

function openLinkPreview(url, title) {
    if (!url) return;
    
    currentPreviewUrl = url;
    
    const panel = document.getElementById('linkPreviewPanel');
    const overlay = document.getElementById('linkPreviewOverlay');
    const iframe = document.getElementById('linkPreviewIframe');
    const titleElement = document.getElementById('linkPreviewTitle');
    
    // 设置标题
    titleElement.textContent = title || url;
    
    // 设置iframe源
    iframe.src = url;
    
    // 显示面板和遮罩
    panel.classList.remove('hidden');
    overlay.classList.remove('hidden');
    
    // 添加动画效果
    panel.style.transform = 'translateX(100%)';
    setTimeout(() => {
        panel.style.transform = 'translateX(0)';
    }, 10);
}

// 打开链接预览面板（别名函数，用于编辑器链接点击）
function openLinkPreviewPanel(url, title) {
    openLinkPreview(url, title);
}

// 在新标签页中打开当前预览的链接
function openLinkInNewTab() {
    if (currentPreviewUrl) {
        window.open(currentPreviewUrl, '_blank');
    }
}

// 关闭链接预览面板
function closeLinkPreviewPanel() {
    const panel = document.getElementById('linkPreviewPanel');
    const overlay = document.getElementById('linkPreviewOverlay');
    const iframe = document.getElementById('linkPreviewIframe');
    
    // 添加动画效果
    panel.style.transform = 'translateX(100%)';
    
    setTimeout(() => {
        panel.classList.add('hidden');
        overlay.classList.add('hidden');
        // 清空iframe
        iframe.src = '';
    }, 300);
    
    currentPreviewUrl = '';
}

// 键盘事件处理：ESC关闭面板
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const panel = document.getElementById('linkPreviewPanel');
        if (!panel.classList.contains('hidden')) {
            closeLinkPreviewPanel();
        }
    }
});

// 导出函数供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        closeLinkPreviewPanel
    };
}

// ==================== 周报目录相关 ====================

// 生成周报目录
function generateReportToc() {
    const tocContainer = document.getElementById('reportViewToc');
    if (!tocContainer) return;
    
    // 获取Cherry编辑器的预览区域
    const container = document.getElementById('viewReportCherryEditor');
    if (!container) {
        tocContainer.innerHTML = '<div class="text-gray-400 text-sm">暂无目录</div>';
        return;
    }
    
    const previewer = container.querySelector('.cherry-previewer');
    if (!previewer) {
        tocContainer.innerHTML = '<div class="text-gray-400 text-sm">暂无目录</div>';
        return;
    }
    
    // 获取所有标题元素（h1-h6）
    const headings = previewer.querySelectorAll('h1, h2, h3, h4, h5, h6');
    
    if (headings.length === 0) {
        tocContainer.innerHTML = '<div class="text-gray-400 text-sm">暂无目录</div>';
        return;
    }
    
    // 为每个标题添加ID（如果没有的话）
    headings.forEach((heading, index) => {
        if (!heading.id) {
            heading.id = `report-heading-${index}`;
        }
    });
    
    // 生成目录HTML
    let tocHtml = '';
    headings.forEach((heading, index) => {
        const level = parseInt(heading.tagName.substring(1)); // h1 -> 1, h2 -> 2, etc.
        const text = heading.textContent.trim();
        const id = heading.id;
        
        // 根据标题级别设置缩进和样式
        const indent = (level - 1) * 12; // 每级缩进12px
        const fontSize = level === 1 ? 'text-sm' : 'text-xs';
        const fontWeight = level <= 2 ? 'font-medium' : 'font-normal';
        const textColor = level === 1 ? 'text-gray-900' : 'text-gray-600';
        
        tocHtml += `
            <div class="toc-item report-toc-item" data-target="${id}" style="padding-left: ${indent}px;">
                <a href="#${id}" 
                   class="block px-3 py-2 ${fontSize} ${fontWeight} ${textColor} rounded-lg hover:bg-gray-100 transition-colors line-clamp-2"
                   onclick="scrollToReportHeading(event, '${id}')">
                    ${escapeHtml(text)}
                </a>
            </div>
        `;
    });
    
    tocContainer.innerHTML = tocHtml;
}

// 滚动到指定标题
function scrollToReportHeading(event, headingId) {
    event.preventDefault();
    const heading = document.getElementById(headingId);
    if (heading) {
        // 获取内容区域
        const contentArea = document.querySelector('.report-content-area');
        if (contentArea) {
            const offset = 20; // 顶部留白
            const headingPosition = heading.offsetTop;
            const offsetPosition = headingPosition - offset;
            
            contentArea.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    }
}

// 初始化周报滚动监听（高亮当前目录项）
let reportHeadingObservers = [];
let reportVisibleHeadings = new Set(); // 跟踪当前可见的标题

function initReportScrollSpy() {
    // 清除旧的观察者
    reportHeadingObservers.forEach(observer => observer.disconnect());
    reportHeadingObservers = [];
    reportVisibleHeadings.clear();
    
    // 获取Cherry编辑器的预览区域
    const container = document.getElementById('viewReportCherryEditor');
    if (!container) return;
    
    const previewer = container.querySelector('.cherry-previewer');
    if (!previewer) return;
    
    // 获取所有标题元素
    const headings = previewer.querySelectorAll('h1, h2, h3, h4, h5, h6');
    if (headings.length === 0) return;
    
    // 创建IntersectionObserver配置
    const observerOptions = {
        root: document.querySelector('.report-content-area'), // 使用内容区域作为root
        rootMargin: '-80px 0px -70% 0px', // 顶部80px，底部70%的边距
        threshold: [0, 0.1, 0.5, 1.0] // 多个阈值，更精确地跟踪
    };
    
    // 观察所有标题
    headings.forEach(heading => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const headingId = entry.target.id;
                
                if (entry.isIntersecting) {
                    // 标题进入视口
                    reportVisibleHeadings.add(headingId);
                } else {
                    // 标题离开视口
                    reportVisibleHeadings.delete(headingId);
                }
                
                // 更新高亮（选择最合适的标题）
                updateReportTocHighlight();
            });
        }, observerOptions);
        observer.observe(heading);
        reportHeadingObservers.push(observer);
    });
    
    // 初始执行一次
    handleInitialReportScrollHighlight();
}

// 更新周报目录高亮状态
function updateReportTocHighlight() {
    const tocItems = document.querySelectorAll('.report-toc-item');
    
    // 如果没有可见的标题，不做任何操作
    if (reportVisibleHeadings.size === 0) {
        return;
    }
    
    // 获取所有可见标题的元素
    const container = document.getElementById('viewReportCherryEditor');
    if (!container) return;
    
    const previewer = container.querySelector('.cherry-previewer');
    if (!previewer) return;
    
    // 找到最靠近顶部的可见标题
    let closestHeading = null;
    let minDistance = Infinity;
    
    reportVisibleHeadings.forEach(headingId => {
        const heading = document.getElementById(headingId);
        if (heading) {
            const rect = heading.getBoundingClientRect();
            const distance = Math.abs(rect.top);
            
            if (distance < minDistance) {
                minDistance = distance;
                closestHeading = headingId;
            }
        }
    });
    
    // 高亮最合适的标题对应的目录项
    if (closestHeading) {
        let activeItem = null;
        
        tocItems.forEach(item => {
            if (item.dataset.target === closestHeading) {
                item.classList.add('active');
                activeItem = item;
            } else {
                item.classList.remove('active');
            }
        });
        
        // 确保高亮的目录项在可视范围内
        if (activeItem) {
            scrollActiveReportTocIntoView(activeItem);
        }
    }
}

// 确保高亮的目录项在可视范围内
function scrollActiveReportTocIntoView(activeItem) {
    if (!activeItem) return;
    
    const tocContainer = document.getElementById('reportViewToc');
    if (!tocContainer) return;
    
    // 获取目录容器的位置信息
    const containerRect = tocContainer.getBoundingClientRect();
    const itemRect = activeItem.getBoundingClientRect();
    
    // 计算是否在可视范围内
    const isVisible = (
        itemRect.top >= containerRect.top &&
        itemRect.bottom <= containerRect.bottom
    );
    
    // 如果不在可视范围内,滚动到可见位置
    if (!isVisible) {
        // 计算需要滚动的距离
        const scrollTop = tocContainer.scrollTop;
        const itemOffsetTop = activeItem.offsetTop;
        const itemHeight = activeItem.offsetHeight;
        const containerHeight = containerRect.height;
        
        // 如果元素在上方,向上滚动
        if (itemRect.top < containerRect.top) {
            tocContainer.scrollTo({
                top: itemOffsetTop - 10, // 留出一点顶部边距
                behavior: 'smooth'
            });
        } 
        // 如果元素在下方,向下滚动
        else if (itemRect.bottom > containerRect.bottom) {
            tocContainer.scrollTo({
                top: itemOffsetTop - containerHeight + itemHeight + 10, // 留出一点底部边距
                behavior: 'smooth'
            });
        }
    }
}

// 初始滚动高亮
function handleInitialReportScrollHighlight() {
    const container = document.getElementById('viewReportCherryEditor');
    if (!container) return;
    
    const previewer = container.querySelector('.cherry-previewer');
    if (!previewer) return;
    
    const headings = previewer.querySelectorAll('h1, h2, h3, h4, h5, h6');
    
    // 先清除所有高亮
    const tocItems = document.querySelectorAll('.report-toc-item');
    tocItems.forEach(item => item.classList.remove('active'));
    
    // 找到第一个可见的元素
    for (const heading of headings) {
        const rect = heading.getBoundingClientRect();
        if (rect.top <= 100) {
            highlightReportTocItem(heading.id);
            break;
        }
    }
}

// 高亮指定ID的目录项
function highlightReportTocItem(headingId) {
    const tocItems = document.querySelectorAll('.report-toc-item');
    let activeItem = null;
    
    tocItems.forEach(item => {
        if (item.dataset.target === headingId) {
            item.classList.add('active');
            activeItem = item;
        } else {
            item.classList.remove('active');
        }
    });
    
    // 确保高亮的目录项在可视范围内
    if (activeItem) {
        scrollActiveReportTocIntoView(activeItem);
    }
}

// 初始化周报侧边栏状态（根据屏幕尺寸）
function initReportSidebarState() {
    const sidebar = document.getElementById('reportViewSidebar');
    if (!sidebar) return;
    
    const expandedDiv = sidebar.querySelector('.sidebar-expanded');
    const collapsedDiv = sidebar.querySelector('.sidebar-collapsed');
    
    // 检测屏幕宽度（xl断点是1280px）
    const isXLScreen = window.innerWidth >= 1280;
    
    if (isXLScreen) {
        // 大屏幕（≥1280px）：默认展开
        sidebar.classList.add('expanded');
        if (expandedDiv) expandedDiv.classList.remove('hidden');
        if (collapsedDiv) collapsedDiv.classList.add('hidden');
    } else {
        // 平板及更小尺寸（<1280px）：默认折叠
        sidebar.classList.remove('expanded');
        if (expandedDiv) expandedDiv.classList.add('hidden');
        if (collapsedDiv) collapsedDiv.classList.remove('hidden');
    }
}

// 收起/展开周报目录
function toggleReportSidebar() {
    const sidebar = document.getElementById('reportViewSidebar');
    const expandedDiv = sidebar.querySelector('.sidebar-expanded');
    const collapsedDiv = sidebar.querySelector('.sidebar-collapsed');
    
    if (sidebar.classList.contains('expanded')) {
        // 展开状态 - 收起
        sidebar.classList.remove('expanded');
        
        if (expandedDiv) expandedDiv.classList.add('hidden');
        if (collapsedDiv) collapsedDiv.classList.remove('hidden');
    } else {
        // 收起状态 - 展开
        sidebar.classList.add('expanded');
        
        if (expandedDiv) expandedDiv.classList.remove('hidden');
        if (collapsedDiv) collapsedDiv.classList.add('hidden');
    }
}

// 监听窗口大小变化，自动调整周报侧边栏状态
let reportResizeTimer;
window.addEventListener('resize', () => {
    // 使用防抖，避免频繁触发
    clearTimeout(reportResizeTimer);
    reportResizeTimer = setTimeout(() => {
        // 只有在周报查看模态框打开时才调整
        const modal = document.getElementById('viewReportModal');
        if (modal && modal.classList.contains('active')) {
            initReportSidebarState();
        }
    }, 200);
});