import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const { data: platformUser } = await adminClient
      .from('platform_users')
      .select('platform_role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!platformUser || !['platform_admin', 'company_admin'].includes(platformUser.platform_role || '')) {
      return new Response(JSON.stringify({ error: 'Forbidden: Admin only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Use raw SQL via Supabase REST API with service role
    const dbUrl = Deno.env.get('SUPABASE_DB_URL')
      || `postgresql://postgres.${supabaseUrl.replace('https://', '').replace('.supabase.co', '')}:5432/postgres`

    // Helper: run SQL query via supabase rpc or pg
    async function runSQL(sql: string): Promise<any[]> {
      // Use the PostgREST RPC approach - create a temp function
      const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
          'Content-Type': 'application/json',
        },
      })
      // Fallback: use information_schema via PostgREST
      return []
    }

    // Query schema info via PostgREST views
    const schemaData: Record<string, any> = {}

    // 1. Extensions
    const extResp = await fetch(
      `${supabaseUrl}/rest/v1/rpc/get_extensions_list`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
          'Content-Type': 'application/json',
        },
        body: '{}',
      }
    )

    // Since we can't run arbitrary SQL via PostgREST, we'll use a different approach:
    // Query information_schema tables which ARE accessible via PostgREST

    // Use direct pg connection via Deno
    // Import postgres driver
    const { default: postgres } = await import('https://deno.land/x/postgresjs@v3.4.4/mod.js')

    const databaseUrl = Deno.env.get('SUPABASE_DB_URL')!
    const sql = postgres(databaseUrl, { max: 1 })

    try {
      // 1. Extensions
      const extensions = await sql`
        SELECT extname, extversion, extnamespace::regnamespace::text as schema
        FROM pg_extension
        WHERE extname NOT IN ('plpgsql')
        ORDER BY extname
      `
      schemaData.extensions = extensions

      // 2. Enums
      const enums = await sql`
        SELECT t.typname as enum_name, 
               n.nspname as schema,
               array_agg(e.enumlabel ORDER BY e.enumsortorder) as values
        FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid
        JOIN pg_namespace n ON t.typnamespace = n.oid
        WHERE n.nspname = 'public'
        GROUP BY t.typname, n.nspname
        ORDER BY t.typname
      `
      schemaData.enums = enums

      // 3. Tables with columns
      const tables = await sql`
        SELECT c.table_name, c.column_name, c.data_type, c.udt_name,
               c.column_default, c.is_nullable, c.character_maximum_length,
               c.numeric_precision, c.numeric_scale
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
        ORDER BY c.table_name, c.ordinal_position
      `
      schemaData.table_columns = tables

      // 4. Primary keys
      const pkeys = await sql`
        SELECT tc.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name 
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
        ORDER BY tc.table_name
      `
      schemaData.primary_keys = pkeys

      // 5. Foreign keys
      const fkeys = await sql`
        SELECT tc.table_name, kcu.column_name,
               ccu.table_schema AS foreign_table_schema,
               ccu.table_name AS foreign_table_name,
               ccu.column_name AS foreign_column_name,
               rc.delete_rule, rc.update_rule
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
        JOIN information_schema.referential_constraints rc
          ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
        ORDER BY tc.table_name, kcu.column_name
      `
      schemaData.foreign_keys = fkeys

      // 6. Unique constraints
      const uniques = await sql`
        SELECT tc.table_name, tc.constraint_name,
               array_agg(kcu.column_name ORDER BY kcu.ordinal_position) as columns
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'UNIQUE' AND tc.table_schema = 'public'
        GROUP BY tc.table_name, tc.constraint_name
        ORDER BY tc.table_name
      `
      schemaData.unique_constraints = uniques

      // 7. Indexes
      const indexes = await sql`
        SELECT indexname, tablename, indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
        ORDER BY tablename, indexname
      `
      schemaData.indexes = indexes

      // 8. Functions
      const functions = await sql`
        SELECT p.proname as function_name,
               pg_get_functiondef(p.oid) as definition,
               p.prosecdef as security_definer
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.prokind IN ('f', 'p')
        ORDER BY p.proname
      `
      schemaData.functions = functions

      // 9. Triggers
      const triggers = await sql`
        SELECT trigger_name, event_manipulation, event_object_table,
               action_statement, action_timing, action_orientation
        FROM information_schema.triggers
        WHERE trigger_schema = 'public'
        ORDER BY event_object_table, trigger_name
      `
      schemaData.triggers = triggers

      // 10. RLS policies
      const policies = await sql`
        SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
        FROM pg_policies
        WHERE schemaname = 'public'
        ORDER BY tablename, policyname
      `
      schemaData.rls_policies = policies

      // 11. RLS status per table
      const rlsStatus = await sql`
        SELECT relname as table_name, relrowsecurity as rls_enabled, relforcerowsecurity as rls_forced
        FROM pg_class c
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = 'public' AND c.relkind = 'r'
        ORDER BY relname
      `
      schemaData.rls_status = rlsStatus

      // 12. Views
      const views = await sql`
        SELECT table_name as view_name, view_definition
        FROM information_schema.views
        WHERE table_schema = 'public'
        ORDER BY table_name
      `
      schemaData.views = views

      // 13. Sequences
      const sequences = await sql`
        SELECT sequence_name, data_type, start_value, minimum_value, maximum_value, increment
        FROM information_schema.sequences
        WHERE sequence_schema = 'public'
        ORDER BY sequence_name
      `
      schemaData.sequences = sequences

      // 14. Storage buckets config
      const buckets = await sql`
        SELECT id, name, public, file_size_limit, allowed_mime_types
        FROM storage.buckets
        ORDER BY name
      `
      schemaData.storage_buckets = buckets

      // 15. Storage policies
      const storagePolicies = await sql`
        SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
        FROM pg_policies
        WHERE schemaname = 'storage'
        ORDER BY tablename, policyname
      `
      schemaData.storage_policies = storagePolicies

      // 16. Realtime publications
      const publications = await sql`
        SELECT p.pubname, pt.schemaname, pt.tablename
        FROM pg_publication p
        LEFT JOIN pg_publication_tables pt ON p.pubname = pt.pubname
        WHERE p.pubname = 'supabase_realtime'
        ORDER BY pt.tablename
      `
      schemaData.realtime_publications = publications

      // 17. Check constraints
      const checks = await sql`
        SELECT tc.table_name, tc.constraint_name, cc.check_clause
        FROM information_schema.table_constraints tc
        JOIN information_schema.check_constraints cc 
          ON tc.constraint_name = cc.constraint_name AND tc.constraint_schema = cc.constraint_schema
        WHERE tc.table_schema = 'public' AND tc.constraint_type = 'CHECK'
          AND tc.constraint_name NOT LIKE '%_not_null'
        ORDER BY tc.table_name
      `
      schemaData.check_constraints = checks

    } finally {
      await sql.end()
    }

    // Generate SQL migration script
    let migrationSQL = '-- =============================================\n'
    migrationSQL += '-- Full Schema Export for Self-Hosting Migration\n'
    migrationSQL += `-- Exported at: ${new Date().toISOString()}\n`
    migrationSQL += `-- Exported by: ${user.email}\n`
    migrationSQL += '-- =============================================\n\n'

    // Extensions
    migrationSQL += '-- ===== EXTENSIONS =====\n'
    for (const ext of schemaData.extensions || []) {
      migrationSQL += `CREATE EXTENSION IF NOT EXISTS "${ext.extname}" WITH SCHEMA ${ext.schema};\n`
    }
    migrationSQL += '\n'

    // Enums
    migrationSQL += '-- ===== ENUMS =====\n'
    for (const en of schemaData.enums || []) {
      const vals = en.values.map((v: string) => `'${v}'`).join(', ')
      migrationSQL += `DO $$ BEGIN CREATE TYPE public.${en.enum_name} AS ENUM (${vals}); EXCEPTION WHEN duplicate_object THEN null; END $$;\n`
    }
    migrationSQL += '\n'

    // Tables
    migrationSQL += '-- ===== TABLES =====\n'
    const tableMap = new Map<string, any[]>()
    for (const col of schemaData.table_columns || []) {
      if (!tableMap.has(col.table_name)) tableMap.set(col.table_name, [])
      tableMap.get(col.table_name)!.push(col)
    }
    const pkMap = new Map<string, string[]>()
    for (const pk of schemaData.primary_keys || []) {
      if (!pkMap.has(pk.table_name)) pkMap.set(pk.table_name, [])
      pkMap.get(pk.table_name)!.push(pk.column_name)
    }

    for (const [tableName, columns] of tableMap) {
      migrationSQL += `CREATE TABLE IF NOT EXISTS public.${tableName} (\n`
      const colDefs: string[] = []
      for (const col of columns) {
        let colType = col.udt_name
        if (col.data_type === 'ARRAY') colType = col.udt_name.replace(/^_/, '') + '[]'
        else if (col.data_type === 'USER-DEFINED') colType = `public.${col.udt_name}`
        else if (col.character_maximum_length) colType = `${col.data_type}(${col.character_maximum_length})`
        else colType = col.data_type === 'character varying' ? 'text' : col.udt_name

        let def = `  ${col.column_name} ${colType}`
        if (col.column_default) def += ` DEFAULT ${col.column_default}`
        if (col.is_nullable === 'NO') def += ' NOT NULL'
        colDefs.push(def)
      }
      // Primary key
      const pks = pkMap.get(tableName)
      if (pks?.length) colDefs.push(`  PRIMARY KEY (${pks.join(', ')})`)
      migrationSQL += colDefs.join(',\n') + '\n);\n\n'
    }

    // Unique constraints
    migrationSQL += '-- ===== UNIQUE CONSTRAINTS =====\n'
    for (const uc of schemaData.unique_constraints || []) {
      migrationSQL += `ALTER TABLE public.${uc.table_name} ADD CONSTRAINT ${uc.constraint_name} UNIQUE (${uc.columns.join(', ')}) ON CONFLICT DO NOTHING;\n`
    }
    migrationSQL += '\n'

    // Foreign keys
    migrationSQL += '-- ===== FOREIGN KEYS =====\n'
    for (const fk of schemaData.foreign_keys || []) {
      const onDelete = fk.delete_rule !== 'NO ACTION' ? ` ON DELETE ${fk.delete_rule}` : ''
      migrationSQL += `ALTER TABLE public.${fk.table_name} ADD FOREIGN KEY (${fk.column_name}) REFERENCES ${fk.foreign_table_schema}.${fk.foreign_table_name}(${fk.foreign_column_name})${onDelete};\n`
    }
    migrationSQL += '\n'

    // Indexes
    migrationSQL += '-- ===== INDEXES =====\n'
    for (const idx of schemaData.indexes || []) {
      if (idx.indexdef && !idx.indexname.endsWith('_pkey')) {
        migrationSQL += `${idx.indexdef};\n`
      }
    }
    migrationSQL += '\n'

    // Functions
    migrationSQL += '-- ===== FUNCTIONS =====\n'
    for (const fn of schemaData.functions || []) {
      if (fn.definition) {
        migrationSQL += `${fn.definition};\n\n`
      }
    }

    // Triggers
    migrationSQL += '-- ===== TRIGGERS =====\n'
    for (const tr of schemaData.triggers || []) {
      migrationSQL += `CREATE TRIGGER ${tr.trigger_name} ${tr.action_timing} ${tr.event_manipulation} ON public.${tr.event_object_table} FOR EACH ${tr.action_orientation} ${tr.action_statement};\n`
    }
    migrationSQL += '\n'

    // RLS
    migrationSQL += '-- ===== ROW LEVEL SECURITY =====\n'
    for (const rs of schemaData.rls_status || []) {
      if (rs.rls_enabled) {
        migrationSQL += `ALTER TABLE public.${rs.table_name} ENABLE ROW LEVEL SECURITY;\n`
      }
    }
    migrationSQL += '\n'

    for (const pol of schemaData.rls_policies || []) {
      const permissive = pol.permissive === 'PERMISSIVE' ? '' : ' AS RESTRICTIVE'
      const roles = pol.roles?.join(', ') || 'public'
      let policyDef = `CREATE POLICY "${pol.policyname}" ON public.${pol.tablename}${permissive} FOR ${pol.cmd} TO ${roles}`
      if (pol.qual) policyDef += ` USING (${pol.qual})`
      if (pol.with_check) policyDef += ` WITH CHECK (${pol.with_check})`
      migrationSQL += policyDef + ';\n'
    }
    migrationSQL += '\n'

    // Views
    migrationSQL += '-- ===== VIEWS =====\n'
    for (const v of schemaData.views || []) {
      migrationSQL += `CREATE OR REPLACE VIEW public.${v.view_name} AS ${v.view_definition}\n\n`
    }

    // Storage buckets
    migrationSQL += '-- ===== STORAGE BUCKETS =====\n'
    for (const b of schemaData.storage_buckets || []) {
      const mimeTypes = b.allowed_mime_types ? `'${JSON.stringify(b.allowed_mime_types)}'` : 'NULL'
      migrationSQL += `INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('${b.id}', '${b.name}', ${b.public}, ${b.file_size_limit || 'NULL'}, ${mimeTypes}) ON CONFLICT (id) DO NOTHING;\n`
    }
    migrationSQL += '\n'

    // Storage policies
    migrationSQL += '-- ===== STORAGE POLICIES =====\n'
    for (const pol of schemaData.storage_policies || []) {
      const roles = pol.roles?.join(', ') || 'public'
      let policyDef = `CREATE POLICY "${pol.policyname}" ON storage.${pol.tablename} FOR ${pol.cmd} TO ${roles}`
      if (pol.qual) policyDef += ` USING (${pol.qual})`
      if (pol.with_check) policyDef += ` WITH CHECK (${pol.with_check})`
      migrationSQL += policyDef + ';\n'
    }
    migrationSQL += '\n'

    // Realtime
    migrationSQL += '-- ===== REALTIME PUBLICATIONS =====\n'
    for (const pub of schemaData.realtime_publications || []) {
      if (pub.tablename) {
        migrationSQL += `ALTER PUBLICATION supabase_realtime ADD TABLE ${pub.schemaname}.${pub.tablename};\n`
      }
    }

    const result = {
      _metadata: {
        export_type: 'schema_export',
        exported_at: new Date().toISOString(),
        exported_by: user.email,
        sections: [
          'extensions', 'enums', 'tables', 'unique_constraints', 'foreign_keys',
          'indexes', 'functions', 'triggers', 'rls_policies', 'views',
          'storage_buckets', 'storage_policies', 'realtime_publications',
        ],
      },
      migration_sql: migrationSQL,
      raw_schema: schemaData,
    }

    return new Response(JSON.stringify(result), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="schema_export_${new Date().toISOString().slice(0, 10)}.json"`,
      },
    })
  } catch (error) {
    console.error('Schema export error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
