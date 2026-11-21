// 扇形统计图（%pc%）悬停联动：按 data-index 配对饼图块与图例
(function () {
    'use strict';

    function clearPie(pie) {
        pie.classList.remove('md-pie-hovering');
        pie.querySelectorAll('.md-pie-active').forEach(function (el) {
            el.classList.remove('md-pie-active');
        });
    }

    function activate(pie, index) {
        pie.classList.add('md-pie-hovering');
        pie.querySelectorAll('.md-pie-slice, .md-pie-legend-item').forEach(function (el) {
            if (el.getAttribute('data-index') === index) {
                el.classList.add('md-pie-active');
            } else {
                el.classList.remove('md-pie-active');
            }
        });
    }

    var BLOCK_SELECTOR = '.md-pie-slice, .md-pie-legend-item';

    function closestBlock(node) {
        return node && node.closest ? node.closest(BLOCK_SELECTOR) : null;
    }

    // 鼠标移入饼图块或图例项：高亮当前块与对应图例，其余变暗
    document.addEventListener('mouseover', function (event) {
        var target = closestBlock(event.target);
        if (!target) return;
        var pie = target.closest('.md-pie');
        if (!pie) return;
        activate(pie, target.getAttribute('data-index'));
    });

    // 只有在块之间直接切换时才保留高亮（交给 mouseover 切换）；
    // 移到容器空白处或离开整个饼图时立即恢复常态
    document.addEventListener('mouseout', function (event) {
        var target = closestBlock(event.target);
        if (!target) return;
        var pie = target.closest('.md-pie');
        if (!pie) return;
        var relatedBlock = closestBlock(event.relatedTarget);
        if (relatedBlock && relatedBlock.closest('.md-pie') === pie) {
            return;
        }
        clearPie(pie);
    });
})();
