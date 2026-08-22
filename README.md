# 内容窗格调整

一个用于 Zotero 9 和 10 的 Item Pane 内容窗格管理插件。

它可以读取当前 Zotero 内容窗格中的原生面板和第三方插件面板，并通过拖动列表行调整显示顺序。即使某些插件没有提供排序设置，也可以尝试通过本插件调整已经渲染到当前内容窗格中的插件面板。

## 功能

- 显示 Zotero 原生内容窗格；
- 识别当前已渲染的第三方插件面板；
- 尝试识别已注册但当前尚未渲染的插件面板；
- 使用中文名称显示常见 Zotero 原生面板；
- 显示“原生”和“插件”类型标记；
- 通过拖动整行调整面板顺序；
- 保存自定义排序；
- 使用响应式布局，减少对右侧工具栏空间的占用；
- 列表较长时在插件面板内部滚动。

## 使用方法

1. 下载正式版 XPI：

   <https://github.com/chen7447/item-pane-organizer-zotero/releases/download/v1.4.0/itempaneorganizer-1.4.0.xpi>

2. 在 Zotero 中打开：

   `工具 → 插件`

3. 点击右上角齿轮按钮，选择“从文件安装插件…”；
4. 选择下载的 `itempaneorganizer-1.4.0.xpi`；
5. 重启 Zotero（如果 Zotero 要求重启）；
6. 打开一个有条目的内容窗格；
7. 点击右侧的“内容窗格调整”面板；
8. 按住列表中的一行，将它拖动到目标位置后松开。

## 面板类型说明

### 原生面板

例如：

- 信息；
- 摘要；
- 附件；
- 笔记；
- 文库与分类；
- 标签；
- 关联条目。

### 插件面板

插件面板只有在插件已经注册并且当前内容窗格已经渲染对应按钮时，才能实际拖动。已经注册但尚未渲染的面板会以灰色显示，不能被伪造或直接移动。

某些插件可能声明了自己的排序限制，或者在 Zotero 重建内容窗格后重新设置位置。此时本插件只能调整当前 live 内容窗格中的实际 DOM 面板，不能保证覆盖第三方插件自身的重排逻辑。

## 兼容性

- 目标版本：Zotero 9.0.6 至 Zotero 10.0；
- manifest 最低版本：Zotero 9.0；
- manifest 最高版本：Zotero 10.0.*。

本插件使用 Zotero Item Pane 的部分内部 DOM 结构。未来 Zotero 版本如果调整 `item-pane-sidenav`、`.pin-wrapper` 或 `.btn[data-pane]` 的结构，可能需要适配。

## 数据与隐私

插件在 Zotero 本地偏好中保存面板排序，不上传条目内容、PDF 内容或插件配置。排序同时写入：

- 官方偏好：`extensions.zotero.sidenav.order`（与 Zotero 自带右键菜单排序共用同一存储，orderable 面板由 Zotero 自己持久化与恢复）；
- 插件偏好：`extensions.itempaneorganizer.order`（兜底保存非 orderable 插件面板的顺序，启动时重放）。

## 开发与打包

源码目录：

```text
addon/
```

检查 JavaScript 语法：

```powershell
node --check .\addon\content\scripts\addon.js
node --check .\addon\bootstrap.js
```

打包 XPI：

```powershell
py -3 .\pack_xpi.py .\addon .\itempaneorganizer-1.4.0.xpi
```

## 发布信息

当前正式版本：**1.4.0**

Release 页面：

<https://github.com/chen7447/item-pane-organizer-zotero/releases/tag/v1.4.0>

## 许可证

本项目采用 [MIT License](LICENSE) 开源协议。

简单来说，MIT 协议允许他人自由使用、复制、修改、合并、发布、分发、再许可和销售本项目，但需要保留原作者版权声明和许可证文本。软件按“现状”提供，作者不对使用插件产生的损失承担责任。
