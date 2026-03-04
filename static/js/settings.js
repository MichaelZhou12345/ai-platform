// ==================== 设置面板功能 ====================

// 切换用户菜单
function toggleUserMenu() {
    const userMenu = document.getElementById('userMenu');
    userMenu.classList.toggle('hidden');
}

// 点击外部关闭用户菜单
document.addEventListener('click', (e) => {
    const userMenu = document.getElementById('userMenu');
    const userMenuBtn = document.getElementById('userMenuBtn');
    
    if (userMenu && userMenuBtn && !userMenu.contains(e.target) && !userMenuBtn.contains(e.target)) {
        if (!userMenu.classList.contains('hidden')) {
            userMenu.classList.add('hidden');
        }
    }
});

// 打开设置面板
async function openSettings() {
    showLoading();
    try {
        // 加载版本信息
        loadSystemVersion();
        
        // 加载当前配置
        const response = await fetch('/api/admin/config', {
            headers: {
                'X-User-Eng-Name': currentUser.EngName
            }
        });
        
        if (!response.ok) {
            throw new Error('获取配置失败');
        }
        
        const data = await response.json();
        const configs = data.configs;
        
        // 填充表单
        document.getElementById('config-site-title').value = configs['system.site_title'] || '';
        
        // 企微机器人webhook配置
        document.getElementById('config-wework-webhook').value = configs['wework_bot.webhook_url'] || '';
        
        // 白名单（逗号分隔转换为换行）
        const whiteList = configs['system.white_list'] || '';
        document.getElementById('config-white-list').value = whiteList.split(',').map(s => s.trim()).filter(s => s).join('\n');
        
        const okrWhiteList = configs['system.okr_white_list'] || '';
        document.getElementById('config-okr-white-list').value = okrWhiteList.split(',').map(s => s.trim()).filter(s => s).join('\n');
        
        // AI配置
        document.getElementById('config-ai-model').value = configs['ai.model'] || '';
        document.getElementById('config-ai-api-key').value = configs['ai.api_key'] || '';
        document.getElementById('config-ai-api-base-url').value = configs['ai.api_base_url'] || '';
        document.getElementById('config-ai-temperature').value = configs['ai.temperature'] || '0.7';
        document.getElementById('config-ai-timeout').value = configs['ai.timeout'] || '60';
        
        // Prompt配置
        document.getElementById('config-ai-system-prompt').value = configs['prompts.ai_assistant_system'] || '';
        document.getElementById('config-sql-query-tool-description').value = configs['prompts.sql_query_tool_description'] || '';
        
        // 建议问题（逗号分隔转换为换行）
        const suggestedQuestions = configs['prompts.suggested_questions'] || '';
        document.getElementById('config-ai-suggested-questions').value = suggestedQuestions.split(',').map(s => s.trim()).filter(s => s).join('\n');
        
        // 整体进展和团队周报生成提示词
        document.getElementById('config-prompt-generate-overall').value = configs['prompts.generate_overall_progress'] || '';
        document.getElementById('config-prompt-generate-team-report').value = configs['prompts.generate_team_report'] || '';
        
        // QPilot配置（解析多个QPilot配置）
        const qpilotConfigs = parseQPilotConfigs(configs);
        renderQPilotConfigs(qpilotConfigs);
        
        // COS配置
        document.getElementById('config-cos-secret-id').value = configs['cos.secret_id'] || '';
        document.getElementById('config-cos-secret-key').value = configs['cos.secret_key'] || '';
        document.getElementById('config-cos-region').value = configs['cos.region'] || '';
        document.getElementById('config-cos-bucket').value = configs['cos.bucket'] || '';
        document.getElementById('config-cos-domain').value = configs['cos.domain'] || '';
        
        // 显示设置面板
        document.getElementById('settingsPanel').classList.remove('hidden');
    } catch (error) {
        console.error('打开设置失败:', error);
        showToast(error.message || '打开设置失败', 'error');
    } finally {
        hideLoading();
    }
}

