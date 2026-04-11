// 外部链接跳转安全警告
(function() {
    'use strict';
    
    // 友链域名列表（从后端获取）
    let friendlyDomains = [];
    
    // 获取当前网站域名
    const currentDomain = window.location.hostname;
    
    // 创建模态框HTML
    function createModalHTML(targetUrl, isFriendly) {
        const modalId = 'external-link-warning-modal';
        const modalHTML = `
            <div id="${modalId}" class="external-link-modal" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                font-family: Arial, sans-serif;
                opacity: 0;
                transition: opacity 0.5s ease;
                overflow: hidden;
            ">
                <div class="modal-content" style="
                    background-color: #1a1a1a;
                    border-radius: 10px;
                    padding: 25px;
                    max-width: 500px;
                    width: 90%;
                    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.5);
                    transform: scale(0.9);
                    transition: transform 0.5s ease;
                    user-select: none;
                    -webkit-user-select: none;
                    -moz-user-select: none;
                    -ms-user-select: none;
                ">
                    <h2 style="
                        color: #ff4444;
                        margin: 0 0 15px 0;
                        font-size: 20px;
                        text-align: center;
                        user-select: none;
                        -webkit-user-select: none;
                        -moz-user-select: none;
                        -ms-user-select: none;
                    ">安全警告</h2>
                    
                    <div style="color: white; margin-bottom: 20px; line-height: 1.5; user-select: none; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none;">
                        <div>即将跳转至外部网站</div>
                        <div style="word-break: break-all; margin: 10px 0; font-size: 14px; color: #ccc;">${targetUrl}</div>
                        <div class="verification-status" style="
                            padding: 8px 12px;
                            border-radius: 5px;
                            margin: 10px 0;
                            font-weight: bold;
                            user-select: none;
                            -webkit-user-select: none;
                            -moz-user-select: none;
                            -ms-user-select: none;
                            ${isFriendly ? 
                                'background-color: #4CAF50; color: white;' : 
                                'background-color: #FF9800; color: white;'
                            }
                        ">
                            ${isFriendly ? 
                                '该网站已经过验证，可放心访问' : 
                                '该网站未经过验证，请谨慎访问'
                            }
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 15px; justify-content: flex-end;">
                        <button class="cancel-btn" style="
                            background-color: transparent;
                            color: white;
                            border: 1px solid #666;
                            padding: 8px 20px;
                            border-radius: 5px;
                            cursor: pointer;
                            font-size: 14px;
                            transition: all 0.3s ease;
                            user-select: none;
                            -webkit-user-select: none;
                            -moz-user-select: none;
                            -ms-user-select: none;
                        ">取消</button>
                        <button class="confirm-btn" style="
                            background-color: white;
                            color: black;
                            border: 1px solid #666;
                            padding: 8px 20px;
                            border-radius: 5px;
                            cursor: pointer;
                            font-size: 14px;
                            font-weight: bold;
                            transition: all 0.3s ease;
                            user-select: none;
                            -webkit-user-select: none;
                            -moz-user-select: none;
                            -ms-user-select: none;
                        ">确认</button>
                    </div>
                </div>
            </div>
        `;
        
        return modalHTML;
    }
    
    // 显示模态框
    function showWarningModal(targetUrl, isFriendly) {
        // 防止重复创建模态框
        if (document.getElementById('external-link-warning-modal')) {
            return;
        }
        
        // 禁用背景滑动
        document.body.style.overflow = 'hidden';
        document.body.style.touchAction = 'none';
        
        const modalHTML = createModalHTML(targetUrl, isFriendly);
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        const modal = document.getElementById('external-link-warning-modal');
        const modalContent = modal.querySelector('.modal-content');
        const cancelBtn = modal.querySelector('.cancel-btn');
        const confirmBtn = modal.querySelector('.confirm-btn');
        
        // 添加按钮悬停效果
        cancelBtn.addEventListener('mouseenter', function() {
            this.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            this.style.transform = 'translateY(-1px)';
        });
        cancelBtn.addEventListener('mouseleave', function() {
            this.style.backgroundColor = 'transparent';
            this.style.transform = 'translateY(0)';
        });
        
        confirmBtn.addEventListener('mouseenter', function() {
            this.style.backgroundColor = '#f0f0f0';
            this.style.transform = 'translateY(-1px)';
        });
        confirmBtn.addEventListener('mouseleave', function() {
            this.style.backgroundColor = 'white';
            this.style.transform = 'translateY(0)';
        });
        
        // 渐显动画
        setTimeout(() => {
            modal.style.opacity = '1';
            modalContent.style.transform = 'scale(1)';
        }, 10);
        
        // 关闭模态框函数
        function closeModal() {
            modal.style.opacity = '0';
            modalContent.style.transform = 'scale(0.9)';
            
            setTimeout(() => {
                if (modal.parentNode) {
                    document.body.removeChild(modal);
                }
                // 恢复背景滑动
                document.body.style.overflow = '';
                document.body.style.touchAction = '';
            }, 500);
        }
        
        // 取消按钮事件
        cancelBtn.addEventListener('click', closeModal);
        
        // 确认按钮事件
        confirmBtn.addEventListener('click', function() {
            closeModal();
            // 在新标签页打开链接
            setTimeout(() => {
                window.open(targetUrl, '_blank', 'noopener,noreferrer');
            }, 100);
        });
        
        // 点击背景关闭
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeModal();
            }
        });
        
        // ESC键关闭
        document.addEventListener('keydown', function handleEsc(e) {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEsc);
            }
        });
    }
    
    // 检查是否为外部链接
    function isExternalLink(url) {
        try {
            const targetDomain = new URL(url, window.location.href).hostname;
            return targetDomain !== currentDomain;
        } catch (e) {
            return false;
        }
    }
    
    // 从后端获取友链数据
    async function loadFriendlyDomains() {
        try {
            const response = await fetch('/friendly_links.json');
            const friendlyLinks = await response.json();
            
            if (Array.isArray(friendlyLinks)) {
                friendlyDomains = friendlyLinks.map(link => {
                    try {
                        return new URL(link.url).hostname;
                    } catch (e) {
                        return null;
                    }
                }).filter(domain => domain !== null);
            }
            
            console.log('加载友链域名:', friendlyDomains);
        } catch (error) {
            console.error('加载友链数据失败:', error);
        }
    }
    
    // 检查是否为友链
    function isFriendlyLink(url) {
        try {
            const targetDomain = new URL(url, window.location.href).hostname;
            return friendlyDomains.includes(targetDomain);
        } catch (e) {
            return false;
        }
    }
    
    // 拦截链接点击事件
    function interceptLinkClicks() {
        document.addEventListener('click', function(e) {
            let target = e.target;
            
            // 向上查找链接元素
            while (target && target.nodeName !== 'A') {
                target = target.parentNode;
            }
            
            if (target && target.nodeName === 'A' && target.href) {
                const href = target.href;
                
                // 检查是否为外部链接
                if (isExternalLink(href)) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const isFriendly = isFriendlyLink(href);
                    showWarningModal(href, isFriendly);
                }
            }
        });
    }
    
    // 初始化
    async function init() {
        // 先加载友链数据
        await loadFriendlyDomains();
        
        interceptLinkClicks();
        
        // 监听动态添加的链接
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes) {
                    mutation.addedNodes.forEach(function(node) {
                        if (node.nodeType === 1) { // Element node
                            const links = node.querySelectorAll ? node.querySelectorAll('a') : [];
                            links.forEach(function(link) {
                                link.addEventListener('click', function(e) {
                                    if (isExternalLink(link.href)) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const isFriendly = isFriendlyLink(link.href);
                                        showWarningModal(link.href, isFriendly);
                                    }
                                });
                            });
                        }
                    });
                }
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();