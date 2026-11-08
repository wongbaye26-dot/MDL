package cn.emomusic.mobile.blur;

import com.facebook.react.uimanager.SimpleViewManager;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;

/** 自研 GlassBlurView 的 legacy ViewManager（RN 0.80 Fabric 通过 interop 层使用） */
public class GlassBlurViewManager extends SimpleViewManager<GlassBlurView> {

  public static final String REACT_CLASS = "GlassBlurView";

  @Override
  public String getName() {
    return REACT_CLASS;
  }

  @Override
  protected GlassBlurView createViewInstance(ThemedReactContext reactContext) {
    return new GlassBlurView(reactContext);
  }

  @ReactProp(name = "blurRadius", defaultFloat = 18f)
  public void setBlurRadius(GlassBlurView view, float radius) {
    view.setBlurRadius(radius);
  }

  @ReactProp(name = "overlayColor", defaultInt = 0)
  public void setOverlayColor(GlassBlurView view, int color) {
    view.setOverlayColor(color);
  }

  @ReactProp(name = "enabled", defaultBoolean = true)
  public void setEnabled(GlassBlurView view, boolean enabled) {
    view.setBlurEnabled(enabled);
  }
}
