// ==================== Tab切换功能 ====================

// Tab路由映射
const TAB_ROUTES = {
    'team': '/team',
    'personal': '/personal',
    'reports': '/reports',
    'todos': '/todos',
    'next-week': '/next-week',
    'ideas': '/ideas',
    'platforms': '/platforms',
    'continuous-improvement': '/continuous-improvement'
};

// Tab切换 - 使用History API实现无刷新路由切换
function switchTab(tab) {
    const route = TAB_ROUTES[tab];
    if (route) {
        // 使用pushState更新URL而不刷新页面
        window.history.pushState({ tab: tab }, '', route);
        
        // 立即切换tab内容和样式
        updateTabUI(tab);
    }
}

// 根据tab更新UI和数据
function updateTabUI(tab) {
    // 更新当前tab
    currentTab = tab;
    
    // 更新桌面端tab样式
    document.querySelectorAll('[id^="tab-"]').forEach(btn => {
        btn.classList.remove('tab-active');
        btn.classList.add('text-gray-500');
    });
    const activeTab = document.getElementById(`tab-${tab}`);
    if (activeTab) {
        activeTab.classList.add('tab-active');
        activeTab.classList.remove('text-gray-500');
    }
    
    // 更新移动端快捷tab样式
    updateMobileTabStyle(tab);
    
    // 显示对应内容
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    const contentElement = document.getElementById(`content-${tab}`);
    if (contentElement) {
        contentElement.classList.remove('hidden');
    }
    
    // 加载对应数据
    loadTabData(tab);
}

// 加载tab对应的数据
function loadTabData(tab) {
    if (tab === 'team') {
        loadTeamOKR();
    } else if (tab === 'personal') {
        loadPersonalOKR();
    } else if (tab === 'reports') {
        loadTeamReports();
    } else if (tab === 'todos') {
        loadTodos();
    } else if (tab === 'next-week') {
        loadNextWeekPlan();
    } else if (tab === 'ideas') {
        if (typeof loadIdeas === 'function') {
            loadIdeas();
        }
    } else if (tab === 'platforms') {
        loadPlatforms();
    } else if (tab === 'continuous-improvement') {
        // 检测子Tab元素是否存在（防止旧版HTML缓存导致缺失）
        if (!document.getElementById('ci-tab-game')) {
            // 旧版HTML没有游戏动态子Tab，强制刷新获取最新HTML
            window.location.reload();
            return;
        }
        // 恢复上次的子Tab状态（默认AI动态）
        switchCITab(currentCITab || 'ai');
    }
}

// 异步加载不断更新iframe
function loadContinuousImprovementIframe() {
    const iframe = document.getElementById('continuousImprovementIframe');
    const loading = document.getElementById('continuousImprovementLoading');
    
    // 如果已经加载过，直接显示
    if (iframe.src) {
        return;
    }
    
    // 获取data-src中的URL
    const src = iframe.getAttribute('data-src');
    if (!src) {
        console.error('未找到iframe的data-src属性');
        if (loading) {
            loading.innerHTML = '<div class="text-center text-red-600"><i class="fas fa-exclamation-triangle mb-2"></i><p>加载失败</p></div>';
        }
        return;
    }
    
    // 设置iframe的src开始加载
    iframe.src = src;
    
    // 监听iframe加载完成
    iframe.onload = function() {
        // 隐藏加载状态
        if (loading) {
            loading.classList.add('hidden');
        }
        // 显示iframe
        iframe.classList.remove('hidden');
    };
    
    // 监听iframe加载错误
    iframe.onerror = function() {
        console.error('iframe加载失败');
        if (loading) {
            loading.innerHTML = '<div class="text-center text-red-600"><i class="fas fa-exclamation-triangle text-3xl mb-2"></i><p>内容加载失败，请刷新重试</p></div>';
        }
    };
}

// 更新移动端快捷Tab按钮的样式
function updateMobileTabStyle(tab) {
    // 更新所有移动端快捷tab按钮的样式
    document.querySelectorAll('.mobile-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 激活当前tab对应的快捷按钮（如果存在）
    const mobileTabBtn = document.getElementById(`mobile-tab-${tab}`);
    if (mobileTabBtn) {
        mobileTabBtn.classList.add('active');
    }
}

// 根据当前路径初始化tab状态
function initTabFromRoute() {
    const path = window.location.pathname;
    let currentTab = 'team'; // 默认tab
    
    // 根据路径确定当前tab
    for (const [tab, route] of Object.entries(TAB_ROUTES)) {
        if (path === route || path === route + '/') {
            currentTab = tab;
            break;
        }
    }
    
    // 如果是根路径，默认为team
    if (path === '/' || path === '/static/index.html') {
        currentTab = 'team';
        // 如果是根路径，也更新URL为/team
        if (path === '/') {
            window.history.replaceState({ tab: 'team' }, '', '/team');
        }
    }
    
    // 更新UI
    updateTabUI(currentTab);
    
    return currentTab;
}

// 监听浏览器前进/后退事件
window.addEventListener('popstate', (event) => {
    const path = window.location.pathname;
    let currentTab = 'team';
    
    for (const [tab, route] of Object.entries(TAB_ROUTES)) {
        if (path === route || path === route + '/') {
            currentTab = tab;
            break;
        }
    }
    
    updateTabUI(currentTab);
});

// 拦截导航栏链接点击事件，使用pushState代替默认跳转
document.addEventListener('DOMContentLoaded', () => {
    // 拦截所有tab导航链接
    document.querySelectorAll('[id^="tab-"], .mobile-tab-btn').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // 从href中提取tab名称
            const href = link.getAttribute('href');
            const tab = Object.keys(TAB_ROUTES).find(key => TAB_ROUTES[key] === href);
            
            if (tab) {
                switchTab(tab);
            }
        });
    });
    
    // 拦截移动端菜单中的链接
    document.querySelectorAll('#mobileMenu a[href]').forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            const tab = Object.keys(TAB_ROUTES).find(key => TAB_ROUTES[key] === href);
            
            if (tab) {
                e.preventDefault();
                switchTab(tab);
                // 关闭移动端菜单
                const mobileMenu = document.getElementById('mobileMenu');
                if (mobileMenu) {
                    mobileMenu.classList.add('hidden');
                }
            }
        });
    });
});

