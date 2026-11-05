# v3.8.1 发布说明

> 版本 **3.8.1** / versionCode **183**（arm64-v8a 包 183003、armeabi-v7a 包 183001）
> Android 16（targetSdk 36），`minSdk 21`，ABI 仅 `arm64-v8a` + `armeabi-v7a`。
> 本版是 v3.8.0 之后的体验打磨版，按你反馈的 6 点逐项更新。

---

## 1. 下载中心音质徽章回到歌名后面

- 音质徽章重新放到歌名右侧（不再是第二行），仍是「选择下载音质」弹窗同款细描边圆角胶囊。
- 同时修掉 Android 上「文字被裁一个字」的根因：RN 文本测量比实际渲染窄约一个字符、TextView 会裁掉超出自身布局宽度的字形。现在给徽章内文字显式宽度（拉丁/数字 9dp、CJK 12dp、空格 5dp + 余量），320k / 128k / Hi-Res / FLAC 无损都能完整显示，长歌名时歌名省略、徽章不被裁。

## 2. 底部胶囊：圆环 / 描边 / 关闭 三种样式分流（对齐 Material You）

- **封面圆环（默认）**：胶囊外圈不再显示任何跑马灯/呼吸光带，只保留干净的胶囊轮廓（极淡 0.5dp outline）与右侧封面圆环进度。
- **胶囊描边**：只有这个样式才显示跑马灯呼吸光带 + 贴边进度光（原有动效保留）。
- **关闭**：外圈不画进度/动画。
- 子页 PlayerBar、横屏底部迷你播放器、收藏页迷你条共用同一组件，样式规则自动一致。

## 3. 歌词高亮行字号略大

- 当前高亮行在原「高亮行已大 14%」的基础上，再按档位 +1~2sp（默认档位约 21.5 vs 其它行 17.5），看起来更突出但不突兀。
- 逐字高亮的底字层、像素裁切高亮层、行高全部同字号，不会因放大裁字；横屏歌词、单行歌词、字号四档切换都生效；普通行行高不变，不跳动。

## 4. 键盘弹出时不再「白屏一块」

- 根因（native）：主窗口 `adjustResize` 先把窗口按 IME 高度压缩一次，RNN 的 `ComponentLayout` 又把 `Type.ime()` 高度作为 bottom padding 扣一次，可用高度变成 `891−2×343=205dp`，`205..548dp` 这段露出 ComponentLayout 背景色 → 表现为「键盘上方整块空白、列表看不到」。
- 修复：`AndroidManifest.xml` 主 Activity `adjustResize` → `adjustNothing`，窗口保持全高，由 RNN insets 把内容压到 548dp（正好键盘上沿）。
- 效果：本地音乐搜索、搜索页热门/结果、悬停的输入弹窗都能在键盘上方正常显示、可滚动、可点击；设置里输入框、歌单打开弹窗、歌曲信息编辑等键盘场景一并验证正常。

## 5. 标签文字垂直居中 + 原生设置风统一为 Material You

- 新增统一标签原语 `Tag`：固定高度 + `justifyContent/alignItems:center` + `includeFontPadding:false` + `textAlignVertical:'center'`，不再用 paddingTop 目测；MiniTag / Chip / Badge / CheckBox 文案与设置页所有自绘标签（音源版本/当前启用/最高音质/权限状态/工具汇总/预览状态/横屏导航胶囊）全部统一，中英数混排都居中。
- 系统 `Alert` 统一替换为 App 内 Material You 圆角弹窗（图标 + 主色实心按钮 / 危险色删除 / 淡底次级，支持 1/2/3 按钮与队列；宿主不可用时回退系统 Alert，行为不变）。首次播放的通知/电池引导、音乐工具 4 处确认、所有 `confirmDialog/tipDialog` 都走新弹窗。
- 设置页原生 `Switch` 全部换成自绘胶囊 Toggle；「其他设置」重排为 缓存 / 其他 / 日志 / 权限管理 / 设备兼容 统一设置行（左图标 + 标题/描述 + 右侧状态胶囊）；音乐工具卡片改为与设置页同款主题淡底卡片。

## 6. 首页搜索按钮 / 滚动条

- 首页右上角搜索按钮统一为本地音乐 / 下载中心 / 排行榜页头同款：38dp 圆、icon 20、`c-primary-alpha-900` 淡底、按压反馈一致。
- 首页竖向滚动隐藏右侧滚动条；大卡轮播、最近播放横滑、推荐歌单横滑均无滚动条。

---

## 验证（SM-S938B / Android 17，v3.8.1 实机）

- 应用冷启动正常，`FATAL EXCEPTION` = 0；首页/本地/下载/我的/歌词/播放器/设置页切换正常。
- 截图证据：`.tmp-verify/v3.8.1/`（home、local-search-keyboard、search-keyboard、download-badge、capsule-ring、capsule-border、lyrics-highlight、settings-other、material-dialog、source-tags、keyboard-modal）。
- 两帧差分：圆环模式胶囊边缘 0 变化（无跑马灯）；描边模式 top 2193px / bottom 1397px 变化（光带在跑）；首页卡片动效、圆盘自转正常。

## 已知项 / 后续可做

- 设置页内部滚动仍会显示右侧滚动条（本次只按要求隐藏了首页）。
- 部分弹层（如音源「导入」的 本地/在线 选择菜单）仍是旧的直角 ActionSheet 样式，可后续统一为 Material You 圆角菜单。
- 系统权限页/文件选择器本身无法改样式，只统一了 App 内入口页。
- 歌单详情首屏封面约 5~10s 加载空窗、批量重命名「生成预览」偶发点击无响应（v3.8.0 遗留 P3）未在本版处理。
