# Locked In - Productivity Chrome Extension

A comprehensive productivity browser extension with todo lists, Pomodoro timer, website blocking, and time tracking.

## Features

- **Task Management** - Daily and regular tasks with priority levels and progress tracking
- **Pomodoro Timer** - 25/5/15 minute sessions with visual duck timer controls
- **Website Blocker** - Block distracting sites during focus sessions
- **Time Tracking** - Monitor time spent on websites with 10-second accuracy
- **Brain Break Mode** - Temporarily unblock sites for scheduled breaks

## Installation

1. Clone this repository or download as ZIP
2. Open Chrome and navigate to `chrome://extensions`
3. Enable "Developer mode" (top right toggle)
4. Click "Load unpacked" and select the project folder
5. Pin the extension to your toolbar

## Architecture

```
patriothacks25/
├── manifest.json           # Extension config (Manifest V3)
├── assets/
│   ├── icons/             # UI icons and duck sprites
│   ├── blocked.html       # Blocked site redirect page
│   └── custom.css         # Popup styling
├── src/
│   ├── background.js      # Service worker (tracking, blocking, notifications)
│   ├── content/           # Page injection scripts
│   └── popup/             # Main UI (popup.html + popup.js)
└── rules.json            # Dynamic blocking rules
```

**Tech Stack**: Manifest V3, Vanilla JavaScript, Bootstrap 5.3.2, Chrome Storage/Alarms/DeclarativeNetRequest APIs

**Key Implementation**:
- Service worker tracks active tab time every 10 seconds
- Duck avatar: clickable timer control with hover pause state
- Sticky progress bar uses `position: sticky` to stay visible while scrolling
- Dynamic site blocking via `declarativeNetRequest` API (no reload needed)

## Development

- **Debug Popup**: Right-click extension icon → Inspect popup
- **Debug Service Worker**: `chrome://extensions` → Inspect service worker
- **After Changes**: Click refresh icon on extension card

## Credits

Built upon [Fresh Chrome Extension](https://github.com/llagerlof/fresh-chrome-extension) by llagerlof (MIT License)

**Third-Party**:
- Bootstrap 5.3.2 (MIT) - https://getbootstrap.com
- Base template (MIT) - https://github.com/llagerlof/fresh-chrome-extension

## License

See [LICENSE](LICENSE) file for details.