// 关闭设置面板
function closeSettings() {
    document.getElementById('settingsPanel').classList.add('hidden');
}

// 切换设置Tab
function switchSettingsTab(tab) {
    // 更新导航按钮样式
    document.querySelectorAll('.settings-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(`settings-tab-${tab}`).classList.add('active');
    
    // 更新内容区
    document.querySelectorAll('.settings-content').forEach(content => {
        content.classList.add('hidden');
    });
    document.getElementById(`settings-content-${tab}`).classList.remove('hidden');
    
    // 更新标题
    const titles = {
        'basic': '基础设置',
        'access': '访问控制',
        'ai': 'AI 配置',
        'cos': 'COS设置'
    };
    document.getElementById('settingsTitle').textContent = titles[tab] || '设置';
}

// 保存设置
async function saveSettings() {
    showLoading();
    try {
        // 收集所有配置
        const configs = [
            {
                config_key: 'system.site_title',
                config_value: document.getElementById('config-site-title').value,
                description: '站点标题'
            },
            {
                config_key: 'wework_bot.webhook_url',
                config_value: document.getElementById('config-wework-webhook').value,
                description: '企微机器人Webhook地址'
            },
            {
                config_key: 'system.white_list',
                config_value: document.getElementById('config-white-list').value.split('\n').map(s => s.trim()).filter(s => s).join(','),
                description: '项目访问白名单（逗号分隔）'
            },
            {
                config_key: 'system.okr_white_list',
                config_value: document.getElementById('config-okr-white-list').value.split('\n').map(s => s.trim()).filter(s => s).join(','),
                description: 'OKR脑图访问白名单（逗号分隔）'
            },
            {
                config_key: 'ai.model',
                config_value: document.getElementById('config-ai-model').value,
                description: 'AI模型名称'
            },
            {
                config_key: 'ai.api_key',
                config_value: document.getElementById('config-ai-api-key').value,
                description: 'AI API密钥'
            },
            {
                config_key: 'ai.api_base_url',
                config_value: document.getElementById('config-ai-api-base-url').value,
                description: 'AI API基础URL'
            },
            {
                config_key: 'ai.temperature',
                config_value: document.getElementById('config-ai-temperature').value,
                description: 'AI生成温度'
            },
            {
                config_key: 'ai.timeout',
                config_value: document.getElementById('config-ai-timeout').value,
                description: 'AI请求超时时间（秒）'
            },
            {
                config_key: 'prompts.ai_assistant_system',
                config_value: document.getElementById('config-ai-system-prompt').value,
                description: 'AI助手系统提示词'
            },
            {
                config_key: 'prompts.sql_query_tool_description',
                config_value: document.getElementById('config-sql-query-tool-description').value,
                description: '数据查询技能描述'
            },
            {
                config_key: 'prompts.suggested_questions',
                config_value: document.getElementById('config-ai-suggested-questions').value.split('\n').map(s => s.trim()).filter(s => s).join(','),
                description: 'AI助手建议问题（逗号分隔）'
            },
            {
                config_key: 'prompts.generate_overall_progress',
                config_value: document.getElementById('config-prompt-generate-overall').value,
                description: '整体进展生成提示词'
            },
            {
                config_key: 'prompts.generate_team_report',
                config_value: document.getElementById('config-prompt-generate-team-report').value,
                description: '团队周报生成提示词'
            }
        ];
        
        // 收集 QPilot 配置
        const qpilotConfigs = collectQPilotConfigs();
        qpilotConfigs.forEach((qpilotConfig, index) => {
            const pilotId = (index + 1).toString();
            configs.push({
                config_key: `qpilot.pilot_${pilotId}.id`,
                config_value: qpilotConfig.pilot_id,
                description: `QPilot ${pilotId} ID`
            });
            configs.push({
                config_key: `qpilot.pilot_${pilotId}.tool_name`,
                config_value: qpilotConfig.tool_name,
                description: `QPilot ${pilotId} 工具名称`
            });
            configs.push({
                config_key: `qpilot.pilot_${pilotId}.tool_purpose`,
                config_value: qpilotConfig.tool_purpose,
                description: `QPilot ${pilotId} 工具用途`
            });
            configs.push({
                config_key: `qpilot.pilot_${pilotId}.tool_description`,
                config_value: qpilotConfig.tool_description,
                description: `QPilot ${pilotId} 工具描述`
            });
            configs.push({
                config_key: `qpilot.pilot_${pilotId}.tool_param_description`,
                config_value: qpilotConfig.tool_param_description,
                description: `QPilot ${pilotId} 工具参数描述`
            });
        });
        
        // COS配置
        configs.push(
            {
                config_key: 'cos.secret_id',
                config_value: document.getElementById('config-cos-secret-id').value,
                description: 'COS密钥ID'
            },
            {
                config_key: 'cos.secret_key',
                config_value: document.getElementById('config-cos-secret-key').value,
                description: 'COS密钥Key'
            },
            {
                config_key: 'cos.region',
                config_value: document.getElementById('config-cos-region').value,
                description: 'COS区域'
            },
            {
                config_key: 'cos.bucket',
                config_value: document.getElementById('config-cos-bucket').value,
                description: 'COS存储桶名称'
            },
            {
                config_key: 'cos.domain',
                config_value: document.getElementById('config-cos-domain').value,
                description: 'COS访问域名'
            }
        );
        
        // 提交到后端
        const response = await fetch('/api/admin/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Eng-Name': currentUser.EngName
            },
            body: JSON.stringify({ configs })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || '保存配置失败');
        }
        
        hideLoading();
        showToast('配置保存成功，重新加载配置中...', 'success');
        
        // 重新加载后端配置
        try {
            const reloadResponse = await fetch('/api/admin/reload', {
                method: 'POST',
                headers: {
                    'X-User-Eng-Name': currentUser.EngName
                }
            });
            if (reloadResponse.ok) {
                console.log('后端配置重新加载成功');
            }
        } catch (reloadError) {
            console.error('重新加载后端配置失败:', reloadError);
        }
        
        closeSettings();
        
        // 3秒后自动刷新页面
        setTimeout(() => {
            location.reload();
        }, 3000);
    } catch (error) {
        console.error('保存设置失败:', error);
        hideLoading();
        showToast(error.message || '保存设置失败', 'error');
    }
}

