from flask import Flask, render_template, send_from_directory, request, jsonify, make_response, Response, abort, redirect
import os
import json
import datetime
import html
import re
import ast
import math
import random
import string
from decimal import Decimal, InvalidOperation
import urllib.parse
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

# 统一颜色映射表：颜色缩写 -> 颜色值（所有解析器共用）
# NONE 在文字控制符中表示“恢复默认”（inherit）；时间轴/扇形图/函数图象中单独解释为白色
color_map = {
    'NONE': 'inherit',  # 恢复默认颜色
    'R': '#FF0000',     # 红色
    'G': '#00FF00',     # 绿色
    'B': '#0000FF',     # 蓝色
    'Y': '#FFFF00',     # 黄色
    'P': '#FFC0CB',     # 粉色
    'U': '#800080',     # 紫色
    'K': '#000000',     # 黑色
    'W': '#FFFFFF',     # 白色
    'O': '#FFA500',     # 橙色
    'D': '#F8D14A'      # 金色
}

# 文章封面图支持的文件名（按优先级排序）
ARTICLE_ICON_FILENAMES = ('icon.png', 'icon.jpg', 'icon.jpeg', 'icon.webp')


def find_article_icon(article_path):
    """返回文章目录下实际存在的封面图文件名，未找到返回 None"""
    for filename in ARTICLE_ICON_FILENAMES:
        if os.path.exists(os.path.join(article_path, filename)):
            return filename
    return None


# 时间轴自定义格式：%tl [c:颜色|f:l/r]%(<时间>,<名字>,<内容>)...%NONE%
_TIMELINE_ERROR_HTML = '<span style="color: #FF0000;">时间轴格式错误</span>'
_TIMELINE_PLACEHOLDER_PREFIX = 'MDTIMELINEPLACEHOLDER'
_TIMELINE_PLACEHOLDER_SUFFIX = 'X'


def _parse_timeline_color(value):
    """解析图表颜色，共用全局 color_map；NONE 在图表中表示默认白色"""
    value = value.strip()
    if value == 'NONE':
        return '#FFFFFF'
    if value in color_map:
        return color_map[value]
    candidate = value.lstrip('#')
    if len(candidate) == 6 and all(c in '0123456789ABCDEFabcdef' for c in candidate):
        return f'#{candidate.upper()}'
    return None


def _build_timeline_html(params_str, entries_str):
    """根据参数和时间点文本生成时间轴 HTML；格式错误时返回红色错误文字"""
    color = '#FFFFFF'
    direction = 'r'
    seen_params = set()

    param_parts = [] if not params_str.strip() else params_str.strip().split('|')
    for part in param_parts:
        part = part.strip()
        if ':' not in part:
            return _TIMELINE_ERROR_HTML
        key, value = (item.strip() for item in part.split(':', 1))
        if key not in ('c', 'f') or key in seen_params:
            return _TIMELINE_ERROR_HTML
        seen_params.add(key)
        if key == 'c':
            parsed_color = _parse_timeline_color(value)
            if parsed_color is None:
                return _TIMELINE_ERROR_HTML
            color = parsed_color
        elif value not in ('l', 'r'):
            return _TIMELINE_ERROR_HTML
        else:
            direction = value

    # 时间点之间只允许空白；字段本身允许包含逗号但不允许括号
    entry_pattern = re.compile(r'\(\s*([^()]*?)\s*,\s*([^()]*?)\s*,\s*([^()]*?)\s*\)')
    entries = []
    last_end = 0
    for match in entry_pattern.finditer(entries_str):
        if entries_str[last_end:match.start()].strip():
            return _TIMELINE_ERROR_HTML
        entries.append(tuple(group.strip() for group in match.groups()))
        last_end = match.end()
    if not entries or entries_str[last_end:].strip():
        return _TIMELINE_ERROR_HTML

    is_left = direction == 'l'
    padding_style = 'padding-right: 32px; text-align: right;' if is_left else 'padding-left: 32px; text-align: left;'
    axis_side = 'right' if is_left else 'left'
    axis_shift = 'translateX(50%)' if is_left else 'translateX(-50%)'
    # 轴线与圆点共用同一条中心线：轴线宽 2px、圆点宽 12px，均以中心对齐 10px 处
    line_style = (
        f'position: absolute; top: 6px; bottom: 6px; {axis_side}: 10px; width: 2px; '
        f'background: {color}; opacity: 0.75; transform: {axis_shift};'
    )

    parts = [
        f'<span class="md-timeline" style="position: relative; display: block; margin: 20px 0; box-sizing: border-box; {padding_style}">',
        f'<span aria-hidden="true" style="{line_style}"></span>'
    ]
    for time_text, name_text, content_text in entries:
        dot_style = (
            f'position: absolute; top: 8px; {axis_side}: -22px; width: 12px; height: 12px; '
            f'border-radius: 50%; background: {color}; box-shadow: 0 0 6px {color}; '
            f'transform: {axis_shift};'
        )
        card_style = (
            'display: block; margin-bottom: 18px; padding: 10px 14px; border-radius: 8px; '
            'background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.14);'
        )
        parts.append(
            '<span class="md-timeline-item" style="position: relative; display: block;">'
            f'<span aria-hidden="true" style="{dot_style}"></span>'
            f'<span style="{card_style}">'
            f'<span style="display: block; color: #FFFFFF; font-weight: bold; font-size: 0.95em;">{html.escape(time_text)}</span>'
            f'<span style="display: block; color: {color}; font-weight: bold; font-size: 1.25em; margin: 4px 0;">{html.escape(name_text)}</span>'
            f'<span style="display: block; color: #FFFFFF; font-size: 1em; line-height: 1.5;">{html.escape(content_text)}</span>'
            '</span></span>'
        )
    parts.append('</span>')
    return ''.join(parts)


def extract_timeline_blocks(text):
    """把单行时间轴块替换为占位符，避免被后续控制符解析打断"""
    placeholders = {}
    lines = text.split('\n')
    in_code_block = False

    for index, line in enumerate(lines):
        if line.strip().startswith('```'):
            in_code_block = not in_code_block
            continue
        if in_code_block:
            continue

        result = []
        pos = 0
        while True:
            match = re.search(r'%tl(?=\s|%)', line[pos:])
            if not match:
                result.append(line[pos:])
                break
            start = pos + match.start()
            result.append(line[pos:start])
            open_end = line.find('%', start + 3)
            close_start = line.find('%NONE%', open_end + 1) if open_end != -1 else -1
            if open_end == -1 or close_start == -1:
                timeline_html = _TIMELINE_ERROR_HTML
                next_pos = len(line)
            else:
                timeline_html = _build_timeline_html(line[start + 3:open_end], line[open_end + 1:close_start])
                next_pos = close_start + len('%NONE%')

            token = f'{_TIMELINE_PLACEHOLDER_PREFIX}{len(placeholders)}{_TIMELINE_PLACEHOLDER_SUFFIX}'
            placeholders[token] = timeline_html
            result.append(token)
            pos = next_pos
            if pos >= len(line):
                break

        lines[index] = ''.join(result)

    return '\n'.join(lines), placeholders


def restore_timeline_blocks(html_content, placeholders):
    """Markdown 转换完成后把占位符还原成时间轴 HTML"""
    for token, timeline_html in placeholders.items():
        html_content = html_content.replace(token, timeline_html)
    return html_content


# 扇形统计图自定义格式：%pc%(<颜色>,<名字>,<比例>)...%NONE%
_PC_ERROR_HTML = '<span style="color: #FF0000;">扇形统计图格式错误</span>'
_PC_PLACEHOLDER_PREFIX = 'MDPCPLACEHOLDER'
_PC_PLACEHOLDER_SUFFIX = 'X'


def _format_pc_ratio(ratio):
    """把 Decimal 比例格式化为不带多余 0 的普通数字文本"""
    text = format(ratio, 'f')
    if '.' in text:
        text = text.rstrip('0').rstrip('.')
    return text


