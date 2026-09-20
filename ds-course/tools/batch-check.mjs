#!/usr/bin/env node
/**
 * batch-check.mjs —— 一键跑完所有离线校验
 *   1. check.mjs        结构与内容完整性（文件/锚点/容器/转义）
 *   2. nav-check.mjs    上一讲/下一讲链条与站内链接
 *   3. dom-sim.mjs      真实执行页面脚本 + 逐帧渲染全部动画（捕获运行时错误）
 *   4. frame-check.mjs  动画帧状态：画面会不会冻结在最终态（draw 读活变量）
 *   5. vz-check.mjs     动画用到的 vz-* 状态类是否都在 course.css 里有定义
 *   6. cpp-check.mjs    抽取所有 C++ 代码块交给 g++ 编译
 *   7. coverage-check.mjs  按需求清单核对知识点覆盖
 *   8. xref-check.mjs   正文里「见第 NN 讲」的讲次编号是否指对
 *   9. verify-stats.mjs 公开文档（README / index.html）里的规模数字与实测是否一致
 *
 * 用法：node tools/batch-check.mjs
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

const dir = import.meta.dirname;          // tools/ 目录的绝对路径（从这里找下面各个脚本）

/* 要依次跑的检查项：[显示名, 脚本文件名]。
   想加一项检查，只需：写好 tools/xxx.mjs、在这里加一行、并保证「有问题时 exit 1」。 */
const steps = [
  ["结构与内容检查", "check.mjs"],
  ["导航链条检查", "nav-check.mjs"],
  ["页面脚本 + 动画仿真", "dom-sim.mjs"],
  ["动画帧状态检查", "frame-check.mjs"],
  ["动画状态类检查", "vz-check.mjs"],
  ["C++ 代码块编译", "cpp-check.mjs"],
  ["需求覆盖核对", "coverage-check.mjs"],
  ["交叉引用讲次校验", "xref-check.mjs"],
  ["公开数字核对", "verify-stats.mjs"],
];

/* results —— 收集每项的 [名称, 退出码]，全部跑完后再统一汇总（不提前中断，
   这样一次运行就能看到所有问题，而不是修一个跑一次）。 */
const results = [];
for (const [name, file] of steps) {
  console.log("\n" + "═".repeat(66));
  console.log("▶ " + name + "  (" + file + ")");
  console.log("═".repeat(66));
  /* r.status —— 子进程退出码：0 = 通过，非 0 = 该项有问题（各脚本自己定义失败条件）。
     沙箱下不能用管道捕获子进程输出（会 EPERM），所以用 stdio:"inherit" 直接打到终端。 */
  const r = spawnSync(process.execPath, [path.join(dir, file)], { stdio: "inherit" });
  results.push([name, r.status]);
}

console.log("\n" + "═".repeat(66));
console.log("汇总");
console.log("═".repeat(66));
let bad = 0;                              // 失败的检查项个数；>0 时本脚本也以 1 退出，让 git-commit.ps1 中止
for (const [name, code] of results) {
  console.log((code === 0 ? "✓ " : "✗ ") + name + (code === 0 ? " 通过" : " 存在问题（退出码 " + code + "）"));
  if (code !== 0) bad++;
}
process.exit(bad ? 1 : 0);
