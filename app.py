from flask import Flask, render_template, send_from_directory, request, jsonify, make_response, Response
import os
import json
import datetime
import markdown
import sqlite3
import hashlib
import secrets
import requests
import threading
import uuid
from markdown.extensions.codehilite import CodeHiliteExtension
from markdown.extensions.fenced_code import FencedCodeExtension
import mdx_math
from werkzeug.middleware.proxy_fix import ProxyFix

app = Flask(__name__)

# 配置反向代理支持
# 设置代理服务器的数量（根据实际反向代理层数调整）
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)

# 获取真实客户端IP的函数
def get_real_client_ip():
    """获取真实客户端IP地址，支持反向代理环境"""
    # 优先从X-Forwarded-For头获取IP
    if request.headers.get('X-Forwarded-For'):
        # X-Forwarded-For格式：client, proxy1, proxy2
        ips = request.headers.get('X-Forwarded-For', '').split(',')
        # 取第一个非空IP（即客户端IP）
        for ip in ips:
            ip = ip.strip()
            if ip and ip != 'unknown':
                return ip
    
    # 其次从X-Real-IP头获取
    if request.headers.get('X-Real-IP'):
        return request.headers.get('X-Real-IP')
    
    # 最后使用远程地址
    return request.remote_addr

# Markdown处理函数
def process_markdown_content(markdown_content):
    """处理Markdown内容，支持自定义符号和扩展功能"""
    # 预处理：处理自定义颜色和背景色控制符
    def process_color_controls(text):
        # 定义特殊颜色代码映射
        color_map = {
            'NONE': 'inherit',  # 恢复默认颜色
            'R': '#FF0000',     # 红色
            'G': '#00FF00',     # 绿色
            'B': '#0000FF',     # 蓝色
            'Y': '#FFFF00',     # 黄色
            'P': '#FFC0CB',     # 粉色
            'U': '#800080',     # 紫色
            'K': '#000000'      # 黑色
        }
        
        # 处理颜色控制符
        lines = text.split('\n')
        processed_lines = []
        
        for line in lines:
            # 跳过代码块中的内容
            if line.strip().startswith('```'):
                processed_lines.append(line)
                continue
            
            # 处理颜色和背景色控制符
            parts = []
            current_pos = 0
            current_color = None
            current_background = None
            
            while current_pos < len(line):
                # 查找下一个控制符（% 或 °）
                percent_pos = line.find('%', current_pos)
                degree_pos = line.find('°', current_pos)
                
                # 确定下一个控制符的位置和类型
                start_pos = -1
                control_type = None
                
                if percent_pos != -1 and degree_pos != -1:
                    if percent_pos < degree_pos:
                        start_pos = percent_pos
                        control_type = 'color'
                    else:
                        start_pos = degree_pos
                        control_type = 'background'
                elif percent_pos != -1:
                    start_pos = percent_pos
                    control_type = 'color'
                elif degree_pos != -1:
                    start_pos = degree_pos
                    control_type = 'background'
                
                if start_pos == -1:
                    # 没有更多控制符，添加剩余文本
                    remaining_text = line[current_pos:]
                    if remaining_text:
                        # 应用当前的颜色和背景色设置
                        styles = []
                        if current_color:
                            styles.append(f'color: {current_color}')
                        if current_background:
                            styles.append(f'background-color: {current_background}')
                        
                        if styles:
                            style_str = '; '.join(styles)
                            parts.append(f'<span style="{style_str}">{remaining_text}</span>')
                        else:
                            parts.append(remaining_text)
                    break
                
                # 添加控制符前的文本
                if current_pos < start_pos:
                    text_before = line[current_pos:start_pos]
                    if text_before:
                        # 应用当前的颜色和背景色设置
                        styles = []
                        if current_color:
                            styles.append(f'color: {current_color}')
                        if current_background:
                            styles.append(f'background-color: {current_background}')
                        
                        if styles:
                            style_str = '; '.join(styles)
                            parts.append(f'<span style="{style_str}">{text_before}</span>')
                        else:
                            parts.append(text_before)
                
                # 查找控制符结束位置
                end_char = '%' if control_type == 'color' else '°'
                end_pos = line.find(end_char, start_pos + 1)
                if end_pos == -1:
                    # 没有匹配的结束符，添加剩余文本
                    parts.append(line[start_pos:])
                    break
                
                # 提取颜色代码
                color_code = line[start_pos + 1:end_pos]
                
                # 处理颜色代码
                if color_code in color_map:
                    color_value = color_map[color_code]
                elif len(color_code) == 6 and all(c in '0123456789ABCDEFabcdef' for c in color_code):
                    color_value = f'#{color_code.upper()}'
                else:
                    # 无效颜色代码，保持原样
                    parts.append(line[start_pos:end_pos + 1])
                    current_pos = end_pos + 1
                    continue
                
                # 更新当前的颜色或背景色设置
                if control_type == 'color':
                    current_color = color_value if color_value != 'inherit' else None
                else:
                    current_background = color_value if color_value != 'inherit' else None
                
                # 移动到控制符结束位置之后
                current_pos = end_pos + 1
            
            processed_lines.append(''.join(parts))
        
        return '\n'.join(processed_lines)
    
    # 先处理颜色控制符
    processed_content = process_color_controls(markdown_content)
    
    # 转换Markdown为HTML，添加代码高亮、数学公式和文本格式支持
    extensions = [
        FencedCodeExtension(),
        CodeHiliteExtension(
            css_class='highlight',
            linenums=False,
            guess_lang=True
        ),
        'mdx_math',
        'markdown.extensions.attr_list',  # 属性列表支持
        'markdown.extensions.tables',     # 表格支持
        'markdown.extensions.footnotes',  # 脚注支持
        'markdown.extensions.toc',        # 目录支持
        'markdown.extensions.smarty',     # 智能标点符号
        'markdown.extensions.admonition', # 警告框支持
        'markdown.extensions.nl2br',      # 换行转<br>
        'markdown.extensions.sane_lists', # 智能列表
        'markdown.extensions.extra'       # 额外功能（包含删除线等）
    ]
    
    extension_configs = {
        'mdx_math': {
            'enable_dollar_delimiter': True,
            'add_preview': True
        }
    }
    
    html_content = markdown.markdown(processed_content, extensions=extensions, extension_configs=extension_configs)
    
    # 后处理：处理特殊附件链接
    def process_download_links(html_content):
        import re
        
        # 匹配附件链接模式：[dltag:文件名](下载地址)
        pattern = r'<p>\s*<a href="([^"]+)">dltag:([^<]+)</a>\s*</p>'
        
        def replace_download_link(match):
            download_url = match.group(1)
            filename = match.group(2)
            
            # 生成附件容器HTML
            return f'''
<div class="download-attachment">
    <div class="attachment-info">
        <span class="filename">{filename}</span>
        <button class="download-button" onclick="window.open('{download_url}', '_blank')" title="下载附件">
            下载
        </button>
    </div>
</div>
            '''
        
        # 替换附件链接
        processed_html = re.sub(pattern, replace_download_link, html_content)
        return processed_html
    
    # 应用附件链接处理
    html_content = process_download_links(html_content)
    
    return html_content

