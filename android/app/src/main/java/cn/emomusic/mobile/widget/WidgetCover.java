package cn.emomusic.mobile.widget;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.util.LruCache;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * 小组件封面加载器。
 *
 * 在线歌曲的 pic 是音源 CDN 的 http(s) 地址，本地歌曲的 pic 是文件路径 /
 * file:// URI。旧实现只按本地路径解码，在线歌曲永远落到首字占位图 —— 这
 * 里补上「在线封面下载到磁盘缓存 → 解码 → 内存缓存」的链路：
 *
 * - 磁盘缓存：cacheDir/emo-widget-cover/<url 的 SHA-1>.img，同一 URL 只下一次；
 * - 内存缓存：按「pic|尺寸|圆角」缓存处理后的 Bitmap，widget 每 2s 重绘不重复解码；
 * - 下载在单线程池里跑，失败 60s 内不重试，避免 widget 定时刷新时反复打网络；
 * - 下载完成回主线程回调，让 widget 用真实封面重绘一次。
 */
final class WidgetCover {
  private static final String TAG = "MusicWidget";
  private static final String CACHE_DIR = "emo-widget-cover";
  private static final int MAX_BYTES = 8 * 1024 * 1024;
  private static final long RETRY_AFTER_MS = 60 * 1000L;
  private static final String UA = "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";

  private static final ExecutorService POOL = Executors.newFixedThreadPool(2);
  private static final Handler MAIN = new Handler(Looper.getMainLooper());
  private static final Set<String> PENDING = Collections.synchronizedSet(new HashSet<String>());
  private static final Map<String, Long> FAILED_AT = Collections.synchronizedMap(new HashMap<String, Long>());
  private static final LruCache<String, Bitmap> MEMORY = new LruCache<String, Bitmap>(12 * 1024 * 1024) {
    @Override
    protected int sizeOf(String key, Bitmap value) {
      return value.getByteCount();
    }
  };

  private WidgetCover() {}

  static boolean isRemote(String pic) {
    return pic != null && (pic.startsWith("http://") || pic.startsWith("https://"));
  }

  static boolean isCached(Context context, String pic) {
    return isRemote(pic) && cacheFile(context, pic).exists();
  }

  /**
   * 取 size×size 的封面，radius < 0 为圆形、0 为直角、其它为圆角。
   * 在线封面只在磁盘缓存已存在时返回 Bitmap，没有则返回 null（调用方用占位图，
   * 并调用 {@link #prefetch} 在后台补下）。
   */
  static Bitmap cover(Context context, String pic, int size, int radius) {
    if (pic == null || pic.isEmpty()) return null;
    String key = pic + '|' + size + '|' + radius;
    Bitmap cached = MEMORY.get(key);
    if (cached != null && !cached.isRecycled()) return cached;
    File file;
    if (isRemote(pic)) {
      file = cacheFile(context, pic);
      if (!file.exists()) return null;
    } else {
      String path = pic.startsWith("file://") ? Uri.parse(pic).getPath() : pic;
      if (path == null) return null;
      file = new File(path);
      if (!file.exists()) return null;
    }
    Bitmap scaled = decodeScaled(file, size);
    if (scaled == null) return null;
    Bitmap out = radius == 0 ? scaled : round(scaled, size, radius);
    MEMORY.put(key, out);
    return out;
  }

  /** 在线封面后台下载，完成后在主线程回调（widget 重绘用）；同一 URL 并发去重 */
  static void prefetch(final Context context, final String pic, final Runnable onReady) {
    if (!isRemote(pic)) return;
    final File file = cacheFile(context, pic);
    if (file.exists()) return;
    Long failedAt = FAILED_AT.get(pic);
    if (failedAt != null && System.currentTimeMillis() - failedAt < RETRY_AFTER_MS) return;
    if (!PENDING.add(pic)) return;
    final Context app = context.getApplicationContext();
    POOL.execute(() -> {
      boolean ok = download(pic, file);
      PENDING.remove(pic);
      if (ok) {
        FAILED_AT.remove(pic);
      } else {
        FAILED_AT.put(pic, System.currentTimeMillis());
      }
      MAIN.post(() -> {
        if (ok && onReady != null) onReady.run();
      });
    });
  }

  private static File cacheDir(Context context) {
    File dir = new File(context.getCacheDir(), CACHE_DIR);
    if (!dir.exists() && !dir.mkdirs()) Log.w(TAG, "cover cache dir create failed: " + dir);
    return dir;
  }

  private static File cacheFile(Context context, String url) {
    return new File(cacheDir(context), hash(url) + ".img");
  }

