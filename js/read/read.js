// 获取文章分类和ID
function getArticleInfo() {
    const path = window.location.pathname;
    const parts = path.split('/').filter(part => part !== '');
    
    // URL格式: /read/分类/文章ID
    if (parts.length >= 3 && parts[0] === 'read') {
        return {
            category: parts[1],
            articleId: parts[2]
        };
    }
    
    return { category: null, articleId: null };
}

// 更新时间显示
function updateTimeDisplay() {
    const now = new Date();
    const timeString = now.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    const timeDisplay = document.getElementById('timeDisplay');
    if (timeDisplay) {
        timeDisplay.textContent = timeString;
    }
}

// 为代码块重新设计布局，添加标题栏和分隔线
function redesignCodeBlocks() {
    const codeBlocks = document.querySelectorAll('pre code');
    
    codeBlocks.forEach(codeBlock => {
        const preElement = codeBlock.parentElement;
        const language = getCodeLanguage(codeBlock);
        
        // 创建新的代码块容器
        const codeBlockContainer = document.createElement('div');
        codeBlockContainer.className = `code-block language-${language}`;
        
        // 创建标题栏
        const codeHeader = document.createElement('div');
        codeHeader.className = 'code-header';
        
        // 创建语言标签
        const languageLabel = document.createElement('span');
        languageLabel.className = 'code-language';
        languageLabel.textContent = language;
        
        // 创建复制按钮
        const copyButton = document.createElement('button');
        copyButton.className = 'copy-button';
        copyButton.textContent = '复制';
        copyButton.setAttribute('aria-label', '复制代码');
        
        // 添加复制功能
        copyButton.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(codeBlock.textContent || '');
                copyButton.textContent = '已复制!';
                copyButton.classList.add('copied');
                
                setTimeout(() => {
                    copyButton.textContent = '复制';
                    copyButton.classList.remove('copied');
                }, 2000);
            } catch (err) {
                console.error('复制失败:', err);
                copyButton.textContent = '复制失败';
                copyButton.classList.add('error');
                
                setTimeout(() => {
                    copyButton.textContent = '复制';
                    copyButton.classList.remove('error');
                }, 2000);
            }
        });
        
        // 创建代码内容区域
        const codeContent = document.createElement('div');
        codeContent.className = 'code-content';
        
        // 将原始代码内容移动到新的内容区域
        codeContent.appendChild(preElement.cloneNode(true));
        
        // 组装标题栏
        codeHeader.appendChild(languageLabel);
        codeHeader.appendChild(copyButton);
        
        // 组装整个代码块
        codeBlockContainer.appendChild(codeHeader);
        codeBlockContainer.appendChild(codeContent);
        
        // 替换原始的pre元素
        preElement.parentNode.replaceChild(codeBlockContainer, preElement);
    });
}

// 应用语法高亮样式
function applySyntaxHighlighting() {
    const codeBlocks = document.querySelectorAll('.code-content pre code');
    
    codeBlocks.forEach(codeBlock => {
        const language = getCodeLanguage(codeBlock);
        codeBlock.className = `language-${language}`;
        
        // 获取原始HTML内容（已转义）
        const originalHTML = codeBlock.innerHTML;
        
        // 解码HTML实体获取原始代码
        const decodedContent = decodeHTMLEntities(originalHTML);
        
        // 在原始代码上应用高亮
        let highlightedCode = applyBasicHighlightingToText(decodedContent, language);
        
        // 将高亮后的代码设置回去，然后解码HTML实体
        codeBlock.innerHTML = decodeHTML(highlightedCode);
    });
}

// 获取代码语言
function getCodeLanguage(codeBlock) {
    const classList = codeBlock.className.split(' ');
    for (const className of classList) {
        if (className.startsWith('language-')) {
            return className.replace('language-', '');
        }
    }
    
    // 根据内容猜测语言
    const content = codeBlock.textContent || '';
    if (content.includes('def ') || content.includes('import ') || content.includes('print(')) {
        return 'python';
    } else if (content.includes('#include') || content.includes('int main')) {
        return 'cpp';
    } else if (content.includes('function') || content.includes('const ') || content.includes('let ')) {
        return 'javascript';
    } else if (content.includes('<html') || content.includes('<div') || content.includes('class=')) {
        return 'html';
    } else if (content.includes('public class') || content.includes('System.out')) {
        return 'java';
    }
    
    return 'text';
}

// 解码HTML实体
function decodeHTMLEntities(text) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
}

// 转义HTML特殊字符
function escapeHTML(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// 解码HTML实体
function decodeHTML(text) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
}

// 应用基本的语法高亮（返回字符串）
function applyBasicHighlightingToText(content, language) {
    // 简单的关键词高亮（可以根据需要扩展）
    let highlightedContent = content;
    
    // 通用关键词
    const keywords = {
        'python': ['def ', 'class ', 'import ', 'from ', 'if ', 'else ', 'for ', 'while ', 'return ', 'True', 'False', 'None'],
        'javascript': ['function', 'const ', 'let ', 'var ', 'if ', 'else ', 'for ', 'while ', 'return ', 'true', 'false', 'null'],
        'cpp': ['#include', 'int ', 'void ', 'if ', 'else ', 'for ', 'while ', 'return ', 'class ', 'public', 'private'],
        'java': ['public', 'private', 'class ', 'void ', 'int ', 'if ', 'else ', 'for ', 'while ', 'return '],
        'html': ['<div', '<span', '<p', '<h1', '<h2', '<h3', 'class=', 'id=']
    };
    
    const langKeywords = keywords[language] || [];
    
    langKeywords.forEach(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'g');
        highlightedContent = highlightedContent.replace(regex, `___SPAN_KEYWORD___${keyword}___ENDSPAN___`);
    });
    
    // 使用更可靠的方法：先保护字符串，再处理注释，最后恢复字符串
    
    // 第一步：识别并保护所有字符串内容
    const stringPlaceholders = [];
    let placeholderIndex = 0;
    
    // 处理Python三引号多行字符串
    if (language === 'python') {
        highlightedContent = highlightedContent.replace(/(['"]{3})([\s\S]*?)\1/g, (match, quote, str) => {
            const placeholder = `___STRING_PLACEHOLDER_${placeholderIndex++}___`;
            stringPlaceholders.push(match);
            return placeholder;
        });
    }
    
    // 处理单引号和双引号字符串
    highlightedContent = highlightedContent.replace(/(['"])(.*?)\1/g, (match, quote, str) => {
        const placeholder = `___STRING_PLACEHOLDER_${placeholderIndex++}___`;
        stringPlaceholders.push(match);
        return placeholder;
    });
    
    // 第二步：处理注释（此时字符串已被保护）
    if (language === 'python' || language === 'javascript' || language === 'cpp' || language === 'java') {
        if (language === 'python') {
            // Python: 处理 # 注释
            highlightedContent = highlightedContent.replace(/(#.*$)/gm, (match) => {
                return `___SPAN_COMMENT___${match}___ENDSPAN___`;
            });
        } else {
            // JavaScript/C++/Java: 处理 // 注释
            highlightedContent = highlightedContent.replace(/(\/\/.*$)/gm, (match) => {
                return `___SPAN_COMMENT___${match}___ENDSPAN___`;
            });
        }
    }
    
    // 第三步：恢复字符串内容并应用字符串高亮
    for (let i = 0; i < stringPlaceholders.length; i++) {
        const placeholder = `___STRING_PLACEHOLDER_${i}___`;
        const originalString = stringPlaceholders[i];
        highlightedContent = highlightedContent.replace(placeholder, `___SPAN_STRING___${originalString}___ENDSPAN___`);
    }
    
    // 转义所有HTML字符
    let finalContent = escapeHTML(highlightedContent);
    
    // 还原span标签
    finalContent = finalContent
        .replace(/___SPAN_KEYWORD___/g, '<span class="keyword">')
        .replace(/___SPAN_STRING___/g, '<span class="string">')
        .replace(/___SPAN_COMMENT___/g, '<span class="comment">')
        .replace(/___ENDSPAN___/g, '</span>');
    
    return finalContent;
}

// 加载文章内容
async function loadArticleContent() {
    const { category, articleId } = getArticleInfo();
    
    if (!category || !articleId) {
        document.getElementById('articleContent').innerHTML = '<p class="error">文章路径无效</p>';
        return;
    }
    
    try {
        const response = await fetch(`/api/articles/content/${category}/${articleId}`);
        const data = await response.json();
        
        if (data.error) {
            document.getElementById('articleContent').innerHTML = `<p class="error">${data.error}</p>`;
            return;
        }
        
        // 更新页面标题
        document.getElementById('pageTitle').textContent = data.title;
        
        // 初始化时间显示并开始每秒更新
        updateTimeDisplay();
        setInterval(updateTimeDisplay, 1000);
        
        // 使用textContent设置内容，避免HTML被解析
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = data.content;
        
        // 转义代码块中的HTML内容
        const codeBlocks = tempDiv.querySelectorAll('pre code');
        codeBlocks.forEach(codeBlock => {
            const content = codeBlock.innerHTML;
            // 转义HTML特殊字符
            const escapedContent = content
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
            codeBlock.innerHTML = escapedContent;
        });
        
        document.getElementById('articleContent').innerHTML = tempDiv.innerHTML;
        
        // 重新设计代码块布局并应用语法高亮
        redesignCodeBlocks();
        applySyntaxHighlighting();
        
        // 初始化文章图片预览
        initImagePreview();

        // 初始化自定义音频播放器
        initCustomAudioPlayers();

        // 初始化附件查看信息按钮
        initAttachmentInfoButtons();
        
        // 设置复制事件监听器
        document.getElementById('articleContent').oncopy = handleCopyEvent;
        
        // 渲染数学公式
        if (window.MathJax && window.MathJax.typeset) {
            window.MathJax.typeset();
        } else if (window.MathJax && window.MathJax.Hub) {
            window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub]);
        }
        
        // 初始化文章信息显示
        initArticleInfo(data);

        // 文章加载成功后才显示分享区
        const shareSection = document.getElementById('shareSection');
        if (shareSection) {
            shareSection.style.display = 'block';
        }
        
    } catch (error) {
        console.error('加载文章内容失败:', error);
        document.getElementById('articleContent').innerHTML = '<p class="error">文章加载失败</p>';
    }
}

