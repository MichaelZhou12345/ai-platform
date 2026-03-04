// AI助手功能模块

document.addEventListener('DOMContentLoaded', () => {
    initAIChat();
});

let suggestedQuestions = [];

function initAIChat() {
    // 创建AI助手UI
    createAIChatUI();
    
    // 绑定事件
    document.getElementById('ai-fab').addEventListener('click', toggleAIChat);
    document.getElementById('ai-close-btn').addEventListener('click', toggleAIChat);
    document.getElementById('ai-stop-btn').addEventListener('click', stopAIGeneration);
    document.getElementById('ai-clear-btn').addEventListener('click', clearAIContext);
    document.getElementById('ai-send-btn').addEventListener('click', sendAIMessage);
    document.getElementById('ai-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendAIMessage();
        }
    });
    
    // 点击会话区域收起建议问题
    document.getElementById('ai-messages').addEventListener('click', () => {
        if (isSuggestionsExpanded) {
            toggleSuggestedQuestions();
        }
    });
    
    // 点击外部关闭AI助手
    document.addEventListener('click', (e) => {
        const chatWindow = document.getElementById('ai-chat-window');
        const fab = document.getElementById('ai-fab');
        
        // 如果助手是打开的，且点击的不是助手窗口或悬浮按钮
        if (!chatWindow.classList.contains('scale-0') && 
            !chatWindow.contains(e.target) && 
            !fab.contains(e.target)) {
            toggleAIChat();
        }
    });
}

async function loadAIConfig() {
    try {
        const response = await fetch('/api/config');
        if (response.ok) {
            const config = await response.json();
            
            // 设置建议问题
            if (config.SUGGESTED_QUESTIONS && Array.isArray(config.SUGGESTED_QUESTIONS)) {
                suggestedQuestions = config.SUGGESTED_QUESTIONS;
                renderSuggestedQuestions();
            }
            
            // 检查是否配置了API Key
            if (!config.AI_API_KEY || config.AI_API_KEY === '' || config.AI_API_KEY === 'your-api-key-here') {
                console.warn('未配置 AI_API_KEY，AI功能将受限');
                // 可以在这里显示提示信息
            }
        }
    } catch (error) {
        console.error('获取AI配置失败:', error);
    }
}

function renderSuggestedQuestions() {
    const container = document.getElementById('ai-suggested-questions');
    const containerWrapper = document.getElementById('ai-suggested-questions-container');
    const toggleBtn = document.getElementById('toggle-suggestions-btn');
    const icon = toggleBtn?.querySelector('i');
    
    if (!container || !suggestedQuestions.length) {
        // 如果没有推荐问题，隐藏整个容器
        if (containerWrapper) {
            containerWrapper.classList.add('hidden');
        }
        return;
    }
    
    // 显示容器
    if (containerWrapper) {
        containerWrapper.classList.remove('hidden');
    }
    
    container.innerHTML = suggestedQuestions.map(q => `
        <button onclick="event.stopPropagation(); sendSuggestedQuestion(this.innerText)" 
                class="suggested-question-btn text-xs bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 text-purple-700 px-3 py-2 rounded-lg hover:from-purple-100 hover:to-blue-100 hover:shadow-sm transition-all shadow-sm font-medium whitespace-nowrap">
            <i class="fas fa-lightbulb mr-1 text-yellow-500 icon-expanded"></i><span>${q}</span>
        </button>
    `).join('');
    
    // 根据 isSuggestionsExpanded 设置初始样式
    if (isSuggestionsExpanded) {
        // 展开状态
        container.classList.remove('overflow-x-auto', 'flex-nowrap', 'scrollbar-thin', 'max-h-10', 'draggable-scroll');
        container.classList.add('flex-wrap');
        containerWrapper.classList.remove('pb-1', 'cursor-pointer');
        containerWrapper.classList.add('py-2');
        if (icon) {
            icon.classList.remove('fa-chevron-up');
            icon.classList.add('fa-chevron-down');
        }
        // 显示灯泡图标
        container.querySelectorAll('.icon-expanded').forEach(iconEl => {
            iconEl.classList.remove('hidden');
        });
    } else {
        // 折叠状态（默认）
        container.classList.remove('flex-wrap');
        container.classList.add('overflow-x-auto', 'flex-nowrap', 'scrollbar-thin', 'max-h-10', 'draggable-scroll');
        containerWrapper.classList.remove('py-2');
        containerWrapper.classList.add('pb-1', 'cursor-pointer');
        if (icon) {
            icon.classList.remove('fa-chevron-down');
            icon.classList.add('fa-chevron-up');
        }
        // 隐藏灯泡图标
        container.querySelectorAll('.icon-expanded').forEach(iconEl => {
            iconEl.classList.add('hidden');
        });
        // 添加拖拽滚动
        addDragScroll(container);
    }
}

// 切换建议问题的展开/折叠状态
let isSuggestionsExpanded = false;

function toggleSuggestedQuestions() {
    const container = document.getElementById('ai-suggested-questions');
    const containerWrapper = document.getElementById('ai-suggested-questions-container');
    const toggleBtn = document.getElementById('toggle-suggestions-btn');
    const icon = toggleBtn.querySelector('i');
    
    isSuggestionsExpanded = !isSuggestionsExpanded;
    
    if (isSuggestionsExpanded) {
        // 展开状态：显示所有问题，换行显示，显示灯泡图标
        container.classList.remove('overflow-x-auto', 'flex-nowrap', 'scrollbar-thin', 'max-h-10', 'draggable-scroll');
        container.classList.add('flex-wrap');
        containerWrapper.classList.remove('pb-1', 'cursor-pointer');
        containerWrapper.classList.add('py-2');
        icon.classList.remove('fa-chevron-up');
        icon.classList.add('fa-chevron-down');
        
        // 显示所有灯泡图标
        container.querySelectorAll('.icon-expanded').forEach(iconEl => {
            iconEl.classList.remove('hidden');
        });
        
        // 移除拖拽滚动事件
        removeDragScroll(container);
    } else {
        // 折叠状态：单行显示，支持横向滚动，高度限制为一行，隐藏灯泡图标
        container.classList.remove('flex-wrap');
        container.classList.add('overflow-x-auto', 'flex-nowrap', 'scrollbar-thin', 'max-h-10', 'draggable-scroll');
        containerWrapper.classList.remove('py-2');
        containerWrapper.classList.add('pb-1', 'cursor-pointer');
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-up');
        
        // 隐藏所有灯泡图标
        container.querySelectorAll('.icon-expanded').forEach(iconEl => {
            iconEl.classList.add('hidden');
        });
        
        // 添加拖拽滚动事件
        addDragScroll(container);
    }
}

