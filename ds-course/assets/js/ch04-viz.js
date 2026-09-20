/* ==========================================================================
   ch04-viz.js —— 第 04 讲《队列及其应用》交互动画
   包含 6 个演示（每个演示一个 IIFE，容器不存在时自动跳过）：
     1. viz-queue-basic      普通顺序队列的假溢出
     2. viz-circular         循环队列入队出队（环形布局 + 判满判空）
     3. viz-bank             银行排队模拟（离散事件）
     4. viz-deque            双端队列两端操作
     5. viz-sliding-window   单调队列求滑动窗口最大值
     6. viz-maze-bfs         BFS 逐层扩展求迷宫最短路径
   ========================================================================== */
(function () {
  "use strict";

  var SVG = DS.SVG;

  /* 共用小工具：把数字数组转成 "1 2 3" 这样的字符串 */
  function join(arr, sep) {
    return arr.join(sep === undefined ? " " : sep);
  }
  /* 共用：确定性伪随机（线性同余），保证每次打开页面结果一致 */
  function makeRnd(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  function randInt(rnd, a, b) {
    return a + Math.floor(rnd() * (b - a + 1));
  }

  /* ======================================================================
     演示 1：普通顺序队列的假溢出
     ====================================================================== */
  (function queueBasic() {
    var host = document.getElementById('viz-queue-basic');
    if (!host) return;

    var MAX = 8;
    var frames = [];
    var data = new Array(MAX);      // undefined 表示空位
    var front = 0, rear = 0;
    var note = "";

    function snap(desc, marks, noteText) {
      if (noteText !== undefined) note = noteText;
      var state = {
        data: data.slice(),
        front: front,
        rear: rear,
        marks: marks || {},
        note: note
      };
      frames.push({
        desc: desc,
        draw: function (s) { return draw(s, state); }
      });
    }

    function draw(s, st) {
      var W = 660, H = 232;
      var svg = s.svg(W, H);
      s.defs(svg);
      var cw = 66, ch = 52, pitch = 72, x0 = 30, y0 = 62;

      // 标题
      svg.appendChild(s.text(30, 32, "数组 data[0..7]（MaxSize = 8）", "lg", "start"));

      for (var i = 0; i < MAX; i++) {
        var x = x0 + i * pitch;
        var v = st.data[i];
        var cls = v === undefined ? "ghost" : "done";
        if (st.marks[i]) cls = st.marks[i];
        svg.appendChild(s.box(x, y0, cw, ch, cls, v === undefined ? "空" : v));
        svg.appendChild(s.label(x + cw / 2, y0 + ch + 18, "[" + i + "]", "middle"));
      }

      // rear 指针（画在格子下方）
      var rearX = x0 + st.rear * pitch + cw / 2;
      if (st.rear < MAX) {
        svg.appendChild(s.text(rearX, y0 + ch + 40, "↑ rear=" + st.rear, "sm ok", "middle"));
      } else {
        svg.appendChild(s.text(x0 + MAX * pitch - 8, y0 + ch + 40,
          "↑ rear=" + st.rear + " 已越界", "sm bad", "middle"));
      }

      // front 指针（画在格子上方）
      var frontX = x0 + st.front * pitch + cw / 2;
      svg.appendChild(s.text(frontX, y0 - 12, "↓ front=" + st.front, "sm brand", "middle"));

      // 状态行
      var size = st.rear - st.front;
      var full = st.rear === MAX;
      svg.appendChild(s.text(30, H - 52,
        "front=" + st.front + "　rear=" + st.rear + "　元素个数=" + size +
        "　判满条件 rear==MaxSize → " + (full ? "报告「队满」" : "未满"),
        "sm " + (full ? "bad" : ""), "start"));
      svg.appendChild(s.text(30, H - 26, st.note, "sm", "start"));
      return svg;
    }

    snap("初始状态：空队列 <code>front = rear = 0</code>，8 个格子全部可用。", {},
      "此时没有任何浪费，一切正常。");

    var pushes = ["A", "B", "C", "D"];
    for (var i = 0; i < pushes.length; i++) {
      data[rear] = pushes[i];
      rear++;
      var m = {}; m[rear - 1] = "active";
      snap("入队 <b>" + pushes[i] + "</b>：<code>data[" + (rear - 1) + "] = " + pushes[i] +
        "; rear++</code>。当前 front=" + front + "，rear=" + rear + "，元素个数 " + (rear - front) + "。",
        m, "入队只动 rear，出队只动 front —— 两个下标都只会往右走。");
    }

    for (var k = 0; k < 2; k++) {
      var out = data[front];
      data[front] = undefined;
      var m2 = {}; m2[front] = "dim";
      front++;
      snap("出队 <b>" + out + "</b>：<code>front++</code>。注意 <code>data[" + (front - 1) +
        "]</code> 变成了空位，但它<b>再也不会被用到</b>了。",
        m2, "每出队一次，数组前面就多一块「死区」。");
    }

    var pushes2 = ["E", "F", "G", "H"];
    for (var j = 0; j < pushes2.length; j++) {
      data[rear] = pushes2[j];
      rear++;
      var m3 = {}; m3[rear - 1] = "active";
      var isLast = (rear === MAX);
      snap("入队 <b>" + pushes2[j] + "</b>：<code>data[" + (rear - 1) + "] = " + pushes2[j] +
        "; rear++</code>。" + (isLast ? "此时 <code>rear == 8 == MaxSize</code>，队列被判定为<b>满</b>。" : ""),
        m3, isLast ? "可是下标 0 和 1 明明是空的！" : "rear 继续单调右移，前面的空位一直闲置。");
    }

    var markWaste = {}; markWaste[0] = "warn"; markWaste[1] = "warn";
    snap("假溢出：队列报「队满」，但 <code>data[0]</code>、<code>data[1]</code> 两个格子<b>从来没被复用</b>。" +
      "真实元素个数只有 6 个，容量却是 8 —— 这就是<b>假溢出 false overflow</b>。",
      markWaste, "根因：front 与 rear 单调递增，数组是线性的，而队列需要循环使用空间。");

    snap("结论：只改判满条件（<code>rear - front == MaxSize</code>）不但没用，还会让 <code>data[8]</code> 越界写内存。" +
      "正确解法是让下标<b>绕回来</b> —— 循环队列。",
      markWaste, "下一节的循环队列把「越界」变成「回到 0」，假溢出自然消失。");

    new DS.Viz(host, {
      title: "顺序队列的假溢出",
      sub: "front / rear 单调后移 ⇒ 前面空着却说队满",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ======================================================================
     演示 2：循环队列（环形布局）
     ====================================================================== */
  (function circular() {
    var host = document.getElementById('viz-circular');
    if (!host) return;

    var MAX = 8;
    var CX = 350, CY = 240, R = 112;
    var frames = [];
    var data = new Array(MAX);
    var front = 0, rear = 0, size = 0;
    var flash = -1;

    function pos(i, radius) {
      var a = (-90 + i * 360 / MAX) * Math.PI / 180;
      return { x: CX + radius * Math.cos(a), y: CY + radius * Math.sin(a) };
    }

    function snap(desc, flashIdx) {
      flash = (flashIdx === undefined ? -1 : flashIdx);
      var st = {
        data: data.slice(), front: front, rear: rear, size: size, flash: flash
      };
      frames.push({ desc: desc, draw: function (s) { return draw(s, st); } });
    }

    function draw(s, st) {
      var svg = s.svg(700, 470);
      s.defs(svg);

      // 环
      svg.appendChild(s.el("circle", {
        cx: CX, cy: CY, r: R, fill: "none", stroke: "var(--border)", "stroke-width": 22
      }));

      for (var i = 0; i < MAX; i++) {
        var p = pos(i, R);
        var v = st.data[i];
        var cls = v === undefined ? "" : "active";
        if (i === st.flash) cls = "compare";
        svg.appendChild(s.circle(p.x, p.y, 25, cls, v === undefined ? "·" : v,
          v === undefined ? "dim" : "on"));
        var lp = pos(i, R + 31);
        svg.appendChild(s.label(lp.x, lp.y + 4, "data[" + i + "]", "middle"));
      }

      // front 指针（环外，指向环内）
      var fp = pos(st.front, R + 62), fpIn = pos(st.front, R + 34);
      svg.appendChild(s.line(fp.x, fp.y, fpIn.x, fpIn.y, "active", true));
      var fpTxt = pos(st.front, R + 74);
      svg.appendChild(s.text(fpTxt.x, fpTxt.y + 4, "front=" + st.front, "sm brand", "middle"));

      // rear 指针（环内，指向环外）
      var rp = pos(st.rear, R - 62), rpOut = pos(st.rear, R - 34);
      svg.appendChild(s.line(rp.x, rp.y, rpOut.x, rpOut.y, "done", true));
      var rpTxt = pos(st.rear, R - 78);
      svg.appendChild(s.text(rpTxt.x, rpTxt.y + 4, "rear=" + st.rear, "sm ok", "middle"));

      // 左上角状态面板
      var isFull = (st.rear + 1) % MAX === st.front;
      var isEmpty = (st.front === st.rear);
      var stTxt = isEmpty ? "空" : (isFull ? "满" : "正常");
      var panel = [
        ["front = ", st.front, "brand"],
        ["rear  = ", st.rear, "ok"],
        ["size  = ", st.size, ""],
        ["状态  = ", stTxt, isEmpty || isFull ? "bad" : ""]
      ];
      for (var k = 0; k < panel.length; k++) {
        svg.appendChild(s.text(16, 34 + k * 24, panel[k][0] + panel[k][1], "sm " + panel[k][2], "start"));
      }
      svg.appendChild(s.text(16, 150, "判空：front == rear", "sm", "start"));
      svg.appendChild(s.text(16, 172, "判满：(rear+1)%8 == front", "sm", "start"));
      svg.appendChild(s.text(16, 194, "个数：(rear-front+8)%8", "sm", "start"));

      // 底部提示
      var tip = "入队：data[rear] = x; rear = (rear+1)%8　　出队：x = data[front]; front = (front+1)%8";
      svg.appendChild(s.text(350, 448, tip, "sm", "middle"));
      return svg;
    }

    /* ---- 脚本化操作序列 ---- */
    snap("初始状态：<code>front = rear = 0</code>，8 个格子全空，<code>size = 0</code>。", -1);

    function push(v, why) {
      if ((rear + 1) % MAX === front) {
        snap("尝试入队 <b>" + v + "</b>：判满条件 <code>(rear+1)%8 == front</code> 即 <code>" +
          ((rear + 1) % MAX) + " == " + front + "</code> 成立 → <b>队满，入队失败</b>（牺牲了一个存储单元）。", -1);
        return false;
      }
      data[rear] = v;
      var at = rear;
      rear = (rear + 1) % MAX;
      size++;
      snap("入队 <b>" + v + "</b>：<code>data[" + at + "] = " + v + "</code>，" +
        "<code>rear = (" + at + "+1)%8 = " + rear + "</code>。" + (why || "") +
        " 当前 size = " + size + "。", at);
      return true;
    }
    function pop(why) {
      if (front === rear) {
        snap("尝试出队：<code>front == rear</code>（都是 " + front + "）→ <b>队空，出队失败</b>。", -1);
        return false;
      }
      var v = data[front];
      var at = front;
      data[front] = undefined;
      front = (front + 1) % MAX;
      size--;
      snap("出队 <b>" + v + "</b>：<code>x = data[" + at + "]</code>，" +
        "<code>front = (" + at + "+1)%8 = " + front + "</code>。" + (why || "") +
        " 当前 size = " + size + "。", at);
      return true;
    }

    push(11, "队头仍然是 0，队尾开始向后生长。");
    push(22);
    push(33);
    pop("注意：元素被取走后，那个格子立刻变成可用空位。");
    snap("观察此刻：<code>front = " + front + "</code>，<code>rear = " + rear + "</code>，" +
      "元素个数 <code>(rear-front+8)%8 = " + ((rear - front + MAX) % MAX) + "</code>。" +
      "队头之前空出的 <code>data[0]</code> 待会儿会被重新利用。", -1);
    push(44, "先填满后半段。");
    push(55);
    push(66);
    push(77, "现在 rear 走到下标 7，下一步它就要「绕回」了！");
    push(88, "<b>关键一步</b>：<code>rear = (7+1)%8 = 0</code> —— rear 绕回了数组开头，" +
      "重新利用了 <code>data[0]</code>。这就是循环队列消灭假溢出的那一刻。");
    snap("此时 <code>front = " + front + "</code>，<code>rear = " + rear + "</code>，" +
      "虽然 <code>rear &lt; front</code>，但队列其实是<b>满</b>的：" +
      "<code>(rear+1)%8 = " + ((rear + 1) % MAX) + " == front</code> 成立。", -1);
    push(99, "");
    pop("出队一个，立刻腾出空间。");
    push(99, "刚才失败的 99 现在可以入队了 —— 出队腾出的空间马上被复用，这正是循环队列的价值。");
    pop("继续出队。");
    pop("继续出队。");
    snap("小结：<code>front</code> 和 <code>rear</code> 都能绕圈，数组空间被反复利用，" +
      "永远不会出现「明明有空位却队满」的情况。<b>代价是必须牺牲一个存储单元来区分空与满。</b>", -1);

    new DS.Viz(host, {
      title: "循环队列：入队 / 出队 / 判满 / 判空",
      sub: "环形布局，注意 rear 从 7 绕回 0 的那一步",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ======================================================================
     演示 3：银行排队模拟（离散事件）
     ====================================================================== */
  (function bank() {
    var host = document.getElementById('viz-bank');
    if (!host) return;

    var N = 12;                 // 顾客数
    var frames = [];

    (function simulate() {
      var rnd = makeRnd(20240501);
      var clock = 0, freeAt = 0;              // freeAt：窗口「变空闲」的时刻（初始 0 表示一开始就空闲）
      var nextArrive = randInt(rnd, 1, 5);
      var q = [];                             // 等待队列
      var serving = null;
      var stats = { done: 0, totalWait: 0, maxWait: 0, maxQueue: 0, idle: 0 };
      var timeline = [];

      function snapshot(desc, flashId) {
        var st = {
          clock: clock,
          serving: serving ? { id: serving.id, arrive: serving.arrive, serve: serving.serve, start: serving.start, leave: serving.leave } : null,
          q: q.map(function (c) { return { id: c.id, arrive: c.arrive, serve: c.serve }; }),
          stats: { done: stats.done, totalWait: stats.totalWait, maxWait: stats.maxWait, maxQueue: stats.maxQueue, idle: stats.idle },
          timeline: timeline.map(function (t) { return { id: t.id, arrive: t.arrive, start: t.start, leave: t.leave }; }),
          flashId: flashId === undefined ? -1 : flashId
        };
        frames.push({ desc: desc, draw: function (s) { return draw(s, st); } });
      }

      // 开始服务：核心公式 start = max(到达时刻, 窗口空闲时刻)
      function startServe(c, extra) {
        var wasFree = freeAt;
        c.start = Math.max(c.arrive, wasFree);
        if (c.start > wasFree) stats.idle += c.start - wasFree;   // 窗口白等了一段时间
        c.leave = c.start + c.serve;
        freeAt = c.leave;
        serving = c;
        timeline.push({ id: c.id, arrive: c.arrive, start: c.start, leave: c.leave });
        snapshot("柜员叫号 → 顾客 <b>" + c.id + "</b> 开始服务：" +
          "<code>start = max(到达 " + c.arrive + ", 窗口空闲 " + wasFree + ") = " + c.start + "</code>，" +
          "等待了 <b>" + (c.start - c.arrive) + "</b> 分钟，将于时刻 " + c.leave + " 离开。" +
          (extra || ""), c.id);
      }

      function finishServe(extra) {
        var c = serving;
        serving = null;
        stats.done++;
        stats.totalWait += c.start - c.arrive;
        if (c.start - c.arrive > stats.maxWait) stats.maxWait = c.start - c.arrive;
        snapshot("顾客 <b>" + c.id + "</b> 服务完成，<b>离开</b>：时刻 " + c.leave +
          "（服务耗时 " + c.serve + " 分钟，他等了 " + (c.start - c.arrive) + " 分钟）。" +
          (extra || ""), c.id);
      }

      snapshot("初始状态：时刻 0，柜员空闲，等待队列为空。第一位顾客将在第 " + nextArrive + " 分钟到达。", -1);

      for (var i = 1; i <= N; i++) {
        clock = nextArrive;

        // ① 先把在 clock 之前服务完的顾客送走，并让队列里的人补位
        while (serving && serving.leave <= clock) {
          finishServe(q.length
            ? "他走后队列里还有 " + q.length + " 人在等，窗口一空就立刻叫下一位。"
            : "他走后队列空了，柜员空闲下来等待下一位顾客。");
          if (q.length) startServe(q.shift(), "（他一直在排队，窗口一空立刻被叫号）");
        }

        // ② 新顾客到达
        var c = { id: i, arrive: clock, serve: randInt(rnd, 2, 6), start: 0, leave: 0 };
        if (!serving) {
          snapshot("顾客 <b>" + c.id + "</b> 到达：时刻 " + clock + "，需要服务 " + c.serve + " 分钟。" +
            "此刻柜员空闲、队列为空，可以<b>立即开始服务</b>。", c.id);
          startServe(c, "顾客到达时窗口正好空闲，<b>等待时间为 0</b>。");
        } else {
          q.push(c);
          var isRecord = q.length > stats.maxQueue;
          if (isRecord) stats.maxQueue = q.length;
          snapshot("顾客 <b>" + c.id + "</b> 到达：时刻 " + clock + "，需要服务 " + c.serve + " 分钟。" +
            "柜员正忙着服务顾客 " + serving.id + "（要到 " + serving.leave + " 才结束），" +
            "于是<b>入队等待</b>。当前队伍长度 <b>" + q.length + "</b> 人" +
            (isRecord ? "（刷新最大长度纪录）" : "") + "。", c.id);
        }
        nextArrive = clock + randInt(rnd, 1, 5);
      }

      // ③ 收尾：不再有新顾客，把剩下的人服务完
      while (serving || q.length) {
        if (serving) finishServe("不会再有新顾客了，把队列里的人依次服务完。");
        if (q.length) startServe(q.shift());
      }

      var avgWait = stats.done ? (stats.totalWait / stats.done) : 0;
      snapshot("模拟结束：总耗时 " + freeAt + " 分钟，共服务 " + stats.done + " 位顾客。" +
        "平均等待 <b>" + avgWait.toFixed(2) + "</b> 分钟，最大等待 <b>" + stats.maxWait + "</b> 分钟，" +
        "队列最大长度 <b>" + stats.maxQueue + " 人</b>，窗口空闲 " + stats.idle + " 分钟。" +
        "银行就是靠这三个数字决定「要不要加开窗口」。", -1);
    })();

    function draw(s, st) {
      var W = 880, H = 340;
      var svg = s.svg(W, H);
      s.defs(svg);

      // ---- 服务窗口 ----
      var busy = !!st.serving;
      svg.appendChild(s.box(24, 52, 210, 118, busy ? "active" : "", ""));
      svg.appendChild(s.text(129, 76, "服务窗口 ①", "lg", "middle"));
      if (busy) {
        svg.appendChild(s.text(129, 104, "顾客 " + st.serving.id, "brand", "middle"));
        svg.appendChild(s.text(129, 126, "本次需 " + st.serving.serve + " 分钟", "sm", "middle"));
        svg.appendChild(s.text(129, 148, st.serving.start + " → " + st.serving.leave, "sm", "middle"));
        var prog = Math.min(1, Math.max(0, (st.clock - st.serving.start) / st.serving.serve));
        svg.appendChild(s.el("rect", { x: 44, y: 158, width: 170, height: 8, rx: 4, fill: "var(--bg-soft)" }));
        svg.appendChild(s.el("rect", { x: 44, y: 158, width: Math.round(170 * prog), height: 8, rx: 4, fill: "var(--brand)" }));
      } else {
        svg.appendChild(s.text(129, 112, "空闲中", "sm ok", "middle"));
        svg.appendChild(s.text(129, 138, "等待顾客到来", "sm", "middle"));
      }

      // ---- 等待队列 ----
      svg.appendChild(s.text(262, 44, "等待队列 queue（front ↔ rear）", "lg", "start"));
      var qx = 262, qy = 62, qw = 62, qh = 54, gap = 8;
      svg.appendChild(s.el("rect", {
        x: qx - 8, y: qy - 8, width: 7 * (qw + gap) + 10, height: qh + 16, rx: 8,
        fill: "var(--panel-2)", stroke: "var(--border)"
      }));
      if (!st.q.length) {
        svg.appendChild(s.text(qx + 200, qy + 34, "（空）", "sm", "middle"));
      }
      for (var i = 0; i < st.q.length && i < 7; i++) {
        var cls = (st.q[i].id === st.flashId) ? "compare" : "done";
        svg.appendChild(s.box(qx + i * (qw + gap), qy, qw, qh, cls, "顾" + st.q[i].id));
        svg.appendChild(s.label(qx + i * (qw + gap) + qw / 2, qy + qh + 16,
          "等" + (st.clock - st.q[i].arrive), "middle"));
      }
      if (st.q.length > 7) {
        svg.appendChild(s.text(qx + 7 * (qw + gap) + 6, qy + 36, "…还有 " + (st.q.length - 7) + " 人", "sm bad", "start"));
      }
      if (st.q.length) {
        svg.appendChild(s.text(qx - 8, qy + qh + 40, "↑ front（下一位被叫号）", "sm brand", "start"));
        svg.appendChild(s.text(qx + (Math.min(st.q.length, 7) - 1) * (qw + gap), qy - 14, "rear ↑", "sm ok", "start"));
      }

      // ---- 统计面板 ----
      svg.appendChild(s.el("rect", { x: 24, y: 196, width: 832, height: 108, rx: 10, fill: "var(--panel-2)", stroke: "var(--border)" }));
      var avg = st.stats.done ? (st.stats.totalWait / st.stats.done) : 0;
      var items = [
        ["当前时刻 clock", st.clock],
        ["已完成人数", st.stats.done + " / " + N],
        ["平均等待", avg.toFixed(2) + " 分"],
        ["最大等待", st.stats.maxWait + " 分"],
        ["队列最大长度", st.stats.maxQueue + " 人"],
        ["窗口空闲", st.stats.idle + " 分"]
      ];
      for (var k = 0; k < items.length; k++) {
        var cx = 44 + (k % 3) * 274, cy = 226 + Math.floor(k / 3) * 46;
        svg.appendChild(s.text(cx, cy, items[k][0], "sm", "start"));
        svg.appendChild(s.text(cx, cy + 22, String(items[k][1]), "lg brand", "start"));
      }
      svg.appendChild(s.text(24, 328,
        "提示：等待时间 = 开始服务时刻 − 到达时刻；队列峰值在「入队后」统计。",
        "sm", "start"));
      return svg;
    }

    new DS.Viz(host, {
      title: "银行排队模拟（单窗口 · 离散事件）",
      sub: "12 位顾客随机到达，观察等待时间与队伍长度的变化",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ======================================================================
     演示 4：双端队列的两端操作
     ====================================================================== */
  (function deque() {
    var host = document.getElementById('viz-deque');
    if (!host) return;

    var CAP = 8;
    var frames = [];
    var data = new Array(CAP);
    var front = 0, rear = 0, size = 0;
    var limit = "";             // 当前演示的是哪种受限形式

    function logical() {
      var out = [];
      for (var i = 0; i < size; i++) out.push(data[(front + i) % CAP]);
      return out;
    }

    function snap(desc, marks, limitText) {
      if (limitText !== undefined) limit = limitText;
      var st = {
        data: data.slice(), front: front, rear: rear, size: size,
        marks: marks || {}, limit: limit, logical: logical()
      };
      frames.push({ desc: desc, draw: function (s) { return draw(s, st); } });
    }

    function draw(s, st) {
      var W = 720, H = 300;
      var svg = s.svg(W, H);
      s.defs(svg);
      var cw = 64, ch = 54, pitch = 72, x0 = 40, y0 = 84;

      svg.appendChild(s.text(40, 30, "数组 data[0..7]，front 向前退格、rear 向后前进，两端都取模", "lg", "start"));

      for (var i = 0; i < CAP; i++) {
        var x = x0 + i * pitch;
        var v = st.data[i];
        var cls = v === undefined ? "ghost" : "done";
        if (st.marks[i]) cls = st.marks[i];
        svg.appendChild(s.box(x, y0, cw, ch, cls, v === undefined ? "空" : v));
        svg.appendChild(s.label(x + cw / 2, y0 + ch + 16, "[" + i + "]", "middle"));
      }

      // rear 在上，front 在下（避免两者重合时打架）
      var rearX = x0 + (st.rear % CAP) * pitch + cw / 2;
      svg.appendChild(s.text(rearX, y0 - 12, "↓ rear=" + st.rear, "sm ok", "middle"));
      var frontX = x0 + (st.front % CAP) * pitch + cw / 2;
      svg.appendChild(s.text(frontX, y0 + ch + 38, "↑ front=" + st.front, "sm brand", "middle"));

      svg.appendChild(s.text(40, 204,
        "元素个数 size = " + st.size + "　（(rear-front+8)%8 = " + ((st.rear - st.front + CAP) % CAP) + "）",
        "sm", "start"));
      svg.appendChild(s.text(40, 232,
        "逻辑顺序（front → rear）：" + (st.logical.length ? join(st.logical, "  ") : "（空队列）"),
        "lg brand", "start"));
      svg.appendChild(s.text(40, 260, st.limit, "sm", "start"));
      svg.appendChild(s.text(40, 286,
        "入队/后端插入：rear = (rear+1)%8　　前端插入：front = (front-1+8)%8", "sm", "start"));
      return svg;
    }

    snap("初始：<code>front = rear = 0</code>，<code>size = 0</code>。双端队列允许在<b>两端</b>插入和删除。", {}, "");

    function pushBack(v) {
      if (size === CAP) { snap("队列已满，<code>push_back(" + v + ")</code> 失败。", {}); return; }
      var at = rear;
      data[rear] = v;
      rear = (rear + 1) % CAP;
      size++;
      var m = {}; m[at] = "active";
      snap("<code>push_back(" + v + ")</code> → 后端插入：<code>data[" + at + "] = " + v +
        "</code>，<code>rear = (" + at + "+1)%8 = " + rear + "</code>。这与普通队列的入队完全一样。", m);
    }
    function pushFront(v) {
      if (size === CAP) { snap("队列已满，<code>push_front(" + v + ")</code> 失败。", {}); return; }
      var oldFront = front;
      front = (front - 1 + CAP) % CAP;
      data[front] = v;
      size++;
      var m = {}; m[front] = "compare";
      snap("<code>push_front(" + v + ")</code> → 前端插入：先让 <code>front</code> 退一格，" +
        "<code>front = (" + oldFront + "-1+8)%8 = " + front + "</code>，再写入 <code>data[" + front +
        "] = " + v + "</code>。注意这里<b>必须先加 8 再取模</b>，否则下标会变成负数。", m);
    }
    function popFront() {
      if (!size) { snap("队列为空，<code>pop_front()</code> 失败。", {}); return; }
      var v = data[front], at = front;
      data[front] = undefined;
      front = (front + 1) % CAP;
      size--;
      var m = {}; m[at] = "dim";
      snap("<code>pop_front()</code> → 弹出队头 <b>" + v + "</b>：<code>x = data[" + at +
        "]</code>，<code>front = (" + at + "+1)%8 = " + front + "</code>。普通队列的出队就是它。", m);
    }
    function popBack() {
      if (!size) { snap("队列为空，<code>pop_back()</code> 失败。", {}); return; }
      rear = (rear - 1 + CAP) % CAP;
      var v = data[rear], at = rear;
      data[rear] = undefined;
      size--;
      var m = {}; m[at] = "dim";
      snap("<code>pop_back()</code> → 弹出队尾 <b>" + v + "</b>：<code>rear</code> 先退到 <b>" + at +
        "</b> 再取 <code>data[" + at + "]</code>。这个操作是普通队列<b>没有</b>的。", m);
    }

    pushBack(3);
    pushBack(4);
    pushFront(2);
    pushFront(1);
    snap("现在逻辑顺序是 <b>1 → 2 → 3 → 4</b>，但它们在数组里是「首尾两段」：" +
      "<code>data[6], data[7]</code> 和 <code>data[0], data[1]</code>。" +
      "前端插入让 <code>front</code> 一路向左退到了 6 —— 这就是双端队列的威力。", {},
      "此时若只用 push_back + pop_front，得到的就是一个普通队列（FIFO）。");
    popFront();
    popBack();
    snap("同时从两端删除：队头 1、队尾 4 分别离开。<code>front</code> 和 <code>rear</code> " +
      "都在向中间收拢，<code>size</code> 减少 2。", {}, "双端队列的四种操作都是 O(1)，因为都不需要搬移元素。");
    pushBack(5);
    pushFront(6);
    snap("继续在两端插入 5 和 6。此刻 <code>front = " + front + "</code>、<code>rear = " + rear +
      "</code>，<code>size = " + size + "</code>，逻辑顺序是 " + join(logical(), " → ") + "。" +
      "两个指针在环上你追我赶，却永远不会撞车（除非真的存满）。", {},
      "队列 = push_back + pop_front；栈 = push_back + pop_back（同一端进出）。");
    snap("小结：<b>栈和队列都是双端队列的特例</b>。" +
      "把 deque 的两端能力各自限制一半，就得到 FIFO 的队列和 LIFO 的栈；" +
      "只允许一端插入（或只允许一端删除），就得到「输入受限 / 输出受限双端队列」。", {},
      "STL 正是用 std::deque 作为 std::queue 与 std::stack 的默认底层容器。");

    new DS.Viz(host, {
      title: "双端队列 deque：两端都能进出",
      sub: "push_front / push_back / pop_front / pop_back 全是 O(1)",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ======================================================================
     演示 5：单调队列求滑动窗口最大值
     ====================================================================== */
  (function slidingWindow() {
    var host = document.getElementById('viz-sliding-window');
    if (!host) return;

    var A = [1, 3, -1, -3, 5, 3, 6, 7];
    var K = 3;
    var n = A.length;
    var frames = [];

    (function build() {
      var dq = [];            // 单调递减队列，存下标
      var res = [];

      function snap(desc, st) {
        var state = {
          dq: dq.slice(),
          res: res.slice(),
          i: st.i === undefined ? -1 : st.i,
          winFrom: st.winFrom === undefined ? -1 : st.winFrom,
          winTo: st.winTo === undefined ? -1 : st.winTo,
          popped: (st.popped || []).slice(),
          head: st.head === undefined ? -1 : st.head,
          justOut: st.justOut === undefined ? -1 : st.justOut
        };
        frames.push({ desc: desc, draw: function (s) { return draw(s, state); } });
      }

      snap("初始：数组 <b>[" + join(A) + "]</b>，窗口大小 <code>k = " + K + "</code>，" +
        "单调队列为空。队列里存的是<b>下标</b>，并且始终保证「下标递增、数值递减」。", {});

      for (var i = 0; i < n; i++) {
        // ---- 步骤一：去尾 ----
        var popped = [];
        var desc = "第 " + (i + 1) + " 步 · 元素 <b>a[" + i + "] = " + A[i] + "</b>：先看队尾。";
        while (dq.length && A[dq[dq.length - 1]] <= A[i]) {
          popped.push(dq.pop());
        }
        if (popped.length) {
          desc += "队尾的下标 " + join(popped, "、") + "（值 " +
            join(popped.map(function (x) { return A[x]; }), "、") +
            "）都 <b>≤ " + A[i] + "</b>，而且它们比 a[" + i + "] 更早离开窗口 —— " +
            "既更小又更早过期，<b>永远不可能成为最大值</b>，全部弹出。";
        } else if (!dq.length) {
          desc += "队列此时为空，没有需要淘汰的元素，直接入队。";
        } else {
          desc += "队尾元素都大于 " + A[i] + "，不需要弹出（它们还有机会成为最大值）。";
        }
        snap(desc, { i: i, winFrom: Math.max(0, i - K + 1), winTo: i, popped: popped });

        // ---- 步骤二：入队 + 去头 + 取答案 ----
        dq.push(i);
        var headOut = -1;
        var d2 = "把下标 <b>" + i + "</b> 压入队尾。";
        if (dq[0] <= i - K) {
          headOut = dq.shift();
          d2 += "队头下标 " + headOut + " 已经滑出窗口左边界（窗口是 [" + (i - K + 1) + ", " + i +
            "]），虽然它的值可能很大，但已经<b>不在场</b>，弹出。";
        } else {
          d2 += "队头下标 " + dq[0] + " 仍在窗口内，保留。";
        }
        var outTxt = "";
        if (i >= K - 1) {
          res.push(A[dq[0]]);
          outTxt = "窗口 [" + (i - K + 1) + ", " + i + "] 已填满 → <b>输出队头值 " + A[dq[0]] + "</b>。";
        } else {
          outTxt = "窗口还没填满（需要 " + K + " 个元素），本次不输出。";
        }
        snap(d2 + " " + outTxt, {
          i: i, winFrom: Math.max(0, i - K + 1), winTo: i, head: dq[0], justOut: headOut
        });
      }

      snap("扫描结束！结果数组为 <b>[" + join(res) + "]</b>。" +
        "整个过程每个下标最多入队一次、出队一次，总时间 <b>O(n)</b>；" +
        "而暴力法需要 " + (n - K + 1) + " 个窗口 × " + K + " 次比较 = " + ((n - K + 1) * K) + " 次比较。",
        { res: res.slice() });
    })();

    function draw(s, st) {
      var W = 880, H = 340;
      var svg = s.svg(W, H);
      s.defs(svg);
      var cw = 56, ch = 48, pitch = 62, x0 = 40, y0 = 48;

      // ---- 数组 ----
      for (var i = 0; i < n; i++) {
        var x = x0 + i * pitch;
        var cls = "";
        if (i >= st.winFrom && i <= st.winTo && st.winTo >= 0) cls = "compare";
        if (i === st.i) cls = "active";
        if (st.popped.indexOf(i) >= 0) cls = "warn";
        svg.appendChild(s.box(x, y0, cw, ch, cls, A[i]));
        svg.appendChild(s.label(x + cw / 2, y0 + ch + 16, "[" + i + "]", "middle"));
      }
      // 窗口括线
      if (st.winTo >= 0) {
        var wx = x0 + st.winFrom * pitch - 6;
        var ww = (st.winTo - st.winFrom + 1) * pitch - (pitch - cw) + 12;
        svg.appendChild(s.el("rect", {
          x: wx, y: y0 - 8, width: ww, height: ch + 16, rx: 8,
          fill: "none", stroke: "var(--accent)", "stroke-width": 2.4
        }));
        svg.appendChild(s.text(wx + ww / 2, y0 - 16, "当前窗口 k=" + K, "sm", "middle"));
      }

      // ---- 单调队列 ----
      svg.appendChild(s.text(40, 156, "单调递减队列（存下标，括号内是数值）：", "lg", "start"));
      var qx = 380, qy = 138;
      if (!st.dq.length) {
        svg.appendChild(s.text(qx, qy + 26, "（空）", "sm", "start"));
      }
      for (var k = 0; k < st.dq.length; k++) {
        var idx = st.dq[k];
        var kcls = (k === 0) ? "done" : "active";
        svg.appendChild(s.box(qx + k * 84, qy, 76, 40, kcls, idx + " (" + A[idx] + ")"));
        svg.appendChild(s.label(qx + k * 84 + 38, qy + 56, k === 0 ? "front＝最大值" : "rear", "middle"));
      }

      // ---- 输出 ----
      svg.appendChild(s.text(40, 232, "已输出的窗口最大值：", "lg", "start"));
      for (var r = 0; r < st.res.length; r++) {
        svg.appendChild(s.box(240 + r * 66, 210, 56, 40, "done", st.res[r]));
      }
      if (!st.res.length) svg.appendChild(s.text(240, 236, "（还没有）", "sm", "start"));

      svg.appendChild(s.text(40, 286,
        "规则：① 入队前去尾，弹出所有 ≤ 新元素的下标　② 入队后去头，弹出已滑出窗口的下标　③ 队头即窗口最大值",
        "sm", "start"));
      svg.appendChild(s.text(40, 312,
        "均摊分析：每个下标至多进队一次、出队一次 ⇒ 总时间 O(n)，而不是 O(nk)。", "sm brand", "start"));
      return svg;
    }

    new DS.Viz(host, {
      title: "单调队列：滑动窗口最大值 O(n)",
      sub: "a = [1,3,-1,-3,5,3,6,7]，k = 3",
      build: function () { return { frames: frames }; }
    });
  })();

  /* ======================================================================
     演示 6：BFS 逐层扩展求迷宫最短路径
     ====================================================================== */
  (function mazeBfs() {
    var host = document.getElementById('viz-maze-bfs');
    if (!host) return;

    var R = 5, C = 7;
    var MAZE = [
      [0, 0, 0, 0, 1, 0, 0],
      [0, 0, 1, 0, 1, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [1, 0, 0, 1, 0, 1, 0],
      [0, 0, 0, 0, 0, 0, 0]
    ];
    var SR = 0, SC = 0, TR = 2, TC = 6;
    var OPEN = 0;
    (function countOpen() {
      for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) if (MAZE[r][c] === 0) OPEN++;
    })();
    var frames = [];

    (function build() {
      var dist = [], parent = [], q = [], order = [];
      var r, c;
      for (r = 0; r < R; r++) {
        dist.push([]); parent.push([]);
        for (c = 0; c < C; c++) { dist[r].push(-1); parent[r].push(null); }
      }
      var dr = [-1, 1, 0, 0], dc = [0, 0, -1, 1];

      function snap(desc, st) {
        var state = {
          dist: dist.map(function (row) { return row.slice(); }),
          q: q.map(function (p) { return { r: p.r, c: p.c }; }),
          cur: st && st.cur ? st.cur : null,
          fresh: (st && st.fresh) ? st.fresh.slice() : [],
          path: (st && st.path) ? st.path.slice() : null,
          done: !!(st && st.done),
          visited: (st && st.visited !== undefined) ? st.visited : 0
        };
        frames.push({ desc: desc, draw: function (s) { return draw(s, state); } });
      }

      dist[SR][SC] = 0;
      q.push({ r: SR, c: SC });
      order.push({ r: SR, c: SC });
      snap("初始：把起点 <b>(" + SR + "," + SC + ")</b> 入队，距离置 0（<b>入队时就标记</b>，不要等到出队）。" +
        "队列里现在只有起点，距离层数 = 1。", { cur: { r: SR, c: SC }, visited: 1 });

      while (q.length) {
        var cur = q.shift();
        var fresh = [];
        for (var k = 0; k < 4; k++) {
          var nr = cur.r + dr[k], nc = cur.c + dc[k];
          if (nr < 0 || nr >= R || nc < 0 || nc >= C) continue;
          if (MAZE[nr][nc] === 1) continue;
          if (dist[nr][nc] !== -1) continue;
          dist[nr][nc] = dist[cur.r][cur.c] + 1;
          parent[nr][nc] = { r: cur.r, c: cur.c };
          q.push({ r: nr, c: nc });
          order.push({ r: nr, c: nc });
          fresh.push({ r: nr, c: nc });
        }
        var total = order.length;
        snap("出队 <b>(" + cur.r + "," + cur.c + ")</b>（距离 " + dist[cur.r][cur.c] + "），向四个方向扩展：" +
          (fresh.length
            ? "新入队 " + fresh.map(function (p) { return "(" + p.r + "," + p.c + ")"; }).join("、") +
              "，它们的距离都是 <b>" + (dist[cur.r][cur.c] + 1) + "</b>。"
            : "四个方向都不能走（越界 / 撞墙 / 已访问），没有新格子入队。") +
          " 目前已访问 " + total + " 个格子，队列长度 " + q.length + "。",
          { cur: cur, fresh: fresh, visited: total });
      }

      // 回溯路径
      var path = [], p = { r: TR, c: TC };
      while (p) { path.push(p); p = parent[p.r][p.c]; }
      path.reverse();
      snap("BFS 结束（队列空了）。终点 <b>(" + TR + "," + TC + ")</b> 第一次被访问时的距离是 <b>" +
        dist[TR][TC] + "</b>，这就是最短路径长度。" +
        "沿 <code>parent[]</code> 从终点回溯，得到路径：" +
        path.map(function (x) { return "(" + x.r + "," + x.c + ")"; }).join(" → ") + "。",
        { path: path, done: true, visited: order.length });

      snap("总结：队列的 <b>FIFO</b> 保证了「距离小的格子先出队」，" +
        "所以每个格子<b>第一次被访问时的距离一定是最短的</b>。" +
        "共访问 " + order.length + " 个格子，每个格子只处理一次，时间 <code>O(R×C)</code>。" +
        "对比第 03 讲用栈的 DFS：栈能找到「一条路」，队列才能找到「最短路」。",
        { path: path, done: true, visited: order.length });
    })();

    function draw(s, st) {
      var W = 880, H = 400;
      var svg = s.svg(W, H);
      s.defs(svg);
      var cell = 48, x0 = 40, y0 = 56;
      var pathSet = {};
      if (st.path) {
        for (var pi = 0; pi < st.path.length; pi++) pathSet[st.path[pi].r + "," + st.path[pi].c] = pi;
      }
      var freshSet = {};
      for (var fi = 0; fi < st.fresh.length; fi++) freshSet[st.fresh[fi].r + "," + st.fresh[fi].c] = 1;

      svg.appendChild(s.text(40, 30, "迷宫（# 墙） · 格内数字 = 从起点 S 走到该格的最少步数", "lg", "start"));

      for (var r = 0; r < R; r++) {
        for (var c = 0; c < C; c++) {
          var x = x0 + c * cell, y = y0 + r * cell;
          var key = r + "," + c;
          var cls, txt;
          if (MAZE[r][c] === 1) { cls = "ghost"; txt = "#"; }
          else if (r === SR && c === SC) { cls = "done"; txt = "S"; }
          else if (r === TR && c === TC) { cls = "done"; txt = "T"; }
          else if (st.dist[r][c] >= 0) { cls = ""; txt = String(st.dist[r][c]); }
          else { cls = "ghost"; txt = ""; }

          if (pathSet[key] !== undefined) cls = "done";
          if (freshSet[key]) cls = "compare";
          if (st.cur && st.cur.r === r && st.cur.c === c) cls = "active";

          if (r === SR && c === SC) txt = "S";
          if (r === TR && c === TC) txt = "T";

          svg.appendChild(s.el("rect", {
            x: x, y: y, width: cell, height: cell,
            "class": "vz-box " + cls
          }));
          if (txt !== "") {
            svg.appendChild(s.text(x + cell / 2, y + cell / 2 + 5, txt, "sm", "middle"));
          }
        }
      }

      // 路径连线
      if (st.path && st.path.length > 1) {
        var d = "";
        for (var k = 0; k < st.path.length; k++) {
          var px = x0 + st.path[k].c * cell + cell / 2;
          var py = y0 + st.path[k].r * cell + cell / 2;
          d += (k === 0 ? "M" : " L") + px + "," + py;
        }
        svg.appendChild(s.path(d, "done"));
      }

      // ---- 右侧：队列状态 ----
      var qx = 420;
      svg.appendChild(s.el("rect", {
        x: qx - 12, y: 44, width: 452, height: 200, rx: 10,
        fill: "var(--panel-2)", stroke: "var(--border)"
      }));
      svg.appendChild(s.text(qx, 70, "队列内容（front → rear）", "lg", "start"));
      var limit = Math.min(st.q.length, 15);
      for (var qi = 0; qi < limit; qi++) {
        var bx = qx + (qi % 5) * 88, by = 84 + Math.floor(qi / 5) * 46;
        svg.appendChild(s.box(bx, by, 80, 38, qi === 0 ? "active" : "", "(" + st.q[qi].r + "," + st.q[qi].c + ")"));
      }
      if (!st.q.length) svg.appendChild(s.text(qx, 108, "（队列空 —— BFS 结束）", "sm", "start"));
      if (st.q.length > 15) svg.appendChild(s.text(qx, 230, "… 还有 " + (st.q.length - 15) + " 个", "sm bad", "start"));

      svg.appendChild(s.text(qx, 272, "已访问格子数：" + st.visited + " / " + OPEN + "（可走格子总数）", "lg brand", "start"));
      var layerTxt = st.cur ? ("当前扩展距离层 = " + st.dist[st.cur.r][st.cur.c]) : "扩展已结束";
      svg.appendChild(s.text(qx, 300, layerTxt, "lg", "start"));
      svg.appendChild(s.text(qx, 330, "队首永远是「距离最小」的格子 —— 这就是 BFS 的次序保证。", "sm", "start"));
      svg.appendChild(s.text(qx, 354, "橙框 = 本轮新入队；蓝框 = 正在出队扩展的格子。", "sm", "start"));

      svg.appendChild(s.text(40, 340,
        "终点 T 的 dist = " + st.dist[TR][TC] + "（-1 表示尚不可达）", "sm brand", "start"));
      svg.appendChild(s.text(40, 366,
        "最短路径长度 = " + (st.dist[TR][TC] >= 0 ? st.dist[TR][TC] + " 步" : "未知"), "sm brand", "start"));
      if (st.done) {
        svg.appendChild(s.text(40, 390, "绿色折线 = 回溯出的最短路径（经过 " + (st.path ? st.path.length : 0) + " 个格子）", "sm ok", "start"));
      }
      return svg;
    }

    new DS.Viz(host, {
      title: "迷宫最短路：BFS + 队列逐层扩展",
      sub: "队列保证「距离小的先出队」⇒ 第一次到达即最短",
      build: function () { return { frames: frames }; }
    });
  })();
})();
