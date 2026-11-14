// Putting an activity somewhere it will come back to you: a reminder, or a
// calendar event. Like services.js, every function resolves and never throws
// — a failed schedule should not interrupt the evening.
import { Platform } from 'react-native';

const native = Platform.OS !== 'web';

/** Tomorrow at `hour`, local time. */
export function tomorrowAt(hour = 9, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, minute, 0, 0);
  return d;
}

export function formatWhen(date) {
  const h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, '0');
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `Tomorrow, ${h12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
}

/** A one-off notification for an activity. Returns true if it was scheduled. */
export async function remindMe(activity, date) {
  if (!native) return false;
  try {
    const N = require('expo-notifications');
    const current = await N.getPermissionsAsync();
    const perm = current.granted ? current : await N.requestPermissionsAsync();
    if (!perm.granted) return false;
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync('activities', {
        name: 'Activity reminders',
        importance: N.AndroidImportance.DEFAULT,
      });
    }
    await N.scheduleNotificationAsync({
      content: {
        title: activity.type,
        body: activity.title,
        data: { kind: 'activity' },
      },
      trigger: { type: N.SchedulableTriggerInputTypes.DATE, date, channelId: 'activities' },
    });
    return true;
  } catch (err) {
    if (__DEV__) console.warn('[schedule] reminder failed:', err?.message ?? err);
    return false;
  }
}

/** A real calendar event. Returns true if one was written. */
export async function addToCalendar(activity, date, { minutes = 30 } = {}) {
  if (!native) return false;
  try {
    const Calendar = require('expo-calendar');
    const current = await Calendar.getCalendarPermissionsAsync();
    const perm = current.granted ? current : await Calendar.requestCalendarPermissionsAsync();
    if (!perm.granted) return false;

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const writable = calendars.filter((c) => c.allowsModifications);
    if (!writable.length) return false;
    // Prefer the system default, else the first writable calendar.
    const target =
      (Platform.OS === 'ios' ? await Calendar.getDefaultCalendarAsync().catch(() => null) : null) ??
      writable.find((c) => c.isPrimary) ??
      writable[0];

    await Calendar.createEventAsync(target.id, {
      title: activity.title,
      notes: [activity.type, activity.dose, activity.note].filter(Boolean).join(' · '),
      startDate: date,
      endDate: new Date(date.getTime() + minutes * 60000),
      alarms: [{ relativeOffset: -10 }],
    });
    return true;
  } catch (err) {
    if (__DEV__) console.warn('[schedule] calendar failed:', err?.message ?? err);
    return false;
  }
}
