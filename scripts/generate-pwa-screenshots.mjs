import sharp from 'sharp'

const colors = {
  bg: '#f8f8f6',
  ink: '#211f25',
  muted: '#706b75',
  maroon: '#6B1B2B',
  green: '#2d7a2d',
  amber: '#e0a020',
  red: '#e53935',
  surface: '#ffffff',
  line: '#ded9d2'
}

function escapeText(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function text(x, y, value, size, weight = 600, fill = colors.ink, anchor = 'start') {
  return `<text x="${x}" y="${y}" font-family="Inter, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${escapeText(value)}</text>`
}

function card(x, y, w, h, r = 14) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${colors.surface}" stroke="${colors.line}" stroke-width="2"/>`
}

function desktopSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
    <rect width="1280" height="720" fill="${colors.bg}"/>
    <rect x="0" y="0" width="1280" height="86" fill="${colors.maroon}"/>
    <circle cx="54" cy="43" r="25" fill="#ffffff" opacity="0.96"/>
    <path d="M57 19 38 48h16l-5 19 22-31H55z" fill="${colors.maroon}"/>
    ${text(92, 52, 'GAAstat', 30, 800, '#ffffff')}
    ${text(1060, 52, 'Match Day', 22, 700, '#ffffff')}

    ${card(40, 118, 355, 214)}
    ${text(66, 160, 'Clonmore', 22, 800)}
    ${text(66, 206, '2-12', 54, 900, colors.maroon)}
    ${text(66, 244, 'vs Ballyroe 1-10', 20, 700, colors.muted)}
    <rect x="66" y="274" width="116" height="34" rx="17" fill="#e9f3e9"/>
    ${text(124, 297, 'Leading by 5', 16, 800, colors.green, 'middle')}

    ${card(430, 118, 420, 500)}
    ${text(456, 160, 'Pitch Heatmap', 24, 800)}
    <rect x="472" y="196" width="300" height="360" rx="30" fill="#265f37"/>
    <line x1="622" y1="196" x2="622" y2="556" stroke="#ffffff" stroke-width="3" opacity="0.7"/>
    <line x1="472" y1="376" x2="772" y2="376" stroke="#ffffff" stroke-width="3" opacity="0.7"/>
    <circle cx="622" cy="376" r="56" fill="none" stroke="#ffffff" stroke-width="3" opacity="0.7"/>
    <circle cx="552" cy="283" r="20" fill="${colors.amber}" opacity="0.88"/>
    <circle cx="692" cy="322" r="31" fill="${colors.green}" opacity="0.78"/>
    <circle cx="608" cy="458" r="24" fill="${colors.red}" opacity="0.78"/>
    <circle cx="676" cy="492" r="16" fill="#ffffff" opacity="0.86"/>

    ${card(886, 118, 354, 500)}
    ${text(912, 160, 'Sideline AI', 24, 800)}
    ${text(912, 198, 'Puckout won jersey 8', 19, 700, colors.muted)}
    <rect x="912" y="228" width="278" height="54" rx="12" fill="#f2f6f0"/>
    ${text(936, 262, 'Logged: puckout won by #8', 18, 800, colors.green)}
    ${text(912, 330, 'Top Players', 22, 800)}
    ${text(912, 372, '#8  5 puckouts won', 18, 700)}
    ${text(912, 412, '#11  0-04 from play', 18, 700)}
    ${text(912, 452, '#5  3 turnovers won', 18, 700)}
    <rect x="912" y="498" width="190" height="46" rx="23" fill="${colors.maroon}"/>
    ${text(1007, 528, 'Ask Match AI', 17, 800, '#ffffff', 'middle')}
  </svg>`
}

function mobileSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="390" height="844" viewBox="0 0 390 844">
    <rect width="390" height="844" fill="${colors.bg}"/>
    <rect x="0" y="0" width="390" height="88" fill="${colors.maroon}"/>
    <circle cx="42" cy="44" r="22" fill="#ffffff" opacity="0.96"/>
    <path d="M45 25 32 49h12l-4 15 17-25H44z" fill="${colors.maroon}"/>
    ${text(76, 52, 'GAAstat', 25, 850, '#ffffff')}
    ${text(22, 130, 'New Match', 24, 850)}

    ${card(22, 154, 346, 122)}
    ${text(46, 196, 'Clonmore', 17, 800)}
    ${text(46, 242, '2-12', 42, 900, colors.maroon)}
    ${text(226, 196, 'Ballyroe', 17, 800)}
    ${text(226, 242, '1-10', 42, 900, colors.ink)}

    ${card(22, 296, 346, 180)}
    ${text(46, 336, 'Quick Log', 19, 850)}
    <rect x="46" y="358" width="86" height="42" rx="10" fill="${colors.green}"/>
    ${text(89, 385, 'Point', 15, 800, '#ffffff', 'middle')}
    <rect x="152" y="358" width="86" height="42" rx="10" fill="${colors.maroon}"/>
    ${text(195, 385, 'Goal', 15, 800, '#ffffff', 'middle')}
    <rect x="258" y="358" width="86" height="42" rx="10" fill="${colors.amber}"/>
    ${text(301, 385, 'Puckout', 15, 800, '#ffffff', 'middle')}
    <rect x="46" y="416" width="298" height="34" rx="17" fill="#f2f6f0"/>
    ${text(195, 439, 'Sideline AI listening', 15, 800, colors.green, 'middle')}

    ${card(22, 498, 346, 214)}
    ${text(46, 538, 'Shot Heatmap', 19, 850)}
    <rect x="88" y="560" width="214" height="118" rx="16" fill="#265f37"/>
    <line x1="195" y1="560" x2="195" y2="678" stroke="#ffffff" stroke-width="2" opacity="0.7"/>
    <circle cx="195" cy="619" r="30" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.7"/>
    <circle cx="146" cy="592" r="13" fill="${colors.green}" opacity="0.85"/>
    <circle cx="224" cy="616" r="18" fill="${colors.amber}" opacity="0.86"/>
    <circle cx="182" cy="650" r="12" fill="${colors.red}" opacity="0.82"/>

    ${card(22, 734, 346, 76)}
    ${text(46, 776, 'Player #8', 17, 850)}
    ${text(194, 776, '5 puckouts won', 17, 750, colors.green)}
  </svg>`
}

await sharp(Buffer.from(desktopSvg())).png().toFile('static/screenshots/desktop-match.png')
await sharp(Buffer.from(mobileSvg())).png().toFile('static/screenshots/mobile-match.png')
