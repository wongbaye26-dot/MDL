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
  public void update(String title, String singer, boolean playing, String pic, boolean dark) {
    SharedPreferences.Editor editor = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();
    editor.putString("title", title == null ? "" : title);
    editor.putString("singer", singer == null ? "" : singer);
    editor.putBoolean("playing", playing);
    editor.putString("pic", pic == null ? "" : pic);
    editor.putBoolean("dark", dark);
    editor.apply();
    push();
  }

  @ReactMethod
  public void refresh() {
    push();
  }
}
