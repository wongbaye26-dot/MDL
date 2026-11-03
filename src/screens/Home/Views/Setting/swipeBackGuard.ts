/**
 * 设置子页「右滑返回」的交互控件豁免标记。
 *
 * 右滑手势挂在整屏 overlay 的捕获阶段，起手阈值只有 4dp
 * （必须抢在原生 PagerView 的 8dp 触摸斜率之前接管，否则横滑会变成切 Tab），
 * 所以横向拖滑杆这类「本来就要横滑」的控件也会被它抢走：页面跟着平移、滑杆卡住。
 * 滑杆在 onTouchStart 里把标记置上，手势判断看到标记就不接管；
 * 触摸结束（或下一次触摸开始）时清掉。
 */
let interactiveTouch = false

export const setInteractiveTouch = (active: boolean) => {
  interactiveTouch = active
}

export const isInteractiveTouch = () => interactiveTouch
