package cn.emomusic.mobile.dlna;

import android.content.Context;
import android.net.Uri;
import android.util.Log;

import androidx.annotation.Nullable;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URL;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Enumeration;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * 投屏用的本地 HTTP 媒体服务。
 *
 * 电视只会拉 http URL，所以本地文件、带防盗链的在线源都要先转成
 * http://<手机IP>:<端口>/cast?u=...&s=... 再交给电视。
 * 支持 Range（电视普遍会先发 bytes=0- 探测），在线源按 Host 补 UA/Referer。
 */
final class MediaServer {
  private static final String TAG = "EmoDlna";
  private static final String UA =
    "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";

  private final Context context;
  private final ExecutorService pool = Executors.newCachedThreadPool();
  private ServerSocket serverSocket;
  private Thread acceptThread;
  private volatile boolean running;

  MediaServer(Context context) {
    this.context = context.getApplicationContext();
  }

  synchronized int start() throws IOException {
    if (running) return serverSocket.getLocalPort();
    serverSocket = new ServerSocket(0);
    running = true;
    acceptThread = new Thread(() -> {
      while (running) {
        try {
          Socket socket = serverSocket.accept();
          socket.setSoTimeout(30000);
          pool.execute(() -> handle(socket));
        } catch (IOException e) {
          if (running) Log.w(TAG, "accept failed: " + e);
          break;
        }
      }
    }, "emo-dlna-media");
    acceptThread.start();
    Log.i(TAG, "media server on port " + serverSocket.getLocalPort());
    return serverSocket.getLocalPort();
  }

  synchronized void stop() {
    running = false;
    try {
      if (serverSocket != null) serverSocket.close();
    } catch (IOException ignored) {}
    serverSocket = null;
    acceptThread = null;
  }

  int getPort() {
    return serverSocket == null ? 0 : serverSocket.getLocalPort();
  }

  /** 手机在 WiFi 上的 IPv4 地址，电视要用这个地址回连 */
  @Nullable
  static String localIpv4() {
    try {
      Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
      String fallback = null;
      for (NetworkInterface networkInterface : Collections.list(interfaces)) {
        if (!networkInterface.isUp() || networkInterface.isLoopback()) continue;
        String name = networkInterface.getName();
        for (InetAddress address : Collections.list(networkInterface.getInetAddresses())) {
          if (!(address instanceof java.net.Inet4Address)) continue;
          String host = address.getHostAddress();
          if (host == null || host.startsWith("127.")) continue;
          if (name.startsWith("wlan")) return host;
          if (fallback == null) fallback = host;
        }
      }
      return fallback;
    } catch (Exception e) {
      Log.w(TAG, "local ip failed: " + e);
      return null;
    }
  }

  private void handle(Socket socket) {
    try {
      InputStream in = new BufferedInputStream(socket.getInputStream());
      String requestLine = readLine(in);
      if (requestLine == null) return;
      String[] parts = requestLine.split(" ");
      if (parts.length < 2) return;
      String method = parts[0];
      String target = parts[1];
      String range = null;
      String timeSeek = null;
      String line;
      while ((line = readLine(in)) != null && !line.isEmpty()) {
        int idx = line.indexOf(':');
        if (idx <= 0) continue;
        String key = line.substring(0, idx).trim().toLowerCase(Locale.US);
        String value = line.substring(idx + 1).trim();
        if (key.equals("range")) range = value;
        else if (key.equals("timeseekrange.dlna.org")) timeSeek = value;
      }
      Log.i(TAG, method + " " + target + " range=" + range + " timeSeek=" + timeSeek);
      OutputStream out = socket.getOutputStream();
      if (target.startsWith("/health")) {
        writeText(out, 200, "OK", "ok");
      } else if (target.startsWith("/cast")) {
        serveCast(target, range, timeSeek, method, out);
      } else if (target.startsWith("/cover")) {
        serveCover(target, method, out);
      } else {
        writeText(out, 404, "Not Found", "not found");
      }
      out.flush();
    } catch (java.io.IOException e) {
      // 电视读完它要的那段就会主动断连，属于正常现象，不要刷 warning
      Log.d(TAG, "media request closed: " + e);
    } catch (Exception e) {
      Log.w(TAG, "media request failed: " + e);
    } finally {
      Ssdp.closeQuietly(socket);
    }
  }

