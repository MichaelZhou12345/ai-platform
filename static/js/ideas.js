// ==================== 想法收集相关 ====================

// 缓存成员列表（想法模块专用）
let ideasMembersCache = null;

// 加载所有认领OKR的成员列表
async function loadMembers() {
    // 优先使用 todos.js 中的缓存
    if (typeof todosMembersCache !== 'undefined' && todosMembersCache) {
        return todosMembersCache;
    }
    
    // 使用想法模块的缓存
    if (ideasMembersCache) {
        return ideasMembersCache;
    }
    
    try {
        const response = await fetch('/api/team/kr-claims');
        if (!response.ok) {
            throw new Error('加载成员列表失败');
        }
        const data = await response.json();
        
        // 从认领记录中提取唯一的成员列表
        const membersMap = new Map();
        if (data.claims && Array.isArray(data.claims)) {
            data.claims.forEach(claim => {
                if (claim.user_eng_name && claim.user_chn_name) {
                    membersMap.set(claim.user_eng_name, {
                        eng_name: claim.user_eng_name,
                        chn_name: claim.user_chn_name
                    });
                }
            });
        }
        
        // 转换为数组并按英文名排序
        ideasMembersCache = Array.from(membersMap.values()).sort((a, b) => 
            a.eng_name.localeCompare(b.eng_name)
        );
        
        return ideasMembersCache;
    } catch (error) {
        console.error('加载成员列表失败:', error);
        return [];
    }
}

async function loadIdeas() {
    // 显示骨架屏
    showSkeleton('ideasList', 'ideas');
    
    try {
        // Fetch todos with status='idea'
        const response = await fetch('/api/todos?status=idea&sort_by=created_at&sort_order=desc');
        const data = await response.json();
        renderIdeas(data.todos);
    } catch (error) {
        console.error('加载想法失败:', error);
        showToast('加载想法失败', 'error');
    }
}

function renderIdeas(ideas) {
    const container = document.getElementById('ideasList');
    
    if (!ideas || ideas.length === 0) {
        container.innerHTML = '<div class="col-span-full text-center text-gray-500 py-12">暂无想法，快去记录一个吧！</div>';
        return;
    }
    
    container.innerHTML = ideas.map(idea => {
        return `
        <div class="bg-yellow-50 rounded-xl shadow-sm border border-yellow-200 p-6 flex flex-col transition-transform hover:-translate-y-1 hover:shadow-md relative group break-inside-avoid">
            <div class="flex-1 mb-4">
                <div class="text-gray-800 whitespace-pre-wrap markdown-content">${marked.parse(idea.description || '无内容')}</div>
            </div>
            
            <div class="flex justify-between items-center pt-4 border-t border-yellow-100">
                <span class="text-xs text-gray-400">${formatDate(idea.created_at)}</span>
                <div class="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onclick="openEditIdeaModal(${idea.id})" 
                            class="text-xs px-2 py-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition-colors"
                            title="编辑">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="openConvertIdeaModal(event, ${idea.id})" 
                            data-idea-description="${escapeHtml(idea.description || '')}"
                            class="text-xs px-2 py-1 bg-yellow-200 text-yellow-800 rounded hover:bg-yellow-300 transition-colors"
                            title="转为待办">
                        <i class="fas fa-check-circle mr-1"></i>转待办
                    </button>
                    <button onclick="deleteIdea(${idea.id})" 
                            class="text-xs px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200 transition-colors"
                            title="删除">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        
        </div>
    `}).join('');
    
    // 为所有想法卡片中的图片添加点击放大事件
    const allImages = container.querySelectorAll('.markdown-content img');
    allImages.forEach(img => {
        img.style.cursor = 'pointer';
        img.addEventListener('click', function(e) {
            e.stopPropagation();
            openImageModal(this.src);
        });
    });
}

async function submitQuickIdea() {
    const input = document.getElementById('quickIdeaInput');
    const content = input.value.trim();
    
    if (!content) {
        showToast('请输入想法内容', 'error');
        return;
    }
    
    showLoading();
    try {
        const response = await fetch('/api/todos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                description: content,
                assignee_eng_name: currentUser.EngName,
                assignee_chn_name: currentUser.ChnName,
                created_by: currentUser.EngName,
                status: 'idea'
            })
        });
        
        if (response.ok) {
            showToast('想法已保存', 'success');
            input.value = '';
            loadIdeas();
        } else {
            throw new Error('保存失败');
        }
    } catch (error) {
        console.error('保存想法失败:', error);
        showToast('保存失败', 'error');
    } finally {
        hideLoading();
    }
}

function openConvertIdeaModal(event, id) {
    const button = event.currentTarget;
    const description = button.getAttribute('data-idea-description');
    
    document.getElementById('convertIdeaId').value = id;
    document.getElementById('convertIdeaTitle').value = description || '';
    
    // 加载成员列表到下拉框
    loadMembersToSelect();
    
    openModal('convertIdeaModal');
}

