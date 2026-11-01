package cn.toside.music.mobile.dirpicker;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.provider.DocumentsContract;

import java.io.File;

/**
 * 透明代理 Activity，专门用来托管 SAF 目录选择器。
 *
 * 为什么不直接在 RN 模块里 startActivityForResult：
 * 本工程用的是 react-native-navigation，它的 NavigationActivity 没有把
 * onActivityResult 转发给 ReactContext 的 ActivityEventListener，
 * 所以 JS 侧的 Promise 永远等不到结果（实测：选择器能弹出，选完什么都不会发生）。
 *
 * 这里用一个自带 onActivityResult 的透明 Activity 接住结果，再通过事件回传 JS。
 */
public class DirectoryPickerActivity extends Activity {
  private static final int REQUEST_CODE = 0x4D55;
  private boolean launched = false;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    if (savedInstanceState == null) launch();
  }

  private void launch() {
    launched = true;
    Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
        | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
        | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
    try {
      startActivityForResult(intent, REQUEST_CODE);
    } catch (Exception e) {
      DirectoryPickerModule.emitError("start_failed", "打不开系统文件选择器：" + e.getMessage());
      finish();
    }
  }

  @Override
  protected void onActivityResult(int requestCode, int resultCode, Intent data) {
    super.onActivityResult(requestCode, resultCode, data);
    if (requestCode != REQUEST_CODE || !launched) return;
    launched = false;

    if (resultCode != RESULT_OK || data == null || data.getData() == null) {
      // 用户取消
      DirectoryPickerModule.emitResult(null, null, null);
      finish();
      return;
    }

    Uri uri = data.getData();
    try {
      getContentResolver().takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
    } catch (Exception ignored) {}

    String path = toFilePath(uri);
    if (path == null) {
      DirectoryPickerModule.emitError("unsupported", "这个目录解析不出本机路径（云盘/第三方网盘不支持）");
      finish();
      return;
    }

    // 注意：分区存储下 File.canRead() 对普通目录恒为 false，不能拿它当判据，
    // 真正的可读性由 MediaStore 查询结果决定（见 listAudio）。
    File dir = new File(path);
    if (!dir.exists()) {
      DirectoryPickerModule.emitError("not_found", "目录不存在：" + path);
      finish();
      return;
    }

    DirectoryPickerModule.emitResult(path, dir.getName(), null);
    finish();
  }

  @Override
  protected void onDestroy() {
    super.onDestroy();
    // 被系统回收等异常路径：保证 JS 侧的 Promise 不会一直挂着
    if (launched) {
      launched = false;
      DirectoryPickerModule.emitResult(null, null, null);
    }
  }

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
      root = "/storage/" + volume;
    } else {
      return null;
    }

    return relative.isEmpty() ? root : root + "/" + relative;
  }
}