# 获取博客设置的函数
def get_blog_settings():
    """读取博客配置文件，返回博客设置"""
    settings_path = os.path.join(os.path.dirname(__file__), 'blogsettings.json')
    default_settings = {'blogname': "manyJ'sBlog"}
    
    if os.path.exists(settings_path):
        try:
            with open(settings_path, 'r', encoding='utf-8') as f:
                settings = json.load(f)
            return {**default_settings, **settings}
        except Exception as e:
            print(f"读取博客设置失败: {e}")
            return default_settings
    return default_settings

# 博客文章目录
BLOG_DIR = os.path.join(os.path.dirname(__file__), 'blogs')

# RSS 缓存数据
rss_articles_cache = []
rss_cache_lock = threading.Lock()
rss_timer = None

def stop_rss_cache():
    """停止RSS缓存刷新线程"""
    global rss_timer
    if rss_timer:
        rss_timer.cancel()

def remove_color_controls(text):
    """去除颜色控制符"""
    import re
    # 去除 %颜色代码% 和 °颜色代码° 格式的控制符
    # 处理 %颜色代码% 格式
    text = re.sub(r'%[^%\n]+%', '', text)
    # 处理 °颜色代码° 格式
    text = re.sub(r'°[^°\n]+°', '', text)
    return text

