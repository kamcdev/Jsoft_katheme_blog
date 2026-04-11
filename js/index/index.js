// 全局变量
let currentCategory = null;
let categories = [];

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
function switchCategory(category) {
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
    loadBlogList(category);
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
    loadCategories();
    loadFriendlyLinks();
});