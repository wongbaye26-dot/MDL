package cn.emomusic.mobile.widget;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.view.KeyEvent;
import android.media.AudioManager;

public class WidgetActionReceiver extends BroadcastReceiver {
  public static final String ACTION_TOGGLE = "cn.emomusic.mobile.widget.TOGGLE";
  public static final String ACTION_NEXT = "cn.emomusic.mobile.widget.NEXT";

  @Override
  public void onReceive(Context context, Intent intent) {
    AudioManager manager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
    if (manager == null) return;
    int key = ACTION_NEXT.equals(intent.getAction()) ? KeyEvent.KEYCODE_MEDIA_NEXT : KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE;
    manager.dispatchMediaKeyEvent(new KeyEvent(KeyEvent.ACTION_DOWN, key));
    manager.dispatchMediaKeyEvent(new KeyEvent(KeyEvent.ACTION_UP, key));
  }
}
