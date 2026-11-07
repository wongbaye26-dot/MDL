package cn.emomusic.mobile.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;

public class MusicWidgetSmallProvider extends AppWidgetProvider {
  static void updateAll(Context context, AppWidgetManager manager) {
    int[] ids = manager.getAppWidgetIds(new android.content.ComponentName(context, MusicWidgetSmallProvider.class));
    for (int id : ids) update(context, manager, id);
  }

  static void update(Context context, AppWidgetManager manager, int id) {
    try {
      manager.updateAppWidget(id, WidgetViews.build(context, false));
    } catch (Exception e) {
      android.util.Log.w("MusicWidget", "small update failed", e);
    }
  }

  @Override
  public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
    for (int id : ids) update(context, manager, id);
  }
}