def get_all_articles_for_rss():
    """获取所有文章用于RSS订阅，与blog_list排序逻辑一致"""
    articles = []
    categories = []
    
    if os.path.exists(BLOG_DIR):
        for category_dir in os.listdir(BLOG_DIR):
            category_path = os.path.join(BLOG_DIR, category_dir)
            if os.path.isdir(category_path):
                categories.append(category_dir)
    
    category_order = {}
    category_json_path = os.path.join(BLOG_DIR, 'category.json')
    if os.path.exists(category_json_path):
        try:
            with open(category_json_path, 'r', encoding='utf-8') as f:
                category_order = json.load(f)
        except Exception as e:
            print(f"读取分类排序配置失败: {e}")
    
    def get_category_order(category_name):
        return category_order.get(category_name, float('inf'))
    
    categories.sort(key=get_category_order)
    
    for cat in categories:
        category_path = os.path.join(BLOG_DIR, cat)
        if os.path.exists(category_path):
            cat_order = {}
            category_json_path = os.path.join(category_path, 'blog_category.json')
            if os.path.exists(category_json_path):
                try:
                    with open(category_json_path, 'r', encoding='utf-8') as f:
                        cat_order = json.load(f)
                except Exception as e:
                    print(f"读取分类文章排序配置失败 {cat}: {e}")
            
            for article_dir in os.listdir(category_path):
                article_path = os.path.join(category_path, article_dir)
                if os.path.isdir(article_path):
                    config_path = os.path.join(article_path, 'config.json')
                    if os.path.exists(config_path):
                        try:
                            with open(config_path, 'r', encoding='utf-8') as f:
                                config = json.load(f)
                            
                            # 读取文章完整内容
                            blog_md_path = os.path.join(article_path, 'blog.md')
                            content = ''
                            if os.path.exists(blog_md_path):
                                try:
                                    with open(blog_md_path, 'r', encoding='utf-8') as f:
                                        content = f.read()
                                    # 去除颜色控制符
                                    content = remove_color_controls(content)
                                except Exception as e:
                                    print(f"读取文章内容失败 {cat}/{article_dir}: {e}")
                            
                            pub_date = None
                            if 'pub_date' in config:
                                try:
                                    pub_date = datetime.datetime.fromisoformat(config['pub_date'])
                                except:
                                    pub_date = datetime.datetime.now()
                            else:
                                # 使用blog.md文件的修改日期
                                try:
                                    if os.path.exists(blog_md_path):
                                        stat_info = os.stat(blog_md_path)
                                        pub_date = datetime.datetime.fromtimestamp(stat_info.st_mtime)
                                    else:
                                        stat_info = os.stat(article_path)
                                        pub_date = datetime.datetime.fromtimestamp(stat_info.st_mtime)
                                except:
                                    pub_date = datetime.datetime.now()
                            
                            articles.append({
                                'id': article_dir,
                                'category': cat,
                                'title': config.get('title', '无标题'),
                                'description': content,  # 使用完整内容作为description
                                'order': cat_order.get(article_dir, float('inf')),
                                'category_order': get_category_order(cat),
                                'pub_date': pub_date.strftime('%Y-%m-%d') if pub_date else '',
                                'pub_date_full': pub_date
                            })
                        except Exception as e:
                            print(f"读取文章配置失败 {cat}/{article_dir}: {e}")
    
    # RSS订阅显示所有文章，按修改日期排序（最新的在前）
    def get_pub_date_order(article):
        pub_date = article.get('pub_date')
        if not pub_date:
            return datetime.datetime.min
        if isinstance(pub_date, str):
            # 字符串格式的日期，直接返回字符串用于排序
            return pub_date
        return pub_date
    
    articles.sort(key=get_pub_date_order, reverse=True)
    
    for article in articles:
        # 优先使用pub_date_full（完整的datetime对象）
        pub_date_full = article.get('pub_date_full')
        if pub_date_full:
            article['pub_date_str'] = pub_date_full.strftime('%a, %d %b %Y %H:%M:%S +0800')
        elif article['pub_date']:
            # 兼容：pub_date可能是字符串或datetime对象
            if isinstance(article['pub_date'], str):
                # 字符串格式，转换为datetime再生成RFC 822格式
                try:
                    dt = datetime.datetime.strptime(article['pub_date'], '%Y-%m-%d')
                    article['pub_date_str'] = dt.strftime('%a, %d %b %Y %H:%M:%S +0800')
                except:
                    article['pub_date_str'] = article['pub_date']
            else:
                article['pub_date_str'] = article['pub_date'].strftime('%a, %d %b %Y %H:%M:%S +0800')
        else:
            article['pub_date_str'] = datetime.datetime.now().strftime('%a, %d %b %Y %H:%M:%S +0800')
    
    return articles

def refresh_rss_cache():
    """刷新RSS缓存"""
    global rss_articles_cache, rss_timer
    articles = get_all_articles_for_rss()
    with rss_cache_lock:
        rss_articles_cache = articles
    rss_timer = threading.Timer(60, refresh_rss_cache)
    rss_timer.daemon = True
    rss_timer.start()

# 只在主进程中启动RSS缓存刷新，避免重载时重复启动
# 通过检查环境变量来判断是否为主进程
if os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
    refresh_rss_cache()

def shutdown_rss_cache():
    """Flask应用关闭时停止RSS缓存刷新"""
    stop_rss_cache()

@app.route('/')
def index():
    """首页 - 显示文章列表，这个skip_welcome是控制开场动画是否显示的，改成False可以显示开场动画"""
    settings = get_blog_settings()
    return render_template('index.html', skip_welcome=True, blogname=settings['blogname'])

