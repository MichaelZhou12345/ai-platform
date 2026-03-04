// ==================== 团队OKR相关 ====================

async function loadTeamOKR() {
    showLoading();
    
    console.log('[loadTeamOKR] 开始加载团队OKR数据');
    
    try {
        // 使用新的批量接口，一次性获取OKR和进展数据
        const response = await fetch('/api/team/objectives-with-progress');
        
        console.log('[loadTeamOKR] API响应状态:', response.status, response.statusText);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('[loadTeamOKR] API返回错误:', {
                status: response.status,
                statusText: response.statusText,
                errorText: errorText
            });
            
            // 尝试使用测试端点
            console.log('[loadTeamOKR] 尝试加载测试数据');
            const testResponse = await fetch('/api/team/objectives/test');
            if (testResponse.ok) {
                const testData = await testResponse.json();
                console.log('[loadTeamOKR] 成功加载测试数据:', testData);
                teamObjectivesData = testData.objectives;
                krClaimsCache = null;
                teamProgressDataCache = {}; // 清空进展缓存
                
                if (currentTeamView === 'list') {
                    renderTeamOKR(teamObjectivesData);
                } else if (currentTeamView === 'card') {
                    renderTeamCardView();
                } else if (currentTeamView === 'mindmap') {
                    renderTeamMindMapView();
                }
                
                showToast('已加载测试数据，数据库连接可能存在问题', 'warning');
                hideLoading();
                return;
            }
            
            throw new Error(`HTTP ${response.status}: ${errorText || '请求失败'}`);
        }
        
        const data = await response.json();
        console.log('[loadTeamOKR] API返回数据结构:', data);
        
        if (!data || typeof data !== 'object') {
            console.error('[loadTeamOKR] 返回数据格式不正确:', data);
            throw new Error('返回数据格式不正确');
        }
        
        if (!Array.isArray(data.objectives)) {
            console.error('[loadTeamOKR] objectives不是数组:', data.objectives);
            throw new Error('返回的objectives字段不是数组');
        }
        
        console.log('[loadTeamOKR] 成功获取', data.objectives.length, '个objectives');
        
        teamObjectivesData = data.objectives; // 缓存OKR数据
        teamProgressDataCache = data.progress_data || {}; // 缓存进展数据
        
        // 清除KR认领缓存，确保获取最新数据
        krClaimsCache = null;
        
        // 根据当前视图渲染
        if (currentTeamView === 'list') {
            renderTeamOKR(teamObjectivesData);
        } else if (currentTeamView === 'card') {
            renderTeamCardView();
        } else if (currentTeamView === 'mindmap') {
            renderTeamMindMapView();
        }
    } catch (error) {
        console.error('[loadTeamOKR] 加载团队OKR失败:', error);
        console.error('[loadTeamOKR] 错误堆栈:', error.stack);
        console.error('[loadTeamOKR] 错误类型:', error.constructor.name);
        console.error('[loadTeamOKR] 错误消息:', error.message);
        console.error('[loadTeamOKR] 完整错误对象:', error);
        
        const errorMessage = error.message || error.toString() || '未知错误';
        showToast(`加载团队OKR失败: ${errorMessage}`, 'error');
    } finally {
        hideLoading();
    }
}

// 跳转到成员视图并筛选指定成员
function jumpToMemberView(userEngName) {
    // 切换到成员视图
    switchTeamView('card');
    
    // 设置筛选器的值
    const filter = document.getElementById('teamMemberFilter');
    if (filter) {
        filter.value = userEngName;
        // 触发筛选
        renderTeamCardView();
    }
    
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 应用进展日期过滤
function applyProgressDateFilter() {
    const filterDate = document.getElementById('progressDateFilter').value;
    if (!filterDate) {
        // 如果没有选择日期，重新加载所有数据
        if (currentTeamView === 'list') {
            loadTeamOKR();
        } else if (currentTeamView === 'card') {
            renderTeamCardView();
        }
        return;
    }
    
    // 重新渲染当前视图
    if (currentTeamView === 'list') {
        loadTeamOKR();
    } else if (currentTeamView === 'card') {
        renderTeamCardView();
    }
}

// 更新日期显示
function updateDateDisplay(input) {
    const display = document.getElementById('dateDisplayText');
    if (!display) return;
    
    if (input.value) {
        display.textContent = input.value;
        display.classList.add('text-gray-900');
        display.classList.remove('text-gray-500');
    } else {
        display.textContent = '选择日期';
        display.classList.add('text-gray-500');
        display.classList.remove('text-gray-900');
    }
}

// 清除进展日期过滤
function clearProgressDateFilter() {
    const input = document.getElementById('progressDateFilter');
    input.value = '';
    updateDateDisplay(input);
    applyProgressDateFilter();
}

// 检查进展是否在日期范围内
function isProgressInDateRange(progressDate) {
    const filterDate = document.getElementById('progressDateFilter').value;
    if (!filterDate) return true;
    
    if (!progressDate) return false;
    
    const filterTimestamp = new Date(filterDate).getTime();
    const progressTimestamp = new Date(progressDate).getTime();
    
    return progressTimestamp >= filterTimestamp;
}

function switchTeamView(view) {
    currentTeamView = view;
    
    // 更新按钮样式
    ['list', 'card', 'mindmap'].forEach(v => {
        const btn = document.getElementById(`view-btn-${v}`);
        if (v === view) {
            btn.classList.remove('text-gray-500', 'bg-transparent');
            btn.classList.add('bg-white', 'shadow-sm', 'text-gray-900');
        } else {
            btn.classList.add('text-gray-500', 'bg-transparent');
            btn.classList.remove('bg-white', 'shadow-sm', 'text-gray-900');
        }
    });
    
    // 切换容器显示
    document.getElementById('teamOkrList').classList.add('hidden');
    document.getElementById('teamCardView').classList.add('hidden');
    document.getElementById('teamMindMapView').classList.add('hidden');
    
    // 控制侧边栏显示（仅列表视图显示目录）
    const sidebar = document.getElementById('teamOkrSidebar');
    if (view === 'list') {
        // 列表视图：在大屏幕显示侧边栏
        sidebar.classList.remove('hidden');
        sidebar.classList.add('xl:block');
        
        // 根据屏幕尺寸初始化目录状态
        initSidebarState();
    } else {
        // 其他视图：隐藏侧边栏
        sidebar.classList.add('hidden');
        sidebar.classList.remove('xl:block');
    }
    
    if (view === 'list') {
        document.getElementById('teamOkrList').classList.remove('hidden');
    } else if (view === 'card') {
        document.getElementById('teamCardView').classList.remove('hidden');
    } else if (view === 'mindmap') {
        document.getElementById('teamMindMapView').classList.remove('hidden');
    }
    
    // 控制筛选器显示
    const filter = document.getElementById('teamMemberFilter');
    if (view === 'card') {
        filter.classList.remove('hidden');
    } else {
        filter.classList.add('hidden');
    }
    
    // 控制"添加目标"按钮显示（只在列表视图显示）
    const addObjectiveBtn = document.getElementById('addObjectiveBtn');
    if (view === 'list' && currentUser && currentUser.EngName === window.LEADER) {
        addObjectiveBtn.classList.remove('hidden');
    } else {
        addObjectiveBtn.classList.add('hidden');
    }
    
    // 控制"导出Word"按钮显示（只在列表视图显示）
    const exportWordBtn = document.getElementById('exportWordBtn');
    if (view === 'list') {
        exportWordBtn.classList.remove('hidden');
    } else {
        exportWordBtn.classList.add('hidden');
    }
    
    // 控制键盘移动功能（只在脑图视图启用）
    if (view === 'mindmap') {
        mindMapKeyboardEnabled = true;
    } else {
        mindMapKeyboardEnabled = false;
    }
    
    // 渲染对应视图
    if (view === 'list') {
        if (teamObjectivesData) renderTeamOKR(teamObjectivesData);
        else loadTeamOKR();
    } else if (view === 'card') {
        renderTeamCardView();
    } else if (view === 'mindmap') {
        renderTeamMindMapView();
    }
}

// 跳转到成员视图并筛选指定成员
function jumpToMemberView(userEngName) {
    // 切换到成员视图
    switchTeamView('card');
    
    // 设置筛选器的值
    const filter = document.getElementById('teamMemberFilter');
    if (filter) {
        filter.value = userEngName;
        // 触发筛选
        renderTeamCardView();
    }
    
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 应用进展日期过滤
function applyProgressDateFilter() {
    const filterDate = document.getElementById('progressDateFilter').value;
    if (!filterDate) {
        // 如果没有选择日期，重新加载所有数据
        if (currentTeamView === 'list') {
            loadTeamOKR();
        } else if (currentTeamView === 'card') {
            renderTeamCardView();
        }
        return;
    }
    
    // 重新渲染当前视图
    if (currentTeamView === 'list') {
        loadTeamOKR();
    } else if (currentTeamView === 'card') {
        renderTeamCardView();
    }
}

// 更新日期显示
function updateDateDisplay(input) {
    const display = document.getElementById('dateDisplayText');
    if (!display) return;
    
    if (input.value) {
        display.textContent = input.value;
        display.classList.add('text-gray-900');
        display.classList.remove('text-gray-500');
    } else {
        display.textContent = '选择日期';
        display.classList.add('text-gray-500');
        display.classList.remove('text-gray-900');
    }
}

// 清除进展日期过滤
function clearProgressDateFilter() {
    const input = document.getElementById('progressDateFilter');
    input.value = '';
    updateDateDisplay(input);
    applyProgressDateFilter();
}

// 检查进展是否在日期范围内
function isProgressInDateRange(progressDate) {
    const filterDate = document.getElementById('progressDateFilter').value;
    if (!filterDate) return true;
    
    if (!progressDate) return false;
    
    const filterTimestamp = new Date(filterDate).getTime();
    const progressTimestamp = new Date(progressDate).getTime();
    
    return progressTimestamp >= filterTimestamp;
}

// 检测是否为移动端
function isMobileDevice() {
    return window.innerWidth < 768;
}

function renderTeamOKR(objectives) {
    const container = document.getElementById('teamOkrList');
    
    if (!objectives || objectives.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-500 py-12">暂无团队OKR，请添加</div>';
        // 清空目录
        updateTeamOkrToc([]);
        return;
    }
    
    const isLeader = currentUser && currentUser.EngName === window.LEADER;
    const isMobile = isMobileDevice();
    
    container.innerHTML = objectives.map((obj, objIndex) => `
        <div class="bg-white rounded-lg shadow-sm border p-6 objective-item" data-id="${obj.id}" id="objective-${obj.id}">
            <div class="flex justify-between items-start mb-4">
                <div class="flex items-start flex-1">
                    ${isLeader ? '<i class="fas fa-grip-vertical drag-handle text-gray-400 mr-3 mt-1"></i>' : ''}
                    <div class="flex-1">
                        <h3 class="text-2xl font-bold text-gray-900">
                            <span class="mr-2" style="color: var(--primary-color);">O${objIndex + 1}</span><span contenteditable="${isLeader}" data-original="${escapeHtml(obj.title)}" onblur="updateTeamObjective(this, ${obj.id}, this.textContent)">${escapeHtml(obj.title)}</span>
                        </h3>
                        <div class="flex items-center space-x-3 mt-2">
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${
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
                </div>
                ${isLeader && !isMobile ? `
                    <div class="ml-4 flex space-x-2">
                        <button onclick="addKR(${obj.id})" class="hover:opacity-80" style="color: var(--primary-color);">
                            <i class="fas fa-plus"></i> 添加KR
                        </button>
                        <button onclick="deleteObjective(${obj.id})" class="text-red-600 hover:text-red-700">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                ` : ''}
            </div>
            
            <div class="space-y-3 kr-list" data-objective-id="${obj.id}">
                ${obj.key_results && obj.key_results.length > 0 ? obj.key_results.map((kr, krIndex) => `
                    <div class="kr-item bg-gray-50 rounded-lg border border-gray-200" data-id="${kr.id}" id="kr-${kr.id}">
                        <div class="p-4 border-b border-gray-200">
                            <div class="flex justify-between items-start">
                                <div class="flex items-start flex-1">
                                    ${isLeader ? '<i class="fas fa-grip-vertical drag-handle text-gray-400 mr-3 mt-1"></i>' : ''}
                                    <div class="flex-1">
                                        <h4 class="text-lg font-bold text-gray-900">
                                            <span class="text-blue-600 mr-2">KR${krIndex + 1}</span><span contenteditable="${isLeader}" data-original="${escapeHtml(kr.title)}" onblur="updateTeamKR(this, ${kr.id}, this.textContent)">${escapeHtml(kr.title)}</span>
                                        </h4>
                                        ${kr.claimers && kr.claimers.length > 0 ? `
                                            <div class="mt-2 flex items-center text-base text-green-600 flex-wrap gap-2">
                                                <i class="fas fa-check-circle mr-1"></i>
                                                <span>认领人：</span>
                                                ${kr.claimers.map(claimer => `
                                                    <div class="inline-flex items-center bg-green-50 rounded-full px-2 py-1 cursor-pointer hover:bg-green-100 transition-colors" 
                                                         onclick="jumpToMemberView('${claimer.user_eng_name}')"
                                                         title="点击查看该成员的所有进展">
                                                        <img src="https://r.hrc.woa.com/photo/150/${claimer.user_eng_name}.png?default_when_absent=true" 
                                                             alt="${claimer.user_chn_name}" 
                                                             class="w-5 h-5 rounded-full mr-1">
                                                        <span class="text-sm">${escapeHtml(claimer.user_eng_name)}(${escapeHtml(claimer.user_chn_name)})</span>
                                                    </div>
                                                `).join('')}
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                                ${!isMobile ? `
                                    <div class="ml-4 flex space-x-2">
                                        <button onclick="claimKR(${kr.id}, ${obj.id})" 
                                                class="px-3 py-1 text-white text-sm rounded" style="background-color: var(--primary-color);" onmouseover="this.style.backgroundColor='var(--primary-hover)'" onmouseout="this.style.backgroundColor='var(--primary-color)'"
                                        >
                                            认领
                                        </button>
                                        ${isLeader ? `
                                            <button onclick="deleteKR(${kr.id})" 
                                                    class="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                                            >
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        ` : ''}
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                        
                        <div id="kr-progress-${kr.id}" class="p-4">
                            <div class="text-sm text-gray-500">
                                <i class="fas fa-spinner fa-spin mr-1"></i>加载进展中...
                            </div>
                        </div>
                    </div>
                `).join('') : '<p class="text-gray-500 text-sm p-4">暂无Key Results</p>'}
            </div>
        </div>
    `).join('');
    
    // 更新目录
    updateTeamOkrToc(objectives);
    
    // 如果是Leader，启用拖拽排序
    if (isLeader) {
        initObjectiveSortable();
        initKRSortable();
    }
    
    // 加载每个KR的成员进展
    objectives.forEach(obj => {
        if (obj.key_results && obj.key_results.length > 0) {
            obj.key_results.forEach(kr => {
                loadKRMemberProgress(kr.id, kr.title);
            });
        }
    });
    
    // 重新绑定滚动监听
    initScrollSpy();
}

// 更新团队OKR目录
function updateTeamOkrToc(objectives) {
    const tocContainer = document.getElementById('teamOkrToc');
    if (!tocContainer) return;
    
    if (!objectives || objectives.length === 0) {
        tocContainer.innerHTML = '<div class="text-gray-400 text-sm">暂无OKR</div>';
        return;
    }
    
    let tocHtml = '';
    objectives.forEach((obj, objIndex) => {
        tocHtml += `
            <div class="toc-item objective-toc-item" data-target="objective-${obj.id}">
                <a href="#objective-${obj.id}" 
                   class="block px-3 py-2 text-sm rounded-lg hover:bg-gray-100 transition-colors flex items-start"
                   onclick="scrollToElement(event, 'objective-${obj.id}')">
                    <span class="font-medium text-gray-900" style="color: var(--primary-color);">O${objIndex + 1}</span>
                    <span class="ml-2 text-gray-600 line-clamp-2">${escapeHtml(obj.title)}</span>
                </a>
            </div>
        `;
        
        if (obj.key_results && obj.key_results.length > 0) {
            tocHtml += '<div class="ml-4 space-y-1">';
            obj.key_results.forEach((kr, krIndex) => {
                tocHtml += `
                    <div class="toc-item kr-toc-item" data-target="kr-${kr.id}">
                        <a href="#kr-${kr.id}" 
                           class="block px-3 py-1.5 text-xs rounded-lg hover:bg-gray-100 transition-colors"
                           onclick="scrollToElement(event, 'kr-${kr.id}')">
                            <span class="text-blue-600">KR${krIndex + 1}</span>
                            <span class="ml-1 text-gray-600 line-clamp-2">${escapeHtml(kr.title)}</span>
                        </a>
                    </div>
                `;
            });
            tocHtml += '</div>';
        }
    });
    
    tocContainer.innerHTML = tocHtml;
}

// 滚动到指定元素
function scrollToElement(event, elementId) {
    event.preventDefault();
    const element = document.getElementById(elementId);
    if (element) {
        const offset = 20; // 顶部留白
        const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
        const offsetPosition = elementPosition - offset;
        
        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
        });
    }
}

// 跳转到成员视图并筛选指定成员
function jumpToMemberView(userEngName) {
    // 切换到成员视图
    switchTeamView('card');
    
    // 设置筛选器的值
    const filter = document.getElementById('teamMemberFilter');
    if (filter) {
        filter.value = userEngName;
        // 触发筛选
        renderTeamCardView();
    }
    
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 应用进展日期过滤
function applyProgressDateFilter() {
    const filterDate = document.getElementById('progressDateFilter').value;
    if (!filterDate) {
        // 如果没有选择日期，重新加载所有数据
        if (currentTeamView === 'list') {
            loadTeamOKR();
        } else if (currentTeamView === 'card') {
            renderTeamCardView();
        }
        return;
    }
    
    // 重新渲染当前视图
    if (currentTeamView === 'list') {
        loadTeamOKR();
    } else if (currentTeamView === 'card') {
        renderTeamCardView();
    }
}

// 更新日期显示
function updateDateDisplay(input) {
    const display = document.getElementById('dateDisplayText');
    if (!display) return;
    
    if (input.value) {
        display.textContent = input.value;
        display.classList.add('text-gray-900');
        display.classList.remove('text-gray-500');
    } else {
        display.textContent = '选择日期';
        display.classList.add('text-gray-500');
        display.classList.remove('text-gray-900');
    }
}

// 清除进展日期过滤
function clearProgressDateFilter() {
    const input = document.getElementById('progressDateFilter');
    input.value = '';
    updateDateDisplay(input);
    applyProgressDateFilter();
}

// 检查进展是否在日期范围内
function isProgressInDateRange(progressDate) {
    const filterDate = document.getElementById('progressDateFilter').value;
    if (!filterDate) return true;
    
    if (!progressDate) return false;
    
    const filterTimestamp = new Date(filterDate).getTime();
    const progressTimestamp = new Date(progressDate).getTime();
    
    return progressTimestamp >= filterTimestamp;
}

// 初始化滚动监听（高亮当前目录项）
let objectiveObservers = [];
let krObservers = [];

function initScrollSpy() {
    // 清除旧的观察者
    objectiveObservers.forEach(observer => observer.disconnect());
    krObservers.forEach(observer => observer.disconnect());
    objectiveObservers = [];
    krObservers = [];

    // 创建IntersectionObserver配置
    const observerOptions = {
        root: null, // 使用视口
        rootMargin: '-100px 0px -60% 0px', // 顶部100px，底部60%的边距
        threshold: 0
    };

    // 观察所有Objective
    const objectives = document.querySelectorAll('.objective-item');
    objectives.forEach(obj => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const objId = entry.target.id;
                updateTocHighlight('objective-' + objId, entry.isIntersecting);
            });
        }, observerOptions);
        observer.observe(obj);
        objectiveObservers.push(observer);
    });

    // 观察所有KR
    const krs = document.querySelectorAll('.kr-item');
    krs.forEach(kr => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const krId = entry.target.id;
                updateTocHighlight(krId, entry.isIntersecting);
            });
        }, observerOptions);
        observer.observe(kr);
        krObservers.push(observer);
    });

    // 初始执行一次
    handleInitialScrollHighlight();
}

