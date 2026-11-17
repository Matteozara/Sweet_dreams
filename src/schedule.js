// Putting an activity somewhere it will come back to you: a reminder, or a
// calendar event. Like services.js, every function resolves and never throws
// — a failed schedule should not interrupt the evening.
import { Platform } from 'react-native';
import { colors } from './theme';

const native = Platform.OS !== 'web';

/** Tomorrow at `hour`, local time. */
export function tomorrowAt(hour = 9, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, minute, 0, 0);
  return d;
}

export function formatWhen(date) {
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, '0');
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${isToday ? 'Today' : 'Tomorrow'}, ${h12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
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

function toIcsUtc(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function downloadWebIcs(activity, startDate, endDate, notes) {
  try {
    if (typeof document === 'undefined') return false;
    const esc = (s = '') => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, '\\$&');
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Sweet Dreams//EN',
      'BEGIN:VEVENT',
      `UID:sweetdreams-${Date.now()}@local`,
      `DTSTAMP:${toIcsUtc(new Date())}`,
      `DTSTART:${toIcsUtc(startDate)}`,
      `DTEND:${toIcsUtc(endDate)}`,
      `SUMMARY:${esc(activity.title)}`,
      notes ? `DESCRIPTION:${esc(notes)}` : '',
      'END:VEVENT',
      'END:VCALENDAR',
    ]
      .filter(Boolean)
      .join('\r\n');
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sweet-dreams-activity.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch {
    return false;
  }
}

async function resolveTargetCalendarId(Calendar) {
  // On iOS (including iOS 17+ write-only access), getDefaultCalendarAsync() returns
  // the user's default / virtual write-only calendar even when getCalendarsAsync() is empty.
  if (Platform.OS === 'ios') {
    const def = await Calendar.getDefaultCalendarAsync().catch(() => null);
    if (def?.id) return def.id;
  }

  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes?.EVENT).catch(() => []);
  const writable = (calendars || []).filter((c) => c.allowsModifications);
  const chosen = writable.find((c) => c.isPrimary) ?? writable[0];
  if (chosen?.id) return chosen.id;

  // Last resort before UI dialog: create a local app calendar if no writable calendar exists yet.
  if (Platform.OS === 'android') {
    return Calendar.createCalendarAsync({
      title: 'Sweet Dreams',
      color: colors.lilac,
      entityType: Calendar.EntityTypes?.EVENT,
      sourceId: calendars?.[0]?.source?.id,
      source: { isLocalAccount: true, name: 'Sweet Dreams', type: 'LOCAL' },
      name: 'sweetdreams',
      ownerAccount: 'personal',
      accessLevel: Calendar.CalendarAccessLevel?.OWNER,
    }).catch(() => null);
  }

  if (Platform.OS === 'ios') {
    const sources = await Calendar.getSourcesAsync().catch(() => []);
    const src =
      sources.find((s) => s.type === Calendar.SourceType?.CALDAV || s.name === 'iCloud') ??
      sources.find((s) => s.type === Calendar.SourceType?.LOCAL) ??
      sources[0];
    if (src?.id) {
      return Calendar.createCalendarAsync({
        title: 'Sweet Dreams',
        color: colors.lilac,
        entityType: Calendar.EntityTypes?.EVENT,
        sourceId: src.id,
        source: src,
      }).catch(() => null);
    }
  }

  return null;
}

/** A real calendar event. Returns true if one was written or saved via the system sheet. */
export async function addToCalendar(activity, date, { minutes = 30 } = {}) {
  const endDate = new Date(date.getTime() + minutes * 60000);
  const notes = [activity.type, activity.dose, activity.note].filter(Boolean).join(' · ');
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  if (!native) {
    return downloadWebIcs(activity, date, endDate, notes);
  }

  const eventDetails = {
    title: activity.title,
    notes,
    startDate: date,
    endDate,
    timeZone,
    alarms: [{ relativeOffset: -10 }],
  };

  try {
    // In expo-calendar v58+, the root 'expo-calendar' throws deprecation errors on *Async methods
    // and its Next API is stubbed out in Expo Go. 'expo-calendar/legacy' works in both Expo Go & builds.
    const Calendar = require('expo-calendar/legacy');

    const current = await Calendar.getCalendarPermissionsAsync().catch(() => ({ granted: false }));
    const perm = current.granted ? current : await Calendar.requestCalendarPermissionsAsync().catch(() => ({ granted: false }));

    if (perm.granted) {
      const targetId = await resolveTargetCalendarId(Calendar);
      if (targetId) {
        const eventId = await Calendar.createEventAsync(targetId, eventDetails).catch((err) => {
          if (__DEV__) console.warn('[schedule] direct createEventAsync failed:', err?.message ?? err);
          return null;
        });
        if (eventId) return true;
      }
    }

    // Fallback: open the native OS Calendar event sheet pre-filled with the activity & time
    // (works even without full calendar read access or synced accounts).
    if (typeof Calendar.createEventInCalendarAsync === 'function') {
      const dialogRes = await Calendar.createEventInCalendarAsync(eventDetails);
      if (dialogRes && dialogRes.action !== 'canceled') {
        return true;
      }
    }

    return false;
  } catch (err) {
    if (__DEV__) console.warn('[schedule] calendar failed:', err?.message ?? err);
    return false;
  }
}
