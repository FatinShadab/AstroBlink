import type { DictKey } from "./en";

/**
 * বাংলা dictionary. Typed as Record<DictKey, string>, so a missing key fails the type check.
 * Keys still set to English are placeholders (rules §4.4.2) and are marked // TODO bn.
 */
export const bn: Record<DictKey, string> = {
  "brand.name": "AstroBlink", // brand name stays Latin
  "brand.mark": "AstroBlink লোগো",

  "nav.explore": "অন্বেষণ",
  "nav.projects": "প্রকল্প",
  "nav.guide": "ফিল্ড গাইড",
  "nav.about": "পরিচিতি",
  "nav.skip": "মূল বিষয়বস্তুতে যান",

  "header.signIn": "সাইন ইন",
  "header.menuOpen": "মেনু খুলুন",
  "header.menuClose": "মেনু বন্ধ করুন",
  "header.settings": "সেটিংস",
  "header.language": "ভাষা",

  "footer.mission": "SPHEREx-এর ইনফ্রারেড ছবিতে চলমান তারা ও নতুন জগৎ খুঁজুন।",
  "footer.links": "লিংক", // TODO bn review
  "footer.credit":
    "Built with NASA SPHEREx data from IRSA/IPAC. AstroBlink is a NASA Space Apps Challenge project and is not endorsed by NASA.", // credit line stays English (rules §2.4)
  "footer.embed": "এমবেড",

  "settings.title": "সেটিংস",
  "settings.description": "শুধু এই ব্রাউজারে সংরক্ষিত হয়।",
  "settings.language": "ভাষা",
  "settings.reducedMotion": "কম গতি",
  "settings.reducedMotionHelp": "স্বয়ংক্রিয় চালানো বন্ধ করে ব্লিংকিংয়ের বদলে মৃদু ফেড দেখায়।", // TODO bn review
  "settings.blinkSpeed": "ব্লিংক গতি",
  "settings.blinkSpeedHelp": "প্রতি সেকেন্ডে ফ্রেম। সর্বোচ্চ সীমা ২।", // TODO bn review
  "settings.colorblindMerge": "বর্ণান্ধ-বান্ধব রং",
  "settings.colorblindMergeHelp": "লাল, সবুজ ও নীলের বদলে ম্যাজেন্টা ও সবুজ।", // TODO bn review
  "settings.close": "সেটিংস বন্ধ করুন",

  "common.close": "বন্ধ করুন",
  "common.tryAgain": "আবার চেষ্টা করুন",
  "common.loading": "লোড হচ্ছে…",
  "common.demoData": "ডেমো ডেটা",
  "common.simulatedSky": "সিমুলেটেড আকাশ",
  "common.comingSoon": "শীঘ্রই আসছে",

  "state.errorTitle": "কিছু একটা ভুল হয়েছে", // TODO bn review
  "state.emptyTitle": "এখানে এখনো কিছু নেই", // TODO bn review
  "state.offline": "আপনি অফলাইনে আছেন। সিমুলেটেড আকাশ এখনও কাজ করে।", // TODO bn review

  "dev.title": "UI প্রিমিটিভ", // TODO bn review
  "dev.description": "অস্থায়ী পাতা। ডেমোর আগে মুছে ফেলুন।", // TODO bn review
  "dev.buttons": "বাটন",
  "dev.inputs": "ইনপুট ও চিপ",
  "dev.cards": "কার্ড ও KPI টাইল",
  "dev.progress": "অগ্রগতি",
  "dev.tabs": "ট্যাব",
  "dev.accordion": "অ্যাকর্ডিয়ন",
  "dev.dialog": "ডায়ালগ",
  "dev.toast": "টোস্ট",
  "dev.banner": "ব্যানার ও অবস্থা",
  "dev.segmented": "সেগমেন্টেড কন্ট্রোল",
  "dev.tooltip": "টুলটিপ",
  "dev.openDialog": "ডায়ালগ খুলুন",
  "dev.showToast": "টোস্ট দেখান",
  "dev.toastBody": "টোস্ট বার্তা মৃদুভাবে ঘোষণা করা হয়।", // TODO bn review
  "dev.sampleCardTitle": "নমুনা কার্ড",
  "dev.sampleCardBody": "মূল লেখা এখানে ব্যবহার হয়।", // TODO bn review
  "dev.kpiLabel": "পরীক্ষিত ক্ষেত্র",
  "dev.progressLabel": "ক্ষেত্র ৩ / ১০", // TODO bn review
  "dev.tabImage": "ছবি",
  "dev.tabCompare": "তুলনা",
  "dev.tabFlags": "গ্লিচ ফ্ল্যাগ",
  "dev.tabPanelImage": "ডিটেক্টর ও স্ট্রেচ নিয়ন্ত্রণ এখানে।", // TODO bn review
  "dev.tabPanelCompare": "ফ্রেম বাছাই এখানে।", // TODO bn review
  "dev.tabPanelFlags": "গ্লিচ ব্যাখ্যা এখানে।", // TODO bn review
  "dev.accordionTitle": "ভিজিট কী?", // TODO bn review
  "dev.accordionBody": "SPHEREx যে সময় একটি স্থানের দিকে তাকায়। ভিজিটগুলো প্রায় ছয় মাস পরপর।", // TODO bn review
  "dev.bannerWarning": "এখানে মাত্র ২টি পর্যবেক্ষণ — নড়াচড়া দেখা কঠিন হতে পারে।", // TODO bn review
  "dev.bannerError": "এই ক্ষেত্রটি লোড করা যায়নি। সংযোগ পরীক্ষা করুন।", // TODO bn review
  "dev.bannerInfo": "সিমুলেটেড আকাশ: আপনার ব্রাউজারে তৈরি।", // TODO bn review
  "dev.emptyBody": "শুরু করতে আকাশের একটি স্থান বাছুন।", // TODO bn review
  "dev.skeleton": "ফ্রেম ২ / ৪ লোড হচ্ছে…", // TODO bn review
  "dev.chipSelected": "Barnard's Star",
  "dev.chipIdle": "Epsilon Indi B",
  "dev.badgeAdvanced": "উন্নত",
  "dev.badgeBeginner": "শুরু",
  "dev.badgeIntermediate": "মধ্যম",
  "dev.answerMoved": "হ্যাঁ, কিছু নড়েছে",
  "dev.answerNoChange": "কোনো পরিবর্তন নেই",
  "dev.answerNotSure": "নিশ্চিত নই",
  "dev.answerGlitch": "গ্লিচ মনে হচ্ছে",
  "dev.scrollHint": "আরও দেখতে পাশে স্ক্রল করুন", // TODO bn review

  "home.placeholder": "ফেজ ১ ভিত্তি। এক্সপ্লোর ভিউয়ার ফেজ ২-এ আসবে।", // TODO bn review
  "home.devLink": "UI প্রিমিটিভ পাতা খুলুন", // TODO bn review

  "notFound.title": "পাতাটি পাওয়া যায়নি", // TODO bn review
  "notFound.body": "আকাশের এই অংশটি ফাঁকা। এক্সপ্লোর ভিউয়ার দেখুন।", // TODO bn review
  "notFound.cta": "এক্সপ্লোরে যান", // TODO bn review

  "explore.title": "আকাশ অন্বেষণ করুন", // TODO bn review
  "explore.searchLabel": "স্থানাঙ্ক (RA, Dec)",
  "explore.searchPlaceholder": "যেমন 08h55m10.8s −07d14m42s বা 133.795 −7.245",
  "explore.searchHelp": "এই স্থানে যেতে Enter চাপুন।", // TODO bn review
  "explore.searchSubmit": "এই স্থান দেখান", // TODO bn review
  "explore.err.empty": "শুরু করতে স্থানাঙ্ক লিখুন।", // TODO bn review
  "explore.err.format": "পড়া যায়নি। চেষ্টা করুন 08h55m10.8s −07d14m42s বা 133.795 −7.245।", // TODO bn review
  "explore.err.ra-range": "রাইট অ্যাসেনশন ০ থেকে ২৪ ঘণ্টার মধ্যে হতে হবে।", // TODO bn review
  "explore.err.dec-range": "ডিক্লিনেশন −৯০° থেকে +৯০°-এর মধ্যে হতে হবে।", // TODO bn review
  "explore.err.min-sec": "মিনিট ও সেকেন্ড ৬০-এর নিচে হতে হবে।", // TODO bn review
  "explore.fov": "দৃশ্যের ক্ষেত্র", // TODO bn review
  "explore.detector": "ডিটেক্টর",
  "explore.detectorRange": "{min}–{max} μm",
  "explore.presets": "পরীক্ষার লক্ষ্য", // TODO bn review
  "explore.presetPending": "স্থানাঙ্ক বাকি", // TODO bn review
  "explore.modeLabel": "ভিউ মোড", // TODO bn review
  "explore.mode.blink": "ব্লিংক",
  "explore.mode.side": "পাশাপাশি", // TODO bn review
  "explore.mode.merge": "মার্জ", // TODO bn review
  "explore.mode.diff": "পার্থক্য", // TODO bn review
  "explore.mode.stack": "স্ট্যাক", // TODO bn review
  "explore.zoomIn": "জুম ইন", // TODO bn review
  "explore.zoomOut": "জুম আউট", // TODO bn review
  "explore.fit": "ভিউতে মানান", // TODO bn review
  "explore.zoomLevel": "{percent}%",
  "explore.play": "চালান", // TODO bn review
  "explore.pause": "বিরতি", // TODO bn review
  "explore.prevFrame": "আগের ফ্রেম", // TODO bn review
  "explore.nextFrame": "পরের ফ্রেম", // TODO bn review
  "explore.speed": "গতি", // TODO bn review
  "explore.timeline": "পর্যবেক্ষণের সময়রেখা", // TODO bn review
  "explore.frameOf": "ফ্রেম {index} / {total}", // TODO bn review
  "explore.loadingFrames": "ফ্রেম {index} / {total} লোড হচ্ছে…", // TODO bn review
  "explore.viewerLabel": "আকাশ ভিউয়ার। {description}", // TODO bn review
  "explore.describe": "ফ্রেম {index} / {total}, {date}, ডিটেক্টর {det}", // TODO bn review
  "explore.fewFrames": "এখানে মাত্র {count}টি পর্যবেক্ষণ — নড়াচড়া দেখা কঠিন হতে পারে।", // TODO bn review
  "explore.pendingBanner": "{name}-এর স্থানাঙ্ক এখনও নিশ্চিত নয়। অন্য লক্ষ্য বেছে নিন।", // TODO bn review
  "explore.noCoords": "আকাশের একটি স্থান বাছুন", // TODO bn review
  "explore.noCoordsBody": "উপরে স্থানাঙ্ক লিখুন, অথবা একটি পরীক্ষার লক্ষ্য দিয়ে শুরু করুন।", // TODO bn review
  "explore.noData": "SPHEREx এখনও এই স্থানটি পর্যবেক্ষণ করেনি", // TODO bn review
  "explore.noDataBody": "পর্যবেক্ষণসহ একটি ক্ষেত্র দেখতে একটি পরীক্ষার লক্ষ্য চেষ্টা করুন।", // TODO bn review
  "explore.errorBody": "এই ভিউ তৈরি করা যায়নি। সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।", // TODO bn review
  "explore.share": "লিংক কপি করুন", // TODO bn review
  "explore.linkCopied": "লিংক কপি হয়েছে", // TODO bn review
  "explore.linkFailed": "কপি করা যায়নি। ঠিকানা বার থেকে কপি করুন।", // TODO bn review
  "explore.customSpot": "কাস্টম স্থান", // TODO bn review
  "explore.customBody": "যেকোনো স্থান চলবে। আপনার ব্রাউজারে তারা, নয়েজ ও গ্লিচ তৈরি হয়।", // TODO bn review
  "explore.kind.mover": "চলমান লক্ষ্য", // TODO bn review
  "explore.kind.variable": "পরিবর্তনশীল তারা", // TODO bn review
  "explore.lookFor": "কী খুঁজবেন", // TODO bn review
  "explore.reducedMotion":
    "কম গতির সেটিং চালু থাকায় স্বয়ংক্রিয় চালানো বন্ধ। ফ্রেম দেখতে তীর চিহ্ন ব্যবহার করুন।", // TODO bn review
  "explore.keys": "কী: Space চালু/বিরতি · ← → ফ্রেম · + − জুম · 0 মানান", // TODO bn review
  "explore.simulatedNote":
    "সিমুলেটেড আকাশ: একটি সিডেড মডেল থেকে আপনার ব্রাউজারে তৈরি। এটি বাস্তব পর্যবেক্ষণ নয়।", // TODO bn review
  "explore.noTargetTitle": "এই ভিউয়ের জন্য স্থানাঙ্ক দরকার", // TODO bn review
  "preset.barnard.desc": "আকাশের দ্রুততম চলমান তারা, বছরে প্রায় ১০ আর্কসেকেন্ড।", // TODO bn review
  "preset.barnard.look": "একটি উজ্জ্বল তারা যা ভিজিটের মধ্যে সামান্য সরে।", // TODO bn review
  "preset.epsIndiB.desc": "একটি উজ্জ্বল তারার পাশে ক্ষীণ ব্রাউন ডোয়ার্ফ জোড়া।", // TODO bn review
  "preset.epsIndiB.look": "একটি ক্ষীণ বিন্দু যা ধীরে সরে।", // TODO bn review
  "preset.wise0855.desc": "খুব ঠান্ডা, খুব ক্ষীণ একটি ব্রাউন ডোয়ার্ফ যা দ্রুত চলে।", // TODO bn review
  "preset.wise0855.look": "ছোট তরঙ্গদৈর্ঘ্যে প্রায় অদৃশ্য, লম্বা তরঙ্গে স্পষ্ট।", // TODO bn review
  "preset.rwAur.desc": "একটি তরুণ তারা যার উজ্জ্বলতা অনিয়মিতভাবে বদলায়।", // TODO bn review
  "preset.rwAur.look": "একই স্থান, সময়ের সাথে উজ্জ্বলতা বদলায়।", // TODO bn review
  "preset.rDra.desc": "একটি স্পন্দনশীল তারা যা প্রায় প্রতি ২৪৫ দিনে উজ্জ্বল ও ম্লান হয়।", // TODO bn review
  "preset.rDra.look": "একই স্থান, একটি নিয়মিত উজ্জ্বলতা চক্র।", // TODO bn review
};