@app.route('/friendly_links.json')
def friendly_links():
    """提供友情链接数据"""
    friendly_links_path = os.path.join(os.path.dirname(__file__), 'friendly_links.json')
    
    if os.path.exists(friendly_links_path):
        try:
            with open(friendly_links_path, 'r', encoding='utf-8') as f:
                links_data = json.load(f)
            return links_data
        except Exception as e:
            print(f"读取友情链接文件失败: {e}")
            return {}
    else:
        return {}

@app.route('/blog')
@app.route('/blog/<category>')
def blog_list(category=None):
    """获取文章列表数据"""
    articles = []
    categories = []
    
    # 获取所有分类
    if os.path.exists(BLOG_DIR):
        for category_dir in os.listdir(BLOG_DIR):
            category_path = os.path.join(BLOG_DIR, category_dir)
            if os.path.isdir(category_path):
                categories.append(category_dir)
    
    # 读取分类排序配置
    category_order = {}
    category_json_path = os.path.join(BLOG_DIR, 'category.json')
    if os.path.exists(category_json_path):
        try:
            with open(category_json_path, 'r', encoding='utf-8') as f:
                category_order = json.load(f)
        except Exception as e:
            print(f"读取分类排序配置失败: {e}")
    
    # 根据category.json中的顺序对分类进行排序
    def get_category_order(category_name):
        return category_order.get(category_name, float('inf'))
    
    categories.sort(key=get_category_order)
    
    # 如果没有指定分类或指定为"全部"，获取所有分类的文章
    if not category or category == '全部':
        # 遍历所有分类获取文章
        for cat in categories:
            category_path = os.path.join(BLOG_DIR, cat)
            if os.path.exists(category_path):
                # 读取分类下的文章排序配置
                cat_order = {}
                category_json_path = os.path.join(category_path, 'blog_category.json')
                if os.path.exists(category_json_path):
                    try:
                        with open(category_json_path, 'r', encoding='utf-8') as f:
                            cat_order = json.load(f)
                    except Exception as e:
                        print(f"读取分类文章排序配置失败 {cat}: {e}")
                
                for article_dir in os.listdir(category_path):
                    article_path = os.path.join(category_path, article_dir)
                    if os.path.isdir(article_path):
                        # 读取配置文件
                        config_path = os.path.join(article_path, 'config.json')
                        if os.path.exists(config_path):
                            try:
                                with open(config_path, 'r', encoding='utf-8') as f:
                                    config = json.load(f)
                                
                                # 检查是否有封面图片
                                icon_path = os.path.join(article_path, 'icon.png')
                                has_icon = os.path.exists(icon_path)
                                
                                # 获取文章修改日期（使用blog.md文件的修改日期）
                                pub_date = None
                                if 'pub_date' in config:
                                    try:
                                        pub_date = datetime.datetime.fromisoformat(config['pub_date'])
                                    except:
                                        pub_date = datetime.datetime.now()
                                else:
                                    # 使用blog.md文件的修改日期
                                    blog_md_path = os.path.join(article_path, 'blog.md')
                                    try:
                                        if os.path.exists(blog_md_path):
                                            stat_info = os.stat(blog_md_path)
                                            pub_date = datetime.datetime.fromtimestamp(stat_info.st_mtime)
                                        else:
                                            stat_info = os.stat(article_path)
                                            pub_date = datetime.datetime.fromtimestamp(stat_info.st_mtime)
                                    except:
                                        pub_date = datetime.datetime.now()
                                
                                articles.append({
                                    'id': article_dir,
                                    'category': cat,
                                    'title': config.get('title', '无标题'),
                                    'small_title': config.get('small_title', '无简介'),
                                    'has_icon': has_icon,
                                    'order': cat_order.get(article_dir, float('inf')),
                                    'category_order': get_category_order(cat),
                                    'pub_date': pub_date.strftime('%Y-%m-%d') if pub_date else '',
                                    'pub_date_full': pub_date
                                })
                            except Exception as e:
                                print(f"读取文章配置失败 {cat}/{article_dir}: {e}")
        
        # "全部"分类按修改日期排序（最新的在前）
        def get_pub_date_order(article):
            pub_date = article.get('pub_date')
            if not pub_date:
                return ''
            return pub_date
        
        articles.sort(key=get_pub_date_order, reverse=True)
        
        # 如果没有指定分类，设置当前分类为"全部"
        if not category:
            category = '全部'
    else:
        # 遍历指定分类的文章目录
        category_path = os.path.join(BLOG_DIR, category)
        if os.path.exists(category_path):
            # 读取分类下的文章排序配置
            cat_order = {}
            category_json_path = os.path.join(category_path, 'blog_category.json')
            if os.path.exists(category_json_path):
                try:
                    with open(category_json_path, 'r', encoding='utf-8') as f:
                        cat_order = json.load(f)
                except Exception as e:
                    print(f"读取分类文章排序配置失败 {category}: {e}")
            
            for article_dir in os.listdir(category_path):
                article_path = os.path.join(category_path, article_dir)
                if os.path.isdir(article_path):
                    # 读取配置文件
                    config_path = os.path.join(article_path, 'config.json')
                    if os.path.exists(config_path):
                        try:
                            with open(config_path, 'r', encoding='utf-8') as f:
                                config = json.load(f)
                            
                            # 检查是否有封面图片
                            icon_path = os.path.join(article_path, 'icon.png')
                            has_icon = os.path.exists(icon_path)
                            
                            # 获取文章修改日期
                            pub_date = None
                            if 'pub_date' in config:
                                try:
                                    pub_date = datetime.datetime.fromisoformat(config['pub_date'])
                                except:
                                    pub_date = datetime.datetime.now()
                            else:
                                # 使用blog.md文件的修改日期
                                blog_md_path = os.path.join(article_path, 'blog.md')
                                try:
                                    if os.path.exists(blog_md_path):
                                        stat_info = os.stat(blog_md_path)
                                        pub_date = datetime.datetime.fromtimestamp(stat_info.st_mtime)
                                    else:
                                        stat_info = os.stat(article_path)
                                        pub_date = datetime.datetime.fromtimestamp(stat_info.st_mtime)
                                except:
                                    pub_date = datetime.datetime.now()
                            
                            articles.append({
                                'id': article_dir,
                                'category': category,
                                'title': config.get('title', '无标题'),
                                'small_title': config.get('small_title', '无简介'),
                                'has_icon': has_icon,
                                'order': cat_order.get(article_dir, float('inf')),
                                'pub_date': pub_date.strftime('%Y-%m-%d') if pub_date else '',
                                'pub_date_full': pub_date
                            })
                        except Exception as e:
                            print(f"读取文章配置失败 {category}/{article_dir}: {e}")
            
            # 根据blog_category.json中的顺序对文章进行排序
            def get_article_order(article):
                return article.get('order', float('inf'))
            
            articles.sort(key=get_article_order)
    
    return {
        'categories': categories,
        'current_category': category,
        'articles': articles
    }



