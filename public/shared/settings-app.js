var SUBJECTS = [
  { key: 'geometry', cat: 'math', label: 'Geometry', color: '#936e2a', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="3,20 21,20 3,3"/><line x1="7" y1="20" x2="7" y2="17"/><line x1="11" y1="20" x2="11" y2="17"/><line x1="15" y1="20" x2="15" y2="17"/></svg>' },
  { key: 'chemistry', cat: 'science', label: 'Chemistry', color: '#0f7a70', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 2h10v6c0 1-1 2-2 2H9c-1 0-2-1-2-2V2z"/><path d="M7 8h10v10c0 2-1.5 3-5 3s-5-1-5-3V8z"/><circle cx="10" cy="12" r="1"/><circle cx="14" cy="14" r="0.8"/></svg>' },
  { key: 'algebra1', cat: 'math', label: 'Algebra I', color: '#2563a8', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="19" x2="20" y2="5"/><circle cx="6" cy="17" r="1.4" fill="currentColor" stroke="none"/><circle cx="18" cy="7" r="1.4" fill="currentColor" stroke="none"/><path d="M14 19h6"/><path d="M4 9V5h4"/></svg>' },
  { key: 'algebra2', cat: 'math', label: 'Algebra II', color: '#1c7a4a', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h14"/><path d="M5 20h14"/><path d="M5 4l14 16"/><path d="M19 4L5 20"/></svg>' },
  { key: 'aplang', cat: 'ap', label: 'AP English Lang & Comp', color: '#8b2942', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>' },
  { key: 'globalhistory', cat: 'humanities', label: 'Global History', color: '#b5541f', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z"/></svg>' },
  { key: 'apbiology', cat: 'ap', label: 'AP Biology', color: '#2e7d4f', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c-4 3-7 6-7 11a7 7 0 0 0 14 0c0-5-3-8-7-11z"/><path d="M12 8v10"/></svg>' },
  { key: 'apush', cat: 'ap', label: 'APUSH', color: '#1e4d8b', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6l9-3 9 3"/><path d="M4 10v8M9 10v8M15 10v8M20 10v8"/><path d="M2 21h20"/></svg>' },
  { key: 'us-history', cat: 'humanities', label: 'US History', color: '#8a5a2b', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6l9-3 9 3"/><path d="M4 10v8M9 10v8M15 10v8M20 10v8"/><path d="M2 21h20"/></svg>' },
  { key: 'physics', cat: 'science', label: 'Physics', color: '#7a3ba8', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2.2"/><ellipse cx="12" cy="12" rx="9" ry="3.6"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)"/></svg>' },
  { key: 'biology', cat: 'science', label: 'Biology', color: '#2e7d4f', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="9" r="5"/><circle cx="15" cy="15" r="5"/></svg>' },
  { key: 'precalc', cat: 'math', label: 'PreCalculus', color: '#0f6e73', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17c3-8 6-12 8-12s3 6 4 10 3 4 4 1"/></svg>' },
  { key: 'act-prep', cat: 'testprep', label: 'ACT Prep', color: '#b91c1c', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/></svg>' },
  { key: 'anatomy', cat: 'science', label: 'Anatomy & Physiology', color: '#be123c', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/><path d="M7 12h3l1.5-3 2 6L15 9l1 3h2" stroke-width="1.2"/></svg>' },
  { key: 'ap-chemistry', cat: 'ap', label: 'AP Chemistry', color: '#0369a1', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 2h10v6c0 1-1 2-2 2H9c-1 0-2-1-2-2V2z"/><path d="M7 8h10v10c0 2-1.5 3-5 3s-5-1-5-3V8z"/><circle cx="10" cy="12" r="1"/><circle cx="14" cy="14" r="0.8"/></svg>' },
  { key: 'ap-csa', cat: 'ap', label: 'AP Computer Science A', color: '#1e40af', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>' },
  { key: 'ap-euro', cat: 'ap', label: 'AP European History', color: '#166534', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21h16"/><path d="M5 21V9M9 21V9M15 21V9M19 21V9"/><path d="M3 9l9-6 9 6"/></svg>' },
  { key: 'ap-macro', cat: 'ap', label: 'AP Macroeconomics', color: '#065f46', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><rect x="7" y="13" width="3" height="5"/><rect x="12" y="9" width="3" height="9"/><rect x="17" y="6" width="3" height="12"/></svg>' },
  { key: 'ap-micro', cat: 'ap', label: 'AP Microeconomics', color: '#9a3412', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M7 6h7a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h8"/></svg>' },
  { key: 'ap-physics', cat: 'ap', label: 'AP Physics 1', color: '#1d4ed8', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2.2"/><ellipse cx="12" cy="12" rx="9" ry="3.6"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)"/></svg>' },
  { key: 'ap-psych', cat: 'ap', label: 'AP Psychology', color: '#9333ea', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3a4 4 0 0 0-4 4c0 1 .3 1.7.8 2.3A3.5 3.5 0 0 0 4 12.5 3.5 3.5 0 0 0 6.5 16c-.1.4-.2.8-.2 1.2A3.8 3.8 0 0 0 10 21c1.3 0 2-.6 2-1.8V7a4 4 0 0 0-3-4z"/><path d="M15 3a4 4 0 0 1 4 4c0 1-.3 1.7-.8 2.3a3.5 3.5 0 0 1 .8 6.2c.1.4.2.8.2 1.2A3.8 3.8 0 0 1 15 21c-1.3 0-2-.6-2-1.8V7a4 4 0 0 1 2-4z"/></svg>' },
  { key: 'ap-stats', cat: 'ap', label: 'AP Statistics', color: '#c2410c', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M9 20V4M14 20v-7M19 20V8"/></svg>' },
  { key: 'ap-usgov', cat: 'ap', label: 'AP US Government', color: '#1e3a8a', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c2 2 3 4 3 7H9c0-3 1-5 3-7z"/><path d="M4 11h16M5 11v8M9 11v8M15 11v8M19 11v8"/><path d="M3 21h18"/></svg>' },
  { key: 'ap-world', cat: 'ap', label: 'AP World History', color: '#a16207', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 9h18M3 15h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" stroke-width="1.1"/></svg>' },
  { key: 'ap-human-geography', cat: 'ap', label: 'AP Human Geography', color: '#0e7490', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 9h18M3 15h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" stroke-width="1.1"/></svg>' },
  { key: 'art-history', cat: 'humanities', label: 'Art History', color: '#9f1239', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-.8 2-1.8 0-1.6-1.6-1.7-1.6-3 0-1 .8-1.7 2.1-1.7H17a4 4 0 0 0 4-4c0-5-4-8.5-9-8.5z"/><circle cx="8" cy="9" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="7" r="1" fill="currentColor" stroke="none"/><circle cx="16" cy="9" r="1" fill="currentColor" stroke="none"/></svg>' },
  { key: 'astronomy', cat: 'science', label: 'Astronomy', color: '#4338ca', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><g stroke-width="1"><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/></g></svg>' },
  { key: 'computer-science', cat: 'electives', label: 'Computer Science', color: '#4338ca', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>' },
  { key: 'creative-writing', cat: 'english', label: 'Creative Writing', color: '#db2777', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>' },
  { key: 'earth-science', cat: 'science', label: 'Earth Science', color: '#0e7490', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17c3-1 5-4 9-4s6 3 9 4"/><path d="M3 21c3-1 5-4 9-4s6 3 9 4"/><circle cx="12" cy="7" r="4"/></svg>' },
  { key: 'economics', cat: 'humanities', label: 'Economics', color: '#7c3aed', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/></svg>' },
  { key: 'english-10', cat: 'english', label: 'English 10', color: '#b45309', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6l4-3 4 3v13l-4-2-4 2V6z"/><path d="M10 6l4-3 4 3v13l-4-2-4 2"/></svg>' },
  { key: 'english-9', cat: 'english', label: 'English 9', color: '#be185d', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6l4-3 4 3v13l-4-2-4 2V6z"/><path d="M10 6l4-3 4 3v13l-4-2-4 2"/></svg>' },
  { key: 'environmental-science', cat: 'science', label: 'Environmental Science', color: '#15803d', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>' },
  { key: 'french-1', cat: 'languages', label: 'French 1', color: '#2563eb', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M8 4h8M8 20h8M12 2c-3 2-4 5-4 8 0 4 2 8 4 10 2-2 4-6 4-10 0-3-1-6-4-8z"/></svg>' },
  { key: 'french-2', cat: 'languages', label: 'French 2', color: '#1d4ed8', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M8 4h8M8 20h8M12 2c-3 2-4 5-4 8 0 4 2 8 4 10 2-2 4-6 4-10 0-3-1-6-4-8z"/></svg>' },
  { key: 'french-3', cat: 'languages', label: 'French 3', color: '#4338ca', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M8 4h8M8 20h8M12 2c-3 2-4 5-4 8 0 4 2 8 4 10 2-2 4-6 4-10 0-3-1-6-4-8z"/></svg>' },
  { key: 'geography', cat: 'humanities', label: 'Geography', color: '#02845c', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3.5 9h17M3.5 15h17"/></svg>' },
  { key: 'german-1', cat: 'languages', label: 'German 1', color: '#334155', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16"/></svg>' },
  { key: 'health', cat: 'electives', label: 'Health', color: '#dc2626', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' },
  { key: 'journalism', cat: 'english', label: 'Journalism', color: '#0f766e', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6z"/></svg>' },
  { key: 'music-theory', cat: 'electives', label: 'Music Theory', color: '#b45309', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>' },
  { key: 'psychology', cat: 'humanities', label: 'Psychology', color: '#7c3aed', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/><path d="M9 3h6M9 21h6" stroke-width="1.2"/></svg>' },
  { key: 'sat-math', cat: 'testprep', label: 'SAT Math Prep', color: '#0369a1', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/></svg>' },
  { key: 'sat-reading', cat: 'testprep', label: 'SAT Reading & Writing', color: '#7c2d12', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/></svg>' },
  { key: 'sociology', cat: 'humanities', label: 'Sociology', color: '#057f9c', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><circle cx="16.5" cy="9.5" r="2.6"/><path d="M3.5 20c.5-3.5 2.7-5.5 5.5-5.5s5 2 5.5 5.5"/><path d="M15.5 15.5c2.3.3 4.2 2 4.8 4.5"/></svg>' },
  { key: 'spanish-1', cat: 'languages', label: 'Spanish 1', color: '#c2410c', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><text x="12" y="16" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor" stroke="none" font-family="Georgia">ñ</text></svg>' },
  { key: 'spanish-2', cat: 'languages', label: 'Spanish 2', color: '#9a3412', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><text x="12" y="16" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor" stroke="none" font-family="Georgia">ñ</text><path d="M4 20h16" stroke-width="1.2"/></svg>' },
  { key: 'spanish-3', cat: 'languages', label: 'Spanish 3', color: '#c54808', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><text x="12" y="16" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor" stroke="none" font-family="Georgia">¿</text></svg>' },
  { key: 'speech-debate', cat: 'english', label: 'Speech & Debate', color: '#7e22ce', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/></svg>' },
  { key: 'statistics', cat: 'math', label: 'Statistics', color: '#af5f01', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M9 20V4M14 20v-7M19 20V8"/></svg>' },
  { key: 'study-skills', cat: 'electives', label: 'Study Skills', color: '#4d7c0f', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>' },
  { key: 'us-government', cat: 'humanities', label: 'US Government', color: '#23744f', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c2 2 3 4 3 7H9c0-3 1-5 3-7z"/><path d="M4 11h16M5 11v8M9 11v8M15 11v8M19 11v8"/><path d="M3 21h18"/></svg>' },
  { key: 'world-history', cat: 'humanities', label: 'World History', color: '#8558ec', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h6M7 13h8M7 17h5"/></svg>' },
  { key: 'calculus', cat: 'math', label: 'Calculus', color: '#0e7490', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18c3-9 6-13 8-13s3 7 4 11 3 5 4 2"/></svg>' },
  { key: 'calc-ab', cat: 'ap', label: 'AP Calculus AB', color: '#4338ca', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18c3-9 6-13 8-13s3 7 4 11"/><path d="M8 15.5 L18 8.5" stroke-dasharray="1.5 2"/><circle cx="11.6" cy="12.3" r="1.1" fill="currentColor" stroke="none"/></svg>' },
  { key: 'calc-bc', cat: 'ap', label: 'AP Calculus BC', color: '#7c3aed', icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12 m-2,0 a2,2 0 1,0 4,0 a2,2 0 1,0 -4,0"/><path d="M12 12 m-5,0 a5,5 0 1,0 10,0 a5,5 0 1,0 -10,0" stroke-dasharray="1.5 2"/><path d="M12 12 m-8.5,0 a8.5,8.5 0 1,0 17,0 a8.5,8.5 0 1,0 -17,0" stroke-dasharray="1 3"/></svg>' },
];

var SUBJECT_CATEGORIES = [
  { key: 'math', label: 'Mathematics' },
  { key: 'science', label: 'Science' },
  { key: 'humanities', label: 'Humanities & Social Studies' },
  { key: 'english', label: 'English & Writing' },
  { key: 'languages', label: 'World Languages' },
  { key: 'ap', label: 'AP Courses' },
  { key: 'testprep', label: 'Test Prep' },
  { key: 'electives', label: 'Electives & Skills' },
];

function ssEscapeHtml(s){
  // Escapes quotes as well as & < >, so the result is safe inside attribute values too.
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;';
  });
}

let SS_SESSION;

function ssLoginBoxHtml(){
  return '<a class="ss-oauth-btn" href="/auth/google/start?next=' + encodeURIComponent(location.pathname) + '">Continue with Google</a>'
    + '<a class="ss-oauth-btn" href="/auth/github/start?next=' + encodeURIComponent(location.pathname) + '">Continue with GitHub</a>'
    + '<div class="ss-status"></div>';
}

function ssToggleLoginPanel(){
  var panel = document.getElementById('ss-login-panel');
  if(!panel) return;
  var opening = !panel.classList.contains('open');
  panel.classList.toggle('open', opening);
  if(opening) panel.querySelector('.ss-login-box').innerHTML = ssLoginBoxHtml();
}

async function ssLogout(){
  try{ await fetch('/auth/logout', {method:'POST'}); }catch(e){}
  if(window.ssClearLocalData)ssClearLocalData();
  SS_SESSION = false;
  ssRenderAccountUI();
}

async function ssExportMyData(){
  var btn = document.getElementById('export-data-btn');
  var status = document.getElementById('export-data-status');
  btn.disabled = true;
  status.textContent = 'Preparing your download…';
  try{
    var res = await fetch('/api/progress');
    if(!res.ok){
      status.textContent = "Couldn't fetch your data — try again.";
      btn.disabled = false;
      return;
    }
    var data = await res.json();
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'precisstudy-data-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    status.textContent = 'Downloaded ✓';
    btn.disabled = false;
  }catch(e){
    status.textContent = "Couldn't fetch your data — check your connection and try again.";
    btn.disabled = false;
  }
}

function ssRenderShareState(token){
  var off = document.getElementById('ss-share-off');
  var on = document.getElementById('ss-share-on');
  var input = document.getElementById('ss-share-link');
  if(token){
    off.style.display = 'none';
    on.style.display = 'block';
    input.value = location.origin + '/share?t=' + encodeURIComponent(token);
  }else{
    off.style.display = 'block';
    on.style.display = 'none';
    input.value = '';
  }
}
async function ssShareGenerate(){
  var btn = document.getElementById('ss-share-generate-btn');
  var status = document.getElementById('ss-share-status');
  btn.disabled = true;
  status.textContent = 'Creating link…';
  try{
    var res = await fetch('/api/share/generate', {method:'POST'});
    var data = await res.json().catch(function(){ return {}; });
    if(!res.ok){
      status.textContent = data.error || "Couldn't create a share link — try again.";
      btn.disabled = false;
      return;
    }
    ssRenderShareState(data.token);
    status.textContent = 'Link created.';
    btn.disabled = false;
  }catch(e){
    status.textContent = "Couldn't create a share link — check your connection and try again.";
    btn.disabled = false;
  }
}
async function ssShareRevoke(){
  if(!(await ssConfirm('Revoke your share link? Anyone with the old link will lose access immediately.'))) return;
  var btn = document.getElementById('ss-share-revoke-btn');
  var status = document.getElementById('ss-share-status');
  btn.disabled = true;
  status.textContent = 'Revoking…';
  try{
    var res = await fetch('/api/share/revoke', {method:'POST'});
    if(!res.ok){
      status.textContent = "Couldn't revoke your link — try again.";
      btn.disabled = false;
      return;
    }
    ssRenderShareState(null);
    status.textContent = 'Link revoked.';
    btn.disabled = false;
  }catch(e){
    status.textContent = "Couldn't revoke your link — check your connection and try again.";
    btn.disabled = false;
  }
}
function ssRenderCalendarState(token){
  var off = document.getElementById('ss-cal-off');
  var on = document.getElementById('ss-cal-on');
  var input = document.getElementById('ss-cal-link');
  if(token){
    off.style.display = 'none';
    on.style.display = 'block';
    input.value = location.origin + '/api/calendar.ics?t=' + encodeURIComponent(token);
  }else{
    off.style.display = 'block';
    on.style.display = 'none';
    input.value = '';
  }
}
async function ssCalendarGenerate(){
  var btn = document.getElementById('ss-cal-generate-btn');
  var status = document.getElementById('ss-cal-status');
  btn.disabled = true;
  status.textContent = 'Creating link…';
  try{
    var res = await fetch('/api/calendar/generate', {method:'POST'});
    var data = await res.json().catch(function(){ return {}; });
    if(!res.ok){
      status.textContent = data.error || "Couldn't create a calendar link — try again.";
      btn.disabled = false;
      return;
    }
    ssRenderCalendarState(data.token);
    status.textContent = 'Link created — subscribe to it from your calendar app.';
    btn.disabled = false;
  }catch(e){
    status.textContent = "Couldn't create a calendar link — check your connection and try again.";
    btn.disabled = false;
  }
}
async function ssCalendarRevoke(){
  if(!(await ssConfirm('Revoke your calendar link? Any calendar app subscribed to it will stop getting updates.'))) return;
  var btn = document.getElementById('ss-cal-revoke-btn');
  var status = document.getElementById('ss-cal-status');
  btn.disabled = true;
  status.textContent = 'Revoking…';
  try{
    var res = await fetch('/api/calendar/revoke', {method:'POST'});
    if(!res.ok){
      status.textContent = "Couldn't revoke your link — try again.";
      btn.disabled = false;
      return;
    }
    ssRenderCalendarState(null);
    status.textContent = 'Link revoked.';
    btn.disabled = false;
  }catch(e){
    status.textContent = "Couldn't revoke your link — check your connection and try again.";
    btn.disabled = false;
  }
}
async function ssCalendarCopy(){
  var input = document.getElementById('ss-cal-link');
  var status = document.getElementById('ss-cal-status');
  try{
    await navigator.clipboard.writeText(input.value);
    status.textContent = 'Copied ✓';
  }catch(e){
    input.select();
    status.textContent = 'Select the link above and copy it manually.';
  }
}
function ssRenderInviteState(token, invitesAccepted){
  var off = document.getElementById('ss-invite-off');
  var on = document.getElementById('ss-invite-on');
  var input = document.getElementById('ss-invite-link');
  var count = document.getElementById('ss-invite-count');
  if(token){
    off.style.display = 'none';
    on.style.display = 'block';
    input.value = location.origin + '/?ref=' + encodeURIComponent(token);
    var n = invitesAccepted || 0;
    count.textContent = n === 1 ? '1 classmate has joined using your link.' : n + ' classmates have joined using your link.';
  }else{
    off.style.display = 'block';
    on.style.display = 'none';
    input.value = '';
  }
}
async function ssInviteGenerate(){
  var btn = document.getElementById('ss-invite-generate-btn');
  var status = document.getElementById('ss-invite-status');
  btn.disabled = true;
  status.textContent = 'Creating link…';
  try{
    var res = await fetch('/api/invite/generate', {method:'POST'});
    var data = await res.json().catch(function(){ return {}; });
    if(!res.ok){
      status.textContent = data.error || "Couldn't create an invite link — try again.";
      btn.disabled = false;
      return;
    }
    ssRenderInviteState(data.token, data.invitesAccepted);
    status.textContent = '';
    btn.disabled = false;
  }catch(e){
    status.textContent = "Couldn't create an invite link — check your connection and try again.";
    btn.disabled = false;
  }
}
async function ssInviteCopy(){
  var input = document.getElementById('ss-invite-link');
  var status = document.getElementById('ss-invite-status');
  try{
    await navigator.clipboard.writeText(input.value);
    status.textContent = 'Copied ✓';
  }catch(e){
    input.select();
    status.textContent = 'Select the link above and copy it manually.';
  }
}
async function ssShareCopy(){
  var input = document.getElementById('ss-share-link');
  var status = document.getElementById('ss-share-status');
  try{
    await navigator.clipboard.writeText(input.value);
    status.textContent = 'Copied ✓';
  }catch(e){
    input.select();
    status.textContent = 'Select the link above and copy it manually.';
  }
}
async function ssResetAllProgress(){
  if(!(await ssConfirm("Reset all progress? This wipes your mastery, quiz history, and flashcard ratings for every class back to 0% and can't be undone. Your account, classes, schedule, and streak are kept."))) return;
  var btn = document.getElementById('reset-progress-btn');
  var status = document.getElementById('reset-progress-status');
  btn.disabled = true;
  status.textContent = 'Resetting…';
  try{
    var res = await fetch('/api/progress/reset', {method:'POST'});
    if(!res.ok){
      var data = await res.json().catch(function(){ return {}; });
      status.textContent = data.error || "Couldn't reset your progress — try again.";
      btn.disabled = false;
      return;
    }
    status.textContent = 'Done — every class is back to 0%.';
    btn.disabled = false;
  }catch(e){
    status.textContent = "Couldn't reset your progress — check your connection and try again.";
    btn.disabled = false;
  }
}
async function ssSignOutEverywhere(){
  if(!(await ssConfirm('Sign out of all devices? Every browser currently signed in, including this one, will need to sign in again.'))) return;
  var btn = document.getElementById('sign-out-everywhere-btn');
  var status = document.getElementById('sign-out-everywhere-status');
  btn.disabled = true;
  status.textContent = 'Signing out…';
  try{
    var res = await fetch('/auth/sign-out-everywhere', {method:'POST'});
    if(!res.ok){
      var data = await res.json().catch(function(){ return {}; });
      status.textContent = data.error || "Couldn't sign out — try again.";
      btn.disabled = false;
      return;
    }
    location.href = '/';
  }catch(e){
    status.textContent = "Couldn't sign out — check your connection and try again.";
    btn.disabled = false;
  }
}

async function ssDeleteAccount(){
  var who = (SS_SESSION && SS_SESSION.email) || '';
  if(who){
    var typed = await ssPrompt('This permanently erases your saved progress, streak, classes, and connected accounts. To confirm, type your email address (' + who + '):');
    if(!typed || typed.trim().toLowerCase() !== who.toLowerCase()) return;
  }else if(!(await ssConfirm('Delete your account? This permanently erases your saved progress, streak, classes, and connected accounts and cannot be undone.'))) return;
  var btn = document.getElementById('delete-account-btn');
  var status = document.getElementById('delete-account-status');
  btn.disabled = true;
  status.textContent = 'Deleting…';
  try{
    var res = await fetch('/auth/delete-account', {method:'POST'});
    if(!res.ok){
      var data = await res.json().catch(function(){ return {}; });
      status.textContent = data.error || "Couldn't delete your account — try again.";
      btn.disabled = false;
      return;
    }
    location.href = '/';
  }catch(e){
    status.textContent = "Couldn't delete your account — check your connection and try again.";
    btn.disabled = false;
  }
}

function ssRenderAccountUI(){
  var area = document.getElementById('ss-account-area');
  if(!area) return;
  if(SS_SESSION){
    area.innerHTML = '<div class="ss-account"><span class="ss-account-name">' + ssEscapeHtml(SS_SESSION.name) + '</span>'
      + '<button onclick="ssLogout()">Sign out</button></div>';
  }else{
    area.innerHTML = '<button id="ss-signin-btn" onclick="ssToggleLoginPanel()">Sign In</button>'
      + '<div id="ss-login-panel"><div class="ss-login-box"></div></div>';
  }
}

async function ssCheckSession(){
  try{
    var res = await fetch('/auth/me');
    var data = await res.json();
    SS_SESSION = data.loggedIn ? data : false;
  }catch(e){
    SS_SESSION = false;
  }
  ssRenderAccountUI();
  return SS_SESSION;
}

document.addEventListener('click', function(e){
  var panel = document.getElementById('ss-login-panel');
  var area = document.getElementById('ss-account-area');
  if(panel && panel.classList.contains('open') && area && !area.contains(e.target)){
    panel.classList.remove('open');
  }
});

var SS_ORIGINAL_ENROLLED = new Set();

function ssCurrentEnrolledSet(){
  return new Set(Array.prototype.slice.call(document.querySelectorAll('#class-list input[type="checkbox"]:checked'))
    .map(function(cb){ return cb.dataset.key; }));
}

function ssSetsEqual(a, b){
  if(a.size !== b.size) return false;
  for(var v of a){ if(!b.has(v)) return false; }
  return true;
}

function ssClassListDirty(){
  return !ssSetsEqual(ssCurrentEnrolledSet(), SS_ORIGINAL_ENROLLED);
}

function ssUpdateUnsavedBar(){
  var bar = document.getElementById('ss-unsaved-bar');
  if(!bar) return;
  bar.classList.toggle('visible', ssClassListDirty());
}

function renderClassList(enrolled){
  SS_ORIGINAL_ENROLLED = new Set(enrolled || []);
  var enrolledSet = SS_ORIGINAL_ENROLLED;
  var list = document.getElementById('class-list');

  var byCat = {};
  SUBJECTS.forEach(function(s){ (byCat[s.cat] = byCat[s.cat] || []).push(s); });

  list.innerHTML = SUBJECT_CATEGORIES.map(function(cat){
    var subjects = byCat[cat.key] || [];
    if(!subjects.length) return '';
    var openCount = subjects.filter(function(s){ return enrolledSet.has(s.key); }).length;
    var rows = subjects.map(function(s){
      var checked = enrolledSet.has(s.key);
      return '<label class="class-row' + (checked ? ' checked' : '') + '" data-key="' + s.key + '" data-name="' + ssEscapeHtml(s.label.toLowerCase()) + '">'
        + '<input type="checkbox" data-key="' + s.key + '"' + (checked ? ' checked' : '') + '/>'
        + '<span class="swatch" style="color:' + s.color + '">' + s.icon + '</span>'
        + '<span class="name">' + ssEscapeHtml(s.label) + '</span>'
        + '</label>';
    }).join('');
    return '<details class="ss-cat" data-cat="' + cat.key + '"' + (openCount ? ' open' : '') + '>'
      + '<summary><span>' + ssEscapeHtml(cat.label) + '</span>'
      + '<span style="display:flex;align-items:center;gap:8px;">'
      + '<span class="ss-cat-count">' + subjects.length + '</span>'
      + '<svg class="ss-cat-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>'
      + '</span></summary>'
      + '<div class="ss-cat-body">' + rows + '</div>'
      + '</details>';
  }).join('') + '<div id="class-no-match" class="ss-no-match" hidden>No classes match your search.</div>';

  list.querySelectorAll('input[type="checkbox"]').forEach(function(cb){
    cb.addEventListener('change', function(){
      cb.closest('.class-row').classList.toggle('checked', cb.checked);
      ssUpdateUnsavedBar();
    });
  });
  ssUpdateUnsavedBar();
}

function ssFilterClassList(query){
  var q = (query || '').trim().toLowerCase();
  var list = document.getElementById('class-list');
  if(!list) return;
  var cats = list.querySelectorAll('.ss-cat');
  var anyVisible = false;
  cats.forEach(function(cat){
    var rows = cat.querySelectorAll('.class-row');
    var catHasMatch = false;
    rows.forEach(function(row){
      var match = !q || row.dataset.name.indexOf(q) !== -1;
      row.hidden = !match;
      if(match) catHasMatch = true;
    });
    cat.hidden = !catHasMatch;
    if(catHasMatch) anyVisible = true;
    if(q){
      cat.open = catHasMatch;
    }else{
      // restore default open state (already-enrolled categories) when search is cleared
      cat.open = cat.querySelectorAll('.class-row.checked').length > 0;
    }
  });
  var noMatch = document.getElementById('class-no-match');
  if(noMatch) noMatch.hidden = anyVisible || !q;
}

document.getElementById('class-search').addEventListener('input', function(e){
  ssFilterClassList(e.target.value);
});

function ssShowToast(message){
  var toast = document.getElementById('ss-toast');
  if(!toast) return;
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(function(){ toast.classList.remove('visible'); }, 2600);
}

async function saveEnrolledSubjects(){
  var btn = document.getElementById('settings-save-btn');
  var unsavedBtn = document.getElementById('ss-unsaved-save');
  var status = document.getElementById('settings-status');
  var checked = Array.prototype.slice.call(document.querySelectorAll('#class-list input[type="checkbox"]:checked'))
    .map(function(cb){ return cb.dataset.key; });

  status.textContent = '';
  status.className = '';
  btn.disabled = true;
  if(unsavedBtn) unsavedBtn.disabled = true;
  var original = btn.textContent;
  btn.textContent = 'Saving…';

  try{
    var res = await fetch('/api/enrolled-subjects', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ subjects: checked })
    });
    var data = await res.json();
    if(res.ok){
      status.textContent = 'Saved! Your homepage will now show just these classes.';
      status.className = 'ok';
      SS_ORIGINAL_ENROLLED = new Set(checked);
      ssUpdateUnsavedBar();
      ssShowToast('Changes saved successfully');
    }else{
      status.textContent = data.error || 'Something went wrong — try again.';
      status.className = 'err';
    }
  }catch(e){
    status.textContent = 'Network error — try again.';
    status.className = 'err';
  }
  btn.disabled = false;
  if(unsavedBtn) unsavedBtn.disabled = false;
  btn.textContent = original;
}

var VAPID_PUBLIC_KEY = 'BFLqJyuV9vTCmo9TTgfsX9yOgI1DhUopA1Bm7Kw-Raxt5aD9286kiIVFLPcCWuInwcNzsTIuuAX-439U_D2WH1Q';

function urlBase64ToUint8Array(base64String){
  var padding = '='.repeat((4 - base64String.length % 4) % 4);
  var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  var rawData = atob(base64);
  var outputArray = new Uint8Array(rawData.length);
  for (var i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function pushSupported(){
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

async function pushGetSubscription(){
  if (!pushSupported()) return null;
  var reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

async function pushRefreshUI(){
  var btn = document.getElementById('push-toggle-btn');
  var testBtn = document.getElementById('push-test-btn');
  var status = document.getElementById('push-status');
  var prefs = document.getElementById('notif-prefs');
  if (!pushSupported()) {
    btn.style.display = 'none';
    prefs.style.display = 'none';
    status.textContent = "Push notifications aren't supported in this browser.";
    return;
  }
  if (Notification.permission === 'denied') {
    btn.style.display = 'none';
    testBtn.style.display = 'none';
    prefs.style.display = 'none';
    status.textContent = "Notifications are blocked for this site — enable them in your browser's site settings to turn this on.";
    return;
  }
  var sub = await pushGetSubscription();
  if (sub) {
    btn.textContent = 'Turn off notifications';
    btn.onclick = pushDisable;
    testBtn.style.display = 'inline-flex';
    prefs.style.display = 'flex';
    document.getElementById('notif-pref-daily').checked = SS_NOTIF_PREFS.daily !== false;
    document.getElementById('notif-pref-streak').checked = SS_NOTIF_PREFS.streak !== false;
    document.getElementById('notif-pref-blocks').checked = SS_NOTIF_PREFS.blocks !== false;
  } else {
    btn.textContent = 'Enable notifications';
    btn.onclick = pushEnable;
    testBtn.style.display = 'none';
    prefs.style.display = 'none';
  }
}

var SS_NOTIF_PREFS = {};

async function ssSaveNotifPref(kind, checked){
  var status = document.getElementById('notif-prefs-status');
  status.setAttribute('aria-live', 'polite');
  status.textContent = '';
  var checkbox = document.getElementById('notif-pref-' + kind);
  var prevChecked = !checked;
  var run = window.ssOptimistic || function(a,r){ a(); return Promise.resolve(r()).then(function(v){return {ok:true,value:v};}, function(e){return {ok:false,error:e};}); };
  var result = await run(
    function(){ SS_NOTIF_PREFS[kind] = checked; },
    function(){
      var body = {}; body[kind] = checked;
      return (window.ssOptimistic ? window.ssOptimistic.fetch : function(u,i){return fetch(u,i).then(function(r){if(!r.ok) throw new Error('failed'); return r;});})('/api/notification-prefs', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(body)
      });
    },
    function(){ SS_NOTIF_PREFS[kind] = prevChecked; if(checkbox) checkbox.checked = prevChecked; }
  );
  status.textContent = result.ok ? 'Saved' : "Couldn't save — try again.";
}

async function pushEnable(){
  var status = document.getElementById('push-status');
  status.textContent = '';
  try{
    var permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      status.textContent = "Notifications weren't allowed — you can turn them on later from your browser's site settings.";
      await pushRefreshUI();
      return;
    }
    var reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    var sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
    var res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ subscription: sub.toJSON() })
    });
    if(res.ok){
      status.textContent = "Notifications enabled! You'll get a daily study reminder.";
    }else{
      status.textContent = 'Something went wrong saving that — try again.';
    }
  }catch(e){
    status.textContent = 'Something went wrong — try again.';
  }
  await pushRefreshUI();
}

async function pushDisable(){
  var status = document.getElementById('push-status');
  try{
    var sub = await pushGetSubscription();
    if(sub){
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ endpoint: sub.endpoint })
      });
      await sub.unsubscribe();
    }
    status.textContent = 'Notifications turned off.';
  }catch(e){
    status.textContent = 'Something went wrong — try again.';
  }
  await pushRefreshUI();
}

document.getElementById('push-test-btn').addEventListener('click', async function(){
  var status = document.getElementById('push-status');
  status.textContent = 'Sending…';
  try{
    var res = await fetch('/api/push/test', { method: 'POST' });
    var data = await res.json();
    status.textContent = res.ok ? 'Test sent — check your notifications.' : (data.error || 'Something went wrong.');
  }catch(e){
    status.textContent = 'Something went wrong — try again.';
  }
});

async function initSettings(){
  var subtitle = document.getElementById('settings-subtitle');
  var gate = document.getElementById('settings-gate');
  var gateMsg = document.getElementById('settings-gate-msg');
  var signinBtn = document.getElementById('settings-signin-btn');
  var content = document.getElementById('settings-content');

  var session = await ssCheckSession();

  if(session && new URLSearchParams(location.search).get('welcome') === '1'){
    document.getElementById('welcome-banner').style.display = 'block';
    history.replaceState(null, '', '/settings');
  }

  if(!session){
    subtitle.textContent = 'Sign in to manage your classes and account. Appearance works without one.';
    gate.style.display = 'block';
    gateMsg.textContent = 'Sign in to manage your classes, notifications and sharing.';
    signinBtn.style.display = 'inline-flex';
    signinBtn.onclick = function(){ window.location.href = '/auth/google/start'; };
    // Appearance (theme, contrast, sound) is stored on this device, so it needs no account: show just that tab.
    content.style.display = 'block';
    document.querySelectorAll('#settings-tablist .ss-tab').forEach(function(t){
      var on = t.getAttribute('data-tab') === 'appearance';
      t.style.display = on ? '' : 'none';
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
    });
    document.querySelectorAll('[data-panel]').forEach(function(pn){ pn.hidden = pn.getAttribute('data-panel') !== 'appearance'; });
    return;
  }

  subtitle.textContent = 'Manage your account and classes.';
  content.style.display = 'block';

  try{
    var res = await fetch('/api/progress');
    var blob = res.ok ? await res.json() : {};
    renderClassList(blob.enrolledSubjects || []);
    ssRenderShareState(blob.shareToken || null);
    ssRenderCalendarState(blob.calendarToken || null);
    ssRenderInviteState(blob.inviteToken || null, blob.invitesAccepted || 0);
    SS_NOTIF_PREFS = blob.notificationPrefs || {};
  }catch(e){
    renderClassList([]);
  }

  document.getElementById('settings-save-btn').addEventListener('click', saveEnrolledSubjects);
  document.getElementById('ss-unsaved-save').addEventListener('click', saveEnrolledSubjects);
  document.getElementById('export-data-btn').addEventListener('click', ssExportMyData);
  document.getElementById('ss-share-generate-btn').addEventListener('click', ssShareGenerate);
  document.getElementById('ss-share-copy-btn').addEventListener('click', ssShareCopy);
  document.getElementById('ss-share-revoke-btn').addEventListener('click', ssShareRevoke);
  document.getElementById('ss-cal-generate-btn').addEventListener('click', ssCalendarGenerate);
  document.getElementById('ss-cal-copy-btn').addEventListener('click', ssCalendarCopy);
  document.getElementById('ss-cal-revoke-btn').addEventListener('click', ssCalendarRevoke);
  document.getElementById('ss-invite-generate-btn').addEventListener('click', ssInviteGenerate);
  document.getElementById('ss-invite-copy-btn').addEventListener('click', ssInviteCopy);
  document.getElementById('reset-progress-btn').addEventListener('click', ssResetAllProgress);
  document.getElementById('delete-account-btn').addEventListener('click', ssDeleteAccount);
  document.getElementById('sign-out-everywhere-btn').addEventListener('click', ssSignOutEverywhere);
  document.getElementById('notif-pref-daily').addEventListener('change', function(){ ssSaveNotifPref('daily', this.checked); });
  document.getElementById('notif-pref-streak').addEventListener('change', function(){ ssSaveNotifPref('streak', this.checked); });
  document.getElementById('notif-pref-blocks').addEventListener('change', function(){ ssSaveNotifPref('blocks', this.checked); });
  document.getElementById('canvas-connect-btn').addEventListener('click', ssCanvasConnect);
  (function(){
    var d = document.getElementById('canvas-domain'), k = document.getElementById('canvas-token'), b = document.getElementById('canvas-connect-btn'), sh = document.getElementById('canvas-show-token');
    function sync(){ b.disabled = !(d.value.trim().length > 3 && k.value.trim().length > 10); }
    [d, k].forEach(function(el){ el.addEventListener('input', sync); el.addEventListener('keydown', function(e){ if(e.key === 'Enter' && !b.disabled) ssCanvasConnect(); }); });
    if(sh) sh.addEventListener('change', function(){ k.type = sh.checked ? 'text' : 'password'; });
    sync();
  })();
  var disc = document.getElementById('ss-unsaved-discard'); if(disc) disc.addEventListener('click', function(){ location.reload(); });
  document.getElementById('canvas-disconnect-btn').addEventListener('click', ssCanvasDisconnect);
  await ssInitProfile();
  ssInitAvatar(); ssInitSessions(); ssInitCanvasSync();
  await ssRefreshCanvasStatus();
  ssInitHighContrastToggle();
  ssInitAmoledToggle();
  ssInitSoundToggle();
  await pushRefreshUI();
}

// Calls straight into high-contrast.js's window.ssSetHighContrast() rather
// than re-implementing the CSS-variable override and localStorage key here
// -- one source of truth for what "on" means. This checkbox is the only
// control surface for it (the header used to also carry a small "AA"
// button; that was removed so there's exactly one place to toggle it).
function ssInitHighContrastToggle(){
  var checkbox = document.getElementById('settings-high-contrast');
  checkbox.checked = window.ssIsHighContrast ? window.ssIsHighContrast() : false;
  checkbox.addEventListener('change', function(){
    if(window.ssSetHighContrast) window.ssSetHighContrast(checkbox.checked);
  });
}

// Same pattern as the high-contrast toggle: high-contrast.js owns the key.
function ssInitAmoledToggle(){
  var checkbox = document.getElementById('settings-amoled');
  checkbox.checked = window.ssIsAmoled ? window.ssIsAmoled() : false;
  checkbox.addEventListener('change', function(){
    if(window.ssSetAmoled) window.ssSetAmoled(checkbox.checked);
  });
}

// Read by /shared/celebrate.js on every correct answer.
function ssInitSoundToggle(){
  var checkbox = document.getElementById('settings-sound');
  try { checkbox.checked = localStorage.getItem('ss-sound') === 'on'; } catch (e) {}
  checkbox.addEventListener('change', function(){
    try { localStorage.setItem('ss-sound', checkbox.checked ? 'on' : 'off'); } catch (e) {}
  });
}

async function ssRefreshCanvasStatus(){
  try{
    var res = await fetch('/api/canvas/status');
    var data = res.ok ? await res.json() : { connected: false, domain: null };
    document.getElementById('canvas-disconnected').style.display = data.connected ? 'none' : 'block';
    document.getElementById('canvas-connected').style.display = data.connected ? 'block' : 'none';
    if(data.connected) document.getElementById('canvas-domain-label').textContent = data.domain || '';
  }catch(e){ /* leave the disconnected form showing */ }
}

async function ssCanvasConnect(){
  var domain = document.getElementById('canvas-domain').value.trim();
  var apiToken = document.getElementById('canvas-token').value.trim();
  var status = document.getElementById('canvas-status');
  var btn = document.getElementById('canvas-connect-btn');
  btn.disabled = true;
  btn.textContent = 'Connecting…';
  status.textContent = 'Verifying your token with Canvas…';
  try{
    var res = await fetch('/api/canvas/connect', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ domain: domain, apiToken: apiToken })
    });
    var data = await res.json();
    if(!res.ok){
      status.textContent = data.error || "Couldn't connect — try again.";
      btn.disabled = false; btn.textContent = 'Connect';
      return;
    }
    document.getElementById('canvas-token').value = '';
    document.getElementById('canvas-token').type = 'password';
    status.textContent = '';
    await ssRefreshCanvasStatus();
  }catch(e){
    status.textContent = "Couldn't connect — check your connection and try again.";
  }
  btn.disabled = false; btn.textContent = 'Connect';
}

async function ssCanvasDisconnect(){
  if(!(await ssConfirm('Disconnect Canvas? Your synced assignments will be removed from your list until you reconnect.'))) return;
  var btn = document.getElementById('canvas-disconnect-btn');
  btn.disabled = true;
  try{
    await fetch('/api/canvas/disconnect', { method: 'POST' });
  }catch(e){ /* fall through to refresh either way */ }
  await ssRefreshCanvasStatus();
  btn.disabled = false;
}

// After a name or picture change: refresh the session and tell the header menu (account-menu.js) to redraw.
async function ssAccountChanged(){
  var sess = typeof ssCheckSession === 'function' ? await ssCheckSession() : null;
  if(sess) window.dispatchEvent(new CustomEvent('ss-account-changed', { detail: { name: sess.name, avatar: !!sess.avatar } }));
}

function ssShowAvatar(has, label){
  var img = document.getElementById('profile-avatar'), ph = document.getElementById('profile-avatar-ph'), rm = document.getElementById('profile-avatar-remove');
  if(!img) return;
  ph.textContent = (label || '?').trim().charAt(0).toUpperCase();
  if(has){ img.src = '/api/avatar?v=' + Date.now(); img.style.display = 'block'; ph.style.display = 'none'; rm.hidden = false; }
  else { img.style.display = 'none'; ph.style.display = 'flex'; rm.hidden = true; }
}

// Square-crop to 128px and re-encode as JPEG in the browser, so the server only ever stores a small, known format.
function ssResizeAvatar(file){
  // createImageBitmap decodes the file directly: no blob: URL, which the site's img-src policy does not allow.
  return createImageBitmap(file).then(function(im){
    var s = Math.min(im.width, im.height), c = document.createElement('canvas'); c.width = c.height = 128;
    c.getContext('2d').drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, 128, 128);
    if(im.close) im.close();
    return new Promise(function(resolve, reject){ c.toBlob(function(b){ b ? resolve(b) : reject(new Error('encode')); }, 'image/jpeg', 0.85); });
  });
}

function ssInitAvatar(){
  var file = document.getElementById('profile-avatar-file'), rm = document.getElementById('profile-avatar-remove'), st = document.getElementById('profile-avatar-status');
  if(!file) return;
  async function done(r){ var d = await r.json().catch(function(){ return {}; }); st.textContent = r.ok ? 'Saved.' : (d.error || "Couldn't save the picture."); if(r.ok){ ssShowAvatar(d.hasAvatar, document.getElementById('profile-name').value || document.getElementById('profile-email').value); window.__ssMe = null; ssAccountChanged(); } }
  file.addEventListener('change', async function(){
    if(!file.files[0]) return; st.textContent = 'Saving…';
    try{ var blob = await ssResizeAvatar(file.files[0]); await done(await fetch('/api/avatar', { method:'PUT', headers:{'Content-Type':'image/jpeg'}, body: blob })); }
    catch(e){ st.textContent = "Couldn't read that image."; }
    file.value = '';
  });
  rm.addEventListener('click', async function(){ st.textContent = 'Removing…'; await done(await fetch('/api/avatar', { method:'DELETE' })); });
}

function ssTimeAgo(iso){
  var d = new Date(iso); if(isNaN(d)) return '';
  var m = Math.round((Date.now() - d.getTime()) / 60000);
  if(m < 1) return 'just now'; if(m < 60) return m + ' min ago';
  var h = Math.round(m / 60); if(h < 24) return h + ' hr ago';
  return Math.round(h / 24) + ' days ago';
}

async function ssInitSessions(){
  var ul = document.getElementById('sessions-list'), note = document.getElementById('sessions-note');
  if(!ul) return;
  var showAll = false, more = document.createElement('button');
  more.type = 'button'; more.className = 'ss-link-btn'; more.style.cssText = 'margin-top:10px;background:none;border:0;padding:4px 0;color:var(--accent,inherit);font:inherit;font-size:13.5px;font-weight:700;text-decoration:underline;cursor:pointer';
  more.addEventListener('click', function(){ showAll = !showAll; load(); });
  ul.after(more);
  async function load(){
    try{
      var r = await fetch('/api/sessions'); if(!r.ok) return;
      var d = await r.json(); ul.innerHTML = '';
      var all = d.sessions.slice().sort(function(a, b){ return (b.current ? 1 : 0) - (a.current ? 1 : 0) || b.createdAt - a.createdAt; });
      var shown = showAll ? all : all.slice(0, 3);
      more.hidden = all.length <= 3;
      more.textContent = showAll ? 'Show 3 most recent' : 'Show all ' + all.length + ' devices';
      shown.forEach(function(s){
        var li = document.createElement('li');
        li.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid var(--border);border-radius:12px;padding:10px 14px;flex-wrap:wrap';
        var txt = document.createElement('div');
        txt.innerHTML = '<div style="font-weight:700;font-size:14px;color:var(--text)"></div><div style="font-size:12.5px;color:var(--text-muted)"></div>';
        txt.firstChild.textContent = s.device + (s.current ? ' (this device)' : '');
        txt.lastChild.textContent = 'Signed in ' + ssTimeAgo(new Date(s.createdAt * 1000).toISOString());
        li.appendChild(txt);
        if(!s.current){
          var b = document.createElement('button'); b.type = 'button'; b.className = 'ss-oauth-btn ss-danger'; b.style.cssText = 'width:auto;margin:0;padding:8px 14px'; b.textContent = 'Sign out';
          b.addEventListener('click', async function(){ if(!(await ssConfirm('Sign out ' + s.device + '?'))) return; b.disabled = true; await fetch('/api/sessions/revoke', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: s.id }) }); load(); });
          li.appendChild(b);
        }
        ul.appendChild(li);
      });
      note.textContent = d.sessions.length ? 'Devices that signed in before this list existed are not shown. "Sign out of all devices" ends them too.' : 'No devices recorded yet. Sign out and back in to appear here.';
    }catch(e){ /* leave empty */ }
  }
  load();
}

function ssInitCanvasSync(){
  var f = document.getElementById('canvas-freq'), b = document.getElementById('canvas-sync-btn'), last = document.getElementById('canvas-last');
  if(!f) return;
  f.addEventListener('change', function(){ fetch('/api/profile', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ canvasSync: f.value }) }); });
  b.addEventListener('click', async function(){
    b.disabled = true; b.textContent = 'Syncing…';
    try{ var r = await fetch('/api/canvas/sync', { method:'POST' }); var d = await r.json(); last.textContent = r.ok ? 'Synced just now (' + d.count + ' item' + (d.count === 1 ? '' : 's') + ').' : (d.error || "Couldn't sync."); }
    catch(e){ last.textContent = "Couldn't sync. Check your connection."; }
    b.disabled = false; b.textContent = 'Sync now';
  });
  fetch('/api/canvas/status').then(function(r){ return r.json(); }).then(function(d){ if(d.lastSynced) last.textContent = 'Last synced ' + ssTimeAgo(d.lastSynced) + '.'; }).catch(function(){});
}

async function ssInitProfile(){
  var name = document.getElementById('profile-name'), email = document.getElementById('profile-email');
  var tz = document.getElementById('profile-tz'), btn = document.getElementById('profile-save-btn'), st = document.getElementById('profile-status');
  if(!name || !btn) return;
  var zones = [];
  try{ zones = Intl.supportedValuesOf('timeZone'); }catch(e){ zones = ['America/New_York','America/Chicago','America/Denver','America/Los_Angeles','Europe/London','Europe/Paris','Asia/Tokyo','Australia/Sydney','UTC']; }
  zones.forEach(function(z){ var o = document.createElement('option'); o.value = z; o.textContent = z.replace(/_/g, ' '); tz.appendChild(o); });
  try{
    var res = await fetch('/api/profile');
    if(res.ok){
      var p = await res.json();
      name.value = p.displayName || ''; email.value = p.email || ''; tz.value = p.timezone || '';
      var tf = document.getElementById('profile-timefmt'), pm = document.getElementById('profile-minutes'), since = document.getElementById('profile-since');
      tf.value = p.timeFormat || ''; pm.value = p.studyMinutes || '';
      var sd = p.memberSince || p.firstActivity;
      if(sd){ var dt = new Date(sd.length === 10 ? sd + 'T12:00:00' : sd); if(!isNaN(dt)) since.textContent = (p.memberSince ? 'Member since ' : 'First activity ') + dt.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) + '.'; }
      ssShowAvatar(p.hasAvatar, p.displayName || p.name || p.email);
      window.__ssProfileCache = p; try{ localStorage.setItem('ss_prefs', JSON.stringify({ timeFormat: p.timeFormat || null, studyMinutes: p.studyMinutes || null })); }catch(e){}
      var cf = document.getElementById('canvas-freq'); if(cf) cf.value = p.canvasSync || 'always';
      if(!name.value && p.name && p.name !== p.email) name.placeholder = p.name;
    }
  }catch(e){ /* leave blank */ }
  btn.addEventListener('click', async function(){
    btn.disabled = true; st.textContent = 'Saving…';
    try{
      var r = await fetch('/api/profile', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ displayName: name.value, timezone: tz.value, timeFormat: document.getElementById('profile-timefmt').value || null, studyMinutes: document.getElementById('profile-minutes').value ? parseInt(document.getElementById('profile-minutes').value, 10) : null }) });
      var d = await r.json().catch(function(){ return {}; });
      st.textContent = r.ok ? 'Saved.' : (d.error || "Couldn't save.");
      if(r.ok){ try{ localStorage.setItem('ss_prefs', JSON.stringify({ timeFormat: d.timeFormat || null, studyMinutes: d.studyMinutes || null })); }catch(e){} window.__ssMe = null; await ssAccountChanged(); }
    }catch(e){ st.textContent = "Couldn't save. Check your connection."; }
    btn.disabled = false;
  });
}

initSettings();

function ssToggleTheme(){
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark) {
    document.documentElement.removeAttribute('data-theme');
    try { localStorage.setItem('ss-theme', 'light'); } catch (e) {}
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    try { localStorage.setItem('ss-theme', 'dark'); } catch (e) {}
  }
}

(function(){
  var radios = document.querySelectorAll('input[name="settings-theme"]');
  var saved = 'system';
  try { var v = localStorage.getItem('ss-theme'); if (v === 'light' || v === 'dark') saved = v; } catch (e) {}
  function apply(v) {
    var dark = v === 'dark' || (v === 'system' && !(window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches));
    if (dark) document.documentElement.setAttribute('data-theme', 'dark'); else document.documentElement.removeAttribute('data-theme');
    try { if (v === 'system') localStorage.removeItem('ss-theme'); else localStorage.setItem('ss-theme', v); } catch (e) {}
  }
  radios.forEach(function(r) {
    r.checked = r.value === saved;
    r.addEventListener('change', function() { if (r.checked) apply(r.value); });
  });
})();