def _build_pie_chart_html(entries_str):
    """根据 <颜色>,<名字>,<比例> 条目生成扇形统计图；格式错误则返回红色错误文字"""
    entry_pattern = re.compile(r'\(\s*([^(),]*?)\s*,\s*([^()]*?)\s*,\s*([^(),]*?)\s*\)')
    entries = []
    last_end = 0
    for match in entry_pattern.finditer(entries_str):
        if entries_str[last_end:match.start()].strip():
            return _PC_ERROR_HTML
        entries.append(tuple(group.strip() for group in match.groups()))
        last_end = match.end()
    if not entries or entries_str[last_end:].strip():
        return _PC_ERROR_HTML

    slices = []
    total = Decimal('0')
    for color_text, name_text, ratio_text in entries:
        color = _parse_timeline_color(color_text)
        if color is None or not name_text:
            return _PC_ERROR_HTML
        try:
            ratio = Decimal(ratio_text)
        except (InvalidOperation, ValueError):
            return _PC_ERROR_HTML
        if not ratio.is_finite() or ratio <= 0:
            return _PC_ERROR_HTML
        total += ratio
        slices.append((color, name_text, ratio))

    # 总比例必须严格等于 100（Decimal 避免浮点误差）
    if total != Decimal('100'):
        return _PC_ERROR_HTML

    cx = cy = 110
    radius = 88
    angle = -90.0  # 从 12 点方向顺时针绘制
    slice_parts = []
    for idx, (color, _name, ratio) in enumerate(slices):
        sweep = float(ratio) / 100.0 * 360.0
        end_angle = angle + sweep
        if len(slices) == 1:
            d = (f'M {cx} {cy - radius} A {radius} {radius} 0 1 1 {cx} {cy + radius} '
                 f'A {radius} {radius} 0 1 1 {cx} {cy - radius} Z')
        else:
            x1 = cx + radius * math.cos(math.radians(angle))
            y1 = cy + radius * math.sin(math.radians(angle))
            x2 = cx + radius * math.cos(math.radians(end_angle))
            y2 = cy + radius * math.sin(math.radians(end_angle))
            large_arc = 1 if sweep > 180 else 0
            d = (f'M {cx} {cy} L {x1:.3f} {y1:.3f} A {radius} {radius} 0 '
                 f'{large_arc} 1 {x2:.3f} {y2:.3f} Z')
        mid_angle = math.radians(angle + sweep / 2.0)
        tx = cx + radius * 0.62 * math.cos(mid_angle)
        ty = cy + radius * 0.62 * math.sin(mid_angle)
        slice_parts.append(
            f'<g class="md-pie-slice" data-index="{idx}" style="transition: opacity 0.2s;">'
            f'<path d="{d}" fill="{color}" stroke="#ffffff" stroke-width="1.5"></path>'
            f'<text x="{tx:.3f}" y="{ty:.3f}" text-anchor="middle" dominant-baseline="central" '
            f'fill="#ffffff" font-size="13" font-weight="bold">{_format_pc_ratio(ratio)}%</text>'
            f'</g>'
        )
        angle = end_angle

    legend_parts = []
    for idx, (color, name_text, _ratio) in enumerate(slices):
        legend_parts.append(
            f'<span class="md-pie-legend-item" data-index="{idx}" '
            f'style="display: flex; align-items: center; gap: 8px; padding: 6px 10px; '
            f'border-radius: 6px; cursor: default; transition: opacity 0.2s, background-color 0.2s;">'
            f'<span class="md-pie-swatch" style="display: inline-block; width: 14px; height: 14px; '
            f'border-radius: 3px; background: {color}; flex: 0 0 14px;"></span>'
            f'<span>{html.escape(name_text)}</span>'
            f'</span>'
        )

    return (
        '<span class="md-pie" style="display: flex; flex-wrap: wrap; align-items: center; gap: 20px; '
        'background: #ffffff; color: #222222; border-radius: 12px; padding: 20px; margin: 20px 0; '
        'box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15); box-sizing: border-box;">'
        '<svg class="md-pie-chart" viewBox="0 0 220 220" width="220" height="220" '
        'style="flex: 0 0 220px;" role="img" aria-label="扇形统计图">'
        + ''.join(slice_parts) +
        '</svg>'
        '<span class="md-pie-legend" style="display: flex; flex-direction: column; gap: 8px; '
        'flex: 1 1 160px; min-width: 140px;">'
        + ''.join(legend_parts) +
        '</span></span>'
    )


def extract_pie_blocks(text):
    """把单行扇形统计图块替换为占位符，避免被后续控制符解析打断"""
    placeholders = {}
    lines = text.split('\n')
    in_code_block = False

    for index, line in enumerate(lines):
        if line.strip().startswith('```'):
            in_code_block = not in_code_block
            continue
        if in_code_block:
            continue

        result = []
        pos = 0
        while True:
            match = re.search(r'%pc(?=\s|%)', line[pos:])
            if not match:
                result.append(line[pos:])
                break
            start = pos + match.start()
            result.append(line[pos:start])
            open_end = line.find('%', start + 3)
            close_start = line.find('%NONE%', open_end + 1) if open_end != -1 else -1
            if open_end == -1 or close_start == -1:
                pie_html = _PC_ERROR_HTML
                next_pos = len(line)
            else:
                pie_html = _build_pie_chart_html(line[open_end + 1:close_start])
                next_pos = close_start + len('%NONE%')

            token = f'{_PC_PLACEHOLDER_PREFIX}{len(placeholders)}{_PC_PLACEHOLDER_SUFFIX}'
            placeholders[token] = pie_html
            result.append(token)
            pos = next_pos
            if pos >= len(line):
                break

        lines[index] = ''.join(result)

    return '\n'.join(lines), placeholders


def restore_pie_blocks(html_content, placeholders):
    """Markdown 转换完成后把占位符还原成扇形统计图 HTML"""
    for token, pie_html in placeholders.items():
        html_content = html_content.replace(token, pie_html)
    return html_content


# 函数图象自定义格式：%f [c:l/d]#函数?颜色##函数?颜色#...%NONE%
_FUNC_ERROR_HTML = '<span style="color: #FF0000;">函数格式错误</span>'
_FUNC_PLACEHOLDER_PREFIX = 'MDFPLACEHOLDER'
_FUNC_PLACEHOLDER_SUFFIX = 'X'
_FUNC_NAMES = {
    'sin': 'Math.sin', 'cos': 'Math.cos', 'tan': 'Math.tan',
    'asin': 'Math.asin', 'acos': 'Math.acos', 'atan': 'Math.atan',
    'sinh': 'Math.sinh', 'cosh': 'Math.cosh', 'tanh': 'Math.tanh',
    'sqrt': 'Math.sqrt', 'abs': 'Math.abs', 'log': 'Math.log', 'ln': 'Math.log',
    'log10': 'Math.log10', 'exp': 'Math.exp', 'floor': 'Math.floor',
    'ceil': 'Math.ceil', 'round': 'Math.round', 'sign': 'Math.sign',
    'min': 'Math.min', 'max': 'Math.max', 'pow': 'Math.pow', 'atan2': 'Math.atan2'
}
_FUNC_CONSTANTS = {'pi': 'Math.PI', 'e': 'Math.E'}
_FUNC_TOKEN_RE = re.compile(r'\s*(\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?|[A-Za-z_][A-Za-z_0-9]*|\*\*|[+\-*/^(),=])')


