// 阅读页遥测数据功能
(function() {
    'use strict';
    
    // 遥测数据存储
    let telemetryData = {
        pageLoadTime: null,
        clickCount: 0,
        copyCount: 0,
        currentArticle: null,
        articleList: null,
        currentArticleIndex: -1,
        articleContent: null,
        isArticleVisible: false,        // 页面打开时的初始状态（滚动前）
        scrollDistance: 0,            // 页面打开时需要滚动的距离（滚动前）
        initialArticleRect: null,     // 页面打开时的文章位置
        initialContainerRect: null,   // 页面打开时的容器位置
        telemetryOpenCount: 0,        // 累计打开遥测次数
        lastRecordTime: null,         // 本次数据记录时间
        layoutType: '未知'            // 当前布局类型
    };
    
    // 初始化遥测数据
    function initTelemetry() {
        // 记录页面加载完成时间
        telemetryData.pageLoadTime = performance.now().toFixed(2);
        
        // 监听点击事件
        document.addEventListener('click', function(e) {
            if (e.button === 0) { // 左键点击
                telemetryData.clickCount++;
            }
        });
        
        // 监听复制事件
        document.addEventListener('copy', function() {
            telemetryData.copyCount++;
        });
        
        // 监听键盘事件（~键）
        document.addEventListener('keydown', function(e) {
            if (e.key === '~' || e.key === '`') {
                e.preventDefault();
                showTelemetryModal();
            }
        });
    }
    
    // 更新文章相关数据
    function updateArticleData() {
        // 获取当前文章信息
        const articleInfo = document.getElementById('articleInfo');
        if (articleInfo) {
            const titleElement = document.getElementById('pageTitle');
            const articleTitle = titleElement ? titleElement.textContent : '未知';
            
            // 获取文章简介（从目录中的文章项获取small_title）
            let articleDescription = '无简介';
            const articleList = document.getElementById('articleList');
            if (articleList) {
                const currentArticle = articleList.querySelector('.article-item.active');
                if (currentArticle) {
                    const descElement = currentArticle.querySelector('.article-desc-sidebar');
                    if (descElement) {
                        articleDescription = descElement.textContent.trim();
                    }
                }
            }
            
            // 获取文章内容（从文章内容区域获取）
            const articleContent = document.getElementById('articleContent');
            if (articleContent) {
                const textContent = articleContent.textContent || articleContent.innerText;
                telemetryData.articleContent = textContent.trim();
            }
            
            // 获取当前文章地址
            const currentUrl = window.location.href;
            
            telemetryData.currentArticle = {
                title: articleTitle,
                description: articleDescription,
                url: currentUrl
            };
        }
        
        // 获取目录信息
        updateDirectoryInfo();
    }
    
    // 记录页面打开时的初始状态（滚动前）
    function recordInitialState() {
        const articleList = document.getElementById('articleList');
        if (articleList) {
            const articles = articleList.querySelectorAll('.article-item');
            telemetryData.articleList = articles.length;
            
            // 查找当前文章在目录中的位置
            const currentArticle = articleList.querySelector('.article-item.active');
            if (currentArticle) {
                const articlesArray = Array.from(articles);
                telemetryData.currentArticleIndex = articlesArray.indexOf(currentArticle) + 1; // 从1开始计数
                
                // 检查文章是否在可见范围内（与目录脚本完全相同的逻辑）
                const container = document.querySelector('.sidebar-content');
                if (container) {
                    const containerRect = container.getBoundingClientRect();
                    const articleRect = currentArticle.getBoundingClientRect();
                    
                    // 记录初始位置
                    telemetryData.initialArticleRect = {
                        top: articleRect.top,
                        bottom: articleRect.bottom
                    };
                    telemetryData.initialContainerRect = {
                        top: containerRect.top,
                        bottom: containerRect.bottom
                    };
                    
                    // 使用与目录脚本完全相同的可见性检测逻辑
                    telemetryData.isArticleVisible = (
                        articleRect.top >= containerRect.top &&
                        articleRect.bottom <= containerRect.bottom
                    );
                    
                    // 计算需要滚动的距离（与目录脚本完全相同的逻辑）
                    if (!telemetryData.isArticleVisible) {
                        const scrollTop = container.scrollTop;
                        const targetTop = currentArticle.offsetTop - container.offsetTop;
                        const articleHeight = currentArticle.offsetHeight;
                        const containerHeight = container.clientHeight;
                        
                        let targetScrollTop;
                        
                        if (articleRect.top < containerRect.top) {
                            // 文章在可见区域上方，滚动到文章顶部
                            targetScrollTop = targetTop - 50;
                        } else {
                            // 文章在可见区域下方，滚动到文章底部
                            targetScrollTop = targetTop - containerHeight + articleHeight + 50;
                        }
                        
                        telemetryData.scrollDistance = targetScrollTop - scrollTop;
                    } else {
                        telemetryData.scrollDistance = 0;
                    }
                    
                    // 调试输出初始状态
                    console.log('遥测初始状态记录:', {
                        articleRect: telemetryData.initialArticleRect,
                        containerRect: telemetryData.initialContainerRect,
                        isVisible: telemetryData.isArticleVisible,
                        scrollDistance: telemetryData.scrollDistance
                    });
                }
            }
        }
    }
    
    // 更新当前目录状态（供其他脚本调用，不影响初始状态）
    function updateDirectoryInfo() {
        const articleList = document.getElementById('articleList');
        if (articleList) {
            const articles = articleList.querySelectorAll('.article-item');
            telemetryData.articleList = articles.length;
            
            // 查找当前文章在目录中的位置
            const currentArticle = articleList.querySelector('.article-item.active');
            if (currentArticle) {
                const articlesArray = Array.from(articles);
                telemetryData.currentArticleIndex = articlesArray.indexOf(currentArticle) + 1; // 从1开始计数
                
                // 检查文章是否在可见范围内（与目录脚本完全相同的逻辑）
                const container = document.querySelector('.sidebar-content');
                if (container) {
                    const containerRect = container.getBoundingClientRect();
                    const articleRect = currentArticle.getBoundingClientRect();
                    
                    // 调试输出当前状态
                    console.log('遥测当前状态检测:', {
                        articleRect: { top: articleRect.top, bottom: articleRect.bottom },
                        containerRect: { top: containerRect.top, bottom: containerRect.bottom },
                        isVisible: (
                            articleRect.top >= containerRect.top &&
                            articleRect.bottom <= containerRect.bottom
                        ),
                        scrollTop: container.scrollTop
                    });
                }
            }
        }
    }
    
    // 全局函数：更新当前目录状态（仅用于调试，不影响初始状态）
    window.updateTelemetryDirectoryState = function() {
        // 只更新当前状态用于调试，不影响初始状态
        const articleList = document.getElementById('articleList');
        if (articleList) {
            const currentArticle = articleList.querySelector('.article-item.active');
            if (currentArticle) {
                const container = document.querySelector('.sidebar-content');
                if (container) {
                    const containerRect = container.getBoundingClientRect();
                    const articleRect = currentArticle.getBoundingClientRect();
                    
                    const currentIsVisible = (
                        articleRect.top >= containerRect.top &&
                        articleRect.bottom <= containerRect.bottom
                    );
                    
                    console.log('遥测当前目录状态:', {
                        isArticleVisible: currentIsVisible,
                        scrollTop: container.scrollTop,
                        articleRect: { top: articleRect.top, bottom: articleRect.bottom },
                        containerRect: { top: containerRect.top, bottom: containerRect.bottom }
                    });
                }
            }
        }
    };
    
    // 检测当前布局类型
    function detectLayoutType() {
        const screenWidth = window.innerWidth;
        // 使用与目录脚本相同的断点（768px）
        if (screenWidth <= 768) {
            return '小屏设备';
        } else {
            return '大屏设备';
        }
    }
    
    // 获取本机IP（通过服务端API）
    async function getClientIP() {
        try {
            const response = await fetch('/debug/ip');
            const data = await response.json();
            return data.real_client_ip || data.remote_addr || '获取失败';
        } catch (error) {
            return '获取失败';
        }
    }
    
    // 创建遥测数据模态框HTML
    function createTelemetryModalHTML(data) {
        const modalHTML = `
            <div id="telemetry-modal" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                font-family: Arial, sans-serif;
                opacity: 0;
                transition: opacity 0.5s ease;
                overflow: auto;
            ">
                <div class="modal-content" style="
                        background-color: #1a1a1a;
                        border-radius: 10px;
                        padding: 25px;
                        max-width: 700px;
                        max-height: 80vh;
                        width: 90%;
                        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.5);
                        transform: scale(0.9);
                        transition: transform 0.5s ease;
                        overflow-y: auto;
                        user-select: none;
                        -webkit-user-select: none;
                        -moz-user-select: none;
                        -ms-user-select: none;
                        scrollbar-width: thin; /* Firefox */
                        scrollbar-color: rgba(255, 255, 255, 0.3) rgba(0, 0, 0, 0.1); /* Firefox */
                    ">
                    <h2 style="
                        color: #4CAF50;
                        margin: 0 0 20px 0;
                        font-size: 22px;
                        text-align: center;
                        user-select: none;
                    ">遥测数据</h2>
                    
                    <div class="telemetry-grid" style="
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 15px;
                        color: white;
                        font-size: 14px;
                        line-height: 1.6;
                    ">
                        <div><strong>本次数据记录时间:</strong> ${data.lastRecordTime}</div>
                        <div><strong>累计打开遥测次数:</strong> ${data.telemetryOpenCount}</div>
                        <div><strong>当前布局类型:</strong> ${data.layoutType}</div>
                        <div><strong>屏幕宽度:</strong> ${window.innerWidth}px</div>
                        <div><strong>本机IP:</strong> ${data.ip}</div>
                        <div><strong>加载完成时间:</strong> ${data.pageLoadTime}ms</div>
                        <div><strong>点击次数:</strong> ${data.clickCount}</div>
                        <div><strong>复制次数:</strong> ${data.copyCount}</div>
                        <div><strong>当前文章名称:</strong> ${data.currentArticle.title}</div>
                        <div><strong>当前文章简介:</strong> ${data.currentArticle.description}</div>
                        <div><strong>当前文章地址:</strong></div>
                        <div style="word-break: break-all;">${data.currentArticle.url}</div>
                        <div><strong>目录条数:</strong> ${data.articleList}</div>
                        <div><strong>当前文章在目录位置:</strong> ${data.currentArticleIndex}</div>
                        <div><strong>打开时文章是否在目录可见位置:</strong> ${data.isArticleVisible ? '是' : '否'}</div>
                        <div><strong>使文章在目录可见位置需要滚动的长度:</strong> ${data.scrollDistance}px</div>
                        ${data.initialArticleRect ? `
                        <div><strong>初始文章位置:</strong> top: ${data.initialArticleRect.top.toFixed(2)}, bottom: ${data.initialArticleRect.bottom.toFixed(2)}</div>
                        <div><strong>初始容器范围:</strong> top: ${data.initialContainerRect.top.toFixed(2)}, bottom: ${data.initialContainerRect.bottom.toFixed(2)}</div>
                        ` : ''}
                    </div>
                    
                    <div style="margin-top: 20px;">
                        <div style="color: white;"><strong>当前文章清理后内容:</strong></div>
                        <div class="article-content-preview" style="
                            background-color: rgba(255, 255, 255, 0.1);
                            padding: 10px;
                            border-radius: 5px;
                            margin-top: 10px;
                            font-size: 12px;
                            line-height: 1.4;
                            max-height: 200px;
                            overflow-y: auto;
                            word-break: break-word;
                            color: white;
                            scrollbar-width: thin; /* Firefox */
                            scrollbar-color: rgba(255, 255, 255, 0.3) rgba(0, 0, 0, 0.1); /* Firefox */
                        ">${data.articleContent || '无内容'}</div>
                    </div>
                    
                    <div style="display: flex; justify-content: center; margin-top: 20px;">
                        <button class="close-btn" style="
                            background-color: #4CAF50;
                            color: white;
                            border: none;
                            padding: 8px 20px;
                            border-radius: 5px;
                            cursor: pointer;
                            font-size: 14px;
                            transition: all 0.3s ease;
                        ">关闭</button>
                    </div>
                </div>
            </div>
        `;
        
        return modalHTML;
    }
    
    // 添加WebKit滚动条样式
    function addScrollbarStyles() {
        if (!document.getElementById('telemetry-scrollbar-styles')) {
            const style = document.createElement('style');
            style.id = 'telemetry-scrollbar-styles';
            style.textContent = `
                .telemetry-modal .modal-content::-webkit-scrollbar {
                    width: 8px;
                }
                .telemetry-modal .modal-content::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.1);
                }
                .telemetry-modal .modal-content::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.3);
                    border-radius: 4px;
                }
                .telemetry-modal .modal-content::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.5);
                }
                .telemetry-modal .article-content-preview::-webkit-scrollbar {
                    width: 6px;
                }
                .telemetry-modal .article-content-preview::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.05);
                }
                .telemetry-modal .article-content-preview::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.2);
                    border-radius: 3px;
                }
                .telemetry-modal .article-content-preview::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.4);
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    // 显示遥测数据模态框
    async function showTelemetryModal() {
        // 防止重复创建模态框
        if (document.getElementById('telemetry-modal')) {
            return;
        }
        
        // 更新累计打开次数、记录时间和布局类型
        telemetryData.telemetryOpenCount++;
        telemetryData.lastRecordTime = new Date().toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        telemetryData.layoutType = detectLayoutType();
        
        // 添加滚动条样式
        addScrollbarStyles();
        
        // 更新数据
        updateArticleData();
        
        // 获取IP地址
        const clientIP = await getClientIP();
        
        // 准备显示数据
        const displayData = {
            ip: clientIP,
            pageLoadTime: telemetryData.pageLoadTime,
            clickCount: telemetryData.clickCount,
            copyCount: telemetryData.copyCount,
            currentArticle: telemetryData.currentArticle || { title: '未知', description: '未知', url: '未知' },
            articleList: telemetryData.articleList || 0,
            currentArticleIndex: telemetryData.currentArticleIndex || 0,
            articleContent: telemetryData.articleContent || '无内容',
            isArticleVisible: telemetryData.isArticleVisible,
            scrollDistance: telemetryData.scrollDistance,
            telemetryOpenCount: telemetryData.telemetryOpenCount || 0,
            lastRecordTime: telemetryData.lastRecordTime || '未记录',
            layoutType: telemetryData.layoutType || '未知'
        };
        
        // 在控制台输出调试信息
        console.log('=== 遥测数据调试信息 ===');
        console.log('本次数据记录时间:', displayData.lastRecordTime);
        console.log('累计打开遥测次数:', displayData.telemetryOpenCount);
        console.log('当前布局类型:', displayData.layoutType);
        console.log('屏幕宽度:', window.innerWidth + 'px');
        console.log('本机IP:', displayData.ip);
        console.log('加载完成时间:', displayData.pageLoadTime + 'ms');
        console.log('点击次数:', displayData.clickCount);
        console.log('复制次数:', displayData.copyCount);
        console.log('当前文章名称:', displayData.currentArticle.title);
        console.log('当前文章简介:', displayData.currentArticle.description);
        console.log('当前文章地址:', displayData.currentArticle.url);
        console.log('目录条数:', displayData.articleList);
        console.log('当前文章在目录位置:', displayData.currentArticleIndex);
        console.log('当前文章清理后内容:', displayData.articleContent);
        console.log('打开时文章是否在目录可见位置:', displayData.isArticleVisible ? '是' : '否');
        console.log('使文章在目录可见位置需要滚动的长度:', displayData.scrollDistance + 'px');
        console.log('========================');
        
        // 禁用背景滑动
        document.body.style.overflow = 'hidden';
        document.body.style.touchAction = 'none';
        
        const modalHTML = createTelemetryModalHTML(displayData);
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        const modal = document.getElementById('telemetry-modal');
        const modalContent = modal.querySelector('.modal-content');
        const closeBtn = modal.querySelector('.close-btn');
        
        // 添加按钮悬停效果
        closeBtn.addEventListener('mouseenter', function() {
            this.style.backgroundColor = '#45a049';
            this.style.transform = 'translateY(-1px)';
        });
        closeBtn.addEventListener('mouseleave', function() {
            this.style.backgroundColor = '#4CAF50';
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
        
        // 关闭按钮事件
        closeBtn.addEventListener('click', closeModal);
        
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
    
    // 为右上角时间添加长按事件（仅小屏设备）
    function addTimeLongPressEvent() {
        const timeDisplay = document.getElementById('timeDisplay');
        if (!timeDisplay) return;
        
        // 仅在小屏设备上添加长按事件
        if (window.innerWidth <= 768) {
            let longPressTimer = null;
            let countdownTimer = null;
            let isLongPressing = false;
            let countdown = 5;
            
            // 创建倒计时提示元素
            const createCountdownTip = function() {
                const tip = document.createElement('div');
                tip.id = 'countdown-tip';
                tip.innerHTML = `继续保持长按<span id="countdown-number">5</span>秒以打开遥测`;
                tip.style.cssText = `
                    position: fixed;
                    bottom: 50px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(0, 0, 0, 0.8);
                    color: white;
                    padding: 10px 20px;
                    border-radius: 20px;
                    font-size: 14px;
                    z-index: 10000;
                    text-align: center;
                    min-width: 200px;
                `;
                document.body.appendChild(tip);
                return tip;
            };
            
            // 更新倒计时显示
            const updateCountdown = function() {
                const countdownNumber = document.getElementById('countdown-number');
                if (countdownNumber) {
                    countdownNumber.textContent = countdown;
                }
            };
            
            // 移除倒计时提示
            const removeCountdownTip = function() {
                const tip = document.getElementById('countdown-tip');
                if (tip) {
                    tip.remove();
                }
                countdown = 5;
            };
            
            timeDisplay.addEventListener('mousedown', function(e) {
                if (e.button !== 0) return; // 只响应左键
                
                isLongPressing = true;
                
                // 5秒后显示倒计时提示
                countdownTimer = setTimeout(() => {
                    if (isLongPressing) {
                        createCountdownTip();
                        
                        // 开始倒计时
                        const countdownInterval = setInterval(() => {
                            countdown--;
                            updateCountdown();
                            
                            if (countdown <= 0) {
                                clearInterval(countdownInterval);
                                clearTimeout(countdownTimer);
                                clearTimeout(longPressTimer);
                                removeCountdownTip();
                                console.log('长按时间10秒，打开遥测数据');
                                showTelemetryModal();
                                isLongPressing = false;
                                countdown = 5;
                            }
                        }, 1000);
                    }
                }, 5000); // 5秒后显示提示
                
                // 10秒长按打开遥测
                longPressTimer = setTimeout(() => {
                    if (isLongPressing) {
                        clearTimeout(countdownTimer);
                        removeCountdownTip();
                        console.log('长按时间10秒，打开遥测数据');
                        showTelemetryModal();
                        isLongPressing = false;
                        countdown = 5;
                    }
                }, 10000); // 10秒长按
                
                // 添加视觉反馈
                timeDisplay.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                timeDisplay.style.borderRadius = '5px';
                timeDisplay.style.padding = '2px 5px';
            });
            
            timeDisplay.addEventListener('mouseup', function() {
                clearTimeout(longPressTimer);
                clearTimeout(countdownTimer);
                removeCountdownTip();
                isLongPressing = false;
                countdown = 5;
                
                // 恢复样式
                timeDisplay.style.backgroundColor = '';
                timeDisplay.style.borderRadius = '';
                timeDisplay.style.padding = '';
            });
            
            timeDisplay.addEventListener('mouseleave', function() {
                clearTimeout(longPressTimer);
                clearTimeout(countdownTimer);
                removeCountdownTip();
                isLongPressing = false;
                countdown = 5;
                
                // 恢复样式
                timeDisplay.style.backgroundColor = '';
                timeDisplay.style.borderRadius = '';
                timeDisplay.style.padding = '';
            });
            
            // 触摸设备支持
            timeDisplay.addEventListener('touchstart', function(e) {
                e.preventDefault();
                isLongPressing = true;
                
                // 5秒后显示倒计时提示
                countdownTimer = setTimeout(() => {
                    if (isLongPressing) {
                        createCountdownTip();
                        
                        // 开始倒计时
                        const countdownInterval = setInterval(() => {
                            countdown--;
                            updateCountdown();
                            
                            if (countdown <= 0) {
                                clearInterval(countdownInterval);
                                clearTimeout(countdownTimer);
                                clearTimeout(longPressTimer);
                                removeCountdownTip();
                                console.log('长按时间10秒，打开遥测数据');
                                showTelemetryModal();
                                isLongPressing = false;
                                countdown = 5;
                            }
                        }, 1000);
                    }
                }, 5000); // 5秒后显示提示
                
                // 10秒长按打开遥测
                longPressTimer = setTimeout(() => {
                    if (isLongPressing) {
                        clearTimeout(countdownTimer);
                        removeCountdownTip();
                        console.log('长按时间10秒，打开遥测数据');
                        showTelemetryModal();
                        isLongPressing = false;
                        countdown = 5;
                    }
                }, 10000); // 10秒长按
                
                // 添加视觉反馈（无动画）
                timeDisplay.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                timeDisplay.style.borderRadius = '5px';
                timeDisplay.style.padding = '2px 5px';
            });
            
            timeDisplay.addEventListener('touchend', function() {
                clearTimeout(longPressTimer);
                clearTimeout(countdownTimer);
                removeCountdownTip();
                isLongPressing = false;
                countdown = 5;
                
                // 恢复样式
                timeDisplay.style.backgroundColor = '';
                timeDisplay.style.borderRadius = '';
                timeDisplay.style.padding = '';
            });
            
            timeDisplay.addEventListener('touchcancel', function() {
                clearTimeout(longPressTimer);
                clearTimeout(countdownTimer);
                removeCountdownTip();
                isLongPressing = false;
                countdown = 5;
                
                // 恢复样式
                timeDisplay.style.backgroundColor = '';
                timeDisplay.style.borderRadius = '';
                timeDisplay.style.padding = '';
            });
        }
    }
    
    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            // 立即初始化遥测数据
            initTelemetry();
            
            // 为右上角时间添加长按事件
            addTimeLongPressEvent();
            
            // 监听目录加载完成事件
            const checkDirectoryLoaded = setInterval(() => {
                const articleList = document.getElementById('articleList');
                if (articleList && articleList.querySelectorAll('.article-item').length > 0) {
                    clearInterval(checkDirectoryLoaded);
                    
                    // 立即记录初始状态（滚动前）
                    recordInitialState();
                    updateArticleData();
                    
                    // 等待目录滚动完成后再更新当前状态
                    setTimeout(() => {
                        updateDirectoryInfo();
                    }, 1500);
                }
            }, 100);
            
            // 10秒后超时
            setTimeout(() => {
                clearInterval(checkDirectoryLoaded);
                recordInitialState();
                updateArticleData();
            }, 10000);
        });
    } else {
        // 立即初始化遥测数据
        initTelemetry();
        
        // 为右上角时间添加长按事件
        addTimeLongPressEvent();
        
        // 监听目录加载完成事件
        const checkDirectoryLoaded = setInterval(() => {
            const articleList = document.getElementById('articleList');
            if (articleList && articleList.querySelectorAll('.article-item').length > 0) {
                clearInterval(checkDirectoryLoaded);
                
                // 立即记录初始状态（滚动前）
                recordInitialState();
                updateArticleData();
                
                // 等待目录滚动完成后再更新当前状态
                setTimeout(() => {
                    updateDirectoryInfo();
                }, 1500);
            }
        }, 100);
        
        // 10秒后超时
        setTimeout(() => {
            clearInterval(checkDirectoryLoaded);
            recordInitialState();
            updateArticleData();
        }, 10000);
    }
    
})();