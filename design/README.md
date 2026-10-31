# EMO音乐 · 品牌与界面资产

本目录存放 EMO音乐 的品牌资产与设计稿源文件。

## 资产清单

| 文件 | 用途 |
| --- | --- |
| `EMO-UI-Design.html` | 界面设计方案（设计令牌、关键界面、交互规范），浏览器直接打开 |
| `logo.html` | LOGO 矢量源文件（SVG，1024×1024） |
| `icon-1024.png` | 主图标（满版，用作自适应图标前景） |
| `icon-squircle.png` | 圆角版图标（用于旧版启动图标、应用内展示） |
| `icon-round.png` | 圆形版图标（`ic_launcher_round`） |
| `gradient.html` / `emo-header.png` | 下载页头部渐变背景 |

## 品牌定义

- 名称：EMO音乐（英文 EMO Music）
- Slogan：深夜下载 · 情绪收藏
- LOGO 概念：字母 **E** 的三条横线，中间一条断成心电图波形 —— 音乐是情绪的波形
- 主色：`#A855F7`（紫）；强调色 `#EC4899`（粉）；底色 `#0B0B12`（深空黑）
- 渐变：`#A78BFA → #8B5CF6 → #EC4899`（135°）

## 重新生成图标

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
