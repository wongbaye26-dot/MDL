package cn.emomusic.mobile.download;

import android.media.MediaScannerConnection;
import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.ReadableMapKeySetIterator;
import com.facebook.react.bridge.WritableMap;

import java.io.File;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 下载模块，供 JS 层调度。
 * 只负责单个文件的下载（含断点续传），队列、换源、标签写入等逻辑都在 JS 层。
 */
public class DownloadModule extends ReactContextBaseJavaModule {
  private static final String TAG = "LxDownload";

  private final ReactApplicationContext reactContext;
  private final DownloadEvent event;
  private final Map<String, DownloadTask> tasks = new ConcurrentHashMap<>();

  private int listenerCount = 0;

  DownloadModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;
    this.event = new DownloadEvent(reactContext);
  }

  @Override
  public String getName() {
    return "DownloadModule";
  }

  @ReactMethod
  public void addListener(String eventName) {
    listenerCount += 1;
  }

  @ReactMethod
  public void removeListeners(Integer count) {
    listenerCount -= count;
    if (listenerCount < 0) listenerCount = 0;
  }

  /**
   * 开始一个下载任务
   * opts: { id, url, path, headers, threads }
   * threads：分段下载的并发连接数（1~4），服务端不支持 Range 时原生会自动回落单连接
   */
  @ReactMethod
  public void startTask(ReadableMap opts) {
    String id = opts.getString("id");
    String url = opts.getString("url");
    String path = opts.getString("path");
    if (id == null || url == null || path == null) return;

    int threads = 3;
    if (opts.hasKey("threads") && !opts.isNull("threads")) {
      try {
        threads = opts.getInt("threads");
      } catch (Exception ignored) {
      }
    }

    Map<String, String> headers = new HashMap<>();
    if (opts.hasKey("headers") && !opts.isNull("headers")) {
      ReadableMap headerMap = opts.getMap("headers");
      if (headerMap != null) {
        ReadableMapKeySetIterator iterator = headerMap.keySetIterator();
        while (iterator.hasNextKey()) {
          String key = iterator.nextKey();
          String value = headerMap.getString(key);
          if (value != null) headers.put(key, value);
        }
      }
    }

    DownloadTask existTask = tasks.get(id);
    if (existTask != null) {
      if (existTask.isRunning()) {
        Log.d(TAG, "task already running: " + id);
        return;
      }
      tasks.remove(id, existTask);
    }

    File file = new File(path);
    File parent = file.getParentFile();
    if (parent != null && !parent.exists() && !parent.mkdirs()) {
      event.error(id, -1, "create dir failed: " + parent.getAbsolutePath(), 0);
      return;
    }

    final DownloadTask[] holder = new DownloadTask[1];
    DownloadTask task = new DownloadTask(id, url, path, headers, event, () -> {
      DownloadTask current = holder[0];
      if (current != null) tasks.remove(id, current);
    }, reactContext.getApplicationContext(), threads);
    holder[0] = task;
    tasks.put(id, task);
    task.start();
  }

  @ReactMethod
  public void pauseTask(String id) {
    DownloadTask task = tasks.get(id);
    if (task == null) return;
    // 任务在下载线程结束后会自行从 tasks 中移除
    task.pause();
  }

  @ReactMethod
  public void removeTask(String id) {
    DownloadTask task = tasks.get(id);
    if (task == null) return;
    task.cancel();
    tasks.remove(id);
  }

  @ReactMethod
  public void pauseAll() {
    for (Map.Entry<String, DownloadTask> entry : tasks.entrySet()) {
      entry.getValue().pause();
    }
    tasks.clear();
  }

  /**
   * 获取任务当前已下载大小与文件总大小（用于恢复上次进度）
   */
  @ReactMethod
  public void getTaskInfo(String id, String path, Promise promise) {
    try {
      File tempFile = new File(path + ".part");
      File targetFile = new File(path);
      long downloaded = tempFile.exists() ? tempFile.length() : (targetFile.exists() ? targetFile.length() : 0);
      WritableMap map = Arguments.createMap();
      map.putString("id", id);
      map.putDouble("downloaded", downloaded);
      map.putBoolean("isCompleted", !tempFile.exists() && targetFile.exists() && targetFile.length() > 0);
      promise.resolve(map);
    } catch (Exception e) {
      promise.reject("error", e);
    }
  }

  /**
   * 判断任务是否还在原生层运行
   */
  @ReactMethod
  public void isTaskRunning(String id, Promise promise) {
    DownloadTask task = tasks.get(id);
    promise.resolve(task != null && task.isRunning());
  }

  /**
   * 把某个已落盘的文件交给系统媒体库索引。
   *
   * 主要给 JS 层在「SAF 目录复制完成 / 私有目录迁移回公共目录」之后调用：
   * 这些路径的写入不走 DownloadTask，没人触发扫描的话 MediaStore 里就没有记录，
   * 重新扫描本地音乐时就会漏掉刚下好的歌。
   *
   * 应用专属目录系统不索引，直接返回 false。
   */
  @ReactMethod
  public void scanFile(String path, Promise promise) {
    if (path == null || path.isEmpty()) {
      promise.resolve(false);
      return;
    }
    // 只处理外部存储上的普通路径：content:// 交给 SAF 枚举，私有目录系统不索引
    if (!path.startsWith("/storage/")) {
      promise.resolve(false);
      return;
    }
    if (path.contains("/Android/data/") || path.contains("/Android/obb/")) {
      promise.resolve(false);
      return;
    }
    try {
      File file = new File(path);
      if (!file.exists()) {
        promise.resolve(false);
        return;
      }
      MediaScannerConnection.scanFile(reactContext, new String[] { path }, null, null);
      promise.resolve(true);
    } catch (Exception e) {
      Log.w(TAG, "scanFile failed: " + e.getMessage());
      promise.resolve(false);
    }
  }

  @ReactMethod
  public void destroy() {
    pauseAll();
  }
}
