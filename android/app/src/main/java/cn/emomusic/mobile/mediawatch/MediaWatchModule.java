package cn.emomusic.mobile.mediawatch;

import android.database.ContentObserver;
import android.net.Uri;
import android.os.Handler;
import android.os.HandlerThread;
import android.provider.MediaStore;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

/**
 * 监听 MediaStore 音频库变化（其它 App / 系统相册 / USB 拷歌都会走 MediaStore）。
 *
 * JS 侧收到事件后做一次增量扫描，实现「本地音乐库跟着文件变化自动更新」，
 * 不依赖用户手动点扫描。
 */
public class MediaWatchModule extends ReactContextBaseJavaModule {
  public static final String NAME = "MediaWatchModule";
  /** 变化事件名：JS 侧只用来触发一次去抖后的增量扫描 */
  private static final String EVENT = "mediaStoreAudioChanged";
  /** 连续变化（批量拷贝/删除）合并成一次回调 */
  private static final long DEBOUNCE_MS = 900L;

  private final ReactApplicationContext context;
  private ContentObserver observer;
  private HandlerThread thread;
  private Handler handler;
  private Runnable pending;

  public MediaWatchModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.context = reactContext;
  }

  @Override
  public String getName() {
    return NAME;
  }

  private void emitChanged() {
    if (!context.hasActiveReactInstance()) return;
    try {
      context.emitDeviceEvent(EVENT, null);
    } catch (Exception ignored) {
    }
  }

  @ReactMethod
  public void start() {
    if (observer != null) return;
    thread = new HandlerThread("EmoMediaWatch");
    thread.start();
    handler = new Handler(thread.getLooper());
    observer = new ContentObserver(handler) {
      @Override
      public void onChange(boolean selfChange) {
        onChange(selfChange, null);
      }

      @Override
      public void onChange(boolean selfChange, Uri uri) {
        if (pending != null) handler.removeCallbacks(pending);
        pending = new Runnable() {
          @Override
          public void run() {
            pending = null;
            emitChanged();
          }
        };
        handler.postDelayed(pending, DEBOUNCE_MS);
      }
    };
    try {
      context.getContentResolver().registerContentObserver(
        MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, true, observer);
    } catch (Exception ignored) {
    }
  }

  @ReactMethod
  public void stop() {
    try {
      if (observer != null) context.getContentResolver().unregisterContentObserver(observer);
    } catch (Exception ignored) {
    }
    observer = null;
    if (handler != null && pending != null) handler.removeCallbacks(pending);
    pending = null;
    if (thread != null) {
      thread.quitSafely();
      thread = null;
    }
    handler = null;
  }

  @Override
  public void invalidate() {
    stop();
    super.invalidate();
  }
}
