// 修补依赖源码以使构建的依赖恢复正常工作

const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const rootPath = path.join(__dirname, './')

const patchs = [
  // ---- react-native-sqlite-2（A-2 曲库存储 PoC）----
  // AGP 8 要求 library 显式声明 namespace，且 AndroidManifest 里的 package 属性
  // 已被禁止；上游 3.6.3 仍是 AGP4 写法，这里在安装后补两处。
  [
    path.join(rootPath, 'node_modules/react-native-sqlite-2/android/build.gradle'),
    'android {',
    'android {\n  namespace "dog.craftz.sqlite_2"',
  ],
  [
    path.join(rootPath, 'node_modules/react-native-sqlite-2/android/src/main/AndroidManifest.xml'),
    ' package="dog.craftz.sqlite_2"',
    '',
  ],
  // 这两个 fork 的 package.json 把 types 指到了不存在的 lib/typescript/src/index.d.ts，
  // 导致 utils/fs.ts 和 localMediaMetadata.ts 整层没有类型（TS2307 + 一串隐式 any）。
  // 源码本身是 TS，直接指向 src/index.ts 即可。
  [
    path.join(rootPath, 'node_modules/react-native-file-system/package.json'),
    '"types": "lib/typescript/src/index.d.ts"',
    '"types": "src/index.ts"',
  ],
  [
    path.join(rootPath, 'node_modules/react-native-local-media-metadata/package.json'),
    '"types": "lib/typescript/src/index.d.ts"',
    '"types": "src/index.ts"',
  ],
  // 上游的 Metadata.java 没读采样率，本地音乐列表的「44.1 kHz」就没数据源。
  // 补一行，把 jaudiotagger 拿到的采样率一起返回给 JS。
  [
    path.join(rootPath, 'node_modules/react-native-local-media-metadata/android/src/main/java/com/localmediametadata/Metadata.java'),
    '    params.putString("bitrate", audioHeader.getBitRate());',
    '    params.putString("bitrate", audioHeader.getBitRate());\n    params.putString("sampleRate", audioHeader.getSampleRate());',
  ],
  // ---- react-native-track-player 2.1.2：通知栏「收藏 / 循环」按钮 ----
  // 通知由库里的 MetadataManager 用 NotificationCompat + MediaStyle 构建，
  // service/MusicService.onStartCommand 拦截自定义 action 后 emit 事件回 JS。
  // 注意：这几个补丁都往 Java 源码里插代码，锚点是当前 2.1.2 的原文，
  // 升级依赖后如果锚点消失会打印「没找到锚点」而不是写出坏文件。
  [
    path.join(rootPath, 'node_modules/react-native-track-player/android/src/main/java/com/guichaguri/trackplayer/service/MusicService.java'),
    `public class MusicService extends HeadlessJsTaskService {

    MusicManager manager;`,
    `public class MusicService extends HeadlessJsTaskService {

    /* 通知栏自定义按钮的 Intent action。MetadataManager 用 PendingIntent.getService 把这两个
       action 发到本服务，在 onStartCommand 里拦截后转成 JS 事件（remote-favorite / remote-loop），
       不启动 headless task。 */
    public static final String ACTION_FAVORITE = "cn.emomusic.mobile.NOTIFY_FAVORITE";
    public static final String ACTION_LOOP = "cn.emomusic.mobile.NOTIFY_LOOP";

    MusicManager manager;`,
  ],
  [
    path.join(rootPath, 'node_modules/react-native-track-player/android/src/main/java/com/guichaguri/trackplayer/service/MusicService.java'),
    `    public int onStartCommand(Intent intent, int flags, int startId) {
        if(intent != null && Intent.ACTION_MEDIA_BUTTON.equals(intent.getAction())) {`,
    `    public int onStartCommand(Intent intent, int flags, int startId) {
        if(intent != null) {
            String action = intent.getAction();

            // 通知栏「收藏 / 循环」按钮：只把事件转给 JS（走 LocalBroadcast），
            // 不能落到下面的 super.onStartCommand，否则会拉起 headless task
            if(ACTION_FAVORITE.equals(action) || ACTION_LOOP.equals(action)) {
                emit(ACTION_FAVORITE.equals(action) ? "remote-favorite" : "remote-loop", null);

                // 服务本来没在播放（没有 manager）：别留下一个空的前台通知
                if(manager == null) stopSelf();

                return START_NOT_STICKY;
            }
        }

        if(intent != null && Intent.ACTION_MEDIA_BUTTON.equals(intent.getAction())) {`,
  ],
  [
    path.join(rootPath, 'node_modules/react-native-track-player/android/src/main/java/com/guichaguri/trackplayer/service/metadata/MetadataManager.java'),
    '    private Action previousAction, rewindAction, playAction, pauseAction, stopAction, forwardAction, nextAction;',
    `    private Action previousAction, rewindAction, playAction, pauseAction, stopAction, forwardAction, nextAction;

    // 通知栏自定义按钮（收藏 / 循环），只出现在展开视图
    private Action favoriteAction, loopAction;
    // 记录当前播放状态：updateOptions 刷新图标后要重建动作列表
    private boolean playing = false;`,
  ],
  [
    path.join(rootPath, 'node_modules/react-native-track-player/android/src/main/java/com/guichaguri/trackplayer/service/metadata/MetadataManager.java'),
    `        // Update the color
        builder.setColor(Utils.getInt(options, "color", NotificationCompat.COLOR_DEFAULT));`,
    `        // 通知栏「收藏 / 循环」自定义按钮。图标由 JS 按当前收藏状态 / 播放模式
        // 通过 updateOptions 传 drawable 资源名过来（app 包名下的资源，native 里 getIdentifier 解析）
        favoriteAction = createCustomAction(options, "favoriteIcon", "favoriteTitle", "收藏", MusicService.ACTION_FAVORITE);
        loopAction = createCustomAction(options, "loopIcon", "loopTitle", "播放模式", MusicService.ACTION_LOOP);

        // Update the color
        builder.setColor(Utils.getInt(options, "color", NotificationCompat.COLOR_DEFAULT));`,
  ],
  [
    path.join(rootPath, 'node_modules/react-native-track-player/android/src/main/java/com/guichaguri/trackplayer/service/metadata/MetadataManager.java'),
    `        // Update the rating type
        ratingType = Utils.getInt(options, "ratingType", RatingCompat.RATING_NONE);
        session.setRatingType(ratingType);

        updateNotification();
    }`,
    `        // Update the rating type
        ratingType = Utils.getInt(options, "ratingType", RatingCompat.RATING_NONE);
        session.setRatingType(ratingType);

        // 重建动作列表：只改 builder 字段不会替换 builder.mActions 里已经加进去的
        // Action 对象，收藏/循环图标状态就刷不上去（配色变化同理，会走 updateNotification）
        updatePlayback(playing);
        updateNotification();
    }`,
  ],
  [
    path.join(rootPath, 'node_modules/react-native-track-player/android/src/main/java/com/guichaguri/trackplayer/service/metadata/MetadataManager.java'),
    `    @SuppressLint("RestrictedApi")
    public void updatePlayback(boolean playing) {
        List<Integer> compact = new ArrayList<>();
        builder.mActions.clear();`,
    `    @SuppressLint("RestrictedApi")
    public void updatePlayback(boolean playing) {
        this.playing = playing;
        List<Integer> compact = new ArrayList<>();
        builder.mActions.clear();`,
  ],
  [
    path.join(rootPath, 'node_modules/react-native-track-player/android/src/main/java/com/guichaguri/trackplayer/service/metadata/MetadataManager.java'),
    `        addAction(nextAction, PlaybackStateCompat.ACTION_SKIP_TO_NEXT, compact);

        // Prevent the media style from being used in older Huawei devices that don't support custom styles`,
    `        addAction(nextAction, PlaybackStateCompat.ACTION_SKIP_TO_NEXT, compact);

        // 收藏 / 循环按钮只放展开视图：compact 最多 3 个按钮，如果它们也进 compact
        // 会把「上一首 / 播放暂停 / 下一首」挤掉。MediaStyle 展开最多展示 5 个动作，
        // 现有标准动作 3 个 + 这两个刚好 5 个。
        if(favoriteAction != null) builder.mActions.add(favoriteAction);
        if(loopAction != null) builder.mActions.add(loopAction);

        // Prevent the media style from being used in older Huawei devices that don't support custom styles`,
  ],
  [
    path.join(rootPath, 'node_modules/react-native-track-player/android/src/main/java/com/guichaguri/trackplayer/service/metadata/MetadataManager.java'),
    `    private Action createAction(List<Integer> caps, long action, String title, int icon) {
        if(!caps.contains((int)action)) return null;`,
    `    /**
     * 解析 JS 传过来的 drawable 资源名（app 包，如 emo_notif_fav_filled）。
     * 库模块编译期拿不到 app 的 R.drawable，所以只能运行期按名字查；查不到时退回默认图标。
     */
    private int getNamedIcon(Bundle options, String propertyName, int defaultIcon) {
        String name = options.getString(propertyName);
        if(name == null || name.isEmpty()) return defaultIcon;

        int icon = service.getResources().getIdentifier(name, "drawable", service.getApplicationContext().getPackageName());
        return icon == 0 ? defaultIcon : icon;
    }

    /**
     * 创建通知栏自定义按钮（收藏 / 循环）：PendingIntent.getService 指回 MusicService，
     * MusicService.onStartCommand 拦截对应 action 后 emit 成 JS 事件。
     */
    private Action createCustomAction(Bundle options, String iconKey, String titleKey, String defaultTitle, String intentAction) {
        int icon = getNamedIcon(options, iconKey, R.drawable.play);

        String title = options.getString(titleKey);
        if(title == null || title.isEmpty()) title = defaultTitle;

        Intent intent = new Intent(service, MusicService.class);
        intent.setAction(intentAction);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if(Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;

        // requestCode 用 action 的 hash 区分两个按钮，避免两个 PendingIntent 互相覆盖
        PendingIntent pendingIntent = PendingIntent.getService(service, intentAction.hashCode(), intent, flags);

        return new Action(icon, title, pendingIntent);
    }

    private Action createAction(List<Integer> caps, long action, String title, int icon) {
        if(!caps.contains((int)action)) return null;`,
  ],
  // ---- react-native-track-player 2.1.2：标准媒体按钮也用 app drawable 资源名 ----
  // 通知栏 / 锁屏大播放器默认用库内置 PNG（previous/play/pause/next），与收藏 / 循环的
  // Material 矢量图标风格不一致。扩展 getIcon：options 里同名 key 是字符串
  // （如 previousIcon='emo_media_previous'）时按 app 包资源名解析，失败回退默认图标。
  [
    path.join(rootPath, 'node_modules/react-native-track-player/android/src/main/java/com/guichaguri/trackplayer/service/metadata/MetadataManager.java'),
    `    private int getIcon(Bundle options, String propertyName, int defaultIcon) {
        if(!options.containsKey(propertyName)) return defaultIcon;

        Bundle bundle = options.getBundle(propertyName);`,
    `    private int getIcon(Bundle options, String propertyName, int defaultIcon) {
        if(!options.containsKey(propertyName)) return defaultIcon;

        // JS 直接传 drawable 资源名（如 emo_media_previous）时按 app 包资源解析，
        // 让通知栏 / 锁屏大播放器的标准媒体按钮与收藏 / 循环按钮共用同一套 Material 矢量图标
        if(options.get(propertyName) instanceof String) {
            return getNamedIcon(options, propertyName, defaultIcon);
        }

        Bundle bundle = options.getBundle(propertyName);`,
  ],
  // ---- 任务31：锁屏大播放器「上一首」改自定义 notification action ----
  // 标准 media action（MediaButtonReceiver broadcast）在三星等锁屏大播放器上被画成
  // 圆角方块，而收藏 / 循环这些自定义 action 是圆形。把上一首也改成
  // createCustomAction + PendingIntent.getService -> MusicService.onStartCommand
  // emit("remote-previous")，并占 mActions 第 0 位 / compact 第 0 位，
  // 这样它与其它按钮走同一种渲染路径；媒体会话的 SkipToPrevious 能力仍保留（耳机上一曲）。
  [
    path.join(rootPath, 'node_modules/react-native-track-player/android/src/main/java/com/guichaguri/trackplayer/service/MusicService.java'),
    `    MusicManager manager;
    Handler handler;`,
    `    MusicManager manager;
    Handler handler;

    /** 通知栏「上一首」自定义按钮 action（与收藏/循环一样由 PendingIntent.getService 触发） */
    public static final String ACTION_PREVIOUS = "cn.emomusic.mobile.NOTIFY_PREVIOUS";`,
  ],
  [
    path.join(rootPath, 'node_modules/react-native-track-player/android/src/main/java/com/guichaguri/trackplayer/service/MusicService.java'),
    `        manager = new MusicManager(this);
        handler = new Handler();`,
    `        // 通知栏「上一首」自定义按钮：和收藏/循环一样由 PendingIntent.getService 触发，
        // 只把事件转给 JS（remote-previous，JS 侧已有的 RemotePrevious/playPrev 监听会处理），
        // 不启动 headless task
        if(intent != null && ACTION_PREVIOUS.equals(intent.getAction())) {
            emit("remote-previous", null);

            // 服务本来没在播放（没有 manager）：别留下一个空的前台通知
            if(manager == null) stopSelf();

            return START_NOT_STICKY;
        }

        manager = new MusicManager(this);
        handler = new Handler();`,
  ],
  [
    path.join(rootPath, 'node_modules/react-native-track-player/android/src/main/java/com/guichaguri/trackplayer/service/metadata/MetadataManager.java'),
    `    private Bitmap prevArtResource = null;

    private Action previousAction, rewindAction, playAction, pauseAction, stopAction, forwardAction, nextAction;`,
    `    private Bitmap prevArtResource = null;

    // 通知栏「上一首」自定义按钮（上一首不再走标准媒体 action，避免锁屏上被画成圆角方块）
    private Action previousCustomAction;

    private Action previousAction, rewindAction, playAction, pauseAction, stopAction, forwardAction, nextAction;`,
  ],
  [
    path.join(rootPath, 'node_modules/react-native-track-player/android/src/main/java/com/guichaguri/trackplayer/service/metadata/MetadataManager.java'),
    `    public void updateOptions(Bundle options) {
        List<Integer> capabilities = options.getIntegerArrayList("capabilities");`,
    `    public void updateOptions(Bundle options) {
        // 上一首也用自定义 action：图标/标题由 JS 传（previousIcon / previousTitle）
        previousCustomAction = createCustomAction(options, "previousIcon", "previousTitle", "上一首", MusicService.ACTION_PREVIOUS);

        List<Integer> capabilities = options.getIntegerArrayList("capabilities");`,
  ],
  [
    path.join(rootPath, 'node_modules/react-native-track-player/android/src/main/java/com/guichaguri/trackplayer/service/metadata/MetadataManager.java'),
    `        addAction(previousAction, PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS, compact);
        addAction(rewindAction, PlaybackStateCompat.ACTION_REWIND, compact);`,
    `        // 上一首用自定义 action 占第 0 位并进 compact：与收藏/循环同一种渲染方式，
        // 锁屏大播放器上才是圆形按钮；媒体会话的 SkipToPrevious 能力仍保留给耳机上一曲
        if(previousCustomAction != null) {
            compact.add(builder.mActions.size());
            builder.mActions.add(previousCustomAction);
        }
        addAction(rewindAction, PlaybackStateCompat.ACTION_REWIND, compact);`,
    // 后一条补丁会把上一首从通知动作里去掉；这一步视为已完成，避免再次插入
    '上一首交给 MediaSession 原生 transport',
  ],
  // ---- targetSdk 34+ / Android 16（API 36）兼容：react-native-track-player 2.1.2 ----
  // 1) targetSdk 31+ 起创建 PendingIntent 必须显式指定 FLAG_IMMUTABLE/FLAG_MUTABLE。
  //    库里的通知点击 Intent 没指定可变性，一播放就抛 IllegalArgumentException。
  // 2) targetSdk 34+ 起前台服务必须声明 foregroundServiceType（manifest 由 app 层合并），
  //    另外 targetSdk 31+ 后台启动前台服务可能抛 ForegroundServiceStartNotAllowedException。
  //    这两类异常都不能让 App 崩溃：通知/前台服务失败时降级为「只记日志」。
  // 锚点全部使用 2.1.2 上游原文，升级依赖后锚点消失会报错而不是写出坏文件。
  [
    path.join(rootPath, 'node_modules/react-native-track-player/android/src/main/java/com/guichaguri/trackplayer/service/MusicService.java'),
    `import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;`,
    `import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.util.Log;`,
  ],
  [
    path.join(rootPath, 'node_modules/react-native-track-player/android/src/main/java/com/guichaguri/trackplayer/service/MusicService.java'),
    `    @Override
    public void onCreate() {
        super.onCreate();
        String channel = Utils.getNotificationChannel(this);
        startForeground(1, new NotificationCompat.Builder(this, channel).build());
    }`,
    `    @Override
    public void onCreate() {
        super.onCreate();
        // targetSdk 31+：后台拉起前台服务可能抛 ForegroundServiceStartNotAllowedException；
        // targetSdk 34+：服务没有声明 foregroundServiceType 会抛 MissingForegroundServiceTypeException。
        // 这两类异常都不能让进程崩掉，失败时只记日志并结束服务。
        try {
            startForegroundWithNotification(Utils.getNotificationChannel(this));
        } catch(Exception e) {
            Log.e(Utils.LOG, "MusicService.onCreate startForeground failed", e);
            stopSelf();
        }
    }

    /**
     * 启动前台服务。Android 10+ 显式带上 mediaPlayback 类型（manifest 里也声明了，
     * 见 app 的 AndroidManifest.xml：Android 14+ 缺类型会直接抛异常）。
     */
    private void startForegroundWithNotification(String channel) {
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channel);
        if(Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(1, builder.build(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(1, builder.build());
        }
    }`,
  ],
  [
    path.join(rootPath, 'node_modules/react-native-track-player/android/src/main/java/com/guichaguri/trackplayer/service/MusicService.java'),
    `                // Sets the service to foreground with an empty notification
                startForeground(1, new NotificationCompat.Builder(this, channel).build());
                // Stops the service right after
                stopSelf();`,
    `                // Sets the service to foreground with an empty notification
                // 这里通常发生在 App 退到后台（没有 React Activity）时，targetSdk 31+ 可能抛
                // ForegroundServiceStartNotAllowedException；targetSdk 34+ 还可能缺 FGS 类型。
                // 统一兜底：失败只记日志，服务马上结束，不影响 App 其它逻辑。
                try {
                    startForegroundWithNotification(channel);
                } catch(Exception e) {
                    Log.e(Utils.LOG, "MusicService.onStartForeground startForeground failed", e);
                }
                // Stops the service right after
                stopSelf();`,
  ],
  [
    path.join(rootPath, 'node_modules/react-native-track-player/android/src/main/java/com/guichaguri/trackplayer/service/metadata/MetadataManager.java'),
    `import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;`,
    `import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;`,
  ],
  [
    path.join(rootPath, 'node_modules/react-native-track-player/android/src/main/java/com/guichaguri/trackplayer/service/metadata/MetadataManager.java'),
    `import android.os.Build;
import android.os.Bundle;`,
    `import android.os.Build;
import android.os.Bundle;
import android.util.Log;`,
  ],
  [
    path.join(rootPath, 'node_modules/react-native-track-player/android/src/main/java/com/guichaguri/trackplayer/service/metadata/MetadataManager.java'),
    '        builder.setContentIntent(PendingIntent.getActivity(context, 0, openApp, PendingIntent.FLAG_CANCEL_CURRENT));',
    `        // targetSdk 31+（Android 12）起 PendingIntent 必须显式指定可变性，
        // 否则 PendingIntent.getActivity 抛 IllegalArgumentException，一播放就崩。
        // 保留 FLAG_CANCEL_CURRENT 的语义：通知点击 Intent 需要能更新数据。
        int contentIntentFlags = PendingIntent.FLAG_CANCEL_CURRENT;
        if(Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) contentIntentFlags |= PendingIntent.FLAG_IMMUTABLE;
        builder.setContentIntent(PendingIntent.getActivity(context, 0, openApp, contentIntentFlags));`,
  ],
  [
    path.join(rootPath, 'node_modules/react-native-track-player/android/src/main/java/com/guichaguri/trackplayer/service/metadata/MetadataManager.java'),
    `        if(session.isActive()) {
            service.startForeground(1, builder.build());
        } else {
            service.stopForeground(true);
        }`,
    `        if(session.isActive()) {
            // targetSdk 31+ / 34+：FGS 启动失败（后台启动限制 / 通知权限 / 类型缺失）不能崩，
            // 通知更新失败只影响通知栏展示，播放本身继续。
            try {
                if(Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    service.startForeground(1, builder.build(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
                } else {
                    service.startForeground(1, builder.build());
                }
            } catch(Exception e) {
                Log.w(Utils.LOG, "MetadataManager.updateNotification startForeground failed", e);
            }
        } else {
            service.stopForeground(true);
        }`,
  ],
  // ---- react-native-linear-gradient 2.8.3：AGP8 namespace ----
  // 上游 2.8.3 没有 namespace（AGP 8 会报错），本地手工补过但没进这个脚本；
  // 全新 npm install 时如果不补，构建会失败。RNGP 0.76 对「manifest 有 package」的库
  // 会自动注入 namespace，但这里显式补更稳（也避免依赖 RNGP 的实现细节）。
  [
    path.join(rootPath, 'node_modules/react-native-linear-gradient/android/build.gradle'),
    'android {',
    "android {\n    // AGP 8 起必须显式声明 namespace（上游 2.8.3 还没加）\n    namespace 'com.BV.LinearGradient'",
    "namespace 'com.BV.LinearGradient'",
  ],
]

