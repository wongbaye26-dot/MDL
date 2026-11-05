package cn.emomusic.mobile.download;

import android.content.Context;
import android.media.MediaScannerConnection;
import android.os.SystemClock;
import android.util.Log;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.io.InputStream;
import java.io.RandomAccessFile;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

/**
 * 单个下载任务，支持 HTTP Range 断点续传 + 多连接分段下载。
 *
 * 提速策略：新下载先发一个 `Range: bytes=0-0` 的探测请求——
 * 服务端返回 206 且文件足够大时，把文件按字节区间切成 2~4 段、每段一个连接并发下载，
 * 直接写入预分配好的 `<filePath>.part`（RandomAccessFile 按偏移写，不需要分片临时文件）。
 * 服务端不支持 Range / 分片中途失败时自动回落到原来的单连接模式，保证兼容性。
 *
 * 断点续传：
 * - 分段下载会把每段进度写进 `<filePath>.part.seg`，暂停后再次开始按段继续；
 * - 老版本留下的 `.part`（没有 .seg 标记）仍按原来的单连接方式续传；
 * - 分片失败时会清掉临时文件重下，避免拿着「预分配长度 = 总长度」的空洞文件去续传。
 */
public class DownloadTask implements Runnable {
  private static final String TAG = "LxDownload";
  private static final int BUFFER_SIZE = 128 * 1024;
  private static final int SEGMENT_BUFFER_SIZE = 64 * 1024;
  private static final long PROGRESS_INTERVAL = 500;
  private static final long SEGMENT_MARK_INTERVAL = 2000;
  private static final int MAX_REDIRECT = 5;
  /** 小于这个大小不值得分段（探测 + 多连接的额外开销反而更慢） */
  private static final long SEGMENT_MIN_SIZE = 1024L * 1024L;
  private static final int MAX_THREADS = 4;

  private final String id;
  private final String url;
  private final String filePath;
  private final Map<String, String> headers;
  private final DownloadEvent event;
  private final Runnable onFinish;
  private final Context context;
  private final int threads;

  private volatile boolean paused = false;
  private volatile boolean canceled = false;
  private volatile boolean running = false;
  private final List<HttpURLConnection> connections = Collections.synchronizedList(new ArrayList<HttpURLConnection>());
  private Thread thread;

  private final AtomicLong downloaded = new AtomicLong(0);
  private volatile long total = 0;

  DownloadTask(String id, String url, String filePath, Map<String, String> headers, DownloadEvent event, Runnable onFinish, Context context, int threads) {
    this.id = id;
    this.url = url;
    this.filePath = filePath;
    this.headers = headers == null ? new HashMap<>() : headers;
    this.event = event;
    this.onFinish = onFinish;
    this.context = context;
    int count = threads <= 0 ? 3 : threads;
    this.threads = Math.max(1, Math.min(MAX_THREADS, count));
  }

  public String getId() {
    return id;
  }

  public boolean isRunning() {
    return running;
  }