  private static String hash(String url) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-1");
      byte[] bytes = digest.digest(url.getBytes("UTF-8"));
      StringBuilder sb = new StringBuilder(bytes.length * 2);
      for (byte b : bytes) sb.append(String.format(Locale.US, "%02x", b & 0xFF));
      return sb.toString();
    } catch (Exception e) {
      return Integer.toHexString(url.hashCode());
    }
  }

  /** 不同 CDN 对 Referer 要求不同：先裸 UA 试，再按域名补常见 Referer */
  private static String[] referers(String pic) {
    String host = "";
    try {
      host = new URL(pic).getHost();
    } catch (Exception ignored) {}
    String lower = host == null ? "" : host.toLowerCase(Locale.US);
    if (lower.contains("gtimg") || lower.contains("qq.com")) return new String[] { null, "https://y.qq.com/" };
    if (lower.contains("126.net") || lower.contains("163.com")) return new String[] { null, "https://music.163.com/" };
    if (lower.contains("kugou")) return new String[] { null, "https://www.kugou.com/" };
    if (lower.contains("kuwo")) return new String[] { null, "https://www.kuwo.cn/" };
    if (lower.contains("12530") || lower.contains("migu")) return new String[] { null, "https://music.migu.cn/" };
    return new String[] { null };
  }

  private static boolean download(String pic, File target) {
    File tmp = new File(target.getPath() + ".tmp");
    for (String referer : referers(pic)) {
      HttpURLConnection conn = null;
      InputStream in = null;
      FileOutputStream out = null;
      try {
        conn = (HttpURLConnection) new URL(pic).openConnection();
        conn.setConnectTimeout(10000);
        conn.setReadTimeout(15000);
        conn.setInstanceFollowRedirects(true);
        conn.setRequestProperty("User-Agent", UA);
        conn.setRequestProperty("Accept", "image/*,*/*;q=0.8");
        if (referer != null) conn.setRequestProperty("Referer", referer);
        int code = conn.getResponseCode();
        if (code != HttpURLConnection.HTTP_OK) {
          Log.w(TAG, "cover http " + code + " referer=" + referer + " " + pic);
          continue;
        }
        long length = conn.getContentLength();
        if (length > MAX_BYTES) {
          Log.w(TAG, "cover too large (" + length + "B) " + pic);
          return false;
        }
        in = conn.getInputStream();
        out = new FileOutputStream(tmp);
        byte[] buffer = new byte[16 * 1024];
        long total = 0;
        int read;
        while ((read = in.read(buffer)) > 0) {
          total += read;
          if (total > MAX_BYTES) throw new IOException("cover exceeds " + MAX_BYTES + "B");
          out.write(buffer, 0, read);
        }
        out.flush();
        out.close();
        out = null;
        in.close();
        in = null;

        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        BitmapFactory.decodeFile(tmp.getPath(), bounds);
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
          Log.w(TAG, "cover body is not an image " + pic);
          continue;
        }
        if (target.exists() && !target.delete()) Log.w(TAG, "cover old file delete failed");
        if (!tmp.renameTo(target)) {
          copy(tmp, target);
          if (!tmp.delete()) Log.w(TAG, "cover tmp delete failed");
        }
        Log.i(TAG, "cover cached " + bounds.outWidth + "x" + bounds.outHeight + " from " + pic);
        return true;
      } catch (Exception e) {
        Log.w(TAG, "cover download failed (" + e.getClass().getSimpleName() + ") " + pic);
      } finally {
        if (out != null) try { out.close(); } catch (IOException ignored) {}
        if (in != null) try { in.close(); } catch (IOException ignored) {}
        if (conn != null) conn.disconnect();
      }
    }
    if (tmp.exists() && !tmp.delete()) Log.w(TAG, "cover tmp cleanup failed");
    return false;
  }

  private static void copy(File from, File to) {
    InputStream in = null;
    FileOutputStream out = null;
    try {
      in = new java.io.FileInputStream(from);
      out = new FileOutputStream(to);
      byte[] buffer = new byte[16 * 1024];
      int read;
      while ((read = in.read(buffer)) > 0) out.write(buffer, 0, read);
      out.flush();
    } catch (Exception e) {
      Log.w(TAG, "cover copy failed", e);
    } finally {
      if (out != null) try { out.close(); } catch (IOException ignored) {}
      if (in != null) try { in.close(); } catch (IOException ignored) {}
    }
  }

  private static Bitmap decodeScaled(File file, int size) {
    try {
      BitmapFactory.Options bounds = new BitmapFactory.Options();
      bounds.inJustDecodeBounds = true;
      BitmapFactory.decodeFile(file.getPath(), bounds);
      if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null;
      int sample = 1;
      while (bounds.outWidth / (sample * 2) >= size && bounds.outHeight / (sample * 2) >= size) sample *= 2;
      BitmapFactory.Options options = new BitmapFactory.Options();
      options.inSampleSize = sample;
      options.inPreferredConfig = Bitmap.Config.ARGB_8888;
      Bitmap source = BitmapFactory.decodeFile(file.getPath(), options);
      if (source == null) return null;
      if (source.getWidth() == size && source.getHeight() == size) return source;
      Bitmap scaled = Bitmap.createScaledBitmap(source, size, size, true);
      if (scaled != source) source.recycle();
      return scaled;
    } catch (Exception e) {
      Log.w(TAG, "cover decode failed: " + file.getName(), e);
      return null;
    }
  }

  private static Bitmap round(Bitmap source, int size, int radius) {
    Bitmap out = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
    Canvas canvas = new Canvas(out);
    Path shape = new Path();
    int r = radius < 0 ? size / 2 : radius;
    shape.addRoundRect(new RectF(0, 0, size, size), r, r, Path.Direction.CW);
    canvas.clipPath(shape);
    canvas.drawBitmap(source, 0, 0, new Paint(Paint.FILTER_BITMAP_FLAG | Paint.ANTI_ALIAS_FLAG));
    return out;
  }
}
