/* ==========================================================================
   ch03-viz.js —— 第 03 讲《栈及其经典应用》交互动画
   包含 6 个演示（每个演示一个 IIFE，容器不存在时直接 return）：
     viz-stack-basic      顺序栈的入栈 / 出栈 / 取栈顶 / 判空 / 下溢
     viz-brackets         括号匹配逐字符扫描（1 个成功 + 3 种失败情形）
     viz-base-convert     十进制转二进制的短除法与栈的压入/弹出
     viz-infix-to-postfix 中缀转后缀（输入指针 + 运算符栈 + 输出序列）
     viz-postfix-eval     后缀表达式求值（操作数栈的变化）
     viz-monotonic-stack  单调栈求「下一个更大元素」
   依赖：course.js 提供的 DS.Viz 与 DS.SVG；颜色全部走 CSS 变量。
   ========================================================================== */
(function () {
  "use strict";

  var SVG = DS.SVG;

  /* 数值显示：整数就不带小数点，否则保留两位 */
  function fmt(v) {
    if (Math.abs(v - Math.round(v)) < 1e-9) return String(Math.round(v));
    return v.toFixed(2);
  }

  /* ==========================================================================
     演示 1：viz-stack-basic —— 顺序栈的入栈 / 出栈 / 取栈顶
     约定：top 指向「栈顶元素的下标」，top = -1 表示空栈
     ========================================================================== */
  (function stackBasic() {
    var host = document.getElementById('viz-stack-basic');
    if (!host) return;

    var CAP = 8;                    /* 数组容量 MaxSize */
    var arr = [];                   /* 栈内容，arr[0] 是栈底 */
    var top = -1;
    var frames = [];
    var no = 0;

    function tag(html) { no++; return '<b>第 ' + no + ' 步</b>　' + html; }

    /* 画一帧：数组 + top 指针 + 状态行 */
    function render(s, cells, tp, hi, banner) {
      var W = 720, H = 268, cw = 62, chh = 50, x0 = 62, y0 = 72;
      var svg = s.svg(W, H);
      SVG.defs(svg);

      /* 顶部横幅：本步在做什么 */
      svg.appendChild(s.text(x0, 28, banner, 'brand'));

      /* 数组单元 */
      for (var i = 0; i < CAP; i++) {
        var x = x0 + i * (cw + 6);
        var cls = (i < cells.length) ? '' : 'ghost';
        if (hi && hi.cell === i) cls = hi.cls || 'active';
        svg.appendChild(s.box(x, y0, cw, chh, cls, (i < cells.length) ? cells[i] : ''));
        svg.appendChild(s.label(x + cw / 2, y0 + chh + 15, i, 'middle'));
      }

      /* 栈底 / 栈顶标注 */
      svg.appendChild(s.text(x0 - 10, y0 + 30, '栈底', 'faint', 'end'));
      if (tp >= 0) {
        var cx = x0 + tp * (cw + 6) + cw / 2;
        svg.appendChild(s.path('M' + cx + ',' + (y0 + chh + 40) + ' L' + cx + ',' + (y0 + chh + 8), 'active', true));
        svg.appendChild(s.text(cx, y0 + chh + 56, 'top = ' + tp, 'brand', 'middle'));
        svg.appendChild(s.text(x0 + CAP * (cw + 6) + 4, y0 + chh - 16, '← 栈顶 S[top]', 'soft'));
      } else {
        svg.appendChild(s.path('M' + (x0 - 4) + ',' + (y0 + chh + 40) + ' L' + (x0 - 4) + ',' + (y0 + chh + 8), 'dim'));
        svg.appendChild(s.text(x0, y0 + chh + 56, 'top = -1：空栈，任何元素都不合法', 'bad'));
      }

      /* 底部状态行 */
      var len = cells.length;
      var st = 'top = ' + tp + '　长度 StackLength = ' + len +
               '　StackEmpty = ' + (len === 0 ? 'true' : 'false') +
               '　StackFull = ' + (len === CAP ? 'true' : 'false');
      svg.appendChild(s.text(x0, H - 16, st, 'soft'));
      return svg;
    }

    function snap(desc, hi, short) {
      var cells = arr.slice(), tp = top, h = hi || null, bn = short;
      frames.push({
        desc: desc,
        draw: function (s) { return render(s, cells, tp, h, bn); }
      });
    }

    /* ---------- 演示脚本：把每一步操作按顺序执行并抓帧 ---------- */
    snap(tag('InitStack(&amp;S)：令 <code>top = -1</code>，表示空栈。数组里可能还留着上一次的旧数据，但 top 之外的内容一律无效。'),
      null, 'InitStack(&S)：top = -1，空栈');

    var pushes = [12, 7, 25, 3];
    for (var p = 0; p < pushes.length; p++) {
      top++; arr[top] = pushes[p];
      snap(tag('Push(&amp;S, ' + pushes[p] + ')：先 <code>++top</code>（top 变成 ' + top + '），再写 <code>S[' + top + '] = ' + pushes[p] + '</code>。入栈只动一个下标，O(1)。'),
        { cell: top, cls: 'active' }, 'Push(&S, ' + pushes[p] + ')：++top 后写入 S[' + top + ']');
    }

    snap(tag('GetTop(S)：只读取 <code>S[' + top + '] = ' + arr[top] + '</code>，<b>不改变 top</b>。取栈顶与出栈的区别就在这一句。'),
      { cell: top, cls: 'compare' }, 'GetTop(S)：读到 ' + arr[top] + '，top 不变');

    var v1 = arr[top];
    snap(tag('Pop(&amp;S, &amp;e)：先把 <code>S[' + top + '] = ' + v1 + '</code> 交给 e，再 <code>--top</code>（top 变成 ' + (top - 1) + '）。注意顺序：先取值、后减下标。'),
      { cell: top, cls: 'warn' }, 'Pop(&S, &e)：取出 ' + v1 + '，top 减 1');
    top--;

    var v2 = arr[top];
    snap(tag('再 Pop 一次，弹出 ' + v2 + '；top 变成 ' + (top - 1) + '。刚才那个 ' + v1 + ' 还躺在 S[' + (top + 1) + '] 里，但它已经不属于这个栈了。'),
      { cell: top, cls: 'warn' }, 'Pop(&S, &e)：取出 ' + v2 + '，top 减 1');
    top--;

    var pushes2 = [9, 42];
    for (var q = 0; q < pushes2.length; q++) {
      top++; arr[top] = pushes2[q];
      snap(tag('Push(&amp;S, ' + pushes2[q] + ')：新元素直接盖掉刚才的「废数据」，top = ' + top + '。'),
        { cell: top, cls: 'active' }, 'Push(&S, ' + pushes2[q] + ')：top = ' + top);
    }

    snap(tag('StackEmpty(S)：<code>top = ' + top + ' ≥ 0</code>，返回 <b>false</b>（栈非空）。判空只看 top，不看数组内容。'),
      null, 'StackEmpty(S)：top ≥ 0 → false');

    var drained = 0;
    while (top >= 0) {
      var vv = arr[top];
      drained++;
      var isLast = (top === 0);
      snap(tag('Pop 第 ' + drained + ' 次，弹出 ' + vv + (isLast ? '；top 回到 <b>-1</b>，栈重新变空。' : '；top = ' + (top - 1) + '。')),
        { cell: top, cls: 'warn' }, 'Pop：弹出 ' + vv + (isLast ? '，栈空' : '，top = ' + (top - 1)));
      top--;
    }

    snap(tag('此时再调用 Pop(&amp;S, &amp;e)：栈已空（top = -1），<b>下溢 underflow</b>。工程代码必须在这里返回错误码或抛异常，绝不能默默返回垃圾值。'),
      null, 'Pop：栈空 → 下溢 underflow');

    new DS.Viz(host, {
      title: '顺序栈的基本操作',
      sub: 'top 指向栈顶元素下标 · 入栈出栈都是 O(1)',
      build: function () { return { frames: frames }; }
    });
  })();

  /* ==========================================================================
     演示 2：viz-brackets —— 括号匹配逐字符扫描
     ========================================================================== */
  (function brackets() {
    var host = document.getElementById('viz-brackets');
    if (!host) return;

    var CASES = [
      { s: '{[()]}', note: '完全匹配的正确串' },
      { s: '([)]',   note: '情形二：类型不匹配' },
      { s: '(()',    note: '情形三：左括号多余' },
      { s: '())',    note: '情形一：右括号多余' }
    ];
    var OPEN = '([{';
    var PAIR = { ')': '(', ']': '[', '}': '{' };
    var frames = [];

    function render(s, str, i, stack, status, sc) {
      var W = 720, H = 306, cw = 40, chh = 44, x0 = 40, y0 = 58;
      var svg = s.svg(W, H);
      SVG.defs(svg);

      svg.appendChild(s.text(x0, 26, '输入串（从左到右扫描）', 'faint'));
      for (var k = 0; k < str.length; k++) {
        var x = x0 + k * (cw + 6);
        var cls = '';
        if (k === i) cls = sc || 'compare';
        else if (i >= 0 && k < i) cls = 'dim';
        svg.appendChild(s.box(x, y0, cw, chh, cls, str[k]));
        svg.appendChild(s.label(x + cw / 2, y0 + chh + 14, k, 'middle'));
      }
      if (i >= 0 && i < str.length) {
        var px = x0 + i * (cw + 6) + cw / 2;
        svg.appendChild(s.el('polygon', {
          points: (px - 6) + ',' + (y0 - 8) + ' ' + (px + 6) + ',' + (y0 - 8) + ' ' + px + ',' + (y0 + 2),
          fill: 'var(--accent)'
        }));
        svg.appendChild(s.label(px, y0 - 12, 'i = ' + i, 'middle'));
      }

      svg.appendChild(s.text(x0, 176, '栈（左 = 栈底，右 = 栈顶）', 'faint'));
      var sw = 40, sy = 192;
      for (var q = 0; q < stack.length; q++) {
        var isTop = (q === stack.length - 1);
        svg.appendChild(s.box(x0 + q * (sw + 6), sy, sw, chh, isTop ? 'active' : 'ok', stack[q]));
      }
      if (!stack.length) {
        svg.appendChild(s.box(x0, sy, sw, chh, 'ghost'));
        svg.appendChild(s.text(x0 + sw + 12, sy + 28, '（空栈）', 'faint'));
      }

      svg.appendChild(s.text(x0, 282, status, sc === 'warn' ? 'bad' : (sc === 'ok' ? 'ok' : 'brand')));
      return svg;
    }

    function snap(str, i, stack, status, sc, desc) {
      var s2 = stack.slice(), st = status, c2 = sc;
      frames.push({
        desc: desc,
        draw: function (s) { return render(s, str, i, s2, st, c2); }
      });
    }

    for (var c = 0; c < CASES.length; c++) {
      var str = CASES[c].s, stack = [], failed = false;
      snap(str, -1, stack, '准备扫描', '', '<b>测试串 ' + (c + 1) + '：<code>' + str + '</code></b>（' + CASES[c].note +
        '）。规则：遇左括号入栈；遇右括号则与栈顶比较，能配成一对就弹出，否则失败。');

      for (var i = 0; i < str.length && !failed; i++) {
        var ch = str[i];
        if (OPEN.indexOf(ch) >= 0) {
          stack.push(ch);
          snap(str, i, stack, '入栈 ' + ch + '（栈深 ' + stack.length + '）', 'compare',
            '<b>第 ' + (i + 1) + ' 个字符 <code>' + ch + '</code></b>　是左括号 → 入栈。左括号的含义是「我还欠一个右括号」，先记账，等后面来还。');
        } else {
          if (stack.length === 0) {
            failed = true;
            snap(str, i, stack, '✗ 右括号多余：栈空却来了 ' + ch, 'warn',
              '<b>第 ' + (i + 1) + ' 个字符 <code>' + ch + '</code></b>　是右括号，但栈是空的 —— 说明<b>右括号多余</b>，匹配失败。');
          } else if (stack[stack.length - 1] !== PAIR[ch]) {
            failed = true;
            snap(str, i, stack, '✗ 类型不匹配：' + stack[stack.length - 1] + ' 与 ' + ch, 'warn',
              '<b>第 ' + (i + 1) + ' 个字符 <code>' + ch + '</code></b>　与栈顶 <code>' + stack[stack.length - 1] +
              '</code> 不是一对 —— <b>类型不匹配</b>，匹配失败。（即使左右括号总数相等，交叉嵌套也是错的。）');
          } else {
            stack.pop();
            snap(str, i, stack, '✓ ' + ch + ' 与栈顶配对，弹出', 'ok',
              '<b>第 ' + (i + 1) + ' 个字符 <code>' + ch + '</code></b>　与栈顶 <code>' + PAIR[ch] +
              '</code> 正好配对 → 弹出栈顶，欠账还清。');
          }
        }
      }

      if (!failed) {
        if (stack.length === 0) {
          snap(str, -1, stack, '✓ 扫描结束，栈空 → 匹配成功', 'ok',
            '<b>扫描结束</b>：栈恰好为空，说明每一笔欠账都还清了 → <b>串 <code>' + str + '</code> 括号匹配正确</b>。' +
            '整个算法只扫描一遍、每个字符进出栈各一次，时间 O(n)、额外空间 O(n)。');
        } else {
          snap(str, -1, stack, '✗ 左括号多余：栈中还剩 ' + stack.length + ' 个', 'warn',
            '<b>扫描结束</b>：栈里还剩 ' + stack.length + ' 个左括号没被配对 → <b>左括号多余</b>，匹配失败。' +
            '这也是为什么循环结束后必须再判一次栈空 —— 很多同学漏掉这一步。');
        }
      }
    }

    new DS.Viz(host, {
      title: '括号匹配（栈的经典应用）',
      sub: '一个正确串 + 三种典型失败情形',
      build: function () { return { frames: frames }; }
    });
  })();

  /* ==========================================================================
     演示 3：viz-base-convert —— 十进制转二进制的短除法与栈
     ========================================================================== */
  (function baseConvert() {
    var host = document.getElementById('viz-base-convert');
    if (!host) return;

    var N = 156, BASE = 2;
    var steps = [];
    for (var x = N; x > 0;) {
      var q = Math.floor(x / BASE), r = x % BASE;
      steps.push({ from: x, q: q, r: r });
      x = q;
    }
    var frames = [];
    var stack = [];      /* 余数栈 */
    var out = [];        /* 已弹出的数字：高位在前 */
    var no = 0;

    function tag(html) { no++; return '<b>第 ' + no + ' 步</b>　' + html; }

    function render(s, stepIdx, stackArr, outArr, banner) {
      var W = 760, H = 390;
      var svg = s.svg(W, H);

      /* 左侧：短除法竖式 */
      svg.appendChild(s.text(24, 22, '① 短除法：不断除以 ' + BASE + '，记下每次的余数', 'faint'));
      for (var k = 0; k < steps.length; k++) {
        var y = 38 + k * 30;
        var bc = (k === stepIdx) ? 'active' : (k < stepIdx ? 'done' : 'ghost');
        svg.appendChild(s.box(24, y, 320, 26, bc));
        svg.appendChild(s.text(38, y + 18,
          steps[k].from + ' ÷ ' + BASE + ' = ' + steps[k].q + '　余 ' + steps[k].r,
          (k === stepIdx) ? 'brand' : 'soft'));
      }
      svg.appendChild(s.text(24, 312, '③ 出栈顺序＝二进制的高位 → 低位', 'faint'));
      svg.appendChild(s.text(24, 340, outArr.length ? ('结果：( ' + N + ' )₁₀ = ( ' + outArr.join('') + ' )₂') : '结果：（还没出栈）',
        outArr.length ? 'ok' : 'faint'));
      svg.appendChild(s.text(24, 366, banner, 'brand'));

      /* 右侧：余数栈 */
      svg.appendChild(s.box(420, 56, 104, 300, 'dash'));
      svg.appendChild(s.text(420, 46, '② 余数依次入栈（栈顶在上）', 'faint'));
      for (var t = 0; t < stackArr.length; t++) {
        var cy = 348 - (t + 1) * 32;
        var tc = (t === stackArr.length - 1) ? 'active' : 'ok';
        svg.appendChild(s.box(428, cy, 88, 32, tc, stackArr[t]));
        if (t === stackArr.length - 1) svg.appendChild(s.text(540, cy + 21, '← 栈顶 top', 'brand'));
      }
      if (!stackArr.length) svg.appendChild(s.text(472, 220, '（空栈）', 'faint', 'middle'));
      svg.appendChild(s.text(472, 372, '栈底', 'faint', 'middle'));
      return svg;
    }

    function snap(desc, stepIdx, banner) {
      var st = stack.slice(), ot = out.slice(), si = stepIdx, bn = banner;
      frames.push({
        desc: desc,
        draw: function (s) { return render(s, si, st, ot, bn); }
      });
    }

    snap(tag('把十进制数 <code>' + N + '</code> 转成 ' + BASE + ' 进制。原理：<code>' + N + ' = (…((d_k×' + BASE +
      ' + d_{k-1})×' + BASE + ' + …)×' + BASE + ' + d_0</code>，所以<b>不断除以 ' + BASE +
      '，先得到的余数是低位、后得到的是高位</b> —— 正好用栈把顺序倒过来。'),
      -1, '开始：N = ' + N + '，余数栈为空');

    for (var k2 = 0; k2 < steps.length; k2++) {
      var stp = steps[k2];
      stack.push(stp.r);
      snap(tag('第 ' + (k2 + 1) + ' 次除法：<code>' + stp.from + ' ÷ ' + BASE + ' = ' + stp.q + '</code>，余 <b>' + stp.r +
        '</b> → 把余数 ' + stp.r + ' 压栈。' + (k2 === 0 ? '这是<b>最低位</b>，所以它会被压在最底下、最后才出来。' : '')),
        k2, 'Push(' + stp.r + ')：' + stp.from + ' ÷ ' + BASE + ' = ' + stp.q + ' 余 ' + stp.r);
    }

    snap(tag('商已经变成 <b>0</b>，除法结束。此时栈顶是<b>最后一次</b>算出的余数，也就是二进制数的<b>最高位</b>。接下来只要不停出栈，就能按高位→低位的顺序拿到每一位。'),
      steps.length - 1, '除法结束：栈顶就是最高位');

    var n2 = 0;
    while (stack.length) {
      var d = stack.pop();
      out.push(d);
      n2++;
      snap(tag('第 ' + n2 + ' 次出栈：弹出 <b>' + d + '</b>，接到结果的末尾 → 目前得到 <code>' + out.join('') + '</code>。'),
        steps.length - 1, 'Pop() → ' + d + '　当前结果 ' + out.join(''));
    }

    snap(tag('<b>转换完成</b>：( ' + N + ' )₁₀ = ( ' + out.join('') + ' )₂ 。验算：' +
      out.join('').split('').map(function (c, idx, a) { return c === '1' ? Math.pow(2, a.length - 1 - idx) : 0; })
        .filter(function (v) { return v > 0; }).join(' + ') + ' = ' + N + '。'),
      -1, '结果：( ' + N + ' )₁₀ = ( ' + out.join('') + ' )₂');

    new DS.Viz(host, {
      title: '进制转换：十进制 → 二进制',
      sub: '短除法算余数 · 栈把余数倒过来',
      build: function () { return { frames: frames }; }
    });
  })();

  /* ==========================================================================
     演示 4：viz-infix-to-postfix —— 中缀表达式转后缀（逆波兰式）
     ========================================================================== */
  (function infixToPostfix() {
    var host = document.getElementById('viz-infix-to-postfix');
    if (!host) return;

    var TOKENS = ['3', '+', '4', '*', '2', '-', '(', '1', '+', '5', ')', '^', '2', '/', '3'];
    var ISP = { '+': 3, '-': 3, '*': 5, '/': 5, '^': 6, '(': 1 };   /* 栈内优先级 */
    var ICP = { '+': 2, '-': 2, '*': 4, '/': 4, '^': 7, '(': 6 };   /* 栈外优先级 */
    var frames = [];
    var stack = [], out = [];
    var no = 0;

    function tag(html) { no++; return '<b>第 ' + no + ' 步</b>　' + html; }
    function isNum(t) { return /^[0-9]+(\.[0-9]+)?$/.test(t); }

    function render(s, i, stackArr, outArr, n1, n2) {
      var W = 780, H = 360, tw = 44, th = 36, x0 = 24;
      var svg = s.svg(W, H);
      SVG.defs(svg);

      svg.appendChild(s.text(x0, 16, '中缀输入（从左到右扫描）', 'faint'));
      for (var k = 0; k < TOKENS.length; k++) {
        var x = x0 + k * 48;
        var cls = '';
        if (k === i) cls = 'compare';
        else if (i >= 0 && k < i) cls = 'dim';
        svg.appendChild(s.box(x, 26, tw, th, cls, TOKENS[k]));
        svg.appendChild(s.label(x + tw / 2, 74, k, 'middle'));
      }
      if (i >= 0 && i < TOKENS.length) {
        var px = x0 + i * 48 + tw / 2;
        svg.appendChild(s.el('polygon', {
          points: (px - 6) + ',20 ' + (px + 6) + ',20 ' + px + ',34',
          fill: 'var(--accent)'
        }));
      }

      svg.appendChild(s.text(x0, 108, n1 || '', 'brand'));
      svg.appendChild(s.text(x0, 132, n2 || '', 'soft'));

      svg.appendChild(s.text(110, 156, '输出序列（后缀表达式，左边先输出）', 'faint'));
      var ow = 40, oh = 32, ox = 110;
      for (var q = 0; q < outArr.length; q++) {
        svg.appendChild(s.box(ox + q * 44, 164, ow, oh, 'done', outArr[q]));
      }
      if (!outArr.length) svg.appendChild(s.box(ox, 164, ow, oh, 'ghost'));

      svg.appendChild(s.text(24, 196, '运算符栈', 'faint'));
      for (var t = 0; t < stackArr.length; t++) {
        var cy = 330 - (t + 1) * 32;
        svg.appendChild(s.box(24, cy, 64, 30, (t === stackArr.length - 1) ? 'active' : '', stackArr[t]));
      }
      if (!stackArr.length) svg.appendChild(s.box(24, 298, 64, 30, 'ghost'));
      svg.appendChild(s.text(24, 348, '栈底在下 ↑ 栈顶在上', 'faint'));
      return svg;
    }

    function snap(i, n1, n2, desc) {
      var st = stack.slice(), ot = out.slice(), ii = i, a = n1 || '', b = n2 || '';
      frames.push({ desc: desc, draw: function (s) { return render(s, ii, st, ot, a, b); } });
    }

    snap(-1, '准备：从左到右读入中缀表达式', '规则：操作数直接输出；运算符与栈顶比优先级；左括号入栈；右括号弹到左括号为止',
      tag('开始扫描 <code>3+4*2-(1+5)^2/3</code>。一句话记住规则：<b>操作数直接输出；运算符先和栈顶比优先级，该弹的弹完再入栈；左括号直接入栈；右括号把栈里到左括号为止的运算符全部弹出输出</b>。'));

    for (var i = 0; i < TOKENS.length; i++) {
      var t = TOKENS[i];

      if (isNum(t)) {
        out.push(t);
        snap(i, '读入操作数 ' + t + '：操作数不参与优先级比较，直接追加到输出序列', '输出：' + out.join(' '),
          tag('读入 <code>' + t + '</code>（操作数）→ <b>直接输出</b>。后缀表达式里操作数的相对顺序和中缀完全一致。'));
        continue;
      }

      if (t === '(') {
        stack.push(t);
        snap(i, '遇到左括号 ( ：直接入栈。它的栈内优先级最低，任何运算符都可以压在它上面', '入栈：(　栈深 ' + stack.length,
          tag('遇到 <code>(</code> → <b>直接入栈</b>。左括号像一个「隔离板」：在它被配对之前，栈里更下面的运算符一个都不会被弹出来。'));
        continue;
      }

      if (t === ')') {
        var popped = [];
        while (stack.length && stack[stack.length - 1] !== '(') {
          var o1 = stack.pop(); popped.push(o1); out.push(o1);
        }
        if (stack.length) stack.pop();     /* 丢弃左括号 */
        snap(i, '遇到右括号 ) ：不停弹出栈顶运算符并输出，直到遇见左括号；左括号出栈丢弃（不输出）',
          '本次弹出：' + (popped.length ? popped.join(' ') : '（没有运算符）'),
          tag('遇到 <code>)</code> → 弹出并输出 <code>' + (popped.length ? popped.join(' ') : '（空）') +
            '</code>，然后把左括号 <code>(</code> 弹出<b>丢弃</b>。括号在后缀表达式里彻底消失。'));
        continue;
      }

      /* 普通运算符 */
      var top0 = stack.length ? stack[stack.length - 1] : null;
      var noteA;
      if (!top0) noteA = '运算符栈为空 → ' + t + ' 直接入栈';
      else noteA = '比较：栈顶 ' + top0 + ' 的 isp = ' + ISP[top0] + '，' + t + ' 的 icp = ' + ICP[t] +
                   ' → ' + (ISP[top0] >= ICP[t] ? 'isp ≥ icp，弹出栈顶' : 'isp < icp，不弹，直接入栈');
      if (t === '^') noteA += '（^ 右结合：icp > isp，栈顶同为 ^ 时也不弹）';

      var cm = [];
      while (stack.length && ISP[stack[stack.length - 1]] >= ICP[t]) {
        var o2 = stack.pop(); cm.push(o2); out.push(o2);
      }
      stack.push(t);
      snap(i, noteA, '弹出：' + (cm.length ? cm.join(' ') : '无') + '　然后 ' + t + ' 入栈',
        tag('读入运算符 <code>' + t + '</code>：' + (cm.length
          ? '栈顶优先级不低于它，先把 <code>' + cm.join(' ') + '</code> 弹出输出，'
          : '栈顶优先级比它低（或栈空），') + '再把 <code>' + t + '</code> 压栈。'));
    }

    while (stack.length) {
      var o3 = stack.pop(); out.push(o3);
      snap(-1, '输入已扫描完，把运算符栈里剩下的运算符依次弹出', '本次弹出：' + o3,
        tag('扫描结束 → 弹出栈中剩余的运算符 <code>' + o3 + '</code>。这一步最容易被漏掉：<b>栈不空就不算结束</b>。'));
    }

    snap(-1, '后缀表达式：' + out.join(' '), '一个括号都不剩，运算顺序完全由位置决定',
      tag('<b>转换完成</b>：中缀 <code>3+4*2-(1+5)^2/3</code>  →  后缀 <code>' + out.join(' ') +
        '</code>。请对照观察：<b>后缀里没有任何括号</b>，也不需要优先级表，扫描一遍就完了。'));

    new DS.Viz(host, {
      title: '中缀表达式 → 后缀表达式',
      sub: '输入指针 + 运算符栈 + 输出序列 三者同步演示',
      build: function () { return { frames: frames }; }
    });
  })();

  /* ==========================================================================
     演示 5：viz-postfix-eval —— 后缀表达式求值
     ========================================================================== */
  (function postfixEval() {
    var host = document.getElementById('viz-postfix-eval');
    if (!host) return;

    var TOKENS = ['3', '4', '2', '*', '+', '1', '5', '+', '2', '^', '3', '/', '-'];
    var frames = [];
    var st = [];      /* 操作数栈 */
    var log = [];     /* 运算日志 */
    var no = 0;

    function tag(html) { no++; return '<b>第 ' + no + ' 步</b>　' + html; }
    function isNum(t) { return /^[0-9]+(\.[0-9]+)?$/.test(t); }

    function render(s, i, stackArr, logArr, cur, curCls, note) {
      var W = 780, H = 380, tw = 44, th = 36, x0 = 24;
      var svg = s.svg(W, H);
      SVG.defs(svg);

      svg.appendChild(s.text(x0, 16, '后缀输入（从左到右扫描一次即可）', 'faint'));
      for (var k = 0; k < TOKENS.length; k++) {
        var x = x0 + k * 48;
        var cls = '';
        if (k === i) cls = 'compare';
        else if (i >= 0 && k < i) cls = 'dim';
        svg.appendChild(s.box(x, 26, tw, th, cls, TOKENS[k]));
        svg.appendChild(s.label(x + tw / 2, 74, k, 'middle'));
      }
      if (i >= 0 && i < TOKENS.length) {
        var px = x0 + i * 48 + tw / 2;
        svg.appendChild(s.el('polygon', {
          points: (px - 6) + ',20 ' + (px + 6) + ',20 ' + px + ',34',
          fill: 'var(--accent)'
        }));
      }

      /* 操作数栈（栈底在下） */
      svg.appendChild(s.text(24, 182, '操作数栈', 'faint'));
      for (var t = 0; t < stackArr.length; t++) {
        var cy = 330 - (t + 1) * 34;
        svg.appendChild(s.box(24, cy, 78, 32, (t === stackArr.length - 1) ? 'active' : 'ok', fmt(stackArr[t])));
      }
      if (!stackArr.length) svg.appendChild(s.box(24, 298, 78, 32, 'ghost'));

      /* 右侧运算说明与日志 */
      svg.appendChild(s.text(150, 116, cur, curCls || 'brand'));
      for (var q = 0; q < logArr.length; q++) {
        svg.appendChild(s.text(150, 150 + q * 28, logArr[q], 'soft'));
      }
      if (note) svg.appendChild(s.text(150, 356, note, 'faint'));
      return svg;
    }

    function snap(i, cur, curCls, note, desc) {
      var sa = st.slice(), la = log.slice(-6), ii = i, c = cur, cc = curCls, nt = note;
      frames.push({ desc: desc, draw: function (s) { return render(s, ii, sa, la, c, cc, nt); } });
    }

    snap(-1, '准备：操作数栈为空', 'soft', '规则：遇操作数就压栈；遇运算符就弹出两个操作数，算完把结果压回去',
      tag('开始扫描后缀表达式 <code>3 4 2 * + 1 5 + 2 ^ 3 / -</code>。<b>不需要括号、不需要优先级</b>：只要一个操作数栈，从左到右扫一遍即可。'));

    for (var i = 0; i < TOKENS.length; i++) {
      var t = TOKENS[i];
      if (isNum(t)) {
        st.push(parseFloat(t));
        snap(i, '读入操作数 ' + t + ' → 压栈', 'brand', '当前栈深：' + st.length,
          tag('读入操作数 <code>' + t + '</code> → <b>压入操作数栈</b>。操作数永远是被动的：先存起来，等运算符来取。'));
        continue;
      }
      var b = st.pop(), a = st.pop(), v;
      if (t === '+') v = a + b;
      else if (t === '-') v = a - b;
      else if (t === '*') v = a * b;
      else if (t === '/') v = a / b;
      else v = Math.pow(a, b);
      st.push(v);
      log.push(fmt(a) + ' ' + t + ' ' + fmt(b) + ' = ' + fmt(v));
      snap(i, '计算 ' + fmt(a) + ' ' + t + ' ' + fmt(b) + ' = ' + fmt(v) + ' → 结果压栈', 'ok',
        '栈深：' + st.length + '　（先弹出的是右操作数 ' + fmt(b) + '，后弹出的是左操作数 ' + fmt(a) + '）',
        tag('读入运算符 <code>' + t + '</code> → 弹出两个操作数：<b>先弹出的是右操作数 ' + fmt(b) + '，后弹出的是左操作数 ' +
          fmt(a) + '</b>（顺序千万别弄反），计算 <code>' + fmt(a) + ' ' + t + ' ' + fmt(b) + ' = ' + fmt(v) +
          '</code>，再把 ' + fmt(v) + ' 压回栈中。'));
    }

    var res = st.length ? st[st.length - 1] : NaN;
    snap(-1, '栈中只剩一个数：' + fmt(res) + '　→ 这就是整个表达式的值', 'ok', '验算：3+4*2=11，(1+5)^2/3=12，11-12=-1',
      tag('<b>求值完成</b>：扫描结束时栈里恰好剩下一个数 <code>' + fmt(res) +
        '</code>，它就是表达式的值。用中缀验算：3+4×2 = 11，(1+5)² ÷ 3 = 12，11 − 12 = <b>−1</b>，一致 ✓'));

    new DS.Viz(host, {
      title: '后缀表达式求值',
      sub: '一个操作数栈 + 一次线性扫描',
      build: function () { return { frames: frames }; }
    });
  })();

  /* ==========================================================================
     演示 6：viz-monotonic-stack —— 单调栈求「下一个更大元素」
     ========================================================================== */
  (function monotonicStack() {
    var host = document.getElementById('viz-monotonic-stack');
    if (!host) return;

    var A = [2, 1, 5, 6, 2, 3, 1];
    var n = A.length;
    var ans = [];
    for (var z = 0; z < n; z++) ans.push(null);
    var frames = [];
    var stk = [];       /* 下标栈，栈内下标对应的值单调不增 */
    var no = 0;

    function tag(html) { no++; return '<b>第 ' + no + ' 步</b>　' + html; }

    function render(s, i, stkArr, ansArr, note, hi) {
      var W = 780, H = 384, cw = 64, x0 = 40, gap = 70;
      var svg = s.svg(W, H);
      SVG.defs(svg);
      hi = hi || {};

      /* 数组 A */
      svg.appendChild(s.text(x0, 20, '① 数组 A：从左到右扫描', 'faint'));
      for (var k = 0; k < n; k++) {
        var x = x0 + k * gap;
        var cls = (k === i) ? 'compare' : '';
        svg.appendChild(s.box(x, 30, cw, 46, cls, A[k]));
        svg.appendChild(s.label(x + cw / 2, 92, '[' + k + ']', 'middle'));
      }
      if (i >= 0) {
        var px = x0 + i * gap + cw / 2;
        svg.appendChild(s.el('polygon', {
          points: (px - 6) + ',98 ' + (px + 6) + ',98 ' + px + ',110',
          fill: 'var(--accent)'
        }));
      }
      svg.appendChild(s.text(x0 + 300, 112, note, 'brand'));

      /* 答案 ans */
      svg.appendChild(s.text(x0, 148, '② 答案 ans[k]：右边第一个比 A[k] 大的元素（−1 表示不存在）', 'faint'));
      for (var q = 0; q < n; q++) {
        var ax = x0 + q * gap;
        var v = ansArr[q];
        var ac = (v === null) ? 'ghost' : (v < 0 ? 'ghost' : 'done');
        if (hi.ansCell === q) ac = 'active';
        svg.appendChild(s.box(ax, 158, cw, 44, ac, v === null ? '·' : v));
      }

      /* 单调栈 */
      svg.appendChild(s.text(x0, 240, '③ 单调栈（存下标；从栈底到栈顶，元素值单调不增）', 'faint'));
      for (var t = 0; t < stkArr.length; t++) {
        var sx = x0 + t * gap;
        var isTop = (t === stkArr.length - 1);
        svg.appendChild(s.box(sx, 250, cw, 46, isTop ? 'active' : 'ok', stkArr[t]));
        svg.appendChild(s.label(sx + cw / 2, 312, 'A=' + A[stkArr[t]], 'middle'));
      }
      if (!stkArr.length) {
        svg.appendChild(s.box(x0, 250, cw, 46, 'ghost'));
        svg.appendChild(s.text(x0 + cw + 14, 280, '（空栈）', 'faint'));
      }
      svg.appendChild(s.text(x0, 352, '每个下标最多进栈一次、出栈一次 → 总操作数 ≤ 2n，时间 O(n)', 'soft'));
      return svg;
    }

    function snap(i, note, hi, desc) {
      var sa = stk.slice(), aa = ans.slice(), ii = i, nt = note, h = hi || null;
      frames.push({ desc: desc, draw: function (s) { return render(s, ii, sa, aa, nt, h); } });
    }

    snap(-1, '初始：栈空，ans 全部待定', null,
      tag('问题：对每个 k，求它右边<b>第一个</b>比 A[k] 大的元素。暴力做法对每个 k 都往右扫一遍，最坏 O(n²)；单调栈只需要 <b>O(n)</b>。<b>核心思想：A[i] 一旦出现，它就能「结算」掉栈里所有比它小的元素</b>。'));

    for (var i = 0; i < n; i++) {
      snap(i, 'i = ' + i + '：A[' + i + '] = ' + A[i] + '，准备结算栈里比它小的元素', null,
        tag('考察 <code>i = ' + i + '</code>，A[' + i + '] = <b>' + A[i] +
          '</b>。while 循环：只要栈不空且 <code>A[栈顶] &lt; A[i]</code>，就说明栈顶那个位置「找到了」下一个更大元素。'));

      var poppedAny = false;
      while (stk.length && A[stk[stk.length - 1]] < A[i]) {
        var j = stk.pop();
        ans[j] = A[i];
        poppedAny = true;
        snap(i, '弹出下标 ' + j + '（A[' + j + '] = ' + A[j] + ' < ' + A[i] + '）→ ans[' + j + '] = ' + A[i],
          { ansCell: j },
          tag('栈顶下标 <code>' + j + '</code> 对应的值 A[' + j + '] = ' + A[j] + ' 比 A[' + i + '] = ' + A[i] +
            ' 小 → <b>弹出</b>并记录 <code>ans[' + j + '] = ' + A[i] + '</code>。这个下标以后再也用不到了，所以每个下标只会被弹出一次。'));
      }
      if (!poppedAny) {
        snap(i, '栈顶元素比 A[' + i + '] 大（或栈空）→ 不需要弹出', null,
          tag('A[' + i + '] = ' + A[i] + ' 不比栈顶元素大，while 循环一次都不执行 → 直接进入下一步。'));
      }

      stk.push(i);
      snap(i, '把下标 ' + i + ' 压栈：等待右边出现更大的元素来「认领」它', { ansCell: -1 },
        tag('把下标 <code>' + i + '</code> 压栈。此时栈内下标对应的值从栈底到栈顶<b>单调不增</b> —— 这就是「单调栈」名字的由来。'));
    }

    for (var m = 0; m < n; m++) if (ans[m] === null) ans[m] = -1;
    snap(-1, '扫描结束：栈中剩余下标的右边都没有更大元素 → ans = −1',
      { ansCell: -1 },
      tag('<b>算法结束</b>：栈里剩下的下标（' + stk.join('、') + '）右边都不存在更大的元素，它们的答案就是 <b>−1</b>。' +
        '最终 ans = [' + ans.join(', ') + ']。每个下标进栈一次、出栈至多一次，所以<b>总时间是 O(n)</b>，额外空间 O(n)。'));

    new DS.Viz(host, {
      title: '单调栈：下一个更大元素',
      sub: '把 O(n²) 的暴力扫描压成 O(n) 的一次扫描',
      build: function () { return { frames: frames }; }
    });
  })();

})();
