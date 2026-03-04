// ==================== 待办管理相关 ====================

// 缓存成员列表（待办模块专用）
let todosMembersCache = null;

// 加载所有认领OKR的成员列表
async function loadMembers() {
    // 优先使用 ideas.js 中的缓存
    if (typeof membersCache !== 'undefined' && membersCache) {
        return membersCache;
    }
    
    // 使用待办模块的缓存
    if (todosMembersCache) {
        return todosMembersCache;
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
        todosMembersCache = Array.from(membersMap.values()).sort((a, b) => 
            a.eng_name.localeCompare(b.eng_name)
        );
        
        return todosMembersCache;
    } catch (error) {
        console.error('加载成员列表失败:', error);
        return [];
    }
}

async function loadTodos() {
    // 检查 DOM 元素是否存在
    const searchInput = document.getElementById('todoSearch');
    const statusFilter = document.getElementById('todoStatusFilter');
    const sortBySelect = document.getElementById('todoSortBy');
    
    if (!searchInput || !statusFilter || !sortBySelect) {
        console.warn('待办页面DOM元素未加载完成，跳过加载');
        return;
    }
    
    const search = searchInput.value;
    const status = statusFilter.value;
    const sortBy = sortBySelect.value;
    
    showLoading();
    try {
        let url = `/api/todos?sort_by=${sortBy}&sort_order=desc`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        if (status) url += `&status=${status}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data) {
            console.error('返回数据为空');
            throw new Error('服务器返回数据格式错误');
        }
        
        renderTodos(data.todos);
    } catch (error) {
        console.error('加载待办失败:', error);
        showToast('加载待办失败: ' + (error.message || '未知错误'), 'error');
    } finally {
        hideLoading();
    }
}

function renderTodos(todos) {
    const container = document.getElementById('todosList');
    
    if (!todos || todos.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-500 py-12">暂无待办事项</div>';
        return;
    }
    
    container.innerHTML = todos.map(todo => `
        <div class="bg-white rounded-lg shadow-sm border p-6">
            <div class="flex justify-between items-start mb-2">
                <div class="flex-1">
                    <div class="text-lg font-medium text-gray-900 markdown-content">${marked.parse(todo.description || '无内容')}</div>
                </div>
                <div class="flex items-center space-x-2 ml-4">
                    <button onclick="editTodo(${todo.id})" 
                            class="text-xs px-2 py-1 rounded border hover:bg-gray-50"
                            style="color: var(--primary-color); border-color: var(--primary-color);"
                            onmouseover="this.style.borderColor='var(--primary-hover)'; this.style.color='var(--primary-hover)';"
                            onmouseout="this.style.borderColor='var(--primary-color)'; this.style.color='var(--primary-color)';"
                            title="编辑待办">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteTodo(${todo.id})" 
                            class="text-xs px-2 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50"
                            title="删除待办">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            
            <div class="flex justify-between items-start mb-3">
                <div class="flex items-center space-x-4 text-sm text-gray-500">
                    <div class="flex items-center space-x-2">
                        <img src="https://r.hrc.woa.com/photo/150/${todo.assignee_eng_name}.png?default_when_absent=true" 
                             alt="${todo.assignee_chn_name}" 
                             class="w-5 h-5 rounded-full">
                        <span>
                            ${escapeHtml(todo.assignee_eng_name)}(${escapeHtml(todo.assignee_chn_name)})
                        </span>
                    </div>
                    <span>${formatDate(todo.created_at)}</span>
                </div>
                
                <div>
                    <span class="px-3 py-1 text-sm rounded ${todo.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">
                        ${todo.status === 'completed' ? '已完成' : '进行中'}
                    </span>
                </div>
            </div>
            
            ${todo.progress && todo.progress.length > 0 ? `
                <div class="mb-3 space-y-2">
                    ${todo.progress.map(p => `
                        <div class="bg-gray-50 p-3 rounded text-sm">
                            <div class="flex justify-between items-center mb-1">
                                <div class="flex items-center space-x-2">
                                    <img src="https://r.hrc.woa.com/photo/150/${p.created_by}.png?default_when_absent=true" 
                                         alt="${p.created_by}" 
                                         class="w-5 h-5 rounded-full">
                                    <span class="text-gray-600">${escapeHtml(p.created_by)}</span>
                                </div>
                                <div class="flex items-center space-x-2">
                                    <span class="text-gray-400 text-xs">${formatDate(p.created_at)}</span>
                                    <button onclick="editTodoProgress(${p.id}, ${todo.id})"
                                            class="text-xs px-2 py-1 rounded border hover:bg-gray-50"
                                            style="color: var(--primary-color); border-color: var(--primary-color);"
                                            onmouseover="this.style.borderColor='var(--primary-hover)'; this.style.color='var(--primary-hover)';"
                                            onmouseout="this.style.borderColor='var(--primary-color)'; this.style.color='var(--primary-color)';"
                                            title="编辑">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button onclick="deleteTodoProgress(${p.id}, ${todo.id})"
                                            class="text-xs px-2 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50"
                                            title="删除">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="text-gray-700 markdown-content" onclick="handleImageClick(event)">
                                ${marked.parse(p.content)}
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            
            <div class="flex space-x-2">
                <div class="flex-1 relative">
                    <textarea id="todo-progress-${todo.id}" 
                           placeholder="添加进展...（支持Markdown，可粘贴或拖拽图片）" 
                           class="w-full px-3 py-2 border rounded-lg text-sm pr-12 resize-none"
                           rows="2"
                           ondrop="handleTodoDrop(event, ${todo.id})"
                           ondragover="event.preventDefault()"
                           onpaste="handleTodoPaste(event, ${todo.id})"
                           onkeydown="handleTodoProgressKeyDown(event, ${todo.id})"
                    ></textarea>
                    
                    <button onclick="openImageUpload('todo-progress-${todo.id}')"
                            class="absolute top-2 right-2 text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 transition"
                            style="color: var(--primary-color);"
                            onmouseover="this.style.color='var(--primary-hover)'; this.style.backgroundColor='var(--primary-light)';"
                            onmouseout="this.style.color='var(--primary-color)'; this.style.backgroundColor='#f3f4f6';"
                            title="插入图片"
                    >
                        <i class="fas fa-image"></i>
                    </button>
                </div>
                <button onclick="addTodoProgress(${todo.id})" 
                        class="px-4 py-2 text-white text-sm rounded" 
                        style="background-color: var(--primary-color);" 
                        onmouseover="this.style.backgroundColor='var(--primary-hover)'" 
                        onmouseout="this.style.backgroundColor='var(--primary-color)'"
                        id="todo-progress-btn-${todo.id}"
                >
                    添加
                </button>
                <button onclick="cancelTodoProgressEdit(${todo.id})" 
                        class="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 hidden"
                        id="todo-progress-cancel-${todo.id}"
                >
                    取消
                </button>
                ${todo.status !== 'completed' ? `
                    <button onclick="completeTodo(${todo.id})" 
                            class="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700">
                        标记完成
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

async function handleTodoSubmit(e) {
    e.preventDefault();
    
    const description = document.getElementById('todoDescription').value;
    const select = document.getElementById('todoAssignee');
    
    // 从下拉框的选项中提取英文名和中文名
    const selectedOption = select.options[select.selectedIndex];
    let assigneeEng = '';
    let assigneeChn = '';
    
    if (selectedOption && selectedOption.value) {
        assigneeEng = selectedOption.value;
        // 解析 "EngName (ChnName)" 格式
        const match = selectedOption.textContent.match(/^(.+)\s+\((.+)\)$/);
        if (match) {
            assigneeChn = match[2];
        }
    }
    
    // 如果没有选择，尝试使用隐藏字段的值（兼容性）
    if (!assigneeEng) {
        assigneeEng = document.getElementById('todoAssigneeEng').value;
        assigneeChn = document.getElementById('todoAssigneeChn').value;
    }
    
    if (!assigneeEng) {
        showToast('请选择跟进人', 'error');
        return;
    }
    
    showLoading();
    try {
        const response = await fetch('/api/todos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                description: description,
                assignee_eng_name: assigneeEng,
                assignee_chn_name: assigneeChn,
                created_by: currentUser.EngName
            })
        });
        
        if (response.ok) {
            showToast('创建成功', 'success');
            closeModal('todoModal');
            document.getElementById('todoForm').reset();
            // 不跳转到待办列表，只toast提示
        } else {
            throw new Error('创建失败');
        }
    } catch (error) {
        console.error('创建待办失败:', error);
        showToast('创建失败', 'error');
    } finally {
        hideLoading();
    }
}

async function addTodoProgress(todoId) {
    const input = document.getElementById(`todo-progress-${todoId}`);
    const content = input.value.trim();
    
    // 检查是否处于编辑模式
    const editingProgressId = input.dataset.editingProgressId;
    if (editingProgressId) {
        // 如果处于编辑模式，调用更新函数
        await updateTodoProgress(parseInt(editingProgressId), todoId);
        return;
    }
    
    if (!content) {
        showToast('请输入进展内容', 'error');
        return;
    }
    
    showLoading();
    try {
        const response = await fetch('/api/todos/progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                todo_id: todoId,
                content: content,
                created_by: currentUser.EngName
            })
        });
        
        if (response.ok) {
            showToast('添加成功', 'success');
            input.value = '';
            await loadTodos();
        } else {
            throw new Error('添加失败');
        }
    } catch (error) {
        console.error('添加进展失败:', error);
        showToast('添加失败', 'error');
    } finally {
        hideLoading();
    }
}

async function editTodoProgress(progressId, todoId) {
    const input = document.getElementById(`todo-progress-${todoId}`);
    const addButton = document.getElementById(`todo-progress-btn-${todoId}`);
    const cancelButton = document.getElementById(`todo-progress-cancel-${todoId}`);
    
    if (!input) return;
    
    // 获取所有进展数据
    const todoResponse = await fetch(`/api/todos?sort_by=created_at&sort_order=desc`);
    if (!todoResponse.ok) {
        showToast('加载待办失败', 'error');
        return;
    }
    const todoData = await todoResponse.json();
    const todo = todoData.todos.find(t => t.id === todoId);
    
    if (!todo || !todo.progress) {
        showToast('进展不存在', 'error');
        return;
    }
    
    const progress = todo.progress.find(p => p.id === progressId);
    if (!progress) {
        showToast('进展不存在', 'error');
        return;
    }
    
    // 将进展内容填充到输入框
    input.value = progress.content;
    input.focus();
    
    // 保存当前编辑的进展ID
    input.dataset.editingProgressId = progressId;
    
    // 更新添加按钮为更新按钮
    if (addButton) {
        addButton.textContent = '更新';
        addButton.setAttribute('onclick', `updateTodoProgress(${progressId}, ${todoId})`);
    }
    
    // 显示取消按钮
    if (cancelButton) {
        cancelButton.classList.remove('hidden');
    }
}

async function updateTodoProgress(progressId, todoId) {
    const input = document.getElementById(`todo-progress-${todoId}`);
    const content = input.value.trim();
    
    if (!content) {
        showToast('请输入进展内容', 'error');
        return;
    }
    
    showLoading();
    try {
        const response = await fetch(`/api/todos/progress/${progressId}?user_eng_name=${currentUser.EngName}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: content })
        });
        
        if (response.ok) {
            showToast('更新成功', 'success');
            input.value = '';
            delete input.dataset.editingProgressId;
            
            // 重新加载待办列表
            await loadTodos();
        } else {
            const error = await response.json();
            throw new Error(error.detail || '更新失败');
        }
    } catch (error) {
        console.error('更新进展失败:', error);
        showToast(error.message || '更新失败', 'error');
    } finally {
        hideLoading();
    }
}