def _func_insert_implicit_mul(expr):
    """在函数表达式中补上省略的乘号，如 2x -> 2*x，(x+1)x -> (x+1)*x"""
    tokens = []
    pos = 0
    while pos < len(expr):
        match = _FUNC_TOKEN_RE.match(expr, pos)
        if not match:
            if expr[pos:].strip() == '':
                break
            return None
        tokens.append(match.group(1))
        pos = match.end()
    if not tokens:
        return None

    def is_value_end(token):
        """可作为乘号左侧的 token：数字、变量名、右括号"""
        return token == ')' or re.match(r'[\d.]|[A-Za-z_]', token) is not None

    def is_value_start(token):
        """可作为乘号右侧的 token：数字、变量名、左括号（右括号/运算符不可）"""
        return token == '(' or re.match(r'[\d.]|[A-Za-z_]', token) is not None

    result = []
    for i, token in enumerate(tokens):
        if i > 0:
            prev = tokens[i - 1]
            func_call = prev in _FUNC_NAMES and token == '('
            if is_value_end(prev) and is_value_start(token) and not func_call:
                result.append('*')
        result.append(token)
    return ' '.join(result)


def _func_ast_to_js(node):
    """把通过白名单校验的 Python AST 节点转成安全的 JS 表达式"""
    if isinstance(node, ast.Constant):
        if isinstance(node.value, bool) or not isinstance(node.value, (int, float)):
            return None
        return repr(node.value)
    if isinstance(node, ast.Name):
        if node.id == 'x':
            return 'x'
        return _FUNC_CONSTANTS.get(node.id)
    if isinstance(node, ast.BinOp):
        left, right = _func_ast_to_js(node.left), _func_ast_to_js(node.right)
        if left is None or right is None:
            return None
        ops = {
            ast.Add: lambda: f'({left}+{right})',
            ast.Sub: lambda: f'({left}-{right})',
            ast.Mult: lambda: f'({left}*{right})',
            ast.Div: lambda: f'({left}/{right})',
            ast.Mod: lambda: f'({left}%{right})',
            ast.Pow: lambda: f'Math.pow({left},{right})'
        }
        maker = ops.get(type(node.op))
        return maker() if maker else None
    if isinstance(node, ast.UnaryOp):
        operand = _func_ast_to_js(node.operand)
        if operand is None:
            return None
        if isinstance(node.op, ast.UAdd):
            return f'(+{operand})'
        if isinstance(node.op, ast.USub):
            return f'(-{operand})'
        return None
    if isinstance(node, ast.Call):
        if not isinstance(node.func, ast.Name) or node.func.id not in _FUNC_NAMES or node.keywords:
            return None
        args = [_func_ast_to_js(arg) for arg in node.args]
        if not args or any(arg is None for arg in args):
            return None
        return f'{_FUNC_NAMES[node.func.id]}({",".join(args)})'
    return None


def _func_expr_to_js(expr_text):
    """校验单个函数表达式并返回安全的 JS 表达式；非法返回 None"""
    raw = expr_text.strip().replace('^', '**')
    spaced = _func_insert_implicit_mul(raw)
    if spaced is None:
        return None
    try:
        tree = ast.parse(spaced, mode='eval')
    except SyntaxError:
        return None
    return _func_ast_to_js(tree.body)


def _parse_function_item(expr_text):
    """解析单个函数项，返回 (js, vertical) 或 None；x=<常量> 表示竖直线"""
    vertical_match = re.fullmatch(r'\s*x\s*=\s*(.+?)\s*', expr_text)
    if vertical_match:
        right = vertical_match.group(1)
        if re.search(r'\bx\b', right):
            return None
        js = _func_expr_to_js(right)
        return (js, True) if js is not None else None
    js = _func_expr_to_js(expr_text)
    return (js, False) if js is not None else None


def _build_function_html(params_str, funcs_str):
    """根据参数和函数列表生成函数图象卡片；格式错误返回红色错误文字"""
    theme = 'l'
    seen = set()
    if params_str.strip():
        for part in params_str.strip().split('|'):
            part = part.strip()
            if ':' not in part:
                return _FUNC_ERROR_HTML
            key, value = (item.strip() for item in part.split(':', 1))
            if key != 'c' or key in seen or value not in ('l', 'd'):
                return _FUNC_ERROR_HTML
            seen.add(key)
            theme = value

    # 逐项解析 #函数?颜色##函数?颜色#... ，任一项非法即整体错误
    items = []
    pos = 0
    while pos < len(funcs_str):
        if funcs_str[pos] != '#':
            return _FUNC_ERROR_HTML
        qmark = funcs_str.find('?', pos + 1)
        end = funcs_str.find('#', qmark + 1) if qmark != -1 else -1
        if qmark == -1 or end == -1 or end <= qmark:
            return _FUNC_ERROR_HTML
        expr_text = funcs_str[pos + 1:qmark].strip()
        color = _parse_timeline_color(funcs_str[qmark + 1:end])
        if not expr_text or color is None:
            return _FUNC_ERROR_HTML
        parsed = _parse_function_item(expr_text)
        if parsed is None:
            return _FUNC_ERROR_HTML
        js, vertical = parsed
        items.append({'expr': expr_text, 'js': js, 'color': color, 'vertical': vertical})
        pos = end + 1
    if not items:
        return _FUNC_ERROR_HTML

    funcs_json = html.escape(json.dumps(items, ensure_ascii=False), quote=True)
    row_parts = []
    for item in items:
        expr_attr = html.escape(item['expr'], quote=True)
        row_parts.append(
            '<span class="md-func-row">'
            f'<code>{html.escape(item["expr"])}</code>'
            f'<button type="button" class="md-func-copy" data-expr="{expr_attr}">复制</button>'
            '</span>'
        )
    all_expr = html.escape('\n'.join(item['expr'] for item in items), quote=True)

    return (
        f'<span class="md-func md-func-{"light" if theme == "l" else "dark"}" data-funcs="{funcs_json}">'
        '<span class="md-func-plot">'
        '<svg class="md-func-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 220" '
        'preserveAspectRatio="none"></svg>'
        '<span class="md-func-hint">拖动平移 · 滚轮缩放</span>'
        '</span>'
        '<span class="md-func-toolbar">'
        '<button type="button" class="md-func-toggle">展开函数列表</button>'
        '<button type="button" class="md-func-center">回到中心</button>'
        f'<button type="button" class="md-func-copy-all" data-all="{all_expr}">复制所有函数</button>'
        '</span>'
        '<span class="md-func-list" hidden>'
        + ''.join(row_parts) +
        '</span></span>'
    )


def extract_function_blocks(text):
    """把单行函数图象块替换为占位符，避免被后续控制符解析打断"""
    placeholders = {}
    lines = text.split('\n')
    in_code_block = False

    for index, line in enumerate(lines):
        if line.strip().startswith('```'):
            in_code_block = not in_code_block
            continue
        if in_code_block:
            continue

        result = []
        pos = 0
        while True:
            match = re.search(r'%f(?=\s|%)', line[pos:])
            if not match:
                result.append(line[pos:])
                break
            start = pos + match.start()
            result.append(line[pos:start])
            open_end = line.find('%', start + 2)
            close_start = line.find('%NONE%', open_end + 1) if open_end != -1 else -1
            if open_end == -1 or close_start == -1:
                func_html = _FUNC_ERROR_HTML
                next_pos = len(line)
            else:
                func_html = _build_function_html(line[start + 2:open_end], line[open_end + 1:close_start])
                next_pos = close_start + len('%NONE%')

            token = f'{_FUNC_PLACEHOLDER_PREFIX}{len(placeholders)}{_FUNC_PLACEHOLDER_SUFFIX}'
            placeholders[token] = func_html
            result.append(token)
            pos = next_pos
            if pos >= len(line):
                break

        lines[index] = ''.join(result)

    return '\n'.join(lines), placeholders


def restore_function_blocks(html_content, placeholders):
    """Markdown 转换完成后把占位符还原成函数图象 HTML"""
    for token, func_html in placeholders.items():
        html_content = html_content.replace(token, func_html)
    return html_content


