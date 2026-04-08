// ── Expert Q&A Seeds -- 25 Industries × 18 pairs = 450 Q&A pairs ─────────────
// Each industry has: 5 discovery, 5 objection, 3 closing, 2 rapport, 3 Momenta bridge

type QASeed = {
  question_text: string
  question_type: string
  industry_sic_code: string
  industry_name: string
  answer_text: string
  answer_type: string
  notes: string
  source: 'expert'
  effectiveness_score: number
}

function q(sic: string, name: string, type: string, question: string, answer: string, ansType: string, notes: string, score: number): QASeed {
  return { question_text: question, question_type: type, industry_sic_code: sic, industry_name: name, answer_text: answer, answer_type: ansType, notes, source: 'expert', effectiveness_score: score }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. PLUMBING (1711)
// ═══════════════════════════════════════════════════════════════════════════════
const PLUMBING: QASeed[] = [
  q('1711','Plumbing','discovery','How many service calls are you running per week right now?',"About 20-25 on a good week, but it drops off hard in slow months.",'interest',`Reveals capacity and seasonality. Follow up on slow months.`,76),
  q('1711','Plumbing','discovery','What percentage of your calls are emergencies versus scheduled work?',"Probably 60-40 emergencies to scheduled. We'd love more scheduled honestly.",'interest',`Opens recurring revenue conversation. Scheduled = higher margin.`,74),
  q('1711','Plumbing','discovery','How are you showing up on Google Maps when someone searches plumber near me?',"I think we show up but definitely not in the top 3. I know some competitors are above us.",'interest',`Opens Local SEO + Google Business Profile conversation.`,79),
  q('1711','Plumbing','discovery','Do you have a system for getting reviews after each job?',"Not really, sometimes the guys ask but it's hit or miss. We only have like 30 reviews.",'interest',`Opens reputation management. Low review count = huge opportunity.`,77),
  q('1711','Plumbing','discovery','What is your average ticket size on a service call?',"Probably around $350-400 for a service call, more for bigger jobs.",'interest',`Helps quantify ROI conversation later.`,72),
  q('1711','Plumbing','objection',"I get all my work from word of mouth","That's awesome -- shows you do great work. But here's the thing, word of mouth is unpredictable. What happens in those slow months when referrals dry up?",'objection',`Acknowledge then challenge predictability. Loss aversion technique.`,80),
  q('1711','Plumbing','objection',"I already use a guy for my marketing","How's it going? Are you seeing the leads you expected? A lot of plumbers I talk to had someone but weren't seeing consistent Google Maps visibility.",'objection',`Find the gap. Most plumbing marketing is poorly done.`,78),
  q('1711','Plumbing','objection',"How much does this cost?","Totally depends on what you need -- could be as simple as getting your Google Maps listing dialed in. The 15 minutes with our team is specifically to scope that out so you get a real number.",'question',`Bridge to meeting. Plumbers are price-first thinkers.`,82),
  q('1711','Plumbing','objection',"We tried online marketing before and it didn't work","I hear that a lot honestly. Most plumbing marketing is done by generic agencies who don't understand the trade. We've got 500+ local businesses and know exactly what works for plumbers specifically.",'objection',`Social proof + niche expertise. Use 500+ SMBs stat.`,81),
  q('1711','Plumbing','objection',"I'm too busy right now to think about marketing","That's actually the perfect time -- when you're busy, you've got cash flow to invest. When it slows down, you'll wish you started earlier. Can I grab you 15 minutes next Tuesday?",'objection',`Reframe busy as opportunity. Urgency technique.`,75),
  q('1711','Plumbing','closing',"What day works better for you this week -- Tuesday or Thursday?","Thursday's probably better, mornings.",'commitment',`Alternative close. Always give two options not one.`,85),
  q('1711','Plumbing','closing',"Our strategist can do a quick local SEO audit for free -- would that be worth 15 minutes?","Yeah I mean if it's free, sure. What do I need to do?",'commitment',`Lead with free value. Lower the commitment barrier.`,83),
  q('1711','Plumbing','closing',"I'll send you a quick confirmation with their background so you know exactly who you're talking to. What's your best email?","Yeah sure, it's mike at smithplumbing dot com.",'commitment',`Get email as micro-commitment. They're more likely to show up.`,80),
  q('1711','Plumbing','rapport',"How long have you been running the plumbing business?","Going on 18 years now. Started as an apprentice, went out on my own about 10 years ago.",'acceptance',`Let them tell their story. Plumbers are proud of their journey.`,72),
  q('1711','Plumbing','rapport',"What's your service area look like?","We cover pretty much all of the metro area, about a 30-mile radius.",'acceptance',`Understand geographic scope for Local SEO targeting.`,70),
  q('1711','Plumbing','discovery',"When someone has a plumbing emergency at 2am and searches Google, are they finding you?","Probably not, I don't think our website even shows up for emergency searches.",'interest',`Bridges to SEO + Google Ads for emergency plumber keywords. High-intent, high-ticket.`,84),
  q('1711','Plumbing','discovery',"Are you running Google Local Service Ads -- the ones with the green checkmark?","No, I've heard about those but never set them up.",'interest',`Bridges to Paid Media. GLSA has highest ROI for plumbers.`,80),
  q('1711','Plumbing','discovery',"Do you have any system for following up with customers after a job -- like for maintenance reminders?","No, we probably should but we don't have anything set up for that.",'interest',`Bridges to Email & Retention + AI CRM for recurring revenue.`,76),
]

// ═══════════════════════════════════════════════════════════════════════════════
// 2. HVAC (7699)
// ═══════════════════════════════════════════════════════════════════════════════
const HVAC: QASeed[] = [
  q('7699','HVAC','discovery','How do you handle the seasonal swings -- busy in summer and winter, slow in between?',"It's brutal honestly. Summer and winter we can't keep up, spring and fall we're scrambling.",'interest',`Opens marketing-as-buffer conversation.`,77),
  q('7699','HVAC','discovery','Do you offer maintenance contracts or service agreements?',"We do but we don't push them hard enough. Maybe 20% of our customers are on one.",'interest',`Bridges to Email & Retention for upselling maintenance plans.`,75),
  q('7699','HVAC','discovery','How are you currently generating leads during the slow seasons?',"Honestly we just kind of wait for the phone to ring.",'interest',`Reveals passive lead gen. Opens paid media conversation.`,80),
  q('7699','HVAC','discovery','What does your online presence look like -- website, Google listing, reviews?',"We've got a website but it's pretty outdated. Reviews are okay, maybe 50 on Google.",'interest',`Opens full digital audit conversation.`,76),
  q('7699','HVAC','discovery','Are you doing anything with energy efficiency or rebate programs in your marketing?',"Not really, I know there are rebates but we don't promote that.",'interest',`Missed content marketing angle. Energy savings = great ad copy.`,73),
  q('7699','HVAC','objection',"We're already slammed with work","That's the best time to build your pipeline. When the slow season hits, you'll have leads already warming up. Our clients see 340% more leads -- imagine that hitting when you need it most.",'objection',`Reframe. Use 340% stat for impact.`,79),
  q('7699','HVAC','objection',"Marketing doesn't work for HVAC -- it's all referrals","Referrals are great but they're unpredictable. What if you could fill your spring and fall calendar the same way summer fills up? That's what targeted Google Ads and Local SEO do.",'objection',`Challenge referral-only model with data.`,77),
  q('7699','HVAC','objection',"I don't have the budget right now","Totally understand. But here's the math -- if one Google lead turns into a $5,000 install, and we're getting leads at $80-150 each, that ROI speaks for itself. Worth 15 minutes to look at the numbers?",'question',`ROI math. HVAC has high ticket = easy ROI argument.`,82),
  q('7699','HVAC','objection',"The big franchise guys dominate online","They spend more but they're not smarter. Local SEO actually favors independent operators because Google prioritizes proximity and reviews. We help you compete where they can't.",'objection',`Reframe franchise dominance as beatable.`,78),
  q('7699','HVAC','objection',"Just send me some information","I could, but honestly the generic brochure never does it justice for HVAC specifically. The 15 minutes with our strategist -- they'll actually look at your Google Maps listing and competitors and tell you what's happening. Way more valuable.",'objection',`Reframe email as inferior to custom audit.`,76),
  q('7699','HVAC','closing',"We can have our HVAC marketing specialist look at your local market in 15 minutes -- no obligation. What day works?","Let's do Wednesday, I've got some time in the afternoon.",'commitment',`Niche specialist angle builds credibility.`,83),
  q('7699','HVAC','closing',"I'll send a quick calendar invite with their background. What email should I use?","Use my office email, it's tony at comfortheating dot com.",'commitment',`Email capture as micro-commitment.`,80),
  q('7699','HVAC','closing',"Between getting your Google listing optimized and seasonal ad campaigns, we could probably fill those shoulder months. Worth exploring?","Yeah I mean that's been our biggest issue for years.",'commitment',`Tie solution to their stated pain.`,82),
  q('7699','HVAC','rapport',"How long has the business been around?","My dad started it in '98, I took over about 8 years ago.",'acceptance',`Family business = pride. Let them share the story.`,71),
  q('7699','HVAC','rapport',"What's the best part about running your own HVAC company?","Being my own boss. And I love when we solve a problem nobody else could figure out.",'acceptance',`Gets them positive and talking.`,70),
  q('7699','HVAC','discovery',"Are you sending any follow-up emails to past customers -- like seasonal tune-up reminders?","No, we should be doing that but we just don't have the time or the system for it.",'interest',`Bridges to Email & Retention + AI CRM automation.`,78),
  q('7699','HVAC','discovery',"What's your average install ticket versus service call?","Installs are like $6-8K, service calls are $200-400.",'interest',`High install ticket = easy ROI math for paid media.`,74),
  q('7699','HVAC','discovery',"If you could wave a magic wand and fix one thing about your marketing, what would it be?","Getting consistent leads in spring and fall. That's when we're hurting.",'interest',`Direct pain revelation. Anchor all proposals here.`,81),
]

// ═══════════════════════════════════════════════════════════════════════════════
// 3-25: Remaining Industries (compressed format for space)
// ═══════════════════════════════════════════════════════════════════════════════

const ROOFING: QASeed[] = [
  q('1761','Roofing','discovery','How many estimates are you running per week?',"Maybe 8-10 but our close rate could be better.",'interest',`Quantifies pipeline. Low close rate = website/follow-up issue.`,78),
  q('1761','Roofing','discovery','What percentage of your jobs come from storm damage versus regular reroofs?',"Probably 60% storm, 40% regular. Storm work is feast or famine though.",'interest',`Reveals weather dependency. Opens content/SEO for non-storm.`,76),
  q('1761','Roofing','discovery','Are you showing up on Google when someone searches for a roofer in your area?',"I think so but I know a couple competitors are above us.",'interest',`Opens Local SEO conversation.`,79),
  q('1761','Roofing','discovery','How are you handling the insurance company conversations?',"That's the hardest part honestly. Some adjusters are a nightmare.",'interest',`Opens content marketing for insurance-related content.`,73),
  q('1761','Roofing','discovery','Do you have a system for getting reviews after each job?',"We ask sometimes but it's not consistent.",'interest',`Opens reputation management. Reviews critical for roofing trust.`,77),
  q('1761','Roofing','objection',"We're getting 3 bids and going with the cheapest","That's smart to compare. What usually separates the bids besides price? Our clients find that when they show up with stronger reviews and better online presence, customers pick quality over price.",'objection',`Reframe competition as quality play.`,79),
  q('1761','Roofing','objection',"We only do storm chasing, don't need marketing","What happens between storms though? The roofers who have a steady retail pipeline aren't scrambling when there's a dry spell.",'objection',`Challenge single-channel dependency.`,77),
  q('1761','Roofing','objection',"Homeowners just pick whoever knocks on their door first","Actually, 87% of homeowners Google a roofer before saying yes -- even if someone knocked. If you're not showing up with great reviews, you're losing jobs to guys who are.",'objection',`Data-driven reframe. Digital trust matters.`,82),
  q('1761','Roofing','objection',"Marketing is too expensive for roofing margins","One roof job is $8-15K. If we get you one extra job a month from Google, that's paying for a full year of marketing in one deal.",'objection',`ROI math with real roofing numbers.`,83),
  q('1761','Roofing','objection',"We tried SEO before, nothing happened","Most SEO agencies don't understand roofing keywords. They optimize for generic terms instead of 'roof replacement [city]' or 'storm damage repair near me.' We know exactly what roofing customers search.",'objection',`Niche expertise differentiator.`,78),
  q('1761','Roofing','closing',"Worth 15 minutes to see how your competitors are showing up versus you?","Yeah that'd be interesting actually.",'commitment',`Competitive comparison hook.`,84),
  q('1761','Roofing','closing',"What email should I send the confirmation to?","Use my personal, john at peakroofing dot com.",'commitment',`Email capture.`,80),
  q('1761','Roofing','closing',"Our strategist specializes in home services -- they'll show you exactly where the gaps are. Tuesday or Thursday?","Let's do Thursday morning.",'commitment',`Alternative close with specialist angle.`,82),
  q('1761','Roofing','rapport',"How long have you been in roofing?","About 15 years. Started as a laborer and worked my way up.",'acceptance',`Trade pride. Let them share their journey.`,70),
  q('1761','Roofing','rapport',"What's the biggest job you've ever done?","We did a 200-unit apartment complex last year. That was a game changer.",'acceptance',`Gets them talking about achievements.`,71),
  q('1761','Roofing','discovery',"Are you running any Google Ads or Local Service Ads?","No, I've heard they're expensive for roofing.",'interest',`Bridges to Paid Media. GLSA great ROI for roofing.`,80),
  q('1761','Roofing','discovery',"Do you have before-and-after photos on your website and Google listing?","We take them but they're mostly on my phone, not on the website.",'interest',`Bridges to Website Dev + Creative Services.`,75),
  q('1761','Roofing','discovery',"What happens after you finish a job -- any follow-up or warranty reminders?","Not really, we just hand them the warranty paperwork.",'interest',`Bridges to Email & Retention for referral generation.`,74),
]

const DENTAL: QASeed[] = [
  q('8021','Dental','discovery',"What's your new patient acquisition like right now?","We're getting maybe 10-15 new patients a month but I'd like to see 30-40.",'interest',`Quantifies gap immediately. Dental benchmark is 20-50.`,79),
  q('8021','Dental','discovery','How are you showing up when someone searches for a dentist in your area?',"I think we show up somewhere but definitely not at the top.",'interest',`Opens Local SEO. Dental is hyper-competitive locally.`,78),
  q('8021','Dental','discovery',"What's your no-show rate looking like?","Probably 15-20% which kills our schedule.",'interest',`Opens AI CRM for automated reminders.`,76),
  q('8021','Dental','discovery','Are you doing any cosmetic or specialty services -- Invisalign, implants, veneers?',"Yeah we offer Invisalign and implants but most patients come for cleanings.",'interest',`High-value services need targeted marketing.`,77),
  q('8021','Dental','discovery','How are you handling your online reviews?',"We've got about 80 on Google, 4.6 stars.",'interest',`Good baseline. Growth opportunity with automated asks.`,74),
  q('8021','Dental','objection',"The office manager handles our marketing","Totally understand -- and she's probably amazing at keeping the office running. But marketing is a full-time specialty. Would it help her to have experts handling the leads while she focuses on the practice?",'objection',`Reframe as helping not replacing.`,80),
  q('8021','Dental','objection',"We get patients from insurance networks","Insurance patients are great but the reimbursement keeps going down. The practices growing fastest are attracting fee-for-service and cosmetic patients through Google and social. That's where the margin is.",'objection',`Reframe insurance dependency as margin issue.`,82),
  q('8021','Dental','objection',"We tried Google Ads and just got a bunch of junk leads","That's usually a targeting problem, not a Google problem. Most agencies don't know how to target cosmetic intent versus emergency versus family. We specialize in dental marketing specifically.",'objection',`Niche expertise. Bad execution ≠ bad channel.`,79),
  q('8021','Dental','objection',"I need to talk to my partner first","Absolutely -- could they join the 15-minute call? That way everyone hears the same thing and you can make a decision together.",'objection',`Include partner. Don't let it stall.`,76),
  q('8021','Dental','objection',"Now isn't a good time, maybe after the new year","I hear you. But the practices that start marketing now are the ones booked solid in January. Building visibility takes time -- the sooner you start, the sooner the chairs fill up.",'objection',`Urgency. Marketing has a ramp-up period.`,78),
  q('8021','Dental','closing',"Our dental marketing specialist can look at your market and show you exactly what your competitors are doing. Worth 15 minutes?","Yeah I'd actually be curious about that.",'commitment',`Competitive intel hook works well for dental.`,84),
  q('8021','Dental','closing',"What's your best email for the calendar invite?","Send it to frontdesk at brightsmiledental dot com, and cc me at dr.chen at brightsmiledental.",'commitment',`Get both emails. Office manager is gatekeeper.`,80),
  q('8021','Dental','closing',"Between Google Ads for new patients and automated review generation, we could probably double your new patient flow. Want to explore that?","Yeah, 30-40 new patients would be a game changer for us.",'commitment',`Tie to their stated goal number.`,85),
  q('8021','Dental','rapport',"How long has the practice been here?","I opened this location about 6 years ago, but I've been practicing for 12.",'acceptance',`Practice pride. Follow up on growth journey.`,71),
  q('8021','Dental','rapport',"What's your favorite procedure to do?","Honestly, smile makeovers. Seeing someone's reaction when they see their new smile -- that never gets old.",'acceptance',`Emotional connection. Bridges to cosmetic marketing.`,72),
  q('8021','Dental','discovery',"Are you posting any content on social media -- before-and-afters, patient stories?","My front desk does some Instagram posts but nothing consistent.",'interest',`Bridges to Social Marketing + Creative Services.`,75),
  q('8021','Dental','discovery',"Do you have any system for reactivating patients who haven't been in for 6+ months?","No, we probably have hundreds of those in our system.",'interest',`Bridges to Email & Retention. Huge ROI reactivating dormant patients.`,80),
  q('8021','Dental','discovery',"Are you tracking which marketing channels actually bring in new patients?","Not really. The front desk asks 'how did you hear about us' but we don't do much with it.",'interest',`Bridges to Analytics & Reporting.`,76),
]

const MEDICAL: QASeed[] = [
  q('8011','Medical Office','discovery',"What's your new patient acquisition like?","We get maybe 30-40 new patients a month but capacity is there for 60-70.",'interest',`Clear capacity gap. Quantifiable target.`,78),
  q('8011','Medical Office','discovery','How are patients finding you -- referrals, insurance directories, Google?',"Mix of everything but mostly insurance directories and word of mouth.",'interest',`Opens digital marketing conversation.`,76),
  q('8011','Medical Office','discovery','Are you competing with any urgent care or telehealth for patients?',"Yeah, the urgent cares are popping up everywhere and stealing our acute visits.",'interest',`Opens competitive positioning conversation.`,77),
  q('8011','Medical Office','discovery','How are you handling your online reputation -- Google reviews, Healthgrades?',"We've got decent reviews but we're not actively managing it.",'interest',`Opens reputation management.`,75),
  q('8011','Medical Office','discovery','What does your patient retention look like -- are they coming back for follow-ups?',"Could be better. We lose a lot of patients after the first visit.",'interest',`Opens Email & Retention for patient nurturing.`,79),
  q('8011','Medical Office','objection',"We're a medical practice, we don't really advertise","I completely understand that perspective. But your competitors are showing up on Google when patients search for symptoms. If you're not there, those patients go somewhere else.",'objection',`Reframe. Patients search online even for doctors.`,80),
  q('8011','Medical Office','objection',"HIPAA makes marketing complicated","It does add considerations, but we work with medical practices specifically and know exactly what's compliant. Our review system, our ads -- all HIPAA-safe.",'objection',`Niche expertise eliminates compliance fear.`,81),
  q('8011','Medical Office','objection',"We rely on referrals from other doctors","Referrals are gold. But what about the patients searching Google at 2am with symptoms? Those are self-referred, high-intent patients you're leaving on the table.",'objection',`Referral + digital = compound growth.`,79),
  q('8011','Medical Office','objection',"Our hospital system handles marketing for us","Hospital marketing is broad. They're marketing the system, not your specific practice. Patients choose individual doctors -- and that's where personal SEO and reviews make the difference.",'objection',`Differentiate system-level vs practice-level marketing.`,78),
  q('8011','Medical Office','objection',"I don't have time to deal with marketing","That's exactly why agencies exist -- you focus on patients, we focus on getting them in the door. Our clients literally don't think about marketing because we handle everything.",'objection',`Remove the time burden.`,76),
  q('8011','Medical Office','closing',"Our healthcare marketing specialist can look at your online presence and show you exactly where patients are going instead of you. Worth 15 minutes?","Sure, I'd like to see that.",'commitment',`Competitive loss angle.`,83),
  q('8011','Medical Office','closing',"What's the best email for the calendar invite?","Send it to my office manager, she handles my schedule.",'commitment',`Get gatekeeper buy-in.`,78),
  q('8011','Medical Office','closing',"Between Google visibility and automated patient outreach, we could probably fill that capacity gap. Want to explore it?","Yeah, filling 60-70 patients would make a big difference.",'commitment',`Tie to their capacity number.`,82),
  q('8011','Medical Office','rapport',"What made you go into medicine?","I always wanted to help people. Sounds cliche but it's true.",'acceptance',`Genuine connection point.`,70),
  q('8011','Medical Office','rapport',"What's the most rewarding part of running your own practice?","The relationships with patients. Some I've seen for 15 years.",'acceptance',`Emotional connection.`,71),
  q('8011','Medical Office','discovery',"Do you have a patient portal or any automated communications?","We have a basic one but patients don't really use it.",'interest',`Bridges to AI CRM + Email automation.`,76),
  q('8011','Medical Office','discovery',"Are you doing any content -- blog posts, health tips, social media?","Not really, we just don't have the bandwidth.",'interest',`Bridges to Content Marketing + Social.`,74),
  q('8011','Medical Office','discovery',"If a patient searches their symptoms on Google, does your practice show up with relevant content?","Definitely not. We don't have any of that.",'interest',`Bridges to SEO + Content. AEO for medical searches.`,80),
]

// Generate remaining industries with same pattern
const CHIRO: QASeed[] = [
  q('8049','Chiropractic','discovery',"How are most new patients finding you?","Mostly referrals and some Google, but it's inconsistent.",'interest',``,77),
  q('8049','Chiropractic','discovery',"Are you offering any wellness plans or membership programs?","We have one but enrollment is low.",'interest',`Opens Email & Retention for program promotion.`,75),
  q('8049','Chiropractic','discovery',"How are your Google reviews looking?","About 60 reviews, 4.7 stars.",'interest',`Good baseline but growth opportunity.`,73),
  q('8049','Chiropractic','discovery',"Are you doing any content around common conditions -- back pain, sciatica, posture?","Not really, our website is pretty basic.",'interest',`Bridges to Content + SEO.`,77),
  q('8049','Chiropractic','discovery',"What's your patient retention like after the initial treatment plan?","We lose a lot after their pain goes away.",'interest',`Opens retention and wellness marketing.`,79),
  q('8049','Chiropractic','objection',"People find us through word of mouth","That's great -- shows you do amazing work. But imagine if every happy patient left a Google review and new patients saw that social proof. That's word of mouth at scale.",'objection',`Scale word of mouth digitally.`,80),
  q('8049','Chiropractic','objection',"Insurance barely covers chiro, patients can't afford it","That's why marketing to cash-pay wellness patients is so powerful. They're not limited by insurance -- they're investing in their health. Those are the patients Google Ads brings in.",'objection',`Reframe to cash-pay opportunity.`,78),
  q('8049','Chiropractic','objection',"We tried Facebook ads and got nothing","Facebook is tough for chiro. Google is where people are actively searching 'chiropractor near me' -- that's high intent. We focus on what actually works for your industry.",'objection',`Channel-specific expertise.`,79),
  q('8049','Chiropractic','objection',"I'm a solo practitioner, I don't need more patients","Even solo docs benefit from a full schedule. When you're choosing which patients to see, that's when you build the practice you want -- higher value, better fit.",'objection',`Quality over quantity angle.`,75),
  q('8049','Chiropractic','objection',"My location is my best marketing","Location matters, but 80% of new patients Google before they walk in. If your online presence doesn't match your physical one, you're invisible to most of them.",'objection',`Digital visibility matters.`,77),
  q('8049','Chiropractic','closing',"Our specialist can show you exactly how patients in your area are searching for chiro right now. Worth 15 minutes?","Yeah, I'd be interested to see that.",'commitment',``,83),
  q('8049','Chiropractic','closing',"What email should I use for the invite?","drjohnson at alignedspine dot com.",'commitment',``,79),
  q('8049','Chiropractic','closing',"Between Google visibility and automated patient reactivation, we could keep your schedule consistently full. Want to explore?","That consistency would be huge honestly.",'commitment',``,82),
  q('8049','Chiropractic','rapport',"What got you into chiropractic?","I had a back injury playing football and a chiropractor changed my life.",'acceptance',`Personal story builds connection.`,71),
  q('8049','Chiropractic','rapport',"What do you enjoy most about the practice?","Seeing someone walk in hunched over and walk out standing straight. That transformation.",'acceptance',``,70),
  q('8049','Chiropractic','discovery',"Are you doing any community events or workshops?","We used to but stopped during COVID and never restarted.",'interest',`Bridges to Marketing Strategy + PR.`,74),
  q('8049','Chiropractic','discovery',"Do you send any follow-up after patients finish their plan?","No, we probably should.",'interest',`Bridges to Email & AI CRM.`,76),
  q('8049','Chiropractic','discovery',"Is your website mobile-optimized? Most patients search on their phone.","I honestly don't know. It's a few years old.",'interest',`Bridges to Website Development.`,75),
]

const LEGAL: QASeed[] = [
  q('8111','Legal Services','discovery',"What types of cases are you primarily handling?","Mostly personal injury and some family law.",'interest',`Identifies practice areas for targeted marketing.`,76),
  q('8111','Legal Services','discovery',"How are most of your clients finding you right now?","Referrals from other attorneys and past clients mostly.",'interest',`Opens digital lead gen conversation.`,78),
  q('8111','Legal Services','discovery',"Are you buying any leads from legal aggregators -- Avvo, FindLaw, Martindale?","Yeah we spend about $3K a month on FindLaw leads but the quality is terrible.",'interest',`Pain point with aggregators = huge opportunity.`,82),
  q('8111','Legal Services','discovery',"What does your Google presence look like?","I think we have a listing but we haven't touched it in years.",'interest',`Opens Local SEO for attorneys.`,77),
  q('8111','Legal Services','discovery',"What's your average case value?","PI cases average around $30-50K in fees.",'interest',`High case value = easy ROI argument.`,75),
  q('8111','Legal Services','objection',"Lawyers don't advertise, it's not professional","I understand that perspective. But your competitors are on page one of Google right now. The question isn't whether legal marketing is professional -- it's whether you want those cases or they get them.",'objection',`Competitive reality check.`,81),
  q('8111','Legal Services','objection',"The bar association has restrictions on advertising","Absolutely, and we know them well. We work with law firms specifically and everything we do is bar-compliant. No misleading claims, proper disclaimers, the whole thing.",'objection',`Compliance expertise removes fear.`,80),
  q('8111','Legal Services','objection',"We get all our cases from referrals","Referrals are the gold standard. But one Google Ads lead that turns into a $40K case pays for months of marketing. It's not replacing referrals, it's adding a second pipeline.",'objection',`Additive not replacement framing.`,82),
  q('8111','Legal Services','objection',"Google Ads for lawyers is $100+ per click","It is expensive per click. But when one case is worth $30-50K, you only need one conversion per month to see massive ROI. The math is different for legal.",'objection',`ROI math at legal case values.`,83),
  q('8111','Legal Services','objection',"I don't have time to think about marketing","That's why firms hire marketing agencies -- you focus on cases, we focus on filling your pipeline. Our clients literally don't think about where the next case is coming from.",'objection',`Remove time burden.`,77),
  q('8111','Legal Services','closing',"Our legal marketing specialist can show you how your competitors are getting cases from Google. Worth 15 minutes?","Yeah, I'd like to understand what they're doing.",'commitment',`Competitive intel hook.`,84),
  q('8111','Legal Services','closing',"What's the best email for the calendar invite?","My assistant's email -- she manages my calendar.",'commitment',`Gatekeeper capture.`,79),
  q('8111','Legal Services','closing',"If we could replace those $3K in aggregator leads with owned leads at half the cost, would that be worth exploring?","If you can actually do that, absolutely.",'commitment',`Quantified improvement on current spend.`,85),
  q('8111','Legal Services','rapport',"How long have you been practicing?","22 years. Built this firm from scratch.",'acceptance',``,70),
  q('8111','Legal Services','rapport',"What area of law do you enjoy the most?","Honestly, the big PI cases where I can really change someone's life.",'acceptance',``,71),
  q('8111','Legal Services','discovery',"Are you doing any content marketing -- blog posts about legal topics, FAQ pages?","No, our website is basically a brochure.",'interest',`Bridges to Content + SEO. Legal content ranks well.`,78),
  q('8111','Legal Services','discovery',"Do you have a system for following up with leads that don't sign immediately?","Not really. If they don't sign on the first call, we usually lose them.",'interest',`Bridges to AI CRM + Email nurture.`,80),
  q('8111','Legal Services','discovery',"Are you tracking where your signed cases actually come from?","Not precisely. We kind of know but it's not data-driven.",'interest',`Bridges to Analytics & Reporting.`,76),
]

const REAL_ESTATE: QASeed[] = [
  q('6531','Real Estate','discovery',"Are you working mostly with buyers, sellers, or both?","Mostly buyers right now but I want more listings.",'interest',`Listing leads = different marketing strategy.`,77),
  q('6531','Real Estate','discovery',"How are you generating leads right now -- Zillow, Realtor.com, social media?","I pay for Zillow Premier Agent but the leads are getting expensive.",'interest',`Zillow pain = owned lead gen opportunity.`,80),
  q('6531','Real Estate','discovery',"What does your personal brand look like online?","I have a website through my brokerage but it's not really mine.",'interest',`Opens personal brand + website conversation.`,76),
  q('6531','Real Estate','discovery',"Are you doing any content -- market updates, neighborhood guides, video tours?","I post on Instagram sometimes but nothing consistent.",'interest',`Bridges to Content + Social + Video.`,75),
  q('6531','Real Estate','discovery',"What's your average transaction volume per year?","About 15-20 transactions. I want to get to 30.",'interest',`Clear growth target.`,74),
  q('6531','Real Estate','objection',"I spend $2K/month on Zillow, that's my marketing","Zillow is renting leads -- you never own them. When you stop paying, they disappear. What if you invested that $2K into Google Ads and SEO where you own the leads forever?",'objection',`Own vs rent leads. Powerful reframe.`,83),
  q('6531','Real Estate','objection',"The market is slow right now","That's actually when the best agents double down on marketing. When the market turns -- and it always does -- you'll be the agent everyone sees. Your competitors are pulling back. This is your advantage.",'objection',`Counter-cyclical opportunity.`,80),
  q('6531','Real Estate','objection',"My brokerage provides marketing support","Brokerage marketing promotes the brand, not you. Clients choose agents, not companies. Personal brand marketing is what separates top producers.",'objection',`Personal brand vs brokerage brand.`,79),
  q('6531','Real Estate','objection',"I don't need more clients, I need more listings","That's exactly what content marketing and local SEO generate -- seller leads. When homeowners Google 'home value in [neighborhood]' and find your content, you become their listing agent.",'objection',`Align service to specific need.`,82),
  q('6531','Real Estate','objection',"Social media is my marketing","Social is important but it's only one channel. Are those followers actually converting to clients? Our approach compounds -- SEO brings people to your content, content builds trust, ads retarget warm prospects.",'objection',`Single channel vs compounding approach.`,78),
  q('6531','Real Estate','closing',"Our real estate specialist can show you how to replace Zillow leads with owned leads. Worth 15 minutes?","Yeah, I'm tired of paying Zillow.",'commitment',`Pain point close.`,85),
  q('6531','Real Estate','closing',"What's the best number and email for you?","My cell is fine and email is sarah at premierhomes dot com.",'commitment',``,79),
  q('6531','Real Estate','closing',"If we could get you 5 more listing leads per month without Zillow, would that change the game?","Five more listings would be incredible.",'commitment',`Quantified outcome.`,84),
  q('6531','Real Estate','rapport',"How long have you been in real estate?","About 8 years. I actually came from corporate and never looked back.",'acceptance',`Career change story. Builds connection.`,71),
  q('6531','Real Estate','rapport',"What market do you love working in?","I specialize in the waterfront properties. That's my niche.",'acceptance',`Niche = targeted marketing opportunity.`,70),
  q('6531','Real Estate','discovery',"Do you have a database of past clients that you stay in touch with?","Kind of, but I'm bad at following up.",'interest',`Bridges to Email & CRM.`,78),
  q('6531','Real Estate','discovery',"Are you doing any video -- walkthroughs, market updates, neighborhood tours?","I know I should but I haven't started.",'interest',`Bridges to Video Marketing.`,75),
  q('6531','Real Estate','discovery',"When someone searches 'homes for sale in [your area],' are they finding you?","Probably not. Zillow and Realtor.com dominate those searches.",'interest',`Bridges to SEO. Long game but powerful.`,77),
]

const RESTAURANT: QASeed[] = [
  q('5812','Restaurant','discovery',"How are you handling online orders and delivery?","We use DoorDash and UberEats but the fees are killing us.",'interest',`Opens direct ordering conversation.`,80),
  q('5812','Restaurant','discovery',"What are your slow nights?","Tuesday and Wednesday are dead.",'interest',`Opens targeted ad campaigns for slow days.`,78),
  q('5812','Restaurant','discovery',"How are your Google reviews looking?","We've got about 200 reviews, 4.3 stars.",'interest',`Good volume but rating could improve.`,74),
  q('5812','Restaurant','discovery',"Are you doing anything on social media -- food photos, specials, events?","My manager posts sometimes but it's not consistent.",'interest',`Bridges to Social Marketing.`,76),
  q('5812','Restaurant','discovery',"What's your repeat customer rate?","Honestly not sure. I think regulars are maybe 30% of business.",'interest',`Opens Email & Retention + loyalty programs.`,77),
  q('5812','Restaurant','objection',"Restaurants don't need marketing, we need foot traffic","Foot traffic starts with Google. When someone searches 'best Italian near me' and you're not in the top 3 results, that's a customer walking into your competitor instead.",'objection',`Digital drives physical.`,80),
  q('5812','Restaurant','objection',"DoorDash brings us plenty of orders","But they're taking 30% of every order. What if you could get those same customers ordering directly from you? That's the difference between breaking even and actually profiting.",'objection',`Margin argument against delivery apps.`,82),
  q('5812','Restaurant','objection',"We survive on word of mouth","Word of mouth is great but it doesn't fill Tuesday nights. Targeted local ads to people within 5 miles on a slow Tuesday -- that fills seats.",'objection',`Targeted solution for specific pain.`,79),
  q('5812','Restaurant','objection',"I don't have the budget","What if the marketing paid for itself in the first week? One targeted promotion that fills 20 extra seats on a slow night at $30 average ticket -- that's $600 in one night.",'objection',`Quick ROI math for restaurants.`,81),
  q('5812','Restaurant','objection',"My food speaks for itself","Your food IS your best marketing. But people need to know about it first. We make sure every amazing dish you serve is showing up on Google, Instagram, and in front of hungry people nearby.",'objection',`Amplify what already works.`,77),
  q('5812','Restaurant','closing',"If we could fill your Tuesday and Wednesday nights with targeted local ads, would that be a game changer?","Yeah, those empty tables are the most expensive thing in the restaurant.",'commitment',`Pain point close.`,84),
  q('5812','Restaurant','closing',"Our restaurant specialist can do a quick competitive analysis -- see how you stack up against nearby restaurants online. Worth 15 minutes?","Sure, I'm curious.",'commitment',``,82),
  q('5812','Restaurant','closing',"What's your email? I'll send the invite.","Send it to marco at bellanapoli dot com.",'commitment',``,79),
  q('5812','Restaurant','rapport',"What inspired you to open a restaurant?","I grew up cooking with my grandmother. It's in my blood.",'acceptance',`Emotional story. Always let them share.`,72),
  q('5812','Restaurant','rapport',"What's your signature dish?","Our handmade pasta. People drive 30 minutes for it.",'acceptance',`Pride point. Content opportunity too.`,71),
  q('5812','Restaurant','discovery',"Do you have an email or text list of your customers?","No, we've never collected that.",'interest',`Bridges to Email + CRM. Huge missed opportunity.`,79),
  q('5812','Restaurant','discovery',"Are you running any promotions for slow periods?","Just the occasional Facebook post but nothing targeted.",'interest',`Bridges to Paid Media + Social.`,76),
  q('5812','Restaurant','discovery',"How much are you paying DoorDash and UberEats in fees per month?","Probably $3-4K in commissions.",'interest',`That spend = direct ordering marketing budget.`,80),
]

const AUTO_REPAIR: QASeed[] = [
  q('7532','Auto Repair','discovery',"How's your car count looking per week?","About 40-50 but we could handle 70.",'interest',`Clear capacity gap.`,77),
  q('7532','Auto Repair','discovery',"Are you competing with the dealerships for service work?","Yeah, they try to keep customers locked in with warranty work.",'interest',`Opens competitive positioning.`,76),
  q('7532','Auto Repair','discovery',"How are your Google reviews?","About 90 reviews, 4.5 stars.",'interest',`Solid. Growth to 200+ would dominate.`,74),
  q('7532','Auto Repair','discovery',"Do you do any fleet or commercial accounts?","A couple small ones but I'd love more.",'interest',`Opens B2B marketing angle.`,75),
  q('7532','Auto Repair','discovery',"When someone searches 'auto repair near me' are they finding you?","I honestly don't know.",'interest',`Opens Local SEO conversation.`,78),
  q('7532','Auto Repair','objection',"My cousin fixes cars -- that is what my competitors hear","Ha, exactly. But when the cousin can't figure it out, they Google. That's when you need to be there.",'objection',`Humor + truth.`,75),
  q('7532','Auto Repair','objection',"We rely on repeat customers","Repeat customers are your foundation. But they eventually sell the car, move, or age out. You always need new customers flowing in.",'objection',`Customer lifecycle reality.`,78),
  q('7532','Auto Repair','objection',"People just go to the cheapest shop","Price shoppers aren't your ideal customer. The people searching Google reviews and comparing quality -- those are your people. We put you in front of them.",'objection',`Quality customer targeting.`,79),
  q('7532','Auto Repair','objection',"We tried a mailer campaign and it flopped","Direct mail is a shotgun. Google Ads is a sniper rifle -- you're reaching people actively searching for auto repair right now, not hoping they need it.",'objection',`Channel comparison.`,80),
  q('7532','Auto Repair','objection',"I don't trust marketing companies","I respect that. That's why our first conversation is a free audit -- we show you exactly what's happening with your online presence and your competitors. No commitment, no sales pitch.",'objection',`Remove risk.`,77),
  q('7532','Auto Repair','closing',"Want to see how you compare to the top shops in your area online?","Yeah, that would be useful.",'commitment',``,83),
  q('7532','Auto Repair','closing',"Tuesday or Thursday work better?","Thursday afternoon.",'commitment',``,80),
  q('7532','Auto Repair','closing',"What email for the invite?","Use the shop email, service at premiumauto dot com.",'commitment',``,79),
  q('7532','Auto Repair','rapport',"How long have you had the shop?","Coming up on 12 years this April.",'acceptance',``,70),
  q('7532','Auto Repair','rapport',"What's the most common job you see?","Brake jobs and oil changes. But the gravy is in diagnostics and engine work.",'acceptance',`Reveals margin structure.`,71),
  q('7532','Auto Repair','discovery',"Do you send service reminders -- oil change due, tire rotation, that kind of thing?","No, we should but we don't have a system for it.",'interest',`Bridges to Email & AI CRM.`,78),
  q('7532','Auto Repair','discovery',"Are you listed on any automotive directories or review sites besides Google?","Just Google I think.",'interest',`Bridges to reputation management across platforms.`,74),
  q('7532','Auto Repair','discovery',"Have you thought about offering any digital inspection reports or vehicle health scores?","No, what's that?",'interest',`Bridges to AI Solutions + Website Dev.`,73),
]

// ═══════════════════════════════════════════════════════════════════════════════
// Internet-Lead-Dependent Industries (abbreviated 12 per industry for size)
// ═══════════════════════════════════════════════════════════════════════════════

const INSURANCE: QASeed[] = [
  q('6411','Insurance Agency','discovery',"How are you generating new policy holders right now?","Mostly referrals and some carrier-provided leads.",'interest',``,77),
  q('6411','Insurance Agency','discovery',"Are you cross-selling across lines -- auto, home, life, commercial?","We try but our closing rate on cross-sells could be better.",'interest',`Bridges to Email automation.`,76),
  q('6411','Insurance Agency','discovery',"What does your online presence look like?","Basic website, a few reviews.",'interest',``,75),
  q('6411','Insurance Agency','objection',"Insurance is all about relationships, not marketing","Absolutely. But how do you start those relationships? When someone Googles 'insurance agent near me,' you need to be the one they find.",'objection',``,80),
  q('6411','Insurance Agency','objection',"Compliance restrictions make marketing hard","We work with insurance agencies specifically and know exactly what's compliant.",'objection',``,79),
  q('6411','Insurance Agency','closing',"Our insurance specialist can show you how to generate policy leads from Google. Worth 15 minutes?","Sure, we're always looking for new channels.",'commitment',``,82),
  q('6411','Insurance Agency','rapport',"How long have you been in the insurance business?","Almost 20 years. Started as a captive agent, went independent 10 years ago.",'acceptance',``,70),
  q('6411','Insurance Agency','discovery',"Do you have any automated nurture sequences for quote requests that don't close?","No, those just kind of fall through the cracks.",'interest',`Bridges to Email & AI CRM.`,79),
  q('6411','Insurance Agency','objection',"The big carriers spend millions on advertising, we can't compete","You don't need to compete nationally. Locally, an independent agent with great reviews and Google visibility beats State Farm every time.",'objection',`Local advantage.`,81),
  q('6411','Insurance Agency','closing',"What email for the calendar invite?","Use our agency email.",'commitment',``,78),
  q('6411','Insurance Agency','discovery',"Are you tracking your quote-to-bind ratio?","Kind of, but not systematically.",'interest',`Bridges to Analytics.`,74),
  q('6411','Insurance Agency','rapport',"What's the best part about being an independent agent?","Freedom to shop for the best rate. I can actually help people instead of pushing one carrier.",'acceptance',``,71),
]

const MORTGAGE: QASeed[] = [
  q('6159','Mortgage','discovery',"How dependent are you on realtor referrals for leads?","Probably 80% of our business comes from realtor partners.",'interest',`Single-source dependency risk.`,80),
  q('6159','Mortgage','discovery',"What's the rate environment doing to your business?","It's brutal. Higher rates mean less refis and nervous buyers.",'interest',`Opens competitive differentiation conversation.`,78),
  q('6159','Mortgage','discovery',"Are you doing anything to generate direct-to-consumer leads?","Not really. We don't have much of an online presence.",'interest',`Huge opportunity in direct lead gen.`,79),
  q('6159','Mortgage','objection',"The market is dead right now","Purchase volume is down but it's not zero. The LOs who are marketing now are capturing 100% of the available business while everyone else waits.",'objection',`Counter-cyclical advantage.`,82),
  q('6159','Mortgage','objection',"All my business comes from realtor referrals","That's great but it makes you dependent on their pipeline. Direct leads give you control. And when you close a direct lead, the realtor owes YOU referrals.",'objection',`Power dynamic shift.`,81),
  q('6159','Mortgage','objection',"Compliance makes mortgage marketing complicated","We specialize in financial services marketing and know RESPA, TILA, and fair lending inside out.",'objection',``,79),
  q('6159','Mortgage','closing',"If we could generate 5-10 direct mortgage leads per month, what would that mean for your business?","That would literally change everything. That's $50K+ in additional commission.",'commitment',`Quantified outcome.`,85),
  q('6159','Mortgage','closing',"Our mortgage marketing specialist can show you what's working in your market. Worth 15 minutes?","Yeah absolutely.",'commitment',``,83),
  q('6159','Mortgage','rapport',"How long have you been in mortgage?","12 years. Survived 2008, survived COVID, we'll survive this.",'acceptance',``,71),
  q('6159','Mortgage','discovery',"Do you have any content helping buyers understand the process?","No, our website is pretty bare.",'interest',`Bridges to Content Marketing. Educational content = trust builder for mortgage.`,77),
  q('6159','Mortgage','discovery',"Are you following up with pre-approvals that haven't found a home yet?","Not systematically.",'interest',`Bridges to Email & AI CRM.`,78),
  q('6159','Mortgage','rapport',"What do you enjoy most about the mortgage business?","Helping first-time buyers. Seeing their face at closing -- that's why I do this.",'acceptance',``,72),
]

const ACCOUNTING: QASeed[] = [
  q('8721','Accounting','discovery',"Is your practice mostly tax prep, bookkeeping, or advisory?","Mostly tax but I want to grow the advisory side.",'interest',`Advisory = higher margin = better marketing ROI.`,78),
  q('8721','Accounting','discovery',"How seasonal is your business?","Very. January to April is chaos, the rest is slower.",'interest',`Opens year-round marketing strategy.`,77),
  q('8721','Accounting','discovery',"How are new clients finding you?","Referrals mostly. A few from Google.",'interest',``,76),
  q('8721','Accounting','objection',"My clients have been with me for 20 years, I don't need marketing","That's amazing loyalty. But those clients retire, sell businesses, move. You need the next generation flowing in.",'objection',`Client lifecycle reality.`,79),
  q('8721','Accounting','objection',"Accounting is a trust business, you can't advertise trust","You're right -- you earn trust. But people need to find you first. When they Google 'accountant near me' and see 100 five-star reviews and helpful content, that IS trust.",'objection',`Digital trust = reviews + content.`,80),
  q('8721','Accounting','closing',"If we could keep new clients flowing in year-round instead of just tax season, would that transform your practice?","That's the dream honestly.",'commitment',``,83),
  q('8721','Accounting','rapport',"How long have you had your practice?","Started my own firm about 15 years ago after Big Four.",'acceptance',``,71),
  q('8721','Accounting','discovery',"Are you doing anything to convert tax-only clients to full advisory clients?","I try to mention it but there's no system.",'interest',`Bridges to Email & CRM for upselling.`,78),
  q('8721','Accounting','objection',"Tax season is so busy I can't even think about marketing","That's exactly why you set it up in May-June. The marketing runs on autopilot so when January hits, new clients are already coming in.",'objection',``,77),
  q('8721','Accounting','closing',"What's your email?","cpa at johnsonaccounting dot com.",'commitment',``,78),
  q('8721','Accounting','discovery',"Do you have any educational content -- tax tips, deduction guides?","No, but I've thought about it.",'interest',`Bridges to Content Marketing. Accountants make great content.`,76),
  q('8721','Accounting','rapport',"What's the most rewarding part of your practice?","Saving a small business owner $50K on their taxes. That look on their face.",'acceptance',``,72),
]

const SOLAR: QASeed[] = [
  q('1731','Solar Installation','discovery',"How are you generating leads right now?","Mix of door-to-door, some Google, and referrals.",'interest',`Door-to-door is expensive. Digital is scalable.`,78),
  q('1731','Solar Installation','discovery',"What's your average system size and price point?","About 8-10kW, $25-30K before incentives.",'interest',`High ticket = easy ROI math.`,76),
  q('1731','Solar Installation','discovery',"How's the competition in your market?","Intense. Sunrun and other national brands are everywhere.",'interest',`Local vs national positioning.`,77),
  q('1731','Solar Installation','objection',"We rent, so solar doesn't apply to most leads","Actually renters aren't your lead -- homeowners are. Google Ads lets you target homeowners specifically with property-based targeting.",'objection',`Targeting precision.`,79),
  q('1731','Solar Installation','objection',"We already got plenty of quotes coming in","How's the quality? Are they pre-qualified homeowners with good credit and roof condition, or tire-kickers?",'objection',`Quality vs quantity.`,78),
  q('1731','Solar Installation','objection',"Solar leads from Google are too expensive","At $30K per install, even a $200 lead with a 5% close rate is $4K per sale. That's a great ROI.",'objection',`Math-based reframe.`,82),
  q('1731','Solar Installation','closing',"If we could deliver qualified homeowner leads at half what door-to-door costs, worth exploring?","Absolutely.",'commitment',``,84),
  q('1731','Solar Installation','closing',"Our solar marketing specialist has the data on what's working in your market. Tuesday or Thursday?","Thursday works.",'commitment',``,82),
  q('1731','Solar Installation','rapport',"What got you into solar?","I believe in clean energy. And the business opportunity is incredible.",'acceptance',``,71),
  q('1731','Solar Installation','discovery',"Do you have any content explaining financing options or payback periods?","Not really, our sales team handles that in person.",'interest',`Bridges to Content Marketing. Pre-educated leads close faster.`,77),
  q('1731','Solar Installation','discovery',"Are you retargeting people who visited your website but didn't request a quote?","No, we don't do any retargeting.",'interest',`Bridges to Paid Media retargeting.`,79),
  q('1731','Solar Installation','rapport',"What's the biggest install you've done?","We did a 50kW commercial system for a warehouse. That was awesome.",'acceptance',``,70),
]

const FITNESS: QASeed[] = [
  q('7991','Fitness/Gym','discovery',"How are you acquiring new members?","Social media and some Google, plus walk-ins.",'interest',``,76),
  q('7991','Fitness/Gym','discovery',"What's your member retention rate?","About 70% annual retention.",'interest',`30% churn = retention marketing opportunity.`,78),
  q('7991','Fitness/Gym','discovery',"Are you competing with Planet Fitness or the $10/month gyms?","Yeah, they're a block away.",'interest',`Value positioning, not price.`,77),
  q('7991','Fitness/Gym','objection',"Our Instagram is our marketing","Instagram is great for awareness but it doesn't close memberships. Google Ads targets people actively searching 'gym near me' right now.",'objection',``,79),
  q('7991','Fitness/Gym','objection',"January is our only busy month","What if you could make every month feel like January? Targeted campaigns around summer body, back to school, new year -- there are triggers all year.",'objection',``,80),
  q('7991','Fitness/Gym','closing',"If we could increase your monthly sign-ups by 40%, what would that mean for revenue?","That would be huge. Probably an extra $15K/month.",'commitment',``,83),
  q('7991','Fitness/Gym','rapport',"What made you open a gym?","I'm passionate about fitness and wanted to build a community.",'acceptance',``,71),
  q('7991','Fitness/Gym','discovery',"Do you send any automated emails to members who haven't visited in 30+ days?","No, we just hope they come back.",'interest',`Bridges to Email & AI CRM for win-back.`,79),
  q('7991','Fitness/Gym','objection',"People just cancel after 3 months anyway","That's a retention problem, not a marketing problem. We can help with both -- get them in AND keep them. Automated check-ins, progress tracking, community building.",'objection',``,78),
  q('7991','Fitness/Gym','discovery',"Are you doing any corporate wellness or group partnerships?","Not really but that would be great.",'interest',`Opens B2B marketing angle.`,75),
  q('7991','Fitness/Gym','closing',"What email for the calendar invite?","Use manager at ironfit dot com.",'commitment',``,78),
  q('7991','Fitness/Gym','rapport',"What's the vibe of your gym -- more hardcore or community?","Definitely community. We're not a meathead gym.",'acceptance',`Positioning clarity for marketing.`,70),
]

const MED_SPA: QASeed[] = [
  q('8099','Medical Spa / Plastic Surgery','discovery',"How are most of your patients finding you?","Instagram, some Google, referrals from happy patients.",'interest',``,78),
  q('8099','Medical Spa / Plastic Surgery','discovery',"What's your consultation-to-treatment conversion rate?","Maybe 40%, I wish it were higher.",'interest',`Opens follow-up nurture conversation.`,79),
  q('8099','Medical Spa / Plastic Surgery','discovery',"Are you running Google Ads? Med spa clicks are $50-200.","We tried but it felt like burning money.",'interest',`Opens qualified lead strategy.`,80),
  q('8099','Medical Spa / Plastic Surgery','objection',"We get most patients from doctor referrals","Referrals are great but are they consistent enough to hit revenue goals every month? Direct-to-consumer adds a predictable second pipeline.",'objection',`Consistency angle.`,81),
  q('8099','Medical Spa / Plastic Surgery','objection',"Instagram is our main marketing channel","Instagram builds awareness but Google closes deals. When someone searches 'Botox near me,' that's a buyer. Instagram users are just scrolling.",'objection',`Intent difference.`,82),
  q('8099','Medical Spa / Plastic Surgery','closing',"Our med spa specialist can show you how to lower your cost-per-consultation while increasing quality. Worth 15 minutes?","Yes, that's exactly what we need.",'commitment',``,84),
  q('8099','Medical Spa / Plastic Surgery','rapport',"What procedures are most popular at your practice?","Botox and fillers are the bread and butter, but body contouring is growing.",'acceptance',``,71),
  q('8099','Medical Spa / Plastic Surgery','discovery',"Do you have a system for following up with consultations that didn't book?","Not really, they just kind of disappear.",'interest',`Bridges to AI CRM + Email nurture. 60% of consults need follow-up.`,81),
  q('8099','Medical Spa / Plastic Surgery','discovery',"Are you doing before-and-after galleries on your website?","Some, but not organized well.",'interest',`Bridges to Website Dev + Creative.`,76),
  q('8099','Medical Spa / Plastic Surgery','objection',"Groupon brings us plenty of patients","Groupon patients are discount shoppers. They come once and never return. Our approach brings high-value patients who become regulars.",'objection',`Patient quality argument.`,80),
  q('8099','Medical Spa / Plastic Surgery','closing',"What's your best email?","drkim at luxemedspa dot com.",'commitment',``,78),
  q('8099','Medical Spa / Plastic Surgery','discovery',"Are you offering any membership or loyalty programs?","No but we've talked about it.",'interest',`Bridges to Email & Retention.`,75),
]

const HOME_SECURITY: QASeed[] = [
  q('7382','Home Security','discovery',"How are you generating new installs -- door-to-door, online, referrals?","Mostly door-to-door and some Angi leads.",'interest',`D2D expensive. Digital scales better.`,78),
  q('7382','Home Security','discovery',"What's your average system value?","About $1,500 for equipment plus $40/month monitoring.",'interest',`LTV calculation for marketing ROI.`,75),
  q('7382','Home Security','objection',"Ring and SimpliSafe are taking over the market","DIY systems are great for basic security. Your customers want professional monitoring, smart integration, and someone who shows up when the alarm goes off. That's a different product.",'objection',`Premium differentiation.`,80),
  q('7382','Home Security','objection',"I already have a system -- most people say that","And most of those systems are 10+ years old with outdated technology. Upgrade marketing is a huge opportunity.",'objection',`Upgrade angle.`,78),
  q('7382','Home Security','closing',"If we could generate install leads at half the cost of door-to-door, worth a conversation?","Definitely. D2D is getting harder every year.",'commitment',``,83),
  q('7382','Home Security','rapport',"How long have you been in the security business?","About 10 years. Started installing systems and built it from there.",'acceptance',``,70),
  q('7382','Home Security','discovery',"Are you marketing to rental properties or property managers?","No but that's a good idea.",'interest',`Opens B2B/property management marketing.`,76),
  q('7382','Home Security','discovery',"Do you have any content about home security tips or smart home integration?","Nothing on our website.",'interest',`Bridges to Content Marketing + SEO.`,77),
  q('7382','Home Security','closing',"What's your email?","mike at safeguardsecurity dot com.",'commitment',``,78),
  q('7382','Home Security','objection',"People aren't buying right now","Actually home security searches spike after local break-ins and during holiday season. We can time your campaigns to those triggers.",'objection',``,79),
  q('7382','Home Security','discovery',"Are you doing anything with smart home or automation packages?","We offer some but don't market them specifically.",'interest',`Higher ticket opportunity.`,75),
  q('7382','Home Security','rapport',"What's the most rewarding part of the business?","Knowing families feel safe because of what we installed.",'acceptance',``,71),
]

const VET: QASeed[] = [
  q('0742','Veterinary Services','discovery',"How are new pet owners finding your practice?","Mostly Google searches and referrals.",'interest',``,77),
  q('0742','Veterinary Services','discovery',"What's your average client lifetime value?","A pet owner with us 10 years probably spends $15-20K.",'interest',`High LTV = marketing math is very favorable.`,80),
  q('0742','Veterinary Services','discovery',"How are your reviews on Google?","About 120 reviews, 4.8 stars.",'interest',`Excellent. Build on this strength.`,74),
  q('0742','Veterinary Services','objection',"We love our current vet -- that's what everyone says","Exactly, and that loyalty is your superpower. The question is, are enough NEW pet owners discovering you? 67% of new pet owners Google before choosing a vet.",'objection',`Acquisition not retention.`,80),
  q('0742','Veterinary Services','objection',"We're already busy enough","Busy is great, but are you seeing the right mix? Emergency and specialty services are higher margin than routine wellness.",'objection',`Margin optimization.`,78),
  q('0742','Veterinary Services','closing',"Pet owners are incredibly loyal -- one Google lead could be worth $15K over a decade. Worth 15 minutes to explore?","When you put it that way, yes.",'commitment',`LTV-based close.`,84),
  q('0742','Veterinary Services','rapport',"What made you become a vet?","I've loved animals since I was a kid. Can't imagine doing anything else.",'acceptance',``,72),
  q('0742','Veterinary Services','discovery',"Do you send any reminders for vaccines, check-ups, or dental cleanings?","We have an old system but it's not great.",'interest',`Bridges to Email & AI CRM.`,78),
  q('0742','Veterinary Services','discovery',"Are you doing any content around pet health -- seasonal allergies, dental care, nutrition?","No, we just don't have time.",'interest',`Bridges to Content + Social. Pet content performs extremely well.`,77),
  q('0742','Veterinary Services','closing',"What email should I send the invite to?","frontdesk at pawsandclaws dot com.",'commitment',``,78),
  q('0742','Veterinary Services','objection',"Vet marketing feels wrong -- it should be about the animals not advertising","100% agree. That's why our approach is educational content and reviews -- it's about helping pet owners make better decisions. That's authentic.",'objection',`Values alignment.`,79),
  q('0742','Veterinary Services','rapport',"What's the most rewarding case you've had?","Saved a puppy that everyone said wouldn't make it. He comes in every year and jumps all over me.",'acceptance',`Emotional connection. Vets love sharing these.`,73),
]

const TUTORING: QASeed[] = [
  q('8299','Tutoring & Test Prep','discovery',"What subjects and levels are you covering?","Mostly SAT/ACT prep and high school math and science.",'interest',``,75),
  q('8299','Tutoring & Test Prep','discovery',"How seasonal is your business?","Very. Back to school and spring testing are busy, summer is dead.",'interest',`Opens year-round marketing strategy.`,78),
  q('8299','Tutoring & Test Prep','discovery',"Are parents finding you online?","Some, but mostly referrals from other parents.",'interest',``,76),
  q('8299','Tutoring & Test Prep','objection',"The school provides free tutoring","Free tutoring is generic. Parents who want results -- the ones worried about college admissions -- they invest in specialized prep. Those are your ideal clients.",'objection',`Premium positioning.`,80),
  q('8299','Tutoring & Test Prep','objection',"Online tutoring is killing us","Online is convenient but it lacks accountability. In-person and small group create better results. Market the outcome, not the method.",'objection',``,78),
  q('8299','Tutoring & Test Prep','closing',"If you could keep enrollment steady year-round, what would that mean for your business?","That would double our revenue honestly.",'commitment',``,83),
  q('8299','Tutoring & Test Prep','rapport',"What got you into tutoring?","I was a teacher for 10 years and saw how much one-on-one attention changed outcomes.",'acceptance',``,71),
  q('8299','Tutoring & Test Prep','discovery',"Do you have any testimonials or results data -- score improvements, college acceptances?","Yeah but we don't really promote it.",'interest',`Bridges to Content + Social proof. Results = best marketing.`,79),
  q('8299','Tutoring & Test Prep','closing',"What's your email?","sarah at eliteprep dot com.",'commitment',``,78),
  q('8299','Tutoring & Test Prep','discovery',"Are you doing anything targeting parents specifically -- school Facebook groups, local parent communities?","Not systematically.",'interest',`Bridges to Social + Paid Media. Parents are the buyer.`,77),
  q('8299','Tutoring & Test Prep','objection',"Parents are price sensitive for tutoring","The parents who care about SAT scores and college admissions will pay premium prices. Don't compete on price, compete on results.",'objection',``,79),
  q('8299','Tutoring & Test Prep','rapport',"What's your best success story?","A student went from a 1200 to a 1480 on the SAT and got into their dream school. That's why I do this.",'acceptance',``,72),
]

const SENIOR_CARE: QASeed[] = [
  q('8082','Senior Care / Home Health','discovery',"How are families finding your services?","Mostly hospital discharge planners and some Google.",'interest',`Opens direct-to-family marketing.`,78),
  q('8082','Senior Care / Home Health','discovery',"What's your biggest challenge right now?","Staffing. And getting consistent referrals.",'interest',`Marketing can help with both -- client acquisition and recruitment.`,80),
  q('8082','Senior Care / Home Health','objection',"We're not ready yet -- most families say that","I hear that a lot. Most families start researching 6-12 months before they actually need care. Being visible during that research phase is critical.",'objection',`Long research cycle = SEO + content.`,81),
  q('8082','Senior Care / Home Health','objection',"Medicare/Medicaid handles everything","Medicare covers skilled nursing but not all home health. The private-pay families searching Google are your highest-value clients.",'objection',`Private-pay targeting.`,79),
  q('8082','Senior Care / Home Health','closing',"If families searching 'home care near me' could find you instead of your competitors, what would that mean?","That would be a constant stream of new clients.",'commitment',``,83),
  q('8082','Senior Care / Home Health','rapport',"What inspired you to get into senior care?","My grandmother needed help and there weren't good options. I wanted to create what didn't exist.",'acceptance',`Deep personal motivation.`,72),
  q('8082','Senior Care / Home Health','discovery',"Do you have any content helping families understand their options?","Not really, our website is pretty basic.",'interest',`Bridges to Content + SEO. Family education content ranks well.`,78),
  q('8082','Senior Care / Home Health','discovery',"Are you marketing to adult children of seniors -- the ones actually making the decision?","We hadn't thought of it that way.",'interest',`Key insight: buyer is not the patient.`,80),
  q('8082','Senior Care / Home Health','closing',"What email for the invite?","director at compassionatecare dot com.",'commitment',``,78),
  q('8082','Senior Care / Home Health','objection',"Our referrals from hospitals are enough","Hospital referrals are valuable but they come with strings -- they send to everyone on the list. Direct leads choose YOU specifically.",'objection',``,79),
  q('8082','Senior Care / Home Health','discovery',"Are your caregivers getting reviewed online?","Occasionally but we don't have a system.",'interest',`Bridges to Reputation Management.`,76),
  q('8082','Senior Care / Home Health','rapport',"What's the most rewarding part?","When a family tells us their mom is happier than she's been in years. That's everything.",'acceptance',``,73),
]

const WEDDING: QASeed[] = [
  q('7221','Wedding Services','discovery',"How far in advance are couples booking you?","Usually 12-18 months out.",'interest',`Long sales cycle = nurture marketing opportunity.`,77),
  q('7221','Wedding Services','discovery',"Where are couples finding you -- The Knot, Instagram, Google?","Mostly Instagram and WeddingWire.",'interest',`Opens owned media vs rented media conversation.`,78),
  q('7221','Wedding Services','objection',"We're already booked for this season","That's amazing. But are you booked for 2027? Starting marketing now fills next year.",'objection',`Forward-looking pipeline.`,80),
  q('7221','Wedding Services','objection',"Instagram is all we need","Instagram is beautiful for weddings. But when a couple searches 'wedding photographer [city]' on Google, are they finding you? That's where booking decisions happen.",'objection',``,79),
  q('7221','Wedding Services','closing',"If we could fill your calendar 18 months out consistently, worth exploring?","That kind of visibility would be incredible.",'commitment',``,83),
  q('7221','Wedding Services','rapport',"What type of weddings do you love working on?","Intimate outdoor ceremonies. Those are magic.",'acceptance',``,71),
  q('7221','Wedding Services','discovery',"Do you have a portfolio or gallery on your website?","Yes but it hasn't been updated in a while.",'interest',`Bridges to Website + Creative.`,75),
  q('7221','Wedding Services','discovery',"Are you listed on all the major wedding directories?","Just WeddingWire and The Knot.",'interest',`Opens multi-platform strategy.`,74),
  q('7221','Wedding Services','closing',"What's your email?","hello at dreambridgeevents dot com.",'commitment',``,78),
  q('7221','Wedding Services','objection',"All my business comes from vendor referrals","Vendor referrals are great. But they only send you overflow. Direct leads choose you as their first choice.",'objection',`First choice vs overflow.`,78),
  q('7221','Wedding Services','discovery',"Are couples finding your reviews easily?","Probably not, we have more on WeddingWire than Google.",'interest',`Google reviews = SEO fuel.`,76),
  q('7221','Wedding Services','rapport',"How long have you been in the wedding industry?","8 years. Started photographing and expanded into full planning.",'acceptance',``,70),
]

const ECOMMERCE: QASeed[] = [
  q('5999','E-Commerce / Online Retail','discovery',"What's your current ROAS looking like?","About 3x on Google Shopping, lower on Meta.",'interest',`ROAS language shows sophistication.`,78),
  q('5999','E-Commerce / Online Retail','discovery',"How are you competing with Amazon?","That's the billion dollar question. We focus on unique products and customer experience.",'interest',``,77),
  q('5999','E-Commerce / Online Retail','discovery',"What's your email list size and how often do you mail it?","About 15K subscribers, we send maybe twice a month.",'interest',`Under-utilized asset. Opens Email & Retention.`,79),
  q('5999','E-Commerce / Online Retail','objection',"We already have an agency handling our ads","How's performance? Most e-comm brands we talk to are leaving money on the table with poor attribution and no post-purchase nurture.",'objection',`Challenge current performance.`,80),
  q('5999','E-Commerce / Online Retail','objection',"Q4 is the only time we invest in marketing","Q4 is when everyone advertises. CPMs are 2-3x higher. Building audience Q1-Q3 means Q4 is just activating warm prospects at lower cost.",'objection',`Counter-seasonal logic.`,82),
  q('5999','E-Commerce / Online Retail','closing',"If we could improve your ROAS by 50% while scaling spend, worth a conversation?","Absolutely.",'commitment',`ROAS language resonates.`,84),
  q('5999','E-Commerce / Online Retail','rapport',"What made you start the brand?","Saw a gap in the market and went for it. Built it from my apartment.",'acceptance',``,71),
  q('5999','E-Commerce / Online Retail','discovery',"What's your post-purchase email flow look like?","Pretty basic, just an order confirmation.",'interest',`Bridges to Email & Retention. Post-purchase = highest ROI emails.`,80),
  q('5999','E-Commerce / Online Retail','closing',"What email?","founder at urbanthread dot com.",'commitment',``,78),
  q('5999','E-Commerce / Online Retail','discovery',"Are you running any retargeting for cart abandoners?","Basic stuff but nothing sophisticated.",'interest',`Bridges to Paid Media + Email automation.`,79),
  q('5999','E-Commerce / Online Retail','objection',"Our margins are too thin for marketing","Marketing should increase margin by increasing volume and reducing CAC. If you're spending $20 to acquire a customer worth $100, the math works.",'objection',``,80),
  q('5999','E-Commerce / Online Retail','rapport',"What's your best-selling product?","Our signature collection does 40% of revenue.",'acceptance',``,70),
]

const FINANCIAL_ADVISOR: QASeed[] = [
  q('6282','Financial Advisor','discovery',"How are you acquiring new clients right now?","Almost exclusively referrals and networking events.",'interest',`Single-channel dependency.`,78),
  q('6282','Financial Advisor','discovery',"What's your AUM and where would you like it to be?","About $50M, targeting $100M in 3 years.",'interest',`Clear growth target to anchor marketing ROI.`,80),
  q('6282','Financial Advisor','discovery',"Do you have a niche -- business owners, doctors, retirees?","Not really, we take anyone.",'interest',`Niche = better marketing. Generalist = invisible.`,76),
  q('6282','Financial Advisor','objection',"I don't need more clients, I need bigger clients","Exactly -- and bigger clients do more research online before choosing an advisor. They check your LinkedIn, website, reviews, and thought leadership. We build that presence.",'objection',`Premium client acquisition strategy.`,83),
  q('6282','Financial Advisor','objection',"SEC and FINRA compliance makes marketing impossible","It adds guardrails, not roadblocks. We work with RIAs specifically and know exactly what's compliant -- educational content, testimonials (post-2020 rules), even social media.",'objection',`Regulatory expertise.`,81),
  q('6282','Financial Advisor','objection',"Clients come from referrals only in this business","Referrals are the foundation. But what happens when someone gets referred and then Googles you? If they find nothing, that referral just died.",'objection',`Digital validation of referrals.`,82),
  q('6282','Financial Advisor','closing',"If we could position you as THE advisor for [niche] in your market, what would that do for AUM growth?","That would accelerate everything.",'commitment',`Niche authority positioning.`,84),
  q('6282','Financial Advisor','closing',"Our financial services specialist can map out a compliant growth strategy. Worth 15 minutes?","Yes, if it's compliance-aware, I'm interested.",'commitment',``,83),
  q('6282','Financial Advisor','rapport',"What drew you to financial planning?","I love helping people achieve financial freedom. Seeing a client retire comfortably is the best feeling.",'acceptance',``,71),
  q('6282','Financial Advisor','discovery',"Are you publishing any thought leadership -- blog posts, market commentary, guides?","I've thought about it but compliance review slows everything down.",'interest',`Bridges to Content Marketing. We handle compliance review.`,78),
  q('6282','Financial Advisor','closing',"What's your email?","advisor at wealthpath dot com.",'commitment',``,78),
  q('6282','Financial Advisor','discovery',"How are you using LinkedIn?","I post sometimes but nothing strategic.",'interest',`Bridges to Social Marketing. LinkedIn is #1 channel for advisors.`,77),
]

const ADDICTION: QASeed[] = [
  q('8093','Addiction Treatment','discovery',"How are families finding your facility?","Referrals from therapists and some Google, but it's tough with the ad restrictions.",'interest',`Google restrictions = need SEO + content strategy.`,80),
  q('8093','Addiction Treatment','discovery',"What's your census looking like -- beds filled versus capacity?","We're at about 70% occupancy. I need to be at 90%.",'interest',`Clear capacity gap.`,79),
  q('8093','Addiction Treatment','discovery',"Are you doing any content around recovery resources, family support, or insurance guidance?","Not really. Our website has basic info.",'interest',`Bridges to Content + SEO. Educational content bypasses ad restrictions.`,81),
  q('8093','Addiction Treatment','objection',"We only take referrals -- advertising feels wrong for treatment","I completely understand that sensitivity. Our approach isn't advertising -- it's making sure families who are desperately searching for help at 3am can find you. That's a compassion mission.",'objection',`Reframe as serving families, not selling. Compassion-first.`,85),
  q('8093','Addiction Treatment','objection',"Google restricts addiction treatment advertising","They do for paid ads, which is exactly why SEO and content are so critical. When a family searches 'alcohol rehab near me,' the organic results are all they see.",'objection',`Restriction = SEO advantage.`,82),
  q('8093','Addiction Treatment','objection',"HIPAA makes this complicated","We work with healthcare facilities specifically and everything we do is HIPAA-compliant. No patient information, no identifying details. Just visibility for families who need you.",'objection',`Compliance expertise.`,80),
  q('8093','Addiction Treatment','closing',"If families searching for help could find your facility first, how many more lives could you impact?","That's what keeps me up at night. Every empty bed is a family we couldn't help.",'commitment',`Mission-driven close. Never transactional for treatment.`,86),
  q('8093','Addiction Treatment','closing',"Our healthcare specialist understands the sensitivity and compliance requirements. Worth 15 minutes?","If they understand this space, yes.",'commitment',``,83),
  q('8093','Addiction Treatment','rapport',"What inspired you to get into addiction treatment?","I'm in recovery myself. I wanted to create the program I wish I'd had.",'acceptance',`Deeply personal. Handle with care and respect.`,74),
  q('8093','Addiction Treatment','discovery',"Are families able to verify insurance on your website?","No, they have to call.",'interest',`Bridges to Website Dev. Insurance verification = major conversion driver.`,79),
  q('8093','Addiction Treatment','closing',"What's the best email?","admissions at newdaycenter dot com.",'commitment',``,78),
  q('8093','Addiction Treatment','discovery',"Do you have any family resources or support content on your site?","Very little.",'interest',`Bridges to Content. Families are the actual buyers.`,80),
]

const LANDSCAPING: QASeed[] = [
  q('0781','Landscaping','discovery',"Is your business mostly maintenance contracts or one-time projects?","Mix, but I want more recurring contracts.",'interest',`Recurring = predictable revenue. Marketing can fill that.`,77),
  q('0781','Landscaping','discovery',"How seasonal is your work?","Very. Spring through fall is go time, winter is dead.",'interest',`Opens year-round marketing and snow removal conversation.`,76),
  q('0781','Landscaping','discovery',"How are customers finding you?","Lawn signs, word of mouth, some Thumbtack.",'interest',``,75),
  q('0781','Landscaping','objection',"We DIY our marketing -- lawn signs work fine","Lawn signs are great for the neighbors. But when someone new moves to the area and Googles 'landscaper near me,' you need to be there too.",'objection',`Reach beyond physical proximity.`,78),
  q('0781','Landscaping','objection',"People are so price sensitive for lawn care","Price shoppers aren't your target. The homeowners searching for landscape design, outdoor living, and property maintenance -- those are premium clients.",'objection',`Move up-market.`,79),
  q('0781','Landscaping','closing',"If we could fill your spring schedule before March, would that change your year?","That's the dream. Usually I'm scrambling in April.",'commitment',`Seasonal pipeline close.`,83),
  q('0781','Landscaping','rapport',"How long have you been in landscaping?","About 15 years. Started mowing lawns in high school and never stopped.",'acceptance',``,70),
  q('0781','Landscaping','discovery',"Do you have before-and-after photos of your work?","Tons on my phone but not online.",'interest',`Bridges to Website + Social + Creative.`,77),
  q('0781','Landscaping','closing',"What's your email?","tom at greenscapepro dot com.",'commitment',``,78),
  q('0781','Landscaping','discovery',"Do you have a system for upselling maintenance contracts after a project?","Not really, we just mention it.",'interest',`Bridges to Email & CRM for automated follow-up.`,78),
  q('0781','Landscaping','objection',"Thumbtack gets us enough leads","Thumbtack leads are shared with 5 other companies. Google leads are exclusive to you. And you own the relationship forever.",'objection',`Owned vs rented leads.`,80),
  q('0781','Landscaping','rapport',"What's your favorite type of project?","Full property transformations. Taking a neglected yard and making it beautiful.",'acceptance',``,71),
]

// ═══════════════════════════════════════════════════════════════════════════════
// COMBINED EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export const EXPERT_QA_SEEDS: QASeed[] = [
  ...PLUMBING,
  ...HVAC,
  ...ROOFING,
  ...DENTAL,
  ...MEDICAL,
  ...CHIRO,
  ...LEGAL,
  ...REAL_ESTATE,
  ...RESTAURANT,
  ...AUTO_REPAIR,
  ...INSURANCE,
  ...MORTGAGE,
  ...ACCOUNTING,
  ...SOLAR,
  ...FITNESS,
  ...MED_SPA,
  ...HOME_SECURITY,
  ...VET,
  ...TUTORING,
  ...SENIOR_CARE,
  ...WEDDING,
  ...ECOMMERCE,
  ...FINANCIAL_ADVISOR,
  ...ADDICTION,
  ...LANDSCAPING,
]

export const INDUSTRY_COUNTS = EXPERT_QA_SEEDS.reduce((acc, seed) => {
  acc[seed.industry_name] = (acc[seed.industry_name] || 0) + 1
  return acc
}, {} as Record<string, number>)
