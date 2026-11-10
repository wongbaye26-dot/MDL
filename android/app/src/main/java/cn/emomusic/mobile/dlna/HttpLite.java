package cn.emomusic.mobile.dlna;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

/**
 * 极简 HTTP/1.1 客户端。
 *
 * 为什么不用 HttpURLConnection：
 *  - 应用的 network_security_config 默认禁止明文，只对音乐源 CDN 放开了特定域名；
 *  - DLNA 的设备描述、SOAP 控制、媒体代理全都跑在局域网 IP 上（http://192.168.x.x），
 *    走 HttpURLConnection 会被 CleartextNotPermitted 直接拦掉；
 *  - 给每个局域网设备动态放行做不到（配置只能是域名/IP 白名单）。
 * 明文策略只在 HTTP 栈里检查，裸 Socket 不受影响，所以这里自己发请求。
 * 只支持我们实际用到的最小集合：GET / POST、Content-Length、chunked、跟随 3 次重定向。
 */
final class HttpLite {

  private HttpLite() {}

  static String get(String url) throws IOException {
    return request("GET", url, null, null);
  }

  static String post(String url, String body, String soapAction) throws IOException {
    return request("POST", url, body, soapAction);
  }

  /** 不抛状态码异常：SOAP 失败时 UPnP 的错误正文就在 body 里，需要读出来 */
  static Result exchange(String method, String url, String body, String soapAction) throws IOException {
    return execute(method, url, body, soapAction);
  }

  private static String request(String method, String url, String body, String soapAction) throws IOException {
    String current = url;
    for (int redirect = 0; redirect < 4; redirect++) {
      Result response = execute(method, current, body, soapAction);
      if (response.status >= 300 && response.status < 400 && response.location != null) {
        current = resolve(current, response.location);
        // 重定向后按 GET 重新取（UPnP 描述偶尔会 301 到另一个端口）
        method = "GET";
        body = null;
        soapAction = null;
        continue;
      }
      if (response.status < 200 || response.status >= 300) {
        throw new IOException("HTTP " + response.status + " for " + current);
      }
      return response.body;
    }
    throw new IOException("too many redirects: " + url);
  }

  private static String resolve(String base, String location) throws IOException {
    try {
      return URI.create(base).resolve(location).toString();
    } catch (IllegalArgumentException e) {
      throw new IOException("bad redirect location: " + location, e);
    }
  }

  static final class Result {
    int status;
    String location;
    String body = "";
  }

  private static Result execute(String method, String url, String body, String soapAction) throws IOException {
    URI uri;
    try {
      uri = URI.create(url);
    } catch (IllegalArgumentException e) {
      throw new IOException("bad url: " + url, e);
    }
    String scheme = uri.getScheme() == null ? "http" : uri.getScheme().toLowerCase(Locale.US);
    if (!scheme.equals("http")) throw new IOException("only http supported: " + url);

    String host = uri.getHost();
    if (host == null) throw new IOException("no host in url: " + url);
    int port = uri.getPort() > 0 ? uri.getPort() : 80;
    String path = uri.getRawPath();
    if (path == null || path.isEmpty()) path = "/";
    if (uri.getRawQuery() != null) path += "?" + uri.getRawQuery();

    byte[] bodyBytes = body == null ? null : body.getBytes(StandardCharsets.UTF_8);

    Socket socket = new Socket();
    try {
      socket.connect(new InetSocketAddress(host, port), 8000);
      socket.setSoTimeout(15000);

      StringBuilder head = new StringBuilder();
      head.append(method).append(' ').append(path).append(" HTTP/1.1\r\n");
      head.append("Host: ").append(host);
      if (port != 80) head.append(':').append(port);
      head.append("\r\n");
      head.append("Connection: close\r\n");
      head.append("Accept: */*\r\n");
      if (bodyBytes != null) {
        head.append("Content-Type: text/xml; charset=\"utf-8\"\r\n");
        if (soapAction != null) {
          head.append("SOAPACTION: \"").append(soapAction).append("\"\r\n");
        }
        head.append("Content-Length: ").append(bodyBytes.length).append("\r\n");
      }
      head.append("\r\n");

      OutputStream out = socket.getOutputStream();
      out.write(head.toString().getBytes(StandardCharsets.UTF_8));
      if (bodyBytes != null) out.write(bodyBytes);
      out.flush();

      InputStream in = socket.getInputStream();
      Result response = new Result();
      String statusLine = readLine(in);
      if (statusLine == null) throw new IOException("empty response from " + url);
      String[] parts = statusLine.split(" ");
      if (parts.length < 2) throw new IOException("bad status line: " + statusLine);
      response.status = Integer.parseInt(parts[1]);

      long contentLength = -1;
      boolean chunked = false;
      String line;
      while ((line = readLine(in)) != null && !line.isEmpty()) {
        int colon = line.indexOf(':');
        if (colon <= 0) continue;
        String name = line.substring(0, colon).trim().toLowerCase(Locale.US);
        String value = line.substring(colon + 1).trim();
        if (name.equals("content-length")) {
          try {
            contentLength = Long.parseLong(value);
          } catch (NumberFormatException ignored) {
          }
        } else if (name.equals("transfer-encoding") && value.toLowerCase(Locale.US).contains("chunked")) {
          chunked = true;
        } else if (name.equals("location")) {
          response.location = value;
        }
      }

      ByteArrayOutputStream buffer = new ByteArrayOutputStream();
      if (chunked) {
        while (true) {
          String sizeLine = readLine(in);
          if (sizeLine == null) break;
          int semi = sizeLine.indexOf(';');
          if (semi >= 0) sizeLine = sizeLine.substring(0, semi);
          sizeLine = sizeLine.trim();
          if (sizeLine.isEmpty()) continue;
          int size;
          try {
            size = Integer.parseInt(sizeLine, 16);
          } catch (NumberFormatException e) {
            break;
          }
          if (size == 0) break;
          copy(in, buffer, size);
          readLine(in); // 每块后面的 CRLF
          if (buffer.size() > 4L * 1024 * 1024) break;
        }
      } else if (contentLength >= 0) {
        copy(in, buffer, (int) Math.min(contentLength, 4L * 1024 * 1024));
      } else {
        byte[] chunk = new byte[8192];
        int read;
        while ((read = in.read(chunk)) > 0) {
          buffer.write(chunk, 0, read);
          if (buffer.size() > 4L * 1024 * 1024) break;
        }
      }
      response.body = buffer.toString(StandardCharsets.UTF_8.name());
      return response;
    } finally {
      try {
        socket.close();
      } catch (IOException ignored) {
      }
    }
  }

  private static void copy(InputStream in, ByteArrayOutputStream out, int bytes) throws IOException {
    byte[] chunk = new byte[8192];
    int remaining = bytes;
    while (remaining > 0) {
      int read = in.read(chunk, 0, Math.min(chunk.length, remaining));
      if (read < 0) return;
      out.write(chunk, 0, read);
      remaining -= read;
    }
  }

  private static String readLine(InputStream in) throws IOException {
    ByteArrayOutputStream buffer = new ByteArrayOutputStream();
    int b;
    boolean any = false;
    while ((b = in.read()) >= 0) {
      any = true;
      if (b == '\n') break;
      if (b != '\r') buffer.write(b);
      if (buffer.size() > 16 * 1024) break;
    }
    if (!any && buffer.size() == 0) return null;
    return buffer.toString(StandardCharsets.UTF_8.name());
  }
}
