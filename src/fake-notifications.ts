type Notification = {
  id: string;
  recipient: string;
  message: string;
};

const notifications: Notification[] = [];

export function sendNotification(recipient: string, message: string) {
  if (!recipient.trim()) {
    throw new Error("Recipient is required.");
  }

  if (!message.trim()) {
    throw new Error("Message is required.");
  }

  const notification: Notification = {
    id: `notification_${notifications.length + 1}`,
    recipient,
    message,
  };

  notifications.push(notification);

  return {
    success: true,
    ...notification,
  };
}

export function resetNotifications() {
  notifications.length = 0;
}
