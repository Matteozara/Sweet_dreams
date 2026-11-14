// Thin, failure-tolerant wrappers around device features. Every function
// resolves (never throws) so the calm flow is never interrupted by an error.
import { Platform } from 'react-native';

const native = Platform.OS !== 'web';

let notifications;
function Notifications() {
  if (notifications === undefined) {
    try {
      notifications = require('expo-notifications');
      notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });
    } catch {
      notifications = null;
    }
  }
  return notifications;
}

/** Schedule (or clear) the daily "end the day" reminder. Returns true if scheduled. */
export async function syncReminder({ enabled, hour, minute }) {
  if (!native) return false;
  const N = Notifications();
  if (!N) return false;
  try {
    await N.cancelAllScheduledNotificationsAsync();
    if (!enabled) return false;
    const current = await N.getPermissionsAsync();
    const perm = current.granted ? current : await N.requestPermissionsAsync();
    if (!perm.granted) return false;
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync('evening', {
        name: 'Evening reminder',
        importance: N.AndroidImportance.DEFAULT,
      });
    }
    await N.scheduleNotificationAsync({
      content: { title: 'Sweet Dreams', body: 'Draw a line under today.' },
      trigger: { type: N.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: 'evening' },
    });
    return true;
  } catch {
    return false;
  }
}



export function tap() {
  if (!native) return;
  try {
    const Haptics = require('expo-haptics');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  } catch {}
}