# Markdown处理函数
def process_markdown_content(markdown_content):
    """处理Markdown内容，支持自定义符号和扩展功能"""
    # 预处理：处理自定义颜色和背景色控制符
    def process_color_controls(text):
        # 颜色缩写映射使用模块顶部的全局 color_map

        # 辅助函数：计算颜色的反色
        def invert_color(hex_color):
            """计算颜色的反色，用于描边默认颜色"""
            if not hex_color or hex_color == 'inherit':
                return '#FFFFFF'  # 默认白色描边
            # 移除 # 号
            hex_color = hex_color.lstrip('#')
            # 解析 RGB
            r = 255 - int(hex_color[0:2], 16)
            g = 255 - int(hex_color[2:4], 16)
            b = 255 - int(hex_color[4:6], 16)
            return f'#{r:02X}{g:02X}{b:02X}'
        
        # 辅助函数：解析图片控制符参数
        def parse_image_params(params_str):
            """解析图片控制符参数: f:路径|s:x大小,y大小"""
            params = {'file': None, 'size': None}
            parts = params_str.split('|')
            for part in parts:
                part = part.strip()
                if part.startswith('f:'):
                    params['file'] = part[2:].strip()
                elif part.startswith('s:'):
                    size_str = part[2:].strip()
                    if ',' in size_str:
                        w, h = size_str.split(',')
                        params['size'] = (w.strip(), h.strip())
                    else:
                        params['size'] = (size_str, None)
            return params
        
        # 辅助函数：解析描边控制符参数
        def parse_stroke_params(params_str):
            """解析描边控制符参数: o:大小|c:颜色"""
            params = {'width': None, 'color': None}
            parts = params_str.split('|')
            for part in parts:
                part = part.strip()
                if part.startswith('o:'):
                    try:
                        params['width'] = float(part[2:].strip())
                    except ValueError:
                        pass
                elif part.startswith('c:'):
                    color_code = part[2:].strip()
                    if color_code in color_map:
                        params['color'] = color_map[color_code]
                    elif len(color_code) == 6 and all(c in '0123456789ABCDEFabcdef' for c in color_code):
                        params['color'] = f'#{color_code.upper()}'
            return params
        
        # 辅助函数：为每个字符添加旋转样式
        def apply_rotation_to_text(text, angle, styles=None):
            """为每个字符添加旋转效果，同时保持其他样式"""
            if not text:
                return ''
            style_str = ''
            if styles:
                style_str = '; '.join(styles) + '; '
            chars = []
            for char in text:
                if char == ' ':
                    chars.append(f'<span style="{style_str}display: inline-block; transform: rotate({angle}deg);">&nbsp;</span>')
                else:
                    chars.append(f'<span style="{style_str}display: inline-block; transform: rotate({angle}deg);">{char}</span>')
            return ''.join(chars)
        
        # 处理颜色控制符
        lines = text.split('\n')
        processed_lines = []
        
        for line in lines:
            # 跳过代码块中的内容
            if line.strip().startswith('```'):
                processed_lines.append(line)
                continue
            
            # 处理颜色、背景色、描边、旋转和粗细控制符
            parts = []
            current_pos = 0
            current_color = None
            current_background = None
            current_stroke = None  # 描边宽度
            current_stroke_color = None  # 描边颜色（None 表示使用反色）
            current_rotation = None  # 旋转角度
            current_weight = None  # 文字粗细
            
            while current_pos < len(line):
                # 查找下一个控制符（%、°）
                percent_pos = line.find('%', current_pos)
                degree_pos = line.find('°', current_pos)
                
                # 确定下一个控制符的位置和类型
                start_pos = -1
                control_type = None
                
                if percent_pos != -1 and degree_pos != -1:
                    if percent_pos < degree_pos:
                        start_pos = percent_pos
                        control_type = 'percent'
                    else:
                        start_pos = degree_pos
                        control_type = 'degree'
                elif percent_pos != -1:
                    start_pos = percent_pos
                    control_type = 'percent'
                elif degree_pos != -1:
                    start_pos = degree_pos
                    control_type = 'degree'
                
                if start_pos == -1:
                    # 没有更多控制符，添加剩余文本
                    remaining_text = line[current_pos:]
                    if remaining_text:
                        # 应用当前的样式设置
                        styles = []
                        if current_color:
                            styles.append(f'color: {current_color}')
                        if current_background:
                            styles.append(f'background-color: {current_background}')
                        if current_stroke:
                            stroke_color = current_stroke_color if current_stroke_color else invert_color(current_color)
                            styles.append(f'-webkit-text-stroke: {current_stroke}px {stroke_color}')
                        if current_weight:
                            styles.append(f'font-weight: {current_weight}')
                        
                        if current_rotation is not None:
                            parts.append(apply_rotation_to_text(remaining_text, current_rotation, styles if styles else None))
                        elif styles:
                            style_str = '; '.join(styles)
                            parts.append(f'<span style="{style_str}">{remaining_text}</span>')
                        else:
                            parts.append(remaining_text)
                    break
                
                # 添加控制符前的文本
                if current_pos < start_pos:
                    text_before = line[current_pos:start_pos]
                    if text_before:
                        # 应用当前的样式设置
                        styles = []
                        if current_color:
                            styles.append(f'color: {current_color}')
                        if current_background:
                            styles.append(f'background-color: {current_background}')
                        if current_stroke:
                            stroke_color = current_stroke_color if current_stroke_color else invert_color(current_color)
                            styles.append(f'-webkit-text-stroke: {current_stroke}px {stroke_color}')
                        if current_weight:
                            styles.append(f'font-weight: {current_weight}')
                        
                        if current_rotation is not None:
                            parts.append(apply_rotation_to_text(text_before, current_rotation, styles if styles else None))
                        elif styles:
                            style_str = '; '.join(styles)
                            parts.append(f'<span style="{style_str}">{text_before}</span>')
                        else:
                            parts.append(text_before)
                
                if control_type == 'degree':
                    # 背景色控制符 °XXX°
                    end_pos = line.find('°', start_pos + 1)
                    if end_pos == -1:
                        parts.append(line[start_pos:])
                        break
                    
                    color_code = line[start_pos + 1:end_pos]
                    if color_code in color_map:
                        color_value = color_map[color_code]
                    elif len(color_code) == 6 and all(c in '0123456789ABCDEFabcdef' for c in color_code):
                        color_value = f'#{color_code.upper()}'
                    else:
                        parts.append(line[start_pos:end_pos + 1])
                        current_pos = end_pos + 1
                        continue
                    
                    current_background = color_value if color_value != 'inherit' else None
                    current_pos = end_pos + 1
                else:
                    # 百分号控制符 %XXX%
                    end_pos = line.find('%', start_pos + 1)
                    if end_pos == -1:
                        parts.append(line[start_pos:])
                        break
                    
                    control_code = line[start_pos + 1:end_pos]
                    
                    # 检查是否是图片控制符 %p ... %
                    if control_code.startswith('p '):
                        params_str = control_code[2:].strip()
                        img_params = parse_image_params(params_str)
                        if img_params['file']:
                            img_src = img_params['file']
                            size_attr = ''
                            if img_params['size']:
                                w, h = img_params['size']
                                if h:
                                    size_attr = f' width="{w}" height="{h}"'
                                else:
                                    size_attr = f' width="{w}"'
                            parts.append(f'<img src="{img_src}" alt="" style="display: inline-block; vertical-align: middle;"{size_attr}>')
                        current_pos = end_pos + 1
                        continue
                    
                    # 检查是否是描边控制符 %f o:大小|c:颜色%
                    if control_code.startswith('f '):
                        stroke_params_str = control_code[2:].strip()
                        if stroke_params_str == 'NONE' or 'NONE' in stroke_params_str:
                            current_stroke = None
                            current_stroke_color = None
                        else:
                            stroke_params = parse_stroke_params(stroke_params_str)
                            if stroke_params['width']:
                                current_stroke = stroke_params['width']
                                current_stroke_color = stroke_params['color']
                        current_pos = end_pos + 1
                        continue

                    # 检查是否是粗细控制符 %c s:数字%
                    if control_code.startswith('c '):
                        weight_params = control_code[2:].strip()
                        if weight_params == 'NONE' or 'NONE' in weight_params:
                            current_weight = None
                        elif weight_params.startswith('s:'):
                            try:
                                weight = weight_params[2:].strip()
                                current_weight = weight
                            except ValueError:
                                pass
                        current_pos = end_pos + 1
                        continue

                    # 检查是否是旋转控制符 %r a:数字%
                    if control_code.startswith('r '):
                        rotation_params = control_code[2:].strip()
                        if rotation_params.startswith('a:'):
                            try:
                                angle = float(rotation_params[2:])
                                current_rotation = angle
                            except ValueError:
                                pass
                        elif rotation_params == 'NONE' or 'NONE' in rotation_params:
                            current_rotation = None
                        current_pos = end_pos + 1
                        continue
                    
                    # 颜色控制符
                    if control_code in color_map:
                        # NONE 特殊处理：重置所有样式
                        if control_code == 'NONE':
                            current_color = None
                            current_stroke = None
                            current_stroke_color = None
                            current_rotation = None
                            current_weight = None
                        else:
                            color_value = color_map[control_code]
                            current_color = color_value if color_value != 'inherit' else None
                        current_pos = end_pos + 1
                        continue
                    elif len(control_code) == 6 and all(c in '0123456789ABCDEFabcdef' for c in control_code):
                        color_value = f'#{control_code.upper()}'
                        current_color = color_value
                        current_pos = end_pos + 1
                        continue
                    else:
                        # 无效控制符，保持原样
                        parts.append(line[start_pos:end_pos + 1])
                        current_pos = end_pos + 1
                        continue
            
            processed_lines.append(''.join(parts))
        
        return '\n'.join(processed_lines)
    
    # 先提取时间轴、扇形统计图与函数图象块（必须在颜色控制符之前处理）
    processed_content, timeline_placeholders = extract_timeline_blocks(markdown_content)
    processed_content, pie_placeholders = extract_pie_blocks(processed_content)
    processed_content, func_placeholders = extract_function_blocks(processed_content)

    # 再处理颜色控制符
    processed_content = process_color_controls(processed_content)
    
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

    # 还原时间轴、扇形统计图与函数图象块
    html_content = restore_timeline_blocks(html_content, timeline_placeholders)
    html_content = restore_pie_blocks(html_content, pie_placeholders)
    html_content = restore_function_blocks(html_content, func_placeholders)

    # 后处理：处理特殊附件链接
    def process_download_links(html_content):
        import re
        
        # 匹配附件链接模式：[dltag:文件名](下载地址)
        pattern = r'<p>\s*<a href="([^"]+)">dltag:([^<]+)</a>\s*</p>'
        
        def replace_download_link(match):
            download_url = match.group(1)
            filename = match.group(2)
            
            # 转义 URL 和文件名
            escaped_url = html.escape(download_url)
            escaped_filename = html.escape(filename)
            
            # 生成附件容器HTML
            return f'''
<div class="download-attachment">
    <div class="attachment-info">
        <span class="filename">{escaped_filename}</span>
        <div class="attachment-actions">
            <button class="info-button" data-url="{escaped_url}">查看信息</button>
            <button class="download-button" onclick="window.open('{escaped_url}', '_blank')" title="下载附件">下载</button>
        </div>
    </div>
    <div class="attachment-details" hidden></div>
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

# 读取博客配置
def load_blog_settings():
    """读取博客配置项"""
    settings_path = os.path.join(os.path.dirname(__file__), 'blogsettings.json')
    try:
        if os.path.exists(settings_path):
            with open(settings_path, 'r', encoding='utf-8') as f:
                settings = json.load(f)
                return {
                    'close_comment': settings.get('close_comment', False),
                    'close_share': settings.get('close_share', False),
                    'blogname': settings.get('blogname', '请在blogsettings.json中设置博客名称'),
                    'blognamestart': settings.get('blognamestart', '请在blogsettings.json中设置博客名称'),
                    'headerlightcount': settings.get('headerlightcount', 1),
                    'author_name': settings.get('author_name', '请在blogsettings.json中设置作者名称')
                }
    except Exception as e:
        print(f"读取博客配置失败: {e}")
    return {
        'close_comment': False,
        'close_share': False,
        'blogname': '请在blogsettings.json中设置博客名称',
        'blognamestart': '请在blogsettings.json中设置博客名称',
        'headerlightcount': 1,
        'author_name': '请在blogsettings.json中设置作者名称'
    }

# 全局变量：博客配置
BLOG_SETTINGS = load_blog_settings()
CLOSE_COMMENT = BLOG_SETTINGS['close_comment']
CLOSE_SHARE = BLOG_SETTINGS['close_share']

# 博客文章目录
BLOG_DIR = os.path.join(os.path.dirname(__file__), 'blogs')

# RSS 缓存数据
rss_articles_cache = []
rss_cache_lock = threading.Lock()
rss_timer = None

# MD5 计算缓存和锁
_md5_cache = {}  # {file_path: {"status": "calculating"/"done", "md5": "xxx"}}
_md5_calculating = set()  # 正在计算的文件路径集合
_md5_lock = threading.Lock()

def stop_rss_cache():
    """停止RSS缓存刷新线程"""
    global rss_timer
    if rss_timer:
        rss_timer.cancel()

def _calculate_md5_thread(file_path, cache_key):
    """后台线程计算文件 MD5"""
    try:
        hasher = hashlib.md5()
        with open(file_path, 'rb') as f:
            while chunk := f.read(8192):
                hasher.update(chunk)
        md5_value = hasher.hexdigest()
        
        with _md5_lock:
            _md5_cache[cache_key] = {"status": "done", "md5": md5_value}
            _md5_calculating.discard(cache_key)
    except Exception as e:
        with _md5_lock:
            _md5_cache[cache_key] = {"status": "error", "error": str(e)}
            _md5_calculating.discard(cache_key)


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
    """首页 - 显示文章列表，这个skip_welcome不要改成False，懒得移除了就这么补吧，啊啊啊啊啊啊啊啊啊"""
    settings = get_blog_settings()
    return render_template('index.html', 
                          skip_welcome=True, 
                          blogname=settings['blogname'],
                          blognamestart=settings['blognamestart'],
                          headerlightcount=settings['headerlightcount'])

@app.route('/notitle')
def notitle():
    """首页 - 跳过开场页面，直接显示主内容"""
    settings = get_blog_settings()
    return render_template('index.html',
                          skip_welcome=True,
                          blogname=settings['blogname'],
                          blognamestart=settings['blognamestart'],
                          headerlightcount=settings['headerlightcount'])

@app.route('/api/friendly_links')
@app.route('/friendly_links.json')  # 旧接口兼容
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

@app.route('/archive')
def archive():
    """归档页面"""
    settings = get_blog_settings()
    return render_template('archive.html',
                          blogname=settings['blogname'],
                          blognamestart=settings['blognamestart'],
                          headerlightcount=settings['headerlightcount'])

@app.route('/api/articles/dates')
def get_articles_dates():
    """获取所有文章的日期信息"""
    articles = []
    
    if os.path.exists(BLOG_DIR):
        for cat in os.listdir(BLOG_DIR):
            category_path = os.path.join(BLOG_DIR, cat)
            if os.path.isdir(category_path):
                for article_dir in os.listdir(category_path):
                    article_path = os.path.join(category_path, article_dir)
                    if os.path.isdir(article_path):
                        config_path = os.path.join(article_path, 'config.json')
                        if os.path.exists(config_path):
                            try:
                                with open(config_path, 'r', encoding='utf-8') as f:
                                    config = json.load(f)
                                
                                pub_date = None
                                if 'pub_date' in config:
                                    try:
                                        pub_date = datetime.datetime.fromisoformat(config['pub_date'])
                                    except:
                                        pub_date = datetime.datetime.now()
                                else:
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
                                
                                if pub_date:
                                    articles.append({
                                        'year': pub_date.year,
                                        'month': pub_date.month,
                                        'day': pub_date.day
                                    })
                            except Exception as e:
                                print(f"读取文章配置失败 {cat}/{article_dir}: {e}")
    
    return jsonify({'dates': articles})

@app.route('/api/articles/filter')
def filter_articles():
    """根据日期筛选文章"""
    year = request.args.get('year', type=int)
    month = request.args.get('month', type=int)
    day = request.args.get('day', type=int)
    
    articles = []
    categories = []
    
    if os.path.exists(BLOG_DIR):
        for cat in os.listdir(BLOG_DIR):
            category_path = os.path.join(BLOG_DIR, cat)
            if os.path.isdir(category_path):
                categories.append(cat)
        
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
                            
                            has_icon = find_article_icon(article_path) is not None
                            
                            pub_date = None
                            if 'pub_date' in config:
                                try:
                                    pub_date = datetime.datetime.fromisoformat(config['pub_date'])
                                except:
                                    pub_date = datetime.datetime.now()
                            else:
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
                            
                            should_include = True
                            if year and pub_date:
                                if pub_date.year != year:
                                    should_include = False
                                elif month and pub_date.month != month:
                                    should_include = False
                                elif day and pub_date.day != day:
                                    should_include = False
                            
                            if should_include and pub_date:
                                articles.append({
                                    'id': article_dir,
                                    'category': cat,
                                    'title': config.get('title', '无标题'),
                                    'small_title': config.get('small_title', '无简介'),
                                    'has_icon': has_icon,
                                    'order': cat_order.get(article_dir, float('inf')),
                                    'category_order': get_category_order(cat),
                                    'pub_date': pub_date.strftime('%Y-%m-%d') if pub_date else ''
                                })
                        except Exception as e:
                            print(f"读取文章配置失败 {cat}/{article_dir}: {e}")
    
    def get_pub_date_order(article):
        pub_date = article.get('pub_date')
        if not pub_date:
            return ''
        return pub_date
    
    articles.sort(key=get_pub_date_order, reverse=True)
    
    return jsonify({'articles': articles})

@app.route('/api/blog')
@app.route('/api/blog/<category>')
@app.route('/blog')  # 旧接口兼容
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
                                has_icon = find_article_icon(article_path) is not None
                                
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
                            has_icon = find_article_icon(article_path) is not None
                            
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



@app.route('/api/articles/content/<category>/<article_id>')
@app.route('/read/<category>/<article_id>/content')  # 旧接口兼容
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
                # 颜色缩写映射使用模块顶部的全局 color_map

                # 辅助函数：计算颜色的反色
                def invert_color(hex_color):
                    """计算颜色的反色，用于描边默认颜色"""
                    if not hex_color or hex_color == 'inherit':
                        return '#FFFFFF'
                    hex_color = hex_color.lstrip('#')
                    r = 255 - int(hex_color[0:2], 16)
                    g = 255 - int(hex_color[2:4], 16)
                    b = 255 - int(hex_color[4:6], 16)
                    return f'#{r:02X}{g:02X}{b:02X}'
                
                # 辅助函数：解析图片控制符参数
                def parse_image_params(params_str):
                    params = {'file': None, 'size': None}
                    parts = params_str.split('|')
                    for part in parts:
                        part = part.strip()
                        if part.startswith('f:'):
                            params['file'] = part[2:].strip()
                        elif part.startswith('s:'):
                            size_str = part[2:].strip()
                            if ',' in size_str:
                                w, h = size_str.split(',')
                                params['size'] = (w.strip(), h.strip())
                            else:
                                params['size'] = (size_str, None)
                    return params
                
                # 辅助函数：解析描边控制符参数
                def parse_stroke_params(params_str):
                    params = {'width': None, 'color': None}
                    parts = params_str.split('|')
                    for part in parts:
                        part = part.strip()
                        if part.startswith('o:'):
                            try:
                                params['width'] = float(part[2:].strip())
                            except ValueError:
                                pass
                        elif part.startswith('c:'):
                            color_code = part[2:].strip()
                            if color_code in color_map:
                                params['color'] = color_map[color_code]
                            elif len(color_code) == 6 and all(c in '0123456789ABCDEFabcdef' for c in color_code):
                                params['color'] = f'#{color_code.upper()}'
                    return params
                
                # 辅助函数：为每个字符添加旋转样式
                def apply_rotation_to_text(text, angle, styles=None):
                    if not text:
                        return ''
                    style_str = ''
                    if styles:
                        style_str = '; '.join(styles) + '; '
                    chars = []
                    for char in text:
                        if char == ' ':
                            chars.append(f'<span style="{style_str}display: inline-block; transform: rotate({angle}deg);">&nbsp;</span>')
                        else:
                            chars.append(f'<span style="{style_str}display: inline-block; transform: rotate({angle}deg);">{char}</span>')
                    return ''.join(chars)
                
                # 处理颜色控制符
                lines = text.split('\n')
                processed_lines = []
                
                for line in lines:
                    # 跳过代码块中的内容
                    if line.strip().startswith('```'):
                        processed_lines.append(line)
                        continue
                    
                    # 处理颜色、背景色、描边和旋转控制符
                    parts = []
                    current_pos = 0
                    current_color = None
                    current_background = None
                    current_stroke = None
                    current_stroke_color = None
                    current_rotation = None
                    
                    while current_pos < len(line):
                        # 查找下一个控制符（%、°）
                        percent_pos = line.find('%', current_pos)
                        degree_pos = line.find('°', current_pos)
                        
                        # 确定下一个控制符的位置和类型
                        start_pos = -1
                        control_type = None
                        
                        if percent_pos != -1 and degree_pos != -1:
                            if percent_pos < degree_pos:
                                start_pos = percent_pos
                                control_type = 'percent'
                            else:
                                start_pos = degree_pos
                                control_type = 'degree'
                        elif percent_pos != -1:
                            start_pos = percent_pos
                            control_type = 'percent'
                        elif degree_pos != -1:
                            start_pos = degree_pos
                            control_type = 'degree'
                        
                        if start_pos == -1:
                            remaining_text = line[current_pos:]
                            if remaining_text:
                                styles = []
                                if current_color:
                                    styles.append(f'color: {current_color}')
                                if current_background:
                                    styles.append(f'background-color: {current_background}')
                                if current_stroke:
                                    stroke_color = current_stroke_color if current_stroke_color else invert_color(current_color)
                                    styles.append(f'-webkit-text-stroke: {current_stroke}px {stroke_color}')
                                
                                if current_rotation is not None:
                                    parts.append(apply_rotation_to_text(remaining_text, current_rotation, styles if styles else None))
                                elif styles:
                                    style_str = '; '.join(styles)
                                    parts.append(f'<span style="{style_str}">{remaining_text}</span>')
                                else:
                                    parts.append(remaining_text)
                            break
                        
                        if current_pos < start_pos:
                            text_before = line[current_pos:start_pos]
                            if text_before:
                                styles = []
                                if current_color:
                                    styles.append(f'color: {current_color}')
                                if current_background:
                                    styles.append(f'background-color: {current_background}')
                                if current_stroke:
                                    stroke_color = current_stroke_color if current_stroke_color else invert_color(current_color)
                                    styles.append(f'-webkit-text-stroke: {current_stroke}px {stroke_color}')
                                
                                if current_rotation is not None:
                                    parts.append(apply_rotation_to_text(text_before, current_rotation, styles if styles else None))
                                elif styles:
                                    style_str = '; '.join(styles)
                                    parts.append(f'<span style="{style_str}">{text_before}</span>')
                                else:
                                    parts.append(text_before)
                        
                        if control_type == 'degree':
                            end_pos = line.find('°', start_pos + 1)
                            if end_pos == -1:
                                parts.append(line[start_pos:])
                                break
                            
                            color_code = line[start_pos + 1:end_pos]
                            if color_code in color_map:
                                color_value = color_map[color_code]
                            elif len(color_code) == 6 and all(c in '0123456789ABCDEFabcdef' for c in color_code):
                                color_value = f'#{color_code.upper()}'
                            else:
                                parts.append(line[start_pos:end_pos + 1])
                                current_pos = end_pos + 1
                                continue
                            
                            current_background = color_value if color_value != 'inherit' else None
                            current_pos = end_pos + 1
                        else:
                            end_pos = line.find('%', start_pos + 1)
                            if end_pos == -1:
                                parts.append(line[start_pos:])
                                break
                            
                            control_code = line[start_pos + 1:end_pos]
                            
                            # 图片控制符
                            if control_code.startswith('p '):
                                params_str = control_code[2:].strip()
                                img_params = parse_image_params(params_str)
                                if img_params['file']:
                                    img_src = img_params['file']
                                    size_attr = ''
                                    if img_params['size']:
                                        w, h = img_params['size']
                                        if h:
                                            size_attr = f' width="{w}" height="{h}"'
                                        else:
                                            size_attr = f' width="{w}"'
                                    parts.append(f'<img src="{img_src}" alt="" style="display: inline-block; vertical-align: middle;"{size_attr}>')
                                current_pos = end_pos + 1
                                continue
                            
                            # 描边控制符
                            if control_code.startswith('f '):
                                stroke_params_str = control_code[2:].strip()
                                if stroke_params_str == 'NONE' or 'NONE' in stroke_params_str:
                                    current_stroke = None
                                    current_stroke_color = None
                                else:
                                    stroke_params = parse_stroke_params(stroke_params_str)
                                    if stroke_params['width']:
                                        current_stroke = stroke_params['width']
                                        current_stroke_color = stroke_params['color']
                                current_pos = end_pos + 1
                                continue
                            
                            # 旋转控制符
                            if control_code.startswith('r '):
                                rotation_params = control_code[2:].strip()
                                if rotation_params.startswith('a:'):
                                    try:
                                        angle = float(rotation_params[2:])
                                        current_rotation = angle
                                    except ValueError:
                                        pass
                                elif rotation_params == 'NONE' or 'NONE' in rotation_params:
                                    current_rotation = None
                                current_pos = end_pos + 1
                                continue
                            
                            # 颜色控制符
                            if control_code in color_map:
                                # NONE 特殊处理：重置所有样式
                                if control_code == 'NONE':
                                    current_color = None
                                    current_stroke = None
                                    current_stroke_color = None
                                    current_rotation = None
                                else:
                                    color_value = color_map[control_code]
                                    current_color = color_value if color_value != 'inherit' else None
                                current_pos = end_pos + 1
                                continue
                            elif len(control_code) == 6 and all(c in '0123456789ABCDEFabcdef' for c in control_code):
                                color_value = f'#{control_code.upper()}'
                                current_color = color_value
                                current_pos = end_pos + 1
                                continue
                            else:
                                parts.append(line[start_pos:end_pos + 1])
                                current_pos = end_pos + 1
                                continue
                    
                    processed_lines.append(''.join(parts))
                
                return '\n'.join(processed_lines)
            
            # 先提取时间轴、扇形统计图与函数图象块（必须在颜色控制符之前处理）
            processed_content, timeline_placeholders = extract_timeline_blocks(md_content)
            processed_content, pie_placeholders = extract_pie_blocks(processed_content)
            processed_content, func_placeholders = extract_function_blocks(processed_content)

            # 再处理颜色控制符
            processed_content = process_color_controls(processed_content)
            
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

            # 还原时间轴、扇形统计图与函数图象块
            content = restore_timeline_blocks(content, timeline_placeholders)
            content = restore_pie_blocks(content, pie_placeholders)
            content = restore_function_blocks(content, func_placeholders)
            
            # 后处理：处理特殊附件链接
            def process_download_links(html_content):
                import re
                
                # 匹配附件链接模式：[dltag:文件名](下载地址)
                pattern = r'<p>\s*<a href="([^"]+)">dltag:([^<]+)</a>\s*</p>'
                
                def replace_download_link(match):
                    download_url = match.group(1)
                    filename = match.group(2)
                    
                    # 转义 URL 和文件名
                    escaped_url = html.escape(download_url)
                    escaped_filename = html.escape(filename)
                    
                    # 生成附件容器HTML
                    return f'''
