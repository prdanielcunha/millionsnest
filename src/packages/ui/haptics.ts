/**
 * Ecosystem Haptic Engine
 * Subtle, invisible physical confirmations for micro-delight.
 */

class HapticFeedback {
  private get canVibrate() {
    return typeof window !== 'undefined' && 'vibrate' in navigator;
  }

  /**
   * Crisp, light confirmation (e.g. keypress, selecting an item)
   */
  public selection() {
    if (this.canVibrate) navigator.vibrate([10]);
  }

  /**
   * Standard confirmation (e.g. saving, successful action)
   */
  public light() {
    if (this.canVibrate) navigator.vibrate([15]);
  }

  /**
   * Medium confirmation (e.g. opening a heavy modal or deep interaction)
   */
  public medium() {
    if (this.canVibrate) navigator.vibrate([30]);
  }

  /**
   * Rigid/destructive action completion
   */
  public heavy() {
    if (this.canVibrate) navigator.vibrate([50]);
  }

  /**
   * Friction/Warning (e.g. field error, invalid action)
   */
  public warning() {
    if (this.canVibrate) navigator.vibrate([20, 40, 20]);
  }
}

export const haptics = new HapticFeedback();
