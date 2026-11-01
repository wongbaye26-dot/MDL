package cn.toside.music.mobile.dirpicker;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.provider.DocumentsContract;

import androidx.annotation.Nullable;

import com.facebook.react.bridge.ActivityEventListener;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;

import java.io.File;

/**
 * 系统目录选择器（SAF）。
 *
 * JS 侧只能拿到 content:// 的 tree uri，而 react-native-fs 只认文件系统路径，
 * 所以这里把 uri 的 docId 还原成真实路径：
 *   primary:Music/周杰伦  -> /storage/emulated/0/Music/周杰伦
 *   1234-ABCD:Music       -> /storage/1234-ABCD/Music
 * 云盘 / 第三方 provider 还原不了，直接 reject，让用户换一个目录。
 */
public class DirectoryPickerModule extends ReactContextBaseJavaModule implements ActivityEventListener {
  private static final int REQUEST_CODE = 0x4D55;
  private Promise pendingPromise;

  DirectoryPickerModule(ReactApplicationContext reactContext) {
    super(reactContext);
    reactContext.addActivityEventListener(this);
  }

  @Override
  public String getName() {
    return "DirectoryPicker";
  }

  @ReactMethod
  public void pick(Promise promise) {
    Activity activity = getCurrentActivity();
    if (activity == null) {
      promise.reject("no_activity", "当前没有可用的 Activity");
      return;
    }
    if (pendingPromise != null) {
      pendingPromise.reject("busy", "已经有一个选择器在打开了");
      pendingPromise = null;
    }
    pendingPromise = promise;

    Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
        | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
        | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
    try {
      activity.startActivityForResult(intent, REQUEST_CODE);
    } catch (Exception e) {
      pendingPromise = null;
      promise.reject("start_failed", e);
    }
  }

  @Override
  public void onActivityResult(Activity activity, int requestCode, int resultCode, @Nullable Intent data) {
    if (requestCode != REQUEST_CODE) return;
    Promise promise = pendingPromise;
    pendingPromise = null;
    if (promise == null) return;

    if (resultCode != Activity.RESULT_OK || data == null || data.getData() == null) {
      // 用户取消
      promise.resolve(null);
      return;
    }

    Uri uri = data.getData();
    try {
      activity.getContentResolver().takePersistableUriPermission(
          uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
    } catch (Exception ignored) {
      // 拿不到持久权限也没关系：路径本身是可读的就行
    }

    String path = toFilePath(uri);
    if (path == null) {
      promise.reject("unsupported", "这个目录解析不出本机路径（云盘/第三方网盘不支持）");
      return;
    }

    File dir = new File(path);
    if (!dir.exists() || !dir.isDirectory() || !dir.canRead()) {
      promise.reject("unreadable", "目录不可读：" + path + "\n请在系统设置里给本应用「音乐和音频」权限后重试");
      return;
    }

    WritableMap map = Arguments.createMap();
    map.putString("path", path);
    map.putString("name", dir.getName());
    promise.resolve(map);
  }

  @Override
  public void onNewIntent(Intent intent) {}

  /** tree uri -> 文件系统路径；解析不出来返回 null */
  private String toFilePath(Uri uri) {
    String docId;
    try {
      docId = DocumentsContract.getTreeDocumentId(uri);
    } catch (Exception e) {
      docId = null;
    }
    if (docId == null) return null;

    int idx = docId.indexOf(':');
    if (idx < 0) return null;

    String volume = docId.substring(0, idx);
    String relative = docId.substring(idx + 1);

    String root;
    if ("primary".equalsIgnoreCase(volume) || "home".equalsIgnoreCase(volume)) {
      root = "/storage/emulated/0";
    } else if (volume.matches("^[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}$")) {
      // SD 卡：卷标就是挂载点目录名
      root = "/storage/" + volume;
    } else {
      return null;
    }

    return relative.isEmpty() ? root : root + "/" + relative;
  }
}