<div class="download-attachment">
    <div class="attachment-info">
        <span class="filename">{escaped_filename}</span>
        <div class="attachment-actions">
            <button class="info-button" data-url="{escaped_url}">查看信息</button>
            <button class="download-button" onclick="window.open('{escaped_url}', '_blank')" title="下载附件">下载</button>
        </div>
    </div>
    <div class="attachment-details" hidden></div>
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
    
    # 转载模式：仅布尔 true 生效；缺少 owner 时给出明确提示文字
    is_repost = config.get('copy') is True
    if is_repost:
        owner = config.get('owner')
        if not isinstance(owner, str) or not owner.strip():
            owner = '请在文章配置(config.json)中指定owner'
    else:
        owner = 'manyJ'

    return {
        'title': config.get('title', '无标题'),
        'small_title': config.get('small_title', '无简介'),
        'content': content,
        'update_date': update_date,
        'ai': config.get('ai', ''),
        'license': config.get('license') or 'CC BY-NC-SA 4.0',
        'repost': is_repost,
        'owner': owner
    }

@app.route('/api/articles/icon/<category>/<article_id>')
@app.route('/read/<category>/<article_id>/icon')  # 旧接口兼容
def get_article_icon(category, article_id):
    """获取文章封面图片，支持 png/jpg/jpeg/webp"""
    article_path = os.path.join(BLOG_DIR, category, article_id)
    icon_filename = find_article_icon(article_path)

    if icon_filename:
        return send_from_directory(article_path, icon_filename)
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

