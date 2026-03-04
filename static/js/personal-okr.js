// ==================== 个人OKR相关 ====================
async function loadPersonalOKR() {
    // 显示骨架屏
    showSkeleton('personalOkrList', 'personal-okr');
    
    try {
        // 并行获取OKR数据和进展数据
        const [objectivesResponse, progressResponse] = await Promise.all([
            fetch(`/api/user/objectives?user_eng_name=${currentUser.EngName}`),
            fetch(`/api/progress/batch?user_eng_names=${encodeURIComponent(currentUser.EngName)}`)
        ]);
        
        // 检查objectives响应
        if (!objectivesResponse.ok) {
            const errorText = await objectivesResponse.text();
            throw new Error(`加载OKR数据失败: HTTP ${objectivesResponse.status} - ${errorText || objectivesResponse.statusText}`);
        }
        
        const objectivesData = await objectivesResponse.json();
        
        // 验证返回数据结构
        if (!objectivesData || typeof objectivesData !== 'object') {
            throw new Error('OKR数据格式错误：返回数据不是对象');
        }
        
        if (!Array.isArray(objectivesData.objectives)) {
            throw new Error('OKR数据格式错误：objectives字段不是数组');
        }
        
        personalObjectivesData = objectivesData.objectives; // 缓存OKR数据
        
        // 将进展数据合并到OKR数据中
        const progressData = progressResponse.ok ? await progressResponse.json() : { data: [] };
        
        if (progressData.data && progressData.data.length > 0) {
            // 为每个KR添加进展数据
            for (const obj of personalObjectivesData) {
                if (obj.key_results) {
                    for (const kr of obj.key_results) {
                        const krProgress = progressData.data.find(p => p.user_kr_id === kr.id);
                        if (krProgress) {
                            kr.weekly_progress = krProgress.weekly_progress || [];
                            kr.overall_progress = krProgress.overall_progress || null;
                            kr.next_week_plan = krProgress.next_week_plan || null;
                            kr.risks_issues = krProgress.risks_issues || kr.risks_issues || null;
                        } else {
                            // 如果没有找到进展数据，初始化为空
                            kr.weekly_progress = [];
                            kr.overall_progress = null;
                            kr.next_week_plan = null;
                        }
                    }
                }
            }
        } else {
            // 如果没有进展数据，为所有KR初始化空数据
            for (const obj of personalObjectivesData) {
                if (obj.key_results) {
                    for (const kr of obj.key_results) {
                        kr.weekly_progress = [];
                        kr.overall_progress = null;
                        kr.next_week_plan = null;
                    }
                }
            }
        }
        
        renderPersonalOKR(personalObjectivesData);
    } catch (error) {
        console.error('加载个人OKR失败:', error);
        console.error('错误类型:', error.constructor.name);
        console.error('错误消息:', error.message);
        console.error('错误堆栈:', error.stack);
        
        const errorMessage = error.message || error.toString() || '未知错误';
        showToast(`加载个人OKR失败: ${errorMessage}`, 'error');
    }
}

