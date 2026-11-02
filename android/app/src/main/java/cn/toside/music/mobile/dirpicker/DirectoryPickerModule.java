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
          MediaStore.Audio.Media._ID,
          MediaStore.Audio.Media.ALBUM_ID,
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
          // 列顺序：_ID, ALBUM_ID, DATA, DISPLAY_NAME, SIZE, DATE_MODIFIED, TITLE, ARTIST, ALBUM, DURATION
          String path = cursor.getString(2);
          if (path == null) continue;
          WritableMap map = Arguments.createMap();
          map.putString("path", path);
          map.putString("name", cursor.getString(3));
          map.putDouble("size", cursor.getLong(4));
          // DATE_MODIFIED 是秒
          map.putDouble("mtime", cursor.getLong(5) * 1000.0);
          // 系统索引里就有标题/歌手/专辑/时长，不用再去读文件标签
          // （分区存储下公共目录的文件是读不了的）
          map.putString("title", cursor.getString(6));
          map.putString("artist", cursor.getString(7));
          map.putString("album", cursor.getString(8));
          map.putDouble("duration", cursor.getLong(9));
          long id = cursor.getLong(0);
          long albumId = cursor.getLong(1);
          map.putDouble("id", id);
          map.putDouble("albumId", albumId);
          map.putString("contentUri",
              android.content.ContentUris.withAppendedId(uri, id).toString());
          if (albumId > 0) {
            map.putString("albumArt",
                "content://media/external/audio/albumart/" + albumId);
          }
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

  /**
   * 读采样率 / 码率 / 时长。
   *
   * MediaStore 的公开字段里没有采样率和码率，而公共目录的文件又不能用路径直接打开，
   * 所以用 MediaMetadataRetriever + content:// uri（系统授权）来读。
   */
  @ReactMethod
  public void readAudioMeta(String contentUri, Promise promise) {
    android.media.MediaMetadataRetriever retriever = new android.media.MediaMetadataRetriever();
    try {
      retriever.setDataSource(getReactApplicationContext(), Uri.parse(contentUri));
      WritableMap map = Arguments.createMap();
      String duration = retriever.extractMetadata(android.media.MediaMetadataRetriever.METADATA_KEY_DURATION);
      String bitrate = retriever.extractMetadata(android.media.MediaMetadataRetriever.METADATA_KEY_BITRATE);
      String sampleRate = retriever.extractMetadata(android.media.MediaMetadataRetriever.METADATA_KEY_SAMPLERATE);
      if (duration != null) map.putDouble("duration", Double.parseDouble(duration));
      if (bitrate != null) map.putDouble("bitrate", Double.parseDouble(bitrate));
      if (sampleRate != null) map.putDouble("sampleRate", Double.parseDouble(sampleRate));

      // 标签：SAF 枚举出来的文件没有系统索引，歌名/歌手/专辑只能从文件里读
      String title = retriever.extractMetadata(android.media.MediaMetadataRetriever.METADATA_KEY_TITLE);
      String artist = retriever.extractMetadata(android.media.MediaMetadataRetriever.METADATA_KEY_ARTIST);
      String album = retriever.extractMetadata(android.media.MediaMetadataRetriever.METADATA_KEY_ALBUM);
      if (title != null && !title.isEmpty()) map.putString("title", title);
      if (artist != null && !artist.isEmpty()) map.putString("artist", artist);
      if (album != null && !album.isEmpty()) map.putString("album", album);

      // 内嵌封面：写到缓存目录，JS 侧当普通图片路径用
      // （content://media/external/audio/albumart 在 Android 10+ 经常读不出来）
      byte[] picture = retriever.getEmbeddedPicture();
      if (picture != null && picture.length > 0) {
        java.io.File dir = new java.io.File(getReactApplicationContext().getCacheDir(), "local_cover");
        if (!dir.exists()) dir.mkdirs();
        java.io.File file = new java.io.File(dir, Integer.toHexString(contentUri.hashCode()) + ".img");
        java.io.FileOutputStream out = new java.io.FileOutputStream(file);
        out.write(picture);
        out.close();
        map.putString("cover", "file://" + file.getAbsolutePath());
      }
      promise.resolve(map);
    } catch (Exception e) {
      promise.reject("meta_failed", e);
    } finally {
      try { retriever.release(); } catch (Exception ignored) {}
    }
  }

  private static final java.util.Set<String> AUDIO_EXT = new java.util.HashSet<>(java.util.Arrays.asList(
      "mp3", "flac", "m4a", "aac", "wav", "ogg", "ape", "wma", "opus", "dsf", "dff"));

  /**
   * 用 SAF 枚举某个目录树下的音频文件。
   *
   * 为什么不只用 MediaStore：用户自己放进来的目录（比如从别的 App 下载的）
   * 系统不一定会索引，MediaStore 查不到就只能扫出 0 首。SAF 是「用户亲自授权过的目录」，
   * 可以直接列目录，不依赖系统索引。
   */
  @ReactMethod
  public void listTree(String treeUri, Promise promise) {
    try {
      Uri tree = Uri.parse(treeUri);
      String rootId = android.provider.DocumentsContract.getTreeDocumentId(tree);
      WritableArray arr = Arguments.createArray();
      walkTree(tree, rootId, arr, 0);
      promise.resolve(arr);
    } catch (Exception e) {
      promise.reject("list_tree_failed", e);
    }
  }

  private void walkTree(Uri tree, String parentDocId, WritableArray out, int depth) {
    if (depth > 3) return;
    Uri children = android.provider.DocumentsContract.buildChildDocumentsUriUsingTree(tree, parentDocId);
    Cursor cursor = null;
    try {
      cursor = getReactApplicationContext().getContentResolver().query(children, new String[] {
          android.provider.DocumentsContract.Document.COLUMN_DOCUMENT_ID,
          android.provider.DocumentsContract.Document.COLUMN_DISPLAY_NAME,
          android.provider.DocumentsContract.Document.COLUMN_MIME_TYPE,
          android.provider.DocumentsContract.Document.COLUMN_SIZE,
          android.provider.DocumentsContract.Document.COLUMN_LAST_MODIFIED,
      }, null, null, null);
      if (cursor == null) return;
      while (cursor.moveToNext()) {
        String docId = cursor.getString(0);
        String name = cursor.getString(1);
        String mime = cursor.getString(2);
        long size = cursor.getLong(3);
        long modified = cursor.getLong(4);
        if (name == null) continue;
        if (android.provider.DocumentsContract.Document.MIME_TYPE_DIR.equals(mime)) {
          walkTree(tree, docId, out, depth + 1);
          continue;
        }
        int dot = name.lastIndexOf('.');
        if (dot < 0) continue;
        String ext = name.substring(dot + 1).toLowerCase(java.util.Locale.ROOT);
        if (!AUDIO_EXT.contains(ext)) continue;

        WritableMap map = Arguments.createMap();
        map.putString("name", name);
        map.putString("uri", android.provider.DocumentsContract.buildDocumentUriUsingTree(tree, docId).toString());
        map.putDouble("size", size);
        map.putDouble("mtime", modified);
        // docId 形如 primary:TRIM/Download/xxx.flac，可以还原成本机路径（用于分组/展示）
        String path = docIdToPath(docId);
        if (path != null) map.putString("path", path);
        out.pushMap(map);
      }
    } catch (Exception ignored) {
    } finally {
      if (cursor != null) cursor.close();
    }
  }

  /** "primary:Music/a.flac" -> "/storage/emulated/0/Music/a.flac" */
  private String docIdToPath(String docId) {
    int idx = docId.indexOf(':');
    if (idx < 0) return null;
    String volume = docId.substring(0, idx);
    String relative = docId.substring(idx + 1);
    String root;
    if ("primary".equalsIgnoreCase(volume) || "home".equalsIgnoreCase(volume)) root = "/storage/emulated/0";
    else if (volume.matches("^[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}$")) root = "/storage/" + volume;
    else return null;
    return relative.isEmpty() ? root : root + "/" + relative;
  }

  /**
   * 按文件路径反查 MediaStore 的 content:// 地址。
   * 老版本扫进来的条目没有 contentUri，播放时按路径打开会 EACCES，用它兜底。
   */
  @ReactMethod
  public void findAudioByPath(String path, Promise promise) {
    Cursor cursor = null;
    try {
      Uri uri = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
      String[] projection = new String[] { MediaStore.Audio.Media._ID, MediaStore.Audio.Media.ALBUM_ID };
      cursor = getReactApplicationContext().getContentResolver().query(
          uri, projection, MediaStore.Audio.Media.DATA + " = ?", new String[] { path }, null);
      if (cursor != null && cursor.moveToFirst()) {
        long id = cursor.getLong(0);
        long albumId = cursor.getLong(1);
        WritableMap map = Arguments.createMap();
        map.putString("contentUri", android.content.ContentUris.withAppendedId(uri, id).toString());
        if (albumId > 0) map.putString("albumArt", "content://media/external/audio/albumart/" + albumId);
        promise.resolve(map);
      } else {
        promise.resolve(null);
      }
    } catch (Exception e) {
      promise.reject("query_failed", e);
    } finally {
      if (cursor != null) cursor.close();
    }
  }

  /**
   * 探测某个 SAF 目录树的读授权是否还有效。
   *
   * 用户清存储、重装应用、或者在系统设置里撤销授权后，之前 takePersistableUriPermission
   * 拿到的授权就没了，此时 listTree 会静默返回空数组 —— 表现就是「扫描结果突然变成 0 首」。
   * 这里直接查系统持有的持久化授权列表，比试着读一次目录更准也更便宜。
   */
  @ReactMethod
  public void hasTreePermission(String treeUri, Promise promise) {
    try {
      android.content.ContentResolver cr = getReactApplicationContext().getContentResolver();
      Uri tree = Uri.parse(treeUri);
      String target = tree.toString();
      for (android.content.UriPermission perm : cr.getPersistedUriPermissions()) {
        if (!perm.isReadPermission()) continue;
        String granted = perm.getUri().toString();
        // 授权是按 tree 前缀生效的，完全相等或作为前缀都算有效
        if (target.equals(granted) || target.startsWith(granted)) {
          promise.resolve(true);
          return;
        }
      }
      promise.resolve(false);
    } catch (Exception e) {
      promise.resolve(false);
    }
  }

  /**
   * 探测某个 SAF 目录能不能写（在目录里建一个探针文件再删掉）。
   *
   * Android 11+ 对公共目录一律拒写，只有 SAF 授权过的目录树能写；
   * 判断能不能当下载目录只能这么试，光看 File.canWrite() 永远是 false。
   */
  @ReactMethod
  public void canWriteTree(String treeUri, Promise promise) {
    Uri created = null;
    try {
      android.content.ContentResolver cr = getReactApplicationContext().getContentResolver();
      Uri tree = Uri.parse(treeUri);
      Uri parent = android.provider.DocumentsContract.buildDocumentUriUsingTree(
          tree, android.provider.DocumentsContract.getTreeDocumentId(tree));
      created = android.provider.DocumentsContract.createDocument(
          cr, parent, "application/octet-stream", ".lx_write_probe");
      promise.resolve(created != null);
    } catch (Exception e) {
      promise.resolve(false);
    } finally {
      if (created != null) {
        try {
          android.provider.DocumentsContract.deleteDocument(
              getReactApplicationContext().getContentResolver(), created);
        } catch (Exception ignored) {}
      }
    }
  }

  /**
   * 把本地文件复制进 SAF 目录树。
   *
   * 下载流程是「先下到缓存，再挪到目标目录」，而 react-native-fs 的 copyFile
   * 完全不认 content:// 地址，所以这一步必须由原生做。
   * 同名文件直接覆盖，避免出现「歌 (1).mp3」这种重复。
   */
  @ReactMethod
  public void copyToTree(String treeUri, String fileName, String srcPath, Promise promise) {
    java.io.InputStream in = null;
    java.io.OutputStream out = null;
    try {
      android.content.ContentResolver cr = getReactApplicationContext().getContentResolver();
      Uri tree = Uri.parse(treeUri);
      Uri parent = android.provider.DocumentsContract.buildDocumentUriUsingTree(
          tree, android.provider.DocumentsContract.getTreeDocumentId(tree));

      // 同名文件先删掉再重建，保证是空文件。
      // 为什么不直接 openOutputStream(target, "wt")：截断模式 "wt" 是 API 26 才有的，
      // 本工程 minSdk 21，在 Android 5~7 上会直接抛异常（下载完成却保存失败）。
      Uri existing = findChildByName(cr, tree, parent, fileName);
      if (existing != null) {
        try {
          android.provider.DocumentsContract.deleteDocument(cr, existing);
        } catch (Exception ignored) {}
      }
      Uri target = android.provider.DocumentsContract.createDocument(
          cr, parent, guessMime(fileName), fileName);
      if (target == null) {
        promise.reject("create_failed", "无法在目标目录创建文件");
        return;
      }
      in = new java.io.FileInputStream(new java.io.File(srcPath));
      out = cr.openOutputStream(target, "w");
      if (out == null) {
        promise.reject("open_failed", "无法写入目标文件");
        return;
      }
      byte[] buf = new byte[64 * 1024];
      int len;
      while ((len = in.read(buf)) > 0) out.write(buf, 0, len);
      out.flush();
      promise.resolve(target.toString());
    } catch (Exception e) {
      promise.reject("copy_failed", e);
    } finally {
      try { if (in != null) in.close(); } catch (Exception ignored) {}
      try { if (out != null) out.close(); } catch (Exception ignored) {}
    }
  }

  /**
   * 在某个文档（比如已下载好的歌）旁边写一个同目录的文本文件。
   *
   * 用来写 .lrc：下载完成后的 filePath 已经是 content:// 文档 uri，
   * 在 JS 侧对它做 `.replace(/\.[^.]+$/, '.lrc')` 得到的不是合法文档名，
   * 会落出一个 URL 编码的垃圾文件名。所以这一步必须由原生按「父目录 + 文件名」重建。
   */
  @ReactMethod
  public void writeSiblingText(String docUri, String fileName, String content, Promise promise) {
    java.io.OutputStream out = null;
    try {
      android.content.ContentResolver cr = getReactApplicationContext().getContentResolver();
      Uri doc = Uri.parse(docUri);
      String treeDocId = android.provider.DocumentsContract.getTreeDocumentId(doc);
      String docId = android.provider.DocumentsContract.getDocumentId(doc);
      int slash = docId.lastIndexOf('/');
      if (slash < 0) {
        promise.reject("bad_doc", "无法解析文档所在目录");
        return;
      }
      String parentDocId = docId.substring(0, slash);
      Uri tree = android.provider.DocumentsContract.buildTreeDocumentUri(doc.getAuthority(), treeDocId);
      Uri parent = android.provider.DocumentsContract.buildDocumentUriUsingTree(tree, parentDocId);

      Uri existing = findChildByName(cr, tree, parent, fileName);
      if (existing != null) {
        try {
          android.provider.DocumentsContract.deleteDocument(cr, existing);
        } catch (Exception ignored) {}
      }
      Uri target = android.provider.DocumentsContract.createDocument(cr, parent, "text/plain", fileName);
      if (target == null) {
        promise.reject("create_failed", "无法创建文件");
        return;
      }
      // createDocument 会按 MIME 给文件名补扩展名（text/plain → 末尾多一个 .txt），
      // 而 rename 不受这个限制，所以再改回目标名字
      try {
        Uri renamed = android.provider.DocumentsContract.renameDocument(cr, target, fileName);
        if (renamed != null) target = renamed;
      } catch (Exception ignored) {}
      out = cr.openOutputStream(target, "w");
      if (out == null) {
        promise.reject("open_failed", "无法写入文件");
        return;
      }
      out.write(content.getBytes("UTF-8"));
      out.flush();
      promise.resolve(target.toString());
    } catch (Exception e) {
      promise.reject("write_failed", e);
    } finally {
      try { if (out != null) out.close(); } catch (Exception ignored) {}
    }
  }

  /** 在目录里按显示名找已有文件 */
  private Uri findChildByName(android.content.ContentResolver cr, Uri tree, Uri parent, String name) {
    Uri children = android.provider.DocumentsContract.buildChildDocumentsUriUsingTree(
        tree, android.provider.DocumentsContract.getDocumentId(parent));
    Cursor cursor = null;
    try {
      cursor = cr.query(children, new String[] {
          android.provider.DocumentsContract.Document.COLUMN_DOCUMENT_ID,
          android.provider.DocumentsContract.Document.COLUMN_DISPLAY_NAME,
      }, null, null, null);
      if (cursor == null) return null;
      while (cursor.moveToNext()) {
        if (!name.equals(cursor.getString(1))) continue;
        return android.provider.DocumentsContract.buildDocumentUriUsingTree(tree, cursor.getString(0));
      }
      return null;
    } catch (Exception e) {
      return null;
    } finally {
      if (cursor != null) cursor.close();
    }
  }

  private String guessMime(String fileName) {
    int dot = fileName.lastIndexOf('.');
    String ext = dot < 0 ? "" : fileName.substring(dot + 1).toLowerCase(java.util.Locale.ROOT);
    switch (ext) {
      case "flac": return "audio/flac";
      case "wav": return "audio/wav";
      case "m4a": return "audio/mp4";
      case "ogg": return "audio/ogg";
      case "ape": return "audio/x-ape";
      case "lrc": return "text/plain";
      case "jpg":
      case "jpeg": return "image/jpeg";
      case "png": return "image/png";
      default: return "audio/mpeg";
    }
  }

  /** Activity 回传结果：path 为 null 表示用户取消 */
  static void emitResult(String path, String name, String error) {
    emitResult(path, name, null, error);
  }

  /**
   * Activity 回传结果（带 tree uri）。
   *
   * treeUri 必须一起交给 JS：后续枚举目录内容要靠它（listTree），
   * 而它只在选择的那一刻拿得到，事后再想拼是拼不出来的。
   */
  static void emitResult(String path, String name, String treeUri, String error) {
    if (sContext == null || !sContext.hasActiveReactInstance()) return;
    WritableMap map = Arguments.createMap();
    if (error != null) map.putString("error", error);
    else if (path != null) {
      map.putString("path", path);
      map.putString("name", name);
      if (treeUri != null) map.putString("treeUri", treeUri);
    }
    sContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
        .emit("DirectoryPicked", map);
  }

  static void emitError(String code, String message) {
    emitResult(null, null, message == null ? code : message);
  }
}
