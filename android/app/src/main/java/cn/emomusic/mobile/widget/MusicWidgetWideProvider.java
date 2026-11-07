package cn.emomusic.mobile.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.widget.RemoteViews;

import cn.emomusic.mobile.R;

public class MusicWidgetWideProvider extends AppWidgetProvider {
  static void updateAll(Context context, AppWidgetManager manager) {
    int[] ids = manager.getAppWidgetIds(new android.content.ComponentName(context, MusicWidgetWideProvider.class));
    for (int id : ids) manager.updateAppWidget(id, build(context));
  }

  static RemoteViews build(Context context) {
    RemoteViews small = MusicWidgetSmallProvider.build(context);
    // 宽版复用同一套内容，布局 id 需同名；RemoteViews 不能跨布局复用，重新构造
    android.content.SharedPreferences prefs = context.getSharedPreferences(WidgetModule.PREFS, Context.MODE_PRIVATE);
    String title = prefs.getString("title", "Emo 音乐");
    String singer = prefs.getString("singer", "未在播放");
    boolean playing = prefs.getBoolean("playing", false);
    String pic = prefs.getString("pic", "");
    RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_music_wide);
    views.setTextViewText(R.id.widget_title, title == null || title.isEmpty() ? "Emo 音乐" : title);
    views.setTextViewText(R.id.widget_singer, singer == null || singer.isEmpty() ? "未在播放" : singer);
    views.setImageViewResource(R.id.widget_play, playing ? R.drawable.widget_pause : R.drawable.widget_play);
    android.graphics.Bitmap bitmap = loadPic(pic);
    views.setImageViewResource(R.id.widget_cover, R.drawable.widget_cover_placeholder);
    if (bitmap != null) views.setImageViewBitmap(R.id.widget_cover, bitmap);
    android.content.Intent open = new android.content.Intent(context, MainActivityClass());
    open.setFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK | android.content.Intent.FLAG_ACTIVITY_CLEAR_TOP);
    views.setOnClickPendingIntent(R.id.widget_root, android.app.PendingIntent.getActivity(context, 10, open, android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE));
    android.content.Intent toggle = new android.content.Intent(context, WidgetActionReceiver.class).setAction(WidgetActionReceiver.ACTION_TOGGLE);
    android.content.Intent next = new android.content.Intent(context, WidgetActionReceiver.class).setAction(WidgetActionReceiver.ACTION_NEXT);
    views.setOnClickPendingIntent(R.id.widget_play, android.app.PendingIntent.getBroadcast(context, 11, toggle, android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE));
    views.setOnClickPendingIntent(R.id.widget_next, android.app.PendingIntent.getBroadcast(context, 12, next, android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE));
    return views;
  }

  private static Class<?> MainActivityClass() {
    try { return Class.forName("cn.emomusic.mobile.MainActivity"); } catch (Exception e) { return android.app.Activity.class; }
  }

  private static android.graphics.Bitmap loadPic(String pic) {
    try {
      if (pic == null || pic.isEmpty()) return null;
      String path = pic.startsWith("file://") ? android.net.Uri.parse(pic).getPath() : pic;
      if (path == null || !new java.io.File(path).exists()) return null;
      android.graphics.Bitmap source = android.graphics.BitmapFactory.decodeFile(path);
      if (source == null) return null;
      return android.graphics.Bitmap.createScaledBitmap(source, 160, 160, true);
    } catch (Exception e) { return null; }
  }

  @Override
  public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
    for (int id : ids) manager.updateAppWidget(id, build(context));
  }
}
