package cn.emomusic.mobile.dlna;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.Nullable;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.io.IOException;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * DLNA 投屏会话：搜索 MediaRenderer、建立连接、把当前曲目推给电视、同步进度。
 *
 * 设计上只做「一台电视一个会话」，够用且状态简单：连接时起本地 HTTP 服务，
 * 断开时停掉服务并清空状态。
 */
public final class DlnaManager {
  private static final String TAG = "EmoDlna";

  static final String EVENT_DEVICES = "DlnaDevices";
  static final String EVENT_SEARCH = "DlnaSearchState";
  static final String EVENT_CONNECTION = "DlnaConnection";
  static final String EVENT_STATE = "DlnaState";
  static final String EVENT_ERROR = "DlnaError";

  private final ReactApplicationContext context;
  private final ExecutorService worker = Executors.newSingleThreadExecutor();
  private final Handler main = new Handler(Looper.getMainLooper());
  private final Map<String, UpnpDevice> devices = new LinkedHashMap<>();
  private final AtomicBoolean cancelSearch = new AtomicBoolean(false);

  @Nullable
  private MediaServer server;
  @Nullable
  private UpnpDevice activeDevice;
  private boolean searching;
  private boolean casting;
  @Nullable
  private String localIp;
  private int volume = 0;
  /** 电视上报的曲目时长（秒）：轮询里 TrackDuration 偶尔为空，保留上一次的 */
  private long lastDuration = 0;
  private String lastLoggedState = "";
  private long lastPollLogAt = 0;

  /** MainActivity 拦截音量键时用它（同一时间只有一个投屏会话） */
  @Nullable
  static DlnaManager active;

  public static boolean isCastingNow() {
    DlnaManager manager = active;
    return manager != null && manager.casting;
  }

  /** 手机音量键：把 ± 步进直接打到电视的 RenderingControl 上，返回调整后的电视音量（0-100，非投屏返回 -1） */
  public static int nudgeVolume(int delta) {
    DlnaManager manager = active;
    return manager != null ? manager.adjustVolume(delta) : -1;
  }

  DlnaManager(ReactApplicationContext context) {
    this.context = context;
    active = this;
  }

  // ───────────────────────── 搜索 ─────────────────────────

  void search() {
    if (searching) return;
    searching = true;
    cancelSearch.set(false);
    emitSearch(true);
    worker.execute(() -> {
      try {
        Ssdp.search(4500, device -> {
          boolean added;
          synchronized (devices) {
            added = devices.put(device.id, device) == null;
          }
          if (added) emitDevices();
        }, cancelSearch);
      } finally {
        searching = false;
        emitSearch(false);
      }
    });
  }

  void stopSearch() {
    cancelSearch.set(true);
  }

  WritableArray deviceList() {
    WritableArray array = Arguments.createArray();
    synchronized (devices) {
      for (UpnpDevice device : devices.values()) array.pushMap(device.toMap());
    }
    return array;
  }

  // ───────────────────────── 连接 / 断开 ─────────────────────────

  void connect(String id) {
    UpnpDevice device;
    synchronized (devices) {
      device = devices.get(id);
    }
    if (device == null) {
      emitError("设备已不在线，请重新搜索");
      return;
    }
    worker.execute(() -> {
      try {
        MediaServer mediaServer = new MediaServer(context);
        int port = mediaServer.start();
        server = mediaServer;
        activeDevice = device;
        localIp = MediaServer.localIpv4();
        casting = false;
        readTvVolume();
        Log.i(TAG, "connected " + device.name + " media server port " + port + " ip " + localIp);
        emitConnection(true, device);
      } catch (IOException e) {
        Log.w(TAG, "connect failed: " + e);
        emitError("连接电视失败：" + e.getMessage());
      }
    });
  }

  void disconnect() {
    worker.execute(() -> {
      if (activeDevice != null) {
        try {
          Soap.invoke(activeDevice.avTransport, Soap.AV_TRANSPORT, "Stop", instanceArgs());
        } catch (IOException ignored) {}
      }
      stopPolling();
      casting = false;
      activeDevice = null;
      localIp = null;
      if (server != null) {
        server.stop();
        server = null;
      }
      emitConnection(false, null);
    });
  }

