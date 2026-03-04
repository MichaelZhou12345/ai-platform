// ==================== 工具函数 ====================

// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 模态框控制
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        // 检查是否在演讲者模式下
        const isPresenterMode = document.body.classList.contains('presenter-mode');
        if (isPresenterMode) {
            // 在演讲者模式下，提高弹窗的z-index以确保显示在覆盖层上方
            modal.style.zIndex = '10000';
        }
        modal.classList.add('active');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        // 恢复原始的z-index
        modal.style.zIndex = '';
        
        // 如果关闭的是查看周报模态框，重新显示AI悬浮按钮并销毁编辑器
        if (modalId === 'viewReportModal') {
            const aiFab = document.getElementById('ai-fab');
            if (aiFab) aiFab.style.display = '';
            
            // 同时关闭链接预览面板
            closeLinkPreviewPanel();
            
            // 销毁查看模式的Cherry编辑器实例
            if (typeof viewReportCherryEditor !== 'undefined' && viewReportCherryEditor) {
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
            
            // 清理周报目录的滚动监听观察者
            if (typeof reportHeadingObservers !== 'undefined' && reportHeadingObservers) {
                reportHeadingObservers.forEach(observer => observer.disconnect());
                reportHeadingObservers = [];
            }
            
            // 清理可见标题集合
            if (typeof reportVisibleHeadings !== 'undefined' && reportVisibleHeadings) {
                reportVisibleHeadings.clear();
            }
        }
    }
}

// 加载提示
function showLoading() {
    const loading = document.getElementById('loadingOverlay');
    if (loading) {
        loading.classList.add('active');
    }
}

function hideLoading() {
    const loading = document.getElementById('loadingOverlay');
    if (loading) {
        loading.classList.remove('active');
    }
}