// ==================== QPilot 配置管理 ====================

// 解析 QPilot 配置（从 configs 对象中提取所有 qpilot.* 和工具相关配置）
function parseQPilotConfigs(configs) {
    const qpilotConfigs = [];
    
    // 获取所有 qpilot 相关的配置键
    const qpilotKeys = Object.keys(configs).filter(key => key.startsWith('qpilot.'));
    
    // 按 pilot_id 分组
    const pilotIdGroups = {};
    for (const key of qpilotKeys) {
        const match = key.match(/^qpilot\.(pilot_(\d+)\.)(.*)$/);
        if (match) {
            const prefix = match[1];
            const pilotId = match[2];
            const field = match[3];
            
            if (!pilotIdGroups[pilotId]) {
                pilotIdGroups[pilotId] = {};
            }
            pilotIdGroups[pilotId][field] = configs[key];
        }
    }
    
    // 处理旧的单一配置格式（兼容性处理）
    if (qpilotKeys.length === 0) {
        const oldPilotId = configs['qpilot.pilot_id'];
        if (oldPilotId) {
            pilotIdGroups['1'] = {
                id: oldPilotId,
                tool_name: 'query_version_info',
                tool_description: configs['prompts.version_query_tool_description'] || '',
                tool_param_description: '用户的具体查询问题，请直接传入用户的原始问题，不要改写'
            };
        }
    }
    
    // 转换为数组
    for (const pilotId in pilotIdGroups) {
        qpilotConfigs.push({
            pilotId: pilotId,
            id: pilotIdGroups[pilotId].id || '',
            tool_name: pilotIdGroups[pilotId].tool_name || '',
            tool_purpose: pilotIdGroups[pilotId].tool_purpose || '',
            version_query_tool_description: pilotIdGroups[pilotId].tool_description || pilotIdGroups[pilotId].version_query_tool_description || '',
            version_query_tool_param_description: pilotIdGroups[pilotId].tool_param_description || '用户的具体查询问题，请直接传入用户的原始问题，不要改写'
        });
    }
    
    // 如果没有配置，添加一个空的配置项
    if (qpilotConfigs.length === 0) {
        qpilotConfigs.push({
            pilotId: '1',
            id: '',
            tool_name: '',
            version_query_tool_description: '',
            version_query_tool_param_description: '用户的具体查询问题，请直接传入用户的原始问题，不要改写'
        });
    }
    
    return qpilotConfigs;
}

