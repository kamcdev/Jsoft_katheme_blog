from flask import Flask, render_template, send_from_directory, request
import os
import json
import datetime
import markdown
from markdown.extensions.codehilite import CodeHiliteExtension
from markdown.extensions.fenced_code import FencedCodeExtension
import mdx_math
from werkzeug.middleware.proxy_fix import ProxyFix

app = Flask(__name__)

# 获取博客设置的函数
def get_blog_settings():
    """读取博客配置文件，返回博客设置"""
    settings_path = os.path.join(os.path.dirname(__file__), 'blogsettings.json')
    default_settings = {'blogname': "katheme开源版"}
    
    if os.path.exists(settings_path):
        try:
            with open(settings_path, 'r', encoding='utf-8') as f:
                settings = json.load(f)
            return {**default_settings, **settings}
        except Exception as e:
            print(f"读取博客设置失败: {e}")
            return default_settings
    return default_settings

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

# 博客文章目录
BLOG_DIR = os.path.join(os.path.dirname(__file__), 'blogs')

@app.route('/')
def index():
    """首页 - 显示文章列表"""
    settings = get_blog_settings()
    return render_template('index.html', blogname=settings['blogname'])

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
                                
                                articles.append({
                                    'id': article_dir,
                                    'category': cat,
                                    'title': config.get('title', '无标题'),
                                    'small_title': config.get('small_title', '无简介'),
                                    'has_icon': has_icon,
                                    'order': cat_order.get(article_dir, float('inf')),
                                    'category_order': get_category_order(cat)
                                })
                            except Exception as e:
                                print(f"读取文章配置失败 {cat}/{article_dir}: {e}")
        
        # 按照分类顺序和文章顺序排序
        def get_combined_order(article):
            return (article.get('category_order', float('inf')), article.get('order', float('inf')))
        
        articles.sort(key=get_combined_order)
        
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
                            
                            articles.append({
                                'id': article_dir,
                                'category': category,
                                'title': config.get('title', '无标题'),
                                'small_title': config.get('small_title', '无简介'),
                                'has_icon': has_icon,
                                'order': cat_order.get(article_dir, float('inf'))
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

@app.route('/read/<category>/<article_id>')
def read_article(category, article_id):
    """文章阅读页面"""
    settings = get_blog_settings()
    return render_template('read.html', blogname=settings['blogname'])

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
        'update_date': update_date
    }

@app.route('/read/<category>/<article_id>/icon')
def get_article_icon(category, article_id):
    """获取文章封面图片"""
    article_path = os.path.join(BLOG_DIR, category, article_id)
    icon_path = os.path.join(article_path, 'icon.png')
    
    if os.path.exists(icon_path):
        return send_from_directory(article_path, 'icon.png')
    else:
        # 返回默认图片或404
        return send_from_directory('css/all', 'favicon.ico')

# 静态文件路由
@app.route('/css/<path:filename>')
def css_files(filename):
    return send_from_directory('css', filename)

@app.route('/css/all/<path:filename>')
def css_all_files(filename):
    return send_from_directory('css/all', filename)

@app.route('/js/<path:filename>')
def js_files(filename):
    return send_from_directory('js', filename)

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

if __name__ == '__main__':
    app.run(debug=True, port=26178)