// 消息提示
function showToast(message, type = 'info') {
    const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        info: 'style="background-color: var(--primary-color);"'
    };
    
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 text-white px-6 py-3 rounded-lg shadow-lg transition-opacity`;
    toast.style.zIndex = '10020';  // 高于演讲者模式(9999)和模态框(10010)
    if (type === 'info') {
        toast.style.backgroundColor = '#0052D9';
    } else {
        toast.className += ` ${colors[type]}`;
    }
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// HTML转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 骨架屏相关函数
function showSkeleton(containerId, type = 'list') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    let skeletonHTML = '';
    
    switch(type) {
        case 'reports': // 团队周报骨架屏
            skeletonHTML = `
                <div class="bg-white rounded-lg shadow-sm border overflow-hidden">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left"><div class="skeleton skeleton-text" style="width: 60px;"></div></th>
                                <th class="px-6 py-3 text-left"><div class="skeleton skeleton-text" style="width: 80px;"></div></th>
                                <th class="px-6 py-3 text-left"><div class="skeleton skeleton-text" style="width: 100px;"></div></th>
                                <th class="px-6 py-3 text-right"><div class="skeleton skeleton-text" style="width: 60px; margin-left: auto;"></div></th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            ${Array(3).fill(0).map(() => `
                                <tr>
                                    <td class="px-6 py-4"><div class="skeleton skeleton-text" style="width: 200px;"></div></td>
                                    <td class="px-6 py-4"><div class="skeleton skeleton-text" style="width: 100px;"></div></td>
                                    <td class="px-6 py-4"><div class="skeleton skeleton-text" style="width: 150px;"></div></td>
                                    <td class="px-6 py-4 text-right">
                                        <div class="flex justify-end space-x-2">
                                            <div class="skeleton" style="width: 60px; height: 32px;"></div>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            break;
            
        case 'personal-okr': // 知彼解己骨架屏
            skeletonHTML = Array(2).fill(0).map(() => `
                <div class="bg-white rounded-lg shadow-sm border p-6 objective-item">
                    <div class="flex justify-between items-start mb-4">
                        <div class="flex items-start flex-1">
                            <i class="fas fa-grip-vertical drag-handle text-gray-400 mr-3 mt-1"></i>
                            <div class="flex-1">
                                <div class="flex items-center space-x-2 mb-2">
                                    <div class="skeleton skeleton-text" style="width: 75%;"></div>
                                </div>
                            </div>
                        </div>
                        <div class="ml-4 flex space-x-2">
                            <div class="skeleton" style="width: 24px; height: 24px;"></div>
                        </div>
                    </div>
                    
                    <div class="space-y-4 kr-list">
                        ${Array(3).fill(0).map(() => `
                            <div class="bg-gray-50 rounded-lg p-4 border border-gray-200 kr-item">
                                <div class="flex justify-between items-start mb-3">
                                    <div class="flex items-start flex-1">
                                        <i class="fas fa-grip-vertical drag-handle text-gray-400 mr-3 mt-1"></i>
                                        <div class="flex-1">
                                            <div class="flex items-center space-x-2 mb-1">
                                                <div class="skeleton skeleton-text" style="width: 78%;"></div>
                                            </div>
                                            <div class="skeleton skeleton-text" style="width: 55%; margin-top: 8px;"></div>
                                        </div>
                                    </div>
                                    <div class="ml-4 flex space-x-2">
                                        <div class="skeleton" style="width: 24px; height: 24px;"></div>
                                    </div>
                                </div>
                                
                                <div class="mb-4 ml-9">
                                    <div class="flex justify-between items-center mb-2">
                                        <div class="skeleton skeleton-text" style="width: 60px; height: 18px;"></div>
                                        <div class="skeleton" style="width: 80px; height: 24px;"></div>
                                    </div>
                                    <div class="skeleton" style="width: 100%; height: 80px;"></div>
                                </div>
                                
                                <div class="mb-4 ml-9">
                                    <div class="flex justify-between items-center mb-2">
                                        <div class="skeleton skeleton-text" style="width: 80px; height: 18px;"></div>
                                        <div class="skeleton" style="width: 24px; height: 24px;"></div>
                                    </div>
                                </div>
                                
                                <div class="mb-4 ml-9">
                                    <div class="flex justify-between items-center mb-2">
                                        <div class="skeleton skeleton-text" style="width: 70px; height: 18px;"></div>
                                        <div class="skeleton" style="width: 24px; height: 24px;"></div>
                                    </div>
                                </div>
                                
                                <div class="ml-9">
                                    <div class="flex justify-between items-center mb-2">
                                        <div class="skeleton skeleton-text" style="width: 65px; height: 18px;"></div>
                                        <div class="flex space-x-2">
                                            <div class="skeleton" style="width: 70px; height: 28px;"></div>
                                            <div class="skeleton" style="width: 60px; height: 28px;"></div>
                                        </div>
                                    </div>
                                    <div class="skeleton" style="width: 100%; height: 100px;"></div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('');
            break;
            
        case 'next-week': // 以终为始骨架屏
            skeletonHTML = `
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    ${Array(8).fill(0).map(() => `
                        <div class="skeleton-card">
                            <div class="flex items-center mb-4">
                                <div class="skeleton skeleton-avatar mr-3"></div>
                                <div class="flex-1">
                                    <div class="skeleton skeleton-text" style="width: 80%;"></div>
                                </div>
                            </div>
                            <div class="skeleton skeleton-text" style="width: 100%;"></div>
                            <div class="skeleton skeleton-text" style="width: 90%;"></div>
                            <div class="skeleton skeleton-text" style="width: 70%;"></div>
                        </div>
                    `).join('')}
                </div>
            `;
            break;
            
        case 'ideas': // 集思广益骨架屏
            skeletonHTML = Array(6).fill(0).map(() => `
                <div class="bg-yellow-50 rounded-xl shadow-sm border border-yellow-200 p-6 flex flex-col transition-transform hover:-translate-y-1 hover:shadow-md relative group break-inside-avoid mb-6">
                    <div class="flex-1 mb-4">
                        <div class="skeleton skeleton-text" style="width: 90%;"></div>
                        <div class="skeleton skeleton-text" style="width: 75%; margin-top: 8px;"></div>
                        <div class="skeleton skeleton-text" style="width: 60%; margin-top: 8px;"></div>
                    </div>
                    <div class="flex justify-between items-center pt-4 border-t border-yellow-100">
                        <span class="skeleton" style="height: 12px; width: 60px;"></span>
                    </div>
                </div>
            `).join('');
            break;
            
        case 'platforms': // 统合综效骨架屏
            // 分类1骨架
            skeletonHTML = `
                <div class="col-span-full mb-6">
                    <div class="flex items-center mb-4">
                        <div class="skeleton" style="height: 28px; width: 80px; margin-right: 12px;"></div>
                        <div class="flex-1 h-px bg-gray-200"></div>
                        <div class="skeleton" style="height: 16px; width: 50px; margin-left: 12px;"></div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        ${Array(3).fill(0).map(() => `
                            <div class="bg-white rounded-lg shadow-sm border hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col">
                                <div class="relative h-44 bg-gradient-to-br from-blue-50 to-cyan-50 border-b border-blue-200 flex items-center justify-center overflow-hidden">
                                    <div class="skeleton" style="width: 80px; height: 80px; border-radius: 50%;"></div>
                                    <div class="absolute top-2 right-2 flex space-x-1">
                                        <div class="skeleton" style="width: 32px; height: 32px; border-radius: 50%;"></div>
                                        <div class="skeleton" style="width: 32px; height: 32px; border-radius: 50%;"></div>
                                    </div>
                                </div>
                                <div class="p-3 flex-1 flex flex-col">
                                    <div class="skeleton skeleton-title" style="width: 70%;"></div>
                                    <div class="skeleton skeleton-text" style="width: 100%; margin-top: 8px;"></div>
                                    <div class="skeleton skeleton-text" style="width: 85%;"></div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="col-span-full mb-6">
                    <div class="flex items-center mb-4">
                        <div class="skeleton" style="height: 28px; width: 80px; margin-right: 12px;"></div>
                        <div class="flex-1 h-px bg-gray-200"></div>
                        <div class="skeleton" style="height: 16px; width: 50px; margin-left: 12px;"></div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        ${Array(3).fill(0).map(() => `
                            <div class="bg-white rounded-lg shadow-sm border hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col">
                                <div class="relative h-44 bg-gradient-to-br from-purple-50 to-pink-50 border-b border-purple-200 flex items-center justify-center overflow-hidden">
                                    <div class="skeleton" style="width: 80px; height: 80px; border-radius: 50%;"></div>
                                    <div class="absolute top-2 right-2 flex space-x-1">
                                        <div class="skeleton" style="width: 32px; height: 32px; border-radius: 50%;"></div>
                                        <div class="skeleton" style="width: 32px; height: 32px; border-radius: 50%;"></div>
                                    </div>
                                </div>
                                <div class="p-3 flex-1 flex flex-col">
                                    <div class="skeleton skeleton-title" style="width: 70%;"></div>
                                    <div class="skeleton skeleton-text" style="width: 100%; margin-top: 8px;"></div>
                                    <div class="skeleton skeleton-text" style="width: 85%;"></div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="col-span-full mb-6">
                    <div class="flex items-center mb-4">
                        <div class="skeleton" style="height: 28px; width: 80px; margin-right: 12px;"></div>
                        <div class="flex-1 h-px bg-gray-200"></div>
                        <div class="skeleton" style="height: 16px; width: 50px; margin-left: 12px;"></div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        ${Array(2).fill(0).map(() => `
                            <div class="bg-white rounded-lg shadow-sm border hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col">
                                <div class="relative h-44 bg-gradient-to-br from-green-50 to-teal-50 border-b border-green-200 flex items-center justify-center overflow-hidden">
                                    <div class="skeleton" style="width: 80px; height: 80px; border-radius: 50%;"></div>
                                    <div class="absolute top-2 right-2 flex space-x-1">
                                        <div class="skeleton" style="width: 32px; height: 32px; border-radius: 50%;"></div>
                                        <div class="skeleton" style="width: 32px; height: 32px; border-radius: 50%;"></div>
                                    </div>
                                </div>
                                <div class="p-3 flex-1 flex flex-col">
                                    <div class="skeleton skeleton-title" style="width: 70%;"></div>
                                    <div class="skeleton skeleton-text" style="width: 100%; margin-top: 8px;"></div>
                                    <div class="skeleton skeleton-text" style="width: 85%;"></div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            break;
            
        default: // 默认列表骨架屏
            skeletonHTML = Array(3).fill(0).map(() => `
                <div class="skeleton-card">
                    <div class="skeleton skeleton-title"></div>
                    <div class="skeleton skeleton-text"></div>
                    <div class="skeleton skeleton-text" style="width: 80%;"></div>
                </div>
            `).join('');
    }
    
    container.innerHTML = skeletonHTML;
}

function hideSkeleton(containerId) {
    // 骨架屏会在实际内容渲染时被替换，这里不需要额外操作
    // 此函数保留用于未来可能的扩展
}

// 日期格式化
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
    
    return date.toLocaleDateString('zh-CN');
}

// 打开团队KR历史周进展模态框
async function openTeamKRHistory(userKRId, userName) {
    showLoading();
    try {
        const response = await fetch(`/api/progress/weekly/${userKRId}`);
        if (!response.ok) {
            throw new Error('加载历史周进展失败');
        }
        const data = await response.json();
        
        // 只显示历史进展，跳过第一条（当周进展）
        const historyProgress = data.progress ? data.progress.slice(1) : [];
        
        let historyHtml = '';
        if (historyProgress.length > 0) {
            historyHtml = historyProgress.map(p => `
                <div class="bg-gray-50 p-4 rounded border mb-3">
                    <div class="flex justify-between items-center mb-2">
                        <div class="flex items-center space-x-2">
                            <img src="https://r.hrc.woa.com/photo/150/${p.user_eng_name || currentUser.EngName}.png?default_when_absent=true" 
                                 alt="${p.user_chn_name}" 
                                 class="w-5 h-5 rounded-full">
                            <span class="text-sm text-gray-600">
                                ${escapeHtml(p.user_eng_name || currentUser.EngName)}(${escapeHtml(p.user_chn_name)})
                            </span>
                        </div>
                        <span class="text-xs text-gray-400">${formatDate(p.created_at)}</span>
                    </div>
                    <div class="markdown-content" onclick="handleImageClick(event)">
                        ${marked.parse(p.content)}
                    </div>
                </div>
            `).join('');
        } else {
            historyHtml = '<div class="text-center text-gray-500 py-8">暂无历史周进展</div>';
        }
        
        // 创建或更新历史模态框
        let historyModal = document.getElementById('teamKRHistoryModal');
        if (!historyModal) {
            historyModal = document.createElement('div');
            historyModal.id = 'teamKRHistoryModal';
            historyModal.className = 'modal';
            historyModal.innerHTML = `
                <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-3xl mx-4 max-h-[80vh] overflow-y-auto">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-xl font-bold">历史周进展</h3>
                        <button onclick="closeModal('teamKRHistoryModal')" class="text-gray-500 hover:text-gray-700">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    <div class="text-sm text-gray-600 mb-3">用户：${userName}</div>
                    <div id="teamKRHistoryContent"></div>
                </div>
            `;
            document.body.appendChild(historyModal);
        }
        
        document.getElementById('teamKRHistoryContent').innerHTML = historyHtml;
        openModal('teamKRHistoryModal');
    } catch (error) {
        console.error('加载历史周进展失败:', error);
        showToast('加载历史周进展失败', 'error');
    } finally {
        hideLoading();
    }
}

// 风险和问题相关函数
async function showRisksInput(krId) {
    const inputContainer = document.getElementById(`risks-input-container-${krId}`);
    const display = document.getElementById(`risks-display-${krId}`);
    const textarea = document.getElementById(`risks-${krId}`);
    const actions = document.getElementById(`risks-actions-${krId}`);
    
    if (inputContainer) {
        inputContainer.classList.remove('hidden');
    }
    
    if (display) {
        display.classList.add('hidden');
    }
    
    const addBtn = document.getElementById(`risks-add-btn-${krId}`);
    if (addBtn) {
        addBtn.classList.add('hidden');
    }
    
    try {
        const krDataResponse = await fetch(`/api/user/objectives?user_eng_name=${currentUser.EngName}`);
        if (krDataResponse.ok) {
            const krData = await krDataResponse.json();
            let currentKR = null;
            krData.objectives.forEach(obj => {
                if (obj.key_results) {
                    const found = obj.key_results.find(k => k.id === krId);
                    if (found) currentKR = found;
                }
            });
            
            if (currentKR && currentKR.risks_issues && textarea) {
                textarea.value = currentKR.risks_issues;
            }
        }
    } catch (error) {
        console.error('获取风险和问题失败:', error);
    }
    
    if (textarea) {
        textarea.focus();
    }
}

function cancelRisksInput(krId) {
    const inputContainer = document.getElementById(`risks-input-container-${krId}`);
    const display = document.getElementById(`risks-display-${krId}`);
    const textarea = document.getElementById(`risks-${krId}`);
    const actions = document.getElementById(`risks-actions-${krId}`);
    
    if (textarea) {
        textarea.value = '';
    }
    
    const hasContent = display && !display.classList.contains('hidden');
    
    if (hasContent || (display && display.innerHTML.trim() !== '')) {
        if (inputContainer) {
            inputContainer.classList.add('hidden');
        }
        if (display) {
            display.classList.remove('hidden');
        }
        
        if (actions) {
            actions.innerHTML = `
                <button onclick="showRisksInput(${krId})" 
                        class="text-sm"
                        style="color: var(--primary-color);"
                        onmouseover="this.style.color='var(--primary-hover)'"
                        onmouseout="this.style.color='var(--primary-color)'">
                    <i class="fas fa-edit mr-1"></i>更新问题和风险
                </button>
            `;
        }
    } else {
        if (inputContainer) {
            inputContainer.classList.add('hidden');
        }
        
        if (actions) {
            actions.innerHTML = `
                <button id="risks-add-btn-${krId}"
                        onclick="showRisksInput(${krId})"
                        class="text-sm"
                        style="color: var(--primary-color);"
                        onmouseover="this.style.color='var(--primary-hover)'"
                        onmouseout="this.style.color='var(--primary-color)'">
                    <i class="fas fa-plus mr-1"></i>填写风险和问题
                </button>
            `;
        }
    }
}

async function saveRisksIssues(krId) {
    const textarea = document.getElementById(`risks-${krId}`);
    const content = textarea.value.trim();
    
    showLoading();
    try {
        const response = await fetch(`/api/user/key-results/${krId}?user_eng_name=${currentUser.EngName}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ risks_issues: content })
        });
        
        if (response.ok) {
            showToast('保存成功', 'success');
            await loadKRProgress(krId);
        } else {
            throw new Error('保存失败');
        }
    } catch (error) {
        console.error('保存风险和问题失败:', error);
        showToast('保存失败', 'error');
    } finally {
        hideLoading();
    }
}

// ==================== 下周计划相关 ====================
async function showNextWeekInput(krId) {
    const inputContainer = document.getElementById(`next-week-input-container-${krId}`);
    const display = document.getElementById(`next-week-display-${krId}`);
    const manDaysInput = document.getElementById(`next-week-man-days-${krId}`);
    const actions = document.getElementById(`next-week-actions-${krId}`);
    
    if (inputContainer) {
        inputContainer.classList.remove('hidden');
    }
    
    if (display) {
        display.classList.add('hidden');
    }
    
    const addBtn = document.getElementById(`next-week-add-btn-${krId}`);
    if (addBtn) {
        addBtn.classList.add('hidden');
    }
    
    // 获取下周计划内容作为默认值
    let defaultValue = '';
    let defaultManDays = 0;
    try {
        const nextWeekResponse = await fetch(`/api/progress/next-week-plan/${krId}?user_eng_name=${currentUser.EngName}`);
        if (nextWeekResponse.ok) {
            const nextWeekData = await nextWeekResponse.json();
            
            if (nextWeekData && nextWeekData.content) {
                defaultValue = nextWeekData.content;
            }
            
            if (nextWeekData && manDaysInput) {
                defaultManDays = nextWeekData.estimated_man_days || 0;
                manDaysInput.value = defaultManDays;
            }
        }
    } catch (error) {
        console.error('获取下周计划失败:', error);
    }
    
    // 延迟初始化编辑器，确保容器已显示
    setTimeout(() => {
        if (typeof initNextWeekEditor === 'function') {
            initNextWeekEditor(krId, defaultValue);
        }
    }, 100);
}

function cancelNextWeekInput(krId) {
    const inputContainer = document.getElementById(`next-week-input-container-${krId}`);
    const display = document.getElementById(`next-week-display-${krId}`);
    const manDaysInput = document.getElementById(`next-week-man-days-${krId}`);
    const actions = document.getElementById(`next-week-actions-${krId}`);
    
    // 销毁编辑器
    const editorId = `next-week-editor-${krId}`;
    if (typeof destroyPersonalEditor === 'function') {
        destroyPersonalEditor(editorId);
    }
    
    if (manDaysInput) {
        manDaysInput.value = '';
    }
    
    const hasContent = display && !display.classList.contains('hidden');
    
    if (hasContent || (display && display.innerHTML.trim() !== '')) {
        if (inputContainer) {
            inputContainer.classList.add('hidden');
        }
        if (display) {
            display.classList.remove('hidden');
        }
        
        if (actions) {
            actions.innerHTML = `
                <button onclick="showNextWeekInput(${krId})" 
                        class="text-sm"
                        style="color: var(--primary-color);"
                        onmouseover="this.style.color='var(--primary-hover)'"
                        onmouseout="this.style.color='var(--primary-color)'"
                    >
                    <i class="fas fa-edit mr-1"></i>更新下周计划
                </button>
            `;
        }
    } else {
        if (inputContainer) {
            inputContainer.classList.add('hidden');
        }
        
        if (actions) {
            actions.innerHTML = `
                <button id="next-week-add-btn-${krId}"
                        onclick="showNextWeekInput(${krId})"
                        class="text-sm"
                        style="color: var(--primary-color);"
                        onmouseover="this.style.color='var(--primary-hover)'"
                        onmouseout="this.style.color='var(--primary-color)'"
                    >
                    <i class="fas fa-plus mr-1"></i>填写下周计划
                </button>
            `;
        }
    }
}

async function saveNextWeekPlan(krId) {
    // 从 Cherry 编辑器获取内容
    const editorId = `next-week-editor-${krId}`;
    const content = getPersonalEditorValue(editorId).trim();
    
    const manDaysInput = document.getElementById(`next-week-man-days-${krId}`);
    const manDays = manDaysInput ? parseFloat(manDaysInput.value) : 0;
    
    if (!content) {
        showToast('请输入下周计划内容', 'error');
        return;
    }
    
    // 验证预计占用人天
    if (isNaN(manDays) || manDaysInput.value === '') {
        showToast('请输入预计本周占用人天', 'error');
        if (manDaysInput) {
            manDaysInput.focus();
        }
        return;
    }
    
    if (manDays < 0) {
        showToast('预计占用人天不能为负数', 'error');
        if (manDaysInput) {
            manDaysInput.focus();
        }
        return;
    }
    
    showLoading();
    try {
        const response = await fetch('/api/progress/next-week-plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_kr_id: krId,
                content: content,
                user_eng_name: currentUser.EngName,
                user_chn_name: currentUser.ChnName,
                estimated_man_days: manDays
            })
        });
        
        if (response.ok) {
            showToast('保存成功', 'success');
            // 清空编辑器并销毁
            destroyPersonalEditor(editorId);
            await loadKRProgress(krId);
        } else {
            throw new Error('保存失败');
        }
    } catch (error) {
        console.error('保存下周计划失败:', error);
        showToast('保存失败', 'error');
    } finally {
        hideLoading();
    }
}