// 渲染 QPilot 配置列表
function renderQPilotConfigs(qpilotConfigs) {
    const container = document.getElementById('qpilotList');
    container.innerHTML = '';
    
    qpilotConfigs.forEach((config, index) => {
        const configElement = createQPilotConfigElement(config, index);
        container.appendChild(configElement);
    });
}

// 创建单个 QPilot 配置元素
function createQPilotConfigElement(config, index) {
    const div = document.createElement('div');
    div.className = 'p-4 bg-gray-50 rounded-lg border';
    div.dataset.pilotId = config.pilotId;
    
    div.innerHTML = `
        <div class="flex items-center justify-between mb-4">
            <h5 class="text-base font-medium text-gray-900">QPilot ${config.pilotId}</h5>
            <button type="button" onclick="removeQPilotConfig('${config.pilotId}')" 
                    class="text-red-500 hover:text-red-700 text-sm flex items-center space-x-1">
                <i class="fas fa-trash"></i>
                <span>删除</span>
            </button>
        </div>        
        <div class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">QPilot ID</label>
                <input type="text" 
                       id="qpilot-${config.pilotId}-id" 
                       value="${escapeHtml(config.id)}" 
                       class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" 
                       placeholder="2851">
                <p class="text-xs text-gray-500 mt-1">绑定的 QPilot Agent ID</p>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">工具名称</label>
                <input type="text" 
                       id="qpilot-${config.pilotId}-tool-name" 
                       value="${escapeHtml(config.tool_name || '')}" 
                       class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" 
                       placeholder="query_version_info">
                <p class="text-xs text-gray-500 mt-1">工具的唯一标识名称，用于 AI 调用</p>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">工具用途</label>
                <input type="text" 
                       id="qpilot-${config.pilotId}-tool-purpose" 
                       value="${escapeHtml(config.tool_purpose || '')}" 
                       class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" 
                       placeholder="查询版本信息">
                <p class="text-xs text-gray-500 mt-1">一句话描述工具的用途，用于 AI 调用时的意图识别</p>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">工具描述</label>
                <textarea id="qpilot-${config.pilotId}-tool-desc" 
                          rows="4" 
                          class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm" 
                          placeholder="查询版本信息，包括版本里程碑、版本进展、版本owner、模块负责人、版本缺陷情况等...">${escapeHtml(config.version_query_tool_description)}</textarea>
                <p class="text-xs text-gray-500 mt-1">定义工具的完整功能描述，推荐在这里给出一些问题示例</p>
            </div>
        </div>
    `;
    
    return div;
}

// 添加新的 QPilot 配置
function addQPilotConfig() {
    const container = document.getElementById('qpilotList');
    const existingConfigs = container.querySelectorAll('[data-pilot-id]');
    const newPilotId = existingConfigs.length + 1;
    
    const newConfig = {
        pilotId: newPilotId.toString(),
        id: '',
        version_query_tool_description: '',
        version_query_tool_param_description: '',
        sql_query_tool_description: ''
    };
    
    const configElement = createQPilotConfigElement(newConfig, existingConfigs.length);
    container.appendChild(configElement);
}

// 删除 QPilot 配置
function removeQPilotConfig(pilotId) {
    const element = document.querySelector(`[data-pilot-id="${pilotId}"]`);
    if (element) {
        element.remove();
    }
}

