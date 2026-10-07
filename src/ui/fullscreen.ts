type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type FsDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };

export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** 从主屏幕图标打开（已经没有浏览器地址栏） */
export function isStandalone() {
  return matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function canFullscreen() {
  const el = document.documentElement as FsElement;
  return !!(el.requestFullscreen || el.webkitRequestFullscreen);
}

export function isFullscreen() {
  const d = document as FsDocument;
  return !!(d.fullscreenElement || d.webkitFullscreenElement);
}

/** 必须在点击/触摸事件里调用 */
export function toggleFullscreen() {
  const d = document as FsDocument;
  if (isFullscreen()) {
    (d.exitFullscreen?.bind(d) ?? d.webkitExitFullscreen?.bind(d))?.();
    return;
  }
  const el = document.documentElement as FsElement;
  const req = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen?.();
  Promise.resolve(req)
    .then(() => {
      const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      return o.lock?.('landscape');
    })
    .catch(() => {});
}

export const IOS_TIP = 'iPhone 网页不支持全屏：点 Safari 的分享按钮（或 ⋯ 菜单）→ 添加到主屏幕，从桌面图标打开就是全屏';
