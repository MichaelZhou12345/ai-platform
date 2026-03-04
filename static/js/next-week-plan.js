// ==================== 下周计划相关 ====================

let nextWeekPlanData = []; // 存储所有成员的下周计划数据
let currentNextWeekView = 'grid'; // 当前视图模式：grid 或 mindmap
let nextWeekMindMapChart = null; // ECharts实例
let nextWeekMindMapZoomLevel = 1; // 脑图缩放级别
let nextWeekMindMapKeyboardEnabled = false; // 键盘移动状态
let nextWeekMindMapCenter = [0, 0]; // 脑图中心位置

// 视图切换函数
function switchNextWeekView(view) {
    currentNextWeekView = view;
    
    // 更新按钮样式
    const gridBtn = document.getElementById('next-week-view-btn-grid');
    const mindmapBtn = document.getElementById('next-week-view-btn-mindmap');
    const gridContainer = document.getElementById('nextWeekPlanGrid');
    const mindmapContainer = document.getElementById('nextWeekMindMapView');
    
    // 检查元素是否存在
    if (!gridBtn || !mindmapBtn || !gridContainer || !mindmapContainer) {
        console.warn('下周计划视图切换：部分DOM元素未找到');
        return;
    }
    
    if (view === 'grid') {
        gridBtn.classList.add('bg-white', 'shadow-sm', 'text-gray-900');
        gridBtn.classList.remove('text-gray-500');
        mindmapBtn.classList.remove('bg-white', 'shadow-sm', 'text-gray-900');
        mindmapBtn.classList.add('text-gray-500');
        
        gridContainer.classList.remove('hidden');
        mindmapContainer.classList.add('hidden');
        
        // 禁用键盘移动
        disableNextWeekKeyboardMove();
    } else if (view === 'mindmap') {
        mindmapBtn.classList.add('bg-white', 'shadow-sm', 'text-gray-900');
        mindmapBtn.classList.remove('text-gray-500');
        gridBtn.classList.remove('bg-white', 'shadow-sm', 'text-gray-900');
        gridBtn.classList.add('text-gray-500');
        
        gridContainer.classList.add('hidden');
        mindmapContainer.classList.remove('hidden');
        
        // 延迟渲染脑图，确保容器已显示
        setTimeout(() => renderNextWeekMindMap(), 100);
        
        // 启用键盘移动
        enableNextWeekKeyboardMove();
    }
}

// 脑图缩放控制
function zoomNextWeekMindMap(delta) {
    nextWeekMindMapZoomLevel = Math.max(0.5, Math.min(2, nextWeekMindMapZoomLevel + delta));
    document.getElementById('nextWeekZoomLevelDisplay').textContent = Math.round(nextWeekMindMapZoomLevel * 100) + '%';
    if (nextWeekMindMapChart) {
        nextWeekMindMapChart.setOption({
            series: [{
                zoom: nextWeekMindMapZoomLevel
            }]
        });
    }
}

function resetNextWeekMindMapZoom() {
    nextWeekMindMapZoomLevel = 1;
    document.getElementById('nextWeekZoomLevelDisplay').textContent = '100%';
    if (nextWeekMindMapChart) {
        nextWeekMindMapChart.setOption({
            series: [{
                zoom: 1,
                center: [0, 0]
            }]
        });
    }
}

async function loadNextWeekPlan() {
    const container = document.getElementById('nextWeekPlanGrid');
    const filter = document.getElementById('nextWeekMemberFilter');
    
    // 显示骨架屏
    showSkeleton('nextWeekPlanGrid', 'next-week');
    
    try {
        // 复用团队进展摘要API
        const response = await fetch('/api/progress/team-summary');
        if (!response.ok) throw new Error('加载数据失败');
        const data = await response.json();
        
        if (!data.summary || data.summary.length === 0) {
            container.innerHTML = '<div class="col-span-full text-center text-gray-500 py-12">暂无数据</div>';
            return;
        }
        
        // 缓存数据
        nextWeekPlanData = data.summary;
        
        // 提取所有用户用于筛选器
        const users = new Map();
        nextWeekPlanData.forEach(item => {
            if (item.user_eng_name && !users.has(item.user_eng_name)) {
                users.set(item.user_eng_name, item.user_chn_name);
            }
        });
        
        // 填充筛选器
        if (filter.options.length <= 1) { // 只有默认选项时才填充
            const currentValue = filter.value;
            filter.innerHTML = '<option value="">全部成员</option>';
            
            const sortedUsers = Array.from(users.entries()).sort((a, b) => a[0].localeCompare(b[0]));
            sortedUsers.forEach(([engName, chnName]) => {
                const option = document.createElement('option');
                option.value = engName;
                option.textContent = `${engName}(${chnName})`;
                filter.appendChild(option);
            });
            
            filter.value = currentValue;
        }
        
        renderNextWeekPlan();
        
    } catch (error) {
        console.error('加载下周计划失败:', error);
        container.innerHTML = `<div class="col-span-full text-center text-red-500 py-12">加载失败: ${error.message}</div>`;
    }
}