// 收集 QPilot 配置（用于保存）
function collectQPilotConfigs() {
    const configs = [];
    const container = document.getElementById('qpilotList');
    const configElements = container.querySelectorAll('[data-pilot-id]');
    
    configElements.forEach(element => {
        const pilotId = element.dataset.pilotId;
        const id = document.getElementById(`qpilot-${pilotId}-id`).value;
        
        // 只有当 ID 不为空时才保存
        if (id.trim()) {
            configs.push({
                pilot_id: id.trim(),
                tool_name: document.getElementById(`qpilot-${pilotId}-tool-name`).value.trim(),
                tool_purpose: document.getElementById(`qpilot-${pilotId}-tool-purpose`).value.trim(),
                tool_description: document.getElementById(`qpilot-${pilotId}-tool-desc`).value,
                // 参数描述固定为 hardcode 值
                tool_param_description: '用户的具体查询问题，请直接传入用户的原始问题，不要改写'
            });
        }
    });
    
    return configs;
}

// HTML 转义函数
function escapeHtml(text) {
    if (!text && text !== 0) return '';
    // 确保转换为字符串
    const str = String(text);
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ==================== 导入/导出配置功能 ====================

/**
 * 导出配置为JSON文件
 */
async function exportConfig() {
    showLoading();
    try {
        // 获取当前所有配置
        const response = await fetch('/api/admin/config', {
            headers: {
                'X-User-Eng-Name': currentUser.EngName
            }
        });
        
        if (!response.ok) {
            throw new Error('获取配置失败');
        }
        
        const data = await response.json();
        const configs = data.configs;
        
        // 创建导出数据对象
        const exportData = {
            version: '1.0',
            exportTime: new Date().toISOString(),
            exportBy: currentUser.EngName,
            configs: configs
        };
        
        // 转换为JSON字符串
        const jsonString = JSON.stringify(exportData, null, 2);
        
        // 创建Blob对象
        const blob = new Blob([jsonString], { type: 'application/json' });
        
        // 创建下载链接
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `config_export_${new Date().getTime()}.json`;
        
        // 触发下载
        document.body.appendChild(a);
        a.click();
        
        // 清理
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        hideLoading();
        showToast('配置导出成功', 'success');
    } catch (error) {
        console.error('导出配置失败:', error);
        hideLoading();
        showToast(error.message || '导出配置失败', 'error');
    }
}

/**
 * 导入配置从JSON文件
 */
async function importConfig(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // 检查文件类型
    if (!file.name.endsWith('.json')) {
        showToast('请选择JSON格式的配置文件', 'error');
        event.target.value = '';
        return;
    }
    
    showLoading();
    
    try {
        // 读取文件内容
        const fileContent = await file.text();
        const importData = JSON.parse(fileContent);
        
        // 验证数据格式
        if (!importData.configs || typeof importData.configs !== 'object') {
            throw new Error('配置文件格式不正确');
        }
        
        hideLoading();
        
        // 显示确认对话框
        const confirmed = await showImportConfirmDialog(importData);
        
        if (!confirmed) {
            event.target.value = '';
            return;
        }
        
        showLoading();
        
        // 将导入的配置转换为保存格式
        const configs = [];
        for (const [key, value] of Object.entries(importData.configs)) {
            configs.push({
                config_key: key,
                config_value: value,
                description: `导入的配置项: ${key}`
            });
        }
        
        // 提交到后端
        const response = await fetch('/api/admin/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Eng-Name': currentUser.EngName
            },
            body: JSON.stringify({ configs })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || '导入配置失败');
        }
        
        hideLoading();
        showToast('配置导入成功，重新加载配置中...', 'success');
        
        // 重新加载后端配置
        try {
            const reloadResponse = await fetch('/api/admin/reload', {
                method: 'POST',
                headers: {
                    'X-User-Eng-Name': currentUser.EngName
                }
            });
            if (reloadResponse.ok) {
                console.log('后端配置重新加载成功');
            }
        } catch (reloadError) {
            console.error('重新加载后端配置失败:', reloadError);
        }
        
        closeSettings();
        
        // 3秒后自动刷新页面
        setTimeout(() => {
            location.reload();
        }, 3000);
    } catch (error) {
        console.error('导入配置失败:', error);
        hideLoading();
        showToast(error.message || '导入配置失败', 'error');
    } finally {
        // 清空文件选择
        event.target.value = '';
    }
}