@app.route('/read/<category>/<article_id>/content')
def get_article_content(category, article_id):
    """获取文章内容"""
    article_path = os.path.join(BLOG_DIR, category, article_id)
    
    if not os.path.exists(article_path):
        return {'error': '文章不存在'}, 404
    
    # 读取配置
    config_path = os.path.join(article_path, 'config.json')
    config = {}
    if os.path.exists(config_path):
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)
        except Exception as e:
            print(f"读取配置失败: {e}")
    
    # 读取Markdown内容
    md_path = os.path.join(article_path, 'blog.md')
    content = ''
    md_content = ''
    update_date = ''
    word_count = 0
    
    if os.path.exists(md_path):
        try:
            # 获取文件修改时间作为更新日期
            update_timestamp = os.path.getmtime(md_path)
            update_date = datetime.datetime.fromtimestamp(update_timestamp).strftime('%Y-%m-%d')
            
            with open(md_path, 'r', encoding='utf-8') as f:
                md_content = f.read()
            
            # 预处理：处理自定义颜色和背景色控制符
            def process_color_controls(text):
                # 定义特殊颜色代码映射
                color_map = {
                    'NONE': 'inherit',  # 恢复默认颜色
                    'R': '#FF0000',     # 红色
                    'G': '#00FF00',     # 绿色
                    'B': '#0000FF',     # 蓝色
                    'Y': '#FFFF00',     # 黄色
                    'P': '#FFC0CB',     # 粉色
                    'U': '#800080',     # 紫色
                    'K': '#000000'      # 黑色
                }
                
                # 处理颜色控制符
                lines = text.split('\n')
                processed_lines = []
                
                for line in lines:
                    # 跳过代码块中的内容
                    if line.strip().startswith('```'):
                        processed_lines.append(line)
                        continue
                    
                    # 处理颜色和背景色控制符
                    parts = []
                    current_pos = 0
                    current_color = None
                    current_background = None
                    
                    while current_pos < len(line):
                        # 查找下一个控制符（% 或 °）
                        percent_pos = line.find('%', current_pos)
                        degree_pos = line.find('°', current_pos)
                        
                        # 确定下一个控制符的位置和类型
                        start_pos = -1
                        control_type = None
                        
                        if percent_pos != -1 and degree_pos != -1:
                            if percent_pos < degree_pos:
                                start_pos = percent_pos
                                control_type = 'color'
                            else:
                                start_pos = degree_pos
                                control_type = 'background'
                        elif percent_pos != -1:
                            start_pos = percent_pos
                            control_type = 'color'
                        elif degree_pos != -1:
                            start_pos = degree_pos
                            control_type = 'background'
                        
                        if start_pos == -1:
                            # 没有更多控制符，添加剩余文本
                            remaining_text = line[current_pos:]
                            if remaining_text:
                                # 应用当前的颜色和背景色设置
                                styles = []
                                if current_color:
                                    styles.append(f'color: {current_color}')
                                if current_background:
                                    styles.append(f'background-color: {current_background}')
                                
                                if styles:
                                    style_str = '; '.join(styles)
                                    parts.append(f'<span style="{style_str}">{remaining_text}</span>')
                                else:
                                    parts.append(remaining_text)
                            break
                        
                        # 添加控制符前的文本
                        if current_pos < start_pos:
                            text_before = line[current_pos:start_pos]
                            if text_before:
                                # 应用当前的颜色和背景色设置
                                styles = []
                                if current_color:
                                    styles.append(f'color: {current_color}')
                                if current_background:
                                    styles.append(f'background-color: {current_background}')
                                
                                if styles:
                                    style_str = '; '.join(styles)
                                    parts.append(f'<span style="{style_str}">{text_before}</span>')
                                else:
                                    parts.append(text_before)
                        
                        # 查找控制符结束位置
                        end_char = '%' if control_type == 'color' else '°'
                        end_pos = line.find(end_char, start_pos + 1)
                        if end_pos == -1:
                            # 没有匹配的结束符，添加剩余文本
                            parts.append(line[start_pos:])
                            break
                        
                        # 提取颜色代码
                        color_code = line[start_pos + 1:end_pos]
                        
                        # 处理颜色代码
                        if color_code in color_map:
                            color_value = color_map[color_code]
                        elif len(color_code) == 6 and all(c in '0123456789ABCDEFabcdef' for c in color_code):
                            color_value = f'#{color_code.upper()}'
                        else:
                            # 无效颜色代码，保持原样
                            parts.append(line[start_pos:end_pos + 1])
                            current_pos = end_pos + 1
                            continue
                        
                        # 更新当前的颜色或背景色设置
                        if control_type == 'color':
                            current_color = color_value if color_value != 'inherit' else None
                        else:
                            current_background = color_value if color_value != 'inherit' else None
                        
                        # 移动到控制符结束位置之后
                        current_pos = end_pos + 1
                    
                    processed_lines.append(''.join(parts))
                
                return '\n'.join(processed_lines)
            
            # 先处理颜色控制符
            processed_content = process_color_controls(md_content)
            
            # 转换Markdown为HTML，添加代码高亮、数学公式和文本格式支持
            extensions = [
                FencedCodeExtension(),
                CodeHiliteExtension(
                    css_class='highlight',
                    linenums=False,
                    guess_lang=True
                ),
                'mdx_math',  # 数学公式支持
                'markdown.extensions.attr_list',  # 属性列表支持
                'markdown.extensions.tables',     # 表格支持
                'markdown.extensions.footnotes',  # 脚注支持
                'markdown.extensions.toc',        # 目录支持
                'markdown.extensions.smarty',     # 智能标点符号
                'markdown.extensions.admonition', # 警告框支持
                'markdown.extensions.nl2br',      # 换行转<br>
                'markdown.extensions.sane_lists', # 智能列表
                'markdown.extensions.extra'       # 额外功能（包含删除线等）
            ]
            
            extension_configs = {
                'mdx_math': {
                    'enable_dollar_delimiter': True,
                    'add_preview': True
                }
            }
            
            content = markdown.markdown(processed_content, extensions=extensions, extension_configs=extension_configs)
            
            # 后处理：处理特殊附件链接
            def process_download_links(html_content):
                import re
                
                # 匹配附件链接模式：[dltag:文件名](下载地址)
                pattern = r'<p>\s*<a href="([^"]+)">dltag:([^<]+)</a>\s*</p>'
                
                def replace_download_link(match):
                    download_url = match.group(1)
                    filename = match.group(2)
                    
                    # 生成附件容器HTML
                    return f'''
<div class="download-attachment">
    <div class="attachment-info">
        <span class="filename">{filename}</span>
        <button class="download-button" onclick="window.open('{download_url}', '_blank')" title="下载附件">
            下载
        </button>
    </div>
</div>
                    '''
                
                # 替换附件链接
                processed_html = re.sub(pattern, replace_download_link, html_content)
                return processed_html
            
            # 应用附件链接处理
            content = process_download_links(content)
            
        except Exception as e:
            print(f"读取文章内容失败: {e}")
            content = '<p>读取文章内容失败</p>'
    else:
        content = '<p>文章内容不存在</p>'
    
    return {
        'title': config.get('title', '无标题'),
        'small_title': config.get('small_title', '无简介'),
        'content': content,
        'update_date': update_date,
        'ai': config.get('ai', '')
    }

