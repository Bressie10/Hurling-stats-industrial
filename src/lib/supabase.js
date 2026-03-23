import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://kszidkfsvszhglufpcwq.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtzemlka2ZzdnN6aGdsdWZwY3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMTc1MDcsImV4cCI6MjA4OTc5MzUwN30.WJVO6IaMDGYmorYWy4I3P59CkFTR7SgdYtxPErNq284'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)