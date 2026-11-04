<p align="center"><img width="120" src="doc/images/icon.png" alt="EMO 音乐"></p>

<h1 align="center">EMO 音乐</h1>

<p align="center">一个以 Material You 为设计语言的本地 + 在线音乐播放器</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-Android-3DDC84" alt="Platform">
  <img src="https://img.shields.io/badge/react--native-0.73-61DAFB" alt="React Native">
  <img src="https://img.shields.io/badge/version-3.6.3-FF6B9D" alt="Version">
</p>

---

## 这是什么

EMO 音乐是一个 Android 音乐播放器，支持**本地曲库**和**在线音源**（酷我 / 酷狗 / 企鹅 / 网易 / 咪咕）。

界面以 **Material You** 为基准重新设计：磨砂玻璃胶囊、动态取色、圆形封面、大圆角。播放器支持横竖屏双布局，手势与动效都按手机端重新调过。

> 本项目基于 [lx-music-mobile](https://github.com/lyswhut/lx-music-mobile) 二次开发，音源与数据层沿用上游实现，UI 与交互做了大规模重做。感谢原作者 [lyswhut](https://github.com/lyswhut) 的开源工作。

### 安装包隔离（v3.6.0 起）

- 包名：`cn.emomusic.mobile`；桌面名称：**Emo音乐**
- 签名：独立 release 密钥（`android/app/emomusic-release.keystore`），与 lxmusic 官方包/旧 EMO 包不同
- 因此新旧包**可以共存**、数据互不可见；新包首次安装后需要重新导入本地音乐、重新配置音源
- 本地音频文件仍在手机存储中，重新扫描原目录即可；旧包确认迁移完成后再卸载


---

## 功能

### 播放

- 本地音乐 + 在线音源统一播放
- **播放队列**：顶部切播放模式 / 清空，行内删单曲，当前播放高亮
- 进度条支持**拖动跳转**
- 歌词页：逐行高亮、字号可调、支持桌面歌词
- 歌名过长自动**跑马灯滚动**

### 本地音乐

- 支持多文件夹导入（SAF），扫描后离线播放
- 列表三行式：歌名 / 歌手-专辑 / 时长·格式·采样率·码率
- **下载完成的歌曲自动收进曲库**，不用手动重扫
- 支持按文件夹 / 专辑 / 艺人分类，最近添加

### 首页

- 「最近播放」保留最近 20 首，标注**本地 / 在线**
- 「最近添加」横向歌曲流
- 排行榜、歌单广场、下载中心、本地音乐四张入口卡片

### 排行榜 / 歌单

- 多音源榜单切换，当前榜单压成标题右侧的小卡片
- 歌单广场支持导入歌单
- 长按列表进入多选：模式 / 全选 / 取消，操作条在**标题右侧**，不遮挡列表

### 横屏

- 左侧悬浮胶囊导航，右侧内容区
- 播放器横屏：封面满出血占左半屏 + 右半屏歌词与控件
- 底部迷你播放器与导航同一套玻璃质感

---

## 设计细节

| 元素 | 做法 |
|---|---|
| 底部导航 | 59dp 高玻璃胶囊，无描边，选中项 52dp 圆形实心底 + 线性图标 |
| 播放进度 | 贴着胶囊边缘的四层柔光 + 呼吸动画 |
| 播放器转场 | 从圆盘展开：小圆 → 大圆 → 铺满封面，收起时反向 |
| 磨砂 | 真高斯模糊 + 主题色调叠加 |
| 主题色 | 从封面取色，落到 Material You 的 `c-primary` 体系 |

---

## 构建

### 环境

- Node.js 18+
- JDK 17
- Android SDK 34
- React Native 0.73

### 步骤

```bash
# 安装依赖
npm install

# 构建 release APK
cd android && ./gradlew assembleRelease

# 产物在 android/app/build/outputs/apk/release/
```

按 ABI 拆分的产物：

- `em-music-v3.6.3-arm64-v8a.apk` —— 绝大多数现代手机
- `em-music-v3.6.3-universal.apk` —— 兼容所有架构

---

## 目录结构

```
src/
├── components/          通用组件（Glass / MarqueeText / MiniTag / CapsuleProgress …）
├── core/                业务核心（player / download / localMusic / list / search）
├── screens/
│   ├── Home/
│   │   ├── Vertical/    竖屏：BottomNav、PlayerTransition、PageModal、MiniPlayer
│   │   ├── Horizontal/  横屏：Aside 胶囊导航
│   │   └── Views/       各页面：Player / LocalMusic / Download / Leaderboard / SongList
│   └── SonglistDetail/  歌单详情（独立页面）
├── store/               状态（player / list / theme / search / setting）
├── theme/               主题与播放器取色
└── utils/               工具（selectionBar / playerTransition / windowSizeTools …）
```

---

## 已知限制

- 仅 Android，未适配 iOS
- 在线音源依赖第三方接口，可用性随上游变动
- 部分机型的系统媒体通知会遮挡播放器顶部标题区

---

## 协议

本项目遵循上游 [MIT](./LICENSE) 协议。

在线音源的所有内容版权归各平台所有，本软件仅提供播放能力，不存储任何音频资源。
