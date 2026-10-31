package cn.toside.music.mobile.download;

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
   * opts: { id, url, path, headers }
   */
  @ReactMethod
  public void startTask(ReadableMap opts) {
    String id = opts.getString("id");
    String url = opts.getString("url");
    String path = opts.getString("path");
    if (id == null || url == null || path == null) return;

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
    });
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

  @ReactMethod
  public void destroy() {
    pauseAll();
  }
}
