import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

// ─── Request permission & get push token ─────────────────
export const registerForPushNotifications = async () => {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission denied');
    return null;
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync();
    return token.data;
  } catch (e) {
    console.log('Push token error:', e.message);
    return null;
  }
};

// ─── Schedule local notifications ────────────────────────

// Daily reminder to log labour (8 AM)
export const scheduleDailyLabourReminder = async () => {
  await Notifications.cancelScheduledNotificationAsync('daily-labour');
  await Notifications.scheduleNotificationAsync({
    identifier: 'daily-labour',
    content: {
      title: '👷 PaintPro Reminder',
      body: "Don't forget to log today's labour attendance",
      sound: true,
    },
    trigger: {
      hour: 8,
      minute: 0,
      repeats: true,
    },
  });
};

// Weekly payment reminder (Monday 9 AM)
export const scheduleWeeklyPaymentReminder = async () => {
  await Notifications.cancelScheduledNotificationAsync('weekly-payment');
  await Notifications.scheduleNotificationAsync({
    identifier: 'weekly-payment',
    content: {
      title: '💰 Payment Reminder',
      body: 'Check outstanding worker payments and unpaid invoices',
      sound: true,
    },
    trigger: {
      weekday: 2, // Monday
      hour: 9,
      minute: 0,
      repeats: true,
    },
  });
};

// Cancel all scheduled notifications
export const cancelAllNotifications = async () => {
  await Notifications.cancelAllScheduledNotificationsAsync();
};

// ─── Send immediate local notification ───────────────────
export const sendLocalNotification = async ({ title, body }) => {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: null, // immediate
  });
};

// ─── Check unpaid balances and notify ────────────────────
export const checkAndNotifyUnpaidBalances = async () => {
  try {
    const [invoicesRes, labourRes] = await Promise.all([
      supabase.from('invoices').select('balance, status').neq('status', 'paid'),
      supabase.from('labour_logs').select('amount').eq('is_paid', false),
    ]);

    const unpaidInvoices = invoicesRes.data?.length ?? 0;
    const unpaidLabour   = labourRes.data?.reduce((s, l) => s + Number(l.amount ?? 0), 0) ?? 0;

    if (unpaidInvoices > 0) {
      await sendLocalNotification({
        title: '🧾 Unpaid Invoices',
        body:  `You have ${unpaidInvoices} unpaid invoice${unpaidInvoices > 1 ? 's' : ''} pending`,
      });
    }

    if (unpaidLabour > 0) {
      await sendLocalNotification({
        title: '👷 Labour Payments Due',
        body:  `₹${unpaidLabour.toLocaleString('en-IN')} in worker wages unpaid`,
      });
    }
  } catch (e) {
    console.log('Notification check error:', e.message);
  }
};

// ─── Get scheduled notifications list ────────────────────
export const getScheduledNotifications = async () => {
  return await Notifications.getAllScheduledNotificationsAsync();
};