  private void readTvVolume() {
    UpnpDevice device = activeDevice;
    if (device == null || device.renderingControl == null) return;
    worker.execute(() -> {
      try {
        String response = Soap.invoke(device.renderingControl, Soap.RENDERING_CONTROL, "GetVolume",
          "<InstanceID>0</InstanceID><Channel>Master</Channel>");
        String text = Soap.value(response, "CurrentVolume");
        if (text != null) volume = Math.max(0, Math.min(100, (int) Double.parseDouble(text)));
        Log.i(TAG, "tv volume " + volume);
      } catch (Exception e) {
        Log.w(TAG, "read tv volume failed: " + e);
      }
    });
  }

  /** 手机音量键 +5 / -5，直接改电视音量，并把百分比冒泡到 JS 用来提示 */
  private int adjustVolume(int delta) {
    UpnpDevice device = activeDevice;
    if (device == null || device.renderingControl == null) return -1;
    int next = Math.max(0, Math.min(100, volume + delta));
    if (next == volume) return volume;
    volume = next;
    main.post(() -> emitVolume(volume));
    worker.execute(() -> {
      try {
        Soap.invoke(device.renderingControl, Soap.RENDERING_CONTROL, "SetVolume",
          "<InstanceID>0</InstanceID><Channel>Master</Channel><DesiredVolume>" + volume + "</DesiredVolume>");
      } catch (Exception e) {
        Log.w(TAG, "set tv volume failed: " + e);
      }
    });
    return volume;
  }