// ==================== 不断更新 - 子Tab切换 ====================
let currentCITab = 'ai';

function switchCITab(tab) {
    currentCITab = tab;

    // 更新子Tab按钮样式
    document.querySelectorAll('[id^="ci-tab-"]').forEach(btn => {
        btn.classList.remove('bg-white', 'text-purple-700', 'shadow-sm');
        btn.classList.add('text-gray-600');
    });
    const activeBtn = document.getElementById(`ci-tab-${tab}`);
    if (activeBtn) {
        activeBtn.classList.add('bg-white', 'text-purple-700', 'shadow-sm');
        activeBtn.classList.remove('text-gray-600');
    }

    // 切换面板显示
    document.querySelectorAll('[id^="ci-panel-"]').forEach(panel => {
        panel.classList.add('hidden');
    });
    const activePanel = document.getElementById(`ci-panel-${tab}`);
    if (activePanel) {
        activePanel.classList.remove('hidden');
    }

    // 懒加载对应iframe
    if (tab === 'ai') {
        loadContinuousImprovementIframe();
    } else if (tab === 'game') {
        loadGameNews(false);
    }
}

// 绑定子Tab点击事件（避免inline onclick在sandbox中被拦截）
document.addEventListener('DOMContentLoaded', function() {
    const aiTabBtn = document.getElementById('ci-tab-ai');
    const gameTabBtn = document.getElementById('ci-tab-game');
    if (aiTabBtn) aiTabBtn.addEventListener('click', function() { switchCITab('ai'); });
    if (gameTabBtn) gameTabBtn.addEventListener('click', function() { switchCITab('game'); });

    // 游戏新闻刷新按钮
    const refreshBtn = document.getElementById('gameNewsRefreshBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', function() { loadGameNews(true); });

    // 游戏新闻搜索
    const searchInput = document.getElementById('gameNewsSearch');
    if (searchInput) {
        searchInput.addEventListener('input', function() { filterGameNews(this.value); });
    }
});

// ==================== 游戏新闻 ====================
let _gameNewsData = [];
let _gameNewsLoaded = false;

function loadGameNews(forceRefresh) {
    if (_gameNewsLoaded && !forceRefresh) return;

    const loading = document.getElementById('gameNewsLoading');
    const list = document.getElementById('gameNewsList');
    const empty = document.getElementById('gameNewsEmpty');

    if (loading) loading.classList.remove('hidden');
    if (list) list.innerHTML = '';
    if (empty) empty.classList.add('hidden');

    fetch('/api/game-news')
        .then(r => r.json())
        .then(data => {
            if (loading) loading.classList.add('hidden');
            if (data.status === 'success' && data.data && data.data.length > 0) {
                _gameNewsData = data.data;
                _gameNewsLoaded = true;
                renderGameNews(_gameNewsData);
                const timeEl = document.getElementById('gameNewsTime');
                if (timeEl) {
                    const now = new Date();
                    timeEl.textContent = '最后更新: ' + now.getFullYear() + '/' + 
                        String(now.getMonth()+1).padStart(2,'0') + '/' + 
                        String(now.getDate()).padStart(2,'0') + ' ' +
                        String(now.getHours()).padStart(2,'0') + ':' + 
                        String(now.getMinutes()).padStart(2,'0');
                }
            } else {
                if (empty) empty.classList.remove('hidden');
            }
        })
        .catch(err => {
            if (loading) loading.classList.add('hidden');
            if (list) list.innerHTML = '<div class="text-center text-red-500 py-10"><i class="fas fa-exclamation-triangle text-2xl mb-2"></i><p>获取新闻失败，请稍后重试</p></div>';
        });
}