  /** 封面图代理：电视直接拉 CDN 图常常因为 Referer/UA 被拒，这里统一经手机转一手 */
  private void serveCover(String target, String method, OutputStream out) throws IOException {
    String encoded = query(target, "u");
    if (encoded == null) {
      writeText(out, 400, "Bad Request", "missing u");
      return;
    }
    String url = URLDecoder.decode(encoded, "UTF-8");
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      serveLocalCover(url, method, out);
      return;
    }
    IOException last = null;
    for (String referer : referers(url)) {
      HttpURLConnection conn = null;
      try {
        conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setConnectTimeout(8000);
        conn.setReadTimeout(15000);
        conn.setInstanceFollowRedirects(true);
        conn.setRequestProperty("User-Agent", UA);
        conn.setRequestProperty("Accept", "image/*,*/*");
        if (referer != null) conn.setRequestProperty("Referer", referer);
        int code = conn.getResponseCode();
        if (code != 200) {
          last = new IOException("cover http " + code);
          conn.disconnect();
          continue;
        }
        String contentType = conn.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) contentType = "image/jpeg";
        long length = conn.getContentLengthLong();
        StringBuilder head = new StringBuilder();
        head.append("HTTP/1.1 200 OK\r\n");
        head.append("Content-Type: ").append(contentType).append("\r\n");
        if (length >= 0) head.append("Content-Length: ").append(length).append("\r\n");
        head.append("Cache-Control: max-age=600\r\n");
        head.append("Connection: close\r\n\r\n");
        out.write(head.toString().getBytes(StandardCharsets.UTF_8));
        if (!"HEAD".equalsIgnoreCase(method)) {
          InputStream body = conn.getInputStream();
          try {
            byte[] buf = new byte[16 * 1024];
            int n;
            while ((n = body.read(buf)) > 0) out.write(buf, 0, n);
          } finally {
            Ssdp.closeQuietly(body);
          }
        }
        out.flush();
        conn.disconnect();
        return;
      } catch (IOException e) {
        last = e;
        if (conn != null) conn.disconnect();
      }
    }
    Log.w(TAG, "cover fetch failed: " + last + " " + url);
    writeText(out, 502, "Bad Gateway", "cover fetch failed");
  }

  /** 本地封面（content:// / file:// / 绝对路径）：本地音乐投屏时电视看不到手机文件，只能由我们读出来再转发 */
  private void serveLocalCover(String rawPath, String method, OutputStream out) throws IOException {
    InputStream stream = null;
    long total = -1;
    String contentType = null;
    try {
      if (rawPath.startsWith("content://")) {
        android.net.Uri uri = android.net.Uri.parse(rawPath);
        String type = context.getContentResolver().getType(uri);
        if (type != null && type.startsWith("image/")) contentType = type;
        android.content.res.AssetFileDescriptor fd = context.getContentResolver().openAssetFileDescriptor(uri, "r");
        if (fd != null) {
          total = fd.getLength();
          stream = fd.createInputStream();
        }
      } else {
        File file = new File(rawPath.startsWith("file://") ? rawPath.substring(7) : rawPath);
        if (file.exists()) {
          total = file.length();
          stream = new FileInputStream(file);
        }
      }
      if (contentType == null) contentType = contentTypeFor(rawPath);
      if (contentType == null || !contentType.startsWith("image/")) {
        String lower = rawPath.toLowerCase(Locale.US);
        if (lower.contains(".png")) contentType = "image/png";
        else if (lower.contains(".webp")) contentType = "image/webp";
        else contentType = "image/jpeg";
      }
      if (stream == null) {
        writeText(out, 404, "Not Found", "cover not found");
        return;
      }
      StringBuilder head = new StringBuilder();
      head.append("HTTP/1.1 200 OK\r\n");
      head.append("Content-Type: ").append(contentType).append("\r\n");
      if (total >= 0) head.append("Content-Length: ").append(total).append("\r\n");
      head.append("Cache-Control: max-age=600\r\n");
      head.append("Connection: close\r\n\r\n");
      out.write(head.toString().getBytes(StandardCharsets.UTF_8));
      if (!"HEAD".equalsIgnoreCase(method)) {
        byte[] buf = new byte[16 * 1024];
        int n;
        while ((n = stream.read(buf)) > 0) out.write(buf, 0, n);
      }
      out.flush();
    } finally {
      Ssdp.closeQuietly(stream);
    }
  }

  private void serveCast(String target, @Nullable String range, @Nullable String timeSeek, String method, OutputStream out) throws IOException {
    String encoded = query(target, "u");
    if (encoded == null) {
      writeText(out, 400, "Bad Request", "missing u");
      return;
    }
    String url = URLDecoder.decode(encoded, "UTF-8");
    double durationSec = 0;
    String durationParam = query(target, "d");
    if (durationParam != null) {
      try { durationSec = Double.parseDouble(durationParam); } catch (NumberFormatException ignored) {}
    }
    if (url.startsWith("http://") || url.startsWith("https://")) {
      serveRemote(url, range, method, out);
    } else {
      serveLocal(url, range, timeSeek, durationSec, method, out);
    }
  }

  private void serveLocal(String rawPath, @Nullable String range, @Nullable String timeSeek,
                          double durationSec, String method, OutputStream out) throws IOException {
    InputStream stream;
    long total;
    String contentType;
    if (rawPath.startsWith("content://")) {
      Uri uri = Uri.parse(rawPath);
      android.content.res.AssetFileDescriptor fd = null;
      try {
        fd = context.getContentResolver().openAssetFileDescriptor(uri, "r");
      } catch (Exception ignored) {}
      if (fd != null && fd.getLength() > 0) {
        total = fd.getLength();
        stream = fd.createInputStream();
      } else {
        android.os.ParcelFileDescriptor pfd = context.getContentResolver().openFileDescriptor(uri, "r");
        if (pfd == null) {
          writeText(out, 404, "Not Found", "content not found");
          return;
        }
        total = pfd.getStatSize();
        stream = new java.io.FileInputStream(pfd.getFileDescriptor());
      }
      String resolverType = null;
      try {
        resolverType = context.getContentResolver().getType(Uri.parse(rawPath));
      } catch (Exception ignored) {}
      contentType = resolverType != null ? resolverType : contentTypeFor(rawPath);
    } else {
      String path = rawPath.startsWith("file://") ? rawPath.substring(7) : rawPath;
      File file = new File(Uri.decode(path));
      if (!file.isFile()) {
        writeText(out, 404, "Not Found", "file not found");
        return;
      }
      total = file.length();
      stream = new FileInputStream(file);
      contentType = contentTypeFor(file.getName());
    }
    try {
      long start = 0;
      long end = total - 1;
      // 电视的时间轴 seek 会带 TimeSeekRange.dlna.org: npt=216.6-，按平均码率换算成字节区间
      if (timeSeek != null && durationSec > 0 && timeSeek.startsWith("npt=")) {
        String npt = timeSeek.substring(4);
        int dash = npt.indexOf('-');
        String startText = dash >= 0 ? npt.substring(0, dash) : npt;
        try {
          double seconds = parseNptSeconds(startText);
          long offset = (long) (total * Math.min(1d, Math.max(0d, seconds / durationSec)));
          start = Math.min(total - 1, Math.max(0, offset));
          range = "bytes=" + start + "-";
        } catch (NumberFormatException ignored) {}
      }
      long[] parsed = parseRange(range, total);
      if (parsed != null) {
        start = parsed[0];
        end = parsed[1];
      }
      boolean partial = parsed != null;
      long length = Math.max(0, end - start + 1);
      if (start > 0) stream.skip(start);
      StringBuilder head = new StringBuilder();
      head.append(partial ? "HTTP/1.1 206 Partial Content\r\n" : "HTTP/1.1 200 OK\r\n");
      head.append("Content-Type: ").append(contentType).append("\r\n");
      head.append("Content-Length: ").append(length).append("\r\n");
      head.append("Accept-Ranges: bytes\r\n");
      if (partial) head.append("Content-Range: bytes ").append(start).append('-').append(end).append('/').append(total).append("\r\n");
      head.append("contentFeatures.dlna.org: DLNA.ORG_OP=11;DLNA.ORG_FLAGS=01700000000000000000000000000000\r\n");
      if (durationSec > 0) {
        String dur = formatNpt(durationSec);
        head.append("X-AvailableSeekRange: 1 npt=0:00:00-").append(dur).append("\r\n");
      }
      if (timeSeek != null && durationSec > 0) {
        double startSeconds = durationSec * start / Math.max(1, total);
        head.append("TimeSeekRange.dlna.org: npt=")
          .append(String.format(java.util.Locale.US, "%.3f", startSeconds)).append("-")
          .append(String.format(java.util.Locale.US, "%.3f", durationSec)).append("/")
          .append(String.format(java.util.Locale.US, "%.3f", durationSec)).append("\r\n");
      }
      head.append("transferMode.dlna.org: Background\r\n");
      head.append("Connection: close\r\n\r\n");
      out.write(head.toString().getBytes(StandardCharsets.UTF_8));
      if (!"HEAD".equalsIgnoreCase(method)) copyStream(stream, out, length);
    } finally {
      Ssdp.closeQuietly(stream);
    }
  }

  private void serveRemote(String url, @Nullable String range, String method, OutputStream out) throws IOException {
    IOException last = null;
    for (String referer : referers(url)) {
      HttpURLConnection conn = null;
      try {
        conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setConnectTimeout(8000);
        conn.setReadTimeout(20000);
        conn.setInstanceFollowRedirects(true);
        conn.setRequestProperty("User-Agent", UA);
        conn.setRequestProperty("Accept", "*/*");
        if (referer != null) conn.setRequestProperty("Referer", referer);
        if (range != null) conn.setRequestProperty("Range", range);
        int code = conn.getResponseCode();
        if (code != 200 && code != 206) {
          Log.w(TAG, "remote http " + code + " referer=" + referer + " " + url);
          last = new IOException("upstream http " + code);
          conn.disconnect();
          continue;
        }
        String contentType = conn.getContentType();
        if (contentType == null) contentType = contentTypeFor(url);
        long length = conn.getContentLengthLong();
        String contentRange = conn.getHeaderField("Content-Range");
        StringBuilder head = new StringBuilder();
        head.append(code == 206 ? "HTTP/1.1 206 Partial Content\r\n" : "HTTP/1.1 200 OK\r\n");
        head.append("Content-Type: ").append(contentType).append("\r\n");
        if (length >= 0) head.append("Content-Length: ").append(length).append("\r\n");
        if (contentRange != null) head.append("Content-Range: ").append(contentRange).append("\r\n");
        head.append("Accept-Ranges: bytes\r\n");
        head.append("transferMode.dlna.org: Streaming\r\n");
        head.append("Connection: close\r\n\r\n");
        out.write(head.toString().getBytes(StandardCharsets.UTF_8));
        if (!"HEAD".equalsIgnoreCase(method)) {
          InputStream in = conn.getInputStream();
          try {
            copyStream(in, out, length > 0 ? length : -1);
          } finally {
            Ssdp.closeQuietly(in);
          }
        }
        return;
      } catch (IOException e) {
        last = e;
        if (conn != null) conn.disconnect();
      }
    }
    writeText(out, 502, "Bad Gateway", "upstream failed: " + (last == null ? "" : last.getMessage()));
  }

  /**
   * 投屏前探活：真正拉一下 CDN 地址，判断这个 URL 电视还能不能拿到。
   *
   * 在线音源的地址带时效（酷我/QQ 常见 403、410），手机上刚解析出来的地址
   * 有时因为换源/刷新已经失效，直接丢给电视就会起播失败、被当成播完自动切歌。
   * 这里按同样的 UA/Referer 组合发一个 Range: bytes=0-1 的请求，2xx 才算可用。
   *
   * @return HTTP 状态码，全部失败返回 -1
   */
  static int probe(String url) {
    int last = -1;
    for (String referer : referers(url)) {
      HttpURLConnection conn = null;
      try {
        conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setConnectTimeout(6000);
        conn.setReadTimeout(8000);
        conn.setInstanceFollowRedirects(true);
        conn.setRequestProperty("User-Agent", UA);
        conn.setRequestProperty("Accept", "*/*");
        conn.setRequestProperty("Range", "bytes=0-1");
        if (referer != null) conn.setRequestProperty("Referer", referer);
        last = conn.getResponseCode();
        conn.disconnect();
        if (last == 200 || last == 206) return last;
      } catch (Exception e) {
        Log.d(TAG, "probe failed: " + e + " " + url);
        if (conn != null) conn.disconnect();
      }
    }
    return last;
  }

  private static String[] referers(String url) {
    String host = "";
    try {
      host = new URL(url).getHost();
    } catch (Exception ignored) {}
    String lower = host == null ? "" : host.toLowerCase(Locale.US);
    if (lower.contains("gtimg") || lower.contains("qq.com")) return new String[] { null, "https://y.qq.com/" };
    if (lower.contains("126.net") || lower.contains("163.com")) return new String[] { null, "https://music.163.com/" };
    if (lower.contains("kugou")) return new String[] { null, "https://www.kugou.com/" };
    if (lower.contains("kuwo")) return new String[] { null, "https://www.kuwo.cn/" };
    if (lower.contains("12530") || lower.contains("migu")) return new String[] { null, "https://music.migu.cn/" };
    return new String[] { null };
  }

  @Nullable
  private static long[] parseRange(@Nullable String range, long total) {
    if (range == null || total <= 0) return null;
    String value = range.trim();
    if (!value.startsWith("bytes=")) return null;
    value = value.substring(6).trim();
    int dash = value.indexOf('-');
    if (dash < 0) return null;
    try {
      String from = value.substring(0, dash).trim();
      String to = value.substring(dash + 1).trim();
      long start = from.isEmpty() ? 0 : Long.parseLong(from);
      long end = to.isEmpty() ? total - 1 : Long.parseLong(to);
      if (start < 0) start = 0;
      if (end >= total) end = total - 1;
      if (start > end) return null;
      return new long[] { start, end };
    } catch (NumberFormatException e) {
      return null;
    }
  }

  private static void copyStream(InputStream in, OutputStream out, long length) throws IOException {
    byte[] buffer = new byte[64 * 1024];
    long remaining = length;
    while (true) {
      int max = length < 0 ? buffer.length : (int) Math.min(buffer.length, remaining);
      if (max <= 0) break;
      int read = in.read(buffer, 0, max);
      if (read <= 0) break;
      out.write(buffer, 0, read);
      if (length >= 0) remaining -= read;
    }
  }

  private static void writeText(OutputStream out, int code, String reason, String body) throws IOException {
    byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
    String head = "HTTP/1.1 " + code + " " + reason + "\r\n"
      + "Content-Type: text/plain; charset=utf-8\r\n"
      + "Content-Length: " + bytes.length + "\r\n"
      + "Connection: close\r\n\r\n";
    out.write(head.getBytes(StandardCharsets.UTF_8));
    out.write(bytes);
  }

  @Nullable
  private static String query(String target, String key) {
    int idx = target.indexOf('?');
    if (idx < 0) return null;
    String query = target.substring(idx + 1);
    for (String pair : query.split("&")) {
      int eq = pair.indexOf('=');
      if (eq <= 0) continue;
      if (pair.substring(0, eq).equals(key)) return pair.substring(eq + 1);
    }
    return null;
  }

  @Nullable
  private static String readLine(InputStream in) throws IOException {
    StringBuilder line = new StringBuilder();
    int read;
    while ((read = in.read()) != -1) {
      if (read == '\n') return line.toString();
      if (read != '\r') line.append((char) read);
      if (line.length() > 8192) return null;
    }
    return line.length() == 0 ? null : line.toString();
  }

  /** 原始音源地址的真实 MIME：content:// 交给 ContentResolver，其余按扩展名 */
  private static String formatNpt(double seconds) {
    long total = Math.max(0, (long) seconds);
    return String.format(java.util.Locale.US, "%d:%02d:%02d", total / 3600, (total % 3600) / 60, total % 60);
  }

  private static double parseNptSeconds(String text) {
    String[] parts = text.trim().split(":");
    if (parts.length == 3) {
      return Double.parseDouble(parts[0]) * 3600 + Double.parseDouble(parts[1]) * 60 + Double.parseDouble(parts[2]);
    }
    if (parts.length == 2) return Double.parseDouble(parts[0]) * 60 + Double.parseDouble(parts[1]);
    return Double.parseDouble(parts[0]);
  }

  static String mimeOf(android.content.Context context, String rawUrl) {
    if (rawUrl == null) return "audio/mpeg";
    if (rawUrl.startsWith("content://")) {
      try {
        String type = context.getContentResolver().getType(android.net.Uri.parse(rawUrl));
        if (type != null) return type;
      } catch (Exception ignored) {}
    }
    String mime = guessMime(rawUrl);
    return mime == null || "application/octet-stream".equals(mime) ? "audio/mpeg" : mime;
  }

  static String guessMime(String rawUrl) {
    if (rawUrl == null) return "audio/mpeg";
    int q = rawUrl.indexOf('?');
    return contentTypeFor(q >= 0 ? rawUrl.substring(0, q) : rawUrl);
  }

  private static String contentTypeFor(String name) {
    String lower = name.toLowerCase(Locale.US);
    int dot = lower.lastIndexOf('.');
    String ext = dot >= 0 ? lower.substring(dot + 1) : "";
    switch (ext) {
      case "mp3": return "audio/mpeg";
      case "flac": return "audio/flac";
      case "m4a":
      case "mp4": return "audio/mp4";
      case "aac": return "audio/aac";
      case "wav": return "audio/wav";
      case "ogg":
      case "opus": return "audio/ogg";
      case "ape": return "audio/x-ape";
      case "wma": return "audio/x-ms-wma";
      case "m4b": return "audio/mp4";
      default: return "application/octet-stream";
    }
  }
}