/**
 * 显示导入确认对话框
 */
function showImportConfirmDialog(importData) {
    return new Promise((resolve) => {
        // 创建对话框HTML
        const dialogHtml = `
            <div id="importConfirmDialog" class="fixed inset-0 bg-black bg-opacity-50 z-[10060] flex items-center justify-center">
                <div class="bg-white rounded-lg shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
                    <!-- 标题 -->
                    <div class="px-6 py-4 border-b flex items-center justify-between">
                        <h3 class="text-xl font-bold text-gray-900 flex items-center">
                            <i class="fas fa-exclamation-triangle text-yellow-500 mr-3"></i>
                            确认导入配置
                        </h3>
                        <button onclick="closeImportConfirmDialog(false)" class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    
                    <!-- 内容 -->
                    <div class="px-6 py-4 overflow-y-auto flex-1">
                        <div class="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <p class="text-sm text-yellow-800">
                                <i class="fas fa-info-circle mr-2"></i>
                                <strong>警告：</strong>导入配置将<strong class="text-red-600">覆盖当前已有的所有配置</strong>，此操作不可撤销！
                            </p>
                        </div>
                        
                        <div class="mb-4">
                            <h4 class="text-sm font-semibold text-gray-700 mb-2">导入信息：</h4>
                            <div class="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                                <p><span class="text-gray-600">版本：</span><span class="font-mono">${escapeHtml(importData.version || 'N/A')}</span></p>
                                <p><span class="text-gray-600">导出时间：</span><span class="font-mono">${escapeHtml(importData.exportTime || 'N/A')}</span></p>
                                <p><span class="text-gray-600">导出人：</span><span class="font-mono">${escapeHtml(importData.exportBy || 'N/A')}</span></p>
                                <p><span class="text-gray-600">配置项数量：</span><span class="font-mono">${Object.keys(importData.configs || {}).length}</span></p>
                            </div>
                        </div>
                        
                        <div>
                            <h4 class="text-sm font-semibold text-gray-700 mb-2">配置预览：</h4>
                            <div class="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                                <pre class="text-xs text-green-400 font-mono">${escapeHtml(JSON.stringify(importData.configs, null, 2))}</pre>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 按钮 -->
                    <div class="px-6 py-4 border-t flex justify-end space-x-3">
                        <button onclick="closeImportConfirmDialog(false)" class="px-6 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors">
                            取消
                        </button>
                        <button onclick="closeImportConfirmDialog(true)" class="px-6 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors">
                            确认导入
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // 添加到页面
        const dialogContainer = document.createElement('div');
        dialogContainer.innerHTML = dialogHtml;
        document.body.appendChild(dialogContainer);
        
        // 定义关闭函数
        window.closeImportConfirmDialog = (confirmed) => {
            document.body.removeChild(dialogContainer);
            delete window.closeImportConfirmDialog;
            resolve(confirmed);
        };
    });
}

/**
 * 加载系统版本信息
 */
async function loadSystemVersion() {
    try {
        const response = await fetch('/api/version');
        if (response.ok) {
            const data = await response.json();
            const versionElement = document.getElementById('systemVersion');
            if (versionElement) {
                versionElement.textContent = data.version || '未知';
            }
        } else {
            console.warn('获取版本信息失败');
            const versionElement = document.getElementById('systemVersion');
            if (versionElement) {
                versionElement.textContent = '未知';
            }
        }
    } catch (error) {
        console.error('加载版本信息失败:', error);
        const versionElement = document.getElementById('systemVersion');
        if (versionElement) {
            versionElement.textContent = '未知';
        }
    }
}