// 加载成员列表到下拉框
async function loadMembersToSelect() {
    const select = document.getElementById('convertIdeaAssignee');
    if (!select) return;
    
    showLoading();
    try {
        const members = await loadMembers();
        
        // 清空现有选项（保留第一个"请选择"选项）
        select.innerHTML = '<option value="">请选择跟进人</option>';
        
        // 添加成员选项
        members.forEach(member => {
            const option = document.createElement('option');
            option.value = JSON.stringify({
                eng_name: member.eng_name,
                chn_name: member.chn_name
            });
            option.textContent = `${member.eng_name} (${member.chn_name})`;
            select.appendChild(option);
        });
        
        // 默认选中当前用户
        if (currentUser && currentUser.EngName) {
            const currentUserOption = Array.from(select.options).find(opt => {
                if (!opt.value) return false;
                try {
                    const data = JSON.parse(opt.value);
                    return data.eng_name === currentUser.EngName;
                } catch {
                    return false;
                }
            });
            if (currentUserOption) {
                currentUserOption.selected = true;
            }
        }
    } catch (error) {
        console.error('加载成员列表失败:', error);
        showToast('加载成员列表失败', 'error');
    } finally {
        hideLoading();
    }
}

async function handleConvertIdeaSubmit(e) {
    e.preventDefault();
    
    const id = document.getElementById('convertIdeaId').value;
    const content = document.getElementById('convertIdeaTitle').value;
    const assigneeSelect = document.getElementById('convertIdeaAssignee');
    
    if (!assigneeSelect.value) {
        showToast('请选择跟进人', 'error');
        return;
    }
    
    let assigneeEng, assigneeChn;
    try {
        const assigneeData = JSON.parse(assigneeSelect.value);
        assigneeEng = assigneeData.eng_name;
        assigneeChn = assigneeData.chn_name;
    } catch (error) {
        showToast('跟进人信息格式错误', 'error');
        return;
    }

    showLoading();
    try {
        const response = await fetch(`/api/todos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                description: content,
                status: 'pending',
                assignee_eng_name: assigneeEng,
                assignee_chn_name: assigneeChn
            })
        });
        
        if (response.ok) {
            showToast('已转为待办', 'success');
            closeModal('convertIdeaModal');
            loadIdeas();
        } else {
            throw new Error('转换失败');
        }
    } catch (error) {
        console.error('转换想法失败:', error);
        showToast('转换失败', 'error');
    } finally {
        hideLoading();
    }
}

async function deleteIdea(id) {
    if (!confirm('确认删除这个想法？')) return;
    
    showLoading();
    try {
        const response = await fetch(`/api/todos/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showToast('删除成功', 'success');
            loadIdeas();
        } else {
            throw new Error('删除失败');
        }
    } catch (error) {
        console.error('删除想法失败:', error);
        showToast('删除失败', 'error');
    } finally {
        hideLoading();
    }
}

// 打开编辑想法模态框
async function openEditIdeaModal(id) {
    showLoading();
    try {
        // 获取想法详情
        const response = await fetch(`/api/todos?status=idea&sort_by=created_at&sort_order=desc`);
        if (!response.ok) {
            throw new Error('加载想法失败');
        }
        const data = await response.json();
        const idea = data.todos.find(t => t.id === id);
        
        if (!idea) {
            throw new Error('想法不存在');
        }
        
        // 填充表单
        document.getElementById('editIdeaId').value = idea.id;
        document.getElementById('editIdeaContent').value = idea.description || '';
        
        // 打开编辑模态框
        openModal('editIdeaModal');
    } catch (error) {
        console.error('加载想法失败:', error);
        showToast(error.message || '加载想法失败', 'error');
    } finally {
        hideLoading();
    }
}

// 提交编辑想法
async function handleEditIdeaSubmit(e) {
    e.preventDefault();
    
    const id = document.getElementById('editIdeaId').value;
    const content = document.getElementById('editIdeaContent').value.trim();
    
    if (!content) {
        showToast('请输入想法内容', 'error');
        return;
    }
    
    showLoading();
    try {
        const response = await fetch(`/api/todos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                description: content,
                status: 'idea'
            })
        });
        
        if (response.ok) {
            showToast('更新成功', 'success');
            closeModal('editIdeaModal');
            await loadIdeas();
        } else {
            throw new Error('更新失败');
        }
    } catch (error) {
        console.error('更新想法失败:', error);
        showToast('更新失败', 'error');
    } finally {
        hideLoading();
    }
}

// Initialize event listeners
document.getElementById('convertIdeaForm').addEventListener('submit', handleConvertIdeaSubmit);