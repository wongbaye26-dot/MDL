package cn.emomusic.mobile.lyric;

import android.util.Log;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

/**
 * 蓝牙 / 锁屏歌词（媒体会话歌词）桥接。
 *
 * 桌面悬浮歌词窗口（LyricView + SYSTEM_ALERT_WINDOW）已下架，
 * 这里只保留「把当前行歌词通过媒体会话发出去」所需的最小能力。
 */
public class LyricModule extends ReactContextBaseJavaModule {
  private final ReactApplicationContext reactContext;
  Lyric lyric;

  boolean isShowTranslation = false;
  boolean isShowRoma = false;
  float playbackRate = 1;

  private int listenerCount = 0;

  LyricModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;
  }

  @Override
  public String getName() {
    return "LyricModule";
  }

  @ReactMethod
  public void addListener(String eventName) {
    listenerCount += 1;
  }

  @ReactMethod
  public void removeListeners(Integer count) {
    listenerCount -= count;
  }

  @ReactMethod
  public void setSendLyricTextEvent(boolean isSend, Promise promise) {
    if (lyric == null) lyric = new Lyric(reactContext, isShowTranslation, isShowRoma, playbackRate);
    lyric.setSendLyricTextEvent(isSend);
    promise.resolve(null);
  }

  @ReactMethod
  public void setLyric(String lyric, String translation, String romaLyric, Promise promise) {
    if (this.lyric != null) this.lyric.setLyric(lyric, translation, romaLyric);
    promise.resolve(null);
  }

  @ReactMethod
  public void setPlaybackRate(float playbackRate, Promise promise) {
    this.playbackRate = playbackRate;
    if (lyric != null) lyric.setPlaybackRate(playbackRate);
    promise.resolve(null);
  }

  @ReactMethod
  public void toggleTranslation(boolean isShowTranslation, Promise promise) {
    this.isShowTranslation = isShowTranslation;
    if (lyric != null) lyric.toggleTranslation(isShowTranslation);
    promise.resolve(null);
  }

  @ReactMethod
  public void toggleRoma(boolean isShowRoma, Promise promise) {
    this.isShowRoma = isShowRoma;
    if (lyric != null) lyric.toggleRoma(isShowRoma);
    promise.resolve(null);
  }

  @ReactMethod
  public void play(int time, Promise promise) {
    Log.d("Lyric", "play lyric: " + time);
    if (lyric != null) lyric.play(time);
    promise.resolve(null);
  }

  @ReactMethod
  public void pause(Promise promise) {
    if (lyric != null) lyric.pauseLyric();
    promise.resolve(null);
  }
}
