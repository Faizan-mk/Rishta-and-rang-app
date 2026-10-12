// Base tab bar height before safe-area inset — screens under MainTabNavigator add
// their own bottom padding (this + insets.bottom) so content never sits under it.
// The bar itself always stays on screen; it no longer hides on scroll.
export const TAB_BAR_BASE_HEIGHT = 56;
