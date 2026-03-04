// ==================== 演讲者模式相关 ====================

// 进入演讲者模式
async function enterPresenterMode() {
    try {
        // 确保有团队OKR数据
        if (!teamObjectivesData) {
            showLoading();
            const response = await fetch('/api/team/objectives');
            if (!response.ok) {
                throw new Error('加载团队OKR失败');
            }
            const data = await response.json();
            teamObjectivesData = data.objectives;
            hideLoading();
        }
        
        // 显示演讲者模式遮罩
        const overlay = document.getElementById('presenterModeOverlay');
        if (overlay) {
            overlay.classList.remove('hidden');
        }
        document.body.classList.add('presenter-mode');
        
        // 禁用页面滚动
        document.body.style.overflow = 'hidden';
        
        // 绑定键盘事件
        document.addEventListener('keydown', handlePresenterKeydown);
        
        // 渲染演讲者模式内容（异步，不阻塞显示）
        renderPresenterContent();
    } catch (error) {
        console.error('进入演讲者模式失败:', error);
        showToast('进入演讲者模式失败: ' + error.message, 'error');
        hideLoading();
    }
}

// 退出演讲者模式
function exitPresenterMode() {
    const overlay = document.getElementById('presenterModeOverlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
    document.body.classList.remove('presenter-mode');
    document.body.style.overflow = '';
    
    // 移除键盘事件监听
    document.removeEventListener('keydown', handlePresenterKeydown);
    // 移除resize事件监听
    window.removeEventListener('resize', updatePresenterTodoCardsPosition);
}

// 处理演讲者模式键盘事件
function handlePresenterKeydown(event) {
    if (event.key === 'Escape') {
        exitPresenterMode();
    }
}

// 渲染演讲者模式内容
async function renderPresenterContent() {
    const container = document.getElementById('presenterContent');
    
    if (!teamObjectivesData || teamObjectivesData.length === 0) {
        container.innerHTML = '<div class="text-center text-white text-2xl">暂无团队OKR数据</div>';
        return;
    }
    
    // 显示加载提示
    container.innerHTML = '<div class="text-center text-white text-xl"><i class="fas fa-spinner fa-spin mr-2"></i>加载进展数据...</div>';
    
    // 优先使用缓存的KR认领数据，避免重复请求
    let krClaimsData = { claims: [] };
    if (krClaimsCache && krClaimsCache.claims) {
        krClaimsData = krClaimsCache;
    } else {
        try {
            const claimsResponse = await fetch('/api/team/kr-claims');
            if (claimsResponse.ok) {
                krClaimsData = await claimsResponse.json();
                krClaimsCache = krClaimsData; // 缓存数据
            }
        } catch (error) {
            console.warn('获取KR认领数据失败:', error);
        }
    }
    
    // 收集所有需要获取进展的用户
    const userSet = new Set();
    if (krClaimsData.claims) {
        krClaimsData.claims.forEach(claim => {
            userSet.add(claim.user_eng_name);
        });
    }
    
    // 批量获取所有用户的进展数据
    let batchProgressData = { data: [] };
    if (userSet.size > 0) {
        try {
            const userEngNames = Array.from(userSet).join(',');
            const batchResponse = await fetch(`/api/progress/batch?user_eng_names=${encodeURIComponent(userEngNames)}`);
            if (batchResponse.ok) {
                batchProgressData = await batchResponse.json();
            }
        } catch (error) {
            console.warn('批量获取进展数据失败:', error);
        }
    }
    
    // 构建用户KR数据的映射表，方便快速查找
    const userKRMap = new Map();
    batchProgressData.data.forEach(kr => {
        const key = `${kr.user_eng_name}_${kr.source_kr_id}`;
        userKRMap.set(key, kr);
    });
    
    let htmlContent = '';
    
    // 遍历所有Objective
    for (let objIndex = 0; objIndex < teamObjectivesData.length; objIndex++) {
        const obj = teamObjectivesData[objIndex];
        
        htmlContent += `
            <div class="objective-card">
                <div class="objective-header">
                    <h2 class="objective-title">
                        <span style="color: #0052D9;">O${objIndex + 1}:</span> ${escapeHtml(obj.title)}
                    </h2>
                    <div class="flex items-center space-x-3 mt-3">
                        <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                            obj.obj_type === '业务' ? 'bg-blue-100 text-blue-800' :
                            obj.obj_type === '管理' ? 'bg-green-100 text-green-800' :
                            'bg-purple-100 text-purple-800'
                        }">
                            ${escapeHtml(obj.obj_type || '业务')}
                        </span>
                        <span class="text-base text-gray-600">
                            <i class="fas fa-weight-hanging mr-1"></i>权重: ${obj.weight || 0}%
                        </span>
                    </div>
                </div>
        `;
        
        // 遍历所有KR
        if (obj.key_results && obj.key_results.length > 0) {
            for (let krIndex = 0; krIndex < obj.key_results.length; krIndex++) {
                const kr = obj.key_results[krIndex];
                
                htmlContent += `
                    <div class="kr-item">
                        <h3 class="kr-title">
                            <span>KR${krIndex + 1}:</span> ${escapeHtml(kr.title)}
                        </h3>
                `;
                
                // 获取认领该KR的所有成员
                const krClaims = krClaimsData.claims ? krClaimsData.claims.filter(c => c.kr_id === kr.id) : [];
                
                if (krClaims.length === 0) {
                    htmlContent += `
                        <div class="text-gray-500 text-base">暂无成员认领该KR</div>
                    `;
                } else {
                    // 按用户英文名字母序排序
                    krClaims.sort((a, b) => a.user_eng_name.localeCompare(b.user_eng_name));
                    
                    // 渲染每个成员的进展（使用批量数据，无需额外请求）
                    htmlContent += '<div class="space-y-4">';
                    
                    for (const claim of krClaims) {
                        htmlContent += renderPresenterMemberProgressFromBatch(claim, kr.id, kr.title, userKRMap);
                    }
                    
                    htmlContent += '</div>';
                }
                
                htmlContent += '</div>';
            }
        } else {
            htmlContent += '<div class="text-gray-500 text-base">暂无Key Results</div>';
        }
        
        htmlContent += '</div>';
    }
    
    container.innerHTML = htmlContent;
    
    // 渲染完成后，计算待办卡片的位置
    setTimeout(updatePresenterTodoCardsPosition, 100);
    
    // 监听窗口大小变化，重新计算位置
    window.addEventListener('resize', updatePresenterTodoCardsPosition);
}

// 更新演讲者模式待办卡片的位置
function updatePresenterTodoCardsPosition() {
    const contentContainer = document.querySelector('#presenterModeOverlay .presenter-content');
    const todoCardsContainers = document.querySelectorAll('#presenterModeOverlay .presenter-todo-cards');
    
    if (!contentContainer || todoCardsContainers.length === 0) return;
    
    const contentRect = contentContainer.getBoundingClientRect();
    // 内容区域右边缘相对于视口的X坐标
    const targetRight = contentRect.right;
    
    // 屏幕右边缘相对于视口的X坐标
    const screenRight = window.innerWidth;
    
    todoCardsContainers.forEach(container => {
        // 获取父元素（周进展容器）的位置信息
        const parentRect = container.parentElement.getBoundingClientRect();
        
        // 计算相对于父元素的left值
        // 目标绝对位置(内容区域右侧) - 父元素绝对位置 = 相对位置
        // 加上间距(20px)，使其位于内容区域右侧
        const relativeLeft = targetRight - parentRect.left + 20;
        
        container.style.left = `${relativeLeft}px`;
        container.style.opacity = '1'; // 显示卡片
        
        // 为每个待办卡片计算悬停时的偏移量
        const todoCards = container.querySelectorAll('.presenter-todo-card');
        todoCards.forEach(card => {
            const cardRect = card.getBoundingClientRect();
            // 计算卡片右边缘到屏幕右边缘的距离
            const distanceToScreenRight = screenRight - cardRect.right;
            
            // 只有当卡片右边缘超出屏幕（distanceToScreenRight < 0）时才设置悬停偏移量
            if (distanceToScreenRight < 0) {
                card.style.setProperty('--hover-offset', `${distanceToScreenRight}px`);
            } else {
                card.style.setProperty('--hover-offset', `0px`);
            }
        });
    });
}

// 渲染演讲者模式中的单个成员进展（从批量数据中获取，无需额外请求）
function renderPresenterMemberProgressFromBatch(claim, krId, krTitle, userKRMap) {
    // 从映射表中查找对应的KR数据
    const key = `${claim.user_eng_name}_${krId}`;
    const krData = userKRMap.get(key);
    
    // 如果找不到数据，显示暂无进展
    if (!krData) {
        return `
            <div class="member-progress">
                <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center space-x-3">
                        <img src="https://r.hrc.woa.com/photo/150/${claim.user_eng_name}.png?default_when_absent=true" 
                             alt="${claim.user_chn_name}" 
                             class="w-12 h-12 rounded-full">
                        <span class="font-bold text-gray-900 text-lg">
                            ${escapeHtml(claim.user_eng_name)}(${escapeHtml(claim.user_chn_name)})
                        </span>
                    </div>
                    <button onclick="openCreateTodoModal('${claim.user_eng_name}', '${claim.user_chn_name}', '')"
                            class="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center">
                        <i class="fas fa-plus mr-1"></i>创建待办
                    </button>
                </div>
                
                <div class="text-gray-500">暂无进展记录</div>
            </div>
        `;
    }
    
    // 获取最新周进展
    const latestWeekly = krData.weekly_progress && krData.weekly_progress.length > 0 ? krData.weekly_progress[0] : null;
    
    // 获取整体进展
    const overall = krData.overall_progress;
    
    // 获取下周计划
    const nextWeekPlan = krData.next_week_plan;
    
    let htmlContent = `
        <div class="member-progress">
            <div class="flex items-center justify-between mb-4">
                <div class="flex items-center space-x-3">
                    <img src="https://r.hrc.woa.com/photo/150/${claim.user_eng_name}.png?default_when_absent=true" 
                         alt="${claim.user_chn_name}" 
                         class="w-12 h-12 rounded-full">
                    <span class="font-bold text-gray-900 text-lg">
                        ${escapeHtml(claim.user_eng_name)}(${escapeHtml(claim.user_chn_name)})
                    </span>
                </div>
                <button onclick="openCreateTodoModal('${claim.user_eng_name}', '${claim.user_chn_name}', '')"
                        class="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center">
                    <i class="fas fa-plus mr-1"></i>创建待办
                </button>
            </div>
    `;
    
    // 本周进展 - 添加相对定位容器，用于放置待办小卡片
    htmlContent += `
        <div class="mb-4 relative">
            <div class="text-sm font-bold text-gray-600 mb-2 flex items-center">
                <i class="fas fa-calendar-week mr-2"></i>本周进展
            </div>
            ${latestWeekly ? `
                <div class="bg-gray-50 p-4 rounded-lg">
                    <div class="text-xs text-gray-400 mb-2">${formatDate(latestWeekly.created_at)}</div>
                    <div class="text-base text-gray-800 markdown-content" onclick="handlePresenterImageClick(event)">
                        ${marked.parse(latestWeekly.content)}
                    </div>
                </div>
                <!-- 待办小卡片容器 - 绝对定位到右侧 -->
                <div id="presenter-todos-weekly-${escapeHtml(claim.user_eng_name)}-${escapeHtml(krId)}" 
                     class="presenter-todo-cards">
                    <div class="text-gray-400 text-xs">加载中...</div>
                </div>
            ` : '<div class="text-gray-500">暂无进展</div>'}
        </div>
    `;
    
    // 风险和问题（突出显示）
    if (krData.risks_issues) {
        htmlContent += `
            <div class="mb-4">
                <div class="text-sm font-bold text-red-600 mb-2 flex items-center">
                    <i class="fas fa-exclamation-triangle mr-2"></i>风险和问题
                </div>
                <div class="bg-red-50 border-2 border-red-300 p-4 rounded-lg">
                    <div class="text-base text-red-900 markdown-content" onclick="handlePresenterImageClick(event)">
                        ${marked.parse(krData.risks_issues)}
                    </div>
                </div>
            </div>
        `;
    }
    
    // 下周计划
    if (nextWeekPlan && nextWeekPlan.content) {
        htmlContent += `
            <div class="mb-4">
                <div class="text-sm font-bold text-gray-600 mb-2 flex items-center">
                    <i class="fas fa-calendar-alt mr-2"></i>下周计划
                </div>
                <div class="bg-gray-50 p-4 rounded-lg">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-sm font-medium text-gray-600">
                            <i class="fas fa-clock mr-1"></i>预计占用人天：<span class="text-purple-600 font-bold">${nextWeekPlan.estimated_man_days || 0}</span> 天
                        </span>
                        <span class="text-xs text-gray-400">${formatDate(nextWeekPlan.updated_at)}</span>
                    </div>
                    <div class="text-base text-gray-800 markdown-content" onclick="handlePresenterImageClick(event)">
                        ${marked.parse(nextWeekPlan.content)}
                    </div>
                </div>
            </div>
        `;
    }
    
    // 整体进展
    htmlContent += `
        <div>
            <div class="text-sm font-bold text-gray-600 mb-2 flex items-center">
                <i class="fas fa-chart-line mr-2"></i>整体进展
            </div>
            ${overall && overall.content ? `
                <div class="bg-gray-50 p-4 rounded-lg">
                    <div class="text-xs text-gray-400 mb-2">${formatDate(overall.updated_at)}</div>
                    <div class="text-base text-gray-800 markdown-content" onclick="handlePresenterImageClick(event)">
                        ${marked.parse(overall.content)}
                    </div>
                </div>
            ` : '<div class="text-gray-500">暂无进展</div>'}
        </div>
    `;
    
    htmlContent += '</div>';
    
    // 异步加载该用户该KR的待办事项，显示在周进展旁边
    setTimeout(() => loadPresenterTodosByWeekly(claim.user_eng_name, krId), 0);
    
    return htmlContent;
}

// 渲染演讲者模式中的单个成员进展
async function renderPresenterMemberProgress(claim, krId, krTitle) {
    try {
        // 获取该用户的个人KR
        const userResponse = await fetch(`/api/user/objectives?user_eng_name=${claim.user_eng_name}`);
        if (!userResponse.ok) {
            return `
                <div class="member-progress">
                    <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center space-x-3">
                            <img src="https://r.hrc.woa.com/photo/150/${claim.user_eng_name}.png?default_when_absent=true" 
                                 alt="${claim.user_chn_name}" 
                                 class="w-12 h-12 rounded-full">
                            <span class="font-bold text-gray-900 text-lg">
                                ${escapeHtml(claim.user_eng_name)}(${escapeHtml(claim.user_chn_name)})
                            </span>
                        </div>
                        <button onclick="openCreateTodoModal('${claim.user_eng_name}', '${claim.user_chn_name}', '')"
                                class="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center">
                            <i class="fas fa-plus mr-1"></i>创建待办
                        </button>
                    </div>
                    
                    <div class="text-gray-500">暂无进展记录</div>
                </div>
            `;
        }
        
        const userData = await userResponse.json();
        
        // 查找对应的个人KR
        let userKR = null;
        for (const obj of userData.objectives) {
            if (obj.key_results) {
                const found = obj.key_results.find(k => k.source_kr_id === krId);
                if (found) {
                    userKR = found;
                    break;
                }
            }
        }
        
        if (!userKR) {
            return `
                <div class="member-progress">
                    <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center space-x-3">
                            <img src="https://r.hrc.woa.com/photo/150/${claim.user_eng_name}.png?default_when_absent=true" 
                                 alt="${claim.user_chn_name}" 
                                 class="w-12 h-12 rounded-full">
                            <span class="font-bold text-gray-900 text-lg">
                                ${escapeHtml(claim.user_eng_name)}(${escapeHtml(claim.user_chn_name)})
                            </span>
                        </div>
                        <button onclick="openCreateTodoModal('${claim.user_eng_name}', '${claim.user_chn_name}', '')"
                                class="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center">
                            <i class="fas fa-plus mr-1"></i>创建待办
                        </button>
                    </div>
                    
                    <div class="text-gray-500">暂无进展记录</div>
                </div>
            `;
        }
        
        // 获取进展数据
        const [weeklyResponse, overallResponse] = await Promise.all([
            fetch(`/api/progress/weekly/${userKR.id}`),
            fetch(`/api/progress/overall/${userKR.id}?user_eng_name=${claim.user_eng_name}`)
        ]);
        
        const weeklyData = weeklyResponse.ok ? await weeklyResponse.json() : { progress: [] };
        const overallData = overallResponse.ok ? await overallResponse.json() : { content: '' };
        
        // 获取最新周进展
        const latestWeekly = weeklyData.progress && weeklyData.progress.length > 0 ? weeklyData.progress[0] : null;
        
        // 获取下周计划
        let nextWeekPlan = null;
        try {
            const nextWeekResponse = await fetch(`/api/progress/next-week-plan/${userKR.id}?user_eng_name=${claim.user_eng_name}`);
            if (nextWeekResponse.ok) {
                nextWeekPlan = await nextWeekResponse.json();
            }
        } catch (error) {
            console.warn('获取下周计划失败:', error);
        }
        
        let htmlContent = `
            <div class="member-progress">
                <div class="flex items-center space-x-3 mb-4">
                    <img src="https://r.hrc.woa.com/photo/150/${claim.user_eng_name}.png?default_when_absent=true" 
                         alt="${claim.user_chn_name}" 
                         class="w-12 h-12 rounded-full">
                    <span class="font-bold text-gray-900 text-lg">
                        ${escapeHtml(claim.user_eng_name)}(${escapeHtml(claim.user_chn_name)})
                    </span>
                </div>
        `;
        
        // 本周进展
        htmlContent += `
            <div class="mb-4">
                <div class="text-sm font-bold text-gray-600 mb-2 flex items-center">
                    <i class="fas fa-calendar-week mr-2"></i>本周进展
                </div>
                ${latestWeekly ? `
                    <div class="bg-gray-50 p-4 rounded-lg">
                        <div class="text-xs text-gray-400 mb-2">${formatDate(latestWeekly.created_at)}</div>
                        <div class="text-base text-gray-800 markdown-content" onclick="handlePresenterImageClick(event)">
                            ${marked.parse(latestWeekly.content)}
                        </div>
                    </div>
                ` : '<div class="text-gray-500">暂无进展</div>'}
            </div>
        `;
        
        // 下周计划
        if (nextWeekPlan && nextWeekPlan.content) {
            htmlContent += `
                <div class="mb-4">
                    <div class="text-sm font-bold text-gray-600 mb-2 flex items-center">
                        <i class="fas fa-calendar-alt mr-2"></i>下周计划
                    </div>
                    <div class="bg-gray-50 p-4 rounded-lg">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-sm font-medium text-gray-600">
                                <i class="fas fa-clock mr-1"></i>预计占用人天：<span class="text-purple-600 font-bold">${nextWeekPlan.estimated_man_days || 0}</span> 天
                            </span>
                            <span class="text-xs text-gray-400">${formatDate(nextWeekPlan.updated_at)}</span>
                        </div>
                        <div class="text-base text-gray-800 markdown-content" onclick="handlePresenterImageClick(event)">
                            ${marked.parse(nextWeekPlan.content)}
                        </div>
                    </div>
                </div>
            `;
        }
        
        // 整体进展
        htmlContent += `
            <div>
                <div class="text-sm font-bold text-gray-600 mb-2 flex items-center">
                    <i class="fas fa-chart-line mr-2"></i>整体进展
                </div>
                ${overallData.content ? `
                    <div class="bg-gray-50 p-4 rounded-lg">
                        <div class="text-xs text-gray-400 mb-2">${formatDate(overallData.updated_at)}</div>
                        <div class="text-base text-gray-800 markdown-content" onclick="handlePresenterImageClick(event)">
                            ${marked.parse(overallData.content)}
                        </div>
                    </div>
                ` : '<div class="text-gray-500">暂无进展</div>'}
            </div>
        `;
        
        htmlContent += '</div>';
        
        return htmlContent;
    } catch (error) {
        console.error('渲染成员进展失败:', error);
        return `
            <div class="member-progress">
                <div class="flex items-center space-x-3 mb-3">
                    <img src="https://r.hrc.woa.com/photo/150/${claim.user_eng_name}.png?default_when_absent=true" 
                         alt="${claim.user_chn_name}" 
                         class="w-12 h-12 rounded-full">
                    <span class="font-bold text-gray-900 text-lg">
                        ${escapeHtml(claim.user_eng_name)}(${escapeHtml(claim.user_chn_name)})
                    </span>
                </div>
                <div class="text-red-500">加载失败: ${error.message || '未知错误'}</div>
            </div>
        `;
    }
}

// 处理演讲者模式中的图片点击
function handlePresenterImageClick(event) {
    if (event.target.tagName === 'IMG') {
        openPresenterImageModal(event.target.src);
    }
}

// 打开演讲者模式的图片放大模态框
function openPresenterImageModal(imageSrc) {
    // 创建或更新图片模态框
    let imageModal = document.getElementById('presenterImageModal');
    if (!imageModal) {
        imageModal = document.createElement('div');
        imageModal.id = 'presenterImageModal';
        imageModal.className = 'modal';
        imageModal.style.zIndex = '10001';
        imageModal.innerHTML = `
            <div class="relative max-w-5xl max-h-screen mx-4">
                <button onclick="closePresenterImageModal()" 
                        class="absolute -top-10 right-0 text-white text-2xl hover:text-gray-300 z-10">
                    <i class="fas fa-times"></i>
                </button>
                <img id="presenterImageModalImg" src="" alt="放大图片" 
                     class="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl">
            </div>
        `;
        imageModal.addEventListener('click', (e) => {
            if (e.target === imageModal) {
                closePresenterImageModal();
            }
        });
        document.body.appendChild(imageModal);
    }
    
    document.getElementById('presenterImageModalImg').src = imageSrc;
    imageModal.classList.add('active');
}

// 关闭演讲者模式的图片模态框
function closePresenterImageModal() {
    const imageModal = document.getElementById('presenterImageModal');
    if (imageModal) {
        imageModal.classList.remove('active');
    }
}

// 加载演讲者模式中某个用户某个KR的待办事项，显示在周进展旁边
async function loadPresenterTodosByWeekly(userEngName, krId) {
    const container = document.getElementById(`presenter-todos-weekly-${escapeHtml(userEngName)}-${escapeHtml(krId)}`);
    if (!container) return;
    
    try {
        // 获取所有未完成的待办
        const response = await fetch('/api/todos?status=pending&sort_by=created_at&sort_order=desc');
        if (!response.ok) {
            throw new Error('加载待办失败');
        }
        
        const data = await response.json();
        
        // 筛选出该用户的待办
        const userTodos = data.todos.filter(todo => todo.assignee_eng_name === userEngName);
        
        if (userTodos.length === 0) {
            container.innerHTML = '';
            return;
        }
        
        // 渲染待办小卡片列表
        container.innerHTML = userTodos.map(todo => `
            <div class="presenter-todo-card">
                <div class="text-xs text-gray-700 mb-1 markdown-content line-clamp-2" 
                     onclick="handlePresenterImageClick(event)">
                    ${marked.parse(todo.description || '无内容')}
                </div>
                
                <div class="flex items-center justify-between">
                    <span class="text-xs text-gray-400">${formatDate(todo.created_at)}</span>
                    
                    <button onclick="editPresenterTodo(${todo.id}, '${userEngName}', '${krId}')"
                            class="text-xs px-2 py-0.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="编辑">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
        // 渲染完成后，重新计算位置以便为每个待办卡片设置悬停偏移量
        setTimeout(updatePresenterTodoCardsPosition, 50);
    } catch (error) {
        console.error('加载待办失败:', error);
        container.innerHTML = '';
    }
}

// 加载演讲者模式右侧侧边栏的所有待办事项（已废弃）
async function loadPresenterTodosSidebar() {
    // 此函数已废弃，待办事项现在显示在周进展旁边
}

// 编辑演讲者模式中的待办
async function editPresenterTodo(todoId, userEngName, krId) {
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
        
        // 创建编辑模态框
        let modal = document.getElementById('presenterEditTodoModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'presenterEditTodoModal';
            modal.className = 'modal';
            modal.style.zIndex = '10001';
            modal.innerHTML = `
                <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl mx-4">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-xl font-bold text-gray-900">编辑待办</h3>
                        <button onclick="closePresenterEditTodoModal()" class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    <form id="presenterEditTodoForm" onsubmit="handlePresenterEditTodoSubmit(event); return false;">
                        <input type="hidden" id="presenterEditTodoId">
                        <input type="hidden" id="presenterEditTodoUserEngName">
                        <input type="hidden" id="presenterEditTodoKrId">
                        
                        <div class="mb-4">
                            <label class="block text-sm font-medium text-gray-700 mb-2">待办内容 <span class="text-red-500">*</span></label>
                            <textarea id="presenterEditTodoDescription" 
                                      class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" 
                                      rows="6" 
                                      required
                                      placeholder="支持Markdown格式"></textarea>
                        </div>
                        
                        <div class="mb-4">
                            <label class="block text-sm font-medium text-gray-700 mb-2">跟进人</label>
                            <select id="presenterEditTodoAssignee" 
                                    class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" 
                                    required>
                                <option value="">请选择跟进人</option>
                            </select>
                        </div>
                        
                        <div class="flex justify-end space-x-3">
                            <button type="button" 
                                    onclick="closePresenterEditTodoModal()" 
                                    class="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300">
                                取消
                            </button>
                            <button type="submit" 
                                    class="px-4 py-2 text-white rounded-lg" style="background-color: var(--primary-color);" onmouseover="this.style.backgroundColor='var(--primary-hover)'" onmouseout="this.style.backgroundColor='var(--primary-color)'">
                                保存
                            </button>
                        </div>
                    </form>
                </div>
            `;
            document.body.appendChild(modal);
        }
        
        // 填充表单
        document.getElementById('presenterEditTodoId').value = todo.id;
        document.getElementById('presenterEditTodoUserEngName').value = userEngName;
        document.getElementById('presenterEditTodoKrId').value = krId || '';
        document.getElementById('presenterEditTodoDescription').value = todo.description || '';
        
        // 加载成员列表
        await loadMembersToPresenterEditSelect();
        
        // 设置当前待办的跟进人
        const select = document.getElementById('presenterEditTodoAssignee');
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
        
        // 显示模态框
        modal.classList.add('active');
    } catch (error) {
        console.error('加载待办失败:', error);
        showToast(error.message || '加载待办失败', 'error');
    }
}

// 加载成员列表到演讲者模式编辑待办下拉框
async function loadMembersToPresenterEditSelect() {
    const select = document.getElementById('presenterEditTodoAssignee');
    if (!select) return;
    
    try {
        // 获取成员列表
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
        
        const members = Array.from(membersMap.values()).sort((a, b) => 
            a.eng_name.localeCompare(b.eng_name)
        );
        
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

// 关闭演讲者模式编辑待办模态框
function closePresenterEditTodoModal() {
    const modal = document.getElementById('presenterEditTodoModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// 提交演讲者模式编辑待办
async function handlePresenterEditTodoSubmit(event) {
    event.preventDefault();
    
    const todoId = document.getElementById('presenterEditTodoId').value;
    const userEngName = document.getElementById('presenterEditTodoUserEngName').value;
    const krId = document.getElementById('presenterEditTodoKrId').value;
    const description = document.getElementById('presenterEditTodoDescription').value;
    const assigneeSelect = document.getElementById('presenterEditTodoAssignee');
    
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
                title: '',
                description: description,
                assignee_eng_name: assigneeEng,
                assignee_chn_name: assigneeChn
            })
        });
        
        if (response.ok) {
            showToast('更新成功', 'success');
            closePresenterEditTodoModal();
            // 重新加载该用户该KR的待办列表
            if (krId) {
                await loadPresenterTodosByWeekly(userEngName, krId);
            }
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

// 处理演讲者模式中的图片点击
function handlePresenterImageClick(event) {
    if (event.target.tagName === 'IMG') {
        openPresenterImageModal(event.target.src);
    }
}

// 打开演讲者模式的图片放大模态框
function openPresenterImageModal(imageSrc) {
    // 创建或更新图片模态框
    let imageModal = document.getElementById('presenterImageModal');
    if (!imageModal) {
        imageModal = document.createElement('div');
        imageModal.id = 'presenterImageModal';
        imageModal.className = 'modal';
        imageModal.style.zIndex = '10001';
        imageModal.innerHTML = `
            <div class="relative max-w-5xl max-h-screen mx-4">
                <button onclick="closePresenterImageModal()" 
                        class="absolute -top-10 right-0 text-white text-2xl hover:text-gray-300 z-10">
                    <i class="fas fa-times"></i>
                </button>
                <img id="presenterImageModalImg" src="" alt="放大图片" 
                     class="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl">
            </div>
        `;
        imageModal.addEventListener('click', (e) => {
            if (e.target === imageModal) {
                closePresenterImageModal();
            }
        });
        document.body.appendChild(imageModal);
    }
    
    document.getElementById('presenterImageModalImg').src = imageSrc;
    imageModal.classList.add('active');
}

// 关闭演讲者模式的图片模态框
function closePresenterImageModal() {
    const imageModal = document.getElementById('presenterImageModal');
    if (imageModal) {
        imageModal.classList.remove('active');
    }
}