// 处理建议问题容器的点击事件
function handleSuggestionsContainerClick(event) {
    // 如果是折叠状态，且点击的不是按钮本身，则展开
    if (!isSuggestionsExpanded) {
        const container = document.getElementById('ai-suggested-questions');
        const toggleBtn = document.getElementById('toggle-suggestions-btn');
        
        // 如果点击的不是建议问题按钮本身，则展开
        if (!container.contains(event.target) || event.target === event.currentTarget) {
            toggleSuggestedQuestions();
        }
    }
}

// 添加拖拽滚动功能
function addDragScroll(element) {
    let isDown = false;
    let startX;
    let scrollLeft;
    
    const mouseDownHandler = (e) => {
        isDown = true;
        element.classList.add('cursor-grabbing');
        startX = e.pageX - element.offsetLeft;
        scrollLeft = element.scrollLeft;
        e.preventDefault();
    };
    
    const mouseLeaveHandler = () => {
        isDown = false;
        element.classList.remove('cursor-grabbing');
    };
    
    const mouseUpHandler = () => {
        isDown = false;
        element.classList.remove('cursor-grabbing');
    };
    
    const mouseMoveHandler = (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - element.offsetLeft;
        const walk = (x - startX) * 2; // 滚动速度
        element.scrollLeft = scrollLeft - walk;
    };
    
    // 存储事件处理器，以便后续移除
    element._dragScrollHandlers = {
        mouseDown: mouseDownHandler,
        mouseLeave: mouseLeaveHandler,
        mouseUp: mouseUpHandler,
        mouseMove: mouseMoveHandler
    };
    
    element.addEventListener('mousedown', mouseDownHandler);
    element.addEventListener('mouseleave', mouseLeaveHandler);
    element.addEventListener('mouseup', mouseUpHandler);
    element.addEventListener('mousemove', mouseMoveHandler);
    
    // 添加触摸事件支持
    const touchStartHandler = (e) => {
        isDown = true;
        startX = e.touches[0].pageX - element.offsetLeft;
        scrollLeft = element.scrollLeft;
    };
    
    const touchEndHandler = () => {
        isDown = false;
    };
    
    const touchMoveHandler = (e) => {
        if (!isDown) return;
        const x = e.touches[0].pageX - element.offsetLeft;
        const walk = (x - startX) * 2;
        element.scrollLeft = scrollLeft - walk;
    };
    
    element._dragScrollHandlers.touchStart = touchStartHandler;
    element._dragScrollHandlers.touchEnd = touchEndHandler;
    element._dragScrollHandlers.touchMove = touchMoveHandler;
    
    element.addEventListener('touchstart', touchStartHandler);
    element.addEventListener('touchend', touchEndHandler);
    element.addEventListener('touchmove', touchMoveHandler);
}

// 移除拖拽滚动功能
function removeDragScroll(element) {
    if (element._dragScrollHandlers) {
        element.removeEventListener('mousedown', element._dragScrollHandlers.mouseDown);
        element.removeEventListener('mouseleave', element._dragScrollHandlers.mouseLeave);
        element.removeEventListener('mouseup', element._dragScrollHandlers.mouseUp);
        element.removeEventListener('mousemove', element._dragScrollHandlers.mouseMove);
        element.removeEventListener('touchstart', element._dragScrollHandlers.touchStart);
        element.removeEventListener('touchend', element._dragScrollHandlers.touchEnd);
        element.removeEventListener('touchmove', element._dragScrollHandlers.touchMove);
        delete element._dragScrollHandlers;
    }
}

// 全局函数，以便在HTML onclick中调用
window.toggleSuggestedQuestions = toggleSuggestedQuestions;
window.handleSuggestionsContainerClick = handleSuggestionsContainerClick;

function hideSuggestedQuestions() {
    const container = document.getElementById('ai-suggested-questions');
    const containerWrapper = document.getElementById('ai-suggested-questions-container');
    
    if (container) {
        container.innerHTML = '';
    }
    
    // 隐藏整个容器
    if (containerWrapper) {
        containerWrapper.classList.add('hidden');
    }
}

// 全局函数，以便在HTML onclick中调用
window.sendSuggestedQuestion = function(question) {
    const input = document.getElementById('ai-input');
    if (input) {
        input.value = question;
        sendAIMessage();
    }
};

