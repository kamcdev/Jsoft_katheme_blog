// 全局变量
let currentCategory = null;
let categories = [];

// 格式化日期显示
function formatDate(dateStr) {
    if (!dateStr) return '';
    return dateStr;
}

// 开场动画控制
function initWelcomeAnimation() {
    const welcomeScreen = document.getElementById('welcome-screen');
    const mainContent = document.getElementById('main-content');
    
    // 如果开场页面不存在，直接显示主内容
    if (!welcomeScreen) {
        mainContent.style.display = 'flex';
        mainContent.classList.add('fade-in');
        
        // 显示文章内容容器和友链容器
        const blogListContainer = document.querySelector('.center-section:first-of-type');
        const friendlyLinksContainer = document.querySelector('.center-section:last-of-type');
        
        blogListContainer.classList.add('fade-in');
        friendlyLinksContainer.classList.add('fade-in');
        
        // 文章项依次从下往上飞入
        setTimeout(() => {
            const blogItems = document.querySelectorAll('.blog-item');
            blogItems.forEach((item, index) => {
                setTimeout(() => {
                    item.classList.add('fly-in');
                }, index * 100); // 每个文章项间隔0.1秒
            });
        }, 500); // 容器渐显后0.5秒开始文章项飞入
        
        // 友链依次在0.3s内渐显
        setTimeout(() => {
            const friendlyLinks = document.querySelectorAll('.friendly-link-item');
            friendlyLinks.forEach((link, index) => {
                setTimeout(() => {
                    link.classList.add('fade-in');
                }, index * 100); // 每个友链间隔0.1秒
            });
        }, 300); // 容器渐显后0.3秒开始友链渐显
        
        return;
    }
    
    const welcomeContent = welcomeScreen.querySelector('.welcome-content');
    const enterBtn = document.getElementById('enter-btn');
    
    // 点击进入按钮
    enterBtn.addEventListener('click', function() {
        // 禁用按钮防止重复点击
        enterBtn.disabled = true;
        
        // 按顺序渐隐元素：按钮→图标→主标题→副标题
        const elements = [
            enterBtn,
            welcomeContent.querySelector('.welcome-icon'),
            welcomeContent.querySelector('.welcome-title'),
            welcomeContent.querySelector('.welcome-subtitle')
        ];
        
        // 依次渐隐每个元素
        elements.forEach((element, index) => {
            setTimeout(() => {
                element.classList.add('fade-out');
            }, index * 150); // 每个元素间隔0.15秒（加快）
        });
        
        // 所有元素渐隐完成后，隐藏开场页面
        setTimeout(() => {
            // 隐藏开场页面
            welcomeScreen.classList.add('fade-out');
            
            // 开场页面完全隐藏后，开始显示主内容
            setTimeout(() => {
                // 显示主内容容器
                mainContent.style.display = 'flex';
                mainContent.classList.add('fade-in');
                
                // 文章内容容器和友链容器同时在0.5s内渐显
                const blogListContainer = document.querySelector('.center-section:first-of-type');
                const friendlyLinksContainer = document.querySelector('.center-section:last-of-type');
                
                blogListContainer.classList.add('fade-in');
                friendlyLinksContainer.classList.add('fade-in');
                
                // 随后文章项依次从下往上飞入
                setTimeout(() => {
                    const blogItems = document.querySelectorAll('.blog-item');
                    blogItems.forEach((item, index) => {
                        setTimeout(() => {
                            item.classList.add('fly-in');
                        }, index * 100); // 每个文章项间隔0.1秒
                    });
                }, 500); // 容器渐显后0.5秒开始文章项飞入
                
                // 友链依次在0.3s内渐显
                setTimeout(() => {
                    const friendlyLinks = document.querySelectorAll('.friendly-link-item');
                    friendlyLinks.forEach((link, index) => {
                        setTimeout(() => {
                            link.classList.add('fade-in');
                        }, index * 100); // 每个友链间隔0.1秒
                    });
                }, 300); // 容器渐显后0.3秒开始友链渐显
                
                // 完全移除开场页面
                setTimeout(() => {
                    welcomeScreen.remove();
                }, 1000); // 延长等待时间确保动画完成
            }, 500); // 开场页面隐藏后等待0.5秒开始主内容动画
        }, elements.length * 150 + 300); // 等待所有元素渐隐完成（加快）
    });
}

// 初始化分类标签页
function initCategoryTabs() {
    const tabsContainer = document.getElementById('categoryTabsContainer');
    const prevBtn = document.getElementById('categoryTabsPrev');
    const nextBtn = document.getElementById('categoryTabsNext');
    
    // 清空容器
    tabsContainer.innerHTML = '';
    
    // 首先添加"全部"标签页
    const allTab = document.createElement('div');
    allTab.className = 'category-tab active';
    allTab.textContent = '全部';
    allTab.onclick = () => switchCategory('全部');
    tabsContainer.appendChild(allTab);
    
    // 设置当前分类为"全部"
    currentCategory = '全部';
    
    // 创建分类标签
    categories.forEach((category, index) => {
        const tab = document.createElement('div');
        tab.className = 'category-tab';
        tab.textContent = category;
        tab.onclick = () => switchCategory(category);
        tabsContainer.appendChild(tab);
    });
    
    // 添加左右滑动导航
    prevBtn.onclick = () => scrollTabs(-1);
    nextBtn.onclick = () => scrollTabs(1);
    
    // 添加鼠标拖动滚动功能
    addDragScroll(tabsContainer);
    
    // 初始加载文章列表（全部文章）
    loadBlogList(currentCategory);
}

