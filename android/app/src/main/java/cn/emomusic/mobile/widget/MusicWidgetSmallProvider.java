package cn.emomusic.mobile.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.widget.RemoteViews;

import java.io.File;

import cn.emomusic.mobile.R;

public class MusicWidgetSmallProvider extends AppWidgetProvider {
  static void updateAll(Context context, AppWidgetManager manager) {
    int[] ids = manager.getAppWidgetIds(new android.content.ComponentName(context, MusicWidgetSmallProvider.class));
    for (int id : ids) manager.updateAppWidget(id, build(context));
  }

  static RemoteViews build(Context context) {
    SharedPreferences prefs = context.getSharedPreferences(WidgetModule.PREFS, Context.MODE_PRIVATE);
    String title = prefs.getString("title", "Emo 音乐");
    String singer = prefs.getString("singer", "未在播放");
    boolean playing = prefs.getBoolean("playing", false);
    String pic = prefs.getString("pic", "");

    RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_music_small);
    views.setTextViewText(R.id.widget_title, title == null || title.isEmpty() ? "Emo 音乐" : title);
    views.setTextViewText(R.id.widget_singer, singer == null || singer.isEmpty() ? "未在播放" : singer);
    views.setImageViewResource(R.id.widget_play, playing ? R.drawable.widget_pause : R.drawable.widget_play);
    views.setImageViewResource(R.id.widget_cover, R.drawable.widget_cover_placeholder);
    Bitmap bitmap = loadPic(pic);
    if (bitmap != null) views.setImageViewBitmap(R.id.widget_cover, bitmap);

    Intent open = new Intent(context, MainActivityClass());
    open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    PendingIntent openPending = PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    views.setOnClickPendingIntent(R.id.widget_root, openPending);

    Intent toggle = new Intent(context, WidgetActionReceiver.class).setAction(WidgetActionReceiver.ACTION_TOGGLE);
    Intent next = new Intent(context, WidgetActionReceiver.class).setAction(WidgetActionReceiver.ACTION_NEXT);
    views.setOnClickPendingIntent(R.id.widget_play, PendingIntent.getBroadcast(context, 1, toggle, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
    views.setOnClickPendingIntent(R.id.widget_next, PendingIntent.getBroadcast(context, 2, next, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
    return views;
  }

  private static Class<?> MainActivityClass() {
    try { return Class.forName("cn.emomusic.mobile.MainActivity"); } catch (Exception e) { return android.app.Activity.class; }
  }

  private static Bitmap loadPic(String pic) {
    try {
      if (pic == null || pic.isEmpty()) return null;
      String path = pic.startsWith("file://") ? Uri.parse(pic).getPath() : pic;
      if (path == null || !new File(path).exists()) return null;
      Bitmap source = BitmapFactory.decodeFile(path);
      if (source == null) return null;
      return Bitmap.createScaledBitmap(source, 160, 160, true);
    } catch (Exception e) { return null; }
  }

  @Override
  public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
    for (int id : ids) manager.updateAppWidget(id, build(context));
  }
}