;(async() => {
  // --strict：补丁没打上就以非零码退出（发版流程用）。
  // 默认（postinstall）只警告——npm install 阶段因为一个锚点失配就中断太激进。
  const strict = process.argv.includes('--strict')
  const failures = []
  for (const [filePath, fromStr, toStr, skipIf] of patchs) {
    const label = filePath.replace(rootPath, '')
    try {
      const file = (await fs.promises.readFile(filePath)).toString()
      // 幂等：已经打过就跳过。否则像「在 bitrate 后面加一行 sampleRate」这种补丁，
      // 每跑一次就多插一行（实测跑三次就变成三行重复）。
      if ((skipIf && file.includes(skipIf)) || file.includes(toStr)) {
        console.log(`Skipping ${label}（已打过）`)
        continue
      }
      if (!file.includes(fromStr)) {
        failures.push(`${label}：没找到锚点（上游可能改了）`)
        continue
      }
      await fs.promises.writeFile(filePath, file.replace(fromStr, toStr))
      console.log(`Patched ${label}`)
    } catch (err) {
      failures.push(`${label}：${err.message}`)
    }
  }
  if (failures.length) {
    console.error('\n以下补丁未生效：')
    for (const f of failures) console.error('  - ' + f)
    if (strict) {
      console.error('\n严格模式：补丁未全部生效，终止。\n')
      process.exit(1)
    }
    console.error('\n（非严格模式，继续；发版请用 node dependencies-patch.js --strict）\n')
    return
  }
  // track-player 的 lib/ 是 Git 忽略的构建产物（main 指向 lib/index.js）。
  // setup-vendor 去掉了它的 prepare（`rimraf lib && tsc` 在干净环境会因根依赖未就绪而失败），
  // 这里在依赖装完后用根项目的 tsc 补生成，保证 Metro 打包与 tsc 类型检查都能解析到。
  const trackPlayerDir = path.join(rootPath, 'node_modules/react-native-track-player')
  const trackPlayerLib = path.join(trackPlayerDir, 'lib', 'index.js')
  const trackPlayerTsconfig = path.join(trackPlayerDir, 'tsconfig.json')
  const localTsc = path.join(rootPath, 'node_modules', 'typescript', 'bin', 'tsc')
  if (
    fs.existsSync(trackPlayerLib) ||
    !fs.existsSync(trackPlayerTsconfig) ||
    !fs.existsSync(localTsc)
  ) {
    // 已构建 / 不是 file: 装法（没有 tsconfig）/ 还没装 typescript → 跳过
  } else {
    console.log('Building react-native-track-player lib (tsc) …')
    try {
      execFileSync(process.execPath, [localTsc, '-p', trackPlayerDir], { stdio: 'inherit' })
      console.log('  ✓ lib/ 已生成')
    } catch (err) {
      console.error(`  ✗ track-player lib 构建失败：${err.message}`)
      if (strict) process.exit(1)
    }
  }

  console.log('\nDependencies patch finished.\n')
})()

