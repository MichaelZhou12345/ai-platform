// ==================== 主入口文件 ====================

// 全局变量：团队Leader
window.LEADER = '';
// 全局变量：站点标题
window.SITE_TITLE = '算法一组 AI 组织平台';
// 全局变量：白名单列表
window.WHITE_LIST = [];
// 全局变量：OKR脑图访问白名单
window.OKR_WHITE_LIST = [];
// 全局变量：是否为受限模式（仅显示脑图）
window.isRestrictedMode = false;

// 获取服务器配置
async function loadServerConfig() {
    try {
        const response = await fetch('/api/config');
        if (response.ok) {
            const config = await response.json();
            window.LEADER = config.LEADER || 'josephpan';
            window.SITE_TITLE = config.SITE_TITLE || '算法一组 AI 组织平台';
            window.WHITE_LIST = config.WHITE_LIST || [];
            window.OKR_WHITE_LIST = config.OKR_WHITE_LIST || [];
            console.log('团队Leader:', window.LEADER);
            console.log('站点标题:', window.SITE_TITLE);
            
            // 更新页面标题
            document.title = window.SITE_TITLE;
            const titleElement = document.querySelector('nav h1');
            if (titleElement) {
                titleElement.textContent = window.SITE_TITLE;
                titleElement.setAttribute('title', window.SITE_TITLE);
            }
        }
    } catch (error) {
        console.error('获取服务器配置失败:', error);
        // 使用默认值
        window.LEADER = 'josephpan';
        window.SITE_TITLE = '算法一组 AI 组织平台';
        window.WHITE_LIST = [];
        window.OKR_WHITE_LIST = [];
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    // 先加载服务器配置
    await loadServerConfig();
    
    await loadUserInfo();
    
    // 应用受限模式
    applyRestrictedMode();
    
    if (!window.isRestrictedMode) {
        // 根据当前路由初始化tab状态和加载数据
        const currentTab = initTabFromRoute();
        
        // 如果是团队OKR页面，初始化团队视图状态
        if (currentTab === 'team') {
            switchTeamView('list');
        }
        
        // 绑定事件
        document.getElementById('objectiveForm').addEventListener('submit', handleObjectiveSubmit);
        document.getElementById('krForm').addEventListener('submit', handleKRSubmit);
        document.getElementById('todoForm').addEventListener('submit', handleTodoSubmit);
        document.getElementById('addObjectiveBtn').addEventListener('click', () => openModal('objectiveModal'));
        document.getElementById('addPersonalObjectiveBtn').addEventListener('click', () => openModal('personalObjectiveModal'));
        document.getElementById('personalObjectiveForm').addEventListener('submit', handlePersonalObjectiveSubmit);
        document.getElementById('personalKRForm').addEventListener('submit', handlePersonalKRSubmit);
        
        // 待办搜索和过滤
        document.getElementById('todoSearch').addEventListener('input', debounce(loadTodos, 300));
        document.getElementById('todoStatusFilter').addEventListener('change', loadTodos);
        document.getElementById('todoSortBy').addEventListener('change', loadTodos);
        
        // 团队成员筛选
        document.getElementById('teamMemberFilter').addEventListener('change', renderTeamCardView);
        
        // 图片上传监听器
        const imageUploadInput = document.getElementById('imageUploadInput');
        if (imageUploadInput) {
            imageUploadInput.addEventListener('change', handleImageUpload);
        }
        
        // 监听窗口大小变化，响应式调整目录状态
        window.addEventListener('resize', debounce(() => {
            if (currentTeamView === 'list') {
                initSidebarState();
            }
        }, 300));
    } else {
        // 受限模式：只加载团队OKR并切换到脑图视图
        await loadTeamOKR();
        switchTeamView('mindmap');
    }
    
    // 添加滚动监听，为置顶导航栏添加阴影效果
    initStickyNavbar();
});