@app.route('/js/read/comment.js')
def comment_js_file():
    """评论JS文件访问控制"""
    if CLOSE_COMMENT:
        abort(404)
    
    response = send_from_directory('js/read', 'comment.js')
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    response.headers['Content-Type'] = 'application/javascript'
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

@app.route('/api/attachment/info')
def get_attachment_info():
    """获取附件文件信息"""
    url = request.args.get('url', '')
    
    # 解析 URL
    parsed = urllib.parse.urlparse(url)
    
    # 校验协议（必须是 http 或 https，或者相对路径）
    if parsed.scheme and parsed.scheme not in ('http', 'https'):
        return {'error': '非本地资源无法查看'}, 400
    
    # 校验 origin（如果是完整 URL，检查是否为本地）
    if parsed.netloc:
        # 检查是否为当前服务的 origin
        host = request.host
        if parsed.netloc != host:
            return {'error': '非本地资源无法查看'}, 400
    
    # 校验 pathname 前缀（必须以 /res/ 开头）
    pathname = parsed.path
    if not pathname.startswith('/res/'):
        return {'error': '非本地资源无法查看'}, 400
    
    # 安全校验：pathname 不能包含 ..
    if '..' in pathname:
        return {'error': '无效的文件路径'}, 400
    
    # 获取文件名（去除 /res/ 前缀）
    filename = pathname[5:]  # 去除 '/res/'
    
    # 安全校验：文件名不能以 / 开头（防止路径遍历）
    if filename.startswith('/'):
        return {'error': '无效的文件路径'}, 400
    
    # 构建文件路径
    resources_path = os.path.join(os.path.dirname(__file__), 'resources')
    file_path = os.path.join(resources_path, filename)
    
    # 检查文件是否存在
    if not os.path.exists(file_path):
        return {'error': '文件不存在'}, 404
    
    # 获取文件信息
    stat_info = os.stat(file_path)
    
    return {
        'created_at': datetime.datetime.fromtimestamp(stat_info.st_ctime).isoformat(),
        'modified_at': datetime.datetime.fromtimestamp(stat_info.st_mtime).isoformat(),
        'size': stat_info.st_size
    }