// 当前文章的许可协议、版权所有者与转载标记（由文章接口返回后更新）
let currentArticleLicense = 'CC BY-NC-SA 4.0';
let currentArticleOwner = 'manyJ';
let currentArticleIsRepost = false;

// 复制事件处理函数
function handleCopyEvent(event) {
    // 获取选中的文本
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    // 如果选中的文本长度大于等于30字，添加版权信息
    if (selectedText.length >= 30) {
        // 阻止默认复制行为
        event.preventDefault();
        
        // 获取当前时间
        const now = new Date();
        const timeString = now.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        // 版权所有者：转载文章使用配置中的 owner，否则回退到站点作者名称
        const authorName = currentArticleOwner || (window.AUTHOR_NAME || '').trim() || '作者';
        
        // 原文链接：自动取当前页面 URL（去掉查询串与锚点）
        const articleUrl = window.location.origin + window.location.pathname;
        
        // 构建带版权信息的文本
        const copyrightText = `\n------\n博客内容由${authorName}版权所有\n原文链接：${articleUrl}\n采用${currentArticleLicense}许可协议\n复制时间：${timeString}`;
        const modifiedText = selectedText + copyrightText;
        
        // 将修改后的文本写入剪贴板
        event.clipboardData.setData('text/plain', modifiedText);
    }
}

// 初始化文章分享区：点击请求三位短 id，再次点击复制链接
function initShareSection() {
    const shareButton = document.getElementById('shareButton');
    const shareResult = document.getElementById('shareResult');
    const shareLinkInput = document.getElementById('shareLinkInput');
    if (!shareButton || !shareResult || !shareLinkInput) return;

    shareButton.addEventListener('click', async () => {
        // 已获取短链：复制模式
        if (shareButton.dataset.state === 'copied') {
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(shareLinkInput.value);
                } else {
                    shareLinkInput.select();
                    if (!document.execCommand('copy')) throw new Error('copy failed');
                }
                attachmentToast('已复制', 'success');
            } catch (e) {
                attachmentToast('复制失败，可手动选择复制', 'warning');
            }
            return;
        }

        // 首次点击：请求分享短 id
        const { category, articleId } = getArticleInfo();
        if (!category || !articleId) {
            attachmentToast('无法获取当前文章信息', 'error');
            return;
        }

        shareButton.disabled = true;
        shareButton.textContent = '请求中...';
        attachmentToast('正在请求分享', 'tip');

        try {
            const response = await fetch(`/api/share/${encodeURIComponent(category)}/${encodeURIComponent(articleId)}`);
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || '请求失败');
            }
            shareLinkInput.value = `${window.location.origin}/${data.short_id}`;
            shareResult.style.display = 'block';
            shareButton.textContent = '点击复制';
            shareButton.dataset.state = 'copied';
            shareButton.disabled = false;
            attachmentToast('已获取到简短id', 'success');
        } catch (e) {
            shareButton.disabled = false;
            shareButton.textContent = '分享文章';
            attachmentToast('获取分享链接失败', 'error');
        }
    });
}

