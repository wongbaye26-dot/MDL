package cn.emomusic.mobile.dlna;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;

import java.util.List;

/**
 * 投屏（DLNA）模块。
 *
 * JS 侧只关心四件事：搜索到哪些电视、连上了没、推哪首歌、播放/暂停/进度。
 * 事件通过 RCTDeviceEventEmitter 回传，避免轮询 Promise。
 */
public class DlnaModule extends ReactContextBaseJavaModule {
  private final DlnaManager manager;

  public DlnaModule(ReactApplicationContext reactContext) {
    super(reactContext);
    manager = new DlnaManager(reactContext);
  }

  @Override
  public String getName() {
    return "DlnaModule";
  }

  @ReactMethod
  public void startSearch() {
    manager.search();
  }

  @ReactMethod
  public void stopSearch() {
    manager.stopSearch();
  }

  @ReactMethod
  public void getDevices(Promise promise) {
    try {
      List<UpnpDevice> devices = manager.snapshotDevices();
      WritableArray array = com.facebook.react.bridge.Arguments.createArray();
      for (UpnpDevice device : devices) array.pushMap(device.toMap());
      promise.resolve(array);
    } catch (Exception e) {
      promise.reject("dlna_devices_failed", e);
    }
  }

  @ReactMethod
  public void connect(String id) {
    manager.connect(id);
  }

  @ReactMethod
  public void disconnect() {
    manager.disconnect();
  }

  @ReactMethod
  public void cast(String url, String title, String artist, String album, String cover, double duration) {
    manager.cast(url, title == null ? "" : title, artist == null ? "" : artist,
      album == null ? "" : album, cover == null ? "" : cover, duration);
  }

  @ReactMethod
  public void control(String action, double value) {
    manager.control(action, value);
  }

  @Override
  public void invalidate() {
    manager.destroy();
    super.invalidate();
  }
}
