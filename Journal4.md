---
layout: default
title: "Journal #4, Three Weeks In"
---

# Journal #4, Three Weeks In

## 4-30-26

### Where I'm at

It has been about three weeks since Spring Break and I have spent most of that time on **Webb Sports Hub**. Last journal I said I wanted to actually finish this thing so it could be useful to students next year, and I am still locked in on that. The site is live at [webb-athletics-hub.vercel.app](https://webb-athletics-hub.vercel.app) and the code is on [GitHub](https://github.com/kfidak13/team-schedule-hub).

### What got built

Coming back from Florida, I had a long list of things I wanted to add. Here is what I actually shipped:

- **Auth / user accounts with Supabase.** This was the first big jump. Before this, the app was just a static schedule. Now each user signs in, has their own profile, and the site can actually know who is looking at it. Setting up Supabase was honestly less scary than I thought it would be. The part that took the most time was the database side (rows, policies, who is allowed to read what).
- **Real-time chat.** This is the feature I am most proud of. I wrote a SQL migration (`supabase_chat_migration.sql` is in the repo) and used Supabase's realtime channels so messages show up without needing to refresh. Watching a message appear on a second tab the first time it actually worked was probably the best moment of the last three weeks.
- **Personal stats / data tracking.** Users can now keep track of their own stats inside the app instead of it being a one-way information dump. This is what turned it from "schedule website" into something closer to a hub.
- **A bunch of UI polish and refactoring.** Honestly, a lot of the three weeks was unglamorous stuff. Fixing layout bugs, cleaning up components, making the dashboard not look like a wall of cards. Worth it but does not show up in commit messages in a fun way.

### Tech stack notes (for future me)

- **Editor / AI pair:** Windsurf, with Claude as the model. Most of the code in this project was written by me prompting Claude inside Windsurf, then reading what it produced, fixing what was wrong, and iterating. I want to be honest about that because it is a big part of how this got built in three weeks. The skill I am actually building is not "typing every line myself," it is knowing what to ask for, knowing when the output is wrong, and knowing how the pieces fit together. That has gotten noticeably better over these three weeks.
- Frontend: Vite + React + TypeScript, styled with Tailwind and shadcn/ui components.
- Backend: Supabase for auth, database, and realtime.
- Deploy: Vercel for the web app, with Netlify functions handling some side stuff.
- Mobile wrappers: Capacitor is set up for iOS and Android in the repo, but I have not pushed those yet. That is a "later" thing.

### What I learned the hard way

The biggest thing is that **Supabase Row Level Security policies will silently break your app** if you get them wrong. I spent a full afternoon thinking my chat was broken because messages were not loading, and the actual problem was that my RLS policy was blocking the read. The fix was small but finding it was rough. Lesson: when something is silently failing, check policies before checking code.

The other thing I learned is that "small" features are not small. Adding stats tracking sounds simple, just a form and a table, but it touches auth, database, validation, UI, and state management all at once. Anything that involves user data is at least three times bigger than it looks on paper.

### What's coming

USC visit is **Wednesday, May 13**. Here is what I am planning to have ready to share:

1. The **live demo** of Webb Sports Hub with auth, chat, and stats all working end-to-end.
2. A walkthrough of the **Supabase setup** since that was the biggest technical jump for me.
3. The **redesigned version of this very portfolio site** so my project actually has a home that looks good.

The thing I most want feedback on at USC is honestly **how to keep all of this manageable**. Right now I am holding two big things, the Sports Hub app and this portfolio site, and I can feel that if I add one more major project I will start dropping plates. I want to ask people who have shipped real software how they decide what to cut, what to ship as "good enough," and what is worth polishing further.

### Recalibrated goals (next ~2 weeks until USC)

- **Must-do before May 13:** clean up the Vercel link references (the dashboard URL I had in my head was wrong, it is `webb-athletics-hub` not `webb-athletics`), make sure auth + chat + stats all work in a fresh browser, and ship the new portfolio UI.
- **Should-do:** rotate any keys in `.env` and make sure secrets are not in the repo (this is the kind of thing I do not want to learn the hard way at a public-facing demo).
- **Nice-to-have:** start the iOS/Android build via Capacitor so I can at least show one screenshot of it on a phone.
- **Will not do before May 13:** LifeTrack. I am parking it. It is too big to do justice in two weeks while also finishing Sports Hub, and I would rather ship one project well than two projects halfway.

### Honest reflection

I came back from Florida thinking three weeks was a lot of time. It is not. Three weeks is roughly one solid feature, the bugs that feature creates, and one round of polish. Going forward I am going to scope tighter and finish faster.
