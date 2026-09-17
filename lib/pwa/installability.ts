export function isIosSafariUserAgent(userAgent: string): boolean {
  return /iPad|iPhone|iPod/i.test(userAgent);
}

export function isStandaloneDisplay(
  displayModeStandalone: boolean,
  navigatorStandalone: boolean
): boolean {
  return displayModeStandalone || navigatorStandalone;
}

export function shouldShowIosInstallHint(input: {
  userAgent: string;
  displayModeStandalone: boolean;
  navigatorStandalone?: boolean;
}): boolean {
  if (
    isStandaloneDisplay(input.displayModeStandalone, input.navigatorStandalone ?? false)
  ) {
    return false;
  }
  return isIosSafariUserAgent(input.userAgent);
}

export function shouldShowInstallBanner(input: {
  hasDeferredPrompt: boolean;
  isStandalone: boolean;
}): boolean {
  return input.hasDeferredPrompt && !input.isStandalone;
}
