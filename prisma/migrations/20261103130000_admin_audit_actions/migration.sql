-- Audit coverage for two admin actions that weren't logged: global settings
-- changes (/admin/settings) and turning off authenticator MFA. Enum values
-- only; no data changes.
ALTER TYPE "AdminActionType" ADD VALUE 'APP_SETTING_EDIT';
ALTER TYPE "AdminActionType" ADD VALUE 'ADMIN_MFA_DISABLE';