@app.route('/api/attachment/md5')
def get_attachment_md5():
    """获取附件 MD5 值"""
    # 获取并解析 URL
    url = request.args.get('url', '')
    
    # 安全校验（复用 /api/attachment/info 的逻辑）
    parsed = urllib.parse.urlparse(url)
    
    # 校验协议（必须是 http 或 https，或者相对路径）
    if parsed.scheme and parsed.scheme not in ('http', 'https'):
        return jsonify({'error': '非本地资源无法查看'}), 400
    
    # 校验 origin（如果是完整 URL，检查是否为本地）
    if parsed.netloc:
        host = request.host
        if parsed.netloc != host:
            return jsonify({'error': '非本地资源无法查看'}), 400
    
    # 校验 pathname 前缀（必须以 /res/ 开头）
    pathname = parsed.path
    if not pathname.startswith('/res/'):
        return jsonify({'error': '非本地资源无法查看'}), 400
    
    # 安全校验：pathname 不能包含 ..
    if '..' in pathname:
        return jsonify({'error': '无效的文件路径'}), 400
    
    # 获取文件名（去除 /res/ 前缀）
    filename = pathname[5:]  # 去除 '/res/'
    
    # 安全校验：文件名不能以 / 开头（防止路径遍历）
    if filename.startswith('/'):
        return jsonify({'error': '无效的文件路径'}), 400
    
    # 构建文件路径
    resources_path = os.path.join(os.path.dirname(__file__), 'resources')
    file_path = os.path.join(resources_path, filename)
    
    # 检查文件是否存在
    if not os.path.exists(file_path):
        return jsonify({'error': '文件不存在'}), 404
    
    # 使用文件绝对路径作为缓存 key
    cache_key = os.path.abspath(file_path)
    
    # 检查缓存
    with _md5_lock:
        if cache_key in _md5_cache:
            return jsonify(_md5_cache[cache_key])
        if cache_key in _md5_calculating:
            return jsonify({'status': 'calculating'})
    
    # 启动后台线程
    with _md5_lock:
        _md5_calculating.add(cache_key)
        _md5_cache[cache_key] = {"status": "calculating"}
    
    thread = threading.Thread(target=_calculate_md5_thread, args=(file_path, cache_key))
    thread.daemon = True
    thread.start()
    
    return jsonify({'status': 'calculating'})

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

