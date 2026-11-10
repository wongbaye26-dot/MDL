package cn.emomusic.mobile.widget;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.SharedPreferences;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class WidgetModule extends ReactContextBaseJavaModule {
  public static final String PREFS = "emo_widget";
  private final ReactApplicationContext context;

  WidgetModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.context = reactContext;
  }

  @Override
  public String getName() {
    return "WidgetModule";
  }

  private void push() {
    AppWidgetManager manager = AppWidgetManager.getInstance(context);
    MusicWidgetSmallProvider.updateAll(context, manager);
    MusicWidgetWideProvider.updateAll(context, manager);
  }

  @ReactMethod
  public void update(String title, String singer, boolean playing, String pic, boolean dark, String primary, int progress, String lyric) {
    SharedPreferences.Editor editor = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();
    editor.putString("title", title == null ? "" : title);
    editor.putString("singer", singer == null ? "" : singer);
    editor.putBoolean("playing", playing);
    editor.putString("pic", pic == null ? "" : pic);
    editor.putBoolean("dark", dark);
    editor.putString("primary", primary == null ? "#6C5CE7" : primary);
    editor.putInt("progress", progress);
    editor.putString("lyric", lyric == null ? "" : lyric);
    editor.apply();
    push();
    // 在线封面是 http(s) 地址，先落磁盘缓存；下完再刷一次，避免小组件下次重绘还是占位图
    if (WidgetCover.isRemote(pic)) WidgetCover.prefetch(context, pic, this::push);
  }

  @ReactMethod
  public void refresh() {
    push();
  }
}
