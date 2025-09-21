const DEFAULT_CONFIG = {
  persona: {
    name: "Easly AI",
    vibe: "friendly, confident, and concise",
    signOff: null
  },
  style: {
    useContractions: true,
    softenImperatives: true,
    addEmojis: true,
    maxEmojis: 2,
    avoidOverApologizing: true,
    askFollowUp: true,
    // Conversational teammate vibe
    useWeVoice: true,
    // Slightly "unhinged" playful energy, 0.0–0.6 recommended
    unhingedLevel: 0.35,
    followUpExamples: [
      "Want me to do that for you now?",
      "Should I go ahead and run that?",
      "Do you want a quick summary, too?",
      "Want me to save this as a template?"
    ],
    openers: [
      "Alright, here's the plan—",
      "Quick thought:",
      "Heads up:",
      "Okay, so—",
      "Low‑key:",
      "Real talk:",
      "Plot twist—"
    ],
    playfulAsides: [
      "no pressure",
      "your call",
      "we've got this",
      "I can already hear the label printer",
      "tiny chaos, big results",
      "I'll behave... probably",
      "brace for efficiency"
    ],
    emojiPalette: [
      "✨", "✅", "👍", "📊", "🛠️", "💡", "🚀", "📦", "🧠", "😊"
    ]
  }
};