def _unquote_url_text(value):
    """把可能被多层 URL 编码（如 %25E9...）的文本还原成原文"""
    prev = None
    for _ in range(5):
        if value == prev:
            break
        prev = value
        value = urllib.parse.unquote(value)
    return value


@app.route('/api/share/<category>/<article>')
def api_share(category, article):
    """获取或创建文章的分享短 id（仅对真实存在的文章生成）"""
    # 检查分享功能是否关闭
    if CLOSE_SHARE:
        return jsonify({'success': False, 'message': '分享功能已关闭'}), 404

    # 前端拿到的分类/文章名本身已是 URL 编码串，请求时又编码一次，
    # Flask 只解一层；验证目录前先反复解码还原成真实目录名。
    real_category = _unquote_url_text(category)
    real_article = _unquote_url_text(article)
    article_path = os.path.join(BLOG_DIR, real_category, real_article)
    if not (os.path.isdir(article_path) and os.path.exists(os.path.join(article_path, 'blog.md'))):
        return jsonify({'success': False, 'message': '文章不存在'}), 404

    try:
        init_share_db()
        conn = sqlite3.connect(SHARE_DB_PATH)
        try:
            row = conn.execute(
                'SELECT short_id FROM sharelink WHERE category = ? AND article = ? LIMIT 1',
                (category, article)
            ).fetchone()
            if row:
                return jsonify({'success': True, 'short_id': row[0]})

            # 冲突则重试，确保三位 id 唯一
            for _ in range(100):
                short_id = generate_share_id()
                exists = conn.execute(
                    'SELECT 1 FROM sharelink WHERE short_id = ?', (short_id,)
                ).fetchone()
                if exists:
                    continue
                conn.execute(
                    'INSERT INTO sharelink (category, article, short_id) VALUES (?, ?, ?)',
                    (category, article, short_id)
                )
                conn.commit()
                return jsonify({'success': True, 'short_id': short_id})

            return jsonify({'success': False, 'message': '生成简短id失败'}), 500
        finally:
            conn.close()
    except Exception as e:
        print(f"生成分享链接失败: {e}")
        return jsonify({'success': False, 'message': f'生成分享链接失败: {str(e)}'}), 500

# 分享短链接数据库
SHARE_DB_PATH = os.path.join(os.path.dirname(__file__), 'instance', 'share.db')
SHARE_ID_CHARS = string.ascii_lowercase + string.digits


def init_share_db():
    """确保分享数据库与 sharelink 表存在（列顺序：分类、文章、简短id）"""
    os.makedirs(os.path.dirname(SHARE_DB_PATH), exist_ok=True)
    conn = sqlite3.connect(SHARE_DB_PATH)
    try:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS sharelink (
                category TEXT NOT NULL,
                article TEXT NOT NULL,
                short_id TEXT NOT NULL UNIQUE
            )
        ''')
        conn.commit()
    finally:
        conn.close()


def generate_share_id():
    """生成三位数字+小写字母混合 id"""
    return ''.join(random.choice(SHARE_ID_CHARS) for _ in range(3))


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
    # 检查评论功能是否关闭
    if CLOSE_COMMENT:
        return jsonify({'success': False, 'message': '评论功能已关闭'}), 404
    
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
    # 检查评论功能是否关闭
    if CLOSE_COMMENT:
        return jsonify({'success': False, 'message': '评论功能已关闭'}), 404
    
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
    
    settings = get_blog_settings()
    return render_template('read.html', 
                          article_id=f"{category}/{article_id}", 
                          comments=comments, 
                          close_comment=CLOSE_COMMENT,
                          close_share=CLOSE_SHARE,
                          blogname=settings['blogname'],
                          author_name=settings.get('author_name', '请在blogsettings.json中设置作者名称'))

@app.route('/browsertest')
def browsertest():
    """浏览器测试页面"""
    # 获取客户端信息
    client_ip = get_real_client_ip()
    user_agent = request.headers.get('User-Agent', '未知')
    request_time = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    return render_template('browsertest.html',
        client_ip=client_ip,
        user_agent=user_agent,
        request_time=request_time)

@app.errorhandler(404)
def handle_404(error):
    """三位字符的根路径视为分享短路由，查到记录则跳转到原文"""
    # 分享功能关闭时不处理短路由，保持默认 404
    if CLOSE_SHARE:
        return error
    short_id = request.path.strip('/')
    if len(short_id) == 3:
        init_share_db()
        conn = sqlite3.connect(SHARE_DB_PATH)
        try:
            row = conn.execute(
                'SELECT category, article FROM sharelink WHERE short_id = ?',
                (short_id,)
            ).fetchone()
        finally:
            conn.close()
        if row:
            # 数据库里存的分类/文章名可能已是 URL 编码形式，跳转前先还原成原文
            # 再统一编码，避免 %25E9... 这类双重编码导致跳到错误路径。
            category = urllib.parse.quote(_unquote_url_text(row[0]), safe='')
            article = urllib.parse.quote(_unquote_url_text(row[1]), safe='')
            return redirect(f'/read/{category}/{article}')
    # 非短路由保持 Flask 默认 404
    return error

# 初始化数据库
init_db()
init_share_db()

if __name__ == '__main__':
    app.run(debug=True, port=26178)