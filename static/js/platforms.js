// ==================== 平台管理相关 ====================

let platformsData = [];
let currentPlatformTags = [];
let currentPlatformThumbnail = '';
let editingPlatformId = null;

// 加载平台列表
async function loadPlatforms() {
    // 显示骨架屏
    showSkeleton('platformsGrid', 'platforms');
    
    try {
        const response = await fetch('/api/platforms');
        const data = await response.json();
        platformsData = data.platforms || [];
        
        renderPlatforms(platformsData);
        updateTagFilter();
    } catch (error) {
        console.error('加载平台失败:', error);
        showToast('加载平台失败', 'error');
    }
}

// 渲染平台卡片（按分类分组）
function renderPlatforms(platforms) {
    const container = document.getElementById('platformsGrid');
    
    if (!platforms || platforms.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center text-gray-500 py-12">
                <i class="fas fa-globe text-4xl mb-4"></i>
                <p>暂无平台数据</p>
                <p class="text-sm mt-2">点击右上角"我要添加"按钮添加第一个平台</p>
            </div>
        `;
        return;
    }
    
    // 定义分类顺序和颜色
    const categories = ['文档知识', '实用工具', '需求相关', '游戏动态'];
    const categoryColors = {
        '文档知识': 'from-blue-50 to-cyan-50 border-blue-200',
        '实用工具': 'from-purple-50 to-pink-50 border-purple-200',
        '需求相关': 'from-green-50 to-teal-50 border-green-200',
        '游戏动态': 'from-orange-50 to-amber-50 border-orange-200'
    };
    
    let html = '';
    
    // 按分类分组
    categories.forEach(category => {
        const categoryPlatforms = platforms.filter(p => p.category === category);
        
        // 按创建时间排序（最早的在前）
        categoryPlatforms.sort((a, b) => {
            const timeA = new Date(a.created_at || 0).getTime();
            const timeB = new Date(b.created_at || 0).getTime();
            return timeA - timeB;
        });
        
        if (categoryPlatforms.length > 0) {
            html += `
                <div class="col-span-full mb-6">
                    <div class="flex items-center mb-4">
                        <h3 class="text-xl font-bold text-gray-900 mr-3">${category}</h3>
                        <div class="flex-1 h-px bg-gray-200"></div>
                        <span class="ml-3 text-sm text-gray-500">${categoryPlatforms.length} 个平台</span>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        ${categoryPlatforms.map(platform => `
                            <div class="bg-white rounded-lg shadow-sm border hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col">
                                <div class="relative h-44 bg-gradient-to-br ${categoryColors[category] || 'from-gray-50 to-gray-100'} flex items-center justify-center overflow-hidden">
                                    ${platform.thumbnail 
                                        ? `<a href="${escapeHtml(platform.url)}" target="_blank" rel="noopener noreferrer"
                                                class="w-full h-full block cursor-pointer">
                                                <img src="${escapeHtml(platform.thumbnail)}" alt="${escapeHtml(platform.name)}" 
                                                class="w-full h-full object-cover hover:opacity-90 transition-opacity">
                                           </a>` 
                                        : `<a href="${escapeHtml(platform.url)}" target="_blank" rel="noopener noreferrer"
                                                class="w-full h-full block cursor-pointer flex items-center justify-center">
                                                <i class="fas fa-globe text-5xl text-purple-300"></i>
                                           </a>`
                                    }
                                    
                                    <div class="absolute top-2 right-2 flex space-x-1">
                                        <button onclick="editPlatform(${platform.id})" 
                                                class="w-8 h-8 bg-white/90 hover:bg-white rounded-full flex items-center justify-center text-gray-600 hover:text-purple-600 shadow-sm transition-all"
                                                title="编辑"
                                                onclick="event.stopPropagation()">
                                            <i class="fas fa-edit text-xs"></i>
                                        </button>
                                        <button onclick="deletePlatform(${platform.id})" 
                                                class="w-8 h-8 bg-white/90 hover:bg-white rounded-full flex items-center justify-center text-gray-600 hover:text-red-600 shadow-sm transition-all"
                                                title="删除"
                                                onclick="event.stopPropagation()">
                                            <i class="fas fa-trash text-xs"></i>
                                        </button>
                                    </div>
                                </div>
                                
                                
                                <div class="p-3 flex-1 flex flex-col">
                                    <h3 class="font-bold text-gray-900 text-base mb-1 line-clamp-2" title="${escapeHtml(platform.name)}">
                                        ${escapeHtml(platform.name)}
                                    </h3>
                                    
                                    <p class="text-gray-600 text-xs mb-2 line-clamp-2 flex-1" title="${escapeHtml(platform.description || '')}">
                                        ${escapeHtml(platform.description || '暂无说明')}
                                    </p>
                                    
                                    <div class="flex flex-wrap gap-1 mb-2">
                                        ${(platform.tags || []).map(tag => `
                                            <span class="inline-block px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                                                ${escapeHtml(tag)}
                                            </span>
                                        `).join('')}
                                    </div>
                                    
                                    ${platform.added_by_eng_name ? `
                                    <div class="pt-2 border-t border-gray-100 flex items-center space-x-2">
                                        <img src="https://r.hrc.woa.com/photo/150/${escapeHtml(platform.added_by_eng_name)}.png?default_when_absent=true" 
                                             alt="${escapeHtml(platform.added_by_chn_name || platform.added_by_eng_name)}" 
                                             class="w-4 h-4 rounded-full">
                                        <span class="text-xs text-gray-500">
                                            ${escapeHtml(platform.added_by_eng_name)}(${escapeHtml(platform.added_by_chn_name || '')})
                                        </span>
                                    </div>
                                    ` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
    });
    
    container.innerHTML = html;
}

// 更新标签筛选器
function updateTagFilter() {
    const tagFilter = document.getElementById('platformTagFilter');
    const allTags = new Set();
    
    platformsData.forEach(platform => {
        if (platform.tags) {
            platform.tags.forEach(tag => allTags.add(tag));
        }
    });
    
    // 保留"全部标签"选项
    tagFilter.innerHTML = '<option value="">全部标签</option>';
    
    // 添加所有标签
    allTags.forEach(tag => {
        tagFilter.innerHTML += `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`;
    });
}

// 筛选平台
function filterPlatforms() {
    const search = document.getElementById('platformSearch').value.toLowerCase();
    const tagFilter = document.getElementById('platformTagFilter').value;
    
    const filtered = platformsData.filter(platform => {
        const matchSearch = !search || 
            platform.name.toLowerCase().includes(search) ||
            (platform.description && platform.description.toLowerCase().includes(search));
        
        const matchTag = !tagFilter || 
            (platform.tags && platform.tags.includes(tagFilter));
        
        return matchSearch && matchTag;
    });
    
    renderPlatforms(filtered);
}

// 打开添加平台模态框
function openPlatformModal() {
    editingPlatformId = null;
    document.getElementById('platformModalTitle').textContent = '添加平台';
    document.getElementById('platformForm').reset();
    document.getElementById('platformCategory').value = '实用工具';
    currentPlatformTags = [];
    currentPlatformThumbnail = '';
    renderPlatformTags();
    resetPlatformThumbnailPreview();
    openModal('platformModal');
    
    // 绑定拖拽和粘贴事件
    setupPlatformThumbnailDragAndPaste();
}

// 编辑平台
function editPlatform(id) {
    const platform = platformsData.find(p => p.id === id);
    if (!platform) {
        showToast('平台不存在', 'error');
        return;
    }
    
    editingPlatformId = id;
    document.getElementById('platformModalTitle').textContent = '编辑平台';
    document.getElementById('platformName').value = platform.name;
    document.getElementById('platformCategory').value = platform.category || '实用工具';
    document.getElementById('platformUrl').value = platform.url;
    document.getElementById('platformDescription').value = platform.description || '';
    currentPlatformTags = [...(platform.tags || [])];
    currentPlatformThumbnail = platform.thumbnail || '';
    renderPlatformTags();
    
    // 显示缩略图预览
    if (currentPlatformThumbnail) {
        document.getElementById('platformThumbnailImg').src = currentPlatformThumbnail;
        document.getElementById('platformThumbnailPreview').classList.remove('hidden');
        document.getElementById('platformThumbnailPlaceholder').classList.add('hidden');
    } else {
        resetPlatformThumbnailPreview();
    }
    
    openModal('platformModal');
    
    // 绑定拖拽和粘贴事件
    setupPlatformThumbnailDragAndPaste();
}

// 删除平台
async function deletePlatform(id) {
    if (!confirm('确认删除该平台？删除后将无法恢复。')) return;
    
    showLoading();
    try {
        const response = await fetch(`/api/platforms/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showToast('删除成功', 'success');
            await loadPlatforms();
        } else {
            throw new Error('删除失败');
        }
    } catch (error) {
        console.error('删除平台失败:', error);
        showToast('删除失败', 'error');
    } finally {
        hideLoading();
    }
}

// 处理平台表单提交
async function handlePlatformSubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById('platformName').value;
    const category = document.getElementById('platformCategory').value;
    const url = document.getElementById('platformUrl').value;
    const description = document.getElementById('platformDescription').value;
    
    // 验证缩略图是否已上传
    if (!currentPlatformThumbnail) {
        showToast('请上传缩略图', 'error');
        return;
    }
    
    showLoading();
    try {
        const data = {
            name,
            category,
            url,
            description,
            thumbnail: currentPlatformThumbnail,
            tags: currentPlatformTags,
            added_by_eng_name: currentUser.EngName,
            added_by_chn_name: currentUser.ChnName
        };
        
        let response;
        if (editingPlatformId) {
            // 更新
            response = await fetch(`/api/platforms/${editingPlatformId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else {
            // 创建
            response = await fetch('/api/platforms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }
        
        if (response.ok) {
            showToast(editingPlatformId ? '更新成功' : '添加成功', 'success');
            closeModal('platformModal');
            await loadPlatforms();
        } else {
            throw new Error(editingPlatformId ? '更新失败' : '添加失败');
        }
    } catch (error) {
        console.error('保存平台失败:', error);
        showToast('保存失败', 'error');
    } finally {
        hideLoading();
    }
}

// 处理缩略图上传
async function handlePlatformThumbnailUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
    if (!allowedTypes.includes(file.type)) {
        showToast('不支持的图片格式，请上传jpg、png、gif、webp或bmp格式的图片', 'error');
        event.target.value = '';
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
        showToast('图片大小不能超过5MB', 'error');
        event.target.value = '';
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
        currentPlatformThumbnail = data.url;
        
        // 显示预览
        document.getElementById('platformThumbnailImg').src = currentPlatformThumbnail;
        document.getElementById('platformThumbnailPreview').classList.remove('hidden');
        document.getElementById('platformThumbnailPlaceholder').classList.add('hidden');
        
        showToast('图片上传成功', 'success');
    } catch (error) {
        console.error('图片上传失败:', error);
        showToast(error.message || '图片上传失败', 'error');
    } finally {
        hideLoading();
        event.target.value = '';
    }
}

// 设置缩略图区域的拖拽和粘贴事件
function setupPlatformThumbnailDragAndPaste() {
    const thumbnailArea = document.getElementById('platformThumbnailArea');
    
    // 拖拽事件
    thumbnailArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        thumbnailArea.classList.add('border-purple-500', 'bg-purple-50');
    });
    
    thumbnailArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        thumbnailArea.classList.remove('border-purple-500', 'bg-purple-50');
    });
    
    thumbnailArea.addEventListener('drop', (e) => {
        e.preventDefault();
        thumbnailArea.classList.remove('border-purple-500', 'bg-purple-50');
        
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('image/')) {
                handleFileUpload(file);
            } else {
                showToast('请拖拽图片文件', 'error');
            }
        }
    });
    
    // 粘贴事件
    thumbnailArea.addEventListener('paste', (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        
        for (const item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) {
                    handleFileUpload(file);
                }
                break;
            }
        }
    });
}

// 处理文件上传
async function handleFileUpload(file) {
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
        currentPlatformThumbnail = data.url;
        
        // 显示预览
        document.getElementById('platformThumbnailImg').src = currentPlatformThumbnail;
        document.getElementById('platformThumbnailPreview').classList.remove('hidden');
        document.getElementById('platformThumbnailPlaceholder').classList.add('hidden');
        
        showToast('图片上传成功', 'success');
    } catch (error) {
        console.error('图片上传失败:', error);
        showToast(error.message || '图片上传失败', 'error');
    } finally {
        hideLoading();
    }
}

// 重置缩略图预览
function resetPlatformThumbnailPreview() {
    currentPlatformThumbnail = '';
    document.getElementById('platformThumbnailImg').src = '';
    document.getElementById('platformThumbnailPreview').classList.add('hidden');
    document.getElementById('platformThumbnailPlaceholder').classList.remove('hidden');
}

// 删除缩略图
function removePlatformThumbnail() {
    resetPlatformThumbnailPreview();
    showToast('已删除缩略图', 'success');
}

// 添加标签
function addPlatformTag() {
    const input = document.getElementById('platformTagInput');
    const tag = input.value.trim();
    
    if (!tag) return;
    
    if (currentPlatformTags.includes(tag)) {
        showToast('标签已存在', 'error');
        return;
    }
    
    currentPlatformTags.push(tag);
    renderPlatformTags();
    input.value = '';
}

// 删除标签
function removePlatformTag(tag) {
    currentPlatformTags = currentPlatformTags.filter(t => t !== tag);
    renderPlatformTags();
}

// 渲染标签
function renderPlatformTags() {
    const container = document.getElementById('platformTagsContainer');
    
    if (currentPlatformTags.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-sm">暂无标签</p>';
        return;
    }
    
    container.innerHTML = currentPlatformTags.map(tag => `
        <span class="inline-flex items-center px-3 py-1 bg-purple-100 text-purple-700 text-sm rounded-full">
            ${escapeHtml(tag)}
            <button type="button" onclick="removePlatformTag('${escapeHtml(tag)}')" 
                    class="ml-2 text-purple-500 hover:text-purple-700">
                <i class="fas fa-times"></i>
            </button>
        </span>
    `).join('');
}

// 处理标签输入框的回车事件
document.addEventListener('DOMContentLoaded', () => {
    const tagInput = document.getElementById('platformTagInput');
    if (tagInput) {
        tagInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addPlatformTag();
            }
        });
    }
    
    // 绑定表单提交
    const platformForm = document.getElementById('platformForm');
    if (platformForm) {
        platformForm.addEventListener('submit', handlePlatformSubmit);
    }
    
    // 绑定添加按钮
    const addPlatformBtn = document.getElementById('addPlatformBtn');
    if (addPlatformBtn) {
        addPlatformBtn.addEventListener('click', openPlatformModal);
    }
});