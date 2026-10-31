# 手机音乐下载器改造说明

本项目基于 [lx-music-mobile](https://github.com/lyswhut/lx-music-mobile) 改造，在原播放器的基础上补齐了**完整的下载能力**，定位为「下载为主 + 保留试听」的手机音乐下载器，并保留 LX 自定义音源（音源脚本）支持。

## 一、已实现能力

| 能力 | 说明 |
| --- | --- |
| 单曲 / 多选下载 | 在线列表、搜索结果、排行榜、我的列表中长按或点击「⋮」→ 下载 |
| 整张歌单下载 | 歌单详情页底部「下载全部」 |
| 批量队列 | 可配置并发数（1/2/3/5），自动排队，完成一个自动补位 |
| 音质选择 | 添加任务时弹窗选择音质，只显示当前音源实际支持的音质；选择会记忆到设置 |
| 自动换源 | 下载地址获取失败时自动在其它音源里找同名歌曲（可在设置关闭） |
| 断点续传 | 原生层以 HTTP Range 续传，中断后保留 `.part` 文件，重启应用后可继续 |
| 链接失效重试 | 401/403/404/410/416 时自动刷新下载地址重试（最多 2 次） |
| 歌词 / 封面 / 标签 | 下载同名 `.lrc`、把封面与「歌名/歌手/专辑」写入音频标签（需文件系统路径，SAF 目录下仅写 `.lrc`） |
| 保存目录 | 默认 `公共音乐目录/Music/LXMusic`；不可写时自动回退到应用专属目录；也可用系统目录选择器指定任意目录 |
| 文件名模板 | `歌名 - 歌手` / `歌手 - 歌名` / `歌名` |
| 下载中心 | 独立「下载」Tab：进度条、速度、状态、全部开始/暂停、清空已完成、单任务暂停/继续/重试/删除 |

LX 音源相关：任务创建时通过 `global.lx.qualityList[source]` 读取**当前音源脚本声明的音质列表**，并结合歌曲 `meta._qualitys` 做音质降级；URL 解析走原有 `handleGetOnlineMusicUrl` 管线，因此内置音源与自定义音源脚本（`user_api_*`）行为一致。

## 二、代码结构

### Android 原生层（新增）

```
android/app/src/main/java/cn/toside/music/mobile/download/
├── DownloadModule.java   // RN 模块：startTask / pauseTask / removeTask / getTaskInfo
├── DownloadTask.java     // 单任务下载线程：HttpURLConnection + Range 续传 + 进度上报
├── DownloadEvent.java    // 统一事件通道 download-event（start/progress/pause/complete/error）
└── DownloadPackage.java  // 注册到 MainApplication
```

要点：

- 下载先写入 `<文件名>.part`，完成后重命名为正式文件；服务端返回 200（不支持 Range）时自动从头开始。
- 进度事件按 500ms 节流，避免 JS 线程被高频事件打满。
- 任务线程结束后通过 `onFinish` 回调自行从任务表移除，避免「暂停后立刻重开」时新旧线程同时写同一个文件。

### JS 层（新增）

```
src/utils/nativeModules/download.ts    // 原生模块封装 + 事件订阅
src/core/download/
├── index.ts    // 队列调度、任务生命周期、换源、保存路径、持久化
├── utils.ts    // 音质/扩展名/文件名模板/路径工具
└── extras.ts   // 歌词、封面、标签写入
src/store/download/                     // state / action / event / hook（自定义事件式状态）
src/screens/Home/Views/Download/        // 下载页（DownloadPage.tsx + TaskItem/Toolbar/TaskMenu）
src/components/DownloadQualityModal/    // 音质选择弹窗
src/screens/Home/Views/Setting/settings/Download/  // 下载设置分组
```

### 改动的既有文件

- `src/config/constant.ts`：启用 `nav_download` 导航项；新增 `@download_list` 存储前缀。
- `src/config/defaultSetting.ts` + `src/types/download_setting.d.ts`：新增 `download.*` 设置项（用声明合并单独放一个 d.ts，避免动 360 行的 app_setting.d.ts）。
- `src/types/download_list.d.ts`：任务增加 `errorMessage` / `retryCount` / `createdAt` / `metadata.listId`。
- `src/utils/data.ts`：`getDownloadList` / `saveDownloadList`。
- `src/utils/fs.ts`：新增 `cpFile`（支持把文件复制到 SAF `content://` 目录）。
- `src/core/init/index.ts`：启动时恢复下载列表。
- `src/screens/Home/Vertical/Main.tsx`、`Horizontal/Main.tsx`：首页分页加入下载页。
- `src/components/OnlineList/*`、`src/screens/Home/Views/Mylist/MusicList/*`：列表菜单新增「下载」。
- `src/screens/SonglistDetail/ActionBar.tsx`：新增「下载全部」。
- `src/lang/*.json`：新增 `nav_download`、`download`、`download_all`、`setting_download*` 文案。

## 三、存储与权限说明

- 默认保存目录：`/storage/emulated/0/Music/LXMusic`（`Dirs.SDCardDir` + `/Music/LXMusic`）。
- 应用 `targetSdkVersion = 29` 且开启了 `requestLegacyExternalStorage`，因此公共目录写入在 Android 10/11/12/13 上通常可用。
- 若目标目录不可写（例如部分 ROM 限制），`getSavePath()` 会依次回退：
  1. 用户设置的目录（绝对路径）
  2. 默认公共目录
  3. `Android/data/cn.toside.music.mobile/files/Music`（应用专属目录，无需权限，但卸载即删）
- 用户通过系统目录选择器选中目录时，路径为 SAF `content://...` 树 URI：此时先下载到缓存目录，完成后用 `FileSystem.cp` 复制到目标目录（同目录下的文件无法直接写标签，因此标签写入会被跳过，`.lrc` 仍会写入）。

## 四、构建

```bash
npm install            # 注意：本项目依赖多个 git 仓库依赖，需要能访问 GitHub
cd android
./gradlew assembleRelease   # 或 assembleDebug
```

产物：`android/app/build/outputs/apk/release/`。

如果只需要 JS 侧改动热更新：

```bash
npm run start
npm run dev      # react-native run-android
```

## 五、已知限制 / 后续可做

1. **后台下载**：目前下载跑在普通线程里，App 进程被系统回收后会中断（`.part` 仍在，可续传）。若要真后台，需要加 `ForegroundService` + 通知栏进度（可复用 `react-native-track-player` 的 service 思路，或在原生层新起 service）。
2. **iOS 未适配**：`DownloadModule` 只有 Android 实现；iOS 下下载入口会提示「当前设备不支持下载」。
3. **SAF 目录不写标签**：受 jaudiotagger 只能处理真实路径限制，SAF 目录下只写 `.lrc`。
4. **文件名去重**：同名文件会被覆盖（非 SAF）或由系统生成 `xxx (1).mp3`（SAF）。
5. **下载页操作**：暂未支持「点击播放已下载文件」「打开所在目录」。
