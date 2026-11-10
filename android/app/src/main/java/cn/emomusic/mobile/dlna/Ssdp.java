package cn.emomusic.mobile.dlna;

import android.util.Log;

import androidx.annotation.Nullable;

import org.xmlpull.v1.XmlPullParser;
import org.xmlpull.v1.XmlPullParserFactory;

import java.io.IOException;
import java.io.InputStream;
import java.io.StringReader;
import java.net.DatagramPacket;
import java.net.InetAddress;
import java.net.MulticastSocket;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/** SSDP 搜索 + 设备描述（LOCATION）解析，只认 MediaRenderer */
final class Ssdp {
  private static final String TAG = "EmoDlna";
  private static final String GROUP = "239.255.255.250";
  private static final int PORT = 1900;

  interface DeviceCallback {
    void onDevice(UpnpDevice device);
  }

  private Ssdp() {}

  /**
   * 搜索 MediaRenderer。
   *
   * @param cancel 外部置为 true 时尽快结束
   * @param onDevice 每发现一个新设备回调一次（在主调用线程上）
   */
  static void search(final long timeoutMs, final DeviceCallback onDevice, final java.util.concurrent.atomic.AtomicBoolean cancel) {
    MulticastSocket socket = null;
    try {
      socket = new MulticastSocket(0);
      socket.setTimeToLive(4);
      socket.setSoTimeout(800);
      InetAddress group = InetAddress.getByName(GROUP);
      byte[] packet = buildSearch(true);
      byte[] packetAll = buildSearch(false);
      socket.send(new DatagramPacket(packet, packet.length, group, PORT));
      socket.send(new DatagramPacket(packetAll, packetAll.length, group, PORT));

      long deadline = System.currentTimeMillis() + timeoutMs;
      long nextResend = System.currentTimeMillis() + 1500;
      Set<String> seen = new HashSet<>();
      byte[] buffer = new byte[4096];
      while (!cancel.get() && System.currentTimeMillis() < deadline) {
        if (System.currentTimeMillis() >= nextResend) {
          socket.send(new DatagramPacket(packet, packet.length, group, PORT));
          nextResend = System.currentTimeMillis() + 1500;
        }
        DatagramPacket response = new DatagramPacket(buffer, buffer.length);
        try {
          socket.receive(response);
        } catch (java.net.SocketTimeoutException ignored) {
          continue;
        }
        String text = new String(response.getData(), 0, response.getLength(), StandardCharsets.UTF_8);
        String location = header(text, "LOCATION");
        if (location == null) continue;
        String lower = location.toLowerCase(Locale.US);
        if (!seen.add(lower)) continue;
        UpnpDevice device = describe(location);
        if (device != null) onDevice.onDevice(device);
      }
    } catch (Exception e) {
      Log.w(TAG, "ssdp search failed: " + e);
    } finally {
      if (socket != null) {
        try {
          socket.close();
        } catch (Exception ignored) {}
      }
    }
  }

  private static byte[] buildSearch(boolean mediaRenderer) {
    String st = mediaRenderer ? "urn:schemas-upnp-org:device:MediaRenderer:1" : "ssdp:all";
    String request = "M-SEARCH * HTTP/1.1\r\n"
      + "HOST: " + GROUP + ":" + PORT + "\r\n"
      + "MAN: \"ssdp:discover\"\r\n"
      + "MX: 2\r\n"
      + "ST: " + st + "\r\n"
      + "\r\n";
    return request.getBytes(StandardCharsets.UTF_8);
  }

  @Nullable
  private static String header(String response, String key) {
    for (String line : response.split("\r\n")) {
      int idx = line.indexOf(':');
      if (idx <= 0) continue;
      if (line.substring(0, idx).trim().equalsIgnoreCase(key)) {
        String value = line.substring(idx + 1).trim();
        return value.isEmpty() ? null : value;
      }
    }
    return null;
  }

