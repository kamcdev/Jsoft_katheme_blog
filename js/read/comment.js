class CommentSystem {
    constructor() {
        this.articleId = '';
        
        this.init();
    }
    
    async init() {
        this.articleId = document.getElementById('article-id')?.value || '';
        
        this.initEventListeners();
        
        await this.loadComments();
    }
    
    initEventListeners() {
        const commentForm = document.getElementById('comment-form');
        if (commentForm) {
            commentForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleCommentSubmit();
            });
        }
    }
    
    maskEmail(email) {
        if (!email || email.indexOf('@') === -1) return email;
        const localPart = email.split('@')[0];
        const domain = email.split('@')[1];
        if (localPart.length <= 2) return email;
        return localPart.substring(0, 2) + '*'.repeat(localPart.length - 2) + '@' + domain;
    }
    
    isSinglePunctuation(text) {
        if (!text || text.length !== 1) return false;
        
        const punctuationChars = '.,!?;:\'\"-()[]{}<>@#$%^&*~`|\\/+=_' +
            '。，！？；：""\'\'《》【】（）…—～·、' +
            '·※◎■□★☆●○◆◇△▽▼↑←→↘↙♠♣♥♦' +
            '＃￥％＆＊＋－＝＠＾＿｀｜＼／' +
            '〜～￣＿﹏﹋﹌﹍﹎﹏' +
            ' \t\r\n';
        
        return punctuationChars.includes(text);
    }
    
    async handleCommentSubmit() {
        const commentForm = document.getElementById('comment-form');
        const submitBtn = commentForm?.querySelector('.comment-submit-btn');
        const textarea = commentForm?.querySelector('.comment-input');
        
        if (!commentForm) return;
        
        const formData = new FormData(commentForm);
        const content = formData.get('content');
        const email = formData.get('email');
        const avatar_url = formData.get('avatar_url');
        
        if (!content || content.trim().length === 0) {
            this.showMessage('评论内容不能为空', 'error');
            return;
        }

        if (this.isSinglePunctuation(content.trim())) {
            this.showMessage('不可发送单个标点符号', 'error');
            return;
        }
        
        if (content.length > 1000) {
            this.showMessage('评论内容过长，请控制在1000字以内', 'error');
            return;
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
            this.showMessage('请输入有效的邮箱地址', 'error');
            return;
        }
        
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = '发送中...';
        }
        
        try {
            const response = await fetch('/api/comment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    article_id: this.articleId,
                    content: content,
                    email: email,
                    avatar_url: avatar_url || null,
                    is_anonymous: true
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showMessage('评论发表成功', 'success');
                
                if (textarea) {
                    textarea.value = '';
                }
                
                await this.loadComments();
            } else {
                this.showMessage(data.message || '评论发表失败', 'error');
            }
        } catch (error) {
            console.error('发表评论失败:', error);
            this.showMessage('网络错误，请稍后重试', 'error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = '发送评论';
            }
        }
    }

    sortComments(comments) {
        if (!comments || comments.length === 0) return comments;
        
        return comments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    async loadComments() {
        const commentList = document.getElementById('comment-list');
        if (!commentList || !this.articleId) return;
        
        try {
            const response = await fetch(`/api/comments/${this.articleId}`, {
                method: 'GET',
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP错误: ${response.status}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('服务器返回了非JSON响应');
            }
            
            const data = await response.json();
            
            if (data.success) {
                const sortedComments = this.sortComments(data.comments);
                this.renderComments(sortedComments);
            } else {
                console.error('获取评论失败:', data.message);
                commentList.innerHTML = '<p style="text-align: center; color: rgba(255,255,255,0.6);">加载评论失败</p>';
            }
        } catch (error) {
            console.error('获取评论失败:', error);
            commentList.innerHTML = '<p style="text-align: center; color: rgba(255,255,255,0.6);">网络错误，请刷新页面重试</p>';
        }
    }
    
    renderComments(comments) {
        const commentList = document.getElementById('comment-list');
        if (!commentList) return;
        
        if (comments.length === 0) {
            commentList.innerHTML = '<p style="text-align: center; color: rgba(255,255,255,0.6);">暂无评论，快来发表第一条评论吧！</p>';
            return;
        }
        
        const commentsHTML = comments.map(comment => {
            const isAnonymous = comment.user_id && comment.user_id.startsWith('anonymous#');
            const avatarUrl = comment.avatar_url || '/css/all/default-avatar.svg';
            const displayName = isAnonymous ? this.maskEmail(comment.username) : this.escapeHtml(comment.username);

            return `<div class="comment-item" data-comment-id="${comment.id}" data-user-id="${comment.user_id}">
<div class="comment-header">
<div class="comment-avatar">
<img src="${avatarUrl}" alt="${displayName}" onerror="this.src='/css/all/default-avatar.svg'">
</div>
<div class="comment-info">
<span class="comment-author">${displayName}</span>
<span class="comment-time">${this.formatTime(comment.created_at)}</span>
</div>
</div>
<div class="comment-content-wrapper">
<div class="comment-content">${this.formatCommentContent(comment.content)}</div>
<div class="comment-expand-btn" style="display: none;">
<span class="expand-text">展开</span>
<span class="collapse-text" style="display: none;">收起</span>
</div>
</div>
</div>`;
        }).join('');
        
        commentList.innerHTML = commentsHTML;
        
        this.initCommentExpand();
    }
    
    initCommentExpand() {
        const commentItems = document.querySelectorAll('.comment-item');
        
        commentItems.forEach(commentItem => {
            const contentWrapper = commentItem.querySelector('.comment-content-wrapper');
            const contentElement = commentItem.querySelector('.comment-content');
            const expandBtn = commentItem.querySelector('.comment-expand-btn');
            const expandText = commentItem.querySelector('.expand-text');
            const collapseText = commentItem.querySelector('.collapse-text');
            
            if (!contentWrapper || !contentElement || !expandBtn) return;
            
            setTimeout(() => {
                this.checkContentOverflow(contentElement, expandBtn, expandText, collapseText);
            }, 100);
            
            expandBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleCommentExpand(contentWrapper, expandText, collapseText);
            });
        });
    }
    
    checkContentOverflow(contentElement, expandBtn, expandText, collapseText) {
        const contentHeight = contentElement.scrollHeight;
        const lineHeight = parseInt(getComputedStyle(contentElement).lineHeight);
        const maxHeight = lineHeight * 2;
        
        const tolerance = 2;
        
        if (contentHeight > maxHeight + tolerance) {
            expandBtn.style.display = 'flex';
            expandText.style.display = 'inline';
            collapseText.style.display = 'none';
            
            contentElement.style.maxHeight = maxHeight + 'px';
            contentElement.style.overflow = 'hidden';
        } else {
            expandBtn.style.display = 'none';
            contentElement.style.maxHeight = 'none';
            contentElement.style.overflow = 'visible';
        }
    }
    
    toggleCommentExpand(contentWrapper, expandText, collapseText) {
        const contentElement = contentWrapper.querySelector('.comment-content');
        const expandBtn = contentWrapper.querySelector('.comment-expand-btn');
        
        if (!contentElement || !expandBtn) return;
        
        const isExpanded = contentElement.style.maxHeight === 'none';
        
        expandBtn.style.pointerEvents = 'none';
        
        if (isExpanded) {
            const lineHeight = parseInt(getComputedStyle(contentElement).lineHeight);
            const maxHeight = lineHeight * 2;
            
            const currentHeight = contentElement.scrollHeight;
            contentElement.style.maxHeight = currentHeight + 'px';
            
            contentElement.offsetHeight;
            
            contentElement.style.maxHeight = maxHeight + 'px';
            expandText.style.display = 'inline';
            collapseText.style.display = 'none';
            
            setTimeout(() => {
                expandBtn.style.pointerEvents = 'auto';
            }, 300);
        } else {
            const fullHeight = contentElement.scrollHeight;
            contentElement.style.maxHeight = fullHeight + 'px';
            
            setTimeout(() => {
                contentElement.style.maxHeight = 'none';
                expandText.style.display = 'none';
                collapseText.style.display = 'inline';
                expandBtn.style.pointerEvents = 'auto';
            }, 300);
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    formatCommentContent(content) {
        const escapedContent = this.escapeHtml(content);
        
        return escapedContent
            .replace(/\r\n|\r|\n/g, '<br>')
            .replace(/<br><br>/g, '<br><br>');
    }
    
    formatTime(timestamp) {
        const date = new Date(timestamp);
        
        if (isNaN(date.getTime())) {
            console.warn('无效的时间戳:', timestamp);
            return timestamp;
        }
        
        const now = new Date();
        const diff = now - date;
        
        if (diff < 0) {
            return date.toLocaleDateString('zh-CN');
        } else if (diff < 60000) {
            return '刚刚';
        } else if (diff < 3600000) {
            return Math.floor(diff / 60000) + '分钟前';
        } else if (diff < 86400000) {
            return Math.floor(diff / 3600000) + '小时前';
        } else if (diff < 604800000) {
            return Math.floor(diff / 86400000) + '天前';
        } else {
            return date.toLocaleDateString('zh-CN');
        }
    }
    
    showMessage(message, type = 'info') {
        const messageEl = document.createElement('div');
        messageEl.className = `comment-message comment-message-${type}`;
        messageEl.textContent = message;

        const existingMessages = document.querySelectorAll('.comment-message');
        
        let topPosition = 20;
        
        if (existingMessages.length > 0) {
            const lastMessage = existingMessages[existingMessages.length - 1];
            const lastRect = lastMessage.getBoundingClientRect();
            topPosition = lastRect.bottom + 10;
        }

        messageEl.style.cssText = `
            position: fixed;
            top: ${topPosition}px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 6px;
            color: white;
            font-size: 14px;
            z-index: 2000;
            max-width: 300px;
            word-wrap: break-word;
            animation: slideIn 0.3s ease;
        `;
        
        if (type === 'success') {
            messageEl.style.backgroundColor = 'rgba(76, 175, 80, 0.9)';
        } else if (type === 'error') {
            messageEl.style.backgroundColor = 'rgba(244, 67, 54, 0.9)';
        } else {
            messageEl.style.backgroundColor = 'rgba(33, 150, 243, 0.9)';
        }
        
        document.body.appendChild(messageEl);
        
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => {
                    if (messageEl.parentNode) {
                        messageEl.parentNode.removeChild(messageEl);
                        this.repositionRemainingMessages();
                    }
                }, 300);
            }
        }, 3000);
    }

    repositionRemainingMessages() {
        const remainingMessages = document.querySelectorAll('.comment-message');
        
        if (remainingMessages.length === 0) return;

        let currentTop = 20;

        remainingMessages.forEach((msg) => {
            msg.style.top = currentTop + 'px';
            const rect = msg.getBoundingClientRect();
            currentTop = rect.bottom + 10;
        });
    }
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', () => {
    new CommentSystem();
});