// 显示下周计划弹窗（从饼图点击）
function showNextWeekPlanModal(data) {
    const modalId = 'nextWeekPlanModal';
    
    // 创建或更新模态框
    let modal = document.getElementById(modalId);
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-3xl mx-4 max-h-[80vh] overflow-y-auto">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-bold text-gray-900">下周计划详情</h3>
                    <button onclick="closeModal('${modalId}')" class="text-gray-500 hover:text-gray-700">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                <div id="nextWeekPlanContent"></div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    // 计算总人天数
    const totalManDays = data.nextWeekContents.reduce((sum, item) => sum + (item.estimatedManDays || 0), 0);
    
    // 填充内容
    const contentDiv = document.getElementById('nextWeekPlanContent');
    contentDiv.innerHTML = `
        <div class="space-y-4">
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div class="text-sm text-gray-600 mb-1">关键结果（KR）</div>
                <div class="text-base font-medium text-gray-900">${escapeHtml(data.krTitle || '')}</div>
            </div>
            
            <div class="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div class="flex items-center justify-between mb-2">
                    <div class="text-sm text-gray-600">
                        <i class="fas fa-clock mr-1"></i>预计本周总占用人天
                    </div>
                    <div class="text-2xl font-bold text-purple-600">${totalManDays.toFixed(1)}</div>
                </div>
                <div class="text-xs text-gray-500">天</div>
            </div>
            
            <div class="space-y-4">
                ${data.nextWeekContents.map((item, index) => `
                    <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <div class="text-sm text-gray-600 mb-2">下周计划内容：</div>
                        <div class="text-base text-gray-800 markdown-content" onclick="handleImageClick(event)">
                            ${marked.parse(item.content || '')}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    openModal(modalId);
}

// 复制文本到剪贴板
async function copyToClipboard(text, successMessage = '复制成功') {
    // 优先使用 execCommand 降级方案，因为在 iframe 中 Clipboard API 可能被阻止
    const fallbackCopy = () => {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            
            if (successful) {
                showToast(successMessage, 'success');
                return true;
            } else {
                throw new Error('execCommand 返回 false');
            }
        } catch (err) {
            document.body.removeChild(textArea);
            throw err;
        }
    };
    
    try {
        // 先尝试使用现代 Clipboard API
        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                showToast(successMessage, 'success');
                return;
            } catch (clipboardError) {
                // 如果是权限错误（如在 iframe 中），使用降级方案
                console.log('Clipboard API 被阻止，使用降级方案:', clipboardError.message);
                fallbackCopy();
                return;
            }
        } else {
            // 浏览器不支持 Clipboard API，直接使用降级方案
            fallbackCopy();
        }
    } catch (error) {
        console.error('复制失败:', error);
        showToast('复制失败，请手动复制', 'error');
    }
}