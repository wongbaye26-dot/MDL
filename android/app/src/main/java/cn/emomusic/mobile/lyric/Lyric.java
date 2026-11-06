package cn.emomusic.mobile.lyric;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.WritableMap;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

/**
 * 媒体会话歌词发送器。
 *
 * 桌面悬浮歌词窗口已下架；这里只维护歌词行游标，并在开启蓝牙歌词时
 * 把当前行通过 LyricEvent 发给 JS，再由 JS 写进媒体会话的标题/副标题。
 */
public class Lyric extends LyricPlayer {
  LyricEvent lyricEvent = null;
  ReactApplicationContext reactAppContext;

  boolean isRunPlayer = false;
  int lastLine = 0;
  List lines = new ArrayList();
  boolean isShowTranslation;
  boolean isShowRoma;
  boolean isSendLyricTextEvent = false;
  String lyricText = "";
  String translationText = "";
  String romaLyricText = "";

  Lyric(ReactApplicationContext reactContext, boolean isShowTranslation, boolean isShowRoma, float playbackRate) {
    this.reactAppContext = reactContext;
    this.isShowTranslation = isShowTranslation;
    this.isShowRoma = isShowRoma;
    this.playbackRate = playbackRate;
  }

  private void setCurrentLyric(String lyric, ArrayList<String> extendedLyrics) {
    if (!isSendLyricTextEvent || lyricEvent == null) return;
    WritableMap params = Arguments.createMap();
    params.putString("text", lyric);
    params.putArray("extendedLyrics", Arguments.makeNativeArray(extendedLyrics));
    lyricEvent.sendEvent(lyricEvent.LYRIC_Line_PLAY, params);
  }

  private void handleGetCurrentLyric(int lineNum) {
    lastLine = lineNum;
    if (lineNum >= 0 && lineNum < lines.size()) {
      HashMap line = (HashMap) lines.get(lineNum);
      if (line != null) {
        setCurrentLyric((String) line.get("text"), (ArrayList<String>) line.get("extendedLyrics"));
        return;
      }
    }
    setCurrentLyric("", new ArrayList<>(0));
  }

  public void setSendLyricTextEvent(boolean isSend) {
    if (isSendLyricTextEvent == isSend) return;
    isSendLyricTextEvent = isSend;
    if (isSend) {
      if (lyricEvent == null) lyricEvent = new LyricEvent(reactAppContext);
      isRunPlayer = true;
    } else {
      isRunPlayer = false;
      pause();
    }
  }

  private void refreshLyric() {
    if (!isRunPlayer) return;
    ArrayList<String> extendedLyrics = new ArrayList<>(2);
    if (isShowTranslation && !"".equals(translationText)) extendedLyrics.add(translationText);
    if (isShowRoma && !"".equals(romaLyricText)) extendedLyrics.add(romaLyricText);
    super.setLyric(lyricText, extendedLyrics);
  }

  public void setLyric(String lyric, String translation, String romaLyric) {
    lyricText = lyric;
    translationText = translation;
    romaLyricText = romaLyric;
    refreshLyric();
  }

  @Override
  public void onSetLyric(List lines) {
    this.lines = lines;
    handleGetCurrentLyric(-1);
  }

  @Override
  public void onPlay(int lineNum) {
    handleGetCurrentLyric(lineNum);
  }

  public void pauseLyric() {
    pause();
    if (!isRunPlayer) return;
    handleGetCurrentLyric(-1);
  }

  public void toggleTranslation(boolean isShowTranslation) {
    this.isShowTranslation = isShowTranslation;
    refreshLyric();
  }

  public void toggleRoma(boolean isShowRoma) {
    this.isShowRoma = isShowRoma;
    refreshLyric();
  }
}