// 应用受限模式（仅显示脑图，隐藏其他所有功能）
function applyRestrictedMode() {
    if (!window.isRestrictedMode) return;
    
    console.log('应用受限模式：仅显示OKR脑图');
    
    // 隐藏顶部导航栏中的用户信息和移动端菜单按钮
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const userInfo = document.getElementById('userInfo');
    if (mobileMenuBtn) mobileMenuBtn.classList.add('hidden');
    if (userInfo) userInfo.classList.add('hidden');
    
    // 隐藏移动端快捷Tab按钮（团队OKR和个人OKR）
    const mobileQuickTabs = document.querySelector('.lg\\:hidden.flex.space-x-2.pb-3.border-b');
    if (mobileQuickTabs) mobileQuickTabs.classList.add('hidden');
    
    // 隐藏所有桌面端Tab导航
    const desktopTabs = document.getElementById('desktopTabs');
    if (desktopTabs) desktopTabs.classList.add('hidden');
    
    // 隐藏移动端菜单
    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenu) mobileMenu.classList.add('hidden');
    
    // 隐藏团队OKR页面的工具按钮（演讲者模式、导出、添加等）
    const presenterModeBtn = document.getElementById('presenterModeBtn');
    const exportWordBtn = document.getElementById('exportWordBtn');
    const addObjectiveBtn = document.getElementById('addObjectiveBtn');
    if (presenterModeBtn) presenterModeBtn.classList.add('hidden');
    if (exportWordBtn) exportWordBtn.classList.add('hidden');
    if (addObjectiveBtn) addObjectiveBtn.classList.add('hidden');
    
    // 隐藏视图切换按钮（列表、成员、脑图），只保留脑图视图
    const viewBtnList = document.getElementById('view-btn-list');
    const viewBtnCard = document.getElementById('view-btn-card');
    const viewBtnMindmap = document.getElementById('view-btn-mindmap');
    if (viewBtnList) viewBtnList.classList.add('hidden');
    if (viewBtnCard) viewBtnCard.classList.add('hidden');
    if (viewBtnMindmap) {
        viewBtnMindmap.classList.remove('hidden');
        viewBtnMindmap.classList.add('bg-white', 'shadow-sm', 'text-gray-900');
        viewBtnMindmap.classList.remove('text-gray-500');
    }
    
    // 隐藏日期过滤器
    const dateFilterContainer = document.querySelector('.mb-4.flex.items-center.space-x-3');
    if (dateFilterContainer) dateFilterContainer.classList.add('hidden');
    
    // 隐藏左侧目录
    const sidebar = document.getElementById('teamOkrSidebar');
    if (sidebar) sidebar.classList.add('hidden');
    
    // 调整内容区域为全屏
    const contentArea = document.querySelector('.content-area');
    if (contentArea) {
        contentArea.classList.remove('xl:ml-80');
        contentArea.style.maxWidth = '100%';
    }
    
    // 确保只有团队OKR tab可见
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    const teamContent = document.getElementById('content-team');
    if (teamContent) {
        teamContent.classList.remove('hidden');
    }
    
    // 只显示脑图视图
    document.getElementById('teamOkrList').classList.add('hidden');
    document.getElementById('teamCardView').classList.add('hidden');
    document.getElementById('teamMindMapView').classList.remove('hidden');
}

// 移动端菜单切换
function toggleMobileMenu() {
    const mobileMenu = document.getElementById('mobileMenu');
    mobileMenu.classList.toggle('hidden');
}

// 点击外部关闭移动端菜单
document.addEventListener('click', (e) => {
    const mobileMenu = document.getElementById('mobileMenu');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    
    if (!mobileMenu.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
        if (!mobileMenu.classList.contains('hidden')) {
            mobileMenu.classList.add('hidden');
        }
    }
});

// 初始化置顶导航栏的滚动效果
function initStickyNavbar() {
    const navbar = document.querySelector('nav.sticky');
    const tabNav = document.querySelector('.bg-white.sticky');
    
    let lastScrollTop = 0;
    
    window.addEventListener('scroll', () => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        // 当滚动超过50px时添加阴影效果
        if (scrollTop > 50) {
            if (navbar) navbar.classList.add('scrolled');
            if (tabNav) tabNav.classList.add('scrolled');
        } else {
            if (navbar) navbar.classList.remove('scrolled');
            if (tabNav) tabNav.classList.remove('scrolled');
        }
        
        lastScrollTop = scrollTop;
    }, { passive: true });
}