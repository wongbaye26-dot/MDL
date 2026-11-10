package cn.emomusic.mobile.dlna;

import android.util.Log;

import androidx.annotation.Nullable;

import java.io.IOException;

/** 极简 UPnP SOAP 客户端：只做 HTTP POST + 信封拼装 + 响应取值 */
final class Soap {
  private static final String TAG = "EmoDlna";

  static final String AV_TRANSPORT = "urn:schemas-upnp-org:service:AVTransport:1";
  static final String RENDERING_CONTROL = "urn:schemas-upnp-org:service:RenderingControl:1";
  static final String CONNECTION_MANAGER = "urn:schemas-upnp-org:service:ConnectionManager:1";

  private Soap() {}

  /** 执行一个动作，返回响应 XML（失败抛 IOException，消息里带 UPnP 错误码方便排查） */
  static String invoke(String controlUrl, String serviceType, String action, String args) throws IOException {
    String body = "<?xml version=\"1.0\" encoding=\"utf-8\"?>"
      + "<s:Envelope xmlns:s=\"http://schemas.xmlsoap.org/soap/envelope/\" "
      + "s:encodingStyle=\"http://schemas.xmlsoap.org/soap/encoding/\">"
      + "<s:Body><u:" + action + " xmlns:u=\"" + serviceType + "\">" + args + "</u:" + action + "></s:Body>"
      + "</s:Envelope>";
    // 控制地址在局域网明文 http 上，用 HttpLite 绕过 network_security_config 的禁明文限制
    HttpLite.Result result = HttpLite.exchange("POST", controlUrl, body, serviceType + "#" + action);
    if (result.status != 200) {
      String errorCode = Ssdp.xmlValue(result.body, "errorCode");
      String desc = Ssdp.xmlValue(result.body, "errorDescription");
      Log.w(TAG, action + " http " + result.status + " upnp=" + errorCode + " " + desc);
      throw new IOException(action + " failed: http " + result.status
        + (errorCode == null ? "" : (" upnp " + errorCode + " " + (desc == null ? "" : desc))));
    }
    return result.body;
  }

  @Nullable
  static String value(String response, String tag) {
    return Ssdp.xmlValue(response, tag);
  }

}
