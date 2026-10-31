package cn.toside.music.mobile.download;

import android.os.SystemClock;
import android.util.Log;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.RandomAccessFile;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;

/**
 * 单个下载任务，支持 HTTP Range 断点续传。
 *
 * 下载过程中写入 `<filePath>.part`，下载完成后重命名为正式文件，
 * 这样任务被中断时可以通过 .part 文件的大小继续下载。
 */
public class DownloadTask implements Runnable {
  private static final String TAG = "LxDownload";
  private static final int BUFFER_SIZE = 64 * 1024;
  private static final long PROGRESS_INTERVAL = 500;
  private static final int MAX_REDIRECT = 5;

  private final String id;
  private final String url;
  private final String filePath;
  private final Map<String, String> headers;
  private final DownloadEvent event;
  private final Runnable onFinish;

  private volatile boolean paused = false;
  private volatile boolean canceled = false;
  private volatile boolean running = false;
  private HttpURLConnection connection;
  private Thread thread;

  private long downloaded = 0;
  private long total = 0;

  DownloadTask(String id, String url, String filePath, Map<String, String> headers, DownloadEvent event, Runnable onFinish) {
    this.id = id;
    this.url = url;
    this.filePath = filePath;
    this.headers = headers == null ? new HashMap<>() : headers;
    this.event = event;
    this.onFinish = onFinish;
  }

  public String getId() {
    return id;
  }

  public boolean isRunning() {
    return running;
  }

  public long getDownloaded() {
    return downloaded;
  }

  public long getTotal() {
    return total;
  }

  public void start() {
    if (running) return;
    paused = false;
    canceled = false;
    thread = new Thread(this, "lx-download-" + id);
    thread.start();
  }

  /**
   * 暂停任务，已下载的数据会保留在 .part 文件中
   */
  public void pause() {
    paused = true;
    closeConnection();
  }

  /**
   * 取消任务并删除临时文件
   */
  public void cancel() {
    canceled = true;
    closeConnection();
  }

  private void closeConnection() {
    HttpURLConnection conn = connection;
    if (conn != null) {
      try {
        conn.disconnect();
      } catch (Exception ignored) {
      }
    }
  }

  private File getTempFile() {
    return new File(filePath + ".part");
  }

  @Override
  public void run() {
    running = true;
    File tempFile = getTempFile();
    File targetFile = new File(filePath);

    // 已完成过（.part 不存在但目标文件存在且大于 0）
    if (!tempFile.exists() && targetFile.exists() && targetFile.length() > 0) {
      downloaded = targetFile.length();
      total = downloaded;
      running = false;
      event.complete(id, total);
      return;
    }

    long position = tempFile.exists() ? tempFile.length() : 0;
    downloaded = position;
    RandomAccessFile raf = null;

    try {
      HttpURLConnection conn = openConnection(position);
      connection = conn;
      int code = conn.getResponseCode();

      if (paused || canceled) return;

      if (code == HttpURLConnection.HTTP_PARTIAL) {
        total = parseTotalFromRange(conn.getHeaderField("Content-Range"));
        if (total <= 0) {
          long length = conn.getContentLength();
          if (length > 0) total = position + length;
        }
      } else if (code == HttpURLConnection.HTTP_OK) {
        // 服务端不支持断点续传，从头开始
        position = 0;
        downloaded = 0;
        total = conn.getContentLength();
        if (tempFile.exists() && !tempFile.delete()) {
          Log.w(TAG, "delete temp file failed: " + tempFile.getAbsolutePath());
        }
      } else if (code == 416) {
        // 请求的范围无效，通常说明 .part 已经完整或者文件已变化，删掉重来
        if (tempFile.exists()) tempFile.delete();
        running = false;
        event.error(id, 416, "range not satisfiable", 0);
        return;
      } else {
        running = false;
        event.error(id, code, conn.getResponseMessage(), position);
        return;
      }

      File parent = targetFile.getParentFile();
      if (parent != null && !parent.exists() && !parent.mkdirs()) {
        running = false;
        event.error(id, -1, "create dir failed: " + parent.getAbsolutePath(), position);
        return;
      }

      raf = new RandomAccessFile(tempFile, "rw");
      raf.seek(position);
      event.start(id, position, total);

      InputStream in = conn.getInputStream();
      byte[] buffer = new byte[BUFFER_SIZE];
      long lastReportTime = SystemClock.elapsedRealtime();
      long lastReportBytes = position;
      long speed = 0;
      int len;

      while ((len = in.read(buffer)) != -1) {
        if (paused || canceled) break;
        raf.write(buffer, 0, len);
        downloaded += len;

        long now = SystemClock.elapsedRealtime();
        if (now - lastReportTime >= PROGRESS_INTERVAL) {
          long deltaBytes = downloaded - lastReportBytes;
          long deltaTime = now - lastReportTime;
          speed = deltaTime > 0 ? deltaBytes * 1000 / deltaTime : 0;
          lastReportTime = now;
          lastReportBytes = downloaded;
          event.progress(id, downloaded, total, speed);
        }
      }

      try {
        in.close();
      } catch (IOException ignored) {
      }

      if (paused) {
        running = false;
        event.pause(id, downloaded, total);
        return;
      }
      if (canceled) {
        running = false;
        return;
      }

      if (total > 0 && downloaded < total) {
        running = false;
        event.error(id, -1, "download incomplete (" + downloaded + "/" + total + ")", downloaded);
        return;
      }

      raf.close();
      raf = null;

      // 重命名临时文件为正式文件
      if (targetFile.exists() && !targetFile.delete()) {
        Log.w(TAG, "delete exist file failed: " + targetFile.getAbsolutePath());
      }
      if (!tempFile.renameTo(targetFile)) {
        // 部分文件系统不支持重命名跨目录/被占用，退化为复制
        copyFile(tempFile, targetFile);
        tempFile.delete();
      }

      running = false;
      event.complete(id, total > 0 ? total : downloaded);
    } catch (Exception e) {
      running = false;
      if (paused) {
        event.pause(id, downloaded, total);
      } else if (!canceled) {
        Log.e(TAG, "download error: " + e.getMessage());
        event.error(id, 0, e.getMessage(), downloaded);
      }
    } finally {
      if (raf != null) {
        try {
          raf.close();
        } catch (IOException ignored) {
        }
      }
      connection = null;
      if (canceled) {
        File temp = getTempFile();
        if (temp.exists()) temp.delete();
        File target = new File(filePath);
        if (target.exists()) target.delete();
      }
      running = false;
      if (onFinish != null) onFinish.run();
    }
  }

