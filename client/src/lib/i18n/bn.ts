import type { DictKey } from "./en";

/**
 * বাংলা dictionary. Typed as Record<DictKey, string>, so a missing key fails the type check.
 * Keys still set to English are placeholders (rules §4.4.2) and are marked // TODO bn.
 */
export const bn: Record<DictKey, string> = {
  "brand.name": "AstroBlink", // brand name stays Latin
  "brand.mark": "AstroBlink লোগো",

  "nav.explore": "অন্বেষণ",
  "nav.home": "Home", // TODO bn
  "footer.builtAt": "Built at United International University", // TODO bn
  "footer.uiuAlt": "United International University crest", // TODO bn
  "footer.pages": "Pages", // TODO bn
  "footer.ctaTitle": "Ready to spot something moving?", // TODO bn
  "footer.ctaBody": "Pick a mission, or open the sky on any spot. No experience needed.", // TODO bn
  "footer.ctaProjects": "Browse missions", // TODO bn
  "footer.ctaExplore": "Explore the sky", // TODO bn
  "footer.project": "Project", // TODO bn
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

  "explore.lightCurve": "সময়ের সাথে উজ্জ্বলতা", // TODO bn review
  "explore.brightnessCaption": "বড় মান = বেশি উজ্জ্বল। প্রতিটি ফ্রেমের কেন্দ্রে মাপা।", // TODO bn review
  "explore.brightness": "উজ্জ্বলতা", // TODO bn review
  "explore.contrast": "কন্ট্রাস্ট", // TODO bn review
  "explore.reset": "রিসেট", // TODO bn review
  "explore.spectrum": "বর্ণালি", // TODO bn review
  "explore.relativeBrightness": "আপেক্ষিক উজ্জ্বলতা", // TODO bn review
  "explore.advanced": "Advanced features", // TODO bn
  "explore.advancedButton": "Advanced features", // TODO bn
  "explore.advancedHide": "Hide advanced features", // TODO bn
  "explore.advancedHelp":
    "Image, compare, glitch flags, spectrum, overlays and sharing, in one place.", // TODO bn
  "explore.advancedHelpContribute":
    "Stretch, brightness and contrast, glitch flags, spectrum and sharing. Compare and stack are on the explore page.", // TODO bn
  "explore.show": "দেখান", // TODO bn review
  "explore.hide": "লুকান", // TODO bn review
  "explore.tab.image": "ছবি",
  "explore.tab.compare": "তুলনা",
  "explore.tab.flags": "গ্লিচ ফ্ল্যাগ",
  "explore.tab.spectrum": "বর্ণালি", // TODO bn review
  "explore.tab.overlays": "ওভারলে", // TODO bn review
  "explore.tab.share": "শেয়ার ও এমবেড", // TODO bn review
  "explore.stretch": "স্ট্রেচ", // TODO bn review
  "explore.stretch.linear": "লিনিয়ার", // TODO bn review
  "explore.stretch.log": "লগ", // TODO bn review
  "explore.stretch.asinh": "অ্যাসিনh", // TODO bn review
  "explore.compareA": "ফ্রেম A", // TODO bn review
  "explore.compareB": "ফ্রেম B", // TODO bn review
  "explore.diffStyle": "পার্থক্যের ধরন", // TODO bn review
  "explore.diff.grey": "ধূসর", // TODO bn review
  "explore.diff.colour": "রং", // TODO bn review
  "explore.stackFrames": "স্ট্যাক করার ফ্রেম", // TODO bn review
  "explore.stackHelp": "অচিহ্নিত ফ্রেম বাদ যাবে। সব ফ্রেম স্ট্যাক করতে সবগুলো চিহ্নিত রাখুন।", // TODO bn review
  "explore.showFlags": "গ্লিচ ফ্ল্যাগ দেখান", // TODO bn review
  "explore.flagLegend": "অনির্ভরযোগ্য পিক্সেল (কসমিক রে বা স্যাচুরেশন)", // TODO bn review
  "explore.flagCount": "এই ফ্রেমে {count}টি চিহ্নিত পিক্সেল", // TODO bn review
  "explore.spectrumHint": "ব্লিংক ভিউয়ের যেকোনো তারায় ক্লিক করে তার বর্ণালি দেখুন।", // TODO bn review
  "explore.spectrumWaiting": "এখনও কোনো তারা বাছা হয়নি।", // TODO bn review
  "explore.spectrumError": "এই পিক্সেলের বর্ণালি লোড করা যায়নি।", // TODO bn review
  "explore.exportCsv": "CSV রপ্তানি", // TODO bn review
  "explore.overlayGaia": "Gaia তারা", // TODO bn review
  "explore.overlayWise": "WISE উৎস", // TODO bn review
  "explore.copyLink": "লিংক কপি করুন", // TODO bn review
  "explore.downloadPng": "এই ফ্রেম PNG হিসেবে নামান", // TODO bn review
  "explore.embedCode": "এমবেড কোড", // TODO bn review
  "explore.copyEmbed": "এমবেড কোড কপি করুন", // TODO bn review
  "explore.embedCopied": "এমবেড কোড কপি হয়েছে", // TODO bn review
  "embed.openInApp": "AstroBlink-এ খুলুন ↗", // TODO bn review
  "answer.moved": "Yes, something moved", // TODO bn
  "answer.brightness": "Brightness changed", // TODO bn
  "answer.noChange": "No change", // TODO bn
  "answer.notSure": "Not sure", // TODO bn
  "answer.glitch": "Looks like a glitch", // TODO bn
  "answer.real": "Real object", // TODO bn

  "projects.title": "Projects", // TODO bn
  "projects.intro": "Pick a mission. No experience needed.", // TODO bn
  "projects.filter": "Filter by level", // TODO bn
  "projects.filter.all": "All", // TODO bn
  "projects.filter.beginner": "Beginner", // TODO bn
  "projects.filter.intermediate": "Intermediate", // TODO bn
  "projects.filter.advanced": "Advanced", // TODO bn
  "projects.fields": "fields", // TODO bn
  "projects.yourProgress": "Your progress", // TODO bn
  "projects.continue": "Continue", // TODO bn
  "projects.start": "Start", // TODO bn
  "projects.free": "Free explore", // TODO bn
  "projects.freeBody": "Look at any spot in the sky without a task.", // TODO bn
  "projects.freeCta": "Open the viewer", // TODO bn
  "projects.back": "All projects", // TODO bn

  "project.motion.title": "Hunt for moving stars", // TODO bn
  "project.motion.desc":
    "Stars with large proper motion drift across the sky. Find the ones that shift between pictures.", // TODO bn
  "project.motion.question": "Did anything move between pictures?", // TODO bn
  "project.brown.title": "Find brown dwarfs", // TODO bn
  "project.brown.desc":
    "Cold, faint brown dwarfs glow in the infrared. Some of them move fast enough to notice.", // TODO bn
  "project.brown.question": "Did something move between pictures?", // TODO bn
  "project.variable.title": "Watch variable stars", // TODO bn
  "project.variable.desc":
    "Some stars brighten and fade over time. Spot the ones whose brightness changes.", // TODO bn
  "project.variable.question": "Did anything get brighter or fainter?", // TODO bn
  "project.glitch.title": "Glitch patrol", // TODO bn
  "project.glitch.desc":
    "Cosmic-ray hits and bright-star spikes can look like objects. Tell real objects from glitches.", // TODO bn
  "project.glitch.question": "Is this a real object or a glitch?", // TODO bn
  "project.startTraining": "Start training", // TODO bn
  "project.skipToClassify": "Skip to classify", // TODO bn
  "project.stepsTitle": "What you'll do", // TODO bn
  "project.lookTitle": "What to look for", // TODO bn
  "project.step.practise.title": "Practise", // TODO bn
  "project.step.practise.body":
    "Five practice fields with known answers, with feedback after each one.", // TODO bn
  "project.step.look.title": "Look", // TODO bn
  "project.step.look.body": "Watch the blinking image. Use the field guide if you're unsure.", // TODO bn
  "project.step.answer.title": "Answer", // TODO bn
  "project.step.answer.body":
    "Pick one answer. Keys 1 to 4 work, and Enter goes to the next field.", // TODO bn
  "project.look.one.title": "Real mover", // TODO bn
  "project.look.one.body": "A bright spot that shifts a little from one picture to the next.", // TODO bn
  "project.look.two.title": "Glitch", // TODO bn
  "project.look.two.body": "A single hot pixel or a short streak that appears in one picture only.", // TODO bn
  "project.look.three.title": "Nothing changed", // TODO bn
  "project.look.three.body": "The same stars in the same places in every picture.", // TODO bn

  "classify.badge": "Classify", // TODO bn
  "classify.hint": "Watch the blinking image. Use the field guide if you're unsure.", // TODO bn
  "classify.progress": "Field {index} of {total}", // TODO bn
  "classify.progressTitle": "Your batch", // TODO bn
  "classify.percentComplete": "Percent complete", // TODO bn
  "classify.statChecked": "Checked", // TODO bn
  "classify.statLeft": "Left", // TODO bn
  "classify.statBatch": "Batch size", // TODO bn
  "classify.flag": "Flag as interesting", // TODO bn
  "classify.keysHint": "Keys 1–4 answer · Enter next", // TODO bn
  "classify.thanks": "Thanks! {percent}% of volunteers also said: {answer}.", // TODO bn
  "classify.matches": "Your answer matches the most common answer.", // TODO bn
  "classify.differs": "Your answer differs from the most common answer. That is fine.", // TODO bn
  "classify.next": "Next field", // TODO bn
  "classify.finish": "Finish batch", // TODO bn
  "classify.complete": "Batch complete!", // TODO bn
  "classify.kpiChecked": "Fields checked this batch", // TODO bn
  "classify.kpiTotal": "Fields checked in total", // TODO bn
  "classify.kpiFlagged": "Flagged as interesting", // TODO bn
  "classify.rest": "Great work. Rest your eyes for a minute?", // TODO bn
  "classify.more": "Do 10 more", // TODO bn
  "classify.stats": "See my stats", // TODO bn

  "train.badge": "Practice", // TODO bn
  "train.hint": "These fields have known answers. Feedback comes after each one.", // TODO bn
  "train.done": "Practice complete", // TODO bn
  "train.score": "You got {correct} of {total} right.", // TODO bn
  "train.toClassify": "Start classifying", // TODO bn
  "train.correct": "Correct", // TODO bn
  "train.notQuite": "Not quite", // TODO bn
  "train.itWas": "This one was: {answer}.", // TODO bn
  "train.explain.moved": "This target really moves between visits.", // TODO bn
  "train.explain.brightness": "This star's brightness changes between visits.", // TODO bn
  "train.explain.noChange": "Nothing moves or changes here. The stars stay put.", // TODO bn
  "train.explain.real": "The bright spot in the centre is a real source, not a glitch.", // TODO bn
  "train.explain.glitch": "A cosmic-ray hit or a bad pixel sits at the centre of this field.", // TODO bn
  "train.explain.notSure": "This one is hard to call. Not sure is a fair answer.", // TODO bn

  "guide.title": "Field guide", // TODO bn
  "guide.intro": "Five things you will see, and how to tell them apart.", // TODO bn
  "guide.open": "Field guide", // TODO bn
  "guide.howTo": "How to tell", // TODO bn
  "guide.real.title": "A real mover", // TODO bn
  "guide.real.body": "A star that is in a slightly different place in each picture.", // TODO bn
  "guide.real.how": "Blink slowly and watch one spot. It should shift in one direction.", // TODO bn
  "guide.variable.title": "A variable star", // TODO bn
  "guide.variable.body": "The same spot, with the brightness rising and falling.", // TODO bn
  "guide.variable.how":
    "Compare the first and last picture. Look for a clear change in brightness.", // TODO bn
  "guide.cosmic.title": "Cosmic-ray glitch", // TODO bn
  "guide.cosmic.body":
    "A single bright pixel, or a short streak, that appears in one picture only.", // TODO bn
  "guide.cosmic.how": "If it is gone in the next picture, it is a glitch.", // TODO bn
  "guide.spikes.title": "Bright-star spikes", // TODO bn
  "guide.spikes.body": "A very bright star can leave a halo or spikes that look like movement.", // TODO bn
  "guide.spikes.how": "Movement that stays attached to a bright star is usually a spike.", // TODO bn
  "guide.nothing.title": "Nothing changed", // TODO bn
  "guide.nothing.body": "The pictures look the same, apart from a little noise.", // TODO bn
  "guide.nothing.how": "If you cannot see a change after a careful look, answer no change.", // TODO bn
  "header.myStats": "My stats", // TODO bn
  "explore.advancedCollapse": "Show as tabs", // TODO bn
  "auth.required.title": "Sign in to continue", // TODO bn
  "auth.required.body":
    "Contributing, your stats and your certificate are kept per account. Sign in to use them. Exploring the sky does not need an account.", // TODO bn
  "cert.getTitle": "Get your certificate", // TODO bn
  "cert.eligibleBody":
    "Your certificate is drawn from your own stats. Download it as a PNG or print it.", // TODO bn
  "cert.notEligible":
    "Check at least {min} fields to unlock your certificate. You have checked {count} so far.", // TODO bn
  "cert.unlockButton": "Get certificate", // TODO bn
  "cert.withdraw": "Withdraw certificate (PNG)", // TODO bn
  "header.account": "Account menu", // TODO bn
  "header.certificate": "Certificate", // TODO bn
  "header.signOut": "Sign out", // TODO bn
  "header.mainNav": "Main", // TODO bn
  "header.mobileNav": "Mobile", // TODO bn

  "landing.badge": "NASA Space Apps 2026", // TODO bn
  "landing.title": "Watch the sky change.", // TODO bn
  "landing.subtitle":
    "Spot moving stars and new worlds in NASA SPHEREx infrared images. Blink two pictures of the same spot and see what changed.", // TODO bn
  "landing.try": "Try it now", // TODO bn
  "landing.join": "Join a project", // TODO bn
  "landing.free": "Free · No sign-up needed", // TODO bn
  "landing.demoLabel": "Simulated example: Barnard's Star blinking", // TODO bn
  "landing.demoCaption": "Simulated example", // TODO bn
  "landing.how.title": "How it works", // TODO bn
  "landing.how.1.title": "Choose a spot", // TODO bn
  "landing.how.1.body": "Type coordinates or pick one of five test targets.", // TODO bn
  "landing.how.2.title": "Watch it blink", // TODO bn
  "landing.how.2.body": "See the same patch of sky from several visits, one after another.", // TODO bn
  "landing.how.3.title": "Report what you see", // TODO bn
  "landing.how.3.body": "In a project, answer one simple question per field. Practise first.", // TODO bn
  "landing.projects.title": "Projects", // TODO bn
  "landing.projects.all": "See all projects", // TODO bn
  "landing.spherex.title": "What is SPHEREx?", // TODO bn
  "landing.spherex.body":
    "SPHEREx is a NASA infrared space telescope, launched in March 2025. It maps the whole sky about every six months, so the same spot is seen again and again.", // TODO bn
  "landing.spherex.link": "Read more about the mission and our data", // TODO bn
  "landing.cta.title": "Ready to look?", // TODO bn
  "landing.community": "Our community", // TODO bn
  "landing.how.intro":
    "Pick a spot, watch it blink, and report what changed. No experience needed.", // TODO bn
  "landing.projects.intro":
    "Each project asks one simple question about the pictures. Start with practice.", // TODO bn
  "landing.nav.hero": "Start", // TODO bn
  "landing.nav.how": "How it works", // TODO bn
  "landing.nav.projects": "Projects", // TODO bn
  "landing.nav.spherex": "SPHEREx", // TODO bn
  "landing.nav.start": "Begin", // TODO bn
  "landing.scroll.interactive": "Interactive", // TODO bn
  "landing.scroll.explore": "Scroll to explore", // TODO bn
  "landing.scroll.goTo": "Go to {name}", // TODO bn
  "landing.scroll.section": "Section {n}", // TODO bn
  "landing.scroll.progress": "Sections", // TODO bn

  "community.title": "Community", // TODO bn
  "community.intro":
    "How the volunteers are doing, in total. Numbers shown here are demo data while the real community is small.", // TODO bn
  "community.kpi.volunteers": "Volunteers", // TODO bn
  "community.kpi.classifications": "Classifications", // TODO bn
  "community.kpi.flagged": "Flagged as interesting", // TODO bn
  "community.kpi.agreement": "Agreement", // TODO bn
  "community.overTime": "Classifications over time", // TODO bn
  "community.byProject": "By project", // TODO bn
  "community.volunteers": "Volunteers by month", // TODO bn
  "community.demoNote": "Demo data. Not measured from volunteers.", // TODO bn

  "about.title": "About AstroBlink", // TODO bn
  "about.what.title": "What is AstroBlink?", // TODO bn
  "about.what.body":
    "AstroBlink is a public web tool. Type a sky position, or pick a test target, and watch a series of SPHEREx infrared images of that spot play like a short video. Moving or changing objects are easier to spot that way. A light citizen-science layer sits on top, with projects, practice rounds and a field guide.", // TODO bn
  "about.spherex.title": "What is SPHEREx?", // TODO bn
  "about.spherex.body":
    "SPHEREx is a NASA infrared space telescope, launched in March 2025. It has six detectors that together cover wavelengths from 0.75 to 5.0 micrometres. It maps the whole sky about every six months.", // TODO bn
  "about.blink.title": "How blinking finds new objects", // TODO bn
  "about.blink.body":
    "Astronomers have used blink comparators for a long time. Two pictures of the same patch of sky are shown one after another. Anything that moved or changed stands out, while the still stars stay put. Pluto was found this way in 1930 by Clyde Tombaugh, who compared photographic plates by eye.", // TODO bn
  "about.data.title": "About our data", // TODO bn
  "about.data.body":
    "By default the viewer uses a simulated sky. It is generated in your browser from a seeded model, so the same spot always looks the same. Every simulated view says so. Real SPHEREx cutouts can be added later as static files. There is no live archive connection in this version.", // TODO bn
  "about.credits.title": "Credits and acknowledgements", // TODO bn
  "about.credits.body":
    "Built with NASA SPHEREx data from IRSA/IPAC. AstroBlink is a NASA Space Apps Challenge project and is not endorsed by NASA.", // TODO bn
  "about.models":
    "3D model of Earth by Stéphane Agullo (sa3d), licensed CC BY 4.0, via Sketchfab. Shown without changes.", // TODO bn
  "about.team.title": "Team", // TODO bn
  "about.team.body":
    "TODO: team name, members and credits. To be filled in by the team (brain §10).", // TODO bn

  "me.guest": "Guest", // TODO bn
  "me.volunteer": "Volunteer", // TODO bn
  "me.since": "Contributing since {date}", // TODO bn
  "me.notStarted": "Not started yet. Try a practice round.", // TODO bn
  "me.localNote": "Your progress is stored in this browser only.", // TODO bn
  "me.certificate": "Get certificate", // TODO bn
  "me.kpi.checked": "Fields checked", // TODO bn
  "me.kpi.projects": "Projects joined", // TODO bn
  "me.kpi.flagged": "Interesting flags", // TODO bn
  "me.kpi.agreement": "Agreement rate", // TODO bn
  "me.activity": "Activity, last 14 days", // TODO bn
  "me.byProject": "Projects", // TODO bn
  "me.noProjects": "No projects yet.", // TODO bn
  "me.recent": "Recent activity", // TODO bn
  "me.noActivity": "Nothing yet. Your answers will appear here.", // TODO bn
  "me.table.date": "Date", // TODO bn
  "me.table.project": "Project", // TODO bn
  "me.table.answer": "Your answer", // TODO bn
  "me.table.agreement": "Agreement", // TODO bn
  "me.agrees": "Same as most", // TODO bn
  "me.differs": "Different", // TODO bn
  "me.demoNote": "*Agreement compares your answer with demo community data.", // TODO bn
  "me.clear": "Clear my data", // TODO bn
  "me.clearTitle": "Clear your data in this browser?", // TODO bn
  "me.clearBody":
    "This removes your answers, practice progress and sign-in from this browser. It cannot be undone.", // TODO bn
  "me.clearConfirm": "Clear my data", // TODO bn

  "cert.heading": "Certificate of contribution", // TODO bn
  "cert.title": "Certificate of contribution", // TODO bn
  "cert.body": "has checked {count} fields of the sky in AstroBlink projects", // TODO bn
  "cert.projects": "Projects", // TODO bn
  "cert.none": "No projects yet", // TODO bn
  "cert.date": "Date", // TODO bn
  "cert.credit": "Built with NASA SPHEREx data. Not an official NASA certificate.", // TODO bn
  "cert.preview": "Preview of your certificate", // TODO bn
  "cert.demoNote": "The certificate is drawn from your answers in this browser.", // TODO bn
  "cert.download": "Download PNG", // TODO bn
  "cert.print": "Print / Save as PDF", // TODO bn
  "cert.back": "Back to my stats", // TODO bn

  "login.title": "Sign in to keep your progress", // TODO bn
  "login.back": "Back", // TODO bn
  "login.hookTitle": "Be the next citizen scientist.", // TODO bn
  "login.hookBody": "Help astronomers find moving stars and new worlds in NASA SPHEREx images. No experience needed.", // TODO bn
  "login.signedIn": "You are signed in", // TODO bn
  "login.as": "Signed in as", // TODO bn
  "login.localNote":
    "Demo sign-in: nothing is sent anywhere. Your progress is stored in this browser.", // TODO bn
  "login.toStats": "My stats", // TODO bn
  "login.signOut": "Sign out", // TODO bn
  "login.name": "Display name", // TODO bn
  "login.email": "Email", // TODO bn
  "login.continue": "Continue", // TODO bn
  "login.or": "or", // TODO bn
  "login.guest": "Guest", // TODO bn
  "login.guestButton": "Continue as guest", // TODO bn
  "login.errName": "Please enter a display name.", // TODO bn
  "login.errEmail": "Please enter an email address like name@example.com.", // TODO bn
};