  public long getDownloaded() {
    return downloaded.get();
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
   * 暂停任务，已下载的数据会保留在 .part 文件中（分段下载同时保留每段进度）
   */
  public void pause() {
    paused = true;
    closeConnections();
  }

  /**
   * 取消任务并删除临时文件
   */
  public void cancel() {
    canceled = true;
    closeConnections();
  }

  private void closeConnections() {
    synchronized (connections) {
      for (HttpURLConnection conn : connections) {
        try {
          conn.disconnect();
        } catch (Exception ignored) {
        }
      }
      connections.clear();
    }
  }

  private void closeConnection(HttpURLConnection conn) {
    if (conn == null) return;
    connections.remove(conn);
    try {
      conn.disconnect();
    } catch (Exception ignored) {
    }
  }

  private File getTempFile() {
    return new File(filePath + ".part");
  }

  private File getSegmentMarkFile() {
    return new File(filePath + ".part.seg");
  }

  /**
   * 下载完成后把文件交给系统媒体库索引。
   *
   * 为什么必须做：JS 层扫描本地音乐时优先用 MediaStore 按目录查文件，
   * 刚写进公共目录的歌在系统索引之前是查不到的 —— 用户看到的就是
   * 「下载完成，但本地音乐里没有 / 重新扫描也找不到」。
   * 应用专属目录（Android/data、Android/obb）系统不会索引，跳过即可。
   */
  private void scanCompletedFile(File file) {
    if (context == null || file == null || !file.exists()) return;
    String path = file.getAbsolutePath();
    // 只有外部存储里的文件才归 MediaStore 管：
    // 应用私有目录（Android/data、Android/obb）系统不会索引；
    // SAF 下载时用的缓存目录（/data/user/0/.../cache）也不该往媒体库里扫。
    if (!path.startsWith("/storage/")) return;
    if (path.contains("/Android/data/") || path.contains("/Android/obb/")) return;
    try {
      MediaScannerConnection.scanFile(context, new String[] { path }, null, null);
      Log.d(TAG, "request media scan: " + path);
    } catch (Exception e) {
      // 扫描失败不影响下载结果，JS 侧还有「本地缓存条目 + 目录 walk」兜底
      Log.w(TAG, "media scan failed: " + e.getMessage());
    }
  }

  /* ───────────────────────── 主流程 ───────────────────────── */

  @Override
  public void run() {
    running = true;
    File tempFile = getTempFile();
    File targetFile = new File(filePath);

    // 已完成过（.part 不存在但目标文件存在且大于 0）
    if (!tempFile.exists() && targetFile.exists() && targetFile.length() > 0) {
      downloaded.set(targetFile.length());
      total = targetFile.length();
      running = false;
      // 上次可能是「下载完但还没扫描就被杀进程」，这里补一次索引
      scanCompletedFile(targetFile);
      event.complete(id, total);
      return;
    }

    try {
      if (paused || canceled) return;

      if (tempFile.exists()) {
        // 有断点：优先按分段标记恢复（多连接续传）
        boolean resumed = resumeSegmented(tempFile, targetFile);
        if (!resumed && !paused && !canceled) {
          // 没有分段标记：按老逻辑走单连接续传
          downloadSingle(tempFile, targetFile, tempFile.length());
        }
      } else if (threads > 1) {
        // 新下载：先探测服务端是否支持 Range，支持且文件够大就分段。
        // 只给 1 个线程时没必要多一次探测，直接单连接（省一个 RTT）
        SegmentProbe probe = probeRangeSupport();
        if (probe != null && probe.total >= SEGMENT_MIN_SIZE) {
          total = probe.total;
          if (!downloadSegmented(tempFile, targetFile, probe.total, null)) {
            if (paused || canceled) return;
            // 分片失败：清掉临时文件，回落单连接重新下（保证兼容性）
            Log.w(TAG, "segmented download failed, fallback to single connection");
            deleteQuietly(tempFile);
            deleteQuietly(getSegmentMarkFile());
            downloadSingle(tempFile, targetFile, 0);
          }
        } else {
          total = probe != null ? probe.total : 0;
          downloadSingle(tempFile, targetFile, 0);
        }
      } else {
        downloadSingle(tempFile, targetFile, 0);
      }

      if (paused) event.pause(id, downloaded.get(), total);
    } catch (Exception e) {
      running = false;
      if (paused) {
        event.pause(id, downloaded.get(), total);
      } else if (!canceled) {
        Log.e(TAG, "download error: " + e.getMessage());
        if (e instanceof DownloadHttpException) {
          DownloadHttpException httpError = (DownloadHttpException) e;
          event.error(id, httpError.code, httpError.getMessage(), downloaded.get());
        } else {
          event.error(id, 0, e.getMessage(), downloaded.get());
        }
      }
    } finally {
      closeConnections();
      if (canceled) {
        deleteQuietly(getTempFile());
        deleteQuietly(getSegmentMarkFile());
        File target = new File(filePath);
        if (target.exists()) target.delete();
      }
      running = false;
      if (onFinish != null) onFinish.run();
    }
  }

  /* ───────────────────────── 单连接（兼容路径） ───────────────────────── */

  private void downloadSingle(File tempFile, File targetFile, long startPosition) throws IOException {
    // 单连接模式不使用分段标记：老标记（上次分段失败/被清理不彻底）留着会误导断点续传
    deleteQuietly(getSegmentMarkFile());
    long position = startPosition;
    downloaded.set(position);
    RandomAccessFile raf = null;
    HttpURLConnection conn = null;

    try {
      conn = openConnection(position, -1);
      int code = conn.getResponseCode();

      if (paused || canceled) return;

      if (code == HttpURLConnection.HTTP_PARTIAL) {
        long rangeTotal = parseTotalFromRange(conn.getHeaderField("Content-Range"));
        if (rangeTotal > 0) total = rangeTotal;
        else {
          long length = conn.getContentLength();
          if (length > 0) total = position + length;
        }
      } else if (code == HttpURLConnection.HTTP_OK) {
        // 服务端不支持断点续传，从头开始
        position = 0;
        downloaded.set(0);
        total = conn.getContentLength();
        deleteQuietly(tempFile);
      } else if (code == 416) {
        // 请求的范围无效，通常说明 .part 已经完整或者文件已变化，删掉重来
        deleteQuietly(tempFile);
        throw new DownloadHttpException(416, "range not satisfiable");
      } else {
        throw new DownloadHttpException(code, conn.getResponseMessage());
      }

      File parent = targetFile.getParentFile();
      if (parent != null && !parent.exists() && !parent.mkdirs()) {
        throw new IOException("create dir failed: " + parent.getAbsolutePath());
      }

      raf = new RandomAccessFile(tempFile, "rw");
      raf.seek(position);
      event.start(id, position, total);

      InputStream in = conn.getInputStream();
      byte[] buffer = new byte[BUFFER_SIZE];
      long lastReportTime = SystemClock.elapsedRealtime();
      long lastReportBytes = position;
      int len;

      while ((len = in.read(buffer)) != -1) {
        if (paused || canceled) break;
        raf.write(buffer, 0, len);
        long current = downloaded.addAndGet(len);

        long now = SystemClock.elapsedRealtime();
        if (now - lastReportTime >= PROGRESS_INTERVAL) {
          long deltaBytes = current - lastReportBytes;
          long deltaTime = now - lastReportTime;
          long speed = deltaTime > 0 ? deltaBytes * 1000 / deltaTime : 0;
          lastReportTime = now;
          lastReportBytes = current;
          event.progress(id, current, total, speed);
        }
      }

      try {
        in.close();
      } catch (IOException ignored) {
      }

      if (paused || canceled) return;

      if (total > 0 && downloaded.get() < total) {
        throw new IOException("download incomplete (" + downloaded.get() + "/" + total + ")");
      }

      finishCompleted(raf, tempFile, targetFile);
      raf = null;
    } finally {
      if (raf != null) {
        try {
          raf.close();
        } catch (IOException ignored) {
        }
      }
      closeConnection(conn);
    }
  }

  /* ───────────────────────── 分段多连接 ───────────────────────── */

  /** 探测服务端是否支持 Range，返回文件总大小；不支持/探测失败返回 null */
  private SegmentProbe probeRangeSupport() {
    HttpURLConnection conn = null;
    try {
      conn = openConnection(0, 0);
      int code = conn.getResponseCode();
      if (code == HttpURLConnection.HTTP_PARTIAL) {
        long rangeTotal = parseTotalFromRange(conn.getHeaderField("Content-Range"));
        if (rangeTotal > 0) return new SegmentProbe(rangeTotal);
      }
    } catch (Exception e) {
      Log.w(TAG, "range probe failed: " + e.getMessage());
    } finally {
      closeConnection(conn);
    }
    return null;
  }

  /** 老 .part 有分段标记时按段续传；没有标记 / 标记不匹配返回 false（交给单连接续传） */
  private boolean resumeSegmented(File tempFile, File targetFile) {
    List<Segment> segments = readSegmentMark(tempFile.length());
    if (segments == null) return false;
    long totalSize = tempFile.length();
    Log.d(TAG, "resume segmented download: " + segments.size() + " segments, total=" + totalSize);
    return downloadSegmented(tempFile, targetFile, totalSize, segments);
  }

  /**
   * 多连接分段下载。
   *
   * @param existingSegments 非 null 表示断点续传（每段的 done 有效）；null 表示从 0 开始新下载
   * @return true 表示完整下载完成；false 表示失败 / 暂停 / 取消（调用方按状态处理）
   */
  private boolean downloadSegmented(File tempFile, File targetFile, long totalSize, List<Segment> existingSegments) {
    List<Segment> segments = existingSegments != null ? existingSegments : splitSegments(totalSize, threads);

    // 预分配文件长度：每段的连接直接 seek 到自己的偏移写，不需要额外的分片文件
    RandomAccessFile raf = null;
    try {
      raf = new RandomAccessFile(tempFile, "rw");
      if (raf.length() < totalSize) raf.setLength(totalSize);
    } catch (IOException e) {
      Log.w(TAG, "preallocate failed: " + e.getMessage());
      return false;
    } finally {
      if (raf != null) {
        try {
          raf.close();
        } catch (IOException ignored) {
        }
      }
    }

    total = totalSize;
    long alreadyDone = 0;
    for (Segment segment : segments) alreadyDone += segment.done;
    downloaded.set(alreadyDone);

    final AtomicReference<IOException> failure = new AtomicReference<>();
    final List<Thread> workers = new ArrayList<>();
    event.start(id, alreadyDone, totalSize);

    for (final Segment segment : segments) {
      if (paused || canceled) break;
      Thread worker = new Thread(() -> {
        try {
          downloadSegment(segment, tempFile);
        } catch (Exception e) {
          if (!paused && !canceled) {
            failure.compareAndSet(null, e instanceof IOException ? (IOException) e : new IOException(e.getMessage()));
          }
          // 任一分段失败就中断其它分段，尽快回落单连接
          closeConnections();
        }
      }, "lx-download-seg-" + segment.start);
      workers.add(worker);
      worker.start();
    }

    // 汇总进度 + 定期写分段标记（暂停/被杀后可断点续传）
    long lastReportTime = SystemClock.elapsedRealtime();
    long lastReportBytes = alreadyDone;
    long lastMarkTime = lastReportTime;

    while (true) {
      boolean anyAlive = false;
      for (Thread worker : workers) {
        if (worker.isAlive()) {
          anyAlive = true;
          break;
        }
      }
      if (!anyAlive) break;

      long now = SystemClock.elapsedRealtime();
      if (now - lastReportTime >= PROGRESS_INTERVAL) {
        long current = downloaded.get();
        long deltaBytes = current - lastReportBytes;
        long deltaTime = now - lastReportTime;
        long speed = deltaTime > 0 ? deltaBytes * 1000 / deltaTime : 0;
        lastReportTime = now;
        lastReportBytes = current;
        event.progress(id, current, totalSize, speed);
      }
      if (now - lastMarkTime >= SEGMENT_MARK_INTERVAL) {
        lastMarkTime = now;
        writeSegmentMark(segments, totalSize);
      }

      if (paused || canceled) {
        // 关连接让 worker 尽快退出，再等它们结束
        closeConnections();
      }

      try {
        Thread.sleep(80);
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        break;
      }
    }

    for (Thread worker : workers) {
      try {
        worker.join(2000);
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        break;
      }
    }

    if (canceled) return false;
    if (paused) {
      writeSegmentMark(segments, totalSize);
      return false;
    }
    IOException error = failure.get();
    if (error != null) {
      Log.w(TAG, "segment download failed: " + error.getMessage());
      return false;
    }
    if (downloaded.get() < totalSize) {
      Log.w(TAG, "segment download incomplete: " + downloaded.get() + "/" + totalSize);
      return false;
    }

    try {
      finishCompleted(null, tempFile, targetFile);
      return true;
    } catch (IOException e) {
      Log.w(TAG, "finish segmented download failed: " + e.getMessage());
      return false;
    }
  }

  /** 下载单个分段 [start, end]，从 start + done 处开始 */
  private void downloadSegment(Segment segment, File tempFile) throws IOException {
    long position = segment.start + segment.done;
    if (position > segment.end) return;

    HttpURLConnection conn = null;
    RandomAccessFile raf = null;
    try {
      conn = openConnection(position, segment.end);
      int code = conn.getResponseCode();
      if (code != HttpURLConnection.HTTP_PARTIAL) {
        throw new IOException("server ignored range: " + code);
      }

      raf = new RandomAccessFile(tempFile, "rw");
      raf.seek(position);
      InputStream in = conn.getInputStream();
      byte[] buffer = new byte[SEGMENT_BUFFER_SIZE];
      int len;
      while ((len = in.read(buffer)) != -1) {
        if (paused || canceled) break;
        long remain = segment.end - position + 1;
        if (remain <= 0) break;
        int toWrite = (int) Math.min(len, remain);
        raf.write(buffer, 0, toWrite);
        position += toWrite;
        segment.done = position - segment.start;
        downloaded.addAndGet(toWrite);
        if (toWrite < len) break;
      }
      try {
        in.close();
      } catch (IOException ignored) {
      }
      if (!paused && !canceled && position <= segment.end) {
        throw new IOException("segment incomplete: " + position + "/" + (segment.end + 1));
      }
    } finally {
      if (raf != null) {
        try {
          raf.close();
        } catch (IOException ignored) {
        }
      }
      closeConnection(conn);
    }
  }

  private List<Segment> splitSegments(long totalSize, int count) {
    int n = Math.max(1, Math.min(MAX_THREADS, count));
    List<Segment> segments = new ArrayList<>(n);
    long chunk = (totalSize + n - 1) / n;
    for (int i = 0; i < n; i++) {
      long start = i * chunk;
      if (start >= totalSize) break;
      long end = Math.min(totalSize - 1, start + chunk - 1);
      segments.add(new Segment(start, end));
    }
    return segments;
  }

  /* ───────────────────────── 分段标记持久化 ───────────────────────── */

  private void writeSegmentMark(List<Segment> segments, long totalSize) {
    File markFile = getSegmentMarkFile();
    FileWriter writer = null;
    try {
      writer = new FileWriter(markFile, false);
      writer.write("v1 " + totalSize + " " + segments.size() + "\n");
      for (Segment segment : segments) {
        writer.write(segment.start + " " + segment.end + " " + segment.done + "\n");
      }
      writer.flush();
    } catch (Exception e) {
      Log.w(TAG, "write segment mark failed: " + e.getMessage());
    } finally {
      if (writer != null) {
        try {
          writer.close();
        } catch (IOException ignored) {
        }
      }
    }
  }

  /**
   * 读取分段标记。
   * @return 校验通过的分段列表；没有标记 / 标记与 .part 长度不一致时返回 null
   */
  private List<Segment> readSegmentMark(long partLength) {
    File markFile = getSegmentMarkFile();
    if (!markFile.exists()) return null;
    BufferedReader reader = null;
    try {
      reader = new BufferedReader(new FileReader(markFile));
      String head = reader.readLine();
      if (head == null) return null;
      String[] headParts = head.trim().split("\\s+");
      if (headParts.length < 3 || !"v1".equals(headParts[0])) return null;
      long totalSize = Long.parseLong(headParts[1]);
      int count = Integer.parseInt(headParts[2]);
      if (totalSize != partLength || count <= 0) return null;
      List<Segment> segments = new ArrayList<>(count);
      for (int i = 0; i < count; i++) {
        String line = reader.readLine();
        if (line == null) return null;
        String[] parts = line.trim().split("\\s+");
        if (parts.length < 3) return null;
        long start = Long.parseLong(parts[0]);
        long end = Long.parseLong(parts[1]);
        long done = Long.parseLong(parts[2]);
        if (start < 0 || end < start || end >= totalSize || done < 0 || done > end - start + 1) return null;
        Segment segment = new Segment(start, end);
        segment.done = done;
        segments.add(segment);
      }
      return segments;
    } catch (Exception e) {
      return null;
    } finally {
      if (reader != null) {
        try {
          reader.close();
        } catch (IOException ignored) {
        }
      }
    }
  }

  /* ───────────────────────── 完成 / 连接 ───────────────────────── */

  /**
   * 临时文件落成正式文件：关闭 .part → 重命名（不支持则复制）→ 清标记 → 扫描媒体库 → 发完成事件
   * @param openRaf 单连接路径下已经打开的 RandomAccessFile；分段路径传 null
   */
  private void finishCompleted(RandomAccessFile openRaf, File tempFile, File targetFile) throws IOException {
    if (openRaf != null) {
      openRaf.close();
    }
    deleteQuietly(getSegmentMarkFile());

    // 重命名临时文件为正式文件
    if (targetFile.exists() && !targetFile.delete()) {
      Log.w(TAG, "delete exist file failed: " + targetFile.getAbsolutePath());
    }
    if (!tempFile.renameTo(targetFile)) {
      // 部分文件系统不支持重命名跨目录/被占用，退化为复制
      copyFile(tempFile, targetFile);
      deleteQuietly(tempFile);
    }

    // 关键：写进公共目录后立刻让系统媒体库收录，
    // 否则 MediaStore 查不到新文件，JS 扫描结果里就没有这首歌
    scanCompletedFile(targetFile);

    long finalTotal = total > 0 ? total : downloaded.get();
    running = false;
    event.complete(id, finalTotal);
  }

  private HttpURLConnection openConnection(long position, long lastByte) throws IOException {
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
      if (lastByte >= 0) {
        conn.setRequestProperty("Range", "bytes=" + position + "-" + lastByte);
      } else if (position > 0) {
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
      connections.add(conn);
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
    try (InputStream in = new FileInputStream(from);
         FileOutputStream out = new FileOutputStream(to)) {
      byte[] buffer = new byte[BUFFER_SIZE];
      int len;
      while ((len = in.read(buffer)) != -1) {
        out.write(buffer, 0, len);
      }
      out.flush();
    }
  }

  private void deleteQuietly(File file) {
    if (file == null || !file.exists()) return;
    if (!file.delete()) Log.w(TAG, "delete failed: " + file.getAbsolutePath());
  }

  private static class Segment {
    final long start;
    final long end;
    /** 已经从 start 写入的字节数（用于断点续传） */
    long done = 0;

    Segment(long start, long end) {
      this.start = start;
      this.end = end;
    }
  }

  private static class SegmentProbe {
    final long total;

    SegmentProbe(long total) {
      this.total = total;
    }
  }

  private static class DownloadHttpException extends IOException {
    private static final long serialVersionUID = 1L;
    final int code;

    DownloadHttpException(int code, String message) {
      super(message == null ? ("http " + code) : message);
      this.code = code;
    }
  }
}
