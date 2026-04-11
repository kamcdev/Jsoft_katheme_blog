// Markdown编辑器前端逻辑
class MarkdownEditor {
    constructor() {
        this.editor = document.getElementById('markdown-editor');
        this.preview = document.getElementById('markdown-preview');
        this.tabButtons = document.querySelectorAll('.tab-button');
        this.tabContents = document.querySelectorAll('.tab-content');
        this.toolButtons = document.querySelectorAll('.tool-button');
        this.clearButton = document.getElementById('clear-button');
        this.copyButton = document.getElementById('copy-button');
        this.downloadButton = document.getElementById('download-button');
        
        this.init();
    }
    
    init() {
        // 标签页切换
        this.tabButtons.forEach(button => {
            button.addEventListener('click', () => this.switchTab(button.dataset.tab));
        });
        
        // 工具按钮
        this.toolButtons.forEach(button => {
            button.addEventListener('click', () => this.insertText(button.dataset.insert));
        });
        
        // 操作按钮
        this.clearButton.addEventListener('click', () => this.clearEditor());
        this.copyButton.addEventListener('click', () => this.copyContent());
        this.downloadButton.addEventListener('click', () => this.downloadContent());
        
        // 实时预览（防抖处理）
        let previewTimeout;
        this.editor.addEventListener('input', () => {
            clearTimeout(previewTimeout);
            previewTimeout = setTimeout(() => {
                this.updatePreview();
            }, 500);
        });
        
        // 初始化预览
        this.updatePreview();
    }
    
    switchTab(tabName) {
        // 更新按钮状态
        this.tabButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.tab === tabName);
        });
        
        // 更新内容显示
        this.tabContents.forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });
        
        // 如果是预览标签，更新预览内容
        if (tabName === 'preview') {
            this.updatePreview();
        }
    }
    
    insertText(text) {
        const start = this.editor.selectionStart;
        const end = this.editor.selectionEnd;
        const selectedText = this.editor.value.substring(start, end);
        
        // 处理特殊插入逻辑
        let newText;
        if (text.includes('URL')) {
            // 链接插入
            const url = prompt('请输入链接地址:', 'https://');
            if (url !== null) {
                newText = text.replace('URL', url).replace('链接文字', selectedText || '链接文字');
            } else {
                return;
            }
        } else if (text.includes('图片URL')) {
            // 图片插入
            const url = prompt('请输入图片地址:', 'https://');
            if (url !== null) {
                newText = text.replace('图片URL', url).replace('图片描述', selectedText || '图片描述');
            } else {
                return;
            }
        } else {
            newText = text;
        }
        
        // 插入文本
        this.editor.value = this.editor.value.substring(0, start) + newText + this.editor.value.substring(end);
        
        // 设置光标位置
        const newCursorPos = start + newText.length;
        this.editor.setSelectionRange(newCursorPos, newCursorPos);
        this.editor.focus();
        
        // 更新预览
        this.updatePreview();
    }
    
    async updatePreview() {
        const content = this.editor.value.trim();
        
        if (!content) {
            this.preview.innerHTML = '<p class="preview-placeholder">预览内容将在这里显示...</p>';
            return;
        }
        
        try {
            const response = await fetch('/api/preview', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content: content })
            });
            
            if (response.ok) {
                const data = await response.json();
                this.preview.innerHTML = data.html;
                
                // 重新设计代码块布局，添加标题栏和复制按钮
                this.redesignCodeBlocks();
                
                // 重新渲染MathJax
                if (window.MathJax) {
                    window.MathJax.typesetPromise([this.preview]);
                }
            } else {
                const errorData = await response.json();
                this.preview.innerHTML = `<p class="error">预览失败: ${errorData.error || '未知错误'}</p>`;
            }
        } catch (error) {
            this.preview.innerHTML = `<p class="error">网络错误: ${error.message}</p>`;
        }
    }
    
    // 检测代码语言
    getCodeLanguage(codeBlock) {
        const classList = codeBlock.className.split(' ');
        
        // 查找语言类名
        for (const className of classList) {
            if (className.startsWith('language-')) {
                return className.replace('language-', '');
            }
        }
        
        // 根据内容猜测语言
        const content = codeBlock.textContent || '';
        
        if (content.includes('function') || content.includes('const ') || content.includes('let ') || content.includes('var ')) {
            return 'javascript';
        } else if (content.includes('def ') || content.includes('import ') || content.includes('print(')) {
            return 'python';
        } else if (content.includes('#include') || content.includes('int main')) {
            return 'cpp';
        } else if (content.includes('public class') || content.includes('System.out')) {
            return 'java';
        } else if (content.includes('<!DOCTYPE') || content.includes('<html')) {
            return 'html';
        } else if (content.includes('color:') || content.includes('background:')) {
            return 'css';
        }
        
        return 'text';
    }
    
    // 为代码块重新设计布局，添加标题栏和分隔线
    redesignCodeBlocks() {
        const codeBlocks = this.preview.querySelectorAll('pre code');
        
        codeBlocks.forEach(codeBlock => {
            const preElement = codeBlock.parentElement;
            const language = this.getCodeLanguage(codeBlock);
            
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
            
            // 创建新的pre元素，避免继承原始样式
            const newPreElement = document.createElement('pre');
            const newCodeElement = document.createElement('code');
            
            // 复制原始代码内容
            newCodeElement.innerHTML = codeBlock.innerHTML;
            newCodeElement.className = codeBlock.className;
            
            // 将代码元素添加到pre元素
            newPreElement.appendChild(newCodeElement);
            
            // 将新的pre元素添加到内容区域
            codeContent.appendChild(newPreElement);
            
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
    
    clearEditor() {
        if (confirm('确定要清空所有内容吗？')) {
            this.editor.value = '';
            this.updatePreview();
            this.editor.focus();
        }
    }
    
    async copyContent() {
        try {
            await navigator.clipboard.writeText(this.editor.value);
            this.showMessage('内容已复制到剪贴板');
        } catch (error) {
            // 备用方案
            this.editor.select();
            document.execCommand('copy');
            this.showMessage('内容已复制到剪贴板');
        }
    }
    
    downloadContent() {
        const content = this.editor.value;
        if (!content.trim()) {
            alert('编辑器内容为空');
            return;
        }
        
        const filename = prompt('请输入文件名（不含扩展名）:', `markdown-${new Date().toISOString().slice(0, 10)}`);
        if (filename === null) return;
        
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}.md`;
        link.click();
        URL.revokeObjectURL(url);
        
        this.showMessage('文件下载完成');
    }
    
    showMessage(message) {
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
        `;
        
        document.body.appendChild(messageEl);
        
        setTimeout(() => {
            document.body.removeChild(messageEl);
        }, 3000);
    }
}

// 页面加载完成后初始化编辑器
document.addEventListener('DOMContentLoaded', () => {
    new MarkdownEditor();
});

// 添加键盘快捷键支持
document.addEventListener('keydown', (e) => {
    // Ctrl+S 保存/下载
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        const editor = new MarkdownEditor();
        editor.downloadContent();
    }
    
    // Ctrl+D 清空
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        const editor = new MarkdownEditor();
        editor.clearEditor();
    }
    
    // Ctrl+C 复制
    if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !e.target.matches('textarea')) {
        e.preventDefault();
        const editor = new MarkdownEditor();
        editor.copyContent();
    }
});