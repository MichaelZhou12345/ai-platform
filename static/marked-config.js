// ==================== Marked.js 配置文件 ====================
// 此文件必须在所有使用marked的JS文件之前加载

// 配置marked.js，让所有链接都在新标签页打开，图片使用绝对地址，支持多级列表
if (typeof marked !== 'undefined') {
    // 设置全局选项
    marked.setOptions({
        // 启用 GFM（GitHub Flavored Markdown）扩展
        gfm: true,
        // 启用换行符转换
        breaks: true,
        // 启用 pedantic 模式以更好地处理列表
        pedantic: false,
    });
    
    // 自定义渲染器
    marked.use({
        renderer: {
            link({ href, title, text }) {
                // 确保 title 参数被正确处理，避免 undefined
                const titleAttr = title ? ` title="${title}"` : '';
                
                // 如果链接没有标题文本，使用"链接"作为兜底
                const displayText = text && text.trim() ? text : '链接';
                
                // 判断是否为页内锚点链接（TOC）
                if (href && href.startsWith('#')) {
                    // 页内锚点链接：保持页内跳转，不打开半屏面板
                    return `<a href="${href}"${titleAttr} class="text-blue-600 hover:text-blue-800">${displayText}</a>`;
                }
                
                // 判断链接类型并添加相应的图标
                let icon = '';
                if (href && href.startsWith('https://doc.weixin.qq.com')) {
                    // 微信文档链接 - 使用 office 图标
                    icon = '<i class="far fa-file-word mr-1"></i>';
                } else {
                    // 其他链接 - 使用链接图标
                    icon = '<span class="mr-1">🔗</span>';
                }
                
                return `<a href="${href}" target="_blank" rel="noopener noreferrer"${titleAttr}>${icon}${displayText}</a>`;
            },
            image({ href, title, text }) {
                // 图片直接使用提供的href（可以是绝对路径或相对路径）
                const imageSrc = href || '';
                const titleAttr = title ? ` title="${title}"` : '';
                const altAttr = text ? ` alt="${text}"` : ' alt="图片"';
                return `<img src="${imageSrc}"${altAttr}${titleAttr} style="max-width: 100%; height: auto;">`;
            }
        }
    });
}
