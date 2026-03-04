// ==================== 导出HTML文档功能 ====================

// 辅助函数：检查进展是否在7天内更新过
function isProgressUpdatedInLast7Days(progressItem) {
    if (!progressItem) return false;
    
    // 检查本周进展时间
    const weeklyTime = progressItem.weekly_time;
    if (weeklyTime) {
        const weeklyDate = new Date(weeklyTime);
        const now = new Date();
        const diffDays = (now - weeklyDate) / (1000 * 60 * 60 * 24);
        if (diffDays <= 7) return true;
    }
    
    // 检查整体进展时间
    const overallTime = progressItem.overall_time;
    if (overallTime) {
        const overallDate = new Date(overallTime);
        const now = new Date();
        const diffDays = (now - overallDate) / (1000 * 60 * 60 * 24);
        if (diffDays <= 7) return true;
    }
    
    // 检查下周计划时间
    const nextWeekTime = progressItem.next_week_time;
    if (nextWeekTime) {
        const nextWeekDate = new Date(nextWeekTime);
        const now = new Date();
        const diffDays = (now - nextWeekDate) / (1000 * 60 * 60 * 24);
        if (diffDays <= 7) return true;
    }
    
    return false;
}

async function exportToHtml() {
    if (!teamObjectivesData || teamObjectivesData.length === 0) {
        showToast('暂无数据可导出', 'error');
        return;
    }
    
    showLoading();
    
    try {
        // 获取所有成员进展数据
        const progressResponse = await fetch('/api/progress/team-summary');
        let progressData = { summary: [] };
        if (progressResponse.ok) {
            progressData = await progressResponse.json();
        }
        
        console.log('进展数据:', progressData);
        
        // 创建进展数据映射（按团队KR标题分组，因为个人KR和团队KR通过标题关联）
        const progressByKRTitle = new Map();
        if (progressData.summary) {
            progressData.summary.forEach(item => {
                const krTitle = item.kr_title;
                if (!progressByKRTitle.has(krTitle)) {
                    progressByKRTitle.set(krTitle, []);
                }
                progressByKRTitle.get(krTitle).push(item);
            });
        }
        
        console.log('按KR标题分组的进展:', progressByKRTitle);
        
        // 生成时间
        const now = new Date();
        const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
        
        // 构建HTML内容
        let htmlContent = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>团队OKR报告</title>
    <style>
        * { box-sizing: border-box; }
        body { font-family: '微软雅黑', 'Microsoft YaHei', Arial, sans-serif; line-height: 1.6; margin: 20px; padding: 0; color: #333; }
        .container { max-width: 1200px; margin: 0 auto; padding: 40px; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        h1 { text-align: center; color: #0052D9; font-size: 24px; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 3px solid #0052D9; }
        h2 { color: #333; font-size: 18px; margin-top: 30px; margin-bottom: 15px; border-bottom: 2px solid #0052D9; padding-bottom: 8px; }
        h3 { color: #555; font-size: 16px; margin-top: 25px; margin-bottom: 12px; }
        .meta { text-align: center; color: #666; margin-bottom: 30px; font-size: 14px; padding: 10px; background: #f5f5f5; border-radius: 4px; }
        .info { color: #666; margin-bottom: 10px; font-size: 14px; padding: 8px 12px; background: #f9f9f9; border-left: 4px solid #0052D9; }
        .claim { color: #22C55E; font-weight: bold; margin-bottom: 12px; font-size: 14px; padding: 8px 12px; background: #f0fdf4; border-radius: 4px; display: inline-block; }
        .progress-section { margin-left: 20px; margin-bottom: 20px; padding: 15px; background: #fafafa; border-radius: 6px; border: 1px solid #e5e5e5; }
        .member-name { font-weight: bold; margin-top: 12px; font-size: 15px; color: #1f2937; }
        .progress-label { font-weight: bold; color: #555; margin-top: 10px; margin-bottom: 8px; font-size: 14px; }
        .progress-content { margin-left: 15px; margin-bottom: 12px; font-size: 14px; line-height: 1.8; color: #374151; }
        .progress-content p { margin: 8px 0; }
        .progress-content h1 { font-size: 18px; font-weight: bold; margin: 10px 0 5px 0; color: #1f2937; }
        .progress-content h2 { font-size: 16px; font-weight: bold; margin: 10px 0 5px 0; color: #374151; }
        .progress-content h3 { font-size: 15px; font-weight: bold; margin: 8px 0 4px 0; color: #4b5563; }
        .progress-content ul, .progress-content ol { margin: 8px 0; padding-left: 25px; }
        .progress-content ul li, .progress-content ol li { margin: 5px 0; line-height: 1.6; }
        .progress-content ul { list-style-type: disc; }
        .progress-content ol { list-style-type: decimal; }
        .progress-content code { background-color: #f3f4f6; padding: 2px 6px; border-radius: 3px; font-family: 'Courier New', monospace; font-size: 13px; color: #ef4444; }
        .progress-content pre { background-color: #f3f4f6; padding: 12px; border-radius: 4px; overflow-x: auto; margin: 10px 0; border: 1px solid #e5e5e5; }
        .progress-content pre code { background: none; padding: 0; color: #1f2937; }
        .progress-content blockquote { border-left: 4px solid #d1d5db; padding-left: 15px; margin: 10px 0; color: #6b7280; font-style: italic; background: #f9f9f9; padding: 10px 15px; }
        .progress-content a { color: #0052D9; text-decoration: underline; }
        .progress-content a:hover { color: #003db8; }
        .progress-content strong { font-weight: bold; color: #1f2937; }
        .progress-content em { font-style: italic; color: #4b5563; }
        .progress-content img { max-width: 100%; height: auto; margin: 15px 0; display: block; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .progress-content table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 14px; }
        .progress-content table th, .progress-content table td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
        .progress-content table th { background-color: #f5f5f5; font-weight: bold; color: #333; }
        .progress-content table tr:nth-child(even) { background-color: #f9f9f9; }
        .progress-content table tr:hover { background-color: #f0f0f0; }
        .no-data { color: #999; font-style: italic; font-size: 14px; padding: 20px; text-align: center; background: #f9f9f9; border-radius: 4px; }
        ul, ol { margin-left: 20px; }
        table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 14px; }
        th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
        th { background-color: #f5f5f5; font-weight: bold; color: #333; }
        hr { border: none; border-top: 2px solid #e5e5e5; margin: 20px 0; }
        @media print {
            body { margin: 0; }
            .container { box-shadow: none; padding: 20px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>团队OKR报告</h1>
        <div class="meta">生成时间：${dateStr}</div>
`;
        
        // 遍历所有Objective
        teamObjectivesData.forEach((obj, objIndex) => {
            htmlContent += `
        <h2>O${objIndex + 1}: ${escapeHtml(obj.title)}</h2>
        <div class="info">类型：${escapeHtml(obj.obj_type || '业务')} | 权重：${obj.weight || 0}%</div>
`;
            
            // 遍历Key Results（只导出有进展记录的KR）
            if (obj.key_results && obj.key_results.length > 0) {
                // 过滤出有进展记录的KR（支持多个认领人）
                const krsWithProgress = [];
                obj.key_results.forEach(kr => {
                    const krProgress = progressByKRTitle.get(kr.title) || [];
                    if (krProgress.length > 0) {
                        krsWithProgress.push({
                            ...kr,
                            progress: krProgress
                        });
                    }
                });
                
                if (krsWithProgress.length > 0) {
                    krsWithProgress.forEach((kr, krIndex) => {
                        htmlContent += `
        <h3>KR${krIndex + 1}: ${escapeHtml(kr.title)}</h3>
`;
                        
                        // KR认领信息（支持多个认领人）
                        if (kr.claimers && kr.claimers.length > 0) {
                            htmlContent += `
        <div class="claim">认领人：${kr.claimers.map(c => `${escapeHtml(c.user_eng_name)}(${escapeHtml(c.user_chn_name)})`).join('、')}</div>
`;
                        }
                        
                        htmlContent += `
        <div class="progress-section">
            <div style="font-weight: bold; margin-bottom: 12px; font-size: 14px; color: #333;">成员进展：</div>
`;
                        
                        // 按成员分组显示进展（过滤出7天内有更新的成员）
                        const memberProgressMap = new Map();
                        kr.progress.forEach(p => {
                            // 只包含7天内有更新的成员进展
                            if (isProgressUpdatedInLast7Days(p)) {
                                const key = `${p.user_eng_name}(${p.user_chn_name})`;
                                if (!memberProgressMap.has(key)) {
                                    memberProgressMap.set(key, p);
                                }
                            }
                        });
                        
                        if (memberProgressMap.size === 0) {
                            // 如果没有7天内有更新的成员进展，显示提示信息
                            htmlContent += `
            <div class="no-data">最近7天内没有成员更新进展</div>
`;
                        } else {
                            memberProgressMap.forEach((progress, memberName) => {
                                htmlContent += `
            <div class="member-name">• ${escapeHtml(memberName)}</div>
`;
                                
                                // 本周进展
                                if (progress.weekly_content) {
                                    const weeklyHtml = marked.parse(progress.weekly_content);
                                    htmlContent += `
            <div class="progress-label">本周进展：</div>
            <div class="progress-content">${weeklyHtml}</div>
`;
                                }
                                
                                // 整体进展
                                if (progress.overall_content) {
                                    const overallHtml = marked.parse(progress.overall_content);
                                    htmlContent += `
            <div class="progress-label">整体进展：</div>
            <div class="progress-content">${overallHtml}</div>
`;
                                }
                                
                                // 下周计划
                                if (progress.next_week_content) {
                                    const nextWeekHtml = marked.parse(progress.next_week_content);
                                    htmlContent += `
            <div class="progress-label">下周计划：</div>
            <div class="progress-content">${nextWeekHtml}</div>
`;
                                }
                            });
                        }
                        
                        htmlContent += `
        </div>
`;
                    });
                } else {
                    htmlContent += `
        <div class="no-data">暂无有进展记录的Key Results</div>
`;
                }
            } else {
                htmlContent += `
        <div class="no-data">暂无Key Results</div>
`;
            }
        });
        
        htmlContent += `
    </div>
</body>
</html>`;
        
        // 创建Blob并下载
        const blob = new Blob([htmlContent], {
            type: 'text/html;charset=utf-8'
        });
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `团队OKR报告_${dateStr}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showToast('导出成功', 'success');
    } catch (error) {
        console.error('导出HTML失败:', error);
        console.error('错误详情:', error.message, error.stack);
        showToast('导出失败: ' + (error.message || '未知错误'), 'error');
    } finally {
        hideLoading();
    }
}

// 保留向后兼容的别名
const exportToWord = exportToHtml;

// 辅助函数：将Markdown转换为纯文本
function stripMarkdown(markdown) {
    if (!markdown) return '';
    
    let text = markdown;
    
    // 移除图片
    text = text.replace(/!\[([^\]]*)\]\([^\)]+\)/g, '[图片]');
    
    // 移除链接，保留文本
    text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
    
    // 移除标题标记
    text = text.replace(/^#{1,6}\s+/gm, '');
    
    // 移除粗体和斜体
    text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
    text = text.replace(/(\*|_)(.*?)\1/g, '$2');
    
    // 移除代码块
    text = text.replace(/`([^`]+)`/g, '$1');
    
    // 移除列表标记
    text = text.replace(/^[\*\-\+]\s+/gm, '• ');
    text = text.replace(/^\d+\.\s+/gm, '');
    
    // 移除引用标记
    text = text.replace(/^>\s+/gm, '');
    
    // 移除水平线
    text = text.replace(/^[\-\*_]{3,}$/gm, '');
    
    // 清理多余的空行
    text = text.replace(/\n{3,}/g, '\n\n');
    
    return text.trim();
}