function createAIChatUI() {
    const chatHTML = `
        <!-- AI悬浮按钮 -->
        <button id="ai-fab" class="fixed bottom-6 right-4 md:bottom-8 md:right-8 w-12 h-12 md:w-14 md:h-14 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110" style="z-index: 10002;">
            <i class="fas fa-robot text-xl md:text-2xl"></i>
        </button>

        <!-- AI聊天窗口 -->
        <div id="ai-chat-window" class="fixed bottom-20 md:bottom-24 right-4 md:right-8 w-[calc(100vw-2rem)] md:w-[400px] max-w-[400px] h-[70vh] md:h-[700px] max-h-[700px] bg-white rounded-xl shadow-2xl flex flex-col transform transition-all duration-300 origin-bottom-right scale-0 opacity-0 border border-gray-200" style="z-index: 10002;">
            <!-- 头部 -->
            <div class="p-3 md:p-4 bg-purple-600 text-white rounded-t-xl">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-2">
                        <i class="fas fa-robot text-sm md:text-base"></i>
                        <span class="font-bold text-sm md:text-base">AI 智能助手</span>
                    </div>
                    <button id="ai-close-btn" class="hover:text-gray-200 transition-colors">
                        <i class="fas fa-times text-sm md:text-base"></i>
                    </button>
                </div>
            </div>

            <!-- 消息列表 -->
            <div id="ai-messages" class="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4 bg-gray-50">
                <div class="flex justify-start">
                    <div class="bg-white p-3 rounded-lg rounded-tl-none shadow-sm border border-gray-100 max-w-[85%] md:max-w-[90%]">
                        <p class="text-sm text-gray-800">你好！我是你的OKR智能助手。我可以帮你分析OKR、生成进展汇总、查询版本信息或回答相关问题。请问有什么可以帮你的吗？</p>
                    </div>
                </div>
            </div>

            <!-- 思考过程展示区 (默认隐藏) -->
            <div id="ai-thinking" class="hidden px-4 py-2 bg-gray-100 border-t border-gray-200 text-xs text-gray-500 italic">
                <i class="fas fa-brain mr-1 animate-pulse"></i> AI正在思考...
            </div>

            <!-- 建议问题区域（移到输入框上方） -->
            <div id="ai-suggested-questions-container" class="px-3 md:px-4 py-2 bg-white border-t border-gray-200 cursor-pointer" onclick="handleSuggestionsContainerClick(event)">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs text-gray-500 font-medium">建议问题</span>
                    <button id="toggle-suggestions-btn" onclick="event.stopPropagation(); toggleSuggestedQuestions();" class="text-gray-400 hover:text-gray-600 transition-colors">
                        <i class="fas fa-chevron-down text-sm"></i>
                    </button>
                </div>
                <div id="ai-suggested-questions" class="flex flex-wrap gap-2"></div>
            </div>

            <!-- 输入区 -->
            <div class="p-3 md:p-4 pt-2 bg-white border-t border-gray-100 rounded-b-xl">
                <div class="flex space-x-2">
                    <button id="ai-clear-btn" onclick="event.stopPropagation();" class="px-3 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" title="清空对话">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                    <button id="react-mode-toggle-btn" onclick="event.stopPropagation(); toggleReactMode();" class="px-3 py-2 text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-all" title="Plan 模式（已启用）">
                        <i class="fas fa-list-check"></i>
                    </button>
                    <textarea id="ai-input" rows="1" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-sm" placeholder="输入你的问题..."></textarea>
                    <button id="ai-send-btn" onclick="event.stopPropagation();" class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                    <button id="ai-stop-btn" onclick="event.stopPropagation();" class="hidden px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors" title="停止生成">
                        <i class="fas fa-stop-circle"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', chatHTML);
}

// 切换 Plan 模式
function toggleReactMode() {
    isReactMode = !isReactMode;
    
    const btn = document.getElementById('react-mode-toggle-btn');
    if (isReactMode) {
        // 启用状态：紫色背景
        btn.classList.remove('bg-gray-400', 'hover:bg-gray-500');
        btn.classList.add('bg-purple-600', 'hover:bg-purple-700');
        btn.title = 'Plan 模式（已启用）';
    } else {
        // 禁用状态：灰色背景
        btn.classList.remove('bg-purple-600', 'hover:bg-purple-700');
        btn.classList.add('bg-gray-400', 'hover:bg-gray-500');
        btn.title = 'Plan 模式（已禁用）';
    }
    
    const statusText = isReactMode ? '已启用' : '已禁用';
    const statusColor = isReactMode ? 'text-green-600' : 'text-gray-600';
    
    // 显示提示
    const messagesDiv = document.getElementById('ai-messages');
    const toggleMessageHTML = `
        <div class="flex justify-center my-2">
            <div class="bg-white border border-gray-200 ${statusColor} px-3 py-1 rounded-full text-xs shadow-sm">
                <i class="fas fa-list-check mr-1"></i>Plan 模式 ${statusText}
            </div>
        </div>
    `;
    messagesDiv.insertAdjacentHTML('beforeend', toggleMessageHTML);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    
    // 3秒后移除提示
    setTimeout(() => {
        const toggleMsg = messagesDiv.lastElementChild;
        if (toggleMsg && toggleMsg.querySelector('.bg-white')) {
            toggleMsg.remove();
        }
    }, 3000);
}

function toggleAIChat() {
    const chatWindow = document.getElementById('ai-chat-window');
    const fab = document.getElementById('ai-fab');
    
    if (chatWindow.classList.contains('scale-0')) {
        // 打开时重新加载配置（确保获取最新的数据库配置）
        loadAIConfig();
        
        // 打开
        chatWindow.classList.remove('scale-0', 'opacity-0');
        fab.classList.add('rotate-90', 'opacity-0');
        setTimeout(() => document.getElementById('ai-input').focus(), 300);
    } else {
        // 关闭
        chatWindow.classList.add('scale-0', 'opacity-0');
        fab.classList.remove('rotate-90', 'opacity-0');
    }
}

// 收集当前上下文
function getPageContext() {
    let context = "";
    
    // 获取当前激活的Tab
    const activeTab = document.querySelector('.tab-active');
    const tabName = activeTab ? activeTab.innerText.trim() : '未知';
    
    context += `当前所在页面模块：${tabName}\n\n`;
    
    // 只发送用户信息，不再发送页面内容
    // AI将通过SQL查询工具直接从数据库获取数据
    const userName = document.getElementById('userName').innerText;
    if (userName) {
        context += `当前用户：${userName}\n`;
    }
    
    return context;
}

let messageHistory = [];
let currentToolCallMap = new Map(); // 存储工具调用ID到元素的映射
let currentStreamReader = null; // 存储当前的流式读取器，用于停止生成
let currentAbortController = null; // 存储当前的AbortController，用于停止请求
let isGenerating = false; // 标记是否正在生成
let currentPlan = null; // 存储当前的执行计划
let isReactMode = true; // 是否启用 ReACT Agent 模式（默认启用）

async function sendAIMessage() {
    const input = document.getElementById('ai-input');
    const sendBtn = document.getElementById('ai-send-btn');
    const stopBtn = document.getElementById('ai-stop-btn');
    const content = input.value.trim();
    
    if (!content) return;
    
    // 禁用输入
    input.value = '';
    input.disabled = true;
    
    // 隐藏发送按钮，显示停止按钮（替换位置）
    sendBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
    
    // 隐藏建议问题
    hideSuggestedQuestions();
    
    // 添加用户消息
    appendMessage('user', content);
    messageHistory.push({ role: 'user', content: content });
    
    // 显示思考状态
    const thinkingDiv = document.getElementById('ai-thinking');
    thinkingDiv.innerHTML = '<i class="fas fa-brain mr-1 animate-pulse"></i> AI正在思考和规划...';
    thinkingDiv.classList.remove('hidden');
    
    // 设置生成状态（在开始前就设置，以便可以停止）
    isGenerating = true;
    
    try {
        // 准备上下文
        const context = getPageContext();
        
        // 提取用户英文名
        let userEngName = '';
        if (currentUser && currentUser.EngName) {
            userEngName = currentUser.EngName;
        }
        
        // 第一步：生成执行计划（ReACT Agent）
        if (isReactMode) {
            // 检查是否已停止
            if (!isGenerating) {
                return;
            }
            
            // 创建 AbortController
            currentAbortController = new AbortController();
            
            const planResponse = await fetch('/api/chat/plan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messages: messageHistory,
                    context: context,
                    user_eng_name: userEngName
                }),
                signal: currentAbortController.signal
            });
            
            if (!planResponse.ok) {
                throw new Error('生成执行计划失败');
            }
            
            // 检查是否已停止
            if (!isGenerating) {
                return;
            }
            
            const planData = await planResponse.json();
            currentPlan = planData.plan;
            
            // 隐藏思考状态
            thinkingDiv.classList.add('hidden');
            
            // 检查是否已停止
            if (!isGenerating) {
                return;
            }
            
            // 显示执行计划，等待用户确认
            const confirmed = await showPlanConfirmation(currentPlan);
            
            if (!confirmed) {
                // 用户取消了执行
                appendMessage('assistant', '已取消执行。如有其他问题，请随时告诉我。');
                return;
            }
        }
        
        // 第二步：执行计划（调用原有的 chat 接口）
        thinkingDiv.innerHTML = '<i class="fas fa-cog fa-spin mr-1"></i> 正在执行计划...';
        thinkingDiv.classList.remove('hidden');
        
        // 设置生成状态
        isGenerating = true;
        
        // 发送请求到统一的chat接口
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: messageHistory,
                context: context,
                user_eng_name: userEngName
            })
        });
        
        if (!response.ok) {
            throw new Error('网络请求失败');
        }
        
        // 创建AI消息容器（用于显示AI回复）
        const aiMessageDiv = appendMessage('assistant', '');
        const aiContentDiv = aiMessageDiv.querySelector('.markdown-content');
        
        // 创建工具调用容器（用于显示工具调用事件）
        const toolCallContainer = document.createElement('div');
        toolCallContainer.className = 'flex flex-col space-y-2 mb-2';
        aiMessageDiv.querySelector('.markdown-content').parentNode.insertBefore(toolCallContainer, aiMessageDiv.querySelector('.markdown-content'));
        
        let aiResponseText = '';
        let buffer = '';
        let contentBuffer = ''; // 用于存储纯内容（不包含工具调用标记）
        
        // 处理流式响应
        const reader = response.body.getReader();
        currentStreamReader = reader; // 保存reader以便停止
        const decoder = new TextDecoder();
        
        while (true) {
            // 检查是否需要停止
            if (!isGenerating) {
                reader.cancel();
                break;
            }
            
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            
            // 处理buffer中的所有完整事件
            let hasMoreEvents = true;
            while (hasMoreEvents) {
                hasMoreEvents = false;
                
                // 查找最早出现的事件标记（使用更宽松的正则表达式，支持跨行和特殊字符）
                const startMatch = buffer.match(/\[TOOL_CALL_START:(\{[\s\S]*?\})\]/);
                const resultMatch = buffer.match(/\[TOOL_CALL_RESULT:(\{[\s\S]*?\})\]/);
                const errorMatch = buffer.match(/\[TOOL_CALL_ERROR:(\{[\s\S]*?\})\]/);
                
                let earliestMatch = null;
                let earliestIndex = Infinity;
                let matchType = null;
                
                if (startMatch && startMatch.index < earliestIndex) {
                    earliestMatch = startMatch;
                    earliestIndex = startMatch.index;
                    matchType = 'start';
                }
                if (resultMatch && resultMatch.index < earliestIndex) {
                    earliestMatch = resultMatch;
                    earliestIndex = resultMatch.index;
                    matchType = 'result';
                }
                if (errorMatch && errorMatch.index < earliestIndex) {
                    earliestMatch = errorMatch;
                    earliestIndex = errorMatch.index;
                    matchType = 'error';
                }
                
                if (earliestMatch) {
                    // 将事件标记之前的内容添加到contentBuffer
                    contentBuffer += buffer.slice(0, earliestIndex);
                    
                    try {
                        const eventData = JSON.parse(earliestMatch[1]);
                        
                        if (matchType === 'start') {
                            const toolCallId = appendToolCallEvent(eventData, toolCallContainer);
                            currentToolCallMap.set(eventData.tool_name, toolCallId);
                        } else if (matchType === 'result') {
                            appendToolCallResult(eventData, currentToolCallMap.get(eventData.tool_name));
                            currentToolCallMap.delete(eventData.tool_name);
                        } else if (matchType === 'error') {
                            appendToolCallError(eventData, currentToolCallMap.get(eventData.tool_name));
                            currentToolCallMap.delete(eventData.tool_name);
                        }
                        
                        // 移除已处理的内容（包括事件标记）
                        buffer = buffer.slice(earliestIndex + earliestMatch[0].length);
                        hasMoreEvents = true;
                    } catch (e) {
                        console.error('解析工具调用事件失败:', e, earliestMatch[1]);
                        // 如果解析失败，跳过这个标记
                        buffer = buffer.slice(earliestIndex + earliestMatch[0].length);
                        hasMoreEvents = true;
                    }
                }
            }
            
            // 检查buffer中是否有不完整的标记
            const incompleteMarkerIndex = buffer.search(/\[TOOL_CALL_(START|RESULT|ERROR):/);
            if (incompleteMarkerIndex !== -1) {
                // 将不完整标记之前的内容添加到contentBuffer
                contentBuffer += buffer.slice(0, incompleteMarkerIndex);
                // 保留不完整的标记在buffer中
                buffer = buffer.slice(incompleteMarkerIndex);
            } else {
                // 没有不完整的标记，将所有内容添加到contentBuffer
                contentBuffer += buffer;
                buffer = '';
            }
            
            // 更新AI响应文本
            aiResponseText = contentBuffer;
            
            // 实时渲染Markdown
            if (aiResponseText.trim()) {
                aiContentDiv.innerHTML = marked.parse(aiResponseText);
                
                // 为渲染后的图片添加点击放大事件
                const images = aiContentDiv.querySelectorAll('img');
                images.forEach(img => {
                    img.style.cursor = 'pointer';
                    img.addEventListener('click', function(e) {
                        e.stopPropagation();
                        openImageModal(this.src);
                    });
                });
            }
            
            // 滚动到底部
            const messagesDiv = document.getElementById('ai-messages');
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
        
        // 处理最后可能残留的buffer内容
        if (buffer.trim()) {
            // 移除所有工具调用标记
            const finalClean = buffer.replace(/\[TOOL_CALL_(START|RESULT|ERROR):\{[\s\S]*?\}\]/g, '');
            if (finalClean.trim()) {
                contentBuffer += finalClean;
                aiResponseText = contentBuffer;
                aiContentDiv.innerHTML = marked.parse(aiResponseText);
                
                // 为最终渲染的图片添加点击放大事件
                const images = aiContentDiv.querySelectorAll('img');
                images.forEach(img => {
                    img.style.cursor = 'pointer';
                    img.addEventListener('click', function(e) {
                        e.stopPropagation();
                        openImageModal(this.src);
                    });
                });
            }
        }
        
        // 记录历史
        messageHistory.push({ role: 'assistant', content: aiResponseText });
        
        // ReAct Loop: 判断任务是否完成，如果未完成则继续规划和执行
        if (isReactMode && aiResponseText.trim()) {
            // 判断任务是否完成
            const isTaskComplete = await checkTaskCompletion(aiResponseText, context, userEngName);
            
            if (!isTaskComplete) {
                // 任务未完成，继续下一轮 ReAct
                thinkingDiv.innerHTML = '<i class="fas fa-brain mr-1 animate-pulse"></i> 任务未完成，继续规划下一步...';
                thinkingDiv.classList.remove('hidden');
                
                // 递归调用，继续执行 ReAct Loop
                await continueReactLoop(context, userEngName, thinkingDiv, aiMessageDiv, toolCallContainer);
            }
        }
        
    } catch (error) {
        console.error('AI对话出错:', error);
        
        // 如果是用户主动中断，不显示错误消息
        if (error.name === 'AbortError') {
            console.log('请求已被用户中断');
        } else {
            appendMessage('assistant', '抱歉，我遇到了一些问题，请稍后再试。');
        }
    } finally {
        // 只有在仍处于生成状态时才重置UI（避免与stopAIGeneration冲突）
        if (isGenerating) {
            // 重置生成状态
            isGenerating = false;
            currentStreamReader = null;
            currentAbortController = null;
            currentPlan = null;
            
            // 恢复输入
            input.disabled = false;
            input.focus();
            thinkingDiv.classList.add('hidden');
            
            // 显示发送按钮，隐藏停止按钮（恢复原状）
            sendBtn.classList.remove('hidden');
            stopBtn.classList.add('hidden');
        }
        
        // 清空工具调用映射
        currentToolCallMap.clear();
        // 重新显示建议问题（保持折叠状态）
        isSuggestionsExpanded = false;
        renderSuggestedQuestions();
    }
}

/**
 * 判断任务是否完成
 * @param {string} aiResponse - AI的回复内容
 * @param {string} context - 当前上下文
 * @param {string} userEngName - 用户英文名
 * @returns {Promise<boolean>} - 任务是否完成
 */
async function checkTaskCompletion(aiResponse, context, userEngName) {
    try {
        // 调用后端接口判断任务是否完成
        const response = await fetch('/api/chat/check-completion', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: messageHistory,
                context: context,
                user_eng_name: userEngName
            })
        });
        
        if (!response.ok) {
            console.error('判断任务完成状态失败');
            return true; // 出错时默认认为任务已完成，避免无限循环
        }
        
        const data = await response.json();
        console.log("checkTaskCompletion: ", data);
        return data.is_complete || false;
    } catch (error) {
        console.error('判断任务完成状态出错:', error);
        return true; // 出错时默认认为任务已完成，避免无限循环
    }
}

/**
 * 继续 ReAct Loop
 * @param {string} context - 当前上下文
 * @param {string} userEngName - 用户英文名
 * @param {HTMLElement} thinkingDiv - 思考状态显示元素
 * @param {HTMLElement} aiMessageDiv - AI消息容器
 * @param {HTMLElement} toolCallContainer - 工具调用容器
 */
async function continueReactLoop(context, userEngName, thinkingDiv, aiMessageDiv, toolCallContainer) {
    try {
        // 检查是否已停止
        if (!isGenerating) {
            return;
        }
        
        // 创建 AbortController
        currentAbortController = new AbortController();
        
        // 生成新的执行计划
        const planResponse = await fetch('/api/chat/plan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: messageHistory,
                context: context,
                user_eng_name: userEngName
            }),
            signal: currentAbortController.signal
        });
        
        if (!planResponse.ok) {
            throw new Error('生成执行计划失败');
        }
        
        // 检查是否已停止
        if (!isGenerating) {
            return;
        }
        
        const planData = await planResponse.json();
        currentPlan = planData.plan;
        
        // 隐藏思考状态
        thinkingDiv.classList.add('hidden');
        
        // 检查是否已停止
        if (!isGenerating) {
            return;
        }
        
        // 显示执行计划（自动确认，不需要用户手动确认）
        showPlanInfo(currentPlan);
        
        // 自动执行计划
        thinkingDiv.innerHTML = '<i class="fas fa-cog fa-spin mr-1"></i> 正在执行下一步计划...';
        thinkingDiv.classList.remove('hidden');
        
        // 发送请求到统一的chat接口
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: messageHistory,
                context: context,
                user_eng_name: userEngName
            })
        });
        
        if (!response.ok) {
            throw new Error('网络请求失败');
        }
        
        // 创建新的AI消息容器
        const newAiMessageDiv = appendMessage('assistant', '');
        const newAiContentDiv = newAiMessageDiv.querySelector('.markdown-content');
        
        // 创建新的工具调用容器
        const newToolCallContainer = document.createElement('div');
        newToolCallContainer.className = 'flex flex-col space-y-2 mb-2';
        newAiMessageDiv.querySelector('.markdown-content').parentNode.insertBefore(newToolCallContainer, newAiMessageDiv.querySelector('.markdown-content'));
        
        let aiResponseText = '';
        let buffer = '';
        let contentBuffer = '';
        
        // 处理流式响应
        const reader = response.body.getReader();
        currentStreamReader = reader;
        const decoder = new TextDecoder();
        
        while (true) {
            if (!isGenerating) {
                reader.cancel();
                break;
            }
            
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            
            // 处理buffer中的所有完整事件
            let hasMoreEvents = true;
            while (hasMoreEvents) {
                hasMoreEvents = false;
                
                const startMatch = buffer.match(/\[TOOL_CALL_START:(\{[\s\S]*?\})\]/);
                const resultMatch = buffer.match(/\[TOOL_CALL_RESULT:(\{[\s\S]*?\})\]/);
                const errorMatch = buffer.match(/\[TOOL_CALL_ERROR:(\{[\s\S]*?\})\]/);
                
                let earliestMatch = null;
                let earliestIndex = Infinity;
                let matchType = null;
                
                if (startMatch && startMatch.index < earliestIndex) {
                    earliestMatch = startMatch;
                    earliestIndex = startMatch.index;
                    matchType = 'start';
                }
                if (resultMatch && resultMatch.index < earliestIndex) {
                    earliestMatch = resultMatch;
                    earliestIndex = resultMatch.index;
                    matchType = 'result';
                }
                if (errorMatch && errorMatch.index < earliestIndex) {
                    earliestMatch = errorMatch;
                    earliestIndex = errorMatch.index;
                    matchType = 'error';
                }
                
                if (earliestMatch) {
                    contentBuffer += buffer.slice(0, earliestIndex);
                    
                    try {
                        const eventData = JSON.parse(earliestMatch[1]);
                        
                        if (matchType === 'start') {
                            const toolCallId = appendToolCallEvent(eventData, newToolCallContainer);
                            currentToolCallMap.set(eventData.tool_name, toolCallId);
                        } else if (matchType === 'result') {
                            appendToolCallResult(eventData, currentToolCallMap.get(eventData.tool_name));
                            currentToolCallMap.delete(eventData.tool_name);
                        } else if (matchType === 'error') {
                            appendToolCallError(eventData, currentToolCallMap.get(eventData.tool_name));
                            currentToolCallMap.delete(eventData.tool_name);
                        }
                        
                        buffer = buffer.slice(earliestIndex + earliestMatch[0].length);
                        hasMoreEvents = true;
                    } catch (e) {
                        console.error('解析工具调用事件失败:', e, earliestMatch[1]);
                        buffer = buffer.slice(earliestIndex + earliestMatch[0].length);
                        hasMoreEvents = true;
                    }
                }
            }
            
            const incompleteMarkerIndex = buffer.search(/\[TOOL_CALL_(START|RESULT|ERROR):/);
            if (incompleteMarkerIndex !== -1) {
                contentBuffer += buffer.slice(0, incompleteMarkerIndex);
                buffer = buffer.slice(incompleteMarkerIndex);
            } else {
                contentBuffer += buffer;
                buffer = '';
            }
            
            aiResponseText = contentBuffer;
            
            if (aiResponseText.trim()) {
                newAiContentDiv.innerHTML = marked.parse(aiResponseText);
                
                const images = newAiContentDiv.querySelectorAll('img');
                images.forEach(img => {
                    img.style.cursor = 'pointer';
                    img.addEventListener('click', function(e) {
                        e.stopPropagation();
                        openImageModal(this.src);
                    });
                });
            }
            
            const messagesDiv = document.getElementById('ai-messages');
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
        
        if (buffer.trim()) {
            const finalClean = buffer.replace(/\[TOOL_CALL_(START|RESULT|ERROR):\{[\s\S]*?\}\]/g, '');
            if (finalClean.trim()) {
                contentBuffer += finalClean;
                aiResponseText = contentBuffer;
                newAiContentDiv.innerHTML = marked.parse(aiResponseText);
                
                const images = newAiContentDiv.querySelectorAll('img');
                images.forEach(img => {
                    img.style.cursor = 'pointer';
                    img.addEventListener('click', function(e) {
                        e.stopPropagation();
                        openImageModal(this.src);
                    });
                });
            }
        }
        
        // 记录历史
        messageHistory.push({ role: 'assistant', content: aiResponseText });
        
        // 递归判断任务是否完成
        if (aiResponseText.trim()) {
            const isTaskComplete = await checkTaskCompletion(aiResponseText, context, userEngName);
            
            if (!isTaskComplete) {
                thinkingDiv.innerHTML = '<i class="fas fa-brain mr-1 animate-pulse"></i> 任务未完成，继续规划下一步...';
                thinkingDiv.classList.remove('hidden');
                
                // 继续下一轮
                await continueReactLoop(context, userEngName, thinkingDiv, newAiMessageDiv, newToolCallContainer);
            } else {
                thinkingDiv.classList.add('hidden');
            }
        }
        
    } catch (error) {
        console.error('ReAct Loop 执行出错:', error);
        
        // 如果是用户主动中断，不显示错误消息
        if (error.name === 'AbortError') {
            console.log('ReAct Loop 已被用户中断');
        } else {
            appendMessage('assistant', '抱歉，执行过程中遇到了问题。');
        }
        
        // 只有在仍处于生成状态时才隐藏思考状态
        if (isGenerating) {
            thinkingDiv.classList.add('hidden');
        }
    }
}

/**
 * 显示执行计划信息（不需要用户确认）
 * @param {Object} plan - 执行计划对象
 */
function showPlanInfo(plan) {
    const messagesDiv = document.getElementById('ai-messages');
    
    let stepsHTML = '';
    if (plan.steps && plan.steps.length > 0) {
        stepsHTML = plan.steps.map(step => {
            const toolNameDisplay = step.action === 'query_version_info' ? '版本信息查询' : 
                                   step.action === 'execute_sql_query' ? '数据库查询' : 
                                   step.action;
            
            const paramsDisplay = step.params ? 
                `<div class="mt-1 text-xs bg-gray-50 p-2 rounded">
                    <span class="font-medium">参数：</span>
                    <pre class="whitespace-pre-wrap break-all text-gray-600 mt-1">${JSON.stringify(step.params, null, 2)}</pre>
                </div>` : '';
            
            return `
                <div class="flex items-start space-x-3 p-3 bg-white rounded-lg border border-gray-200">
                    <div class="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xs font-bold">
                        ${step.step}
                    </div>
                    <div class="flex-1">
                        <div class="font-medium text-gray-800">${toolNameDisplay}</div>
                        <div class="text-xs text-gray-600 mt-1">${escapeHtml(step.reason)}</div>
                        ${paramsDisplay}
                    </div>
                </div>
            `;
        }).join('');
    } else {
        stepsHTML = '<div class="text-sm text-gray-500 italic">无需调用工具，可以直接回答</div>';
    }
    
    const planCardHTML = `
        <div class="flex justify-start">
            <div class="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg shadow-md border-2 border-blue-200 max-w-[95%]">
                <div class="flex items-center space-x-2 mb-3">
                    <i class="fas fa-route text-blue-500 text-lg"></i>
                    <span class="font-bold text-gray-800">下一步计划</span>
                    <span class="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">自动执行</span>
                </div>
                
                <div class="mb-3 p-3 bg-white rounded-lg border border-gray-200">
                    <div class="flex items-center space-x-2 mb-2">
                        <i class="fas fa-brain text-purple-500"></i>
                        <span class="font-semibold text-sm text-gray-700">思考过程</span>
                    </div>
                    <div class="text-sm text-gray-600 leading-relaxed">${escapeHtml(plan.thought)}</div>
                </div>
                
                <div class="mb-3">
                    <div class="flex items-center space-x-2 mb-2">
                        <i class="fas fa-list-ol text-blue-500"></i>
                        <span class="font-semibold text-sm text-gray-700">执行步骤</span>
                    </div>
                    <div class="space-y-2">
                        ${stepsHTML}
                    </div>
                </div>
                
                <div class="p-3 bg-white rounded-lg border border-gray-200">
                    <div class="flex items-center space-x-2 mb-2">
                        <i class="fas fa-bullseye text-green-500"></i>
                        <span class="font-semibold text-sm text-gray-700">预期结果</span>
                    </div>
                    <div class="text-sm text-gray-600">${escapeHtml(plan.expected_result)}</div>
                </div>
            </div>
        </div>
    `;
    
    messagesDiv.insertAdjacentHTML('beforeend', planCardHTML);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function appendMessage(role, content) {
    const messagesDiv = document.getElementById('ai-messages');
    const isUser = role === 'user';
    
    const messageHTML = `
        <div class="flex ${isUser ? 'justify-end' : 'justify-start'}">
            <div class="${isUser ? 'bg-purple-600 text-white rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'} p-2.5 md:p-3 rounded-lg shadow-sm max-w-[85%] md:max-w-[90%] overflow-x-auto">
                <div class="markdown-content text-xs md:text-sm ${isUser ? 'text-white' : ''}">
                    ${isUser ? content : marked.parse(content)}
                </div>
            </div>
        </div>
    `;
    
    messagesDiv.insertAdjacentHTML('beforeend', messageHTML);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    
    // 为新添加的消息中的图片添加点击放大事件
    const lastMessage = messagesDiv.lastElementChild;
    const images = lastMessage.querySelectorAll('img');
    images.forEach(img => {
        img.style.cursor = 'pointer';
        img.addEventListener('click', function(e) {
            e.stopPropagation();
            openImageModal(this.src);
        });
    });
    
    return lastMessage;
}

// 追加工具调用开始事件
function appendToolCallEvent(eventData, container) {
    let toolNameDisplay = eventData.tool_name;
    if (eventData.tool_name === 'query_version_info') {
        toolNameDisplay = '版本信息查询';
    } else if (eventData.tool_name === 'execute_sql_query') {
        toolNameDisplay = '数据库查询';
    }
    
    // 生成唯一ID
    const toolCallId = `tool-call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const toolEventHTML = `
        <div id="${toolCallId}" class="flex justify-start mb-2">
            <div class="bg-blue-50 border-l-4 border-blue-500 p-3 rounded-r-lg shadow-sm max-w-[90%] overflow-x-auto">
                <div class="flex items-center space-x-2 text-blue-700 text-xs mb-1">
                    <i class="fas fa-cog fa-spin"></i>
                    <span class="font-semibold">正在调用工具: ${toolNameDisplay}</span>
                </div>
                <div class="text-xs text-gray-600 bg-white p-2 rounded mt-1">
                    <div class="font-medium text-gray-700 mb-1">参数:</div>
                    <pre class="whitespace-pre-wrap break-all text-gray-600">${eventData.tool_args}</pre>
                </div>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', toolEventHTML);
    
    return toolCallId;
}

// 追加工具调用结果
function appendToolCallResult(eventData, toolCallId) {
    if (!toolCallId) return;
    
    const toolCallElement = document.getElementById(toolCallId);
    if (!toolCallElement) return;
    
    let toolNameDisplay = eventData.tool_name;
    if (eventData.tool_name === 'query_version_info') {
        toolNameDisplay = '版本信息查询';
    }
    
    // 停止齿轮旋转并显示成功状态
    const iconElement = toolCallElement.querySelector('.fa-cog');
    if (iconElement) {
        iconElement.classList.remove('fa-spin');
        iconElement.classList.remove('fa-cog');
        iconElement.classList.add('fa-check-circle');
        iconElement.parentElement.classList.remove('text-blue-700');
        iconElement.parentElement.classList.add('text-green-700');
    }
    
    // 更新标题文本
    const titleElement = toolCallElement.querySelector('.font-semibold');
    if (titleElement) {
        titleElement.textContent = `工具执行成功: ${toolNameDisplay}`;
    }
    
    // 更新边框颜色
    const contentDiv = toolCallElement.querySelector('.bg-blue-50');
    if (contentDiv) {
        contentDiv.classList.remove('bg-blue-50', 'border-blue-500');
        contentDiv.classList.add('bg-green-50', 'border-green-500');
    }
    
    // 添加结果展示区
    const toolResultHTML = `
        <div class="text-xs text-gray-700 bg-white p-2 rounded mt-2">
            <div class="font-medium text-gray-700 mb-1">返回结果:</div>
            <div class="whitespace-pre-wrap break-all text-gray-600 max-h-48 overflow-y-auto">${eventData.result}</div>
        </div>
    `;
    
    toolCallElement.querySelector('.bg-green-50').insertAdjacentHTML('beforeend', toolResultHTML);
}

// 追加工具调用错误
function appendToolCallError(eventData, toolCallId) {
    if (!toolCallId) return;
    
    const toolCallElement = document.getElementById(toolCallId);
    if (!toolCallElement) return;
    
    let toolNameDisplay = eventData.tool_name;
    if (eventData.tool_name === 'query_version_info') {
        toolNameDisplay = '版本信息查询';
    }
    
    // 停止齿轮旋转并显示错误状态
    const iconElement = toolCallElement.querySelector('.fa-cog');
    if (iconElement) {
        iconElement.classList.remove('fa-spin');
        iconElement.classList.remove('fa-cog');
        iconElement.classList.add('fa-exclamation-circle');
        iconElement.parentElement.classList.remove('text-blue-700');
        iconElement.parentElement.classList.add('text-red-700');
    }
    
    // 更新标题文本
    const titleElement = toolCallElement.querySelector('.font-semibold');
    if (titleElement) {
        titleElement.textContent = `工具执行失败: ${toolNameDisplay}`;
    }
    
    // 更新边框颜色
    const contentDiv = toolCallElement.querySelector('.bg-blue-50');
    if (contentDiv) {
        contentDiv.classList.remove('bg-blue-50', 'border-blue-500');
        contentDiv.classList.add('bg-red-50', 'border-red-500');
    }
    
    // 添加错误展示区
    const toolErrorHTML = `
        <div class="text-xs text-gray-700 bg-white p-2 rounded mt-2">
            <div class="font-medium text-red-600 mb-1">错误信息:</div>
            <div class="whitespace-pre-wrap break-all text-red-500">${eventData.error}</div>
        </div>
    `;
    
    toolCallElement.querySelector('.bg-red-50').insertAdjacentHTML('beforeend', toolErrorHTML);
}

// 停止AI生成
function stopAIGeneration() {
    if (isGenerating) {
        isGenerating = false;
        
        // 中断正在进行的请求
        if (currentAbortController) {
            try {
                currentAbortController.abort();
                currentAbortController = null;
            } catch (error) {
                console.error('中断请求失败:', error);
            }
        }
        
        // 中断流式读取
        if (currentStreamReader) {
            try {
                currentStreamReader.cancel();
                currentStreamReader = null;
            } catch (error) {
                console.error('停止生成失败:', error);
            }
        }
        
        // 立即更新按钮状态
        const input = document.getElementById('ai-input');
        const sendBtn = document.getElementById('ai-send-btn');
        const stopBtn = document.getElementById('ai-stop-btn');
        const thinkingDiv = document.getElementById('ai-thinking');
        
        // 恢复输入
        input.disabled = false;
        input.focus();
        
        // 隐藏思考状态
        thinkingDiv.classList.add('hidden');
        
        // 显示发送按钮，隐藏停止按钮
        sendBtn.classList.remove('hidden');
        stopBtn.classList.add('hidden');
        
        // 添加停止提示消息
        const messagesDiv = document.getElementById('ai-messages');
        const stopMessageHTML = `
            <div class="flex justify-center my-2">
                <div class="bg-gray-200 text-gray-600 px-3 py-1 rounded-full text-xs">
                    <i class="fas fa-hand-paper mr-1"></i>已停止生成
                </div>
            </div>
        `;
        messagesDiv.insertAdjacentHTML('beforeend', stopMessageHTML);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
}

// 清空AI对话上下文
function clearAIContext() {
    if (!confirm('确定要清空所有对话记录吗？')) {
        return;
    }
    
    // 清空消息历史
    messageHistory = [];
    
    // 清空消息显示区域
    const messagesDiv = document.getElementById('ai-messages');
    messagesDiv.innerHTML = `
        <div class="flex justify-start">
            <div class="bg-white p-3 rounded-lg rounded-tl-none shadow-sm border border-gray-100 max-w-[85%] md:max-w-[90%]">
                <p class="text-sm text-gray-800">你好！我是你的OKR智能助手。我可以帮你分析OKR、生成进展汇总、查询版本信息或回答相关问题。请问有什么可以帮你的吗？</p>
            </div>
        </div>
    `;
    
    // 重新渲染建议问题（显示在输入框上方）
    renderSuggestedQuestions();
    
    // 显示清空成功提示
    const clearMessageHTML = `
        <div class="flex justify-center my-2">
            <div class="bg-green-100 text-green-600 px-3 py-1 rounded-full text-xs">
                <i class="fas fa-check-circle mr-1"></i>对话已清空
            </div>
        </div>
    `;
    messagesDiv.insertAdjacentHTML('beforeend', clearMessageHTML);
    
    // 3秒后移除提示
    setTimeout(() => {
        const clearMsg = messagesDiv.querySelector('.bg-green-100');
        if (clearMsg && clearMsg.parentElement) {
            clearMsg.parentElement.remove();
        }
    }, 3000);
}

// ==================== ReACT Agent Plan 确认界面 ====================

/**
 * 显示执行计划确认界面
 * @param {Object} plan - 执行计划对象
 * @returns {Promise<boolean>} - 用户是否确认执行
 */
function showPlanConfirmation(plan) {
    return new Promise((resolve) => {
        const messagesDiv = document.getElementById('ai-messages');
        
        // 检查是否已停止
        if (!isGenerating) {
            resolve(false);
            return;
        }
        
        // 构建步骤列表 HTML
        let stepsHTML = '';
        if (plan.steps && plan.steps.length > 0) {
            stepsHTML = plan.steps.map(step => {
                const toolNameDisplay = step.action === 'query_version_info' ? '版本信息查询' : 
                                       step.action === 'execute_sql_query' ? '数据库查询' : 
                                       step.action;
                
                const paramsDisplay = step.params ? 
                    `<div class="mt-1 text-xs bg-gray-50 p-2 rounded">
                        <span class="font-medium">参数：</span>
                        <pre class="whitespace-pre-wrap break-all text-gray-600 mt-1">${JSON.stringify(step.params, null, 2)}</pre>
                    </div>` : '';
                
                return `
                    <div class="flex items-start space-x-3 p-3 bg-white rounded-lg border border-gray-200">
                        <div class="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xs font-bold">
                            ${step.step}
                        </div>
                        <div class="flex-1">
                            <div class="font-medium text-gray-800">${toolNameDisplay}</div>
                            <div class="text-xs text-gray-600 mt-1">${escapeHtml(step.reason)}</div>
                            ${paramsDisplay}
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            stepsHTML = '<div class="text-sm text-gray-500 italic">无需调用工具，可以直接回答</div>';
        }
        
        // 创建计划确认卡片
        const planCardHTML = `
            <div class="flex justify-start" id="plan-confirmation-card">
                <div class="bg-gradient-to-br from-purple-50 to-blue-50 p-4 rounded-lg shadow-md border-2 border-purple-200 max-w-[95%]">
                    <!-- 标题 -->
                    <div class="flex items-center space-x-2 mb-3">
                        <i class="fas fa-lightbulb text-yellow-500 text-lg"></i>
                        <span class="font-bold text-gray-800">执行计划</span>
                        <span class="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">ReACT Agent</span>
                    </div>
                    
                    <!-- 思考过程 -->
                    <div class="mb-3 p-3 bg-white rounded-lg border border-gray-200">
                        <div class="flex items-center space-x-2 mb-2">
                            <i class="fas fa-brain text-purple-500"></i>
                            <span class="font-semibold text-sm text-gray-700">思考过程</span>
                        </div>
                        <div class="text-sm text-gray-600 leading-relaxed">${escapeHtml(plan.thought)}</div>
                    </div>
                    
                    <!-- 执行步骤 -->
                    <div class="mb-3">
                        <div class="flex items-center space-x-2 mb-2">
                            <i class="fas fa-list-ol text-blue-500"></i>
                            <span class="font-semibold text-sm text-gray-700">执行步骤</span>
                        </div>
                        <div class="space-y-2">
                            ${stepsHTML}
                        </div>
                    </div>
                    
                    <!-- 预期结果 -->
                    <div class="mb-4 p-3 bg-white rounded-lg border border-gray-200">
                        <div class="flex items-center space-x-2 mb-2">
                            <i class="fas fa-bullseye text-green-500"></i>
                            <span class="font-semibold text-sm text-gray-700">预期结果</span>
                        </div>
                        <div class="text-sm text-gray-600">${escapeHtml(plan.expected_result)}</div>
                    </div>
                    
                    <!-- 操作按钮 -->
                    <div class="flex space-x-2">
                        <button id="plan-confirm-btn" class="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm">
                            <i class="fas fa-check-circle mr-1"></i>确认执行
                        </button>
                        <button id="plan-cancel-btn" class="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium text-sm">
                            <i class="fas fa-times-circle mr-1"></i>取消
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        messagesDiv.insertAdjacentHTML('beforeend', planCardHTML);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        
        // 绑定按钮事件
        const confirmBtn = document.getElementById('plan-confirm-btn');
        const cancelBtn = document.getElementById('plan-cancel-btn');
        const planCard = document.getElementById('plan-confirmation-card');
        
        confirmBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止事件冒泡，防止触发全局点击关闭AI助手的逻辑
            
            // 更新卡片状态为"已确认"
            planCard.querySelector('.bg-gradient-to-br').classList.remove('from-purple-50', 'to-blue-50', 'border-purple-200');
            planCard.querySelector('.bg-gradient-to-br').classList.add('from-green-50', 'to-green-100', 'border-green-300');
            
            // 隐藏按钮，显示确认状态
            confirmBtn.parentElement.innerHTML = `
                <div class="text-center py-2 text-green-600 font-medium">
                    <i class="fas fa-check-circle mr-1"></i>已确认，开始执行...
                </div>
            `;
            
            resolve(true);
        });
        
        cancelBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止事件冒泡，防止触发全局点击关闭AI助手的逻辑
            
            // 更新卡片状态为"已取消"
            planCard.querySelector('.bg-gradient-to-br').classList.remove('from-purple-50', 'to-blue-50', 'border-purple-200');
            planCard.querySelector('.bg-gradient-to-br').classList.add('from-gray-50', 'to-gray-100', 'border-gray-300');
            
            // 隐藏按钮，显示取消状态
            cancelBtn.parentElement.innerHTML = `
                <div class="text-center py-2 text-gray-600 font-medium">
                    <i class="fas fa-times-circle mr-1"></i>已取消
                </div>
            `;
            
            resolve(false);
        });
    });
}