async function deleteTodoProgress(progressId, todoId) {
    if (!confirm('确认删除该进展？删除后将无法恢复。')) return;
    
    showLoading();
    try {
        const response = await fetch(`/api/todos/progress/${progressId}?user_eng_name=${currentUser.EngName}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showToast('删除成功', 'success');
            await loadTodos();
        } else {
            const error = await response.json();
            throw new Error(error.detail || '删除失败');
        }
    } catch (error) {
        console.error('删除进展失败:', error);
        showToast(error.message || '删除失败', 'error');
    } finally {
        hideLoading();
    }
}

function cancelTodoProgressEdit(todoId) {
    const input = document.getElementById(`todo-progress-${todoId}`);
    const addButton = document.getElementById(`todo-progress-btn-${todoId}`);
    const cancelButton = document.getElementById(`todo-progress-cancel-${todoId}`);
    
    if (input) {
        input.value = '';
        delete input.dataset.editingProgressId;
    }
    
    if (addButton) {
        addButton.textContent = '添加';
        addButton.setAttribute('onclick', `addTodoProgress(${todoId})`);
    }
    
    if (cancelButton) {
        cancelButton.classList.add('hidden');
    }
}

function handleTodoProgressKeyDown(event, todoId) {
    // 如果按下 Escape 键，取消编辑
    if (event.key === 'Escape') {
        const input = document.getElementById(`todo-progress-${todoId}`);
        if (input && input.dataset.editingProgressId) {
            cancelTodoProgressEdit(todoId);
        }
    }
}

async function completeTodo(todoId) {
    if (!confirm('确认标记为已完成？')) return;
    
    showLoading();
    try {
        const response = await fetch(`/api/todos/${todoId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'completed' })
        });
        
        if (response.ok) {
            showToast('已标记为完成', 'success');
            await loadTodos();
        } else {
            throw new Error('更新失败');
        }
    } catch (error) {
        console.error('更新待办失败:', error);
        showToast('更新失败', 'error');
    } finally {
        hideLoading();
    }
}

