---
name: card-visualizer
description: 生成可交互卡片、架构图、流程图或数据图表。当用户需要可视化呈现、设计对比、动态计算器、HTML UI 预览或图表时使用。
---

# 交互式卡片生成规范

在向用户展示流程图、系统架构、数据图表、UI 原型或交互计算器时，使用 `<dsh-card>` 标签将可执行的 HTML/SVG/JS 包裹输出。

## 输出格式
```html
<dsh-card title="卡片标题">
  <!-- 内联 HTML / SVG / CSS / JS 代码 -->
  <div style="padding: 16px; font-family: sans-serif;">
    <h3>组件展示</h3>
    <button onclick="alert('点击成功')">交互按钮</button>
  </div>
</dsh-card>
```

## 规范要求
1. **容器隔离**：所有代码在独立沙箱中运行，背景默认透明，文字自适应主题。
2. **图表绘制**：优先使用原生 SVG 或纯 CSS 绘制精美的架构拓扑与流程图。
3. **响应式自适应**：宽度建议 100%，高度会自动伸缩适配。
