// 函数图象自定义控制符（%f%）：绘制、平移、缩放、函数列表与复制
(function () {
    'use strict';

    var SVG_NS = 'http://www.w3.org/2000/svg';
    var WIDTH = 440;
    var HEIGHT = 220;
    var THEMES = {
        light: { bg: '#ffffff', grid: '#e6e8eb', axis: '#9aa0a6', text: '#4b5563', panel: '#f9fafb', btn: '#f3f4f6', btnText: '#1f2937' },
        dark: { bg: '#1f2126', grid: '#34373d', axis: '#8b929c', text: '#c9ced6', panel: '#26292f', btn: '#33373e', btnText: '#e5e7eb' }
    };

    function el(name, attrs) {
        var node = document.createElementNS(SVG_NS, name);
        if (attrs) {
            Object.keys(attrs).forEach(function (key) { node.setAttribute(key, attrs[key]); });
        }
        return node;
    }

    function compile(expr) {
        try {
            var fn = new Function('x', 'return (' + expr + ');');
            return function (x) {
                var v = fn(x);
                return typeof v === 'number' && isFinite(v) ? v : NaN;
            };
        } catch (e) {
            return function () { return NaN; };
        }
    }

    function formatTick(value) {
        return String(Math.round(value * 100) / 100);
    }

    function createCard(card) {
        if (card.dataset.funcInit === '1') return;
        card.dataset.funcInit = '1';

        var funcs;
        try {
            funcs = JSON.parse(card.getAttribute('data-funcs'));
        } catch (e) {
            return;
        }
        if (!Array.isArray(funcs) || !funcs.length) return;

        funcs.forEach(function (item) { item.fn = compile(item.js); });

        var theme = THEMES[card.classList.contains('md-func-dark') ? 'dark' : 'light'];
        var svg = card.querySelector('.md-func-svg');
        if (!svg) return;

        // 卡片与扇形统计图一样撑满正文宽度；按实际渲染宽度绘制，保证 1x1 网格仍是正方形
        var measured = Math.round(svg.getBoundingClientRect().width);
        var WIDTH = measured > 0 ? measured : (card.clientWidth || 440);
        svg.setAttribute('viewBox', '0 0 ' + WIDTH + ' ' + HEIGHT);

        var state = { cx: 0, cy: 0, scale: 1, fitted: false };

        // 背景网格按数据坐标的每个整数画一条线，形成 1x1 小方格。
        // 仅在缩放到极小（每格不足 6px）时退化为 10 的整次幂，避免线太密拖慢渲染。
        function gridStep() {
            var step = 1;
            while (step * state.scale < 6 && step < 1e12) step *= 10;
            return step;
        }

        // 坐标标签间隔：网格步长的 1/2/5/10... 倍，保证标签之间至少 45px
        function labelStep(step) {
            var mults = [1, 2, 5];
            var base = step;
            for (var e = 0; e < 12; e++) {
                for (var i = 0; i < mults.length; i++) {
                    var candidate = base * mults[i];
                    if (candidate * state.scale >= 45) return candidate;
                }
                base *= 10;
            }
            return base;
        }

        function isMultiple(value, step) {
            var ratio = value / step;
            return Math.abs(ratio - Math.round(ratio)) < 1e-6;
        }

        function toScreenX(x) { return WIDTH / 2 + (x - state.cx) * state.scale; }
        function toScreenY(y) { return HEIGHT / 2 - (y - state.cy) * state.scale; }
        function toDataX(px) { return state.cx + (px - WIDTH / 2) / state.scale; }
        function toDataY(py) { return state.cy - (py - HEIGHT / 2) / state.scale; }

        function autoFit() {
            var xs = [];
            funcs.forEach(function (item) {
                if (item.vertical) {
                    xs.push(item.fn(0));
                    return;
                }
                for (var i = 0; i <= 200; i++) {
                    var x = -10 + i * 0.1;
                    if (isFinite(item.fn(x))) xs.push(x);
                }
            });
            var minX = xs.length ? Math.min.apply(null, xs) : -10;
            var maxX = xs.length ? Math.max.apply(null, xs) : 10;
            if (maxX - minX < 6) { minX -= 3; maxX += 3; }
            // 画布变宽时不无限放大，限制每格约 18px，保持 1x1 小方格的视觉密度
            state.scale = Math.min(WIDTH * 0.85 / (maxX - minX), HEIGHT / 12);
            // 视图默认以坐标原点 (0,0) 为中心，而不是跟随曲线包围盒
            state.cx = 0;
            state.cy = 0;
            state.fitted = true;
        }

        function drawGrid(group) {
            var step = gridStep();
            var labels = labelStep(step);
            var dataLeft = toDataX(0);
            var dataRight = toDataX(WIDTH);
            var dataBottom = toDataY(HEIGHT);
            var dataTop = toDataY(0);

            var startX = Math.ceil(dataLeft / step);
            for (var ix = startX; ix * step <= dataRight; ix++) {
                var gx = ix * step;
                var px = toScreenX(gx);
                var isAxis = ix === 0;
                group.appendChild(el('line', {
                    x1: px, y1: 0, x2: px, y2: HEIGHT,
                    stroke: isAxis ? theme.axis : theme.grid,
                    'stroke-width': isAxis ? 1.5 : 1
                }));
                if (isMultiple(gx, labels)) {
                    var tx = el('text', {
                        x: px + 3, y: HEIGHT - 6, fill: theme.text, 'font-size': 11
                    });
                    tx.textContent = formatTick(gx);
                    group.appendChild(tx);
                }
            }

            var startY = Math.ceil(dataBottom / step);
            for (var iy = startY; iy * step <= dataTop; iy++) {
                var gy = iy * step;
                var py = toScreenY(gy);
                var isAxisY = iy === 0;
                group.appendChild(el('line', {
                    x1: 0, y1: py, x2: WIDTH, y2: py,
                    stroke: isAxisY ? theme.axis : theme.grid,
                    'stroke-width': isAxisY ? 1.5 : 1
                }));
                if (isMultiple(gy, labels)) {
                    var ty = el('text', {
                        x: 6, y: py - 4, fill: theme.text, 'font-size': 11
                    });
                    ty.textContent = formatTick(gy);
                    group.appendChild(ty);
                }
            }
        }

        function drawCurves(group) {
            funcs.forEach(function (item) {
                if (item.vertical) {
                    var vx = toScreenX(item.fn(0));
                    group.appendChild(el('line', {
                        x1: vx, y1: 0, x2: vx, y2: HEIGHT,
                        stroke: item.color, 'stroke-width': 2, 'stroke-dasharray': '6 4'
                    }));
                    return;
                }
                var d = '';
                var drawing = false;
                for (var px = 0; px <= WIDTH; px += 2) {
                    var y = item.fn(toDataX(px));
                    if (isFinite(y)) {
                        var py = toScreenY(y);
                        d += (drawing ? ' L' : ' M') + px + ' ' + py.toFixed(2);
                        drawing = true;
                    } else {
                        drawing = false;
                    }
                }
                if (d) {
                    group.appendChild(el('path', {
                        d: d, fill: 'none', stroke: item.color,
                        'stroke-width': 2.2, 'stroke-linejoin': 'round'
                    }));
                }
            });
        }

        function redraw() {
            // 正文宽度变化（侧栏折叠、窗口缩放）时同步画布宽度，网格仍按像素等距
            var currentWidth = Math.round(svg.getBoundingClientRect().width);
            if (currentWidth > 0 && currentWidth !== WIDTH) {
                WIDTH = currentWidth;
                svg.setAttribute('viewBox', '0 0 ' + WIDTH + ' ' + HEIGHT);
            }
            while (svg.firstChild) svg.removeChild(svg.firstChild);
            svg.appendChild(el('rect', { x: 0, y: 0, width: WIDTH, height: HEIGHT, fill: theme.bg }));
            var grid = el('g');
            var curves = el('g');
            drawGrid(grid);
            drawCurves(curves);
            svg.appendChild(grid);
            svg.appendChild(curves);
        }

        if (!state.fitted) autoFit();
        redraw();

        // 拖动平移：显示手形光标，无磁力吸附
        var dragging = false;
        var startClientX = 0, startClientY = 0, startCx = 0, startCy = 0;

        function pointerPos(event) {
            var rect = svg.getBoundingClientRect();
            return {
                x: (event.clientX - rect.left) / rect.width * WIDTH,
                y: (event.clientY - rect.top) / rect.height * HEIGHT
            };
        }

        svg.addEventListener('pointerdown', function (event) {
            dragging = true;
            startClientX = event.clientX;
            startClientY = event.clientY;
            startCx = state.cx;
            startCy = state.cy;
            if (svg.setPointerCapture) svg.setPointerCapture(event.pointerId);
            event.preventDefault();
        });
        svg.addEventListener('pointermove', function (event) {
            if (!dragging) return;
            var rect = svg.getBoundingClientRect();
            state.cx = startCx - (event.clientX - startClientX) / rect.width * WIDTH / state.scale;
            state.cy = startCy + (event.clientY - startClientY) / rect.height * HEIGHT / state.scale;
            redraw();
        });
        function endDrag() { dragging = false; }
        svg.addEventListener('pointerup', endDrag);
        svg.addEventListener('pointercancel', endDrag);
        svg.addEventListener('pointerleave', endDrag);

        // 滚轮缩放：以鼠标位置为锚点
        svg.addEventListener('wheel', function (event) {
            event.preventDefault();
            var pos = pointerPos(event);
            var dataX = toDataX(pos.x);
            var dataY = toDataY(pos.y);
            var factor = Math.exp(-event.deltaY * 0.0015);
            var newScale = Math.min(1e8, Math.max(1e-6, state.scale * factor));
            state.scale = newScale;
            state.cx = dataX - (pos.x - WIDTH / 2) / state.scale;
            state.cy = dataY + (pos.y - HEIGHT / 2) / state.scale;
            redraw();
        }, { passive: false });

        // 展开/收起函数列表
        var toggle = card.querySelector('.md-func-toggle');
        var list = card.querySelector('.md-func-list');
        if (toggle && list) {
            toggle.addEventListener('click', function () {
                var willShow = list.hasAttribute('hidden');
                if (willShow) list.removeAttribute('hidden');
                else list.setAttribute('hidden', '');
                toggle.textContent = willShow ? '收起函数列表' : '展开函数列表';
            });
        }

        // 回到中心：把视图重新对准坐标原点 (0,0)，保留当前缩放级别
        var centerBtn = card.querySelector('.md-func-center');
        if (centerBtn) {
            centerBtn.addEventListener('click', function () {
                state.cx = 0;
                state.cy = 0;
                redraw();
            });
        }

        function copyText(text) {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(function () {
                    showSmallDialog('已复制', 'success');
                }).catch(function () {
                    fallbackCopy(text);
                });
            } else {
                fallbackCopy(text);
            }
        }
        function fallbackCopy(text) {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            var ok = false;
            try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
            document.body.removeChild(ta);
            showSmallDialog(ok ? '已复制' : '复制失败，可手动选择复制', ok ? 'success' : 'warning');
        }

        card.querySelectorAll('.md-func-copy').forEach(function (btn) {
            btn.addEventListener('click', function () { copyText(btn.getAttribute('data-expr')); });
        });
        var copyAll = card.querySelector('.md-func-copy-all');
        if (copyAll) {
            copyAll.addEventListener('click', function () { copyText(copyAll.getAttribute('data-all')); });
        }
    }

    function scan() {
        document.querySelectorAll('.md-func').forEach(createCard);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', scan);
    } else {
        scan();
    }

    // 文章内容与编辑器预览都是异步注入的，监听 DOM 变化以初始化新卡片
    if (window.MutationObserver) {
        var observer = new MutationObserver(function () { scan(); });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }
})();