@app.route('/read/<category>/<article_id>/icon')
def get_article_icon(category, article_id):
    """获取文章封面图片"""
    article_path = os.path.join(BLOG_DIR, category, article_id)
    icon_path = os.path.join(article_path, 'icon.png')
    
    if os.path.exists(icon_path):
        return send_from_directory(article_path, 'icon.png')
    else:
        return send_from_directory('css/all', 'favicon.ico')

# 静态文件路由
@app.route('/css/<path:filename>')
def css_files(filename):
    response = send_from_directory('css', filename)
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

@app.route('/css/all/<path:filename>')
def css_all_files(filename):
    response = send_from_directory('css/all', filename)
    if filename == 'bg.png':
        response.headers['Cache-Control'] = 'public, max-age=31536000'
    else:
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
    return response

@app.route('/js/<path:filename>')
def js_files(filename):
    response = send_from_directory('js', filename)
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

@app.route('/debug/ip')
def debug_ip():
    """调试接口：显示客户端IP信息"""
    real_ip = get_real_client_ip()
    remote_addr = request.remote_addr
    
    return {
        'real_client_ip': real_ip,
        'remote_addr': remote_addr,
        'x_forwarded_for': request.headers.get('X-Forwarded-For'),
        'x_real_ip': request.headers.get('X-Real-IP'),
        'headers': dict(request.headers)
    }