// 显示复制消息提示
function showCopyMessage(message) {
    // 创建临时消息提示
    const messageEl = document.createElement('div');
    messageEl.textContent = message;
    messageEl.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(243, 216, 13, 0.9);
        color: black;
        padding: 10px 20px;
        border-radius: 5px;
        z-index: 1000;
        font-weight: bold;
        font-size: 14px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
    `;
    
    document.body.appendChild(messageEl);
    
    // 3秒后移除消息
    setTimeout(() => {
        if (document.body.contains(messageEl)) {
            document.body.removeChild(messageEl);
        }
    }, 3000);
}

// 初始化文章信息显示
function initArticleInfo(data) {
    // 获取文章更新日期（从后端数据）
    document.getElementById('updateDate').textContent = data.update_date || '未知';

    // 许可协议
    currentArticleLicense = data.license || 'CC BY-NC-SA 4.0';
    const licenseEl = document.getElementById('license');
    if (licenseEl) {
        licenseEl.textContent = currentArticleLicense;
    }

    // 转载情况：仅转载模式显示，并同步复制到版权所有者
    currentArticleIsRepost = data.repost === true;
    currentArticleOwner = currentArticleIsRepost
        ? (data.owner || '')
        : ((window.AUTHOR_NAME || '').trim() || 'manyJ');
    const repostInfo = document.getElementById('repostInfo');
    if (repostInfo) {
        repostInfo.style.display = currentArticleIsRepost ? '' : 'none';
    }
    
    // 初始化AI总结区域
    if (data.ai && data.ai.trim()) {
        const aiSection = document.getElementById('aiSummarySection');
        const aiContent = document.getElementById('aiSummaryContent');
        const aiExpandBtn = document.getElementById('aiSummaryExpandBtn');
        
        if (aiSection && aiContent && aiExpandBtn) {
            aiContent.innerHTML = data.ai;
            aiSection.style.display = 'block';
            
            // 检查内容是否超过两行，决定是否显示展开按钮
            setTimeout(() => {
                const contentWrapper = aiSection.querySelector('.ai-summary-content-wrapper');
                if (!contentWrapper) return;
                
                const contentHeight = aiContent.scrollHeight;
                const lineHeight = parseInt(getComputedStyle(aiContent).lineHeight);
                const maxHeight = lineHeight * 2;
                const tolerance = 2;
                
                if (contentHeight > maxHeight + tolerance) {
                    aiExpandBtn.style.display = 'flex';
                    aiExpandBtn.querySelector('.expand-text').style.display = 'inline';
                    aiExpandBtn.querySelector('.collapse-text').style.display = 'none';
                    aiContent.style.maxHeight = maxHeight + 'px';
                    aiContent.style.overflow = 'hidden';
                }
            }, 100);
            
            // 点击展开/收起按钮
            aiExpandBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const expandText = aiExpandBtn.querySelector('.expand-text');
                const collapseText = aiExpandBtn.querySelector('.collapse-text');
                const isExpanded = aiContent.style.maxHeight === 'none';
                
                // 禁用按钮点击，防止重复操作
                aiExpandBtn.style.pointerEvents = 'none';
                
                if (isExpanded) {
                    // 收起内容 - 使用动画
                    const lineHeight = parseInt(getComputedStyle(aiContent).lineHeight);
                    const maxHeight = lineHeight * 2;
                    
                    // 先获取当前高度，然后设置动画到两行高度
                    const currentHeight = aiContent.scrollHeight;
                    aiContent.style.maxHeight = currentHeight + 'px';
                    
                    // 强制重排，确保动画开始
                    aiContent.offsetHeight;
                    
                    // 设置动画到两行高度
                    aiContent.style.maxHeight = maxHeight + 'px';
                    expandText.style.display = 'inline';
                    collapseText.style.display = 'none';
                    
                    // 动画结束后恢复按钮点击
                    setTimeout(() => {
                        aiExpandBtn.style.pointerEvents = 'auto';
                    }, 300);
                } else {
                    // 展开内容 - 使用动画
                    // 先获取完整高度，然后设置动画
                    const fullHeight = aiContent.scrollHeight;
                    aiContent.style.maxHeight = fullHeight + 'px';
                    
                    // 短暂延迟后设置为none，确保动画完成
                    setTimeout(() => {
                        aiContent.style.maxHeight = 'none';
                        expandText.style.display = 'none';
                        collapseText.style.display = 'inline';
                        aiExpandBtn.style.pointerEvents = 'auto';
                    }, 300);
                }
            });
        }
    }
    
    // 开始阅读时长计时
    startReadingTimer();
    
    // 延迟统计文章字数（等待DOM完全渲染）
    setTimeout(() => {
        calculateWordCount();
    }, 100);
}

// 计算文章字数（前端统计）
function calculateWordCount() {
    const articleContent = document.getElementById('articleContent');
    if (!articleContent) return;
    
    // 获取所有可被选中的文本内容
    const textContent = articleContent.textContent || articleContent.innerText || '';
    
    // 移除所有空白字符（空格、换行、制表符等）
    const cleanText = textContent.replace(/\s+/g, '');
    
    // 统计字符数
    const charCount = cleanText.length;
    
    // 显示字数
    document.getElementById('wordCount').textContent = `${charCount}字`;
    
    // 输出调试信息
    console.log('原始文本长度:', textContent.length);
    console.log('清理后文本长度:', charCount);
    console.log('清理后文本内容:', cleanText);
}

// 阅读时长计时器
let readingTimer = null;
let readingSeconds = 0;

// 开始阅读时长计时
function startReadingTimer() {
    readingSeconds = 0;
    
    // 更新显示
    updateReadingTimeDisplay();
    
    // 每秒更新一次
    readingTimer = setInterval(() => {
        readingSeconds++;
        updateReadingTimeDisplay();
    }, 1000);
}

// 更新阅读时长显示
function updateReadingTimeDisplay() {
    const timeString = formatReadingTime(readingSeconds);
    document.getElementById('readingTime').textContent = timeString;
}

// 格式化阅读时长
function formatReadingTime(seconds) {
    // 计算各个时间单位
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    // 构建时间字符串，为零的单位不显示
    const timeParts = [];
    
    if (days > 0) {
        timeParts.push(`${days}天`);
    }
    if (hours > 0) {
        timeParts.push(`${hours}小时`);
    }
    if (minutes > 0) {
        timeParts.push(`${minutes}分钟`);
    }
    if (secs > 0 || seconds === 0) {
        timeParts.push(`${secs}秒`);
    }
    
    // 如果所有单位都为零，显示0秒
    if (timeParts.length === 0) {
        return '0秒';
    }
    
    return timeParts.join('');
}

// 目录状态管理
let isSidebarCollapsed = false;
let isClickDisabled = false; // 全局点击禁用标志

// 初始化目录功能
function initSidebar() {
    // 加载目录标签页
    loadDirectoryTabs();
    
    // 加载文章列表
    loadArticleList();
    
    // 绑定目录切换事件
    const toggleBtn = document.getElementById('toggleSidebar');
    const toggleCollapsedBtn = document.getElementById('toggleSidebarCollapsed');
    
    if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleSidebar);
    }
    if (toggleCollapsedBtn) {
        // 修改点击事件处理，添加拖拽后点击禁用检查
        toggleCollapsedBtn.addEventListener('click', (e) => {
            if (isClickDisabled) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            toggleSidebar();
        });
        // 为收起状态的按钮添加拖拽功能
        addDragToCollapsedButton(toggleCollapsedBtn);
    }
    
    // 检查是否为移动设备，如果是则默认收起目录
    if (window.innerWidth <= 768) {
        collapseSidebar();
    }
}

// 加载目录标签页
function loadDirectoryTabs() {
    fetch('/api/blog')
        .then(response => response.json())
        .then(data => {
            // 从文章数据中提取所有分类
            const categories = extractCategoriesFromArticles(data.articles || []);
            renderDirectoryTabs(categories);
            bindDirectoryTabsNavigation();
        })
        .catch(error => {
            console.error('加载目录标签页失败:', error);
        });
}

// 从文章数据中提取分类
function extractCategoriesFromArticles(articles) {
    const categories = new Set();
    
    articles.forEach(article => {
        if (article.category) {
            categories.add(article.category);
        }
    });
    
    return Array.from(categories);
}

// 渲染目录标签页
function renderDirectoryTabs(categories) {
    const tabsContainer = document.getElementById('directoryTabsContainer');
    const prevBtn = document.getElementById('directoryTabsPrev');
    const nextBtn = document.getElementById('directoryTabsNext');
    
    if (!tabsContainer) return;
    
    // 清空容器
    tabsContainer.innerHTML = '';
    
    // 首先添加"全部"标签页
    const allTab = document.createElement('div');
    allTab.className = 'directory-tab active';
    allTab.textContent = '全部';
    allTab.onclick = () => switchDirectoryCategory('全部');
    tabsContainer.appendChild(allTab);
    
    // 设置当前分类为"全部"
    currentDirectoryCategory = '全部';
    
    // 添加其他分类标签页
    categories.forEach(category => {
        const tab = document.createElement('div');
        tab.className = 'directory-tab';
        tab.textContent = category;
        tab.onclick = () => switchDirectoryCategory(category);
        tabsContainer.appendChild(tab);
    });
    
    // 绑定导航按钮事件
    if (prevBtn && nextBtn) {
        prevBtn.onclick = () => scrollDirectoryTabs(-1);
        nextBtn.onclick = () => scrollDirectoryTabs(1);
    }
}

// 切换目录分类
function switchDirectoryCategory(category) {
    currentDirectoryCategory = category;
    
    // 更新标签页激活状态
    document.querySelectorAll('.directory-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.textContent === category) {
            tab.classList.add('active');
        }
    });
    
    // 重新加载文章列表（根据分类筛选）
    loadArticleList();
}

// 滚动目录标签页
function scrollDirectoryTabs(direction) {
    const container = document.getElementById('directoryTabsContainer');
    const scrollAmount = 150; // 每次滚动的距离
    
    if (direction === 1) {
        container.scrollLeft += scrollAmount;
    } else {
        container.scrollLeft -= scrollAmount;
    }
}

// 自动滚动到当前文章
function scrollToCurrentArticle() {
    const articleList = document.getElementById('articleList');
    const currentArticle = articleList.querySelector('.article-item.active');
    
    if (!currentArticle) {
        console.log('未找到当前文章元素');
        return;
    }
    
    const container = document.querySelector('.sidebar-content');
    if (!container) {
        console.log('未找到目录容器');
        return;
    }
    
    // 计算元素位置
    const containerRect = container.getBoundingClientRect();
    const articleRect = currentArticle.getBoundingClientRect();
    
    // 检查文章是否在可见范围内
    const isVisible = (
        articleRect.top >= containerRect.top &&
        articleRect.bottom <= containerRect.bottom
    );
    
    // 调试输出滚动前的状态
    console.log('目录脚本滚动前检测:', {
        articleRect: { top: articleRect.top, bottom: articleRect.bottom },
        containerRect: { top: containerRect.top, bottom: containerRect.bottom },
        isVisible: isVisible,
        scrollTop: container.scrollTop
    });
    
    if (!isVisible) {
        // 计算需要滚动的距离
        const scrollTop = container.scrollTop;
        const targetTop = currentArticle.offsetTop - container.offsetTop;
        
        // 确保文章完整显示在可见范围内
        const articleHeight = currentArticle.offsetHeight;
        const containerHeight = container.clientHeight;
        
        let targetScrollTop;
        
        if (articleRect.top < containerRect.top) {
            // 文章在可见区域上方，滚动到文章顶部
            targetScrollTop = targetTop - 50; // 额外滚动50px，留出更多边距
        } else {
            // 文章在可见区域下方，滚动到文章底部
            targetScrollTop = targetTop - containerHeight + articleHeight + 50;
        }
        
        // 平滑滚动到目标位置
        container.scrollTo({
            top: targetScrollTop,
            behavior: 'smooth'
        });
        
        console.log('自动滚动到当前文章，目标位置:', targetScrollTop);
        
        // 滚动完成后更新遥测数据（等待更长时间确保动画完成）
        setTimeout(() => {
            if (window.updateTelemetryDirectoryState) {
                window.updateTelemetryDirectoryState();
            }
        }, 800); // 等待滚动动画完全完成
    } else {
        console.log('当前文章已在可见范围内');
        
        // 立即更新遥测数据
        if (window.updateTelemetryDirectoryState) {
            window.updateTelemetryDirectoryState();
        }
    }
}

// 绑定目录标签页导航事件
function bindDirectoryTabsNavigation() {
    const container = document.getElementById('directoryTabsContainer');
    const prevBtn = document.getElementById('directoryTabsPrev');
    const nextBtn = document.getElementById('directoryTabsNext');
    
    if (!container || !prevBtn || !nextBtn) return;
    
    // 绑定导航按钮事件
    prevBtn.onclick = () => scrollDirectoryTabs(-1);
    nextBtn.onclick = () => scrollDirectoryTabs(1);
    
    // 添加鼠标拖动滚动功能
    addDragScroll(container);
}

// 添加鼠标拖动滚动功能
function addDragScroll(container) {
    let isDragging = false;
    let startX;
    let scrollLeft;
    
    container.addEventListener('mousedown', (e) => {
        isDragging = true;
        container.classList.add('dragging');
        startX = e.pageX - container.offsetLeft;
        scrollLeft = container.scrollLeft;
    });
    
    container.addEventListener('mouseleave', () => {
        if (isDragging) {
            isDragging = false;
            container.classList.remove('dragging');
        }
    });
    
    container.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            container.classList.remove('dragging');
        }
    });
    
    container.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const x = e.pageX - container.offsetLeft;
        const walk = (x - startX) * 2; // 拖动速度系数
        container.scrollLeft = scrollLeft - walk;
    });
}

// 全局变量：当前目录分类
let currentDirectoryCategory = '全部';

// 加载文章列表
async function loadArticleList() {
    try {
        const url = currentDirectoryCategory !== '全部' ? 
            `/api/blog/${encodeURIComponent(currentDirectoryCategory)}` : '/api/blog';
        const response = await fetch(url);
        const data = await response.json();
        
        let articles = [];
        if (data.articles && data.articles.length > 0) {
            articles = data.articles;
        }
        
        // 渲染文章列表
        renderArticleList(articles);
        
        // 自动滚动到当前文章
        setTimeout(() => {
            scrollToCurrentArticle();
        }, 100);
    } catch (error) {
        console.error('加载文章列表失败:', error);
    }
}

// 渲染文章列表
function renderArticleList(articles) {
    const articleList = document.getElementById('articleList');
    if (!articleList) return;
    
    articleList.innerHTML = '';
    
    const { category, articleId } = getArticleInfo();
    
    // 调试信息：输出当前正在阅读的文章路径
    console.log('当前阅读文章路径:', `/read/${category}/${articleId}`);
    
    let currentArticleIndex = -1;
    
    articles.forEach((article, index) => {
        const articleItem = document.createElement('a');
        articleItem.className = 'article-item';
        
        // 判断是否为当前阅读的文章
        // 注意：category和articleId可能是URL编码的，需要解码后比较
        const decodedCategory = decodeURIComponent(category);
        const decodedArticleId = decodeURIComponent(articleId);
        const isCurrentArticle = article.category === decodedCategory && article.id === decodedArticleId;
        
        if (isCurrentArticle) {
            articleItem.classList.add('active');
            // 记录当前文章在目录中的位置
            currentArticleIndex = index + 1; // 从1开始计数
            
            // 为当前文章添加内联样式，使其始终显示为亮色
            articleItem.style.cssText = `
                background-color: rgba(255, 255, 255, 0.1) !important;
                color: rgba(255, 255, 255, 0.9) !important;
            `;
        }
        
        articleItem.href = `/read/${article.category}/${article.id}`;
        
        // 文章图标
        const iconHtml = article.has_icon ? 
            `<img src="/api/articles/icon/${article.category}/${article.id}" alt="${article.title}" class="article-icon">` :
            `<div class="article-icon" style="background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; color: #999; font-size: 12px;">无图</div>`;
        
        articleItem.innerHTML = `
            ${iconHtml}
            <div class="article-info-sidebar">
                <div class="article-title-sidebar" style="${isCurrentArticle ? 'color: white !important; font-weight: 600 !important;' : ''}">${article.title}</div>
                <div class="article-desc-sidebar" style="${isCurrentArticle ? 'color: rgba(255,255,255,0.9) !important;' : ''}">${article.small_title}</div>
            </div>
        `;
        
        articleList.appendChild(articleItem);
    });
    
    // 输出当前文章在目录中的位置信息
    if (currentArticleIndex !== -1) {
        console.log('当前文章在目录中的位置:', `第${currentArticleIndex}项`);
        console.log('目录总文章数:', articles.length);
        console.log('当前文章标题:', articles[currentArticleIndex - 1]?.title || '未知');
    } else {
        console.log('警告: 未找到当前文章在目录中的位置');
        console.log('可能的原因: 文章不存在或路径不匹配');
    }
}

// 切换目录显示状态
function toggleSidebar() {
    if (isSidebarCollapsed) {
        expandSidebar();
    } else {
        collapseSidebar();
    }
}

// 收起目录
function collapseSidebar() {
    const sidebar = document.getElementById('sidebar');
    const divider = document.getElementById('divider');
    const toggleCollapsedBtn = document.getElementById('toggleSidebarCollapsed');
    const centerSection = document.getElementById('centerSection');
    
    if (sidebar && divider) {
        if (window.innerWidth <= 768) {
            // 移动端：使用transform动画
            sidebar.classList.remove('show');
            // 移动端收起时恢复整个页面滚动
            document.body.style.overflow = '';
            document.body.style.touchAction = '';
            if (centerSection) {
                centerSection.style.overflow = '';
                centerSection.style.touchAction = '';
            }
        } else {
            // 桌面端：使用width动画
            sidebar.classList.add('collapsed');
            divider.classList.add('hidden');
        }
        
        if (toggleCollapsedBtn) {
            // 等待目录完全收起后（0.5秒）再显示按钮
            setTimeout(() => {
                toggleCollapsedBtn.style.display = 'flex';
                // 触发重绘后开始透明度动画
                setTimeout(() => {
                    toggleCollapsedBtn.style.opacity = '1';
                }, 10);
            }, 500);
        }
        
        isSidebarCollapsed = true;
    }
}

// 展开目录
function expandSidebar() {
    const sidebar = document.getElementById('sidebar');
    const divider = document.getElementById('divider');
    const toggleCollapsedBtn = document.getElementById('toggleSidebarCollapsed');
    const centerSection = document.getElementById('centerSection');
    
    if (sidebar && divider) {
        if (window.innerWidth <= 768) {
            // 移动端：使用transform动画
            sidebar.classList.add('show');
            // 移动端展开时禁用整个页面滚动
            document.body.style.overflow = 'hidden';
            document.body.style.touchAction = 'none';
            if (centerSection) {
                centerSection.style.overflow = 'hidden';
                centerSection.style.touchAction = 'none';
            }
        } else {
            // 桌面端：使用width动画
            sidebar.classList.remove('collapsed');
            divider.classList.remove('hidden');
        }
        
        if (toggleCollapsedBtn) {
            // 立即隐藏按钮并重置透明度
            toggleCollapsedBtn.style.opacity = '0';
            toggleCollapsedBtn.style.display = 'none';
        }
        
        isSidebarCollapsed = false;
    }
}

// 为收起状态的按钮添加拖拽功能
function addDragToCollapsedButton(button) {
    let isDragging = false;
    let startY;
    let startTop;
    let dragTimer = null; // 拖拽计时器
    
    button.addEventListener('mousedown', (e) => {
        if (window.innerWidth <= 768) {
            // 小屏状态：设置0.3秒后触发拖拽
            dragTimer = setTimeout(() => {
                isDragging = true;
                startY = e.clientY;
                startTop = parseInt(button.style.top) || 200; // 默认位置200px
                button.style.cursor = 'grabbing';
                button.style.transition = 'none'; // 拖拽时禁用过渡动画
                
                // 拖拽开始时禁用整个页面滚动
                document.body.style.overflow = 'hidden';
                document.body.style.touchAction = 'none';
                
                // 阻止默认行为和事件冒泡
                e.preventDefault();
                e.stopPropagation();
            }, 300); // 0.3秒后触发拖拽
        } else {
            // 大屏状态：记录起始位置，但不立即触发拖拽
            startY = e.clientY;
            startTop = parseInt(button.style.top) || 200; // 默认位置200px
            
            // 阻止默认行为和事件冒泡
            e.preventDefault();
            e.stopPropagation();
        }
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) {
            // 大屏状态：检查是否应该开始拖拽
            if (window.innerWidth > 768 && startY !== undefined) {
                const deltaY = Math.abs(e.clientY - startY);
                // 当移动距离超过5px时开始拖拽
                if (deltaY > 5) {
                    isDragging = true;
                    button.style.cursor = 'grabbing';
                    button.style.transition = 'none'; // 拖拽时禁用过渡动画
                } else {
                    return; // 移动距离太小，不触发拖拽
                }
            } else {
                return;
            }
        }
        
        const deltaY = e.clientY - startY;
        let newTop = startTop + deltaY;
        
        // 限制拖拽范围在屏幕内
        const minTop = 50; // 距离顶部最小距离
        const maxTop = window.innerHeight - 50; // 距离底部最小距离
        
        newTop = Math.max(minTop, Math.min(maxTop, newTop));
        
        button.style.top = newTop + 'px';
    });
    
    document.addEventListener('mouseup', () => {
        // 清理拖拽计时器
        if (dragTimer) {
            clearTimeout(dragTimer);
            dragTimer = null;
        }
        
        // 清理起始位置变量
        startY = undefined;
        startTop = undefined;
        
        if (isDragging) {
            isDragging = false;
            button.style.cursor = 'grab';
            button.style.transition = 'opacity 0.3s ease 0.5s'; // 恢复过渡动画
            
            // 拖拽结束时恢复整个页面滚动
            document.body.style.overflow = '';
            document.body.style.touchAction = '';
            
            // 拖拽结束后1秒内禁止点击事件
            isClickDisabled = true;
            setTimeout(() => {
                isClickDisabled = false;
            }, 1000);
        }
    });
    
    // 触摸设备支持
    button.addEventListener('touchstart', (e) => {
        if (window.innerWidth <= 768) {
            // 小屏状态：设置0.3秒后触发拖拽
            dragTimer = setTimeout(() => {
                isDragging = true;
                startY = e.touches[0].clientY;
                startTop = parseInt(button.style.top) || 200;
                button.style.transition = 'none';
                
                // 拖拽开始时禁用整个页面滚动
                document.body.style.overflow = 'hidden';
                document.body.style.touchAction = 'none';
                
                e.preventDefault();
            }, 300); // 0.3秒后触发拖拽
        } else {
            // 大屏状态：记录起始位置，但不立即触发拖拽
            startY = e.touches[0].clientY;
            startTop = parseInt(button.style.top) || 200;
            
            e.preventDefault();
        }
    });
    
    document.addEventListener('touchmove', (e) => {
        if (!isDragging) {
            // 大屏状态：检查是否应该开始拖拽
            if (window.innerWidth > 768 && startY !== undefined) {
                const deltaY = Math.abs(e.touches[0].clientY - startY);
                // 当移动距离超过5px时开始拖拽
                if (deltaY > 5) {
                    isDragging = true;
                    button.style.transition = 'none'; // 拖拽时禁用过渡动画
                } else {
                    return; // 移动距离太小，不触发拖拽
                }
            } else {
                return;
            }
        }
        
        const deltaY = e.touches[0].clientY - startY;
        let newTop = startTop + deltaY;
        
        const minTop = 50;
        const maxTop = window.innerHeight - 50;
        
        newTop = Math.max(minTop, Math.min(maxTop, newTop));
        
        button.style.top = newTop + 'px';
    });
    
    document.addEventListener('touchend', () => {
        // 清理拖拽计时器
        if (dragTimer) {
            clearTimeout(dragTimer);
            dragTimer = null;
        }
        
        // 清理起始位置变量
        startY = undefined;
        startTop = undefined;
        
        if (isDragging) {
            isDragging = false;
            button.style.transition = 'opacity 0.3s ease 0.5s';
            
            // 拖拽结束时恢复整个页面滚动
            document.body.style.overflow = '';
            document.body.style.touchAction = '';
            
            // 拖拽结束后1秒内禁止点击事件
            isClickDisabled = true;
            setTimeout(() => {
                isClickDisabled = false;
            }, 1000);
        }
    });
    
    // 设置初始光标样式
    button.style.cursor = 'grab';
}

// 窗口大小改变时调整目录状态
    window.addEventListener('resize', () => {
        if (window.innerWidth <= 768) {
            // 移动端：如果目录是展开状态，则收起目录
            if (!isSidebarCollapsed) {
                collapseSidebar();
            }
        } else {
            // 桌面端：如果目录是收起状态，则展开目录
            if (isSidebarCollapsed) {
                expandSidebar();
            }
        }
    });

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', () => {
    loadArticleContent();
    initSidebar();
    initImagePreviewModal();
    initShareSection();
});


// ==================== 图片预览功能 ====================

// 文章图片加载失败时的占位图
const ARTICLE_IMAGE_FALLBACK = '/css/all/notfound.png';

// 图片预览缩放和拖动状态
let imagePreviewScale = 1;          // 当前缩放比例
let imagePreviewInitialScale = 1;   // 初始缩放比例（最小值）
let imagePreviewOffsetX = 0;        // 水平偏移
let imagePreviewOffsetY = 0;        // 垂直偏移
let imagePreviewDragging = false;   // 是否正在拖动
let imagePreviewDragStartX = 0;     // 拖动起始 X
let imagePreviewDragStartY = 0;     // 拖动起始 Y
let imagePreviewDragOffsetX = 0;    // 拖动起始时的水平偏移
let imagePreviewDragOffsetY = 0;    // 拖动起始时的垂直偏移
let imagePreviewScaleHintTimer = null; // 缩放提示隐藏定时器
let imagePreviewWasDragged = false; // 是否发生过拖动移动（用于阻止 click 关闭）
let imagePreviewPinching = false;   // 是否正在双指缩放
let imagePreviewPinchStartDist = 0; // 双指缩放起始距离
let imagePreviewPinchStartScale = 0; // 双指缩放起始时的缩放比例
let imagePreviewPinchStartOffsetX = 0; // 双指缩放起始时的水平偏移
let imagePreviewPinchStartOffsetY = 0; // 双指缩放起始时的垂直偏移

// ==================== 自定义音频播放器 ====================

const AUDIO_PLAY_ICON_SVG = '<svg class="custom-audio-icon-play" width="14" height="14" viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg"><path d="M3 2 L11 7 L3 12 Z" fill="currentColor"/></svg>';
const AUDIO_PAUSE_ICON_SVG = '<svg width="14" height="14" viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="2" width="3" height="10" rx="0.5" fill="currentColor"/><rect x="8" y="2" width="3" height="10" rx="0.5" fill="currentColor"/></svg>';

function formatAudioTime(seconds) {
    if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
}

// 为文章内所有 audio 元素创建自定义播放器
function initCustomAudioPlayers() {
    const articleContent = document.getElementById('articleContent');
    const aiSummaryContent = document.getElementById('aiSummaryContent');
    if (!articleContent) return;

    const audioList = [];
    articleContent.querySelectorAll('audio').forEach(a => audioList.push(a));
    if (aiSummaryContent) {
        aiSummaryContent.querySelectorAll('audio').forEach(a => audioList.push(a));
    }

    audioList.forEach(audio => {
        if (audio.dataset.customPlayerBound === '1') return;
        audio.dataset.customPlayerBound = '1';
        wrapAudioWithCustomPlayer(audio);
    });
}

function wrapAudioWithCustomPlayer(audio) {
    // 移除原生控件并启用元数据预加载
    audio.removeAttribute('controls');
    audio.preload = 'metadata';

    const player = document.createElement('div');
    player.className = 'custom-audio-player';

    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.className = 'custom-audio-play';
    playBtn.setAttribute('aria-label', '播放');
    playBtn.innerHTML = AUDIO_PLAY_ICON_SVG;

    const progressContainer = document.createElement('div');
    progressContainer.className = 'custom-audio-progress';
    progressContainer.setAttribute('role', 'slider');
    progressContainer.setAttribute('aria-label', '音频进度');
    progressContainer.setAttribute('tabindex', '0');
    progressContainer.setAttribute('aria-valuemin', '0');
    progressContainer.setAttribute('aria-valuemax', '100');
    progressContainer.setAttribute('aria-valuenow', '0');

    const progressBar = document.createElement('div');
    progressBar.className = 'custom-audio-progress-bar';
    progressContainer.appendChild(progressBar);

    // 可拖动的黑色圆点
    const progressHandle = document.createElement('div');
    progressHandle.className = 'custom-audio-progress-handle';
    progressContainer.appendChild(progressHandle);

    const timeDisplay = document.createElement('span');
    timeDisplay.className = 'custom-audio-time';
    timeDisplay.textContent = '0:00 / 0:00';

    player.appendChild(playBtn);
    player.appendChild(progressContainer);
    player.appendChild(timeDisplay);

    // 把播放器插入到 audio 之前，再把 audio 移进播放器内（隐藏但保留功能）
    audio.parentNode.insertBefore(player, audio);
    player.appendChild(audio);

    // 拖动状态：拖动期间 timeupdate 不应覆盖视觉，避免跳回
    let isDragging = false;

    function applyProgressVisual(percent) {
        const clamped = Math.max(0, Math.min(1, percent));
        const percentValue = clamped * 100;
        progressBar.style.width = percentValue + '%';
        progressHandle.style.left = percentValue + '%';
        progressContainer.setAttribute('aria-valuenow', String(Math.round(percentValue)));
    }

    function updateTimeAndProgress() {
        if (!isFinite(audio.duration) || audio.duration <= 0) return;
        applyProgressVisual(audio.currentTime / audio.duration);
        timeDisplay.textContent = formatAudioTime(audio.currentTime) + ' / ' + formatAudioTime(audio.duration);
    }

    // 共用：把百分比转换为 currentTime 并立即更新视觉
    function seekToPercent(percent) {
        const clamped = Math.max(0, Math.min(1, percent));
        if (isFinite(audio.duration) && audio.duration > 0) {
            audio.currentTime = clamped * audio.duration;
        }
        applyProgressVisual(clamped);
    }

    function clientXToPercent(clientX) {
        const rect = progressContainer.getBoundingClientRect();
        return (clientX - rect.left) / rect.width;
    }

    playBtn.addEventListener('click', () => {
        if (audio.paused) {
            const p = audio.play();
            if (p && typeof p.catch === 'function') p.catch(() => {});
        } else {
            audio.pause();
        }
    });

    audio.addEventListener('play', () => {
        playBtn.innerHTML = AUDIO_PAUSE_ICON_SVG;
        playBtn.setAttribute('aria-label', '暂停');
    });
    audio.addEventListener('pause', () => {
        playBtn.innerHTML = AUDIO_PLAY_ICON_SVG;
        playBtn.setAttribute('aria-label', '播放');
    });
    audio.addEventListener('ended', () => {
        playBtn.innerHTML = AUDIO_PLAY_ICON_SVG;
        playBtn.setAttribute('aria-label', '播放');
    });

    audio.addEventListener('loadedmetadata', () => {
        timeDisplay.textContent = '0:00 / ' + formatAudioTime(audio.duration);
    });

    audio.addEventListener('timeupdate', () => {
        // 拖动期间跳过 timeupdate，避免圆点跳回实际播放位置（与拖动目标不一致）
        if (isDragging) return;
        updateTimeAndProgress();
    });

    audio.addEventListener('error', () => {
        timeDisplay.textContent = '加载失败';
        playBtn.disabled = true;
    });

    // 点击进度条（圆点外的区域）跳转
    progressContainer.addEventListener('click', (e) => {
        if (e.target === progressHandle) return;
        seekToPercent(clientXToPercent(e.clientX));
    });

    // 圆点拖动：使用 mouse + touch events
    // 不用 pointer events 是因为 setPointerCapture 会让浏览器抑制 mousemove，
    // 同时 pointer events 在部分移动端浏览器也不稳定

    // 鼠标拖动：mousedown 在圆点，mousemove/mouseup 在 document，
    // 这样鼠标移到圆点外仍能继续接收事件
    progressHandle.addEventListener('mousedown', (e) => {
        isDragging = true;
        progressHandle.classList.add('dragging');
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        seekToPercent(clientXToPercent(e.clientX));
    });

    document.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        progressHandle.classList.remove('dragging');
        // 拖动结束后把视觉同步到实际的 currentTime（可能与拖动目标有微小差异）
        updateTimeAndProgress();
    });

    // 触摸拖动：CSS 上 touch-action: none 阻止浏览器把触摸解释为滚动/缩放
    // 这里不需要 preventDefault，让 click 事件在轻触时仍能正常触发
    progressHandle.addEventListener('touchstart', () => {
        isDragging = true;
        progressHandle.classList.add('dragging');
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        seekToPercent(clientXToPercent(e.touches[0].clientX));
    }, { passive: true });

    document.addEventListener('touchend', () => {
        if (!isDragging) return;
        isDragging = false;
        progressHandle.classList.remove('dragging');
        updateTimeAndProgress();
    });

    document.addEventListener('touchcancel', () => {
        if (!isDragging) return;
        isDragging = false;
        progressHandle.classList.remove('dragging');
        updateTimeAndProgress();
    });

    // 键盘控制进度（左右键步进 5s，Shift 加速到 10s）
    progressContainer.addEventListener('keydown', (e) => {
        if (!isFinite(audio.duration) || audio.duration <= 0) return;
        const step = e.shiftKey ? 10 : 5;
        if (e.key === 'ArrowLeft') {
            audio.currentTime = Math.max(0, audio.currentTime - step);
            e.preventDefault();
        } else if (e.key === 'ArrowRight') {
            audio.currentTime = Math.min(audio.duration, audio.currentTime + step);
            e.preventDefault();
        } else if (e.key === ' ' || e.key === 'Enter') {
            playBtn.click();
            e.preventDefault();
        }
    });
}

// 为文章内所有图片绑定点击预览与加载失败占位
function initImagePreview() {
    const articleContent = document.getElementById('articleContent');
    const aiSummaryContent = document.getElementById('aiSummaryContent');
    if (!articleContent) return;

    const imageList = [];
    articleContent.querySelectorAll('img').forEach(img => imageList.push(img));
    if (aiSummaryContent) {
        aiSummaryContent.querySelectorAll('img').forEach(img => imageList.push(img));
    }

    imageList.forEach(img => {
        // 避免重复绑定
        if (img.dataset.previewBound === '1') return;
        img.dataset.previewBound = '1';
        img.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openImagePreview(img.currentSrc || img.src, img.alt);
        });
        // 图片加载失败时显示占位图，防止与占位图自身形成循环
        img.addEventListener('error', () => {
            if (img.dataset.fallbackApplied === '1') return;
            if (img.src && img.src.includes(ARTICLE_IMAGE_FALLBACK)) return;
            img.dataset.fallbackApplied = '1';
            img.src = ARTICLE_IMAGE_FALLBACK;
        });
    });
}

// 打开图片预览
function openImagePreview(src, alt) {
    const modal = document.getElementById('imagePreviewModal');
    const previewImg = document.getElementById('imagePreviewImg');
    if (!modal || !previewImg || !src) return;

    // 重置缩放和拖动状态
    imagePreviewScale = 1;
    imagePreviewInitialScale = 1;
    imagePreviewOffsetX = 0;
    imagePreviewOffsetY = 0;
    imagePreviewDragging = false;
    imagePreviewPinching = false;
    previewImg.classList.remove('draggable', 'dragging');
    updateImagePreviewTransform(previewImg);

    previewImg.src = src;
    previewImg.alt = alt || '图片预览';
    // 重置占位图标志，让本次新 src 的 error 事件能正常触发
    delete previewImg.dataset.fallbackApplied;

    // 禁用背景滚动（body 和文章滚动容器）
    document.body.style.overflow = 'hidden';
    const centerSection = document.getElementById('centerSection');
    if (centerSection) {
        centerSection.style.overflow = 'hidden';
    }

    // 先设为 flex 触发 display 切换，再下一帧添加 show 触发过渡
    modal.style.display = 'flex';
    // 强制重排，确保 opacity 过渡生效
    void modal.offsetHeight;
    modal.classList.remove('hiding');
    modal.classList.add('show');
}

// 关闭图片预览
function closeImagePreview() {
    const modal = document.getElementById('imagePreviewModal');
    if (!modal || !modal.classList.contains('show')) return;

    // 清理缩放提示定时器
    if (imagePreviewScaleHintTimer) {
        clearTimeout(imagePreviewScaleHintTimer);
        imagePreviewScaleHintTimer = null;
    }
    hideScaleHint();

    modal.classList.add('hiding');
    modal.classList.remove('show');

    setTimeout(() => {
        // 若在关闭动画期间用户重新打开了预览，则不要清理
        if (!modal.classList.contains('hiding')) return;

        modal.style.display = 'none';
        modal.classList.remove('hiding');
        // 清空 src 释放内存
        const previewImg = document.getElementById('imagePreviewImg');
        if (previewImg) {
            previewImg.src = '';
            previewImg.classList.remove('draggable', 'dragging');
        }
        // 恢复背景滚动
        document.body.style.overflow = '';
        const centerSection = document.getElementById('centerSection');
        if (centerSection) {
            centerSection.style.overflow = '';
        }
        // 重置状态
        imagePreviewScale = 1;
        imagePreviewOffsetX = 0;
        imagePreviewOffsetY = 0;
        imagePreviewDragging = false;
        imagePreviewPinching = false;
    }, 300);
}

// 初始化图片预览模态框的关闭交互
function initImagePreviewModal() {
    const modal = document.getElementById('imagePreviewModal');
    const closeBtn = document.getElementById('imagePreviewClose');
    const previewImg = document.getElementById('imagePreviewImg');
    if (!modal) return;

    // 预览图自身加载失败时也显示占位图
    if (previewImg) {
        previewImg.addEventListener('error', () => {
            if (previewImg.dataset.fallbackApplied === '1') return;
            if (previewImg.src && previewImg.src.includes(ARTICLE_IMAGE_FALLBACK)) return;
            previewImg.dataset.fallbackApplied = '1';
            previewImg.src = ARTICLE_IMAGE_FALLBACK;
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeImagePreview();
        });
    }

    // 点击遮罩空白处或图片本身关闭（点击关闭按钮已通过 stopPropagation 阻止冒泡）
    modal.addEventListener('click', (e) => {
        // 如果刚刚拖动过，阻止关闭
        if (imagePreviewWasDragged) {
            imagePreviewWasDragged = false;
            return;
        }
        if (imagePreviewDragging) return; // 拖动时不关闭
        if (e.target === modal || e.target === previewImg) {
            closeImagePreview();
        }
    });

    // ESC 键关闭
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('show')) {
            closeImagePreview();
        }
    });

    // 鼠标滚轮缩放（支持普通滚轮和 Ctrl+滚轮）
    modal.addEventListener('wheel', (e) => {
        if (!modal.classList.contains('show') || !previewImg) return;
        e.preventDefault();

        // 计算缩放因子，每次滚动改变 10%
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const newScale = Math.max(imagePreviewInitialScale, imagePreviewScale + delta);

        // 如果缩放比例变化
        if (newScale !== imagePreviewScale) {
            // 如果是缩小到初始大小，重置位置并取消拖动
            if (newScale === imagePreviewInitialScale) {
                imagePreviewOffsetX = 0;
                imagePreviewOffsetY = 0;
                previewImg.classList.remove('draggable');
            } else {
                // 放大时允许拖动
                previewImg.classList.add('draggable');
            }

            imagePreviewScale = newScale;
            updateImagePreviewTransform(previewImg);
            showScaleHint(newScale);
        }
    }, { passive: false });

    // 图片拖动开始（在模态框上监听，手机端整个区域都可操作）
    if (previewImg) {
        // 鼠标拖动（只在图片上）
        previewImg.addEventListener('mousedown', (e) => {
            if (!previewImg.classList.contains('draggable')) return;
            e.preventDefault();
            e.stopPropagation();

            imagePreviewDragging = true;
            imagePreviewWasDragged = false; // 重置拖动标志
            imagePreviewDragStartX = e.clientX;
            imagePreviewDragStartY = e.clientY;
            imagePreviewDragOffsetX = imagePreviewOffsetX;
            imagePreviewDragOffsetY = imagePreviewOffsetY;
            previewImg.classList.add('dragging');
        });
    }

    // 触摸事件绑定到模态框（整个区域都可操作）
    modal.addEventListener('touchstart', (e) => {
        // 双指缩放开始（无论是否已放大都可以缩放）
        if (e.touches.length === 2) {
            imagePreviewPinching = true;
            imagePreviewPinchStartDist = getPinchDistance(e.touches);
            imagePreviewPinchStartScale = imagePreviewScale;
            imagePreviewPinchStartOffsetX = imagePreviewOffsetX;
            imagePreviewPinchStartOffsetY = imagePreviewOffsetY;
            imagePreviewWasDragged = true; // 阻止后续 click 关闭
            return;
        }

        // 单指拖动（仅在放大后可拖动）
        if (e.touches.length === 1 && previewImg && previewImg.classList.contains('draggable')) {
            imagePreviewDragging = true;
            imagePreviewWasDragged = false;
            const touch = e.touches[0];
            imagePreviewDragStartX = touch.clientX;
            imagePreviewDragStartY = touch.clientY;
            imagePreviewDragOffsetX = imagePreviewOffsetX;
            imagePreviewDragOffsetY = imagePreviewOffsetY;
            previewImg.classList.add('dragging');
        }
    }, { passive: true });

    // 计算双指间距
    function getPinchDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // 图片拖动移动（在 document 上监听）
    // 鼠标移动
    document.addEventListener('mousemove', (e) => {
        if (!imagePreviewDragging || !previewImg) return;

        const dx = e.clientX - imagePreviewDragStartX;
        const dy = e.clientY - imagePreviewDragStartY;
        // 如果发生了移动，标记 wasDragged
        if (dx !== 0 || dy !== 0) {
            imagePreviewWasDragged = true;
        }
        imagePreviewOffsetX = imagePreviewDragOffsetX + dx;
        imagePreviewOffsetY = imagePreviewDragOffsetY + dy;
        updateImagePreviewTransform(previewImg);
    });

    // 触摸移动
    document.addEventListener('touchmove', (e) => {
        if (!previewImg) return;

        // 双指缩放
        if (imagePreviewPinching && e.touches.length === 2) {
            const currentDist = getPinchDistance(e.touches);
            const scaleRatio = currentDist / imagePreviewPinchStartDist;
            let newScale = imagePreviewPinchStartScale * scaleRatio;

            // 如果缩小到初始大小（使用阈值避免浮点精度问题）
            if (newScale <= imagePreviewInitialScale) {
                newScale = imagePreviewInitialScale;
                imagePreviewOffsetX = 0;
                imagePreviewOffsetY = 0;
                previewImg.classList.remove('draggable');
            } else {
                // 放大状态，随着 scale 变化按比例调整 offset（让图片以屏幕中心为基准缩放）
                // offset 按相同比例调整（越小越接近中心）
                imagePreviewOffsetX = imagePreviewPinchStartOffsetX * scaleRatio;
                imagePreviewOffsetY = imagePreviewPinchStartOffsetY * scaleRatio;
                previewImg.classList.add('draggable');
            }

            if (newScale !== imagePreviewScale) {
                imagePreviewScale = newScale;
                updateImagePreviewTransform(previewImg);
                showScaleHint(newScale);
            }
            return;
        }

        // 单指拖动
        if (!imagePreviewDragging) return;

        const touch = e.touches[0];
        const dx = touch.clientX - imagePreviewDragStartX;
        const dy = touch.clientY - imagePreviewDragStartY;
        if (dx !== 0 || dy !== 0) {
            imagePreviewWasDragged = true;
        }
        imagePreviewOffsetX = imagePreviewDragOffsetX + dx;
        imagePreviewOffsetY = imagePreviewDragOffsetY + dy;
        updateImagePreviewTransform(previewImg);
    }, { passive: true });

    // 图片拖动结束（在 document 上监听）
    // 鼠标结束
    document.addEventListener('mouseup', () => {
        if (!imagePreviewDragging || !previewImg) return;

        imagePreviewDragging = false;
        previewImg.classList.remove('dragging');
    });

    // 触摸结束
    document.addEventListener('touchend', (e) => {
        if (!previewImg) return;

        // 双指缩放结束
        if (imagePreviewPinching) {
            imagePreviewPinching = false;
            // 如果缩放后仍然大于初始大小，允许拖动
            if (imagePreviewScale > imagePreviewInitialScale) {
                previewImg.classList.add('draggable');
            }
            return;
        }

        // 单指拖动结束
        if (!imagePreviewDragging) return;

        imagePreviewDragging = false;
        previewImg.classList.remove('dragging');
    });

    // 触摸取消
    document.addEventListener('touchcancel', (e) => {
        if (!previewImg) return;

        // 双指缩放取消
        if (imagePreviewPinching) {
            imagePreviewPinching = false;
            if (imagePreviewScale > imagePreviewInitialScale) {
                previewImg.classList.add('draggable');
            }
            return;
        }

        // 单指拖动取消
        if (!imagePreviewDragging) return;

        imagePreviewDragging = false;
        previewImg.classList.remove('dragging');
    });
}

// 更新图片预览的 transform
function updateImagePreviewTransform(img) {
    if (!img) return;
    // 当回到初始大小且偏移为0时，清除 transform 让 CSS flexbox 居中生效
    if (imagePreviewScale === imagePreviewInitialScale && imagePreviewOffsetX === 0 && imagePreviewOffsetY === 0) {
        img.style.transform = '';
    } else {
        img.style.transform = `translate(${imagePreviewOffsetX}px, ${imagePreviewOffsetY}px) scale(${imagePreviewScale})`;
    }
}

// 显示缩放提示
function showScaleHint(scale) {
    const hint = document.getElementById('imagePreviewScaleHint');
    if (!hint) return;

    hint.textContent = Math.round(scale * 100) + '%';
    hint.classList.add('show');

    // 清理旧的定时器
    if (imagePreviewScaleHintTimer) {
        clearTimeout(imagePreviewScaleHintTimer);
    }

    // 1.5 秒后隐藏
    imagePreviewScaleHintTimer = setTimeout(() => {
        hideScaleHint();
    }, 1500);
}

// 隐藏缩放提示
function hideScaleHint() {
    const hint = document.getElementById('imagePreviewScaleHint');
    if (hint) {
        hint.classList.remove('show');
    }
}

// ==================== 附件查看信息按钮 ====================

// 格式化文件大小（B/KB/MB/GB）
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

// 格式化 ISO8601 时间为本地友好格式
function formatDateTime(isoString) {
    const d = new Date(isoString);
    return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// 判断是否为本地资源
function isLocalResource(url) {
    try {
        const resolved = new URL(url, location.href);
        return resolved.origin === location.origin && resolved.pathname.startsWith('/res/');
    } catch {
        return false;
    }
}

// 小对话框提示（关闭评论区时不加载 showsmalldialog.js，这里做存在性判断）
function attachmentToast(message, type) {
    if (typeof showSmallDialog === 'function') {
        showSmallDialog(message, type);
    }
}

// 查询 MD5 并轮询结果
async function queryMD5(url, md5Element) {
    const maxRetries = 30;
    let retries = 0;

    while (retries < maxRetries) {
        try {
            const encodedUrl = encodeURIComponent(url);
            const res = await fetch(`/api/attachment/md5?url=${encodedUrl}`);
            const data = await res.json();

            if (data.status === 'done') {
                attachmentToast('查询成功', 'success');
                md5Element.textContent = data.md5;
                return;
            } else if (data.status === 'calculating') {
                // 等待 1 秒后重试
                await new Promise(resolve => setTimeout(resolve, 1000));
                retries++;
            } else if (data.error) {
                attachmentToast(data.error, 'error');
                md5Element.textContent = '查询';
                md5Element.className = 'md5-query-link';
                return;
            }
        } catch (e) {
            attachmentToast('查询失败', 'error');
            md5Element.textContent = '查询';
            md5Element.className = 'md5-query-link';
            return;
        }
    }

    attachmentToast('查询超时', 'error');
    md5Element.textContent = '查询';
    md5Element.className = 'md5-query-link';
}

// 初始化附件信息按钮
async function initAttachmentInfoButtons() {
    const articleContent = document.getElementById('articleContent');
    const aiSummaryContent = document.getElementById('aiSummaryContent');
    if (!articleContent) return;

    const attachments = [];
    articleContent.querySelectorAll('.download-attachment').forEach(a => attachments.push(a));
    if (aiSummaryContent) {
        aiSummaryContent.querySelectorAll('.download-attachment').forEach(a => attachments.push(a));
    }

    attachments.forEach(attachment => {
        const infoButton = attachment.querySelector('.info-button');
        const details = attachment.querySelector('.attachment-details');
        if (!infoButton || !details) return;

        // 防止重复绑定
        if (infoButton.dataset.infoBound === '1') return;
        infoButton.dataset.infoBound = '1';

        infoButton.addEventListener('click', async () => {
            const isExpanded = !details.hidden;

            if (isExpanded) {
                // 收起
                details.hidden = true;
                infoButton.textContent = '查看信息';
            } else {
                // 展开
                details.hidden = false;
                infoButton.textContent = '收起信息';

                const url = infoButton.dataset.url;
                if (!isLocalResource(url)) {
                    details.innerHTML = '<span style="color: rgba(255,255,255,0.7);">非本地资源无法查看</span>';
                    return;
                }

                // 调用后端 API
                try {
                    const encodedUrl = encodeURIComponent(url);
                    const res = await fetch(`/api/attachment/info?url=${encodedUrl}`);
                    const data = await res.json();

                    if (!res.ok) {
                        details.innerHTML = `<span style="color: rgba(255,255,255,0.7);">${data.error || '获取信息失败'}</span>`;
                        return;
                    }

                    // 渲染四行信息
                    details.innerHTML = `
                        <span>创建日期：${formatDateTime(data.created_at)}</span>
                        <span>修改日期：${formatDateTime(data.modified_at)}</span>
                        <span>大小：${formatFileSize(data.size)}</span>
                        <span>MD5：<a href="#" class="md5-query-link">查询</a></span>
                    `;

                    // 绑定 MD5 链接点击事件
                    const md5Link = details.querySelector('.md5-query-link');
                    if (md5Link) {
                        md5Link.addEventListener('click', async (e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            // 创建一个 span 来显示 MD5 值（CSS 设置 display: inline 不换行）
                            const md5Span = document.createElement('span');
                            md5Span.className = 'md5-value';
                            md5Span.textContent = '查询中...';
                            md5Link.replaceWith(md5Span);
                            await queryMD5(url, md5Span);
                        });
                    }
                } catch (err) {
                    details.innerHTML = '<span style="color: rgba(255,255,255,0.7);">获取信息失败</span>';
                }
            }
        });
    });
}
