package cn.emomusic.mobile.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;

public class MusicWidgetWideProvider extends AppWidgetProvider {
  static void updateAll(Context context, AppWidgetManager manager) {
    int[] ids = manager.getAppWidgetIds(new android.content.ComponentName(context, MusicWidgetWideProvider.class));
    for (int id : ids) update(context, manager, id);
  }

  static void update(Context context, AppWidgetManager manager, int id) {
    try {
      manager.updateAppWidget(id, WidgetViews.build(context, true));
    } catch (Exception e) {
      android.util.Log.w("MusicWidget", "wide update failed", e);
    }
  }

  @Override
  public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
    for (int id : ids) update(context, manager, id);
  }
}