  /**
   * 拉取并解析设备描述 XML，没有 AVTransport 服务的直接丢弃。
   *
   * 设备描述一定是局域网明文 http，而应用的 network_security_config 默认禁明文，
   * HttpURLConnection 会抛 CleartextNotPermitted —— 所以这里用自己实现的 HttpLite。
   */
  @Nullable
  private static UpnpDevice describe(String location) {
    try {
      String xml = HttpLite.get(location);
      if (xml == null || xml.isEmpty()) {
        Log.w(TAG, "describe empty " + location);
        return null;
      }
      XmlPullParser parser = XmlPullParserFactory.newInstance().newPullParser();
      parser.setInput(new StringReader(xml));
      return parseDescription(parser, location);
    } catch (Exception e) {
      Log.w(TAG, "describe failed " + location + " : " + e);
      return null;
    }
  }

  private static final class DeviceInfo {
    String friendlyName = "";
    String modelName = "";
    String udn = "";
    String avTransport;
    String renderingControl;
    String connectionManager;
  }

  @Nullable
  private static UpnpDevice parseDescription(XmlPullParser parser, String location) throws Exception {
    List<DeviceInfo> stack = new ArrayList<>();
    String currentServiceType = null;
    String currentControlUrl = null;
    boolean inService = false;
    String text = null;
    int event = parser.getEventType();
    while (event != XmlPullParser.END_DOCUMENT) {
      if (event == XmlPullParser.START_TAG) {
        String name = local(parser.getName());
        if ("device".equals(name)) {
          stack.add(new DeviceInfo());
        } else if ("serviceList".equals(name)) {
          inService = false;
        } else if ("service".equals(name)) {
          inService = true;
          currentServiceType = null;
          currentControlUrl = null;
        } else if ("serviceType".equals(name) && inService) {
          currentServiceType = parser.nextText().trim();
        } else if ("controlURL".equals(name) && inService) {
          currentControlUrl = parser.nextText().trim();
        }
      } else if (event == XmlPullParser.TEXT) {
        text = parser.getText();
      } else if (event == XmlPullParser.END_TAG) {
        String name = local(parser.getName());
        if (stack.isEmpty()) {
          event = parser.next();
          continue;
        }
        DeviceInfo device = stack.get(stack.size() - 1);
        if ("friendlyName".equals(name)) device.friendlyName = text == null ? "" : text.trim();
        else if ("modelName".equals(name)) device.modelName = text == null ? "" : text.trim();
        else if ("UDN".equals(name)) device.udn = text == null ? "" : text.trim();
        else if ("service".equals(name) && inService) {
          inService = false;
          if (currentServiceType != null && currentControlUrl != null) {
            String control = resolve(location, currentControlUrl);
            if (currentServiceType.contains("AVTransport")) device.avTransport = control;
            else if (currentServiceType.contains("RenderingControl")) device.renderingControl = control;
            else if (currentServiceType.contains("ConnectionManager")) device.connectionManager = control;
          }
        } else if ("device".equals(name)) {
          stack.remove(stack.size() - 1);
          if (device.avTransport != null) {
            String id = device.udn.isEmpty() ? location : device.udn.replace("uuid:", "");
            String friendly = device.friendlyName.isEmpty() ? new URL(location).getHost() : device.friendlyName;
            String model = device.modelName.isEmpty() ? "" : device.modelName;
            return new UpnpDevice(id, friendly, model, location, device.udn, device.avTransport,
              device.renderingControl, device.connectionManager);
          }
        }
        text = null;
      }
      event = parser.next();
    }
    return null;
  }

  private static String local(String name) {
    int idx = name.indexOf(':');
    return idx >= 0 ? name.substring(idx + 1) : name;
  }

  private static String resolve(String base, String path) {
    try {
      return new URL(new URL(base), path).toString();
    } catch (Exception e) {
      return path;
    }
  }

  /** 从 XML 文本里读一个字段（SOAP 响应用，名字可能带命名空间前缀） */
  @Nullable
  static String xmlValue(String xml, String tag) {
    try {
      XmlPullParser parser = XmlPullParserFactory.newInstance().newPullParser();
      parser.setInput(new StringReader(xml));
      int event = parser.getEventType();
      while (event != XmlPullParser.END_DOCUMENT) {
        if (event == XmlPullParser.START_TAG && tag.equals(local(parser.getName()))) {
          return parser.nextText();
        }
        event = parser.next();
      }
    } catch (Exception ignored) {}
    return null;
  }

  static void closeQuietly(@Nullable java.io.Closeable closeable) {
    if (closeable == null) return;
    try {
      closeable.close();
    } catch (IOException ignored) {}
  }
}
