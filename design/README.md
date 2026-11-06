# EMO音乐 · 品牌与界面资产

本目录存放 EMO音乐 的品牌资产与设计稿源文件。

## 资产清单

| 文件 | 用途 |
| --- | --- |
| `EMO-UI-Design.html` | 界面设计方案（设计令牌、关键界面、交互规范），浏览器直接打开 |
| `logo.html` | LOGO 矢量源文件（SVG，1024×1024） |
| `logo-new-source.png` | 新版 LOGO 原始稿（白色圆角底 + 黑色音符/播放键 + 紫色弧线） |
| `icon-1024.png` | 主图标（1024 白色圆角底，旧版启动图标/商店素材） |
| `icon-squircle.png` | 圆角版图标（应用内展示/头像） |
| `icon-round.png` | 圆形版图标（`ic_launcher_round`） |
| `gradient.html` / `emo-header.png` | 下载页头部渐变背景 |

## 阶段 U（v3.10 UI/动效）设计变更

本轮按「液态琉璃 + 减少动态效果 + 信息层级统一」更新，设计令牌不变（主色/渐变/圆角仍以上表为准）：

| 模块 | 变更 |
| --- | --- |
| 悬浮导航/迷你播放器/子页播放条 | 统一 `LiquidGlass`：真高斯模糊 + 流动高光 + 边缘光；设置里提供 液态玻璃 / 毛玻璃 / 关闭 三档 |
| 首页 | 新增第 5 张「听歌统计」卡：今日/本周分钟 + 7 日趋势柱，配色沿用深空蓝渐变 |
| 排行榜/歌单详情/搜索 | 长按进入多选 + 统一底部 ActionSheet；批量操作行与全站菜单同规格 |
| 播放器 | 歌词页只保留一个「歌词设置」入口（字号/对齐/逐字/翻译/音译/简拼/简繁）；新增定时关闭；进度条改弹性滑块 |
| 本地音乐 | 右侧 A-Z 首字母栏；页头只留搜索键，搜索条按需展开；下拉即扫描 |
| 全局 | 「减少动态效果」开关；列表页使用统一 Skeleton 与 loading/error/empty 三态 |

> `EMO-UI-Design.html` 尚未把这轮的局部变更画回设计稿（只改了实现与文案），
> 下一轮设计同步时按上表补齐，不视为设计令牌变更。

## 品牌定义

- 名称：EMO音乐（英文 EMO Music）
- Slogan：深夜下载 · 情绪收藏
- LOGO 概念：字母 **E** 的三条横线，中间一条断成心电图波形 —— 音乐是情绪的波形
- 主色：`#A855F7`（紫）；强调色 `#EC4899`（粉）；底色 `#0B0B12`（深空黑）
- 渐变：`#A78BFA → #8B5CF6 → #EC4899`（135°）

## 新版图标（阶段 U 后续）

当前 Android 图标由 `logo-new-source.png` 生成：

- 自适应图标：白色背景（`ic_launcher_background = #FFFFFF`）+ `drawable-*/ic_launcher_emo.png` 前景音符；
- 旧版 `mipmap-*/ic_launcher.png` / `ic_launcher_round.png`：白色圆角/圆形底 + 居中音符；
- `icon-1024.png`、`icon-squircle.png`、`icon-round.png`、`doc/images/icon.png` 同源生成。

> 旧版用 Chrome 渲染 `logo.html` 的流程保留在下面，仅作为历史方式；当前换标不再需要。

## 重新生成图标（旧版流程）

依赖：macOS 自带 `sips` + 本机 Chrome（headless 渲染 SVG）。

```bash
cd design

# 1. 渲染 1024 主图标
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --no-sandbox --disable-gpu --hide-scrollbars \
  --window-size=1024,1024 --screenshot=icon-1024.png "file://$PWD/logo.html"

# 2. 渲染圆角 / 圆形版本（透明底）
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --no-sandbox --disable-gpu --hide-scrollbars \
  --default-background-color=00000000 --window-size=1024,1024 \
  --screenshot=icon-squircle.png "file://$PWD/render-squircle.html"

"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --no-sandbox --disable-gpu --hide-scrollbars \
  --default-background-color=00000000 --window-size=1024,1024 \
  --screenshot=icon-round.png "file://$PWD/render-round.html"
```

再把产物按密度导出到 `android/app/src/main/res`（脚本见 git 提交记录，或手动）：

| 资源 | mdpi | hdpi | xhdpi | xxhdpi | xxxhdpi |
| --- | --- | --- | --- | --- | --- |
| `mipmap-*/ic_launcher.png` | 48 | 72 | 96 | 144 | 192 |
| `mipmap-*/ic_launcher_round.png` | 48 | 72 | 96 | 144 | 192 |
| `drawable-*/ic_launcher_emo.png`（自适应前景） | 108 | 162 | 216 | 324 | 432 |

## 主题

主题定义在 `src/theme/themes/createThemes.js` 的 `emo` 项，修改后需要重新生成：

```bash
npm run build:theme
```

默认主题在 `src/config/defaultSetting.ts` 的 `theme.id / lightId / darkId`。
