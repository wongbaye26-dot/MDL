package cn.toside.music.mobile.dirpicker;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.MediaStore;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

/**
 * 目录选择器的 JS 入口。
 *
 * 真正干活的是 DirectoryPickerActivity（透明代理），结果通过 "DirectoryPicked" 事件回传，
 * 不依赖 ActivityEventListener —— RNN 不会转发 onActivityResult，那条路走不通。
 */
public class DirectoryPickerModule extends ReactContextBaseJavaModule {
  private static ReactApplicationContext sContext;

  DirectoryPickerModule(ReactApplicationContext reactContext) {
    super(reactContext);
    sContext = reactContext;
  }

  @Override
  public String getName() {
    return "DirectoryPicker";
  }

  /** 打开选择器（结果走事件，不需要 Promise） */
  @ReactMethod
  public void pick(Promise promise) {
    Activity activity = getCurrentActivity();
    if (activity == null) {
      promise.reject("no_activity", "当前没有可用的 Activity");
      return;
    }
    try {
      activity.startActivity(new Intent(activity, DirectoryPickerActivity.class));
      promise.resolve(true);
    } catch (Exception e) {
      promise.reject("start_failed", e);
    }
  }

  /**
   * 用 MediaStore 查某个目录下的音频文件。
   *
   * Android 11+ 的分区存储下，普通应用对 /storage/emulated/0/xxx 这种目录
   * 只能「知道存在」但不能 listFiles()（File.canRead() 返回 false），
   * 所以不能再用文件系统递归扫描。MediaStore 是系统索引，按 DATA 前缀过滤即可，
   * 拿到路径后配合 READ_MEDIA_AUDIO 可以直接读文件。
   */
  @ReactMethod
  public void listAudio(String prefix, Promise promise) {
    Cursor cursor = null;
    try {
      String normalized = prefix.endsWith("/") ? prefix.substring(0, prefix.length() - 1) : prefix;
      Uri uri = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
      String[] projection = new String[] {
          MediaStore.Audio.Media.DATA,
          MediaStore.Audio.Media.DISPLAY_NAME,
          MediaStore.Audio.Media.SIZE,
          MediaStore.Audio.Media.DATE_MODIFIED,
          MediaStore.Audio.Media.TITLE,
          MediaStore.Audio.Media.ARTIST,
          MediaStore.Audio.Media.ALBUM,
          MediaStore.Audio.Media.DURATION,
      };
      String selection = MediaStore.Audio.Media.DATA + " LIKE ?";
      String[] args = new String[] { normalized + "/%" };
      cursor = getReactApplicationContext().getContentResolver()
          .query(uri, projection, selection, args, null);

      WritableArray arr = Arguments.createArray();
      if (cursor != null) {
        while (cursor.moveToNext()) {
          String path = cursor.getString(0);
          if (path == null) continue;
          WritableMap map = Arguments.createMap();
          map.putString("path", path);
          map.putString("name", cursor.getString(1));
          map.putDouble("size", cursor.getLong(2));
          // DATE_MODIFIED 是秒
          map.putDouble("mtime", cursor.getLong(3) * 1000.0);
          // 系统索引里就有标题/歌手/专辑/时长，不用再去读文件标签
          // （分区存储下公共目录的文件是读不了的）
          map.putString("title", cursor.getString(4));
          map.putString("artist", cursor.getString(5));
          map.putString("album", cursor.getString(6));
          map.putDouble("duration", cursor.getLong(7));
          arr.pushMap(map);
        }
      }
      promise.resolve(arr);
    } catch (Exception e) {
      promise.reject("query_failed", e);
    } finally {
      if (cursor != null) cursor.close();
    }
  }

  /** Activity 回传结果：path 为 null 表示用户取消 */
  static void emitResult(String path, String name, String error) {
    if (sContext == null || !sContext.hasActiveReactInstance()) return;
    WritableMap map = Arguments.createMap();
    if (error != null) map.putString("error", error);
    else if (path != null) {
      map.putString("path", path);
      map.putString("name", name);
    }
    sContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
        .emit("DirectoryPicked", map);
  }

  static void emitError(String code, String message) {
    emitResult(null, null, message == null ? code : message);
  }
}
