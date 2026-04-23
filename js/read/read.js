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
        const response = await fetch(`/read/${category}/${articleId}/content`);
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
        
    } catch (error) {
        console.error('加载文章内容失败:', error);
        document.getElementById('articleContent').innerHTML = '<p class="error">文章加载失败</p>';
    }
}

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
        
        // 获取当前文章的分类和ID
        const { category, articleId } = getArticleInfo();
        
        // 构建带版权信息的文本
        const copyrightText = `\n------\n博客内容由manyJ版权所有\n原文链接：https://blog.jsoftstudio.top/read/${category}/${articleId}\n采用CC BY-NC-SA 4.0许可协议\n复制时间：${timeString}`;
        const modifiedText = selectedText + copyrightText;
        
        // 将修改后的文本写入剪贴板
        event.clipboardData.setData('text/plain', modifiedText);
    }
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
    fetch('/blog')
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
            `/blog/${encodeURIComponent(currentDirectoryCategory)}` : '/blog';
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
            `<img src="/read/${article.category}/${article.id}/icon" alt="${article.title}" class="article-icon">` :
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
});