// 编辑待办
async function editTodo(todoId) {
    showLoading();
    try {
        // 获取待办详情
        const response = await fetch(`/api/todos?sort_by=created_at&sort_order=desc`);
        if (!response.ok) {
            throw new Error('加载待办失败');
        }
        const data = await response.json();
        const todo = data.todos.find(t => t.id === todoId);
        
        if (!todo) {
            throw new Error('待办不存在');
        }
        
        // 填充表单（只填充描述字段）
        document.getElementById('editTodoId').value = todo.id;
        document.getElementById('editTodoDescription').value = todo.description || '';
        
        // 加载成员列表到下拉框
        await loadMembersToEditSelect();
        
        // 设置当前待办的跟进人
        const select = document.getElementById('editTodoAssignee');
        const currentOption = Array.from(select.options).find(opt => {
            if (!opt.value) return false;
            try {
                const data = JSON.parse(opt.value);
                return data.eng_name === todo.assignee_eng_name && data.chn_name === todo.assignee_chn_name;
            } catch {
                return false;
            }
        });
        if (currentOption) {
            currentOption.selected = true;
        }
        
        // 打开编辑模态框
        openModal('editTodoModal');
    } catch (error) {
        console.error('加载待办失败:', error);
        showToast(error.message || '加载待办失败', 'error');
    } finally {
        hideLoading();
    }
}

