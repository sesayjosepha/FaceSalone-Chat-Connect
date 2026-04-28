# FaceSalone - Complete Feature Implementation Plan

## Phase 1: Foundation & UI Fixes ✅
- [x] **Fix App.css** - Removed Vite default styles (max-width, padding, text-align)
- [x] **Add ThemeProvider** - Wrapped app with `next-themes`, added light CSS variables in `index.css`
- [x] **Add theme toggle** in SettingsPage with Sun/Moon icons
- [x] **Fix Call missed status** - Auto-mark calls as `missed` after 30s if not answered

## Phase 2: Core Chat Features ✅
- [x] **Add unread tracking migration** - `unread_counts` table
- [x] **Compute and display unread counts** - In `ConversationList` (badges) and `ChatLayout` (BottomNav)
- [x] **Add typing indicators to DirectChatWindow** - Broadcast channel for DM typing with timeout
- [x] **Add reactions to DirectChatWindow** - `dm_reactions` table + toggle UI
- [x] **Add reply-to in DirectChatWindow** - Reply preview + insert with `reply_to`
- [x] **Add message search to DirectChatWindow** - Re-used `MessageSearch` component

## Phase 3: Notifications, Presence & Auth ✅
- [x] **Add read receipts** - `is_read` on `direct_messages`; mark visible as read on mount + scroll; respect `privacy_read_receipts`
- [x] **Add privacy helpers** in `chatUtils.ts` (canViewLastSeen, canViewProfilePhoto, canViewAbout)
- [x] **Add forgot password flow** - "Forgot password?" link in AuthPage using `resetPasswordForEmail`
- [x] **Add global presence heartbeat** - In `ChatLayout` updating `last_seen` every 30s
- [x] **Add basic service worker** - `public/sw.js` for PWA offline support

## Phase 4: Social & Communication Polish ✅
- [x] **Add QR/deep link handler** - App detects `?user=` param, adds contact automatically
- [x] **Add QR scanner UI** - `QRScanner` component with camera + manual entry fallback
- [x] **Update ContactsTab** - Scan QR and My QR buttons in header
- [x] **Update supabase types** - New tables/columns in `types.ts`

---

## Remaining Nice-to-Haves
- [x] Enforce privacy settings in DirectChatWindow (last_seen, avatar, read receipts)
- [ ] Enforce privacy settings in ConversationList and ContactsTab avatars
- [ ] Improve RoomsTab with last message preview and member count
- [ ] Add push notification subscriptions beyond basic browser notifications
- [ ] End-to-end encryption
- [ ] Voice messages playback progress
- [ ] Call recording

