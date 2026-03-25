import { Linking, Alert, Platform } from 'react-native';

// ─── UPI Payment ──────────────────────────────────────────
// Opens any UPI app (GPay, PhonePe, Paytm, BHIM) with
// amount and payee pre-filled via UPI deep link

export const payViaUPI = async ({ phoneNumber, name, amount, note }) => {
  const cleanPhone = phoneNumber?.replace(/\D/g, '') ?? '';
  if (!cleanPhone) {
    Alert.alert('No phone number', 'Worker does not have a phone number saved. Add it in Labour → Workers.');
    return;
  }

  const upiId    = `${cleanPhone}@upi`;  // works for most UPI-registered numbers
  const amtFixed = parseFloat(amount).toFixed(2);
  const noteTxt  = encodeURIComponent(note ?? `Salary payment to ${name}`);
  const nameTxt  = encodeURIComponent(name ?? 'Worker');

  // Standard UPI deep link — opens UPI app chooser on Android
  const upiUrl = `upi://pay?pa=${upiId}&pn=${nameTxt}&am=${amtFixed}&cu=INR&tn=${noteTxt}`;

  const supported = await Linking.canOpenURL(upiUrl);
  if (!supported) {
    // Fallback: show manual options
    Alert.alert(
      'Open payment app',
      `Pay ₹${amtFixed} to ${name} (${cleanPhone})`,
      [
        {
          text: 'GPay',
          onPress: () => openGPay({ phoneNumber: cleanPhone, amount: amtFixed, name, note }),
        },
        {
          text: 'PhonePe',
          onPress: () => openPhonePe({ phoneNumber: cleanPhone, amount: amtFixed, name }),
        },
        {
          text: 'Copy UPI ID',
          onPress: () => {
            // Can't use Clipboard directly here without import, show alert
            Alert.alert('UPI ID', upiId, [{ text: 'OK' }]);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
    return;
  }

  Linking.openURL(upiUrl).catch(() => {
    Alert.alert('Error', 'Could not open UPI app. Make sure GPay, PhonePe, or any UPI app is installed.');
  });
};

// ─── GPay specific ────────────────────────────────────────
const openGPay = ({ phoneNumber, amount, name, note }) => {
  const upiId  = `${phoneNumber}@okaxis`;
  const url    = `gpay://upi/pay?pa=${upiId}&pn=${encodeURIComponent(name)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note ?? 'Salary')}`;
  Linking.openURL(url).catch(() => {
    // Try Play Store
    Linking.openURL('https://play.google.com/store/apps/details?id=com.google.android.apps.nbu.paisa.user');
  });
};

// ─── PhonePe specific ─────────────────────────────────────
const openPhonePe = ({ phoneNumber, amount, name }) => {
  const url = `phonepe://pay?transactionId=pp${Date.now()}&merchantId=PAINTPRO&pa=${phoneNumber}@ybl&pn=${encodeURIComponent(name)}&am=${amount}&cu=INR`;
  Linking.openURL(url).catch(() => {
    Linking.openURL('https://play.google.com/store/apps/details?id=com.phonepe.app');
  });
};

// ─── Show payment options sheet ───────────────────────────
export const showPaymentOptions = ({ phoneNumber, name, amount, note, onSuccess }) => {
  const cleanPhone = phoneNumber?.replace(/\D/g, '') ?? '';
  const amtFixed   = parseFloat(amount || 0).toFixed(2);

  if (!cleanPhone) {
    Alert.alert(
      'No phone number',
      `${name} has no phone number saved. Add it in Labour → Workers tab to enable UPI payments.`
    );
    return;
  }

  Alert.alert(
    `Pay ₹${amtFixed} to ${name}`,
    `Phone: ${cleanPhone}\nUPI: ${cleanPhone}@upi`,
    [
      {
        text: '📱 GPay / PhonePe / Any UPI',
        onPress: () => payViaUPI({ phoneNumber: cleanPhone, name, amount: amtFixed, note }),
      },
      {
        text: '💬 Send via WhatsApp',
        onPress: () => {
          const msg = encodeURIComponent(
            `*PaintPro Payment Request*\n\nDear ${name},\nYour salary payment of *₹${amtFixed}* is ready.\n\nPlease accept the UPI payment on your registered number: ${cleanPhone}\n\nThank you!`
          );
          const wa = `https://wa.me/91${cleanPhone}?text=${msg}`;
          Linking.openURL(wa).catch(() => Alert.alert('Error', 'WhatsApp not installed'));
        },
      },
      {
        text: '📞 Call worker',
        onPress: () => Linking.openURL(`tel:${cleanPhone}`),
      },
      { text: 'Cancel', style: 'cancel' },
    ]
  );
};