// 加载成员列表到编辑待办下拉框
async function loadMembersToEditSelect() {
    const select = document.getElementById('editTodoAssignee');
    if (!select) return;
    
    try {
        // 使用ideas.js中的loadMembers函数
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
    } catch (error) {
        console.error('加载成员列表失败:', error);
        showToast('加载成员列表失败', 'error');
    }
}

// 提交编辑待办
async function handleEditTodoSubmit(e) {
    e.preventDefault();
    
    const todoId = document.getElementById('editTodoId').value;
    const description = document.getElementById('editTodoDescription').value;
    const assigneeSelect = document.getElementById('editTodoAssignee');
    
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
        const response = await fetch(`/api/todos/${todoId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                description: description,
                assignee_eng_name: assigneeEng,
                assignee_chn_name: assigneeChn
            })
        });
        
        if (response.ok) {
            showToast('更新成功', 'success');
            closeModal('editTodoModal');
            await loadTodos();
        } else {
            throw new Error('更新失败');
        }
    } catch (error) {
        console.error('更新待办失败:', error);
        showToast('更新失败', 'error');
    } finally {
        hideLoading();
    }
}

// 删除待办
async function deleteTodo(todoId) {
    if (!confirm('确认删除该待办？删除后将无法恢复，包括所有进展记录。')) return;
    
    showLoading();
    try {
        const response = await fetch(`/api/todos/${todoId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showToast('删除成功', 'success');
            await loadTodos();
        } else {
            throw new Error('删除失败');
        }
    } catch (error) {
        console.error('删除待办失败:', error);
        showToast('删除失败', 'error');
    } finally {
        hideLoading();
    }
}