@app.route('/res/<path:filename>')
def resources_files(filename):
    """获取resources目录下的文件"""
    resources_path = os.path.join(os.path.dirname(__file__), 'resources')
    
    # 检查文件是否存在
    file_path = os.path.join(resources_path, filename)
    if not os.path.exists(file_path):
        return {'error': '文件不存在'}, 404
    
    # 检查是否为安全路径（防止路径遍历攻击）
    if '..' in filename or filename.startswith('/'):
        return {'error': '无效的文件路径'}, 400
    
    return send_from_directory(resources_path, filename)

@app.route('/res')
def resources_list():
    """列出resources目录下的所有文件"""
    resources_path = os.path.join(os.path.dirname(__file__), 'resources')
    
    if not os.path.exists(resources_path):
        return {'files': [], 'message': 'resources目录不存在'}
    
    files = []
    try:
        for item in os.listdir(resources_path):
            item_path = os.path.join(resources_path, item)
            if os.path.isfile(item_path):
                files.append({
                    'name': item,
                    'size': os.path.getsize(item_path),
                    'url': f'/res/{item}'
                })
    except Exception as e:
        return {'error': f'读取目录失败: {str(e)}'}, 500
    
    return {'files': files}

@app.route('/api/rss.xml')
def rss_feed():
    """RSS订阅源"""
    settings = get_blog_settings()
    with rss_cache_lock:
        articles = rss_articles_cache.copy()
    
    blog_url = request.host_url.rstrip('/')
    last_build_date = datetime.datetime.now().strftime('%a, %d %b %Y %H:%M:%S +0800')
    
    return Response(
        render_template('rss.xml', 
            blogname=settings['blogname'],
            blog_url=blog_url,
            last_build_date=last_build_date,
            articles=articles
        ),
        mimetype='application/rss+xml'
    )

@app.route('/editor')
def editor():
    """Markdown编辑器页面"""
    settings = get_blog_settings()
    return render_template('editor.html', blogname=settings['blogname'])

@app.route('/api/preview', methods=['POST'])
def preview_markdown():
    """Markdown预览API"""
    try:
        data = request.get_json()
        if not data or 'content' not in data:
            return {'error': '缺少内容参数'}, 400
        
        markdown_content = data['content']
        
        # 使用统一的Markdown处理函数
        html_content = process_markdown_content(markdown_content)
        
        return {'html': html_content}
        
    except Exception as e:
        return {'error': f'处理Markdown失败: {str(e)}'}, 500

