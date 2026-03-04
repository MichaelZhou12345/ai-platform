// ==================== 图片上传相关 ====================

function openImageUpload(targetId) {
    currentImageUploadTarget = targetId;
    const fileInput = document.getElementById('imageUploadInput');
    if (fileInput) {
        fileInput.click();
    }
}

async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
    if (!allowedTypes.includes(file.type)) {
        showToast('不支持的图片格式，请上传jpg、png、gif、webp或bmp格式的图片', 'error');
        event.target.value = '';
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
        showToast('图片大小不能超过5MB', 'error');
        event.target.value = '';
        return;
    }
    
    showLoading();
    
    try {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || '上传失败');
        }
        
        const data = await response.json();
        
        if (currentImageUploadTarget) {
            const textarea = document.getElementById(currentImageUploadTarget);
            if (textarea) {
                const startPos = textarea.selectionStart;
                const endPos = textarea.selectionEnd;
                const textBefore = textarea.value.substring(0, startPos);
                const textAfter = textarea.value.substring(endPos, textarea.value.length);
                
                const imageMarkdown = `
![图片描述](${data.url})
`;
                
                textarea.value = textBefore + imageMarkdown + textAfter;
                
                textarea.selectionStart = textarea.selectionEnd = startPos + imageMarkdown.length;
                textarea.focus();
            }
        }
        
        showToast('图片上传成功', 'success');
    } catch (error) {
        console.error('图片上传失败:', error);
        showToast(error.message || '图片上传失败', 'error');
    } finally {
        hideLoading();
        event.target.value = '';
    }
}