function renderNextWeekPlan() {
    const container = document.getElementById('nextWeekPlanGrid');
    const filter = document.getElementById('nextWeekMemberFilter');
    const selectedUser = filter.value;
    
    // 过滤数据
    let filteredItems = nextWeekPlanData;
    if (selectedUser) {
        filteredItems = filteredItems.filter(item => item.user_eng_name === selectedUser);
    }
    
    if (filteredItems.length === 0) {
        container.innerHTML = '<div class="col-span-full text-center text-gray-500 py-12">该成员暂无数据</div>';
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
    
    // 按成员英文名排序
    const sortedGroups = Array.from(groupedByUser.values()).sort((a, b) => 
        a.user_eng_name.localeCompare(b.user_eng_name)
    );
    
    // 渲染
    container.innerHTML = sortedGroups.map(group => {
        const pieChartId = `next-week-pie-${group.user_eng_name.replace(/\s+/g, '-')}`;
        
        return `
        <div class="bg-white rounded-lg shadow-sm border p-6 flex flex-col items-center hover:shadow-md transition-shadow">
            <div class="flex flex-col items-center mb-4">
                <img src="https://r.hrc.woa.com/photo/150/${group.user_eng_name}.png?default_when_absent=true" 
                     alt="${group.user_chn_name}" 
                     class="w-16 h-16 rounded-full mb-2">
                <h3 class="font-bold text-gray-900 text-lg">${escapeHtml(group.user_eng_name)}</h3>
                <p class="text-sm text-gray-500">${escapeHtml(group.user_chn_name)}</p>
            </div>
            
            <!-- 饼图容器 -->
            <div id="${pieChartId}" class="w-48 h-48 mb-4"></div>
            
            <div class="w-full text-sm text-gray-600 border-t pt-4 mt-auto">
                <div class="flex justify-between mb-1">
                    <span>关联OKR数:</span>
                    <span class="font-medium">${group.items.length}</span>
                </div>
                <div class="flex justify-between">
                    <span>预计总人天:</span>
                    <span class="font-medium text-purple-600" id="${pieChartId}-total">计算中...</span>
                </div>
            </div>
        </div>
        `;
    }).join('');
    
    // 渲染饼图
    sortedGroups.forEach(group => {
        const workAllocation = calculateNextWeekAllocation(group.items);
        const pieChartId = `next-week-pie-${group.user_eng_name.replace(/\s+/g, '-')}`;
        
        // 更新总人天显示
        const totalEl = document.getElementById(`${pieChartId}-total`);
        if (totalEl) {
            totalEl.textContent = `${workAllocation.total} 天`;
        }
        
        setTimeout(() => renderNextWeekPieChart(pieChartId, workAllocation), 100);
    });
}

// 计算工作分配数据 (复用逻辑，稍作调整)
function calculateNextWeekAllocation(items) {
    const allocation = new Map();
    let totalDays = 0;
    
    items.forEach(item => {
        if (item.next_week_content && item.estimated_man_days) {
            const days = parseFloat(item.estimated_man_days) || 0;
            if (days > 0) {
                const krTitle = item.kr_title || '未知';
                const existingData = allocation.get(krTitle) || { days: 0, nextWeekContents: [] };
                
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

// 渲染饼图
function renderNextWeekPieChart(containerId, workAllocation) {
    const container = document.getElementById(containerId);
    if (!container || workAllocation.data.length === 0) {
        if (container) {
            container.innerHTML = '<div class="flex items-center justify-center h-full text-gray-400 text-xs">暂无下周计划数据</div>';
        }
        return;
    }
    
    const chart = echarts.init(container);
    
    const colors = [
        '#0052D9', '#00A870', '#E37318', '#E34D59', '#834EC2',
        '#00B4E5', '#FF9F43', '#5F27CD', '#FF6B6B', '#1DD1A1'
    ];
    
    const option = {
        tooltip: {
            trigger: 'item',
            formatter: function(params) {
                return `${params.name}<br/>${params.value} 天 (${params.percent}%)`;
            }
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
                        formatter: '{c}天'
                    }
                },
                data: workAllocation.data.map((item, index) => ({
                    name: item.name,
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
    
    // 点击事件
    chart.on('click', function(params) {
        const data = params.data;
        if (data && data.nextWeekContents && data.nextWeekContents.length > 0) {
            // 这里需要确保 showNextWeekPlanModal 函数是可用的，或者重新实现一个
            if (typeof showNextWeekPlanModal === 'function') {
                showNextWeekPlanModal(data);
            } else {
                // 如果 team-okr.js 中的函数不可用，这里简单实现一个 alert 或者 modal
                alert(`KR: ${data.krTitle}\n预计人天: ${data.value}`);
            }
        }
    });
    
    window.addEventListener('resize', () => {
        chart.resize();
    });
}

// 监听筛选器变化
document.addEventListener('DOMContentLoaded', () => {
    const filter = document.getElementById('nextWeekMemberFilter');
    if (filter) {
        filter.addEventListener('change', () => {
            if (currentNextWeekView === 'grid') {
                renderNextWeekPlan();
            } else if (currentNextWeekView === 'mindmap') {
                renderNextWeekMindMap();
            }
        });
    }
});

// 渲染下周计划脑图
function renderNextWeekMindMap() {
    const container = document.getElementById('nextWeekMindMapChart');
    if (!container) return;
    
    const filter = document.getElementById('nextWeekMemberFilter');
    const selectedUser = filter ? filter.value : '';
    
    // 过滤数据
    let filteredItems = nextWeekPlanData;
    if (selectedUser) {
        filteredItems = filteredItems.filter(item => item.user_eng_name === selectedUser);
    }
    
    if (filteredItems.length === 0) {
        container.innerHTML = '<div class="flex items-center justify-center h-full text-gray-400">暂无数据</div>';
        return;
    }
    
    // 按成员分组
    const groupedByUser = new Map();
    filteredItems.forEach(item => {
        if (!groupedByUser.has(item.user_eng_name)) {
            groupedByUser.set(item.user_eng_name, {
                user_eng_name: item.user_eng_name,
                user_chn_name: item.user_chn_name,
                okrs: new Map()
            });
        }
        
        const userGroup = groupedByUser.get(item.user_eng_name);
        const okrKey = `${item.obj_title || '未知目标'} - ${item.kr_title || '未知KR'}`;
        
        if (!userGroup.okrs.has(okrKey)) {
            userGroup.okrs.set(okrKey, {
                obj_title: item.obj_title || '未知目标',
                kr_title: item.kr_title || '未知KR',
                plans: []
            });
        }
        
        if (item.next_week_content || item.estimated_man_days) {
            userGroup.okrs.get(okrKey).plans.push({
                content: item.next_week_content || '无计划',
                man_days: item.estimated_man_days || 0
            });
        }
    });
    
    // 构建脑图数据结构
    const rootNode = {
        name: '下周计划',
        value: '总览',
        itemStyle: {
            color: '#8A2BE2',
            borderColor: '#7B27A5',
            borderWidth: 2
        },
        label: {
            fontSize: 18,
            fontWeight: 'bold',
            color: '#000'
        },
        children: []
    };
    
    // 按成员英文名排序
    const sortedUsers = Array.from(groupedByUser.entries()).sort((a, b) => 
        a[0].localeCompare(b[0])
    );
    
    sortedUsers.forEach(([engName, userData]) => {
        const memberNode = {
            name: `${engName}\n(${userData.user_chn_name})`,
            value: engName,
            itemStyle: {
                color: '#0052D9',
                borderColor: '#0043B3',
                borderWidth: 2
            },
            label: {
                fontSize: 14,
                fontWeight: 'bold',
                color: '#000'
            },
            children: []
        };
        
        // 添加OKR节点
        userData.okrs.forEach((okrData, okrKey) => {
            const okrNode = {
                name: okrData.kr_title.length > 20 ? okrData.kr_title.substring(0, 20) + '...' : okrData.kr_title,
                value: okrData.kr_title,
                itemStyle: {
                    color: '#00A870',
                    borderColor: '#008A5C',
                    borderWidth: 1
                },
                label: {
                    fontSize: 12,
                    color: '#000'
                },
                children: []
            };
            
            // 为每个OKR添加两个叶子节点
            okrData.plans.forEach((plan, index) => {
                // 第一个叶子：下周计划
                const planNode = {
                    name: plan.content.length > 30 ? plan.content.substring(0, 30) + '...' : plan.content,
                    value: plan.content,
                    itemStyle: {
                        color: '#4A90E2',
                        borderColor: '#357ABD',
                        borderWidth: 1
                    },
                    label: {
                        fontSize: 10,
                        color: '#000'
                    }
                };
                
                // 第二个叶子：占用人日
                const manDaysNode = {
                    name: `${plan.man_days} 人日`,
                    value: plan.man_days,
                    itemStyle: {
                        color: '#E37318',
                        borderColor: '#C55E0F',
                        borderWidth: 1
                    },
                    label: {
                        fontSize: 10,
                        color: '#000'
                    }
                };
                
                okrNode.children.push(planNode, manDaysNode);
            });
            
            memberNode.children.push(okrNode);
        });
        
        rootNode.children.push(memberNode);
    });
    
    // 初始化或更新ECharts
    if (!nextWeekMindMapChart) {
        nextWeekMindMapChart = echarts.init(container);
    }
    
    const option = {
        tooltip: {
            trigger: 'item',
            triggerOn: 'mousemove',
            formatter: function(params) {
                if (params.data.value) {
                    return `<strong>${params.name}</strong><br/>${params.data.value}`;
                }
                return params.name;
            }
        },
        series: [
            {
                type: 'tree',
                data: [rootNode],
                top: '5%',
                left: '10%',
                bottom: '5%',
                right: '20%',
                symbolSize: 10,
                orient: 'LR',
                expandAndCollapse: true,
                initialTreeDepth: -1,
                animationDuration: 550,
                animationDurationUpdate: 750,
                zoom: nextWeekMindMapZoomLevel,
                roam: true,
                layout: 'orthogonal',
                nodePadding: 30,
                layerPadding: 80,
                label: {
                    position: 'inside',
                    verticalAlign: 'middle',
                    align: 'center',
                    fontSize: 12,
                    color: '#000',
                    padding: [8, 12]
                },
                leaves: {
                    label: {
                        position: 'right',
                        verticalAlign: 'middle',
                        align: 'left',
                        color: '#000',
                        padding: [8, 12]
                    }
                },
                itemStyle: {
                    borderWidth: 1
                },
                lineStyle: {
                    color: '#ccc',
                    width: 1.5,
                    curveness: 0.5
                }
            }
        ]
    };
    
    nextWeekMindMapChart.setOption(option);
    
    // 添加节点点击事件
    nextWeekMindMapChart.on('click', function(params) {
        // 只处理叶子节点（下周计划节点）
        if (params.data && params.data.value && typeof params.data.value === 'string' && 
            params.data.itemStyle && params.data.itemStyle.color === '#4A90E2') {
            // 这是下周计划叶子节点
            showNextWeekPlanDetailModal(params.data.value);
        }
    });
    
    // 监听窗口大小变化
    window.addEventListener('resize', () => {
        if (nextWeekMindMapChart) {
            nextWeekMindMapChart.resize();
        }
    });
}

// 启用键盘方向键移动
function enableNextWeekKeyboardMove() {
    if (nextWeekMindMapKeyboardEnabled) return;
    nextWeekMindMapKeyboardEnabled = true;
    document.addEventListener('keydown', handleNextWeekKeyboardMove);
}

// 禁用键盘方向键移动
function disableNextWeekKeyboardMove() {
    if (!nextWeekMindMapKeyboardEnabled) return;
    nextWeekMindMapKeyboardEnabled = false;
    document.removeEventListener('keydown', handleNextWeekKeyboardMove);
}

// 处理键盘移动事件
function handleNextWeekKeyboardMove(event) {
    if (!nextWeekMindMapKeyboardEnabled || !nextWeekMindMapChart) return;
    
    // 检查是否在输入框中
    const activeElement = document.activeElement;
    if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        return;
    }
    
    const moveStep = 50; // 移动步长
    let moved = false;
    
    switch(event.key) {
        case 'ArrowUp':
            nextWeekMindMapCenter[1] += moveStep;
            moved = true;
            break;
        case 'ArrowDown':
            nextWeekMindMapCenter[1] -= moveStep;
            moved = true;
            break;
        case 'ArrowLeft':
            nextWeekMindMapCenter[0] += moveStep;
            moved = true;
            break;
        case 'ArrowRight':
            nextWeekMindMapCenter[0] -= moveStep;
            moved = true;
            break;
    }
    
    if (moved) {
        event.preventDefault();
        nextWeekMindMapChart.setOption({
            series: [{
                center: nextWeekMindMapCenter
            }]
        });
    }
}

// 显示下周计划详情弹窗
function showNextWeekPlanDetailModal(planContent) {
    // 复用现有的弹窗模态框
    const modal = document.getElementById('nextWeekPlanModal');
    if (!modal) {
        console.warn('下周计划弹窗未找到');
        return;
    }
    
    const modalTitle = document.getElementById('nextWeekPlanModalTitle');
    const modalContent = document.getElementById('nextWeekPlanModalContent');
    
    if (modalTitle) {
        modalTitle.textContent = '下周计划详情';
    }
    
    if (modalContent) {
        // 使用marked渲染Markdown内容
        modalContent.innerHTML = `<div class="markdown-content">${marked.parse(planContent)}</div>`;
    }
    
    // 显示弹窗
    modal.classList.add('active');
}