# 数据库初始化
def init_db():
    """初始化SQLite数据库"""
    db_path = os.path.join(os.path.dirname(__file__), 'instance', 'comment.db')
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 创建评论表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            article_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            username TEXT NOT NULL,
            content TEXT NOT NULL,
            avatar_url TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 添加 avatar_url 列（如果不存在）
    try:
        cursor.execute('ALTER TABLE comments ADD COLUMN avatar_url TEXT')
    except sqlite3.OperationalError:
        pass
    
    # 创建用户会话表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_sessions (
            session_id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            username TEXT NOT NULL,
            access_token TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME NOT NULL
        )
    ''')
    
    conn.commit()
    conn.close()

def mask_email(email):
    """邮箱打码函数，保留前两位和@域名部分"""
    if '@' not in email:
        return email
    local_part, domain = email.split('@', 1)
    if len(local_part) <= 2:
        masked_local = local_part
    else:
        masked_local = local_part[:2] + '*' * (len(local_part) - 2)
    return f"{masked_local}@{domain}"

# 提交评论API
@app.route('/api/comment', methods=['POST'])
def api_comment():
    """提交评论接口 - 纯匿名评论"""
    try:
        def is_single_punctuation(text):
            if not text or len(text) != 1:
                return False
            punctuation_chars = (
                '.,!?;:\'\"-()[]{}<>@#$%^&*~`|\\/+=_'
                '。，！？；：""''《》【】（）…—～·、'
                '·※◎■□★☆●○◆◇△▽▼↑←→↘↙♠♣♥♦＃￥％＆＊＋－＝＠＾＿｀｜＼／'
                '〜～￣＿﹏﹋﹌﹍﹎﹏'
                ' \t\r\n'
            )
            return text in punctuation_chars

        if request.is_json:
            data = request.get_json()
            article_id = data.get('article_id')
            content = data.get('content')
            email = data.get('email')
            avatar_url = data.get('avatar_url')
        else:
            article_id = request.form.get('article_id')
            content = request.form.get('content')
            email = request.form.get('email')
            avatar_url = request.form.get('avatar_url')
        
        if not all([article_id, content, email]):
            return jsonify({'success': False, 'message': '文章ID、评论内容和邮箱不能为空'}), 400
        
        if is_single_punctuation(content.strip()):
            return jsonify({'success': False, 'message': '不可发送单个标点符号'}), 400
        
        content = content.replace('\r\n', '').replace('\n', '').replace('\r', '')
        
        if len(content) < 1:
            return jsonify({'success': False, 'message': '评论内容不能为空'}), 400
        
        if len(content) > 1000:
            return jsonify({'success': False, 'message': '评论内容过长（最多1000个字符）'}), 400
        
        anonymous_user_id = f"anonymous#{str(uuid.uuid4())}"
        masked_username = mask_email(email)
        
        db_path = os.path.join(os.path.dirname(__file__), 'instance', 'comment.db')
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO comments (article_id, user_id, username, content, avatar_url)
            VALUES (?, ?, ?, ?, ?)
        ''', (article_id, anonymous_user_id, masked_username, content, avatar_url))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': '评论发布成功',
            'is_anonymous': True,
            'comment_id': cursor.lastrowid
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'评论提交失败: {str(e)}'}), 500

# 获取评论API
@app.route('/api/comments/<path:article_id>', methods=['GET'])
def api_get_comments(article_id):
    """获取文章评论"""
    try:
        db_path = os.path.join(os.path.dirname(__file__), 'instance', 'comment.db')
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, user_id, username, content, avatar_url, created_at
            FROM comments
            WHERE article_id = ?
            ORDER BY created_at DESC
        ''', (article_id,))
        
        comments = []
        for row in cursor.fetchall():
            created_at = row[5]
            
            if isinstance(created_at, str) and ' ' in created_at:
                created_at = created_at.replace(' ', 'T') + 'Z'
            
            avatar_url = row[4] if row[4] else '/css/all/default-avatar.svg'
            
            comments.append({
                'id': row[0],
                'user_id': row[1],
                'username': row[2],
                'content': row[3],
                'created_at': created_at,
                'avatar_url': avatar_url
            })
        
        conn.close()
        
        return jsonify({
            'success': True,
            'comments': comments
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'获取评论失败: {str(e)}'}), 500

# 用户协议与隐私政策页面
@app.route('/u')
def user_agreement():
    """用户协议与隐私政策页面"""
    return render_template('u.html')

# 修改文章阅读页面，添加评论数据
@app.route('/read/<category>/<article_id>')
def read_article(category, article_id):
    """文章阅读页面"""
    # 获取评论数据（不包含头像，头像通过前端异步加载）
    comments = []
    try:
        db_path = os.path.join(os.path.dirname(__file__), 'instance', 'comment.db')
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT c.id, c.user_id, c.username, c.content, c.created_at
            FROM comments c
            WHERE c.article_id = ?
            ORDER BY c.created_at DESC
        ''', (f"{category}/{article_id}",))
        
        for row in cursor.fetchall():
            # 格式化时间戳，确保前端能正确解析
            created_at = row[4]
            
            # 如果是SQLite的datetime格式，转换为ISO格式
            if isinstance(created_at, str) and ' ' in created_at:
                # 将 "YYYY-MM-DD HH:MM:SS" 转换为 "YYYY-MM-DDTHH:MM:SSZ"
                created_at = created_at.replace(' ', 'T') + 'Z'
            
            # 不在此处获取头像，避免阻塞页面加载
            comments.append({
                'id': row[0],
                'user_id': row[1],
                'username': row[2],
                'content': row[3],
                'created_at': created_at,
                'avatar_url': '/css/all/default-avatar.svg'  # 使用默认头像
            })
        
        conn.close()
    except Exception as e:
        print(f"获取评论失败: {e}")
    
    return render_template('read.html', article_id=f"{category}/{article_id}", comments=comments)

# 初始化数据库
init_db()

if __name__ == '__main__':
    app.run(debug=True, port=26178)