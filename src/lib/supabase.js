import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://syikhsgovqogzkmmhuis.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5aWtoc2dvdnFvZ3prbW1odWlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyOTk0MjEsImV4cCI6MjA5MDg3NTQyMX0.wL5b1Udyv8nSPqwX-Au9FejwTGY0X2gdAcMmMFrD7LM'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