  private HttpURLConnection openConnection(long position) throws IOException {
    String currentUrl = url;
    for (int i = 0; i < MAX_REDIRECT; i++) {
      HttpURLConnection conn = (HttpURLConnection) new URL(currentUrl).openConnection();
      conn.setInstanceFollowRedirects(false);
      conn.setConnectTimeout(15000);
      conn.setReadTimeout(30000);
      conn.setRequestMethod("GET");
      conn.setRequestProperty("Accept-Encoding", "identity");
      conn.setRequestProperty("Connection", "keep-alive");
      if (!headers.containsKey("User-Agent") && !headers.containsKey("user-agent")) {
        conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36");
      }
      for (Map.Entry<String, String> entry : headers.entrySet()) {
        conn.setRequestProperty(entry.getKey(), entry.getValue());
      }
      if (position > 0) {
        conn.setRequestProperty("Range", "bytes=" + position + "-");
      }
      conn.connect();

      int code = conn.getResponseCode();
      if (code == HttpURLConnection.HTTP_MOVED_PERM
        || code == HttpURLConnection.HTTP_MOVED_TEMP
        || code == HttpURLConnection.HTTP_SEE_OTHER
        || code == 307 || code == 308) {
        String location = conn.getHeaderField("Location");
        conn.disconnect();
        if (location == null) throw new IOException("redirect without location");
        currentUrl = location.startsWith("http") ? location : new URL(new URL(currentUrl), location).toString();
        continue;
      }
      return conn;
    }
    throw new IOException("too many redirects");
  }

  private long parseTotalFromRange(String contentRange) {
    // Content-Range: bytes 0-1023/4096
    if (contentRange == null) return 0;
    int index = contentRange.lastIndexOf('/');
    if (index < 0) return 0;
    String totalStr = contentRange.substring(index + 1).trim();
    if (totalStr.equals("*")) return 0;
    try {
      return Long.parseLong(totalStr);
    } catch (NumberFormatException e) {
      return 0;
    }
  }

  private void copyFile(File from, File to) throws IOException {
    try (InputStream in = new java.io.FileInputStream(from);
         FileOutputStream out = new FileOutputStream(to)) {
      byte[] buffer = new byte[BUFFER_SIZE];
      int len;
      while ((len = in.read(buffer)) != -1) {
        out.write(buffer, 0, len);
      }
      out.flush();
    }
  }
}
