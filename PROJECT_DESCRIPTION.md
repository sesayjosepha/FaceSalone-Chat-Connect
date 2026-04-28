# FaceSalone - Real-time Chat & Video Call App

## 🚀 Overview

**FaceSalone** (also referenced as ChatFacesAlone) is a modern, full-featured real-time messaging and video calling application built with React, TypeScript, Tailwind CSS, and Supabase. It provides a WhatsApp/Telegram-like experience with group rooms, direct messaging, voice/video calls via WebRTC, contacts management, status updates (stories), and comprehensive settings.

The app features a responsive mobile-first design using shadcn/ui components, glassmorphism effects, and smooth animations. It's optimized for PWA deployment with offline capabilities and push notifications.

Key highlights:
- **Real-time messaging** in 1:1 chats and group rooms
- **WebRTC voice/video calls** with signaling via Supabase
- **Contacts & QR sharing** for easy friend discovery
- **Status/Stories** with views and reactions
- **Online presence** and typing indicators
- **Rich media support** (photos, camera filters, attachments)

## ✨ Features

### Core Chat Features
- **Direct Messaging**: Private 1:1 conversations with unread counts
- **Group Rooms**: Public/private rooms with membership management
- **Rich Text Input**: Emoji picker, attachments, message search
- **Real-time Updates**: Typing indicators, online status, message delivery
- **Message History**: Infinite scroll, search, delete/unsend

### Communication
- **Voice & Video Calls**: Full WebRTC integration with camera filters
- **Incoming Call Handling**: Persistent call listener across tabs
- **Call Status**: Ringing, connected, ended, missed calls
- **Screen Sharing**: Ready for future extension

### Social Features
- **Contacts Manager**: Add/remove contacts by name/phone/email
- **QR Code Profiles**: Share profile via QR for easy adds
- **Status/Stories**: Ephemeral posts with view tracking and likes
- **Profile Editor**: Avatar, username, privacy settings

### UI/UX
- **Bottom Navigation**: Chats, Contacts, Status, Rooms, Settings tabs
- **Sidebar & Drawers**: Room members, chat settings, responsive layout
- **Dark/Light Mode**: Automatic theme detection
- **Glassmorphism Design**: Modern frosted glass effects
- **Animations**: Smooth transitions, pulse indicators, slide-ins

### Notifications & Presence
- **Push Notifications**: Web push for new messages/calls
- **Online Presence**: Real-time user status (online/offline)
- **Unread Badges**: Per-conversation and global counts

## 🛠 Tech Stack

### Frontend
```
React 18 + TypeScript
Vite (build tool)
Tailwind CSS + shadcn/ui (200+ components)
React Router (routing)
TanStack Query (data fetching/caching)
React Hook Form + Zod (forms/validation)
Lucide React (icons)
Sonner (toasts)
Embla Carousel, Recharts (UI charts)
```

### Backend & Database
```
Supabase (Auth, PostgreSQL, Realtime, Storage)
- 10+ Tables: profiles, conversations, direct_messages, rooms, messages, calls, 
  user_contacts, statuses, room_members, status_views, notification_settings
- Row Level Security (RLS) policies
- Realtime subscriptions for messages, calls, presence
```

### Integrations
```
WebRTC (peer-to-peer calls)
Supabase Auth (OAuth, email/phone)
qrcode.react (profile sharing)
```

### Development
```
Bun/NPM lockfiles
ESLint + TypeScript strict
Vitest (testing)
PostCSS + Autoprefixer
PWA-ready (manifest.json)
```

## 🏗 Project Structure

```
.
├── public/                 # Static assets (logo, manifest)
├── src/
│   ├── components/         # 50+ UI components (ChatWindow, CallScreen, etc.)
│   │   └── ui/            # shadcn/ui primitives
│   ├── contexts/          # AuthContext
│   ├── hooks/             # useWebRTCCall, usePresence, useNotifications
│   ├── integrations/      # Supabase client
│   ├── lib/              # Utilities, chatUtils
│   ├── pages/            # AuthPage, Index, NotFound
│   └── App.tsx           # Root with QueryClient, Router, Providers
├── supabase/              # Local Supabase config + migrations
├── package.json           # Dependencies & scripts
└── vite.config.ts        # Vite config with React SWC, aliases
```

## 📋 Database Schema (Key Tables)

1. **profiles** - User metadata (username, avatar, last_seen)
2. **conversations** - 1:1 chat metadata (user_one, user_two, last_message_at)
3. **direct_messages** - Private chat messages
4. **rooms** - Group chats (name, is_private, created_by)
5. **messages** - Room messages
6. **calls** - WebRTC signaling (caller/callee, status, type: voice/video)
7. **user_contacts** - Personal contact list
8. **statuses** - Stories/posts (user_id, media_url, expires_at)
9. **room_members** - Room membership tracking

**RLS Policies**: Per-user access control for all tables.

## 🚀 Setup & Development

1. **Prerequisites**
   ```
   Bun or Node.js 18+
   Supabase account/project (or local Supabase)
   ```

2. **Clone & Install**
   ```bash
   git clone <repo>
   cd chatfacesalone-mainblackboxedidtion
   bun install  # or npm install
   ```

3. **Environment**
   ```
   Copy .env.example to .env.local
   Add Supabase URL + Anon Key
   ```

4. **Run Development**
   ```bash
   bun dev  # http://localhost:8080
   ```

5. **Build for Production**
   ```bash
   bun build
   bun preview
   ```

6. **Supabase Migrations** (local dev)
   ```bash
   cd supabase
   supabase db reset  # Applies all migrations
   supabase start
   ```

## 📱 PWA Features
- **Manifest**: Installed app with logo
- **Offline**: Service worker ready
- **Notifications**: Web push support
- **Responsive**: Mobile-first, sidebar/drawer navigation

## 🔮 Future Enhancements
- File sharing & media gallery
- End-to-end encryption
- Voice messages
- Call recording
- Admin room controls
- i18n support

---

**Built with ❤️ using FaceSalone + shadcn/ui + Supabase stack**

*Project ID: rssbzrkelcaslhsusxna (Supabase)*
