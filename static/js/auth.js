// ==================== 用户认证和信息 ====================

// 加载用户信息
async function loadUserInfo() {
    try {
        // 尝试调用企微认证接口（仅限前端调用）
        let response;
        try {
            response = await fetch('/ts:auth/tauth/info.ashx', {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            // 检查响应状态
            if (!response.ok) {
                console.log(`企微认证接口返回 ${response.status}，使用模拟数据`);
                response = null;
            }
        } catch (fetchError) {
            // 如果接口不可用，使用模拟数据（用于预览环境）
            console.warn('企微认证接口不可用（可能不在企微环境中），使用模拟数据:', fetchError.message);
            response = null;
        }
        
        if (response && response.ok) {
            currentUser = await response.json();
        } else {
            // 使用模拟用户数据（用于预览和测试）
            console.log('使用模拟用户数据');
            currentUser = {
                EngName: 'jeff dean',
                ChnName: '杰夫',
                DeptNameString: '产品部',
                WorkPlaceID: 1,
                PositionName: '产品经理'
            };
        }
        
        // 验证必要字段
        if (!currentUser.EngName || !currentUser.ChnName) {
            throw new Error('用户信息不完整');
        }
        
        // 白名单鉴权
        const userDept = currentUser.DeptNameString || '';
        let isAuthorized = false;

        // 如果完整功能白名单为空，则允许所有用户获得完整功能访问
        if (!window.WHITE_LIST || window.WHITE_LIST.length === 0) {
            isAuthorized = true;
            console.log('完整功能白名单为空，所有用户获得完整功能权限');
        } else {
            // 检查用户的部门是否在白名单中（白名单中的任一字符串是用户部门的子串，或者等于英文名）
            for (const whitelistItem of window.WHITE_LIST) {
                if (whitelistItem && userDept.includes(whitelistItem) || currentUser.EngName === whitelistItem) {
                    isAuthorized = true;
                    console.log(`用户部门 "${userDept}" 匹配白名单项 "${whitelistItem}"，鉴权通过`);
                    break;
                }
            }
        }
        
        // 如果不在完整功能白名单中，检查是否匹配 OKR 脑图白名单（受限模式）
        if (!isAuthorized) {
            // 如果 OKR 脑图白名单为空，则所有用户都能看到脑图（进入受限模式）
            if (!window.OKR_WHITE_LIST || window.OKR_WHITE_LIST.length === 0) {
                window.isRestrictedMode = true;
                console.log('OKR脑图白名单为空，所有用户均可查看脑图（受限模式）');
            } else {
                // 检查是否在 OKR 脑图白名单中
                for (const okrWhiteItem of window.OKR_WHITE_LIST) {
                    if (okrWhiteItem && userDept.includes(okrWhiteItem) || currentUser.EngName === okrWhiteItem) {
                        window.isRestrictedMode = true;
                        console.log(`用户部门 "${userDept}" 匹配OKR受限白名单项 "${okrWhiteItem}"，进入受限模式`);
                        break;
                    }
                }
            }
        }
        
        // 如果既不在完整功能白名单，也不在 OKR 脑图白名单（且白名单不为空），则拒绝访问
        if (!isAuthorized && !window.isRestrictedMode) {
            const authError = new Error('您的部门不在系统白名单中，无权访问此系统');
            authError.isAuthError = true;
            authError.userDept = userDept;
            throw authError;
        }
        
        document.getElementById('userName').textContent = `${currentUser.EngName}(${currentUser.ChnName})`;
        document.getElementById('userAvatar').src = `https://r.hrc.woa.com/photo/150/${currentUser.EngName}.png?default_when_absent=true`;
        
        // 如果是Leader，显示添加按钮和设置按钮
        if (currentUser.EngName === window.LEADER) {
            const addObjectiveBtn = document.getElementById('addObjectiveBtn');
            if (addObjectiveBtn) {
                addObjectiveBtn.classList.remove('hidden');
            }
            
            // 显示设置按钮
            const settingsBtn = document.getElementById('settingsBtn');
            if (settingsBtn) {
                settingsBtn.classList.remove('hidden');
            }
        }
    } catch (error) {
        console.error('认证失败:', error);
        
        // 判断是否是白名单鉴权失败
        const isWhitelistError = error.isAuthError && error.userDept !== undefined;
        
        // 显示认证失败页面，阻止访问
        document.body.innerHTML = `
            <div class="min-h-screen bg-gray-50 flex items-center justify-center px-4">
                <div class="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
                    <div class="mb-6">
                        <svg class="mx-auto h-16 w-16 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                        </svg>
                    </div>
                    <h1 class="text-2xl font-bold text-gray-900 mb-4">${isWhitelistError ? '权限不足' : '认证失败'}</h1>
                    <p class="text-gray-600 mb-6">
                        ${isWhitelistError ? 
                            `您的部门「${escapeHtml(error.userDept)}」不在系统白名单中，无法访问此系统。<br><br>如需申请访问权限，请联系：<br><strong class="text-purple-600">${escapeHtml(window.LEADER)}</strong>` :
                            `无法获取您的企业微信认证信息，请确保：<br>
                            1. 您已登录企业微信<br>
                            2. 您有权限访问此系统<br>
                            3. 网络连接正常`
                        }
                    </p>
                    ${isWhitelistError ? `` : `
                        <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                            <p class="text-sm text-red-800">
                                <strong>错误详情：</strong><br>
                                ${escapeHtml(error.message)}
                            </p>
                        </div>
                    `}
                    <button onclick="location.reload()" 
                            class="w-full bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition">
                        重新加载
                    </button>
                </div>
            </div>
        `;
        
        // 阻止后续代码执行
        throw error;
    }
}