  private void emitVolume(int value) {
    WritableMap payload = Arguments.createMap();
    payload.putInt("volume", value);
    try {
      context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class).emit("DlnaVolume", payload);
    } catch (Exception ignored) {}
  }

  // ───────────────────────── 投屏 ─────────────────────────

  /**
   * 把一首歌推给电视。
   *
   * @param url  本地路径 / content:// / http(s) 原始地址
   * @param coverUrl 封面（http(s) 才传给电视，本地封面电视拉不到）
   */
  void cast(String url, String title, String artist, String album, String coverUrl, double durationSec) {
    worker.execute(() -> {
      UpnpDevice device = activeDevice;
      MediaServer mediaServer = server;
      if (device == null || mediaServer == null) {
        emitError("还没连接电视");
        return;
      }
      try {
        String ip = localIp == null ? MediaServer.localIpv4() : localIp;
        if (ip == null) {
          emitError("手机没有连上 WiFi");
          return;
        }
        String streamUrl = "http://" + ip + ":" + mediaServer.getPort() + "/cast?u="
          + URLEncoder.encode(url, "UTF-8") + "&d=" + Math.max(1, (long) durationSec);
        // 封面统一走手机代理：在线图避免 Referer/UA 被拒，本地图电视根本访问不到
        String coverProxy = coverUrl;
        if (coverUrl != null && !coverUrl.isEmpty()) {
          coverProxy = "http://" + ip + ":" + mediaServer.getPort() + "/cover?u=" + URLEncoder.encode(coverUrl, "UTF-8");
        }
        String metadata = buildMetadata(streamUrl, MediaServer.mimeOf(context, url), title, artist, album, coverProxy, durationSec);
        String args = instanceArgs()
          + "<CurrentURI>" + escape(streamUrl) + "</CurrentURI>"
          + "<CurrentURIMetaData>" + escape(metadata) + "</CurrentURIMetaData>";
        Soap.invoke(device.avTransport, Soap.AV_TRANSPORT, "SetAVTransportURI", args);
        try {
          Soap.invoke(device.avTransport, Soap.AV_TRANSPORT, "Play", instanceArgs() + "<Speed>1</Speed>");
        } catch (IOException first) {
          // 部分电视设置 URI 后需要一点时间准备
          Thread.sleep(400);
          Soap.invoke(device.avTransport, Soap.AV_TRANSPORT, "Play", instanceArgs() + "<Speed>1</Speed>");
        }
        casting = true;
        lastDuration = (long) durationSec;
        lastLoggedState = "PLAYING";
        startPolling();
        Log.i(TAG, "cast " + title + " -> " + streamUrl);
        emitState("PLAYING", 0, (long) durationSec);
      } catch (Exception e) {
        Log.w(TAG, "cast failed: " + e);
        emitError("投屏失败：" + e.getMessage());
      }
    });
  }

  void control(String action, double value) {
    worker.execute(() -> {
      UpnpDevice device = activeDevice;
      if (device == null) {
        Log.w(TAG, "control " + action + " ignored: no device");
        return;
      }
      Log.i(TAG, "control " + action + " value=" + value);
      try {
        switch (action) {
          case "play":
            Soap.invoke(device.avTransport, Soap.AV_TRANSPORT, "Play", instanceArgs() + "<Speed>1</Speed>");
            break;
          case "pause":
            Soap.invoke(device.avTransport, Soap.AV_TRANSPORT, "Pause", instanceArgs());
            break;
          case "stop":
            Soap.invoke(device.avTransport, Soap.AV_TRANSPORT, "Stop", instanceArgs());
            break;
          case "seek": {
            long seconds = Math.max(0, (long) value);
            String target = formatTime(seconds);
            String args = instanceArgs() + "<Unit>REL_TIME</Unit><Target>" + target + "</Target>";
            try {
              Soap.invoke(device.avTransport, Soap.AV_TRANSPORT, "Seek", args);
            } catch (IOException first) {
              // 过渡期会回 701；Samsung 这类渲染器列表里还提供私有的 X_DLNA_SeekTime
              try {
                Thread.sleep(500);
                Soap.invoke(device.avTransport, Soap.AV_TRANSPORT, "Seek", args);
              } catch (Exception second) {
                try {
                  Soap.invoke(device.avTransport, Soap.AV_TRANSPORT, "X_DLNA_SeekTime", args);
                } catch (Exception ignored) {
                  // 电视确实不支持这首 seek，静默失败，进度由轮询纠正
                }
              }
            }
            break;
          }
          case "volume":
            if (device.renderingControl == null) return;
            volume = Math.max(0, Math.min(100, (int) value));
            Soap.invoke(device.renderingControl, Soap.RENDERING_CONTROL, "SetVolume",
              "<InstanceID>0</InstanceID><Channel>Master</Channel><DesiredVolume>" + volume + "</DesiredVolume>");
            break;
          default:
            break;
        }
      } catch (IOException e) {
        Log.w(TAG, "control " + action + " failed: " + e);
        emitError("电视操作失败：" + e.getMessage());
      }
    });
  }

  // ───────────────────────── 状态轮询 ─────────────────────────

  private final Runnable pollTask = new Runnable() {
    @Override
    public void run() {
      if (!casting || activeDevice == null) return;
      worker.execute(() -> {
        UpnpDevice device = activeDevice;
        if (device == null || !casting) return;
        try {
          String transport = Soap.invoke(device.avTransport, Soap.AV_TRANSPORT, "GetTransportInfo", instanceArgs());
          String state = Soap.value(transport, "CurrentTransportState");
          String positionResponse = Soap.invoke(device.avTransport, Soap.AV_TRANSPORT, "GetPositionInfo", instanceArgs());
          String relTime = Soap.value(positionResponse, "RelTime");
          String duration = Soap.value(positionResponse, "TrackDuration");
          String uri = Soap.value(positionResponse, "TrackURI");
          long parsedPosition = parseTime(relTime);
          long parsedDuration = parseTime(duration);
          if (parsedDuration > 0) lastDuration = parsedDuration;
          emitState(state == null ? "UNKNOWN" : state, parsedPosition, lastDuration);
          lastLoggedState = state == null ? "UNKNOWN" : state;
          if ((System.currentTimeMillis() - lastPollLogAt) > 5000) {
            lastPollLogAt = System.currentTimeMillis();
            Log.i(TAG, "poll " + lastLoggedState + " pos=" + parsedPosition + " dur=" + lastDuration);
          }
          if ("STOPPED".equals(state) && uri != null && !uri.isEmpty()) {
            // 电视播放完了：交给 JS 决定要不要自动下一首
            emitEvent(EVENT_STATE, stateMap("STOPPED", parsedPosition, lastDuration, true));
          }
        } catch (Exception e) {
          Log.w(TAG, "poll failed: " + e);
        } finally {
          if (casting) main.postDelayed(pollTask, 1000);
        }
      });
    }
  };

  private void startPolling() {
    main.removeCallbacks(pollTask);
    main.postDelayed(pollTask, 800);
  }

  private void stopPolling() {
    main.removeCallbacks(pollTask);
  }

  // ───────────────────────── 工具 ─────────────────────────

  private static String instanceArgs() {
    return "<InstanceID>0</InstanceID>";
  }

  private static String buildMetadata(String streamUrl, String mime, String title, String artist, String album,
                                      String coverUrl, double durationSec) {
    StringBuilder didl = new StringBuilder();
    didl.append("<DIDL-Lite xmlns=\"urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/\"")
      .append(" xmlns:dc=\"http://purl.org/dc/elements/1.1/\"")
      .append(" xmlns:upnp=\"urn:schemas-upnp-org:metadata-1-0/upnp/\">")
      .append("<item id=\"1\" parentID=\"0\" restricted=\"1\">")
      .append("<dc:title>").append(escape(title)).append("</dc:title>")
      .append("<dc:creator>").append(escape(artist)).append("</dc:creator>")
      .append("<upnp:artist>").append(escape(artist)).append("</upnp:artist>")
      .append("<upnp:album>").append(escape(album)).append("</upnp:album>")
      .append("<upnp:class>object.item.audioItem.musicTrack</upnp:class>");
    if (coverUrl != null && (coverUrl.startsWith("http://") || coverUrl.startsWith("https://"))) {
      didl.append("<upnp:albumArtURI>").append(escape(coverUrl)).append("</upnp:albumArtURI>");
    }
    // protocolInfo 带上 DLNA seek 能力位：OP=01（支持 Range 字节 seek），FLAGS 标准 seekable 标记
    // 不带这些标记时 Samsung 电视会认为音源不可拖动，Seek 直接回 501/701
    didl.append("<res protocolInfo=\"http-get:*:").append(mime)
      .append(":DLNA.ORG_OP=11;DLNA.ORG_FLAGS=01700000000000000000000000000000\"")
      .append(" duration=\"").append(formatTime((long) durationSec)).append("\">")
      .append(escape(streamUrl)).append("</res>")
      .append("</item></DIDL-Lite>");
    return didl.toString();
  }

  private static String escape(String value) {
    if (value == null) return "";
    return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
      .replace("\"", "&quot;").replace("'", "&apos;");
  }

  private static String formatTime(long seconds) {
    long h = seconds / 3600;
    long m = (seconds % 3600) / 60;
    long s = seconds % 60;
    return String.format(java.util.Locale.US, "%02d:%02d:%02d", h, m, s);
  }

  private static long parseTime(@Nullable String value) {
    if (value == null) return 0;
    // 电视常用 "0:04:33.832" 这种带毫秒的格式，先把小数部分去掉
    int dot = value.indexOf('.');
    String text = dot >= 0 ? value.substring(0, dot) : value;
    String[] parts = text.split(":");
    try {
      if (parts.length == 3) {
        return Long.parseLong(parts[0]) * 3600 + Long.parseLong(parts[1]) * 60 + Long.parseLong(parts[2]);
      }
      if (parts.length == 2) {
        return Long.parseLong(parts[0]) * 60 + Long.parseLong(parts[1]);
      }
      return Long.parseLong(text);
    } catch (NumberFormatException e) {
      return 0;
    }
  }

  private WritableMap stateMap(String transport, long position, long duration, boolean ended) {
    WritableMap map = Arguments.createMap();
    map.putString("transport", transport == null ? "UNKNOWN" : transport);
    map.putDouble("position", position);
    map.putDouble("duration", duration);
    map.putBoolean("ended", ended);
    return map;
  }

  private void emitState(String transport, long position, long duration) {
    emitEvent(EVENT_STATE, stateMap(transport, position, duration, false));
  }

  private void emitConnection(boolean connected, @Nullable UpnpDevice device) {
    WritableMap map = Arguments.createMap();
    map.putBoolean("connected", connected);
    if (device != null) map.putMap("device", device.toMap());
    emitEvent(EVENT_CONNECTION, map);
  }

  private void emitDevices() {
    emitEvent(EVENT_DEVICES, deviceList());
  }

  private void emitSearch(boolean active) {
    WritableMap map = Arguments.createMap();
    map.putBoolean("searching", active);
    emitEvent(EVENT_SEARCH, map);
  }

  private void emitError(String message) {
    WritableMap map = Arguments.createMap();
    map.putString("message", message);
    emitEvent(EVENT_ERROR, map);
  }

  private void emitEvent(String name, Object payload) {
    main.post(() -> {
      if (!context.hasActiveReactInstance()) return;
      context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class).emit(name, payload);
    });
  }

  void destroy() {
    disconnect();
    worker.shutdownNow();
    stopPolling();
  }

  List<UpnpDevice> snapshotDevices() {
    synchronized (devices) {
      return new ArrayList<>(devices.values());
    }
  }
}
