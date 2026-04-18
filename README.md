<!--
@file: README.md
@purpose: Brandbite design subscription portal overview & tech stack
@version: v1.1.0
@lastUpdate: 2025-11-13
-->

# Brandbite 🧠

**Design Subscription Portal** built with **Next.js 14**, **Neon Postgres**, and **BetterAuth**.

Brandbite, şirketlerin “abonelikle tasarım” taleplerini yönetebildiği,
token tabanlı bir iş akışı sunar: müşteriler token satın alır, tasarım
istekleri (ticket’lar) oluşturur, tasarımcılar işleri tamamladıkça token kazanır
ve admin paneli üzerinden ödeme/çekim akışı yönetilir.

---

## 🧩 Tech Stack

- **Next.js 14** (App Router, TypeScript)
- **Prisma** + **Neon Postgres**
- **BetterAuth** (auth provider, Clerk yerine)
- **TailwindCSS** + **shadcn/ui** + **Framer Motion**
- **Resend** (email gönderimi)
- **Recharts** (Admin analytics)
- Build toolchain:
  - Prisma migrate + Prisma Client
  - CI Workflow (planlanmış)
  - Vercel deploy (planlanmış)

---

## 🧱 Project Structure

> Klasör yapısı, projedeki ana katmanları gösterir. Detaylar geliştikçe güncellenecek.

- `/app` → Next.js App Router sayfaları & route segment’leri
- `/components` → Shared UI bileşenleri (Board layout, token panelleri, vb.)
- `/lib` → Core logic (auth, roles, guards, token engine)
  - `lib/token-engine.ts` → şirket ve designer bazlı token hareketleri için servis katmanı
- `/prisma` → DB şeması ve migration’lar
- `/scripts` → Token reset, seeding, bakım script’leri (planlı)

---

## 🪙 Token System

Token sistemi hem **müşteri (Company)** hem de **tasarımcı (UserAccount)** tarafını kapsar.

### Planlar

Müşteriler planlar üzerinden aylık token alır:

- **Basic** → 100 tokens
- **Pro** → 200 tokens
- **Full** → 400 tokens

Bu değerler, admin panelinden (SiteOwner / SiteAdmin) değiştirilebilir olacak şekilde
`Plan` modeli üzerinden yönetilir.

### Ledger

Her token hareketi, `TokenLedger` tablosuna bir kayıt olarak düşer:

- `direction` → `CREDIT` (ekleme) / `DEBIT` (düşme)
- `amount` → ham token miktarı (daima pozitif)
- `reason` → kısa kod (örn: `PLAN_PURCHASE`, `JOB_PAYMENT`, `WITHDRAW`)
- `notes` → insan tarafından okunabilir açıklama
- `metadata` (JSON) → provider ID, dış sistem referansları vb.
- `balanceBefore` / `balanceAfter` → hareket öncesi/sonrası bakiye snapshot’ları

Şu an için:

- `Company.tokenBalance` → müşteri tarafındaki cache alanı
- Gerçek kaynak → `TokenLedger` kayıtları (istatistik & audit için)

---

## 🔐 Roles

Uygulamadaki ana roller:

- **SiteOwner / SiteAdmin**
  - Plan yönetimi (Basic / Pro / Full vb.)
  - Şirketler & üyeler
  - Ledger ve token hareketleri
  - Designer withdraw isteklerini onaylama / reddetme / ödeme işaretleme

- **Designer**
  - Kendisine atanan ticket’ları görür
  - İş tamamladıkça token kazanır (designer ledger)
  - Withdraw talebi oluşturur (token → ödeme)

- **Customer**
  - Şirket hesabı üzerinden ticket oluşturur
  - Planına göre token tüketir
  - Projelerini ve ticket durumlarını board’dan takip eder

Roller hem auth katmanında (BetterAuth) hem de Prisma modelleri üzerinde (`UserAccount.role`, `CompanyMember.roleInCompany`) temsil edilir.

---

## 📊 Roadmap & GitHub Project

Tüm açık task’ler, milestone’lar ve feature başlıkları için GitHub Project kullanılır:

➡️ **Full Roadmap**: [Brandbite Project Board](https://github.com/users/brandbite/projects/1)

Board’da tipik başlıklar:

- Infra (Prisma Schema, Env Template, CI, Vercel Config)
- API (Auth Webhook, Admin Ledger, Customer Tickets, Designer Payout, vb.)
- Shared UI (Board layout, card & column bileşenleri)
- Customer / Designer / Admin panelleri
- Token Analytics ve Withdraw sistemi

Geliştirme akışında:

- Bir task üzerinde çalışmaya başlarken “Todo → In Progress”
- Tamamlandığında “In Progress → Done”
- README ve core infra işleri şu anda büyük oranda tamamlanmış durumda.

---

## ✅ Current Status (2025-11-13 itibarıyla)

Tamamlanan ana parçalar:

- Next.js + TypeScript + App Router setup
- Prisma kuruldu, `schema.prisma` yazıldı
- İlk migration (`init`) ve ek migration’lar (`enrich_token_ledger_and_withdrawals`) çalıştırıldı
- Neon Postgres DB ile sync sağlandı
- Token & withdrawal modelleri:
  - `Plan`, `JobType`, `TokenLedger`, `Withdrawal`, `Ticket`, `Company`, `UserAccount`, `CompanyMember`
- Temel proje README’i (bu dosya)

Sırada olanlar (Roadmap’e göre):

- Env template’in finalize edilmesi ve CI + Vercel config’lerinin tamamlanması
- Token engine’in API endpoints ile bağlanması
- Customer / Designer / Admin panellerinin arayüzleri ve akışları
- Token analytics görünümü (Admin dashboard, Recharts ile)

---

© 2025 Brandbite. All rights reserved.