// 更新目录高亮状态
function updateTocHighlight(targetId, isIntersecting) {
    const tocItems = document.querySelectorAll('.toc-item');
    tocItems.forEach(item => {
        if (item.dataset.target === targetId) {
            if (isIntersecting) {
                // 先移除所有高亮
                tocItems.forEach(i => i.classList.remove('active'));
                
                // 添加当前项的高亮
                item.classList.add('active');
                
                // 如果是KR高亮，也需要高亮其父Objective
                if (targetId.startsWith('kr-')) {
                    const krItem = document.getElementById(targetId);
                    if (krItem) {
                        const objectiveItem = krItem.closest('.objective-item');
                        if (objectiveItem) {
                            const objTocItem = document.querySelector(`.toc-item[data-target="${objectiveItem.id}"]`);
                            if (objTocItem) {
                                objTocItem.classList.add('active');
                            }
                        }
                    }
                }
                
                // 确保高亮的目录项在可视范围内
                scrollActiveTocIntoView(item);
            } else {
                // 当元素离开视野时，移除高亮
                item.classList.remove('active');
            }
        }
    });
}

// 确保高亮的目录项在可视范围内
function scrollActiveTocIntoView(activeItem) {
    if (!activeItem) return;
    
    const tocContainer = document.getElementById('teamOkrToc');
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

// 跳转到成员视图并筛选指定成员
function jumpToMemberView(userEngName) {
    // 切换到成员视图
    switchTeamView('card');
    
    // 设置筛选器的值
    const filter = document.getElementById('teamMemberFilter');
    if (filter) {
        filter.value = userEngName;
        // 触发筛选
        renderTeamCardView();
    }
    
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 应用进展日期过滤
function applyProgressDateFilter() {
    const filterDate = document.getElementById('progressDateFilter').value;
    if (!filterDate) {
        // 如果没有选择日期，重新加载所有数据
        if (currentTeamView === 'list') {
            loadTeamOKR();
        } else if (currentTeamView === 'card') {
            renderTeamCardView();
        }
        return;
    }
    
    // 重新渲染当前视图
    if (currentTeamView === 'list') {
        loadTeamOKR();
    } else if (currentTeamView === 'card') {
        renderTeamCardView();
    }
}

// 更新日期显示
function updateDateDisplay(input) {
    const display = document.getElementById('dateDisplayText');
    if (!display) return;
    
    if (input.value) {
        display.textContent = input.value;
        display.classList.add('text-gray-900');
        display.classList.remove('text-gray-500');
    } else {
        display.textContent = '选择日期';
        display.classList.add('text-gray-500');
        display.classList.remove('text-gray-900');
    }
}

// 清除进展日期过滤
function clearProgressDateFilter() {
    const input = document.getElementById('progressDateFilter');
    input.value = '';
    updateDateDisplay(input);
    applyProgressDateFilter();
}

// 检查进展是否在日期范围内
function isProgressInDateRange(progressDate) {
    const filterDate = document.getElementById('progressDateFilter').value;
    if (!filterDate) return true;
    
    if (!progressDate) return false;
    
    const filterTimestamp = new Date(filterDate).getTime();
    const progressTimestamp = new Date(progressDate).getTime();
    
    return progressTimestamp >= filterTimestamp;
}

// 初始滚动高亮
function handleInitialScrollHighlight() {
    const objectives = document.querySelectorAll('.objective-item');
    
    // 先清除所有高亮
    const tocItems = document.querySelectorAll('.toc-item');
    tocItems.forEach(item => item.classList.remove('active'));
    
    // 找到第一个可见的元素
    for (const obj of objectives) {
        const rect = obj.getBoundingClientRect();
        if (rect.top <= 100) {
            highlightTocItem(obj.id);
            break;
        }
    }
}

// 跳转到成员视图并筛选指定成员
function jumpToMemberView(userEngName) {
    // 切换到成员视图
    switchTeamView('card');
    
    // 设置筛选器的值
    const filter = document.getElementById('teamMemberFilter');
    if (filter) {
        filter.value = userEngName;
        // 触发筛选
        renderTeamCardView();
    }
    
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 应用进展日期过滤
function applyProgressDateFilter() {
    const filterDate = document.getElementById('progressDateFilter').value;
    if (!filterDate) {
        // 如果没有选择日期，重新加载所有数据
        if (currentTeamView === 'list') {
            loadTeamOKR();
        } else if (currentTeamView === 'card') {
            renderTeamCardView();
        }
        return;
    }
    
    // 重新渲染当前视图
    if (currentTeamView === 'list') {
        loadTeamOKR();
    } else if (currentTeamView === 'card') {
        renderTeamCardView();
    }
}

// 更新日期显示
function updateDateDisplay(input) {
    const display = document.getElementById('dateDisplayText');
    if (!display) return;
    
    if (input.value) {
        display.textContent = input.value;
        display.classList.add('text-gray-900');
        display.classList.remove('text-gray-500');
    } else {
        display.textContent = '选择日期';
        display.classList.add('text-gray-500');
        display.classList.remove('text-gray-900');
    }
}

// 清除进展日期过滤
function clearProgressDateFilter() {
    const input = document.getElementById('progressDateFilter');
    input.value = '';
    updateDateDisplay(input);
    applyProgressDateFilter();
}

// 检查进展是否在日期范围内
function isProgressInDateRange(progressDate) {
    const filterDate = document.getElementById('progressDateFilter').value;
    if (!filterDate) return true;
    
    if (!progressDate) return false;
    
    const filterTimestamp = new Date(filterDate).getTime();
    const progressTimestamp = new Date(progressDate).getTime();
    
    return progressTimestamp >= filterTimestamp;
}

// 高亮指定ID的目录项
function highlightTocItem(elementId) {
    const tocItems = document.querySelectorAll('.toc-item');
    let activeItem = null;
    
    tocItems.forEach(item => {
        if (item.dataset.target === elementId) {
            item.classList.add('active');
            activeItem = item;
        } else {
            item.classList.remove('active');
        }
    });
    
    // 确保高亮的目录项在可视范围内
    if (activeItem) {
        scrollActiveTocIntoView(activeItem);
    }
}

// 跳转到成员视图并筛选指定成员
function jumpToMemberView(userEngName) {
    // 切换到成员视图
    switchTeamView('card');
    
    // 设置筛选器的值
    const filter = document.getElementById('teamMemberFilter');
    if (filter) {
        filter.value = userEngName;
        // 触发筛选
        renderTeamCardView();
    }
    
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 应用进展日期过滤
function applyProgressDateFilter() {
    const filterDate = document.getElementById('progressDateFilter').value;
    if (!filterDate) {
        // 如果没有选择日期，重新加载所有数据
        if (currentTeamView === 'list') {
            loadTeamOKR();
        } else if (currentTeamView === 'card') {
            renderTeamCardView();
        }
        return;
    }
    
    // 重新渲染当前视图
    if (currentTeamView === 'list') {
        loadTeamOKR();
    } else if (currentTeamView === 'card') {
        renderTeamCardView();
    }
}

// 更新日期显示
function updateDateDisplay(input) {
    const display = document.getElementById('dateDisplayText');
    if (!display) return;
    
    if (input.value) {
        display.textContent = input.value;
        display.classList.add('text-gray-900');
        display.classList.remove('text-gray-500');
    } else {
        display.textContent = '选择日期';
        display.classList.add('text-gray-500');
        display.classList.remove('text-gray-900');
    }
}

// 清除进展日期过滤
function clearProgressDateFilter() {
    const input = document.getElementById('progressDateFilter');
    input.value = '';
    updateDateDisplay(input);
    applyProgressDateFilter();
}

// 检查进展是否在日期范围内
function isProgressInDateRange(progressDate) {
    const filterDate = document.getElementById('progressDateFilter').value;
    if (!filterDate) return true;
    
    if (!progressDate) return false;
    
    const filterTimestamp = new Date(filterDate).getTime();
    const progressTimestamp = new Date(progressDate).getTime();
    
    return progressTimestamp >= filterTimestamp;
}

// 初始化侧边栏状态（根据屏幕尺寸）
function initSidebarState() {
    const sidebar = document.getElementById('teamOkrSidebar');
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

// 跳转到成员视图并筛选指定成员
function jumpToMemberView(userEngName) {
    // 切换到成员视图
    switchTeamView('card');
    
    // 设置筛选器的值
    const filter = document.getElementById('teamMemberFilter');
    if (filter) {
        filter.value = userEngName;
        // 触发筛选
        renderTeamCardView();
    }
    
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 应用进展日期过滤
function applyProgressDateFilter() {
    const filterDate = document.getElementById('progressDateFilter').value;
    if (!filterDate) {
        // 如果没有选择日期，重新加载所有数据
        if (currentTeamView === 'list') {
            loadTeamOKR();
        } else if (currentTeamView === 'card') {
            renderTeamCardView();
        }
        return;
    }
    
    // 重新渲染当前视图
    if (currentTeamView === 'list') {
        loadTeamOKR();
    } else if (currentTeamView === 'card') {
        renderTeamCardView();
    }
}

// 更新日期显示
function updateDateDisplay(input) {
    const display = document.getElementById('dateDisplayText');
    if (!display) return;
    
    if (input.value) {
        display.textContent = input.value;
        display.classList.add('text-gray-900');
        display.classList.remove('text-gray-500');
    } else {
        display.textContent = '选择日期';
        display.classList.add('text-gray-500');
        display.classList.remove('text-gray-900');
    }
}

// 清除进展日期过滤
function clearProgressDateFilter() {
    const input = document.getElementById('progressDateFilter');
    input.value = '';
    updateDateDisplay(input);
    applyProgressDateFilter();
}

// 检查进展是否在日期范围内
function isProgressInDateRange(progressDate) {
    const filterDate = document.getElementById('progressDateFilter').value;
    if (!filterDate) return true;
    
    if (!progressDate) return false;
    
    const filterTimestamp = new Date(filterDate).getTime();
    const progressTimestamp = new Date(progressDate).getTime();
    
    return progressTimestamp >= filterTimestamp;
}

// 监听窗口大小变化，自动调整侧边栏状态
let resizeTimer;
window.addEventListener('resize', () => {
    // 使用防抖，避免频繁触发
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        if (currentTeamView === 'list') {
            initSidebarState();
        }
    }, 200);
});

// 收起/展开目录
function toggleSidebar() {
    const sidebar = document.getElementById('teamOkrSidebar');
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

// 跳转到成员视图并筛选指定成员
function jumpToMemberView(userEngName) {
    // 切换到成员视图
    switchTeamView('card');
    
    // 设置筛选器的值
    const filter = document.getElementById('teamMemberFilter');
    if (filter) {
        filter.value = userEngName;
        // 触发筛选
        renderTeamCardView();
    }
    
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 应用进展日期过滤
function applyProgressDateFilter() {
    const filterDate = document.getElementById('progressDateFilter').value;
    if (!filterDate) {
        // 如果没有选择日期，重新加载所有数据
        if (currentTeamView === 'list') {
            loadTeamOKR();
        } else if (currentTeamView === 'card') {
            renderTeamCardView();
        }
        return;
    }
    
    // 重新渲染当前视图
    if (currentTeamView === 'list') {
        loadTeamOKR();
    } else if (currentTeamView === 'card') {
        renderTeamCardView();
    }
}

// 更新日期显示
function updateDateDisplay(input) {
    const display = document.getElementById('dateDisplayText');
    if (!display) return;
    
    if (input.value) {
        display.textContent = input.value;
        display.classList.add('text-gray-900');
        display.classList.remove('text-gray-500');
    } else {
        display.textContent = '选择日期';
        display.classList.add('text-gray-500');
        display.classList.remove('text-gray-900');
    }
}

// 清除进展日期过滤
function clearProgressDateFilter() {
    const input = document.getElementById('progressDateFilter');
    input.value = '';
    updateDateDisplay(input);
    applyProgressDateFilter();
}

// 检查进展是否在日期范围内
function isProgressInDateRange(progressDate) {
    const filterDate = document.getElementById('progressDateFilter').value;
    if (!filterDate) return true;
    
    if (!progressDate) return false;
    
    const filterTimestamp = new Date(filterDate).getTime();
    const progressTimestamp = new Date(progressDate).getTime();
    
    return progressTimestamp >= filterTimestamp;
}

// 渲染团队卡片视图
async function renderTeamCardView() {
    const container = document.getElementById('teamCardView');
    const filter = document.getElementById('teamMemberFilter');
    
    // 如果是首次加载或重新加载，显示loading
    if (container.innerHTML === '' || container.innerHTML.includes('fa-spinner')) {
        container.innerHTML = '<div class="col-span-full text-center py-12"><i class="fas fa-spinner fa-spin text-2xl text-gray-400"></i><p class="mt-2 text-gray-500">加载成员进展中...</p></div>';
    }
    
    try {
        const response = await fetch('/api/progress/team-summary');
        if (!response.ok) throw new Error('加载团队进展失败');
        const data = await response.json();
        
        if (!data.summary || data.summary.length === 0) {
            container.innerHTML = '<div class="col-span-full text-center text-gray-500 py-12">暂无成员进展数据</div>';
            return;
        }
        
        // 提取所有用户用于筛选器
        const users = new Map();
        data.summary.forEach(item => {
            if (item.user_eng_name && !users.has(item.user_eng_name)) {
                users.set(item.user_eng_name, item.user_chn_name);
            }
        });
        
        // 填充筛选器（如果选项数量不对，说明需要更新）
        // 默认有一个 "全部成员" 选项，所以 size + 1
        if (filter.options.length !== users.size + 1) {
            const currentValue = filter.value;
            filter.innerHTML = '<option value="">全部成员</option>';
            
            const sortedUsers = Array.from(users.entries()).sort((a, b) => a[0].localeCompare(b[0]));
            sortedUsers.forEach(([engName, chnName]) => {
                const option = document.createElement('option');
                option.value = engName;
                option.textContent = `${engName}(${chnName})`;
                filter.appendChild(option);
            });
            
            filter.value = currentValue; // 恢复选中状态
        }
        
        // 过滤数据
        const selectedUser = filter.value;
        const filterDate = document.getElementById('progressDateFilter')?.value;
        
        let filteredItems = data.summary;
        if (selectedUser) {
            filteredItems = filteredItems.filter(item => item.user_eng_name === selectedUser);
        }
        
        // 应用日期过滤
        if (filterDate) {
            filteredItems = filteredItems.filter(item => {
                const hasWeeklyInRange = item.weekly_time && isProgressInDateRange(item.weekly_time);
                const hasOverallInRange = item.overall_time && isProgressInDateRange(item.overall_time);
                const hasNextWeekInRange = item.next_week_time && isProgressInDateRange(item.next_week_time);
                
                return hasWeeklyInRange || hasOverallInRange || hasNextWeekInRange;
            });
        }
        
        if (filteredItems.length === 0) {
            container.innerHTML = '<div class="col-span-full text-center text-gray-500 py-12">该成员暂无进展数据</div>';
            return;
        }
        
        // 按成员分组
        const groupedByUser = new Map();
        filteredItems.forEach(item => {
            if (!groupedByUser.has(item.user_eng_name)) {
                groupedByUser.set(item.user_eng_name, {
                    user_eng_name: item.user_eng_name,
                    user_chn_name: item.user_chn_name,
                    items: []
                });
            }
            groupedByUser.get(item.user_eng_name).items.push(item);
        });
        
        // 过滤掉没有进展的成员（没有本周进展、下周计划或整体进展）
        const groupsWithProgress = Array.from(groupedByUser.values()).map(group => {
            // 过滤该成员下的 items，只保留有进展的 item
            const activeItems = group.items.filter(item => {
                // 检查是否有实际的进展内容（非空且非纯空白）
                const hasWeekly = item.weekly_content && item.weekly_content.trim().length > 0;
                const hasNextWeek = item.next_week_content && item.next_week_content.trim().length > 0;
                const hasOverall = item.overall_content && item.overall_content.trim().length > 0;
                
                return hasWeekly || hasNextWeek || hasOverall;
            });
            
            return {
                ...group,
                items: activeItems
            };
        }).filter(group => group.items.length > 0); // 只保留有有效 item 的成员
        
        if (groupsWithProgress.length === 0) {
            container.innerHTML = '<div class="col-span-full text-center text-gray-500 py-12">暂无成员进展数据</div>';
            return;
        }
        
        // 渲染分组后的卡片
        container.innerHTML = groupsWithProgress.map(group => {
            // 计算该成员的工作分配数据（基于下周计划的预计占用人天）
            const workAllocation = calculateWorkAllocation(group.items);
            const pieChartId = `work-pie-chart-${group.user_eng_name.replace(/\s+/g, '-')}`;
            
            return `
            <div class="col-span-full mb-8">
                <!-- 成员标题 -->
                <div class="flex items-center space-x-3 mb-4 pb-3 border-b">
                    <img src="https://r.hrc.woa.com/photo/150/${group.user_eng_name}.png?default_when_absent=true" 
                         alt="${group.user_chn_name}" 
                         class="w-12 h-12 rounded-full">
                    <div>
                        <h3 class="font-bold text-gray-900 text-lg">${escapeHtml(group.user_eng_name)}</h3>
                        <p class="text-sm text-gray-500">${escapeHtml(group.user_chn_name)}</p>
                    </div>
                    <span class="ml-auto text-sm text-gray-400">${group.items.length} 个进展</span>
                    <!-- 工作分配饼图容器 -->
                    <div id="${pieChartId}" class="w-24 h-24 flex-shrink-0"></div>
                </div>
                
                <!-- 该成员的卡片列表 -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${group.items.map(item => `
                        <div class="bg-white rounded-lg shadow-sm border p-6 flex flex-col hover:shadow-md transition-shadow">
                            <div class="mb-3">
                                <div class="text-xs text-gray-500 mb-1">目标</div>
                                <div class="font-medium text-gray-800 text-sm line-clamp-2" title="${escapeHtml(item.obj_title)}">
                                    ${escapeHtml(item.obj_title)}
                                </div>
                            </div>
                            
                            <div class="mb-4 flex-1">
                                <div class="text-xs text-gray-500 mb-1">关键结果</div>
                                <div class="font-medium text-blue-600 text-sm line-clamp-2" title="${escapeHtml(item.kr_title)}">
                                    ${escapeHtml(item.kr_title)}
                                </div>
                            </div>
                            
                            <div class="space-y-3 bg-gray-50 rounded p-3 text-sm relative">
                                ${item.weekly_content ? `
                                    <div class="group relative">
                                        <div class="text-xs text-gray-400 mb-1 flex justify-between">
                                            <span>本周进展</span>
                                            <span>${formatDate(item.weekly_time)}</span>
                                        </div>
                                        <div class="text-gray-700 markdown-content line-clamp-3 transition-all cursor-pointer" onclick="this.classList.toggle('line-clamp-3')" title="点击展开/收起">
                                            ${marked.parse(item.weekly_content)}
                                        </div>
                                    </div>
                                ` : ''}
                                ${item.next_week_content ? `
                                    <div class="group relative ${item.weekly_content ? 'pt-3 border-t' : ''}">
                                        <div class="text-xs text-gray-400 mb-1 flex justify-between">
                                            <span>下周计划</span>
                                            <span>${formatDate(item.next_week_time)}</span>
                                        </div>
                                        <div class="text-gray-700 markdown-content line-clamp-3 transition-all cursor-pointer" onclick="this.classList.toggle('line-clamp-3')" title="点击展开/收起">
                                            ${marked.parse(item.next_week_content)}
                                        </div>
                                        ${item.estimated_man_days ? `
                                            <div class="text-xs text-purple-600 font-medium mt-2">
                                                <i class="fas fa-clock mr-1"></i>预计占用人天: ${item.estimated_man_days} 天
                                            </div>
                                        ` : ''}
                                        <!-- 复制按钮 -->
                                        <button onclick="event.stopPropagation(); copyToClipboard(\`${item.next_week_content.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`, '下周计划已复制')" 
                                                class="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-600 hover:text-blue-600 hover:border-blue-300 hover:shadow-sm"
                                                title="复制原始Markdown">
                                            <i class="far fa-copy mr-1"></i>复制
                                        </button>
                                    </div>
                                ` : ''}
                                ${item.overall_content ? `
                                    <div ${(item.weekly_content || item.next_week_content) ? 'class="pt-3 border-t"' : ''}>
                                        <div class="text-xs text-gray-400 mb-1 flex justify-between">
                                            <span>整体进展</span>
                                            <span>${formatDate(item.overall_time)}</span>
                                        </div> 
                                        <div class="text-gray-700 markdown-content line-clamp-3 transition-all cursor-pointer" onclick="this.classList.toggle('line-clamp-3')" title="点击展开/收起">
                                            ${marked.parse(item.overall_content)}
                                        </div>
                                    </div>
                                ` : ''}
                                ${!item.weekly_content && !item.overall_content && !item.next_week_content ? '<div class="text-xs text-gray-400 italic">暂无进展</div>' : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        }).join('');
        
        // 渲染所有成员的工作分配饼图
        groupsWithProgress.forEach(group => {
            const workAllocation = calculateWorkAllocation(group.items);
            const pieChartId = `work-pie-chart-${group.user_eng_name.replace(/\s+/g, '-')}`;
            setTimeout(() => renderWorkPieChart(pieChartId, workAllocation, group.user_eng_name), 100);
        });
        
    } catch (error) {
        console.error('渲染卡片视图失败:', error);
        container.innerHTML = `<div class="col-span-full text-center text-red-500 py-12">加载失败: ${error.message}</div>`;
    }
}

// 跳转到成员视图并筛选指定成员
function jumpToMemberView(userEngName) {
    // 切换到成员视图
    switchTeamView('card');
    
    // 设置筛选器的值
    const filter = document.getElementById('teamMemberFilter');
    if (filter) {
        filter.value = userEngName;
        // 触发筛选
        renderTeamCardView();
    }
    
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 应用进展日期过滤
function applyProgressDateFilter() {
    const filterDate = document.getElementById('progressDateFilter').value;
    if (!filterDate) {
        // 如果没有选择日期，重新加载所有数据
        if (currentTeamView === 'list') {
            loadTeamOKR();
        } else if (currentTeamView === 'card') {
            renderTeamCardView();
        }
        return;
    }
    
    // 重新渲染当前视图
    if (currentTeamView === 'list') {
        loadTeamOKR();
    } else if (currentTeamView === 'card') {
        renderTeamCardView();
    }
}

// 更新日期显示
function updateDateDisplay(input) {
    const display = document.getElementById('dateDisplayText');
    if (!display) return;
    
    if (input.value) {
        display.textContent = input.value;
        display.classList.add('text-gray-900');
        display.classList.remove('text-gray-500');
    } else {
        display.textContent = '选择日期';
        display.classList.add('text-gray-500');
        display.classList.remove('text-gray-900');
    }
}

// 清除进展日期过滤
function clearProgressDateFilter() {
    const input = document.getElementById('progressDateFilter');
    input.value = '';
    updateDateDisplay(input);
    applyProgressDateFilter();
}

// 检查进展是否在日期范围内
function isProgressInDateRange(progressDate) {
    const filterDate = document.getElementById('progressDateFilter').value;
    if (!filterDate) return true;
    
    if (!progressDate) return false;
    
    const filterTimestamp = new Date(filterDate).getTime();
    const progressTimestamp = new Date(progressDate).getTime();
    
    return progressTimestamp >= filterTimestamp;
}

// 计算工作分配数据
function calculateWorkAllocation(items) {
    const allocation = new Map();
    let totalDays = 0;
    
    items.forEach(item => {
        if (item.next_week_content && item.estimated_man_days) {
            const days = parseFloat(item.estimated_man_days) || 0;
            if (days > 0) {
                const krTitle = item.kr_title || '未知';
                const existingData = allocation.get(krTitle) || { days: 0, nextWeekContents: [] };
                
                // 收集所有用户的下周计划内容
                existingData.nextWeekContents.push({
                    content: item.next_week_content,
                    userEngName: item.user_eng_name,
                    userChnName: item.user_chn_name,
                    estimatedManDays: item.estimated_man_days
                });
                
                existingData.days += days;
                allocation.set(krTitle, {
                    days: existingData.days,
                    nextWeekContents: existingData.nextWeekContents,
                    krTitle: krTitle
                });
                totalDays += days;
            }
        }
    });
    
    return {
        data: Array.from(allocation.entries()).map(([name, info]) => ({
            name: name.length > 10 ? name.substring(0, 10) + '...' : name,
            value: info.days,
            krTitle: name,
            nextWeekContents: info.nextWeekContents
        })),
        total: totalDays
    };
}

// 渲染工作分配饼图
function renderWorkPieChart(containerId, workAllocation, userName) {
    const container = document.getElementById(containerId);
    if (!container || workAllocation.data.length === 0) {
        return;
    }
    
    // 销毁已存在的图表
    const existingChart = echarts.getInstanceByDom(container);
    if (existingChart) {
        existingChart.dispose();
    }
    
    const chart = echarts.init(container);
    
    // 生成颜色数组
    const colors = [
        '#0052D9', '#00A870', '#E37318', '#E34D59', '#834EC2',
        '#00B4E5', '#FF9F43', '#5F27CD', '#FF6B6B', '#1DD1A1'
    ];
    
    const option = {
        tooltip: {
            trigger: 'item',
            formatter: '{b}: {c} 天 ({d}%)'
        },
        legend: {
            show: false
        },
        series: [
            {
                type: 'pie',
                radius: ['40%', '70%'],
                center: ['50%', '50%'],
                avoidLabelOverlap: false,
                itemStyle: {
                    borderRadius: 4,
                    borderColor: '#fff',
                    borderWidth: 2
                },
                label: {
                    show: false
                },
                emphasis: {
                    label: {
                        show: true,
                        fontSize: 10,
                        fontWeight: 'bold',
                        formatter: '{b}\n{c}天'
                    }
                },
                labelLine: {
                    show: false
                },
                data: workAllocation.data.map((item, index) => ({
                    name: item.name.length > 10 ? item.name.substring(0, 10) + '...' : item.name,
                    value: item.value,
                    krTitle: item.krTitle,
                    nextWeekContents: item.nextWeekContents,
                    itemStyle: {
                        color: colors[index % colors.length]
                    }
                }))
            }
        ]
    };
    
    chart.setOption(option);
    
    // 添加点击事件
    chart.on('click', function(params) {
        const data = params.data;
        if (data && data.nextWeekContents && data.nextWeekContents.length > 0) {
            showNextWeekPlanModal(data);
        }
    });
    
    // 监听窗口大小变化
    window.addEventListener('resize', () => {
        chart.resize();
    });
}

// 渲染团队脑图视图
let mindMapChart = null;

function renderTeamMindMapView() {
    const container = document.getElementById('teamMindMapViewChart');
    if (!teamObjectivesData) {
        container.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500">暂无数据</div>';
        return;
    }
    
    // 如果已经初始化过，先销毁
    if (mindMapChart) {
        mindMapChart.dispose();
    }
    
    // 准备数据
    const treeData = {
        name: '团队OKR',
        children: teamObjectivesData.map(obj => ({
            name: `O: ${obj.title}`,
            value: obj.weight,
            itemStyle: {
                color: obj.obj_type === '业务' ? '#ebf8ff' : 
                       obj.obj_type === '管理' ? '#f0fff4' : '#faf5ff',
                borderColor: obj.obj_type === '业务' ? '#4299e1' : 
                             obj.obj_type === '管理' ? '#48bb78' : '#9f7aea'
            },
            label: {
                color: '#2d3748',
                fontWeight: 'bold',
                width: 250,
                overflow: 'break',
                lineHeight: 20
            },
            children: (obj.key_results || []).map(kr => ({
                id: kr.id,
                name: `KR: ${kr.title}`,
                itemStyle: { color: '#fff', borderColor: '#cbd5e0' },
                label: { color: '#4a5568' }
            }))
        }))
    };
    
    // 初始化ECharts
    mindMapChart = echarts.init(container);
    
    const option = {
        tooltip: {
            trigger: 'item',
            triggerOn: 'mousemove'
        },
        series: [
            {
                type: 'tree',
                data: [treeData],
                top: '1%',
                left: '7%',
                bottom: '1%',
                right: '30%',
                symbolSize: 7,
                roam: true,
                zoom: 1,
                label: {
                    position: 'left',
                    verticalAlign: 'middle',
                    align: 'right',
                    fontSize: 14
                },
                leaves: {
                    label: {
                        position: 'right',
                        verticalAlign: 'middle',
                        align: 'left'
                    }
                },
                emphasis: {
                    focus: 'descendant'
                },
                expandAndCollapse: true,
                animationDuration: 550,
                animationDurationUpdate: 750,
                initialTreeDepth: -1
            }
        ]
    };
    
    mindMapChart.setOption(option);
    
    // 启用键盘移动功能
    mindMapKeyboardEnabled = true;
    
    // 监听鼠标滚轮事件来更新显示
    container.addEventListener('wheel', () => {
        setTimeout(updateZoomDisplay, 100);
    });
    
    // 监听窗口大小变化
    window.addEventListener('resize', () => {
        mindMapChart.resize();
    });
    
    // 添加键盘方向键移动事件监听
    document.addEventListener('keydown', handleMindMapKeyboard);
    
    updateZoomDisplay();
}

// 处理脑图键盘移动事件
function handleMindMapKeyboard(event) {
    // 只在脑图视图且键盘功能启用时响应
    if (currentTeamView !== 'mindmap' || !mindMapKeyboardEnabled || !mindMapChart) {
        return;
    }
    
    const MOVE_STEP = 50; // 每次移动的像素距离
    
    const option = mindMapChart.getOption();
    if (!option || !option.series || !option.series[0]) return;
    
    let currentCenter = option.series[0].center;
    if (!currentCenter) {
        currentCenter = ['50%', '50%'];
    }
    
    // 解析当前中心位置
    let x = currentCenter[0];
    let y = currentCenter[1];
    
    // 如果是像素值，直接使用；如果是百分比，转换为像素
    const containerWidth = document.getElementById('teamMindMapViewChart').offsetWidth;
    const containerHeight = document.getElementById('teamMindMapViewChart').offsetHeight;
    
    if (typeof x === 'string' && x.includes('%')) {
        x = parseFloat(x) / 100 * containerWidth;
    }
    if (typeof y === 'string' && y.includes('%')) {
        y = parseFloat(y) / 100 * containerHeight;
    }
    
    // 根据方向键移动
    switch (event.key) {
        case 'ArrowUp':
            y -= MOVE_STEP;
            event.preventDefault();
            break;
        case 'ArrowDown':
            y += MOVE_STEP;
            event.preventDefault();
            break;
        case 'ArrowLeft':
            x -= MOVE_STEP;
            event.preventDefault();
            break;
        case 'ArrowRight':
            x += MOVE_STEP;
            event.preventDefault();
            break;
        default:
            return; // 其他键不处理
    }
    
    // 限制移动范围，防止脑图完全移出可视区域
    x = Math.max(0, Math.min(x, containerWidth));
    y = Math.max(0, Math.min(y, containerHeight));
    
    // 更新中心位置
    mindMapChart.setOption({
        series: [{
            center: [x, y]
        }]
    });
}

function updateZoomDisplay() {
    if (!mindMapChart) return;
    const option = mindMapChart.getOption();
    if (option && option.series && option.series[0]) {
        const zoom = option.series[0].zoom || 1;
        const display = document.getElementById('zoomLevelDisplay');
        if (display) {
            display.textContent = `${Math.round(zoom * 100)}%`;
        }
    }
}

// 跳转到成员视图并筛选指定成员
function jumpToMemberView(userEngName) {
    // 切换到成员视图
    switchTeamView('card');
    
    // 设置筛选器的值
    const filter = document.getElementById('teamMemberFilter');
    if (filter) {
        filter.value = userEngName;
        // 触发筛选
        renderTeamCardView();
    }
    
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 应用进展日期过滤
function applyProgressDateFilter() {
    const filterDate = document.getElementById('progressDateFilter').value;
    if (!filterDate) {
        // 如果没有选择日期，重新加载所有数据
        if (currentTeamView === 'list') {
            loadTeamOKR();
        } else if (currentTeamView === 'card') {
            renderTeamCardView();
        }
        return;
    }
    
    // 重新渲染当前视图
    if (currentTeamView === 'list') {
        loadTeamOKR();
    } else if (currentTeamView === 'card') {
        renderTeamCardView();
    }
}

// 更新日期显示
function updateDateDisplay(input) {
    const display = document.getElementById('dateDisplayText');
    if (!display) return;
    
    if (input.value) {
        display.textContent = input.value;
        display.classList.add('text-gray-900');
        display.classList.remove('text-gray-500');
    } else {
        display.textContent = '选择日期';
        display.classList.add('text-gray-500');
        display.classList.remove('text-gray-900');
    }
}

// 清除进展日期过滤
function clearProgressDateFilter() {
    const input = document.getElementById('progressDateFilter');
    input.value = '';
    updateDateDisplay(input);
    applyProgressDateFilter();
}

// 检查进展是否在日期范围内
function isProgressInDateRange(progressDate) {
    const filterDate = document.getElementById('progressDateFilter').value;
    if (!filterDate) return true;
    
    if (!progressDate) return false;
    
    const filterTimestamp = new Date(filterDate).getTime();
    const progressTimestamp = new Date(progressDate).getTime();
    
    return progressTimestamp >= filterTimestamp;
}

function zoomMindMap(delta) {
    if (!mindMapChart) return;
    
    const option = mindMapChart.getOption();
    if (!option || !option.series || !option.series[0]) return;
    
    let currentZoom = option.series[0].zoom || 1;
    let newZoom = currentZoom + delta;
    
    if (newZoom < 0.1) newZoom = 0.1;
    if (newZoom > 5) newZoom = 5;
    
    mindMapChart.setOption({
        series: [{
            zoom: newZoom
        }]
    });
    
    updateZoomDisplay();
}

function resetMindMapZoom() {
    if (!mindMapChart) return;
    
    mindMapChart.setOption({
        series: [{
            zoom: 1,
            center: null,
            top: '1%',
            left: '7%',
            bottom: '1%',
            right: '30%'
        }]
    });
    
    updateZoomDisplay();
}

// 加载KR的成员进展（使用缓存数据，避免多次请求）
async function loadKRMemberProgress(krId, krTitle) {
    const container = document.getElementById(`kr-progress-${krId}`);
    if (!container) return;
    
    try {
        // 使用缓存的认领记录，避免重复请求
        if (!krClaimsCache) {
            const response = await fetch('/api/team/kr-claims');
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`加载认领记录失败: HTTP ${response.status} - ${errorText || response.statusText}`);
            }
            const data = await response.json();
            
            // 验证返回数据结构
            if (!data || typeof data !== 'object') {
                throw new Error('认领记录数据格式错误：返回数据不是对象');
            }
            
            if (!Array.isArray(data.claims)) {
                throw new Error('认领记录数据格式错误：claims字段不是数组');
            }
            
            krClaimsCache = data;
        }
        
        // 找出认领了该KR的所有成员
        const krClaims = krClaimsCache.claims ? krClaimsCache.claims.filter(c => c.kr_id === krId) : [];
        
        if (krClaims.length === 0) {
            container.innerHTML = '<div class="text-sm text-gray-500">暂无成员认领该KR</div>';
            return;
        }
        
        // 按用户英文名字母序排序
        krClaims.sort((a, b) => a.user_eng_name.localeCompare(b.user_eng_name));
        
        // 从缓存中获取进展数据
        const krProgressData = teamProgressDataCache[krId] || {};
        
        // 渲染每个用户的进展
        let progressHtml = '';
        for (const claim of krClaims) {
            try {
                //console.log('正在渲染成员进展:', claim);
                const memberHtml = renderMemberProgressFromCache(claim, krId, krTitle, krProgressData);
                progressHtml += memberHtml;
            } catch (error) {
                console.error('渲染成员进展失败:', error);
                console.error('错误类型:', error.constructor.name);
                console.error('错误消息:', error.message);
                console.error('错误堆栈:', error.stack);
                console.error('claim对象:', claim);
                
                // 即使单个成员加载失败，也显示错误信息并继续加载其他成员
                progressHtml += `
                    <div class="flex items-start space-x-4 mb-4 pb-4 border-b border-gray-100 last:border-0 last:pb-0 last:mb-0">
                        <img src="https://r.hrc.woa.com/photo/150/${claim.user_eng_name}.png?default_when_absent=true" 
                             alt="${claim.user_chn_name}" 
                             class="w-10 h-10 rounded-full flex-shrink-0">
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-between mb-2">
                                <span class="font-medium text-gray-900">
                                    ${escapeHtml(claim.user_eng_name)}(${escapeHtml(claim.user_chn_name)})
                                </span>
                            </div>
                            <div class="text-sm text-red-500">加载进展失败: ${escapeHtml(error.message || '未知错误')}</div>
                        </div>
                    </div>
                `;
            }
        }
        
        container.innerHTML = progressHtml;
        
        // 初始化所有整体进展为折叠状态
        setTimeout(() => {
            const progressContents = container.querySelectorAll('.progress-content');
            progressContents.forEach(contentDiv => {
                // 初始化为折叠状态（最大高度5行，约5rem）
                contentDiv.style.maxHeight = '5rem';
                contentDiv.style.overflow = 'hidden';
                contentDiv.style.position = 'relative';
                
                // 创建省略号遮罩
                const parentContainer = contentDiv.closest('[onclick*="toggleOverallProgress"]');
                if (parentContainer && !parentContainer.querySelector('.ellipsis-overlay')) {
                    const overlay = document.createElement('div');
                    overlay.className = 'ellipsis-overlay absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent h-8 pointer-events-none';
                    overlay.style.marginBottom = '2rem'; // 添加底部边距
                    overlay.innerHTML = '<span class="absolute bottom-2 right-4 text-gray-500 text-sm font-medium">...</span>';
                    parentContainer.appendChild(overlay);
                }
            });
        }, 0);
    } catch (error) {
        console.error('加载成员进展失败:', error);
        console.error('错误类型:', error.constructor.name);
        console.error('错误消息:', error.message);
        console.error('错误堆栈:', error.stack);
        
        const errorMessage = error.message || error.toString() || '未知错误';
        container.innerHTML = `<div class="text-sm text-red-500">加载进展失败: ${errorMessage}</div>`;
    }
}

// 从缓存渲染单个成员的进展（不发起网络请求）
function renderMemberProgressFromCache(claim, krId, krTitle, krProgressData) {
    try {
        // 验证claim对象
        if (!claim || !claim.user_eng_name) {
            throw new Error('认领记录数据不完整：缺少用户信息');
        }
        
        // 从缓存中获取该用户的进展数据
        const userProgress = krProgressData[claim.user_eng_name];
        
        if (!userProgress) {
            return `
                <div class="flex items-start space-x-4 mb-4 pb-4 border-b border-gray-100 last:border-0 last:pb-0 last:mb-0">
                    <img src="https://r.hrc.woa.com/photo/150/${claim.user_eng_name}.png?default_when_absent=true" 
                         alt="${claim.user_chn_name}" 
                         class="w-10 h-10 rounded-full flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-purple-400 transition-all"
                         onclick="jumpToMemberView('${claim.user_eng_name}')"
                         title="点击查看该成员的所有进展">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between mb-2">
                            <span class="font-medium text-gray-900 cursor-pointer hover:text-purple-600 transition-colors"
                                  onclick="jumpToMemberView('${claim.user_eng_name}')"
                                  title="点击查看该成员的所有进展">
                                ${escapeHtml(claim.user_eng_name)}(${escapeHtml(claim.user_chn_name)})
                            </span>
                        </div>
                        
                        <div class="text-sm text-gray-500">暂无进展记录</div>
                    </div>
                    
                    <button onclick="openCreateTodoModal('${claim.user_eng_name}', '${claim.user_chn_name}', '')"
                            class="ml-4 px-3 py-1 text-xs rounded border hover:bg-gray-50 hidden md:block"
                            style="color: var(--primary-color); border-color: var(--primary-color);"
                            onmouseover="this.style.borderColor='var(--primary-hover)'; this.style.color='var(--primary-hover)';"
                            onmouseout="this.style.borderColor='var(--primary-color)'; this.style.color='var(--primary-color)';"
                    >
                        <i class="fas fa-plus mr-1"></i>记TODO
                    </button>
                </div>
            `;
        }
        
        // 获取进展数据
        const weeklyProgress = userProgress.weekly_progress || [];
        const overallProgress = userProgress.overall_progress;
        const nextWeekPlan = userProgress.next_week_plan;
        const risksIssues = userProgress.risks_issues;
        
        // 获取最新周进展
        const latestWeekly = weeklyProgress.length > 0 ? weeklyProgress[0] : null;
        
        // 应用日期过滤
        const filterDate = document.getElementById('progressDateFilter')?.value;
        let shouldShowProgress = true;
        
        if (filterDate) {
            // 检查是否有任何进展在日期范围内
            const hasWeeklyInRange = latestWeekly && isProgressInDateRange(latestWeekly.created_at);
            const hasOverallInRange = overallProgress && overallProgress.updated_at && isProgressInDateRange(overallProgress.updated_at);
            
            shouldShowProgress = hasWeeklyInRange || hasOverallInRange;
            
            // 如果没有符合条件的进展，返回空字符串（不显示该成员）
            if (!shouldShowProgress) {
                return '';
            }
        }
        
        // 检查是否有实际的进展内容（非空且非纯空白）
        const hasWeeklyContent = latestWeekly && latestWeekly.content && latestWeekly.content.trim().length > 0;
        const hasOverallContent = overallProgress && overallProgress.content && overallProgress.content.trim().length > 0;
        const hasNextWeekContent = nextWeekPlan && nextWeekPlan.content && nextWeekPlan.content.trim().length > 0;
        
        // 如果没有任何实际进展内容，返回空字符串（不显示该成员）
        if (!hasWeeklyContent && !hasOverallContent && !hasNextWeekContent) {
            return '';
        }
        
        return `
            <div class="flex items-start space-x-4 mb-4 pb-4 border-b border-gray-100 last:border-0 last:pb-0 last:mb-0">
                <img src="https://r.hrc.woa.com/photo/150/${claim.user_eng_name}.png?default_when_absent=true" 
                     alt="${claim.user_chn_name}" 
                     class="w-10 h-10 rounded-full flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-purple-400 transition-all"
                     onclick="jumpToMemberView('${claim.user_eng_name}')"
                     title="点击查看该成员的所有进展">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between mb-2">
                        <span class="font-medium text-gray-900 cursor-pointer hover:text-purple-600 transition-colors"
                              onclick="jumpToMemberView('${claim.user_eng_name}')"
                              title="点击查看该成员的所有进展">
                            ${escapeHtml(claim.user_eng_name)}(${escapeHtml(claim.user_chn_name)})
                        </span>
                    </div>
                    
                    <!-- 展示个人KR标题 -->
                    ${userProgress.kr_title ? `
                        <div class="mb-3 bg-blue-50 p-3 rounded-lg border border-blue-200">
                            <div class="text-xs text-blue-600 font-medium mb-1">
                                <i class="fas fa-link mr-1"></i>关联的原始KR
                            </div>
                            <div class="text-sm text-gray-800 font-medium">
                                ${escapeHtml(userProgress.kr_title)}
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="mb-3">
                        <div class="text-sm font-bold text-gray-600 mb-2">本周进展</div>
                        ${latestWeekly ? `
                            <div class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm relative group">
                                <div class="flex justify-between items-center mb-2">
                                    <span class="text-xs text-gray-400">${formatDate(latestWeekly.created_at)}</span>
                                </div>
                                <div class="text-base text-gray-800 markdown-content" onclick="handleImageClick(event)">
                                    ${marked.parse(latestWeekly.content)}
                                </div>
                                <!-- 复制按钮 -->
                                <button onclick="event.stopPropagation(); copyToClipboard(\`${latestWeekly.content.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`, '本周进展已复制')"
                                        class="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-600 hover:text-blue-600 hover:border-blue-300 hover:shadow-sm z-10"
                                        title="复制原始Markdown">
                                    <i class="far fa-copy mr-1"></i>复制
                                </button>
                            </div>
                        ` : '<div class="text-base text-gray-400 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">暂无进展</div>'}
                    </div>
                    
                    ${nextWeekPlan && nextWeekPlan.content ? `
                        <div class="mb-3">
                            <div class="text-sm font-bold text-gray-600 mb-2">
                                下周计划
                            </div>
                            
                            <div class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm relative group">
                                <div class="flex justify-between items-center mb-2">
                                    <span class="text-sm font-medium text-gray-600">
                                        <i class="fas fa-clock mr-1"></i>预计本周占用人天：<span class="text-purple-600 font-bold">${nextWeekPlan.estimated_man_days || 0}</span> 天
                                    </span>
                                    <span class="text-xs text-gray-400">
                                        ${formatDate(nextWeekPlan.updated_at)}
                                    </span>
                                </div>
                                
                                <div class="text-base text-gray-800 markdown-content" onclick="handleImageClick(event)">
                                    ${marked.parse(nextWeekPlan.content)}
                                </div>
                                <!-- 复制按钮 -->
                                <button onclick="event.stopPropagation(); copyToClipboard(\`${nextWeekPlan.content.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`, '下周计划已复制')"
                                        class="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-600 hover:text-blue-600 hover:border-blue-300 hover:shadow-sm z-10"
                                        title="复制原始Markdown">
                                    <i class="far fa-copy mr-1"></i>复制
                                </button>
                            </div>
                        </div>
                    ` : ''}
                    
                    ${risksIssues ? `
                        <div class="mb-3">
                            <div class="text-sm font-bold text-gray-600 mb-2">问题和风险</div>
                            <div class="bg-red-50 p-4 rounded-lg border border-red-200 shadow-sm relative group">
                                <div class="text-base text-red-700 markdown-content" onclick="handleImageClick(event)">
                                    ${marked.parse(risksIssues)}
                                </div>
                                <!-- 复制按钮 -->
                                <button onclick="event.stopPropagation(); copyToClipboard(\`${risksIssues.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`, '问题和风险已复制')"
                                        class="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-600 hover:text-blue-600 hover:border-blue-300 hover:shadow-sm z-10"
                                        title="复制原始Markdown">
                                    <i class="far fa-copy mr-1"></i>复制
                                </button>
                            </div>
                        </div>
                    ` : ''}
                    
                    <div>
                        <div class="text-sm font-bold text-gray-600 mb-2">整体进展</div>
                        ${overallProgress && overallProgress.content ? `
                            <div class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm group cursor-pointer relative" onclick="toggleOverallProgress(this)">
                                <div class="flex justify-between items-center mb-2">
                                    <span class="text-xs text-gray-400">
                                        ${formatDate(overallProgress.updated_at)}
                                    </span>
                                    <span class="text-xs text-gray-500 group-hover:text-gray-700 expand-hint">
                                        <i class="fas fa-chevron-down mr-1"></i>展开
                                    </span>
                                </div>
                                
                                <div class="text-base text-gray-800 markdown-content progress-content" onclick="event.stopPropagation(); handleImageClick(event)">
                                    ${marked.parse(overallProgress.content)}
                                </div>
                                <!-- 复制按钮 -->
                                <button onclick="event.stopPropagation(); copyToClipboard(\`${overallProgress.content.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`, '整体进展已复制')"
                                        class="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-600 hover:text-blue-600 hover:border-blue-300 hover:shadow-sm z-10"
                                        title="复制原始Markdown">
                                    <i class="far fa-copy mr-1"></i>复制
                                </button>
                            </div>
                        ` : '<div class="text-base text-gray-400 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">暂无进展</div>'}
                    </div>
                </div>
                
                <div class="flex flex-col space-y-2">
                    ${weeklyProgress.length > 1 ? `
                        <button onclick="openTeamKRHistory(${userProgress.user_kr_id}, '${claim.user_chn_name}')" 
                                class="px-3 py-1 text-xs rounded border hover:bg-gray-50 whitespace-nowrap"
                                style="color: var(--primary-color); border-color: var(--primary-color);"
                                onmouseover="this.style.borderColor='var(--primary-hover)'; this.style.color='var(--primary-hover)';"
                                onmouseout="this.style.borderColor='var(--primary-color)'; this.style.color='var(--primary-color)';"
                        >
                            <i class="fas fa-history mr-1"></i>查看历史
                        </button>
                    ` : ''}
                    <button onclick="openCreateTodoModal('${claim.user_eng_name}', '${claim.user_chn_name}', '')"
                            class="px-3 py-1 text-xs rounded border hover:bg-gray-50 whitespace-nowrap hidden md:block"
                            style="color: var(--primary-color); border-color: var(--primary-color);"
                            onmouseover="this.style.borderColor='var(--primary-hover)'; this.style.color='var(--primary-hover)';"
                            onmouseout="this.style.borderColor='var(--primary-color)'; this.style.color='var(--primary-color)';"
                    >
                        <i class="fas fa-plus mr-1"></i>记TODO
                    </button>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('渲染成员进展失败:', error);
        const errorMessage = error.message || error.toString() || '未知错误';
        const userName = claim?.user_eng_name || '未知';
        const userChnName = claim?.user_chn_name || '未知用户';
        
        return `
            <div class="flex items-start space-x-4 mb-4 pb-4 border-b border-gray-100 last:border-0 last:pb-0 last:mb-0">
                <img src="https://r.hrc.woa.com/photo/150/${userName}.png?default_when_absent=true" 
                     alt="${userChnName}" 
                     class="w-10 h-10 rounded-full flex-shrink-0">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between mb-2">
                        <span class="font-medium text-gray-900">
                            ${escapeHtml(userName)}(${escapeHtml(userChnName)})
                        </span>
                    </div>
                    
                    <div class="text-sm text-red-500">加载失败: ${escapeHtml(errorMessage)}</div>
                </div>
            </div>
        `;
    }
}

// 跳转到成员视图并筛选指定成员
function jumpToMemberView(userEngName) {
    // 切换到成员视图
    switchTeamView('card');
    
    // 设置筛选器的值
    const filter = document.getElementById('teamMemberFilter');
    if (filter) {
        filter.value = userEngName;
        // 触发筛选
        renderTeamCardView();
    }
    
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 应用进展日期过滤
function applyProgressDateFilter() {
    const filterDate = document.getElementById('progressDateFilter').value;
    if (!filterDate) {
        // 如果没有选择日期，重新加载所有数据
        if (currentTeamView === 'list') {
            loadTeamOKR();
        } else if (currentTeamView === 'card') {
            renderTeamCardView();
        }
        return;
    }
    
    // 重新渲染当前视图
    if (currentTeamView === 'list') {
        loadTeamOKR();
    } else if (currentTeamView === 'card') {
        renderTeamCardView();
    }
}

// 更新日期显示
function updateDateDisplay(input) {
    const display = document.getElementById('dateDisplayText');
    if (!display) return;
    
    if (input.value) {
        display.textContent = input.value;
        display.classList.add('text-gray-900');
        display.classList.remove('text-gray-500');
    } else {
        display.textContent = '选择日期';
        display.classList.add('text-gray-500');
        display.classList.remove('text-gray-900');
    }
}

// 清除进展日期过滤
function clearProgressDateFilter() {
    const input = document.getElementById('progressDateFilter');
    input.value = '';
    updateDateDisplay(input);
    applyProgressDateFilter();
}

// 检查进展是否在日期范围内
function isProgressInDateRange(progressDate) {
    const filterDate = document.getElementById('progressDateFilter').value;
    if (!filterDate) return true;
    
    if (!progressDate) return false;
    
    const filterTimestamp = new Date(filterDate).getTime();
    const progressTimestamp = new Date(progressDate).getTime();
    
    return progressTimestamp >= filterTimestamp;
}

// 渲染单个成员的进展
async function renderMemberProgress(claim, krId, krTitle) {
    try {
        // 验证claim对象
        if (!claim || !claim.user_eng_name) {
            throw new Error('认领记录数据不完整：缺少用户信息');
        }
        
        // 获取该用户的个人KR（通过source_kr_id匹配）
        let userResponse;
        try {
            userResponse = await fetch(`/api/user/objectives?user_eng_name=${claim.user_eng_name}`);
        } catch (fetchError) {
            console.error(`获取用户 ${claim.user_eng_name} 的OKR失败:`, fetchError);
            throw new Error(`网络请求失败: ${fetchError.message}`);
        }
        
        if (!userResponse.ok) {
            const errorText = await userResponse.text();
            throw new Error(`加载用户OKR失败: HTTP ${userResponse.status} - ${errorText || userResponse.statusText}`);
        }
        const userData = await userResponse.json();
        
        // 验证返回数据
        if (!userData || !Array.isArray(userData.objectives)) {
            throw new Error('用户OKR数据格式错误');
        }
        
        let userKR = null;
        let userKRObjId = null;
        
        // 查找对应的个人KR
        for (const obj of userData.objectives) {
            if (obj.key_results) {
                const found = obj.key_results.find(k => k.source_kr_id === krId);
                if (found) {
                    userKR = found;
                    userKRObjId = obj.id;
                    break;
                }
            }
        }
        
        if (!userKR) {
            return `
                <div class="flex items-start space-x-4 mb-4 pb-4 border-b border-gray-100 last:border-0 last:pb-0 last:mb-0">
                    <img src="https://r.hrc.woa.com/photo/150/${claim.user_eng_name}.png?default_when_absent=true" 
                         alt="${claim.user_chn_name}" 
                         class="w-10 h-10 rounded-full flex-shrink-0">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between mb-2">
                            <span class="font-medium text-gray-900">
                                ${escapeHtml(claim.user_eng_name)}(${escapeHtml(claim.user_chn_name)})
                            </span>
                        </div>
                        
                        <div class="text-sm text-gray-500">暂无进展记录</div>
                    </div>
                    
                    <button onclick="openCreateTodoModal('${claim.user_eng_name}', '${claim.user_chn_name}', '')"
                            class="ml-4 px-3 py-1 text-xs rounded border hover:bg-gray-50 hidden md:block"
                            style="color: var(--primary-color); border-color: var(--primary-color);"
                            onmouseover="this.style.borderColor='var(--primary-hover)'; this.style.color='var(--primary-hover)';"
                            onmouseout="this.style.borderColor='var(--primary-color)'; this.style.color='var(--primary-color)';"
                    >
                        <i class="fas fa-plus mr-1"></i>记TODO
                    </button>
                </div>
            `;
        }
        
        // 加载进展数据
        let weeklyData = { progress: [] };
        let overallData = { content: '' };
        
        try {
            const [weeklyResponse, overallResponse] = await Promise.all([
                fetch(`/api/progress/weekly/${userKR.id}`).catch(err => {
                    console.warn(`获取周进展失败 (KR ${userKR.id}):`, err);
                    return { ok: false };
                }),
                fetch(`/api/progress/overall/${userKR.id}?user_eng_name=${claim.user_eng_name}`).catch(err => {
                    console.warn(`获取整体进展失败 (KR ${userKR.id}):`, err);
                    return { ok: false };
                })
            ]);
            
            if (weeklyResponse.ok) {
                weeklyData = await weeklyResponse.json();
            }
            if (overallResponse.ok) {
                overallData = await overallResponse.json();
            }
        } catch (error) {
            console.warn('加载进展数据时出错:', error);
            // 使用默认空数据继续渲染
        }
        
        // 获取最新周进展
        const latestWeekly = weeklyData.progress && weeklyData.progress.length > 0 ? weeklyData.progress[0] : null;
        
        // 应用日期过滤
        const filterDate = document.getElementById('progressDateFilter')?.value;
        let shouldShowProgress = true;
        
        if (filterDate) {
            // 检查是否有任何进展在日期范围内
            const hasWeeklyInRange = latestWeekly && isProgressInDateRange(latestWeekly.created_at);
            const hasOverallInRange = overallData.content && overallData.updated_at && isProgressInDateRange(overallData.updated_at);
            
            shouldShowProgress = hasWeeklyInRange || hasOverallInRange;
            
            // 如果没有符合条件的进展，返回空字符串（不显示该成员）
            if (!shouldShowProgress) {
                return '';
            }
        }
        
        // 检查是否有实际的进展内容（非空且非纯空白）
        const hasWeeklyContent = latestWeekly && latestWeekly.content && latestWeekly.content.trim().length > 0;
        const hasOverallContent = overallData.content && overallData.content.trim().length > 0;
        
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
        
        const hasNextWeekContent = nextWeekPlan && nextWeekPlan.content && nextWeekPlan.content.trim().length > 0;
        
        // 如果没有任何实际进展内容，返回空字符串（不显示该成员）
        if (!hasWeeklyContent && !hasOverallContent && !hasNextWeekContent) {
            return '';
        }
        
        return `
            <div class="flex items-start space-x-4 mb-4 pb-4 border-b border-gray-100 last:border-0 last:pb-0 last:mb-0">
                <img src="https://r.hrc.woa.com/photo/150/${claim.user_eng_name}.png?default_when_absent=true" 
                     alt="${claim.user_chn_name}" 
                     class="w-10 h-10 rounded-full flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-purple-400 transition-all"
                     onclick="jumpToMemberView('${claim.user_eng_name}')"
                     title="点击查看该成员的所有进展">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between mb-2">
                        <span class="font-medium text-gray-900 cursor-pointer hover:text-purple-600 transition-colors"
                              onclick="jumpToMemberView('${claim.user_eng_name}')"
                              title="点击查看该成员的所有进展">
                            ${escapeHtml(claim.user_eng_name)}(${escapeHtml(claim.user_chn_name)})
                        </span>
                    </div>
                    
                    <!-- 展示个人KR标题 -->
                    ${userProgress.kr_title ? `
                        <div class="mb-3 bg-blue-50 p-3 rounded-lg border border-blue-200">
                            <div class="text-xs text-blue-600 font-medium mb-1">
                                <i class="fas fa-link mr-1"></i>关联的原始KR
                            </div>
                            <div class="text-sm text-gray-800 font-medium">
                                ${escapeHtml(userProgress.kr_title)}
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="mb-3">
                        <div class="text-sm font-bold text-gray-600 mb-2">本周进展</div>
                        ${latestWeekly ? `
                            <div class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm relative group">
                                <div class="flex justify-between items-center mb-2">
                                    <span class="text-xs text-gray-400">${formatDate(latestWeekly.created_at)}</span>
                                </div>
                                <div class="text-base text-gray-800 markdown-content" onclick="handleImageClick(event)">
                                    ${marked.parse(latestWeekly.content)}
                                </div>
                                <!-- 复制按钮 -->
                                <button onclick="event.stopPropagation(); copyToClipboard(\`${latestWeekly.content.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`, '本周进展已复制')"
                                        class="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-600 hover:text-blue-600 hover:border-blue-300 hover:shadow-sm z-10"
                                        title="复制原始Markdown">
                                    <i class="far fa-copy mr-1"></i>复制
                                </button>
                            </div>
                        ` : '<div class="text-base text-gray-400 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">暂无进展</div>'}
                    </div>
                    
                    ${nextWeekPlan && nextWeekPlan.content ? `
                        <div class="mb-3">
                            <div class="text-sm font-bold text-gray-600 mb-2">
                                下周计划
                            </div>
                            
                            <div class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm relative group">
                                <div class="flex justify-between items-center mb-2">
                                    <span class="text-sm font-medium text-gray-600">
                                        <i class="fas fa-clock mr-1"></i>预计本周占用人天：<span class="text-purple-600 font-bold">${nextWeekPlan.estimated_man_days || 0}</span> 天
                                    </span>
                                    <span class="text-xs text-gray-400">
                                        ${formatDate(nextWeekPlan.updated_at)}
                                    </span>
                                </div>
                                
                                <div class="text-base text-gray-800 markdown-content" onclick="handleImageClick(event)">
                                    ${marked.parse(nextWeekPlan.content)}
                                </div>
                                <!-- 复制按钮 -->
                                <button onclick="event.stopPropagation(); copyToClipboard(\`${nextWeekPlan.content.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`, '下周计划已复制')"
                                        class="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-600 hover:text-blue-600 hover:border-blue-300 hover:shadow-sm z-10"
                                        title="复制原始Markdown">
                                    <i class="far fa-copy mr-1"></i>复制
                                </button>
                            </div>
                        </div>
                    ` : ''}
                    
                    ${userKR.risks_issues ? `
                        <div class="mb-3">
                            <div class="text-sm font-bold text-gray-600 mb-2">问题和风险</div>
                            <div class="bg-red-50 p-4 rounded-lg border border-red-200 shadow-sm">
                                <div class="text-base text-red-700 markdown-content" onclick="handleImageClick(event)">
                                    ${marked.parse(userKR.risks_issues)}
                                </div>
                            </div>
                        </div>
                    ` : ''}
                    
                    <div>
                        <div class="text-sm font-bold text-gray-600 mb-2">整体进展</div>
                        ${overallData.content ? `
                            <div class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm group cursor-pointer relative" onclick="toggleOverallProgress(this)">
                                <div class="flex justify-between items-center mb-2">
                                    <span class="text-xs text-gray-400">
                                        ${formatDate(overallData.updated_at)}
                                    </span>
                                    <span class="text-xs text-gray-500 group-hover:text-gray-700 expand-hint">
                                        <i class="fas fa-chevron-down mr-1"></i>展开
                                    </span>
                                </div>
                                
                                <div class="text-base text-gray-800 markdown-content progress-content" onclick="event.stopPropagation(); handleImageClick(event)">
                                    ${marked.parse(overallData.content)}
                                </div>
                                <!-- 复制按钮 -->
                                <button onclick="event.stopPropagation(); copyToClipboard(\`${overallData.content.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`, '整体进展已复制')"
                                        class="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-600 hover:text-blue-600 hover:border-blue-300 hover:shadow-sm z-10"
                                        title="复制原始Markdown">
                                    <i class="far fa-copy mr-1"></i>复制
                                </button>
                            </div>
                        ` : '<div class="text-base text-gray-400 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">暂无进展</div>'}
                    </div>
                </div>
                
                <div class="flex flex-col space-y-2">
                    ${weeklyData.progress && weeklyData.progress.length > 1 ? `
                        <button onclick="openTeamKRHistory(${userKR.id}, '${claim.user_chn_name}')" 
                                class="px-3 py-1 text-xs rounded border hover:bg-gray-50 whitespace-nowrap"
                                style="color: var(--primary-color); border-color: var(--primary-color);"
                                onmouseover="this.style.borderColor='var(--primary-hover)'; this.style.color='var(--primary-hover)';"
                                onmouseout="this.style.borderColor='var(--primary-color)'; this.style.color='var(--primary-color)';"
                        >
                            <i class="fas fa-history mr-1"></i>查看历史
                        </button>
                    ` : ''}
                    <button onclick="openCreateTodoModal('${claim.user_eng_name}', '${claim.user_chn_name}', '')"
                            class="px-3 py-1 text-xs rounded border hover:bg-gray-50 whitespace-nowrap hidden md:block"
                            style="color: var(--primary-color); border-color: var(--primary-color);"
                            onmouseover="this.style.borderColor='var(--primary-hover)'; this.style.color='var(--primary-hover)';"
                            onmouseout="this.style.borderColor='var(--primary-color)'; this.style.color='var(--primary-color)';"
                    >
                        <i class="fas fa-plus mr-1"></i>记TODO
                    </button>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('渲染成员进展失败:', error);
        console.error('错误类型:', error.constructor.name);
        console.error('错误消息:', error.message);
        console.error('错误堆栈:', error.stack);
        console.error('claim对象:', claim);
        
        const errorMessage = error.message || error.toString() || '未知错误';
        const userName = claim?.user_eng_name || '未知';
        const userChnName = claim?.user_chn_name || '未知用户';
        
        return `
            <div class="flex items-start space-x-4 mb-4 pb-4 border-b border-gray-100 last:border-0 last:pb-0 last:mb-0">
                <img src="https://r.hrc.woa.com/photo/150/${userName}.png?default_when_absent=true" 
                     alt="${userChnName}" 
                     class="w-10 h-10 rounded-full flex-shrink-0">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between mb-2">
                        <span class="font-medium text-gray-900">
                            ${escapeHtml(userName)}(${escapeHtml(userChnName)})
                        </span>
                    </div>
                    
                    <div class="text-sm text-red-500">加载失败: ${escapeHtml(errorMessage)}</div>
                </div>
            </div>
        `;
    }
}

// 跳转到成员视图并筛选指定成员
function jumpToMemberView(userEngName) {
    // 切换到成员视图
    switchTeamView('card');
    
    // 设置筛选器的值
    const filter = document.getElementById('teamMemberFilter');
    if (filter) {
        filter.value = userEngName;
        // 触发筛选
        renderTeamCardView();
    }
    
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 应用进展日期过滤
function applyProgressDateFilter() {
    const filterDate = document.getElementById('progressDateFilter').value;
    if (!filterDate) {
        // 如果没有选择日期，重新加载所有数据
        if (currentTeamView === 'list') {
            loadTeamOKR();
        } else if (currentTeamView === 'card') {
            renderTeamCardView();
        }
        return;
    }
    
    // 重新渲染当前视图
    if (currentTeamView === 'list') {
        loadTeamOKR();
    } else if (currentTeamView === 'card') {
        renderTeamCardView();
    }
}

// 更新日期显示
function updateDateDisplay(input) {
    const display = document.getElementById('dateDisplayText');
    if (!display) return;
    
    if (input.value) {
        display.textContent = input.value;
        display.classList.add('text-gray-900');
        display.classList.remove('text-gray-500');
    } else {
        display.textContent = '选择日期';
        display.classList.add('text-gray-500');
        display.classList.remove('text-gray-900');
    }
}

// 清除进展日期过滤
function clearProgressDateFilter() {
    const input = document.getElementById('progressDateFilter');
    input.value = '';
    updateDateDisplay(input);
    applyProgressDateFilter();
}

// 检查进展是否在日期范围内
function isProgressInDateRange(progressDate) {
    const filterDate = document.getElementById('progressDateFilter').value;
    if (!filterDate) return true;
    
    if (!progressDate) return false;
    
    const filterTimestamp = new Date(filterDate).getTime();
    const progressTimestamp = new Date(progressDate).getTime();
    
    return progressTimestamp >= filterTimestamp;
}

// 打开创建待办模态框（从进展中）
window.openCreateTodoModal = async function(assigneeEng, assigneeChn, defaultDescription) {
    document.getElementById('todoAssigneeEng').value = assigneeEng;
    document.getElementById('todoAssigneeChn').value = assigneeChn;
    document.getElementById('todoDescription').value = defaultDescription || '';
    
    // 加载并填充成员列表
    await loadMemberOptionsForTodo();
    
    // 如果提供了默认跟进人，设置选中值
    if (assigneeEng && assigneeChn) {
        const select = document.getElementById('todoAssignee');
        select.value = assigneeEng;
    }
    
    openModal('todoModal');
}

// 加载成员选项到待办事项的下拉框
window.loadMemberOptionsForTodo = async function() {
    const select = document.getElementById('todoAssignee');
    if (!select) return;
    
    // 保存当前选中的值
    const currentValue = select.value;
    
    try {
        const response = await fetch('/api/members/okr-claimers');
        if (!response.ok) {
            throw new Error('加载成员列表失败');
        }
        const data = await response.json();
        
        // 清空现有选项，保留第一个"请选择"选项
        select.innerHTML = '<option value="">请选择跟进人</option>';
        
        // 添加成员选项
        data.members.forEach(member => {
            const option = document.createElement('option');
            option.value = member.user_eng_name;
            option.textContent = `${member.user_eng_name} (${member.user_chn_name})`;
            select.appendChild(option);
        });
        
        // 恢复之前选中的值（如果还存在）
        if (currentValue) {
            select.value = currentValue;
        }
    } catch (error) {
        console.error('加载成员列表失败:', error);
        // 如果加载失败，使用当前登录用户作为默认选项
        if (currentUser) {
            select.innerHTML = `
                <option value="">请选择跟进人</option>
                <option value="${currentUser.EngName}">${currentUser.EngName} (${currentUser.ChnName})</option>
            `;
        }
    }
}

// 监听下拉框选择变化，更新隐藏字段
function handleTodoAssigneeChange() {
    const select = document.getElementById('todoAssignee');
    const selectedOption = select.options[select.selectedIndex];
    
    if (selectedOption && selectedOption.value) {
        // 解析 "EngName (ChnName)" 格式
        const text = selectedOption.textContent;
        const match = text.match(/^(.+)\s+\((.+)\)$/);
        if (match) {
            document.getElementById('todoAssigneeEng').value = selectedOption.value;
            document.getElementById('todoAssigneeChn').value = match[2];
        }
    }
}

async function handleObjectiveSubmit(e) {
    e.preventDefault();
    
    const content = document.getElementById('objContent').value.trim();
    const objType = document.getElementById('objType').value;
    const weight = parseInt(document.getElementById('objWeight').value);
    
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
        const response = await fetch(`/api/team/objectives?user_eng_name=${currentUser.EngName}`, {
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
            closeModal('objectiveModal');
            document.getElementById('objectiveForm').reset();
            await loadTeamOKR();
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
        console.error('创建Objective失败:', error);
        showToast(error.message || '创建失败', 'error');
    } finally {
        hideLoading();
    }
}

// 跳转到成员视图并筛选指定成员
function jumpToMemberView(userEngName) {
    // 切换到成员视图
    switchTeamView('card');
    
    // 设置筛选器的值
    const filter = document.getElementById('teamMemberFilter');
    if (filter) {
        filter.value = userEngName;
        // 触发筛选
        renderTeamCardView();
    }
    
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 应用进展日期过滤
function applyProgressDateFilter() {
    const filterDate = document.getElementById('progressDateFilter').value;
    if (!filterDate) {
        // 如果没有选择日期，重新加载所有数据
        if (currentTeamView === 'list') {
            loadTeamOKR();
        } else if (currentTeamView === 'card') {
            renderTeamCardView();
        }
        return;
    }
    
    // 重新渲染当前视图
    if (currentTeamView === 'list') {
        loadTeamOKR();
    } else if (currentTeamView === 'card') {
        renderTeamCardView();
    }
}

// 更新日期显示
function updateDateDisplay(input) {
    const display = document.getElementById('dateDisplayText');
    if (!display) return;
    
    if (input.value) {
        display.textContent = input.value;
        display.classList.add('text-gray-900');
        display.classList.remove('text-gray-500');
    } else {
        display.textContent = '选择日期';
        display.classList.add('text-gray-500');
        display.classList.remove('text-gray-900');
    }
}

// 清除进展日期过滤
function clearProgressDateFilter() {
    const input = document.getElementById('progressDateFilter');
    input.value = '';
    updateDateDisplay(input);
    applyProgressDateFilter();
}

// 检查进展是否在日期范围内
function isProgressInDateRange(progressDate) {
    const filterDate = document.getElementById('progressDateFilter').value;
    if (!filterDate) return true;
    
    if (!progressDate) return false;
    
    const filterTimestamp = new Date(filterDate).getTime();
    const progressTimestamp = new Date(progressDate).getTime();
    
    return progressTimestamp >= filterTimestamp;
}

function addKR(objectiveId) {
    document.getElementById('krObjectiveId').value = objectiveId;
    openModal('krModal');
}

async function handleKRSubmit(e) {
    e.preventDefault();
    
    const objectiveId = document.getElementById('krObjectiveId').value;
    const content = document.getElementById('krContent').value.trim();
    
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
        const response = await fetch(`/api/team/key-results?user_eng_name=${currentUser.EngName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ objective_id: parseInt(objectiveId), title: content, description: '' })
        });
        
        if (response.ok) {
            showToast('创建成功', 'success');
            closeModal('krModal');
            document.getElementById('krForm').reset();
            await loadTeamOKR();
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
        console.error('创建KR失败:', error);
        showToast(error.message || '创建失败', 'error');
    } finally {
        hideLoading();
    }
}

// 跳转到成员视图并筛选指定成员
function jumpToMemberView(userEngName) {
    // 切换到成员视图
    switchTeamView('card');
    
    // 设置筛选器的值
    const filter = document.getElementById('teamMemberFilter');
    if (filter) {
        filter.value = userEngName;
        // 触发筛选
        renderTeamCardView();
    }
    
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 应用进展日期过滤
function applyProgressDateFilter() {
    const filterDate = document.getElementById('progressDateFilter').value;
    if (!filterDate) {
        // 如果没有选择日期，重新加载所有数据
        if (currentTeamView === 'list') {
            loadTeamOKR();
        } else if (currentTeamView === 'card') {
            renderTeamCardView();
        }
        return;
    }
    
    // 重新渲染当前视图
    if (currentTeamView === 'list') {
        loadTeamOKR();
    } else if (currentTeamView === 'card') {
        renderTeamCardView();
    }
}

// 更新日期显示
function updateDateDisplay(input) {
    const display = document.getElementById('dateDisplayText');
    if (!display) return;
    
    if (input.value) {
        display.textContent = input.value;
        display.classList.add('text-gray-900');
        display.classList.remove('text-gray-500');
    } else {
        display.textContent = '选择日期';
        display.classList.add('text-gray-500');
        display.classList.remove('text-gray-900');
    }
}

// 清除进展日期过滤
function clearProgressDateFilter() {
    const input = document.getElementById('progressDateFilter');
    input.value = '';
    updateDateDisplay(input);
    applyProgressDateFilter();
}

// 检查进展是否在日期范围内
function isProgressInDateRange(progressDate) {
    const filterDate = document.getElementById('progressDateFilter').value;
    if (!filterDate) return true;
    
    if (!progressDate) return false;
    
    const filterTimestamp = new Date(filterDate).getTime();
    const progressTimestamp = new Date(progressDate).getTime();
    
    return progressTimestamp >= filterTimestamp;
}

async function claimKR(krId, objectiveId) {
    if (!confirm('确认认领该Key Result？')) return;
    
    showLoading();
    try {
        const response = await fetch('/api/team/claim', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                kr_id: krId,
                objective_id: objectiveId,
                user_eng_name: currentUser.EngName,
                user_chn_name: currentUser.ChnName
            })
        });
        
        if (response.ok) {
            showToast('认领成功', 'success');
            await loadTeamOKR();
        } else {
            const error = await response.json();
            showToast(error.detail || '认领失败', 'error');
        }
    } catch (error) {
        console.error('认领KR失败:', error);
        showToast('认领失败', 'error');
    } finally {
        hideLoading();
    }
}

// 跳转到成员视图并筛选指定成员
function jumpToMemberView(userEngName) {
    // 切换到成员视图
    switchTeamView('card');
    
    // 设置筛选器的值
    const filter = document.getElementById('teamMemberFilter');
    if (filter) {
        filter.value = userEngName;
        // 触发筛选
        renderTeamCardView();
    }
    
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 应用进展日期过滤
function applyProgressDateFilter() {
    const filterDate = document.getElementById('progressDateFilter').value;
    if (!filterDate) {
        // 如果没有选择日期，重新加载所有数据
        if (currentTeamView === 'list') {
            loadTeamOKR();
        } else if (currentTeamView === 'card') {
            renderTeamCardView();
        }
        return;
    }
    
    // 重新渲染当前视图
    if (currentTeamView === 'list') {
        loadTeamOKR();
    } else if (currentTeamView === 'card') {
        renderTeamCardView();
    }
}

// 更新日期显示
function updateDateDisplay(input) {
    const display = document.getElementById('dateDisplayText');
    if (!display) return;
    
    if (input.value) {
        display.textContent = input.value;
        display.classList.add('text-gray-900');
        display.classList.remove('text-gray-500');
    } else {
        display.textContent = '选择日期';
        display.classList.add('text-gray-500');
        display.classList.remove('text-gray-900');
    }
}

// 清除进展日期过滤
function clearProgressDateFilter() {
    const input = document.getElementById('progressDateFilter');
    input.value = '';
    updateDateDisplay(input);
    applyProgressDateFilter();
}

// 检查进展是否在日期范围内
function isProgressInDateRange(progressDate) {
    const filterDate = document.getElementById('progressDateFilter').value;
    if (!filterDate) return true;
    
    if (!progressDate) return false;
    
    const filterTimestamp = new Date(filterDate).getTime();
    const progressTimestamp = new Date(progressDate).getTime();
    
    return progressTimestamp >= filterTimestamp;
}

async function deleteObjective(objId) {
    if (!confirm('确认删除该Objective及其所有Key Results？')) return;
    
    showLoading();
    try {
        const response = await fetch(`/api/team/objectives/${objId}?user_eng_name=${currentUser.EngName}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showToast('删除成功', 'success');
            await loadTeamOKR();
        } else {
            throw new Error('删除失败');
        }
    } catch (error) {
        console.error('删除Objective失败:', error);
        showToast('删除失败', 'error');
    } finally {
        hideLoading();
    }
}

// 跳转到成员视图并筛选指定成员
function jumpToMemberView(userEngName) {
    // 切换到成员视图
    switchTeamView('card');
    
    // 设置筛选器的值
    const filter = document.getElementById('teamMemberFilter');
    if (filter) {
        filter.value = userEngName;
        // 触发筛选
        renderTeamCardView();
    }
    
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 应用进展日期过滤
function applyProgressDateFilter() {
    const filterDate = document.getElementById('progressDateFilter').value;
    if (!filterDate) {
        // 如果没有选择日期，重新加载所有数据
        if (currentTeamView === 'list') {
            loadTeamOKR();
        } else if (currentTeamView === 'card') {
            renderTeamCardView();
        }
        return;
    }
    
    // 重新渲染当前视图
    if (currentTeamView === 'list') {
        loadTeamOKR();
    } else if (currentTeamView === 'card') {
        renderTeamCardView();
    }
}

// 更新日期显示
function updateDateDisplay(input) {
    const display = document.getElementById('dateDisplayText');
    if (!display) return;
    
    if (input.value) {
        display.textContent = input.value;
        display.classList.add('text-gray-900');
        display.classList.remove('text-gray-500');
    } else {
        display.textContent = '选择日期';
        display.classList.add('text-gray-500');
        display.classList.remove('text-gray-900');
    }
}

// 清除进展日期过滤
function clearProgressDateFilter() {
    const input = document.getElementById('progressDateFilter');
    input.value = '';
    updateDateDisplay(input);
    applyProgressDateFilter();
}

// 检查进展是否在日期范围内
function isProgressInDateRange(progressDate) {
    const filterDate = document.getElementById('progressDateFilter').value;
    if (!filterDate) return true;
    
    if (!progressDate) return false;
    
    const filterTimestamp = new Date(filterDate).getTime();
    const progressTimestamp = new Date(progressDate).getTime();
    
    return progressTimestamp >= filterTimestamp;
}

async function deleteKR(krId) {
    if (!confirm('确认删除该Key Result？')) return;
    
    showLoading();
    try {
        const response = await fetch(`/api/team/key-results/${krId}?user_eng_name=${currentUser.EngName}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showToast('删除成功', 'success');
            await loadTeamOKR();
        } else {
            throw new Error('删除失败');
        }
    } catch (error) {
        console.error('删除KR失败:', error);
        showToast('删除失败', 'error');
    } finally {
        hideLoading();
    }
}

// 跳转到成员视图并筛选指定成员
function jumpToMemberView(userEngName) {
    // 切换到成员视图
    switchTeamView('card');
    
    // 设置筛选器的值
    const filter = document.getElementById('teamMemberFilter');
    if (filter) {
        filter.value = userEngName;
        // 触发筛选
        renderTeamCardView();
    }
    
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 应用进展日期过滤
function applyProgressDateFilter() {
    const filterDate = document.getElementById('progressDateFilter').value;
    if (!filterDate) {
        // 如果没有选择日期，重新加载所有数据
        if (currentTeamView === 'list') {
            loadTeamOKR();
        } else if (currentTeamView === 'card') {
            renderTeamCardView();
        }
        return;
    }
    
    // 重新渲染当前视图
    if (currentTeamView === 'list') {
        loadTeamOKR();
    } else if (currentTeamView === 'card') {
        renderTeamCardView();
    }
}

// 更新日期显示
function updateDateDisplay(input) {
    const display = document.getElementById('dateDisplayText');
    if (!display) return;
    
    if (input.value) {
        display.textContent = input.value;
        display.classList.add('text-gray-900');
        display.classList.remove('text-gray-500');
    } else {
        display.textContent = '选择日期';
        display.classList.add('text-gray-500');
        display.classList.remove('text-gray-900');
    }
}

// 清除进展日期过滤
function clearProgressDateFilter() {
    const input = document.getElementById('progressDateFilter');
    input.value = '';
    updateDateDisplay(input);
    applyProgressDateFilter();
}

// 检查进展是否在日期范围内
function isProgressInDateRange(progressDate) {
    const filterDate = document.getElementById('progressDateFilter').value;
    if (!filterDate) return true;
    
    if (!progressDate) return false;
    
    const filterTimestamp = new Date(filterDate).getTime();
    const progressTimestamp = new Date(progressDate).getTime();
    
    return progressTimestamp >= filterTimestamp;
}

async function updateTeamObjective(element, objId, title) {
    const trimmedTitle = title.trim();
    
    // 获取原始值
    const originalTitle = element.dataset.original || '';
    
    // 如果内容没有变化，直接返回，不提交
    if (trimmedTitle === originalTitle) {
        return;
    }
    
    if (!trimmedTitle) {
        showToast('Objective内容不能为空', 'error');
        element.textContent = originalTitle;
        return;
    }
    
    try {
        const response = await fetch(`/api/team/objectives/${objId}?user_eng_name=${currentUser.EngName}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: trimmedTitle })
        });
        
        if (response.ok) {
            showToast('更新成功', 'success');
            // 更新原始值
            element.dataset.original = trimmedTitle;
        } else {
            throw new Error('更新失败');
        }
    } catch (error) {
        console.error('更新Objective失败:', error);
        showToast('更新失败', 'error');
        element.textContent = originalTitle;
    }
}

// 跳转到成员视图并筛选指定成员
function jumpToMemberView(userEngName) {
    // 切换到成员视图
    switchTeamView('card');
    
    // 设置筛选器的值
    const filter = document.getElementById('teamMemberFilter');
    if (filter) {
        filter.value = userEngName;
        // 触发筛选
        renderTeamCardView();
    }
    
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 应用进展日期过滤
function applyProgressDateFilter() {
    const filterDate = document.getElementById('progressDateFilter').value;
    if (!filterDate) {
        // 如果没有选择日期，重新加载所有数据
        if (currentTeamView === 'list') {
            loadTeamOKR();
        } else if (currentTeamView === 'card') {
            renderTeamCardView();
        }
        return;
    }
    
    // 重新渲染当前视图
    if (currentTeamView === 'list') {
        loadTeamOKR();
    } else if (currentTeamView === 'card') {
        renderTeamCardView();
    }
}

// 更新日期显示
function updateDateDisplay(input) {
    const display = document.getElementById('dateDisplayText');
    if (!display) return;
    
    if (input.value) {
        display.textContent = input.value;
        display.classList.add('text-gray-900');
        display.classList.remove('text-gray-500');
    } else {
        display.textContent = '选择日期';
        display.classList.add('text-gray-500');
        display.classList.remove('text-gray-900');
    }
}

// 清除进展日期过滤
function clearProgressDateFilter() {
    const input = document.getElementById('progressDateFilter');
    input.value = '';
    updateDateDisplay(input);
    applyProgressDateFilter();
}

// 检查进展是否在日期范围内
function isProgressInDateRange(progressDate) {
    const filterDate = document.getElementById('progressDateFilter').value;
    if (!filterDate) return true;
    
    if (!progressDate) return false;
    
    const filterTimestamp = new Date(filterDate).getTime();
    const progressTimestamp = new Date(progressDate).getTime();
    
    return progressTimestamp >= filterTimestamp;
}

async function updateTeamKR(element, krId, title) {
    const trimmedTitle = title.trim();
    
    // 获取原始值
    const originalTitle = element.dataset.original || '';
    
    // 如果内容没有变化，直接返回，不提交
    if (trimmedTitle === originalTitle) {
        return;
    }
    
    if (!trimmedTitle) {
        showToast('Key Result内容不能为空', 'error');
        element.textContent = originalTitle;
        return;
    }
    
    try {
        const response = await fetch(`/api/team/key-results/${krId}?user_eng_name=${currentUser.EngName}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: trimmedTitle })
        });
        
        if (response.ok) {
            showToast('更新成功', 'success');
            // 更新原始值
            element.dataset.original = trimmedTitle;
        } else {
            throw new Error('更新失败');
        }
    } catch (error) {
        console.error('更新KR失败:', error);
        showToast('更新失败', 'error');
        element.textContent = originalTitle;
    }
}

// 跳转到成员视图并筛选指定成员
function jumpToMemberView(userEngName) {
    // 切换到成员视图
    switchTeamView('card');
    
    // 设置筛选器的值
    const filter = document.getElementById('teamMemberFilter');
    if (filter) {
        filter.value = userEngName;
        // 触发筛选
        renderTeamCardView();
    }
    
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 应用进展日期过滤
function applyProgressDateFilter() {
    const filterDate = document.getElementById('progressDateFilter').value;
    if (!filterDate) {
        // 如果没有选择日期，重新加载所有数据
        if (currentTeamView === 'list') {
            loadTeamOKR();
        } else if (currentTeamView === 'card') {
            renderTeamCardView();
        }
        return;
    }
    
    // 重新渲染当前视图
    if (currentTeamView === 'list') {
        loadTeamOKR();
    } else if (currentTeamView === 'card') {
        renderTeamCardView();
    }
}

// 更新日期显示
function updateDateDisplay(input) {
    const display = document.getElementById('dateDisplayText');
    if (!display) return;
    
    if (input.value) {
        display.textContent = input.value;
        display.classList.add('text-gray-900');
        display.classList.remove('text-gray-500');
    } else {
        display.textContent = '选择日期';
        display.classList.add('text-gray-500');
        display.classList.remove('text-gray-900');
    }
}

// 清除进展日期过滤
function clearProgressDateFilter() {
    const input = document.getElementById('progressDateFilter');
    input.value = '';
    updateDateDisplay(input);
    applyProgressDateFilter();
}

// 检查进展是否在日期范围内
function isProgressInDateRange(progressDate) {
    const filterDate = document.getElementById('progressDateFilter').value;
    if (!filterDate) return true;
    
    if (!progressDate) return false;
    
    const filterTimestamp = new Date(filterDate).getTime();
    const progressTimestamp = new Date(progressDate).getTime();
    
    return progressTimestamp >= filterTimestamp;
}

// 初始化Objective拖拽排序
function initObjectiveSortable() {
    const container = document.getElementById('teamOkrList');
    if (!container) return;
    
    Sortable.create(container, {
        animation: 150,
        handle: '.drag-handle',
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag',
        onEnd: async function(evt) {
            // 立即更新编号
            updateObjectiveNumbers();
            
            const items = container.querySelectorAll('.objective-item');
            const objectiveIds = Array.from(items).map(item => parseInt(item.dataset.id));
            
            console.log('保存Objective排序:', objectiveIds);
            
            try {
                const response = await fetch(`/api/team/objectives/sort?user_eng_name=${currentUser.EngName}`, {
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
                    let errorMessage = '排序保存失败';
                    try {
                        const errorData = JSON.parse(errorText);
                        errorMessage = errorData.detail || errorData.message || errorMessage;
                    } catch (e) {
                        if (errorText) errorMessage = `HTTP ${response.status}: ${errorText}`;
                    }
                    throw new Error(errorMessage);
                }
            } catch (error) {
                console.error('保存排序失败:', error);
                const errorMsg = error.message || error.toString() || '未知错误';
                showToast(`排序保存失败: ${errorMsg}`, 'error');
                await loadTeamOKR();
            }
        }
    });
}

function updateObjectiveNumbers() {
    const container = document.getElementById('teamOkrList');
    if (!container) return;
    
    const objectives = container.querySelectorAll('.objective-item');
    objectives.forEach((obj, index) => {
        const numberSpan = obj.querySelector('h3 > span:first-child');
        if (numberSpan) {
            numberSpan.textContent = `O${index + 1}`;
        }
    });
}

function initKRSortable() {
    const krLists = document.querySelectorAll('.kr-list');
    
    krLists.forEach(list => {
        Sortable.create(list, {
            animation: 150,
            handle: '.drag-handle',
            ghostClass: 'sortable-ghost',
            dragClass: 'sortable-drag',
            onEnd: async function(evt) {
                updateKRNumbers(list);
                
                const items = list.querySelectorAll('.kr-item');
                const krIds = Array.from(items).map(item => parseInt(item.dataset.id));
                
                console.log('保存KR排序:', krIds);
                
                try {
                    const response = await fetch(`/api/team/key-results/sort?user_eng_name=${currentUser.EngName}`, {
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
                        let errorMessage = '排序保存失败';
                        try {
                            const errorData = JSON.parse(errorText);
                            errorMessage = errorData.detail || errorData.message || errorMessage;
                        } catch (e) {
                            if (errorText) errorMessage = `HTTP ${response.status}: ${errorText}`;
                        }
                        throw new Error(errorMessage);
                    }
                } catch (error) {
                    console.error('保存排序失败:', error);
                    showToast('排序保存失败', 'error');
                    await loadTeamOKR();
                }
            }
        });
    });
}

function updateKRNumbers(krList) {
    const krItems = krList.querySelectorAll('.kr-item');
    krItems.forEach((kr, index) => {
        const numberSpan = kr.querySelector('h4 > span:first-child');
        if (numberSpan) {
            numberSpan.textContent = `KR${index + 1}`;
        }
    });
}

// 切换整体进展展开/收起
function toggleOverallProgress(container) {
    const contentDiv = container.querySelector('.progress-content');
    const expandHint = container.querySelector('.expand-hint');
    
    if (!contentDiv) return;
    
    // 检查是否已展开
    const isExpanded = contentDiv.style.maxHeight === 'none' || contentDiv.style.maxHeight === '';
    
    if (isExpanded) {
        // 收起
        contentDiv.style.maxHeight = '5rem';
        contentDiv.style.overflow = 'hidden';
        contentDiv.style.position = 'relative';
        
        // 显示省略号
        const overlay = container.querySelector('.ellipsis-overlay');
        if (overlay) {
            overlay.classList.remove('hidden');
        }
        
        // 更新提示文字
        if (expandHint) {
            expandHint.innerHTML = '<i class="fas fa-chevron-down mr-1"></i>展开';
        }
    } else {
        // 展开
        contentDiv.style.maxHeight = 'none';
        contentDiv.style.overflow = 'visible';
        
        // 隐藏省略号
        const overlay = container.querySelector('.ellipsis-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
        
        // 更新提示文字
        if (expandHint) {
            expandHint.innerHTML = '<i class="fas fa-chevron-up mr-1"></i>收起';
        }
    }
}

// 跳转到成员视图并筛选指定成员
function jumpToMemberView(userEngName) {
    // 切换到成员视图
    switchTeamView('card');
    
    // 设置筛选器的值
    const filter = document.getElementById('teamMemberFilter');
    if (filter) {
        filter.value = userEngName;
        // 触发筛选
        renderTeamCardView();
    }
    
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 应用进展日期过滤
function applyProgressDateFilter() {
    const filterDate = document.getElementById('progressDateFilter').value;
    if (!filterDate) {
        // 如果没有选择日期，重新加载所有数据
        if (currentTeamView === 'list') {
            loadTeamOKR();
        } else if (currentTeamView === 'card') {
            renderTeamCardView();
        }
        return;
    }
    
    // 重新渲染当前视图
    if (currentTeamView === 'list') {
        loadTeamOKR();
    } else if (currentTeamView === 'card') {
        renderTeamCardView();
    }
}

// 更新日期显示
function updateDateDisplay(input) {
    const display = document.getElementById('dateDisplayText');
    if (!display) return;
    
    if (input.value) {
        display.textContent = input.value;
        display.classList.add('text-gray-900');
        display.classList.remove('text-gray-500');
    } else {
        display.textContent = '选择日期';
        display.classList.add('text-gray-500');
        display.classList.remove('text-gray-900');
    }
}

// 清除进展日期过滤
function clearProgressDateFilter() {
    const input = document.getElementById('progressDateFilter');
    input.value = '';
    updateDateDisplay(input);
    applyProgressDateFilter();
}

// 检查进展是否在日期范围内
function isProgressInDateRange(progressDate) {
    const filterDate = document.getElementById('progressDateFilter').value;
    if (!filterDate) return true;
    
    if (!progressDate) return false;
    
    const filterTimestamp = new Date(filterDate).getTime();
    const progressTimestamp = new Date(progressDate).getTime();
    
    return progressTimestamp >= filterTimestamp;
}