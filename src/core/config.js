// Configuration publique de l'application.
// La clé « anon » Supabase est publique par conception (protégée par les Row Level
// Security policies côté base) : elle a toujours vécu dans le front. Les secrets réels
// (IA, Stripe, push) restent côté fonctions serverless api/.
export const SUPABASE_URL = 'https://cozidiruigjtfzgzvjhe.supabase.co';
export const SUPABASE_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvemlkaXJ1aWdqdGZ6Z3p2amhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3MzMwNjQsImV4cCI6MjA5NjMwOTA2NH0.BmVSbWAt9HAXlntY9TdgCcxlLoUNFt9zKe6QQ0VV_eg';
