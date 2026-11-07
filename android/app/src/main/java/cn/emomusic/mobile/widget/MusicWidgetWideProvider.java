package cn.emomusic.mobile.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.widget.RemoteViews;

public class MusicWidgetWideProvider extends AppWidgetProvider {
  static void updateAll(Context context, AppWidgetManager manager) {
    int[] ids = manager.getAppWidgetIds(new android.content.ComponentName(context, MusicWidgetWideProvider.class));
    for (int id : ids) manager.updateAppWidget(id, WidgetViews.build(context, true));
  }

  @Override
  public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
    for (int id : ids) manager.updateAppWidget(id, WidgetViews.build(context, true));
  }
}