class ToneManager {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.style = { ...DEFAULT_CONFIG.style, ...(config.style || {}) };
  }

  humanize(text, options = {}) {
    if (!text || typeof text !== 'string') return text;

    // Skip tone changes for JSON, code blocks, or very short strings
    if (this.looksLikeJSON(text) || this.looksLikeCode(text) || text.trim().length < 8) {
      return text.trim();
    }

    let out = text.trim();

    // Normalize whitespace
    out = out.replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n');

    // Avoid over-apologizing
    if (this.style.avoidOverApologizing) {
      out = out.replace(/\b(Sorry|Apologies|I\s*apologize)[^.!?]*[.!?]/gi, (m) => {
        // Keep one soft apology, remove repeats
        return m.toLowerCase().includes('inconvenience') ? m : '';
      });
      out = out.replace(/\n\n+/g, '\n\n');
    }

  if (this.style.useContractions) out = this.applyContractions(out);
  if (this.style.softenImperatives) out = this.softenImperatives(out);

  // Conversational teammate voice
  if (this.style.useWeVoice) out = this.applyWeVoice(out);

    // Add light emojis sparingly
    if (this.style.addEmojis) out = this.addEmojis(out);

    // Ensure friendly opener and optional follow-up question
  out = this.ensureFriendlyOpener(out);

  // Sprinkle a playful aside occasionally (controlled by unhingedLevel)
  out = this.addPlayfulAside(out);
    if (this.style.askFollowUp) out = this.appendFollowUp(out);

    // Trim trailing spaces
    out = out.replace(/[ \t]+$/gm, '');

    return out;
  }

  looksLikeJSON(s) {
    const t = s.trim();
    if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) return true;
    // Heuristic: too many braces/quotes
    const braces = (t.match(/[{}\[\]"]+/g) || []).join('');
    return braces.length > t.length * 0.2;
  }

  looksLikeCode(s) {
    return /```|\bfunction\b|=>|<\/?[a-z][^>]*>|const\s+|let\s+|var\s+/.test(s);
  }

  applyContractions(s) {
    return s
      .replace(/\bdo not\b/gi, "don't")
      .replace(/\bdoes not\b/gi, "doesn't")
      .replace(/\bdid not\b/gi, "didn't")
      .replace(/\bcan not\b/gi, "cannot")
      .replace(/\bcan not\b/gi, "can't")
      .replace(/\bwill not\b/gi, "won't")
      .replace(/\bis not\b/gi, "isn't")
      .replace(/\bare not\b/gi, "aren't")
      .replace(/\bwe are\b/gi, "we're")
      .replace(/\byou are\b/gi, "you're")
      .replace(/\bi am\b/gi, "I'm")
      .replace(/\bit is\b/gi, "it's");
  }

  softenImperatives(s) {
    // Replace hard imperatives at sentence starts with softer phrasing
    const map = {
      'Click': 'You can click',
      'Run': 'You can run',
      'Go to': 'Try going to',
      'Use': 'You could use',
      'Add': 'Let’s add',
      'Remove': 'Let’s remove',
      'Delete': 'Let’s delete',
      'Set': 'Let’s set'
    };
    s = s.replace(/(^|[.!?]\s+)(Click|Run|Go to|Use|Add|Remove|Delete|Set)\b/g, (m, prefix, cmd) => `${prefix}${map[cmd] || cmd}`);

    // Soften "You must/should" phrasing
    s = s.replace(/\byou\s+(must|should)\b/gi, (m, v) => v.toLowerCase() === 'must' ? 'you’ll want to' : 'you might want to');

    return s;
  }

  applyWeVoice(s) {
    // Lightly shift from "I can" to "We can" and reduce bossy "You must"
    let out = s;
    out = out.replace(/\bI can\b/gi, 'We can');
    out = out.replace(/\bI will\b/gi, 'We will');
    // Avoid altering quoted text/code
    return out;
  }

  addEmojis(s) {
    const palette = this.style.emojiPalette || [];
    const max = this.style.maxEmojis || 1;
    if (!palette.length || max <= 0) return s;

    let count = 0;
    const addOne = () => palette[(Math.floor(Math.random() * palette.length))];

    // Add one near the beginning (but after headings)
    let out = s.replace(/^(#+\s.*\n)?(.*)$/s, (m, heading, rest) => {
      if (count >= max) return m;
      const line = heading ? heading + rest : m;
      if (/^[A-Za-z]/.test(rest || m)) {
        count++;
        return (heading || '') + addOne() + ' ' + (rest || m);
      }
      return m;
    });

    // Optionally sprinkle a second one near the end
    if (count < max) {
      const parts = out.split(/\n\n/);
      if (parts.length > 1 && parts[parts.length - 1].length < 200) {
        parts[parts.length - 1] = parts[parts.length - 1] + ' ' + addOne();
        out = parts.join('\n\n');
      }
    }

    return out;
  }

  ensureFriendlyOpener(s) {
    // If text starts abruptly, add a light, varied opener
    const trimmed = s.trim();
    const needsOpener = /^(here|ok|done|success|result)\b/i.test(trimmed);
    const tooShort = trimmed.length < 8;
    if (!needsOpener || tooShort) return trimmed;
    const list = this.style.openers || [];
    const opener = list.length ? list[Math.floor(Math.random() * list.length)] : 'Got it —';
    return `${opener} ${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
  }

  appendFollowUp(s) {
    if (/\?$/.test(s.trim())) return s; // already a question
    const q = this.style.followUpExamples[Math.floor(Math.random() * this.style.followUpExamples.length)];
    // Add as a new line if content is longer; else inline
    return s.length > 80 ? `${s}\n\n${q}` : `${s} — ${q}`;
  }

  addPlayfulAside(s) {
    const level = Math.max(0, Math.min(1, this.style.unhingedLevel || 0));
    if (level <= 0.05) return s;
    const trimmed = s.trim();
    if (this.looksLikeJSON(trimmed) || this.looksLikeCode(trimmed)) return s;

    // Probability scaled by level, cap at ~30%
    const chance = Math.min(0.3, 0.1 + level * 0.4);
    if (Math.random() > chance) return s;

    const asides = this.style.playfulAsides || [];
    if (!asides.length) return s;
    const aside = asides[Math.floor(Math.random() * asides.length)];

    // Insert after first sentence or as tail em-dash
    const m = trimmed.match(/^[^.!?]+[.!?]/);
    if (m) {
      const idx = m[0].length;
      return trimmed.slice(0, idx) + ` (${aside})` + trimmed.slice(idx);
    }
    return `${trimmed} — ${aside}`;
  }
}

module.exports = ToneManager;
