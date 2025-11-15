// -----------------------------------------------------------------------------
// @file: docs/Brandbite-Engineering-Rules.md
// @purpose: Persistent engineering rules for Brandbite: document header standard, file delivery rules, commit policy and role assignment
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-15
// -----------------------------------------------------------------------------

# Brandbite — Engineering Rules (persistent)

Bu doküman Brandbite proje kurallarını içerir. Tüm ekip üyeleri ve otomasyonlar bu kurallara uymalıdır.

## 1. Rol tanımı
- Assistant (AI) ve proje bakımcısı rolü: Assistant, Brandbite'ın **Senior Software Engineer**'ıdır ve proje yapısını düzenler / üretir. Assistant yapılanma, kod ve dokümantasyonu bu sorumlulukla sağlar.

## 2. Dosya / Doküman header etiketi standardı
Her proje dosyasının/ dokümanın en üstünde aşağıdaki biçimde bir header etiketi bulunmalıdır:

// -----------------------------------------------------------------------------
// @file: <repo-path/of-file>
// @purpose: <Dosyanın kısa açıklaması>
// @version: vX.Y.Z
// @status: active|passive
// @lastUpdate: YYYY-MM-DD
// -----------------------------------------------------------------------------

Örnek:
// -----------------------------------------------------------------------------
// @file: app/admin/plan-assignment/page.tsx
// @purpose: Admin-facing UI to assign subscription plans to companies
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-15
// -----------------------------------------------------------------------------


## 3. Dosya teslim prensibi
- **Tam dosya teslimi:** Herhangi bir dosya değişikliğini patch/yama (diff) değil, **her zaman tam dosya** şeklinde teslim edin. Bu, teknik olmayan kişilerin (örn. proje yöneticileri) dosyaları doğrudan kopyalayıp yerlerine koyabilmelerini sağlar.
- **Incremental & merge-safe:** Verilen yeni dosyalar mevcut repo yapısına zarar vermeyecek şekilde düzenlenmelidir — yani eskilerini kaybetmeden güncelleme mümkün olmalıdır. Dosya içindeki değişiklikler açıklayıcı bir header veya dosya içinde açıklama ile belirtilmeli.

## 4. Commit / Push kuralı
- Her yapılan değişiklik sonrası commit alınmalı ve GitHub’a push edilmelidir.
- Commit mesajları Conventional Commits stilinde olmalı (ör. `feat: add admin ledger UI`, `fix: verify token idempotency in token-engine`).
- PR’lar açılmadan önce yerel olarak `lint`/`build` çalıştırılmalı ve mümkünse testler geçmelidir.
- PR açıklaması “what / why / how” açıklaması içermeli ve en az bir reviewer atanmalıdır.

## 5. Uygulama
- Assistant (AI) bu kurallara uyarak tüm yeni dosya içeriklerini oluşturacaktır.
- Kurallar repo'ya eklendiği takdirde, tüm yeni PR’lar ve dosya oluşturma iş akışları bu dokümana referans verecektir.

## 6. Güncelleme
- Bu kural seti değiştirildiğinde `@version` artırılmalı ve `@lastUpdate` alanı güncellenmelidir.
