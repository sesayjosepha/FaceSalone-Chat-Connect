import { format, isToday, isYesterday, isSameDay } from 'date-fns';

export function formatMessageDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMMM d, yyyy');
}

export function formatMessageTime(dateStr: string | null): string {
  if (!dateStr) return '';
  return format(new Date(dateStr), 'h:mm a');
}

export function shouldShowDateSeparator(currentDate: string | null, previousDate: string | null): boolean {
  if (!currentDate) return false;
  if (!previousDate) return true;
  return !isSameDay(new Date(currentDate), new Date(previousDate));
}

// Simple notification sound
let audioContext: AudioContext | null = null;

export function playNotificationSound() {
  try {
    if (!audioContext) {
      audioContext = new AudioContext();
    }
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  } catch {
    // Ignore audio errors
  }
}

// Privacy helpers
export type PrivacyLevel = 'everyone' | 'contacts' | 'nobody';

export function canViewLastSeen(
  privacy: PrivacyLevel | null,
  isContact: boolean
): boolean {
  if (!privacy || privacy === 'everyone') return true;
  if (privacy === 'nobody') return false;
  return isContact;
}

export function canViewProfilePhoto(
  privacy: PrivacyLevel | null,
  isContact: boolean
): boolean {
  if (!privacy || privacy === 'everyone') return true;
  if (privacy === 'nobody') return false;
  return isContact;
}

export function canViewAbout(
  privacy: PrivacyLevel | null,
  isContact: boolean
): boolean {
  if (!privacy || privacy === 'everyone') return true;
  if (privacy === 'nobody') return false;
  return isContact;
}

export function formatLastSeen(lastSeen: string | null): string {
  if (!lastSeen) return 'Offline';
  const date = new Date(lastSeen);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