function renderGameNews(news) {
    const list = document.getElementById('gameNewsList');
    if (!list) return;

    const sourceColors = {
        '游研社': 'bg-blue-100 text-blue-700',
        'IGN': 'bg-red-100 text-red-700',
    };

    list.innerHTML = news.map((item, idx) => {
        const colorClass = sourceColors[item.source] || 'bg-gray-100 text-gray-700';
        const imageHtml = item.image 
            ? `<div class="flex-shrink-0 w-32 h-20 rounded-lg overflow-hidden bg-gray-100">
                 <img src="${item.image}" alt="" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<div class=\\'w-full h-full flex items-center justify-center text-gray-300\\'><i class=\\'fas fa-image text-2xl\\'></i></div>'">
               </div>`
            : '';
        const encodedData = encodeURIComponent(JSON.stringify({title: item.title, summary: item.summary || '', link: item.link, source: item.source}));
        return `
        <div class="block p-4 rounded-xl border border-gray-100 hover:border-orange-200 hover:shadow-md transition-all duration-200 bg-white group">
            <div class="flex gap-4">
                <div class="flex-1 min-w-0">
                    <div class="flex items-start gap-2 mb-2">
                        <a href="${item.link}" target="_blank" rel="noopener noreferrer" class="flex-1 min-w-0 cursor-pointer">
                            <h4 class="font-semibold text-gray-900 group-hover:text-orange-600 transition-colors line-clamp-2">${item.title}</h4>
                        </a>
                        <button data-news='${encodedData}' 
                                class="game-news-summary-btn flex-shrink-0 px-2.5 py-1 text-xs font-medium border border-orange-300 text-orange-600 rounded-md hover:bg-orange-50 hover:border-orange-400 transition-all duration-200 whitespace-nowrap">
                            总结
                        </button>
                    </div>
                    <a href="${item.link}" target="_blank" rel="noopener noreferrer" class="block cursor-pointer">
                        <p class="text-sm text-gray-500 line-clamp-2 mb-3">${item.summary || ''}</p>
                    </a>
                    <div class="flex items-center gap-3 text-xs">
                        <span class="px-2 py-0.5 rounded-full font-medium ${colorClass}">${item.source}</span>
                        ${item.pub_date ? `<span class="text-gray-400"><i class="far fa-clock mr-1"></i>${item.pub_date}</span>` : ''}
                    </div>
                </div>
                ${imageHtml ? `<a href="${item.link}" target="_blank" rel="noopener noreferrer" class="flex-shrink-0">${imageHtml}</a>` : ''}
            </div>
            <div id="game-news-summary-${idx}" class="hidden mt-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-medium text-orange-700"><i class="fas fa-robot mr-1"></i>AI 总结</span>
                    <button class="game-news-summary-close text-gray-400 hover:text-gray-600 text-xs" data-idx="${idx}">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed game-news-summary-content"></div>
            </div>
        </div>`;
    }).join('');

    // 绑定总结按钮事件
    list.querySelectorAll('.game-news-summary-btn').forEach((btn, idx) => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const newsData = JSON.parse(decodeURIComponent(btn.getAttribute('data-news')));
            summarizeGameNews(newsData, idx);
        });
    });

    // 绑定关闭按钮事件
    list.querySelectorAll('.game-news-summary-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const idx = btn.getAttribute('data-idx');
            const panel = document.getElementById(`game-news-summary-${idx}`);
            if (panel) panel.classList.add('hidden');
        });
    });
}

function filterGameNews(keyword) {
    if (!keyword || !keyword.trim()) {
        renderGameNews(_gameNewsData);
        return;
    }
    const kw = keyword.toLowerCase();
    const filtered = _gameNewsData.filter(item => 
        item.title.toLowerCase().includes(kw) || 
        (item.summary && item.summary.toLowerCase().includes(kw)) ||
        item.source.toLowerCase().includes(kw)
    );
    if (filtered.length === 0) {
        const list = document.getElementById('gameNewsList');
        if (list) list.innerHTML = '<div class="text-center text-gray-400 py-10"><i class="fas fa-search text-2xl mb-2"></i><p>未找到相关新闻</p></div>';
    } else {
        renderGameNews(filtered);
    }
}

// ========== 游戏新闻AI总结 ==========
async function summarizeGameNews(newsData, idx) {
    const panel = document.getElementById(`game-news-summary-${idx}`);
    if (!panel) return;

    const contentEl = panel.querySelector('.game-news-summary-content');
    if (!contentEl) return;

    // 显示面板，设置加载状态
    panel.classList.remove('hidden');
    contentEl.innerHTML = '<span class="text-gray-400"><i class="fas fa-spinner fa-spin mr-1"></i>AI 正在分析文章...</span>';

    // 找到对应的总结按钮并禁用
    const btn = panel.parentElement.querySelector('.game-news-summary-btn');
    if (btn) {
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
    }

    try {
        const response = await fetch('/api/game-news/summarize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newsData)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        // 流式读取
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        contentEl.textContent = '';
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = decoder.decode(value, { stream: true });
            contentEl.textContent += text;
        }
    } catch (err) {
        contentEl.innerHTML = `<span class="text-red-500"><i class="fas fa-exclamation-triangle mr-1"></i>总结失败: ${err.message}</span>`;
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }
}