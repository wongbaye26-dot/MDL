package cn.emomusic.mobile.download;

import androidx.annotation.Nullable;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

/**
 * 下载任务事件发送器
 * 所有事件通过 download-event 这一个通道发送，action 区分类型
 */
public class DownloadEvent {
  static final String EVENT_NAME = "download-event";

  private final ReactApplicationContext reactContext;

  DownloadEvent(ReactApplicationContext reactContext) {
    this.reactContext = reactContext;
  }

  private void sendEvent(@Nullable WritableMap params) {
    if (!reactContext.hasActiveCatalystInstance()) return;
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
      .emit(EVENT_NAME, params);
  }

  public void progress(String id, long downloaded, long total, long speed) {
    WritableMap map = Arguments.createMap();
    map.putString("action", "progress");
    map.putString("id", id);
    map.putDouble("downloaded", downloaded);
    map.putDouble("total", total);
    map.putDouble("speed", speed);
    sendEvent(map);
  }

  public void start(String id, long downloaded, long total) {
    WritableMap map = Arguments.createMap();
    map.putString("action", "start");
    map.putString("id", id);
    map.putDouble("downloaded", downloaded);
    map.putDouble("total", total);
    sendEvent(map);
  }

  public void pause(String id, long downloaded, long total) {
    WritableMap map = Arguments.createMap();
    map.putString("action", "pause");
    map.putString("id", id);
    map.putDouble("downloaded", downloaded);
    map.putDouble("total", total);
    sendEvent(map);
  }

  public void complete(String id, long total) {
    WritableMap map = Arguments.createMap();
    map.putString("action", "complete");
    map.putString("id", id);
    map.putDouble("total", total);
    sendEvent(map);
  }

  /**
   * @param code 错误码，-1 表示未知，其余为 HTTP 状态码或 0（网络异常）
   */
  public void error(String id, int code, String message, long downloaded) {
    WritableMap map = Arguments.createMap();
    map.putString("action", "error");
    map.putString("id", id);
    map.putInt("code", code);
    map.putString("message", message == null ? "" : message);
    map.putDouble("downloaded", downloaded);
    sendEvent(map);
  }
}