// 切换分类
async function switchCategory(category) {
    if (currentCategory === category) return;
    
    // 更新当前分类
    currentCategory = category;
    
    // 更新标签状态
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.textContent === category) {
            tab.classList.add('active');
        }
    });
    
    // 加载新分类的文章
    await loadBlogList(category);
    
    // 为新加载的文章项应用飞入动画
    setTimeout(() => {
        const blogItems = document.querySelectorAll('.blog-item');
        blogItems.forEach((item, index) => {
            // 移除之前的动画类（如果有）
            item.classList.remove('fly-in');
            
            // 重新应用动画
            setTimeout(() => {
                item.classList.add('fly-in');
            }, index * 100); // 每个文章项间隔0.1秒
        });
    }, 100); // 短暂延迟确保DOM更新完成
}

// 滚动分类标签页
function scrollTabs(direction) {
    const container = document.getElementById('categoryTabsContainer');
    const scrollAmount = 200; // 每次滚动的距离
    
    if (direction === 1) {
        container.scrollLeft += scrollAmount;
    } else {
        container.scrollLeft -= scrollAmount;
    }
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

// 加载文章列表
async function loadBlogList(category = null) {
    try {
        const url = category ? `/blog/${encodeURIComponent(category)}` : '/blog';
        const response = await fetch(url);
        const data = await response.json();
        
        const blogList = document.getElementById('blogList');
        blogList.innerHTML = '';
        
        if (data.articles && data.articles.length > 0) {
            data.articles.forEach(article => {
                const articleElement = document.createElement('div');
                articleElement.className = 'blog-item';
                articleElement.onclick = () => {
                    window.location.href = `/read/${article.category}/${article.id}`;
                };
                
                let html = `
                    <div class="blog-item-content">
                        <div class="blog-icon">
                            ${article.has_icon ? 
                                `<img src="/read/${article.category}/${article.id}/icon" alt="${article.title}" />` : 
                                '<div class="default-icon">📄</div>'
                            }
                        </div>
                        <div class="blog-info">
                            <h3 class="blog-title">${article.title}</h3>
                            <p class="blog-small-title">${article.small_title}</p>
                            ${article.pub_date ? `<p class="blog-date">${formatDate(article.pub_date)}</p>` : ''}
                        </div>
                    </div>
                `;
                
                articleElement.innerHTML = html;
                blogList.appendChild(articleElement);
            });
        } else {
            blogList.innerHTML = '<p class="no-articles">暂无文章</p>';
        }
    } catch (error) {
        console.error('加载文章列表失败:', error);
        document.getElementById('blogList').innerHTML = '<p class="error">加载失败，请刷新页面</p>';
    }
}

// 获取分类列表
async function loadCategories() {
    try {
        const response = await fetch('/blog');
        const data = await response.json();
        
        categories = data.categories || [];
        
        if (categories.length > 0) {
            initCategoryTabs();
        } else {
            // 如果没有分类，直接加载文章列表
            loadBlogList();
        }
    } catch (error) {
        console.error('加载分类列表失败:', error);
        // 如果加载分类失败，直接加载文章列表
        loadBlogList();
    }
}

// 加载友情链接
async function loadFriendlyLinks() {
    try {
        const response = await fetch('/friendly_links.json');
        const friendlyLinks = await response.json();
        
        const linksList = document.getElementById('friendlyLinksList');
        
        if (Object.keys(friendlyLinks).length === 0) {
            linksList.innerHTML = '<p class="no-links">暂无友情链接</p>';
            return;
        }
        
        // 数组格式，直接按顺序显示
         const links = Array.isArray(friendlyLinks) ? friendlyLinks : [];
         
         // 清空现有内容
         linksList.innerHTML = '';
         
         // 添加友情链告
         links.forEach(link => {
             const linkItem = document.createElement('a');
             linkItem.className = 'friendly-link-item';
             linkItem.href = link.url;
             linkItem.textContent = link.name;
             linkItem.target = '_blank';
             linkItem.rel = 'noopener noreferrer';
             
             linksList.appendChild(linkItem);
         });
        
    } catch (error) {
        console.error('加载友情链接失败:', error);
        const linksList = document.getElementById('friendlyLinksList');
        linksList.innerHTML = '<p class="error">加载友情链接失败</p>';
    }
}

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', () => {
    // 初始化开场动画
    initWelcomeAnimation();
    
    // 加载分类和友情链接，但保持主内容隐藏
    loadCategories();
    loadFriendlyLinks();
});