function renderPersonalOKR(objectives) {
    const container = document.getElementById('personalOkrList');
    
    if (!objectives || objectives.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-500 py-12">暂无个人OKR，请添加或从团队OKR认领</div>';
        return;
    }
    
    container.innerHTML = objectives.map((obj, objIndex) => `
        <div class="bg-white rounded-lg shadow-sm border p-6 objective-item" data-id="${obj.id}">
            <div class="flex justify-between items-start mb-4">
                <div class="flex items-start flex-1">
                    <i class="fas fa-grip-vertical drag-handle text-gray-400 mr-3 mt-1"></i>
                    <div class="flex-1">
                        <div class="flex items-center space-x-2 mb-2">
                            <h3 class="text-xl font-bold text-gray-900">
                                <span class="mr-2" style="color: var(--primary-color);">O${objIndex + 1}</span>
                                <span contenteditable="true" data-original="${escapeHtml(obj.title)}"
                                      onblur="updateUserObjective(this, ${obj.id}, this.textContent, null)">
                                    ${escapeHtml(obj.title)}
                                </span>
                            </h3>
                        </div>
                    </div>
                </div>
                
                <div class="ml-4 flex space-x-2">
                    <button onclick="addPersonalKR(${obj.id})" class="hidden" style="color: var(--primary-color);">
                        <i class="fas fa-plus"></i> 添加KR
                    </button>
                    <button onclick="deleteUserObjective(${obj.id})" 
                            class="text-red-600 hover:text-red-700" 
                            title="删除Objective">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            
            <div class="space-y-4 kr-list" data-objective-id="${obj.id}">
                ${obj.key_results && obj.key_results.length > 0 ? obj.key_results.map((kr, krIndex) => `
                    <div class="bg-gray-50 rounded-lg p-4 border border-gray-200 kr-item" data-id="${kr.id}">
                        <div class="flex justify-between items-start mb-3">
                            <div class="flex items-start flex-1">
                                <i class="fas fa-grip-vertical drag-handle text-gray-400 mr-3 mt-1"></i>
                                <div class="flex-1">
                                    <div class="flex items-center space-x-2 mb-1">
                                        <h4 class="font-semibold text-gray-900">
                                            <span class="text-blue-600 mr-2">KR${krIndex + 1}</span>
                                            <span contenteditable="true" data-original="${escapeHtml(kr.title)}"
                                                  onblur="updateUserKR(this, ${kr.id}, this.textContent, null)">
                                                ${escapeHtml(kr.title)}
                                            </span>
                                        </h4>
                                    </div>
                                </div>
                            </div>
                            <div class="ml-4 flex space-x-2">
                                <button onclick="deleteUserKR(${kr.id})" 
                                        class="text-red-600 hover:text-red-700" 
                                        title="删除Key Result">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                        
                        <!-- 周进展 -->
                        <div class="mb-4 ml-9">
                            <div class="flex justify-between items-center mb-2">
                                <label class="text-sm font-medium text-gray-700">周进展</label>
                                <div id="weekly-actions-${kr.id}" class="flex space-x-2"></div>
                            </div>
                            
                            <div id="weekly-latest-${kr.id}" class="hidden mb-3"></div>
                            
                            <div id="weekly-input-container-${kr.id}">
                                <div id="weekly-editor-${kr.id}" class="cherry-markdown-container"></div>
                                <div class="mt-2 flex justify-end space-x-2">
                                    <button onclick="cancelWeeklyInput(${kr.id})"
                                            class="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300">
                                        取消
                                    </button>
                                    <button onclick="saveWeeklyProgress(${kr.id})"
                                            class="px-3 py-1 text-white text-sm rounded"
                                            style="background-color: var(--primary-color);"
                                            onmouseover="this.style.backgroundColor='var(--primary-hover)'"
                                            onmouseout="this.style.backgroundColor='var(--primary-color)'">
                                        保存
                                    </button>
                                </div>
                            </div>
                            
                            <div id="weekly-history-${kr.id}" class="hidden mt-3 space-y-2"></div>
                        </div>

                        <!-- 风险和问题 -->
                        <div class="mb-4 ml-9">
                            <div class="flex justify-between items-center mb-2">
                                <label class="text-sm font-medium text-gray-700">风险和问题</label>
                                <div id="risks-actions-${kr.id}" class="flex space-x-2">
                                    <button id="risks-add-btn-${kr.id}"
                                            onclick="showRisksInput(${kr.id})"
                                            class="text-sm"
                                            style="color: var(--primary-color);"
                                            onmouseover="this.style.color='var(--primary-hover)'"
                                            onmouseout="this.style.color='var(--primary-color)'"
                                    >
                                        <i class="fas fa-plus mr-1"></i>填写风险和问题
                                    </button>
                                </div>
                            </div>
                            
                            <div id="risks-display-${kr.id}" class="hidden mb-3"></div>
                            
                            <div id="risks-input-container-${kr.id}" class="hidden">
                                <div id="risks-editor-${kr.id}" class="cherry-markdown-container"></div>
                                <div class="mt-2 flex justify-end space-x-2">
                                    <button onclick="cancelRisksInput(${kr.id})"
                                            class="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
                                    >
                                        取消
                                    </button>
                                    <button onclick="saveRisksIssues(${kr.id})" 
                                            class="px-3 py-1 text-white text-sm rounded"
                                            style="background-color: var(--primary-color);"
                                            onmouseover="this.style.backgroundColor='var(--primary-hover)'"
                                            onmouseout="this.style.backgroundColor='var(--primary-color)'"
                                    >
                                        保存
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        <!-- 下周计划 -->
                        <div class="mb-4 ml-9">
                            <div class="flex justify-between items-center mb-2">
                                <label class="text-sm font-medium text-gray-700">下周计划</label>
                                <div id="next-week-actions-${kr.id}" class="flex space-x-2"></div>
                            </div>
                            
                            <div id="next-week-display-${kr.id}" class="hidden mb-3"></div>
                            
                            <div id="next-week-input-container-${kr.id}" class="hidden">
                                <div id="next-week-editor-${kr.id}" class="cherry-markdown-container"></div>
                                
                                <div class="mt-2">
                                    <label class="text-sm font-medium text-gray-700">
                                        预计本周占用人天 <span class="text-red-500">*</span>
                                    </label>
                                    <input type="number" 
                                           id="next-week-man-days-${kr.id}"
                                           class="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                                           placeholder="请输入预计占用人天数"
                                           min="0"
                                           step="0.5"
                                           required
                                           style="focus:ring-color: var(--primary-color);">
                                </div>
                                
                                <div class="mt-2 flex justify-end space-x-2">
                                    <button onclick="cancelNextWeekInput(${kr.id})"
                                            class="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300">
                                        取消
                                    </button>
                                    <button onclick="saveNextWeekPlan(${kr.id})" 
                                            class="px-3 py-1 text-white text-sm rounded"
                                            style="background-color: var(--primary-color);"
                                            onmouseover="this.style.backgroundColor='var(--primary-hover)'"
                                            onmouseout="this.style.backgroundColor='var(--primary-color)'"
                                            >
                                        保存
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        
                        
                        <!-- 整体进展 -->
                        <div class="ml-9">
                            <div class="flex justify-between items-center mb-2">
                                <label class="text-sm font-medium text-gray-700">整体进展</label>
                                <div id="overall-actions-${kr.id}" class="flex space-x-2"></div>
                            </div>
                            
                            <div id="overall-display-${kr.id}" class="hidden mb-3"></div>
                            
                            <div id="overall-input-container-${kr.id}" class="relative">
                                <div id="overall-editor-${kr.id}" class="cherry-markdown-container"></div>
                                <div class="absolute bottom-12 right-2 flex space-x-1">
                                    <button onclick="generateAIProgress(${kr.id})" 
                                            class="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 transition"
                                            style="color: var(--primary-color);"
                                            onmouseover="this.style.color='var(--primary-hover)'; this.style.backgroundColor='var(--primary-light)';"
                                            onmouseout="this.style.color='var(--primary-color)'; this.style.backgroundColor='#f3f4f6';">
                                        <i class="fas fa-magic mr-1"></i>AI填写
                                    </button>
                                    <button onclick="openImageUpload('overall-${kr.id}')"
                                            class="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 transition"
                                            style="color: var(--primary-color);"
                                            onmouseover="this.style.color='var(--primary-hover)'; this.style.backgroundColor='var(--primary-light)';"
                                            onmouseout="this.style.color='var(--primary-color)'; this.style.backgroundColor='#f3f4f6';"
                                            title="插入图片">
                                        <i class="fas fa-image"></i>
                                    </button>
                                </div>
                                <div class="mt-2 flex justify-end space-x-2">
                                    <button onclick="cancelOverallInput(${kr.id})"
                                            class="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300">
                                        取消
                                    </button>
                                    <button onclick="saveOverallProgress(${kr.id})"
                                            class="px-3 py-1 text-white text-sm rounded"
                                            style="background-color: var(--primary-color);"
                                            onmouseover="this.style.backgroundColor='var(--primary-hover)'"
                                            onmouseout="this.style.backgroundColor='var(--primary-color)'">
                                        保存
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('') : '<p class="text-gray-500 text-sm">暂无Key Results</p>'}
            </div>
        </div>
    `).join('');
    
    // 渲染所有KR的进展数据
    objectives.forEach(obj => {
        if (obj.key_results) {
            obj.key_results.forEach(kr => {
                renderKRProgress(kr);
            });
        }
    });
    
    initPersonalObjectiveSortable();
    initPersonalKRSortable();
}

// 初始化个人Objective拖拽排序
function initPersonalObjectiveSortable() {
    const container = document.getElementById('personalOkrList');
    if (!container) return;
    
    Sortable.create(container, {
        animation: 150,
        handle: '.drag-handle',
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag',
        onEnd: async function(evt) {
            updatePersonalObjectiveNumbers();
            
            const items = container.querySelectorAll('.objective-item');
            const objectiveIds = Array.from(items).map(item => parseInt(item.dataset.id));
            
            console.log('保存个人Objective排序:', objectiveIds);
            
            try {
                const response = await fetch(`/api/user/objectives/sort?user_eng_name=${currentUser.EngName}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ objective_ids: objectiveIds })
                });
                
                if (response.ok) {
                    const result = await response.json();
                    console.log('排序保存成功:', result);
                    showToast('排序已保存', 'success');
                } else {
                    const errorText = await response.text();
                    console.error('排序保存失败，状态码:', response.status, '错误信息:', errorText);
                    throw new Error(`排序保存失败: HTTP ${response.status}`);
                }
            } catch (error) {
                console.error('保存排序失败:', error);
                showToast('排序保存失败', 'error');
                await loadPersonalOKR();
            }
        }
    });
}

function updatePersonalObjectiveNumbers() {
    const container = document.getElementById('personalOkrList');
    if (!container) return;
    
    const objectives = container.querySelectorAll('.objective-item');
    objectives.forEach((obj, index) => {
        const numberSpan = obj.querySelector('h3 > span:first-child');
        if (numberSpan) {
            numberSpan.textContent = `O${index + 1}`;
        }
    });
}

