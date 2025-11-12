# Brandbite 🧠

**Design Subscription Portal** built with **Next.js 14**, **Neon Postgres**, and **BetterAuth**.

## 🧩 Tech Stack
- Next.js (App Router, TypeScript)
- Prisma + Neon Postgres
- BetterAuth (replacing Clerk)
- TailwindCSS + shadcn/ui + Framer Motion
- Resend (emails)
- Recharts (Admin analytics)

## 🧱 Project Structure
- `/app` → Pages & routes  
- `/components` → Shared UI components  
- `/lib` → Core logic (auth, roles, guards)  
- `/prisma` → DB schema  
- `/scripts` → Token reset, seeding, etc.

## 🪙 Token System
Customers purchase tokens via plan tiers:
- **Basic:** 100 tokens
- **Pro:** 200 tokens
- **Full:** 400 tokens  

Each design job consumes tokens based on type.  
Designers earn tokens upon completion → withdraw via admin approval.

## 🔐 Roles
- **SiteOwner / SiteAdmin:** Manage plans, users, ledger
- **Designer:** View assigned tasks, withdraw tokens
- **Customer:** Create & manage tasks, track tokens

## 📊 Roadmap
See all open tasks and milestones in  
➡️ [View Full Roadmap →](https://github.com/users/brandbite/projects/1)

---

© 2025 Brandbite. All rights reserved.