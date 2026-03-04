// ==================== 图片上传扩展功能 ====================

// 处理周进展输入框的粘贴事件
async function handleWeeklyPaste(event, krId) {
    const items = event.clipboardData?.items;
    if (!items) return;
    
    for (const item of items) {
        if (item.type.startsWith('image/')) {
            event.preventDefault();
            const file = item.getAsFile();
            if (file) {
                await uploadAndInsertImage(file, `weekly-${krId}`);
            }
            break;
        }
    }
}

// 处理周进展输入框的拖拽事件
async function handleWeeklyDrop(event, krId) {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (file.type.startsWith('image/')) {
        await uploadAndInsertImage(file, `weekly-${krId}`);
    } else {
        showToast('请拖拽图片文件', 'error');
    }
}

// 处理待办输入框的粘贴事件
async function handleTodoPaste(event, todoId) {
    const items = event.clipboardData?.items;
    if (!items) return;
    
    for (const item of items) {
        if (item.type.startsWith('image/')) {
            event.preventDefault();
            const file = item.getAsFile();
            if (file) {
                await uploadAndInsertImage(file, `todo-progress-${todoId}`);
            }
            break;
        }
    }
}

// 处理待办输入框的拖拽事件
async function handleTodoDrop(event, todoId) {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (file.type.startsWith('image/')) {
        await uploadAndInsertImage(file, `todo-progress-${todoId}`);
    } else {
        showToast('请拖拽图片文件', 'error');
    }
}

// 处理风险和问题的粘贴事件
async function handleRisksPaste(event, krId) {
    const items = event.clipboardData?.items;
    if (!items) return;
    
    for (const item of items) {
        if (item.type.startsWith('image/')) {
            event.preventDefault();
            const file = item.getAsFile();
            if (file) {
                await uploadAndInsertImage(file, `risks-${krId}`);
            }
            break;
        }
    }
}

// 处理风险和问题的拖拽事件
async function handleRisksDrop(event, krId) {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (file.type.startsWith('image/')) {
        await uploadAndInsertImage(file, `risks-${krId}`);
    } else {
        showToast('请拖拽图片文件', 'error');
    }
}

// 处理下周计划的粘贴事件
async function handleNextWeekPaste(event, krId) {
    const items = event.clipboardData?.items;
    if (!items) return;
    
    for (const item of items) {
        if (item.type.startsWith('image/')) {
            event.preventDefault();
            const file = item.getAsFile();
            if (file) {
                await uploadAndInsertImage(file, `next-week-${krId}`);
            }
            break;
        }
    }
}

// 处理下周计划的拖拽事件
async function handleNextWeekDrop(event, krId) {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (file.type.startsWith('image/')) {
        await uploadAndInsertImage(file, `next-week-${krId}`);
    } else {
        showToast('请拖拽图片文件', 'error');
    }
}

// 上传图片并插入到指定元素
async function uploadAndInsertImage(file, targetId) {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
    if (!allowedTypes.includes(file.type)) {
        showToast('不支持的图片格式，请上传jpg、png、gif、webp或bmp格式的图片', 'error');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
        showToast('图片大小不能超过5MB', 'error');
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
        
        const textarea = document.getElementById(targetId);
        if (textarea) {
            const startPos = textarea.selectionStart;
            const endPos = textarea.selectionEnd;
            const textBefore = textarea.value.substring(0, startPos);
            const textAfter = textarea.value.substring(endPos, textarea.value.length);
            
            const imageMarkdown = `\\n![图片描述](${data.url})\\n`;
            
            textarea.value = textBefore + imageMarkdown + textAfter;
            
            textarea.selectionStart = textarea.selectionEnd = startPos + imageMarkdown.length;
            textarea.focus();
        }
        
        showToast('图片上传成功', 'success');
    } catch (error) {
        console.error('图片上传失败:', error);
        showToast(error.message || '图片上传失败', 'error');
    } finally {
        hideLoading();
    }
}

// 处理图片点击放大
function handleImageClick(event) {
    if (event.target.tagName === 'IMG') {
        openImageModal(event.target.src);
    }
}

// 打开图片放大模态框
function openImageModal(imageSrc) {
    // 创建或更新图片模态框
    let imageModal = document.getElementById('imageModal');
    if (!imageModal) {
        imageModal = document.createElement('div');
        imageModal.id = 'imageModal';
        imageModal.className = 'modal';
        imageModal.innerHTML = `
            <div class="relative max-w-5xl max-h-screen mx-4">
                <button onclick="closeImageModal()" 
                        class="absolute -top-10 right-0 text-white text-2xl hover:text-gray-300 z-10">
                    <i class="fas fa-times"></i>
                </button>
                <img id="imageModalImg" src="" alt="放大图片" 
                     class="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl">
            </div>
        `;
        imageModal.addEventListener('click', (e) => {
            if (e.target === imageModal) {
                closeImageModal();
            }
        });
        document.body.appendChild(imageModal);
    }
    
    const imageModalImg = document.getElementById('imageModalImg');
    if (imageModalImg) {
        imageModalImg.src = imageSrc;
    }
    imageModal.classList.add('active');
}

// 关闭图片模态框
function closeImageModal() {
    const imageModal = document.getElementById('imageModal');
    if (imageModal) {
        imageModal.classList.remove('active');
    }
}