function initPersonalKRSortable() {
    const krLists = document.querySelectorAll('#personalOkrList .kr-list');
    
    krLists.forEach(list => {
        Sortable.create(list, {
            animation: 150,
            handle: '.drag-handle',
            ghostClass: 'sortable-ghost',
            dragClass: 'sortable-drag',
            onEnd: async function(evt) {
                updatePersonalKRNumbers(list);
                
                const items = list.querySelectorAll('.kr-item');
                const krIds = Array.from(items).map(item => parseInt(item.dataset.id));
                
                console.log('保存个人KR排序:', krIds);
                
                try {
                    const response = await fetch(`/api/user/key-results/sort?user_eng_name=${currentUser.EngName}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ kr_ids: krIds })
                    });
                    
                    if (response.ok) {
                        const result = await response.json();
                        console.log('排序保存成功:', result);
                        showToast('排序已保存', 'success');
                    } else {
                        const errorText = await response.text();
                        console.error('排序保存失败，状态码:', response.status, '错误信息:', errorText);
                        throw new Error(`排序保存失败: HTTP ${response.status}`);
                    }
                } catch (error) {
                    console.error('保存排序失败:', error);
                    showToast('排序保存失败', 'error');
                    await loadPersonalOKR();
                }
            }
        });
    });
}

function updatePersonalKRNumbers(krList) {
    const krItems = krList.querySelectorAll('.kr-item');
    krItems.forEach((kr, index) => {
        const numberSpan = kr.querySelector('h4 > span:first-child');
        if (numberSpan) {
            numberSpan.textContent = `KR${index + 1}`;
        }
    });
}

async function updateUserObjective(element, objId, title, description) {
    const updates = {};
    const originalTitle = element.dataset.original || '';
    
    if (title !== null) {
        const trimmedTitle = title.trim();
        // 如果内容没有变化，跳过该字段更新
        if (trimmedTitle !== originalTitle) {
            updates.title = trimmedTitle;
        }
    }
    if (description !== null) updates.description = description.trim();
    
    if (Object.keys(updates).length === 0) return;
    
    // 验证标题
    if (updates.title !== undefined && !updates.title) {
        showToast('Objective内容不能为空', 'error');
        element.textContent = originalTitle;
        return;
    }
    
    try {
        const response = await fetch(`/api/user/objectives/${objId}?user_eng_name=${currentUser.EngName}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        
        if (response.ok) {
            if (updates.title) {
                showToast('更新成功', 'success');
                // 更新原始值
                element.dataset.original = updates.title;
            }
        } else {
            throw new Error('更新失败');
        }
    } catch (error) {
        console.error('更新Objective失败:', error);
        showToast('更新失败', 'error');
        element.textContent = originalTitle;
    }
}

async function updateUserKR(element, krId, title, description) {
    const updates = {};
    const originalTitle = element.dataset.original || '';
    
    if (title !== null) {
        const trimmedTitle = title.trim();
        // 如果内容没有变化，跳过该字段更新
        if (trimmedTitle !== originalTitle) {
            updates.title = trimmedTitle;
        }
    }
    if (description !== null) updates.description = description.trim();
    
    if (Object.keys(updates).length === 0) return;
    
    // 验证标题
    if (updates.title !== undefined && !updates.title) {
        showToast('Key Result内容不能为空', 'error');
        element.textContent = originalTitle;
        return;
    }
    
    try {
        const response = await fetch(`/api/user/key-results/${krId}?user_eng_name=${currentUser.EngName}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        
        if (response.ok) {
            if (updates.title) {
                showToast('更新成功', 'success');
                // 更新原始值
                element.dataset.original = updates.title;
            }
        } else {
            throw new Error('更新失败');
        }
    } catch (error) {
        console.error('更新KR失败:', error);
        showToast('更新失败', 'error');
        element.textContent = originalTitle;
    }
}

async function deleteUserObjective(objId) {
    if (!confirm('确认删除该Objective及其所有Key Results？删除后将无法恢复。')) return;
    
    showLoading();
    try {
        const response = await fetch(`/api/user/objectives/${objId}?user_eng_name=${currentUser.EngName}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showToast('删除成功', 'success');
            // 清除团队OKR缓存，确保认领信息同步更新
            krClaimsCache = null;
            teamObjectivesData = null;
            await loadPersonalOKR();
            // 如果当前在团队OKR视图，同步刷新
            if (currentTab === 'team') {
                loadTeamOKR();
            }
        } else {
            const error = await response.json();
            throw new Error(error.detail || '删除失败');
        }
    } catch (error) {
        console.error('删除Objective失败:', error);
        showToast(error.message || '删除失败', 'error');
    } finally {
        hideLoading();
    }
}

async function deleteUserKR(krId) {
    if (!confirm('确认删除该Key Result？删除后将无法恢复。')) return;
    
    showLoading();
    try {
        const response = await fetch(`/api/user/key-results/${krId}?user_eng_name=${currentUser.EngName}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showToast('删除成功', 'success');
            // 清除团队OKR缓存，确保认领信息同步更新
            krClaimsCache = null;
            teamObjectivesData = null;
            await loadPersonalOKR();
            // 如果当前在团队OKR视图，同步刷新
            if (currentTab === 'team') {
                loadTeamOKR();
            }
        } else {
            const error = await response.json();
            throw new Error(error.detail || '删除失败');
        }
    } catch (error) {
        console.error('删除KR失败:', error);
        showToast(error.message || '删除失败', 'error');
    } finally {
        hideLoading();
    }
}

async function handlePersonalObjectiveSubmit(e) {
    e.preventDefault();
    
    const content = document.getElementById('personalObjContent').value.trim();
    const objType = document.getElementById('personalObjType').value;
    const weight = parseInt(document.getElementById('personalObjWeight').value);
    
    if (!content) {
        showToast('请输入Objective内容', 'error');
        return;
    }
    
    if (weight < 0 || weight > 100) {
        showToast('权重必须在0-100之间', 'error');
        return;
    }
    
    if (!currentUser || !currentUser.EngName) {
        showToast('用户信息未加载，请刷新页面', 'error');
        return;
    }
    
    showLoading();
    try {
        const response = await fetch(`/api/user/objectives?user_eng_name=${currentUser.EngName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                title: content, 
                description: '',
                obj_type: objType,
                weight: weight
            })
        });
        
        if (response.ok) {
            showToast('创建成功', 'success');
            closeModal('personalObjectiveModal');
            document.getElementById('personalObjectiveForm').reset();
            await loadPersonalOKR();
        } else {
            let errorMessage = '创建失败';
            try {
                const errorData = await response.json();
                errorMessage = errorData.detail || errorData.message || errorMessage;
            } catch (parseError) {
                const errorText = await response.text();
                if (errorText) {
                    errorMessage = `创建失败: ${errorText}`;
                }
            }
            throw new Error(errorMessage);
        }
    } catch (error) {
        console.error('创建个人Objective失败:', error);
        showToast(error.message || '创建失败', 'error');
    } finally {
        hideLoading();
    }
}

function addPersonalKR(objectiveId) {
    document.getElementById('personalKRObjId').value = objectiveId;
    openModal('personalKRModal');
}

async function handlePersonalKRSubmit(e) {
    e.preventDefault();
    
    const objectiveId = document.getElementById('personalKRObjId').value;
    const content = document.getElementById('personalKRContent').value.trim();
    
    if (!content) {
        showToast('请输入Key Result内容', 'error');
        return;
    }
    
    if (!currentUser || !currentUser.EngName) {
        showToast('用户信息未加载，请刷新页面', 'error');
        return;
    }
    
    showLoading();
    try {
        const response = await fetch(`/api/user/key-results?user_eng_name=${currentUser.EngName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ objective_id: parseInt(objectiveId), title: content, description: '' })
        });
        
        if (response.ok) {
            showToast('创建成功', 'success');
            closeModal('personalKRModal');
            document.getElementById('personalKRForm').reset();
            await loadPersonalOKR();
        } else {
            let errorMessage = '创建失败';
            try {
                const errorData = await response.json();
                errorMessage = errorData.detail || errorData.message || errorMessage;
            } catch (parseError) {
                const errorText = await response.text();
                if (errorText) {
                    errorMessage = `创建失败: ${errorText}`;
                }
            }
            throw new Error(errorMessage);
        }
    } catch (error) {
        console.error('创建个人KR失败:', error);
        showToast(error.message || '创建失败', 'error');
    } finally {
        hideLoading();
    }
}

// 渲染单个KR的进展数据（使用已加载的数据）
function renderKRProgress(kr) {
    const krId = kr.id;
    
    // 渲染周进展
    const weeklyLatest = document.getElementById(`weekly-latest-${krId}`);
    const weeklyInputContainer = document.getElementById(`weekly-input-container-${krId}`);
    const weeklyHistory = document.getElementById(`weekly-history-${krId}`);
    const weeklyActions = document.getElementById(`weekly-actions-${krId}`);
    
    const weeklyData = kr.weekly_progress || [];
    
    if (weeklyData && weeklyData.length > 0) {
        const latest = weeklyData[0];
        
        if (weeklyLatest) {
            weeklyLatest.classList.remove('hidden');
            weeklyLatest.innerHTML = `
                <div class="bg-white p-4 rounded border weekly-progress-item group">
                    <div class="flex justify-between items-center mb-2">
                        <div class="flex items-center space-x-2">
                            <span class="text-xs text-gray-400" title="${latest.created_at}">${formatDate(latest.created_at)}</span>
                            <button onclick="editWeeklyProgress(${latest.id}, ${krId})"
                                    class="text-xs px-2 py-1 rounded border hover:bg-gray-50 opacity-0 group-hover:opacity-100 transition-opacity"
                                    style="color: var(--primary-color); border-color: var(--primary-color);"
                                    onmouseover="this.style.borderColor='var(--primary-hover)'; this.style.color='var(--primary-hover)';"
                                    onmouseout="this.style.borderColor='var(--primary-color)'; this.style.color='var(--primary-color)';"
                                    title="更新已填的进展内容，不生成新的进展版本"
                                >
                                <i class="fas fa-edit mr-1"></i>编辑
                            </button>
                        </div>
                        <div class="flex space-x-2">
                            <button onclick="showWeeklyInput(${krId})" 
                                    class="text-xs px-2 py-1 rounded border hover:bg-gray-50"
                                    style="color: var(--primary-color); border-color: var(--primary-color);"
                                    onmouseover="this.style.borderColor='var(--primary-hover)'; this.style.color='var(--primary-hover)';"
                                    onmouseout="this.style.borderColor='var(--primary-color)'; this.style.color='var(--primary-color)';"
                                    title="填写本周新进展，将生成新的进展版本"
                                >
                                <i class="fas fa-plus mr-1"></i>填写新进展
                            </button>
                            <button onclick="deleteWeeklyProgress(${latest.id}, ${krId})"
                                    class="text-xs px-2 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50"
                                >
                                <i class="fas fa-trash mr-1"></i>删除
                            </button>
                        </div>
                    </div>
                    <div class="markdown-content" onclick="handleImageClick(event)">${marked.parse(latest.content)}</div>
                </div>
            `;
        }
        
        if (weeklyInputContainer) {
            weeklyInputContainer.classList.add('hidden');
        }
        
        if (weeklyActions) {
            weeklyActions.innerHTML = `
                <button onclick="toggleWeeklyHistory(${krId})" 
                        class="text-sm text-blue-600 hover:text-blue-700"
                    >
                    <i class="fas fa-history mr-1"></i>查看历史周进展
                </button>
            `;
        }
        
        if (weeklyHistory) {
            const historyProgress = weeklyData.slice(1);
            if (historyProgress.length > 0) {
                weeklyHistory.innerHTML = historyProgress.map(p => `
                <div class="bg-white p-3 rounded border text-sm weekly-progress-item group">
                    <div class="flex justify-between items-center mb-1">
                        <div class="flex items-center space-x-2">
                            <span class="text-gray-400 text-xs" title="${p.created_at}">${formatDate(p.created_at)}</span>
                            <button onclick="editWeeklyProgress(${p.id}, ${krId})"
                                    class="text-xs px-2 py-1 rounded border hover:bg-gray-50 opacity-0 group-hover:opacity-100 transition-opacity"
                                    style="color: var(--primary-color); border-color: var(--primary-color);"
                                    onmouseover="this.style.borderColor='var(--primary-hover)'; this.style.color='var(--primary-hover)';"
                                    onmouseout="this.style.borderColor='var(--primary-color)'; this.style.color='var(--primary-color)';"
                                    title="编辑"
                                >
                                <i class="fas fa-edit mr-1"></i>编辑
                            </button>
                        </div>
                        <div class="flex space-x-2">
                            <button onclick="deleteWeeklyProgress(${p.id}, ${krId})"
                                    class="text-xs px-2 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50"
                                    title="删除"
                                >
                                <i class="fas fa-trash mr-1"></i>删除
                            </button>
                        </div>
                    </div>
                    <div class="markdown-content" onclick="handleImageClick(event)">
                        ${marked.parse(p.content)}
                    </div>
                </div>
            `).join('');
            } else {
                weeklyHistory.innerHTML = '<div class="text-center text-gray-500 text-sm py-2">暂无历史周进展</div>';
            }
        }
    } else {
        if (weeklyLatest) {
            weeklyLatest.classList.add('hidden');
        }
        
        if (weeklyInputContainer) {
            weeklyInputContainer.classList.remove('hidden');
            
            // 初始化编辑器（延迟执行，确保容器已显示）
            setTimeout(() => {
                initWeeklyEditor(krId, '');
            }, 100);
        }
        
        if (weeklyActions) {
            weeklyActions.innerHTML = '';
        }
    }
    
    // 渲染风险和问题
    const risksDisplay = document.getElementById(`risks-display-${krId}`);
    const risksInputContainer = document.getElementById(`risks-input-container-${krId}`);
    const risksActions = document.getElementById(`risks-actions-${krId}`);
    const risksTextarea = document.getElementById(`risks-${krId}`);
    
    if (kr.risks_issues) {
        if (risksDisplay) {
            risksDisplay.classList.remove('hidden');
            risksDisplay.innerHTML = `
                <div class="bg-red-50 p-4 rounded border border-red-200">
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-sm text-gray-600">
                            <i class="fas fa-exclamation-triangle text-red-500 mr-1"></i>风险和问题
                        </span>
                        <button onclick="deleteRisksIssues(${krId})"
                                class="text-xs px-2 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50"
                                title="删除风险和问题"
                        >
                            <i class="fas fa-trash mr-1"></i>删除
                        </button>
                    </div>
                    <div class="text-gray-800 markdown-content" onclick="handleImageClick(event)">
                        ${marked.parse(kr.risks_issues)}
                    </div>
                </div>
            `;
        }
        
        if (risksInputContainer) {
            risksInputContainer.classList.add('hidden');
        }
        
        if (risksActions) {
            risksActions.innerHTML = `
                <button onclick="showRisksInput(${krId})" 
                        class="text-sm"
                        style="color: var(--primary-color);"
                        onmouseover="this.style.color='var(--primary-hover)'"
                        onmouseout="this.style.color='var(--primary-color)'"
                    >
                    <i class="fas fa-edit mr-1"></i>更新问题和风险
                </button>
                <button onclick="deleteRisksIssues(${krId})"
                        class="text-sm text-red-600 hover:text-red-700"
                        title="删除风险和问题"
                >
                    <i class="fas fa-trash mr-1"></i>删除
                </button>
            `;
        }
    } else {
        if (risksDisplay) {
            risksDisplay.classList.add('hidden');
        }
        
        if (risksInputContainer) {
            risksInputContainer.classList.add('hidden');
        }
        
        if (risksActions) {
            risksActions.innerHTML = `
                <button id="risks-add-btn-${krId}"
                        onclick="showRisksInput(${krId})"
                        class="text-sm"
                        style="color: var(--primary-color);"
                        onmouseover="this.style.color='var(--primary-hover)'"
                        onmouseout="this.style.color='var(--primary-color)'"
                    >
                    <i class="fas fa-plus mr-1"></i>填写风险和问题
                </button>
            `;
        }
        
        if (risksTextarea) {
            risksTextarea.value = '';
        }
    }
    
    // 渲染下周计划
    const nextWeekPlan = kr.next_week_plan;
    const nextWeekDisplay = document.getElementById(`next-week-display-${krId}`);
    const nextWeekInputContainer = document.getElementById(`next-week-input-container-${krId}`);
    const nextWeekActions = document.getElementById(`next-week-actions-${krId}`);
    const nextWeekTextarea = document.getElementById(`next-week-${krId}`);
    
    if (nextWeekPlan && nextWeekPlan.content) {
        if (nextWeekDisplay) {
            nextWeekDisplay.classList.remove('hidden');
            nextWeekDisplay.innerHTML = `
                <div class="bg-white p-4 rounded border">
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-sm font-medium text-gray-600">
                            <i class="fas fa-clock mr-1"></i>预计本周占用人天：<span class="text-purple-600 font-bold">${nextWeekPlan.estimated_man_days || 0}</span> 天
                        </span>
                    </div>
                    <div class="text-gray-800 markdown-content" onclick="handleImageClick(event)">
                        ${marked.parse(nextWeekPlan.content)}
                    </div>
                </div>
            `;
        }
        
        if (nextWeekInputContainer) {
            nextWeekInputContainer.classList.add('hidden');
        }
        
        if (nextWeekActions) {
            nextWeekActions.innerHTML = `
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
        if (nextWeekDisplay) {
            nextWeekDisplay.classList.add('hidden');
        }
        
        if (nextWeekInputContainer) {
            nextWeekInputContainer.classList.add('hidden');
        }
        
        if (nextWeekActions) {
            nextWeekActions.innerHTML = `
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
        
        if (nextWeekTextarea) {
            nextWeekTextarea.value = '';
        }
    }
    
    // 渲染整体进展
    const overallData = kr.overall_progress;
    const overallDisplay = document.getElementById(`overall-display-${krId}`);
    const overallInputContainer = document.getElementById(`overall-input-container-${krId}`);
    const overallActions = document.getElementById(`overall-actions-${krId}`);
    
    if (overallData && overallData.content) {
        if (overallDisplay) {
            overallDisplay.classList.remove('hidden');
            overallDisplay.innerHTML = `
                <div class="bg-white p-4 rounded border">
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-xs text-gray-400" title="${overallData.updated_at}">${formatDate(overallData.updated_at)}</span>
                    </div>
                    <div class="markdown-content" onclick="handleImageClick(event)">
                        ${marked.parse(overallData.content)}
                    </div>
                </div>
            `;
        }
        
        if (overallInputContainer) {
            overallInputContainer.classList.add('hidden');
        }
        
        if (overallActions) {
            overallActions.innerHTML = `
                <button onclick="showOverallInput(${krId})" 
                        class="text-sm"
                        style="color: var(--primary-color);"
                        onmouseover="this.style.color='var(--primary-hover)'"
                        onmouseout="this.style.color='var(--primary-color)'"
                    >
                    <i class="fas fa-edit mr-1"></i>更新整体进展
                </button>
            `;
        }
    } else {
        if (overallDisplay) {
            overallDisplay.classList.add('hidden');
        }
        
        if (overallInputContainer) {
            overallInputContainer.classList.add('hidden');
        }
        
        if (overallActions) {
            overallActions.innerHTML = `
                <button onclick="showOverallInput(${krId})" 
                        class="text-sm"
                        style="color: var(--primary-color);"
                        onmouseover="this.style.color='var(--primary-hover)'"
                        onmouseout="this.style.color='var(--primary-color)'"
                    >
                    <i class="fas fa-plus mr-1"></i>填写整体进展
                </button>
            `;
        }
    }
}

async function loadKRProgress(krId) {
    // 重新加载单个KR的进展数据
    try {
        const weeklyResponse = await fetch(`/api/progress/weekly/${krId}`);
        if (!weeklyResponse.ok) {
            throw new Error(`加载周进展失败: HTTP ${weeklyResponse.status}`);
        }
        const weeklyData = await weeklyResponse.json();
        
        // 更新缓存中的周进展
        if (personalObjectivesData) {
            for (const obj of personalObjectivesData) {
                if (obj.key_results) {
                    const kr = obj.key_results.find(k => k.id === krId);
                    if (kr) {
                        kr.weekly_progress = weeklyData.progress;
                        renderKRProgress(kr);
                        break;
                    }
                }
            }
        }
        
        const overallResponse = await fetch(`/api/progress/overall/${krId}?user_eng_name=${currentUser.EngName}`);
        if (!overallResponse.ok) {
            throw new Error(`加载整体进展失败: HTTP ${overallResponse.status}`);
        }
        const overallData = await overallResponse.json();
        
        // 更新缓存中的整体进展
        if (personalObjectivesData) {
            for (const obj of personalObjectivesData) {
                if (obj.key_results) {
                    const kr = obj.key_results.find(k => k.id === krId);
                    if (kr) {
                        kr.overall_progress = overallData;
                        renderKRProgress(kr);
                        break;
                    }
                }
            }
        }
        
        const nextWeekResponse = await fetch(`/api/progress/next-week-plan/${krId}?user_eng_name=${currentUser.EngName}`);
        if (nextWeekResponse.ok) {
            const nextWeekData = await nextWeekResponse.json();
            
            // 更新缓存中的下周计划
            if (personalObjectivesData) {
                for (const obj of personalObjectivesData) {
                    if (obj.key_results) {
                        const kr = obj.key_results.find(k => k.id === krId);
                        if (kr) {
                            kr.next_week_plan = nextWeekData;
                            renderKRProgress(kr);
                            break;
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error('加载进展失败:', error);
        const errorMessage = error.message || error.toString() || '未知错误';
        showToast(`加载进展失败: ${errorMessage}`, 'error');
    }
}

async function showWeeklyInput(krId) {
    const inputContainer = document.getElementById(`weekly-input-container-${krId}`);
    const latest = document.getElementById(`weekly-latest-${krId}`);
    
    currentEditingWeeklyProgressId = null;
    
    if (inputContainer) {
        inputContainer.classList.remove('hidden');
    }
    
    if (latest) {
        latest.classList.add('hidden');
    }
    
    // 获取上周进展作为默认值
    let defaultValue = '';
    try {
        const weeklyResponse = await fetch(`/api/progress/weekly/${krId}`);
        if (weeklyResponse.ok) {
            const weeklyData = await weeklyResponse.json();
            if (weeklyData.progress && weeklyData.progress.length > 0) {
                defaultValue = weeklyData.progress[0].content;
            }
        }
    } catch (error) {
        console.error('获取最新周进展失败:', error);
    }
    
    // 延迟初始化编辑器，确保容器已显示
    setTimeout(() => {
        initWeeklyEditor(krId, defaultValue);
    }, 100);
}

async function editWeeklyProgress(progressId, krId) {
    const inputContainer = document.getElementById(`weekly-input-container-${krId}`);
    const latest = document.getElementById(`weekly-latest-${krId}`);
    
    currentEditingWeeklyProgressId = progressId;
    
    try {
        const weeklyResponse = await fetch(`/api/progress/weekly/${krId}`);
        if (weeklyResponse.ok) {
            const weeklyData = await weeklyResponse.json();
            const progress = weeklyData.progress.find(p => p.id === progressId);
            
            if (progress) {
                if (inputContainer) {
                    inputContainer.classList.remove('hidden');
                }
                
                if (latest) {
                    latest.classList.add('hidden');
                }
                
                // 延迟初始化编辑器，确保容器已显示
                setTimeout(() => {
                    initWeeklyEditor(krId, progress.content);
                }, 100);
            }
        }
    } catch (error) {
        console.error('获取周进展内容失败:', error);
        showToast('加载进展内容失败', 'error');
    }
}

async function deleteWeeklyProgress(progressId, krId) {
    if (!confirm('确认删除该周进展？删除后将无法恢复。')) return;
    
    showLoading();
    try {
        const response = await fetch(`/api/progress/weekly/${progressId}?user_eng_name=${currentUser.EngName}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showToast('删除成功', 'success');
            await loadKRProgress(krId);
        } else {
            const error = await response.json();
            throw new Error(error.detail || '删除失败');
        }
    } catch (error) {
        console.error('删除周进展失败:', error);
        showToast(error.message || '删除失败', 'error');
    } finally {
        hideLoading();
    }
}

function cancelWeeklyInput(krId) {
    const inputContainer = document.getElementById(`weekly-input-container-${krId}`);
    const latest = document.getElementById(`weekly-latest-${krId}`);
    
    // 销毁编辑器
    const editorId = `weekly-editor-${krId}`;
    destroyPersonalEditor(editorId);
    
    currentEditingWeeklyProgressId = null;
    
    const hasProgress = latest && !latest.classList.contains('hidden');
    
    if (hasProgress || (latest && latest.innerHTML.trim() !== '')) {
        if (inputContainer) {
            inputContainer.classList.add('hidden');
        }
        if (latest) {
            latest.classList.remove('hidden');
        }
    }
}

async function showOverallInput(krId) {
    const inputContainer = document.getElementById(`overall-input-container-${krId}`);
    const display = document.getElementById(`overall-display-${krId}`);
    
    if (inputContainer) {
        inputContainer.classList.remove('hidden');
    }
    
    if (display) {
        display.classList.add('hidden');
    }
    
    // 获取整体进展内容作为默认值
    let defaultValue = '';
    try {
        const overallResponse = await fetch(`/api/progress/overall/${krId}?user_eng_name=${currentUser.EngName}`);
        if (overallResponse.ok) {
            const overallData = await overallResponse.json();
            if (overallData && overallData.content) {
                defaultValue = overallData.content;
            }
        }
    } catch (error) {
        console.error('获取整体进展失败:', error);
    }
    
    // 延迟初始化编辑器，确保容器已显示
    setTimeout(() => {
        initOverallEditor(krId, defaultValue);
    }, 100);
}

function cancelOverallInput(krId) {
    const inputContainer = document.getElementById(`overall-input-container-${krId}`);
    const display = document.getElementById(`overall-display-${krId}`);
    
    // 销毁编辑器
    const editorId = `overall-editor-${krId}`;
    destroyPersonalEditor(editorId);
    
    // 总是隐藏输入容器
    if (inputContainer) {
        inputContainer.classList.add('hidden');
    }
    
    // 如果有内容则显示display
    const hasContent = display && !display.classList.contains('hidden');
    if (hasContent || (display && display.innerHTML.trim() !== '')) {
        if (display) {
            display.classList.remove('hidden');
        }
    }
}

function toggleWeeklyHistory(krId) {
    const history = document.getElementById(`weekly-history-${krId}`);
    const button = event.target.closest('button');
    
    if (history) {
        if (history.classList.contains('hidden')) {
            history.classList.remove('hidden');
            if (button) {
                button.innerHTML = '<i class="fas fa-chevron-up mr-1"></i>收起历史周进展';
            }
        } else {
            history.classList.add('hidden');
            if (button) {
                button.innerHTML = '<i class="fas fa-history mr-1"></i>查看历史周进展';
            }
        }
    }
}

async function saveWeeklyProgress(krId) {
    // 从 Cherry 编辑器获取内容
    const editorId = `weekly-editor-${krId}`;
    const content = getPersonalEditorValue(editorId).trim();
    
    if (!content) {
        showToast('请输入周进展内容', 'error');
        return;
    }
    
    showLoading();
    try {
        let response;
        
        if (currentEditingWeeklyProgressId) {
            response = await fetch(`/api/progress/weekly/${currentEditingWeeklyProgressId}?user_eng_name=${currentUser.EngName}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: content })
            });
        } else {
            response = await fetch('/api/progress/weekly', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_kr_id: krId,
                    content: content,
                    user_eng_name: currentUser.EngName,
                    user_chn_name: currentUser.ChnName
                })
            });
        }
        
        if (response.ok) {
            showToast(currentEditingWeeklyProgressId ? '更新成功' : '保存成功', 'success');
            // 清空编辑器并销毁
            destroyPersonalEditor(editorId);
            currentEditingWeeklyProgressId = null;
            await loadKRProgress(krId);
        } else {
            let errorMessage = currentEditingWeeklyProgressId ? '更新失败' : '保存失败';
            try {
                const errorData = await response.json();
                errorMessage = errorData.detail || errorData.message || errorMessage;
            } catch (parseError) {
                const errorText = await response.text();
                if (errorText) {
                    errorMessage = `${errorMessage}: ${errorText}`;
                }
            }
            throw new Error(errorMessage);
        }
    } catch (error) {
        console.error('保存周进展失败:', error);
        showToast(error.message || '保存失败', 'error');
    } finally {
        hideLoading();
    }
}

async function saveOverallProgress(krId) {
    // 从 Cherry 编辑器获取内容
    const editorId = `overall-editor-${krId}`;
    const content = getPersonalEditorValue(editorId).trim();
    
    if (!content) {
        showToast('请输入整体进展内容', 'error');
        return;
    }
    
    showLoading();
    try {
        const response = await fetch('/api/progress/overall', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_kr_id: krId,
                content: content,
                user_eng_name: currentUser.EngName,
                user_chn_name: currentUser.ChnName
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
        console.error('保存整体进展失败:', error);
        showToast('保存失败', 'error');
    } finally {
        hideLoading();
    }
}

async function generateAIProgress(krId) {
    // 1. 确保获取最新的进展数据
    const btnSelector = `button[onclick="generateAIProgress(${krId})"]`;
    const button = document.querySelector(btnSelector);
    let originalBtnContent = '';
    
    if (button) {
        originalBtnContent = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>准备数据...';
        button.disabled = true;
    }

    try {
        // 重新加载该KR的进展数据，确保缓存是最新的
        await loadKRProgress(krId);
        
        // 2. 从缓存中查找KR数据
        let kr = null;
        if (personalObjectivesData) {
            for (const obj of personalObjectivesData) {
                if (obj.key_results) {
                    const found = obj.key_results.find(k => k.id === krId);
                    if (found) {
                        kr = found;
                        break;
                    }
                }
            }
        }
        
        if (!kr) {
            throw new Error('无法获取KR数据，请刷新页面重试');
        }

        // 更新按钮状态
        if (button) {
            button.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>AI生成中...';
        }

        // 3. 准备上下文
        let context = `你是一个专业的OKR助手。请根据以下信息，为该关键结果(KR)生成一份新的"整体进展"汇总。
要求：
1. 语气专业、客观、简洁。
2. 智能合并"已有整体进展"和"本周进展记录"中的信息。
3. 突出最新的成就和进度，同时保留重要的历史背景。
4. 如果有风险或问题，请在最后单独列出。
5. 使用Markdown格式，可以使用列表、加粗等格式增强可读性，但避免使用标题。
6. 直接输出进展内容，不要包含"好的"、"以下是..."等客套话。

【KR信息】
标题: ${kr.title}
描述: ${kr.description || '无'}

`;
        
        if (kr.overall_progress && kr.overall_progress.content) {
            context += `【已有整体进展】
${kr.overall_progress.content}

`;
        } else {
            context += `【已有整体进展】
无

`;
        }
        
        if (kr.weekly_progress && kr.weekly_progress.length > 0) {
            context += `【本周及历史进展记录】
`;
            // 取最近的5条周进展
            kr.weekly_progress.slice(0, 5).forEach((p, index) => {
                context += `${index + 1}. [${formatDate(p.created_at)}] ${p.content}
`;
            });
        } else {
            context += `【本周及历史进展记录】
无
`;
        }

        // 4. 打开模态框并清空内容
        currentAIKrId = krId;
        currentAIDraft = '';
        const aiDraftContent = document.getElementById('aiDraftContent');
        const aiDraftTextarea = document.getElementById('aiDraftTextarea');
        aiDraftContent.innerHTML = '<div class="flex items-center justify-center py-8"><i class="fas fa-spinner fa-spin text-purple-600 text-2xl mr-3"></i><span class="text-gray-500">AI正在思考并整理进展...</span></div>';
        aiDraftTextarea.value = '';
        
        // 重置为预览模式
        switchAIView('preview');
        
        openModal('aiModal');

        // 5. 调用AI接口
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: [
                    { role: 'user', content: '请根据上述上下文，帮我生成一份新的整体进展汇总。' }
                ],
                context: context
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`请求失败 (${response.status}): ${errorText}`);
        }
        
        // 6. 处理流式响应
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let aiResponseText = '';
        let isFirstChunk = true;
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            aiResponseText += chunk;
            
            // 收到第一个chunk时清空loading
            if (isFirstChunk && aiResponseText.trim()) {
                aiDraftContent.innerHTML = '';
                isFirstChunk = false;
            }
            
            // 实时渲染到预览区
            aiDraftContent.innerHTML = marked.parse(aiResponseText);
            
            // 同时更新编辑区的文本
            aiDraftTextarea.value = aiResponseText;
            
            // 滚动到底部
            const modalContent = aiDraftContent.parentElement;
            if (modalContent) {
                modalContent.scrollTop = modalContent.scrollHeight;
            }
        }
        
        currentAIDraft = aiResponseText;
        
    } catch (error) {
        console.error('AI生成失败:', error);
        showToast(`AI生成失败: ${error.message}`, 'error');
        closeModal('aiModal');
    } finally {
        if (button) {
            button.innerHTML = originalBtnContent;
            button.disabled = false;
        }
    }
}

async function confirmAIDraft() {
    if (!currentAIKrId) return;
    
    // 从编辑框获取最终内容（如果用户编辑过）
    const aiDraftTextarea = document.getElementById('aiDraftTextarea');
    const finalContent = aiDraftTextarea ? aiDraftTextarea.value.trim() : currentAIDraft;
    
    if (!finalContent) {
        showToast('内容不能为空', 'error');
        return;
    }
    
    // 使用 Cherry 编辑器的 API 设置内容
    const editorId = `overall-editor-${currentAIKrId}`;
    
    // 如果编辑器已存在，直接设置内容
    if (personalOkrEditors.has(editorId)) {
        setPersonalEditorValue(editorId, finalContent);
    } else {
        // 如果编辑器不存在，先初始化编辑器再设置内容
        initOverallEditor(currentAIKrId, finalContent);
    }
    
    closeModal('aiModal');
    
    // 延迟一下再保存，确保编辑器内容已更新
    setTimeout(async () => {
        await saveOverallProgress(currentAIKrId);
        currentAIKrId = null;
        currentAIDraft = '';
    }, 100);
}

// AI模态框视图切换函数
function switchAIView(mode) {
    const previewDiv = document.getElementById('aiDraftPreview');
    const editDiv = document.getElementById('aiDraftEdit');
    const previewBtn = document.getElementById('aiPreviewBtn');
    const editBtn = document.getElementById('aiEditBtn');
    const aiDraftContent = document.getElementById('aiDraftContent');
    const aiDraftTextarea = document.getElementById('aiDraftTextarea');
    
    if (mode === 'preview') {
        // 切换到预览模式
        previewDiv.classList.remove('hidden');
        editDiv.classList.add('hidden');
        
        // 更新按钮样式
        previewBtn.style.backgroundColor = 'white';
        previewBtn.style.borderColor = 'var(--primary-color)';
        previewBtn.style.color = 'var(--primary-color)';
        
        editBtn.style.backgroundColor = '#f3f4f6';
        editBtn.style.borderColor = '#d1d5db';
        editBtn.style.color = '#6b7280';
        
        // 如果编辑框有内容，同步到预览区
        if (aiDraftTextarea && aiDraftTextarea.value.trim()) {
            aiDraftContent.innerHTML = marked.parse(aiDraftTextarea.value);
        }
    } else if (mode === 'edit') {
        // 切换到编辑模式
        previewDiv.classList.add('hidden');
        editDiv.classList.remove('hidden');
        
        // 更新按钮样式
        editBtn.style.backgroundColor = 'white';
        editBtn.style.borderColor = 'var(--primary-color)';
        editBtn.style.color = 'var(--primary-color)';
        
        previewBtn.style.backgroundColor = '#f3f4f6';
        previewBtn.style.borderColor = '#d1d5db';
        previewBtn.style.color = '#6b7280';
        
        // 聚焦到编辑框
        if (aiDraftTextarea) {
            aiDraftTextarea.focus();
        }
    }
}

function jumpToTeamOKR(objId) {
    switchTab('team');
}

function jumpToTeamKR(krId) {
    switchTab('team');
}

async function showRisksInput(krId) {
    const inputContainer = document.getElementById(`risks-input-container-${krId}`);
    const display = document.getElementById(`risks-display-${krId}`);
    
    if (inputContainer) {
        inputContainer.classList.remove('hidden');
    }
    
    if (display) {
        display.classList.add('hidden');
    }
    
    // 获取当前risks_issues内容作为默认值
    let defaultValue = '';
    try {
        const response = await fetch(`/api/user/key-results/${krId}?user_eng_name=${currentUser.EngName}`);
        if (response.ok) {
            const krData = await response.json();
            if (krData.risks_issues) {
                defaultValue = krData.risks_issues;
            }
        }
    } catch (error) {
        console.error('获取风险和问题内容失败:', error);
    }
    
    // 延迟初始化编辑器，确保容器已显示
    setTimeout(() => {
        initRisksEditor(krId, defaultValue);
    }, 100);
}

async function saveRisksIssues(krId) {
    const inputContainer = document.getElementById(`risks-input-container-${krId}`);
    const display = document.getElementById(`risks-display-${krId}`);
    
    // 从 Cherry 编辑器获取内容
    const editorId = `risks-editor-${krId}`;
    const content = getPersonalEditorValue(editorId).trim();
    
    showLoading();
    try {
        const response = await fetch(`/api/user/key-results/${krId}?user_eng_name=${currentUser.EngName}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ risks_issues: content })
        });
        
        if (response.ok) {
            showToast('保存成功', 'success');
            // 清空编辑器并销毁
            destroyPersonalEditor(editorId);
            
            // 隐藏输入容器，显示显示区域
            if (inputContainer) {
                inputContainer.classList.add('hidden');
            }
            if (display) {
                display.classList.remove('hidden');
            }
            
            // 修复：调用loadPersonalOKR()而不是loadKRProgress(krId)，确保risks_issues正确刷新
            await loadPersonalOKR();
        } else {
            const error = await response.json();
            throw new Error(error.detail || '保存失败');
        }
    } catch (error) {
        console.error('保存风险和问题失败:', error);
        showToast(error.message || '保存失败', 'error');
    } finally {
        hideLoading();
    }
}

function cancelRisksInput(krId) {
    const inputContainer = document.getElementById(`risks-input-container-${krId}`);
    const display = document.getElementById(`risks-display-${krId}`);
    
    // 销毁编辑器
    const editorId = `risks-editor-${krId}`;
    destroyPersonalEditor(editorId);
    
    // 总是隐藏输入容器
    if (inputContainer) {
        inputContainer.classList.add('hidden');
    }
    
    // 如果有内容则显示display
    const hasContent = display && !display.classList.contains('hidden');
    if (hasContent || (display && display.innerHTML.trim() !== '')) {
        if (display) {
            display.classList.remove('hidden');
        }
    }
}

async function deleteRisksIssues(krId) {
    if (!confirm('确认删除该风险和问题？删除后将无法恢复。')) return;
    
    showLoading();
    try {
        const response = await fetch(`/api/user/key-results/${krId}?user_eng_name=${currentUser.EngName}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ risks_issues: '' })
        });
        
        if (response.ok) {
            showToast('删除成功', 'success');
            
            // 隐藏输入容器（如果正在显示）
            const inputContainer = document.getElementById(`risks-input-container-${krId}`);
            const display = document.getElementById(`risks-display-${krId}`);
            const textarea = document.getElementById(`risks-${krId}`);
            
            if (textarea) {
                textarea.value = '';
            }
            
            if (inputContainer) {
                inputContainer.classList.add('hidden');
            }
            if (display) {
                display.classList.add('hidden');
            }
            
            // 修复：调用loadPersonalOKR()而不是loadKRProgress(krId)，确保risks_issues正确刷新
            await loadPersonalOKR();
        } else {
            const error = await response.json();
            throw new Error(error.detail || '删除失败');
        }
    } catch (error) {
        console.error('删除风险和问题失败:', error);
        showToast(error.message || '删除失败', 'error');
    } finally {
        hideLoading();
    }
}

// ==================== Cherry Markdown 编辑器管理 ====================

// 存储个人OKR页面的编辑器实例
const personalOkrEditors = new Map();

/**
 * 初始化周进展编辑器
 */
function initWeeklyEditor(krId, initialValue = '') {
    const editorId = `weekly-editor-${krId}`;
    const containerId = `weekly-${krId}`;
    
    // 销毁旧编辑器
    destroyPersonalEditor(editorId);
    
    // 查找容器（可能是textarea或已经是div）
    let container = document.getElementById(containerId);
    let editorContainer = document.getElementById(editorId);
    
    if (!container && !editorContainer) {
        console.error(`找不到容器 ${containerId} 或 ${editorId}`);
        return;
    }
    
    // 如果编辑器容器已存在，直接使用
    if (editorContainer) {
        editorContainer.innerHTML = '';
    } else if (container) {
        // 如果是textarea，替换为编辑器容器
        const parent = container.parentElement;
        editorContainer = document.createElement('div');
        editorContainer.id = editorId;
        editorContainer.className = 'cherry-editor-container';
        parent.replaceChild(editorContainer, container);
    }
    
    // 创建编辑器
    const editor = createSimpleCherryEditor(editorId, {
        value: initialValue,
        height: '250px',
        fileUpload: cherryFileUploadCallback,
    });
    
    personalOkrEditors.set(editorId, editor);
    return editor;
}

/**
 * 初始化风险和问题编辑器
 */
function initRisksEditor(krId, initialValue = '') {
    const editorId = `risks-editor-${krId}`;
    const containerId = `risks-${krId}`;
    
    destroyPersonalEditor(editorId);
    
    // 查找容器（可能是textarea或已经是div）
    let container = document.getElementById(containerId);
    let editorContainer = document.getElementById(editorId);
    
    if (!container && !editorContainer) {
        console.error(`找不到容器 ${containerId} 或 ${editorId}`);
        return;
    }
    
    // 如果编辑器容器已存在，直接使用
    if (editorContainer) {
        editorContainer.innerHTML = '';
    } else if (container) {
        // 如果是textarea，替换为编辑器容器
        const parent = container.parentElement;
        editorContainer = document.createElement('div');
        editorContainer.id = editorId;
        editorContainer.className = 'cherry-editor-container';
        parent.replaceChild(editorContainer, container);
    }
    
    const editor = createSimpleCherryEditor(editorId, {
        value: initialValue,
        height: '250px',
        fileUpload: cherryFileUploadCallback,
    });
    
    personalOkrEditors.set(editorId, editor);
    return editor;
}

/**
 * 初始化下周计划编辑器
 */
function initNextWeekEditor(krId, initialValue = '') {
    const editorId = `next-week-editor-${krId}`;
    const containerId = `next-week-${krId}`;
    
    destroyPersonalEditor(editorId);
    
    // 查找容器（可能是textarea或已经是div）
    let container = document.getElementById(containerId);
    let editorContainer = document.getElementById(editorId);
    
    if (!container && !editorContainer) {
        console.error(`找不到容器 ${containerId} 或 ${editorId}`);
        return;
    }
    
    // 如果编辑器容器已存在，直接使用
    if (editorContainer) {
        editorContainer.innerHTML = '';
    } else if (container) {
        // 如果是textarea，替换为编辑器容器
        const parent = container.parentElement;
        editorContainer = document.createElement('div');
        editorContainer.id = editorId;
        editorContainer.className = 'cherry-editor-container';
        parent.replaceChild(editorContainer, container);
    }
    
    const editor = createSimpleCherryEditor(editorId, {
        value: initialValue,
        height: '250px',
        fileUpload: cherryFileUploadCallback,
    });
    
    personalOkrEditors.set(editorId, editor);
    return editor;
}

/**
 * 初始化整体进展编辑器
 */
function initOverallEditor(krId, initialValue = '') {
    const editorId = `overall-editor-${krId}`;
    const containerId = `overall-${krId}`;
    
    destroyPersonalEditor(editorId);
    
    // 查找容器（可能是textarea或已经是div）
    let container = document.getElementById(containerId);
    let editorContainer = document.getElementById(editorId);
    
    if (!container && !editorContainer) {
        console.error(`找不到容器 ${containerId} 或 ${editorId}`);
        return;
    }
    
    // 如果编辑器容器已存在，直接使用
    if (editorContainer) {
        editorContainer.innerHTML = '';
    } else if (container) {
        // 如果是textarea，替换为编辑器容器
        const parent = container.parentElement;
        editorContainer = document.createElement('div');
        editorContainer.id = editorId;
        editorContainer.className = 'cherry-editor-container';
        parent.replaceChild(editorContainer, container);
    }
    
    const editor = createSimpleCherryEditor(editorId, {
        value: initialValue,
        height: '300px',
        fileUpload: cherryFileUploadCallback,
    });
    
    personalOkrEditors.set(editorId, editor);
    return editor;
}

/**
 * 获取编辑器内容
 */
function getPersonalEditorValue(editorId) {
    const editor = personalOkrEditors.get(editorId);
    return editor ? editor.getValue() : '';
}

/**
 * 设置编辑器内容
 */
function setPersonalEditorValue(editorId, value) {
    const editor = personalOkrEditors.get(editorId);
    if (editor) {
        editor.setValue(value || '');
    }
}

/**
 * 销毁编辑器
 */
function destroyPersonalEditor(editorId) {
    if (personalOkrEditors.has(editorId)) {
        destroyCherryEditor(editorId);
        personalOkrEditors.delete(editorId);
    }
}

/**
 * 在显示输入框时初始化编辑器
 */
function showWeeklyInputWithEditor(krId) {
    const container = document.getElementById(`weekly-input-container-${krId}`);
    if (container) {
        container.classList.remove('hidden');
        
        // 延迟初始化编辑器，确保容器已显示
        setTimeout(() => {
            // 获取上周进展作为默认值
            const latestDisplay = document.getElementById(`weekly-latest-${krId}`);
            let defaultValue = '';
            if (latestDisplay && !latestDisplay.classList.contains('hidden')) {
                const contentDiv = latestDisplay.querySelector('.markdown-content');
                if (contentDiv) {
                    // 尝试从 data 属性获取原始 markdown
                    defaultValue = contentDiv.dataset.markdown || '';
                }
            }
            
            initWeeklyEditor(krId, defaultValue);
        }, 100);
    }
}

function showRisksInputWithEditor(krId) {
    const container = document.getElementById(`risks-input-container-${krId}`);
    if (container) {
        container.classList.remove('hidden');
        
        setTimeout(() => {
            // 获取当前风险内容作为默认值
            const display = document.getElementById(`risks-display-${krId}`);
            let defaultValue = '';
            if (display && !display.classList.contains('hidden')) {
                const contentDiv = display.querySelector('.markdown-content');
                if (contentDiv) {
                    defaultValue = contentDiv.dataset.markdown || '';
                }
            }
            
            initRisksEditor(krId, defaultValue);
        }, 100);
    }
}

function showNextWeekInputWithEditor(krId) {
    const container = document.getElementById(`next-week-input-container-${krId}`);
    if (container) {
        container.classList.remove('hidden');
        
        setTimeout(() => {
            // 获取当前计划内容作为默认值
            const display = document.getElementById(`next-week-display-${krId}`);
            let defaultValue = '';
            if (display && !display.classList.contains('hidden')) {
                const contentDiv = display.querySelector('.markdown-content');
                if (contentDiv) {
                    defaultValue = contentDiv.dataset.markdown || '';
                }
            }
            
            initNextWeekEditor(krId, defaultValue);
        }, 100);
    }
}

function showOverallInputWithEditor(krId) {
    const container = document.getElementById(`overall-input-container-${krId}`);
    if (container) {
        container.classList.remove('hidden');
        
        setTimeout(() => {
            // 获取当前整体进展作为默认值
            const display = document.getElementById(`overall-display-${krId}`);
            let defaultValue = '';
            if (display && !display.classList.contains('hidden')) {
                const contentDiv = display.querySelector('.markdown-content');
                if (contentDiv) {
                    defaultValue = contentDiv.dataset.markdown || '';
                }
            }
            
            initOverallEditor(krId, defaultValue);
        }, 100);
    }
}