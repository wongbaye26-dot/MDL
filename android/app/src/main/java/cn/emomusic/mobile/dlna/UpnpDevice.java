package cn.emomusic.mobile.dlna;

import androidx.annotation.Nullable;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;

/**
 * 一个可投屏的 DLNA MediaRenderer（电视/音箱/盒子）。
 *
 * id 用 UDN（设备描述里的 uuid），拿不到时退回 location，保证同一次搜索里稳定可寻址。
 */
public class UpnpDevice {
  public final String id;
  public final String name;
  public final String model;
  public final String location;
  public final String udn;
  /** AVTransport 服务的 controlURL（绝对地址，已按 LOCATION 解析过相对路径） */
  public final String avTransport;
  /** RenderingControl 服务的 controlURL，音量用；部分电视没有 */
  @Nullable
  public final String renderingControl;
  /** ConnectionManager 的 controlURL，取协议信息用；可有可无 */
  @Nullable
  public final String connectionManager;

  public UpnpDevice(
    String id,
    String name,
    String model,
    String location,
    String udn,
    String avTransport,
    @Nullable String renderingControl,
    @Nullable String connectionManager
  ) {
    this.id = id;
    this.name = name;
    this.model = model;
    this.location = location;
    this.udn = udn;
    this.avTransport = avTransport;
    this.renderingControl = renderingControl;
    this.connectionManager = connectionManager;
  }

  public WritableMap toMap() {
    WritableMap map = Arguments.createMap();
    map.putString("id", id);
    map.putString("name", name);
    map.putString("model", model);
    map.putString("location", location);
    return map;
  }
}
