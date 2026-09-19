#!/usr/bin/env node
/**
 * batch-check.mjs —— 一键跑完所有离线校验
 *   1. check.mjs        结构与内容完整性（文件/锚点/容器/转义）
 *   2. nav-check.mjs    上一讲/下一讲链条与站内链接
 *   3. dom-sim.mjs      真实执行页面脚本 + 逐帧渲染全部动画（捕获运行时错误）
 *   4. cpp-check.mjs    抽取所有 C++ 代码块交给 g++ 编译
 *   5. coverage-check.mjs  按需求清单核对知识点覆盖
 *   6. xref-check.mjs   正文里「见第 NN 讲」的讲次编号是否指对
 *
 * 用法：node tools/batch-check.mjs
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

const dir = import.meta.dirname;
const steps = [
  ["结构与内容检查", "check.mjs"],
  ["导航链条检查", "nav-check.mjs"],
  ["页面脚本 + 动画仿真", "dom-sim.mjs"],
  ["C++ 代码块编译", "cpp-check.mjs"],
  ["需求覆盖核对", "coverage-check.mjs"],
  ["交叉引用讲次校验", "xref-check.mjs"],
];

const results = [];
for (const [name, file] of steps) {
  console.log("\n" + "═".repeat(66));
  console.log("▶ " + name + "  (" + file + ")");
  console.log("═".repeat(66));
  // 沙箱下不能用管道捕获子进程输出：继承 stdio，直接打到终端
  const r = spawnSync(process.execPath, [path.join(dir, file)], { stdio: "inherit" });
  results.push([name, r.status]);
}

console.log("\n" + "═".repeat(66));
console.log("汇总");
console.log("═".repeat(66));
let bad = 0;
for (const [name, code] of results) {
  console.log((code === 0 ? "✓ " : "✗ ") + name + (code === 0 ? " 通过" : " 存在问题（退出码 " + code + "）"));
  if (code !== 0) bad++;
}
process.exit(bad ? 1 : 0);
