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
      .select('platform_role, company_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!platformUser || !['platform_admin', 'company_admin'].includes(platformUser.platform_role || '')) {
      return new Response(JSON.stringify({ error: 'Forbidden: Admin only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get query params
    const url = new URL(req.url)
    const bucketParam = url.searchParams.get('bucket') // specific bucket or 'all'
    const listOnly = url.searchParams.get('list_only') === 'true'

    // For company admin, get their tenant IDs to filter
    let companyTenantIds: string[] | null = null
    if (platformUser.platform_role === 'company_admin' && platformUser.company_id) {
      const { data: companyTenants } = await adminClient
        .from('tenants')
        .select('id')
        .eq('company_id', platformUser.company_id)
      companyTenantIds = (companyTenants || []).map((t: any) => t.id)
    }

    // List all buckets
    const { data: buckets, error: bucketsError } = await adminClient.storage.listBuckets()
    if (bucketsError) throw bucketsError

    const targetBuckets = bucketParam && bucketParam !== 'all'
      ? buckets?.filter(b => b.id === bucketParam) || []
      : buckets || []

    const result: Record<string, any> = {
      _metadata: {
        export_type: 'storage_export',
        exported_at: new Date().toISOString(),
        exported_by: user.email,
        buckets: targetBuckets.map(b => ({ id: b.id, name: b.name, public: b.public })),
      },
      files: {} as Record<string, any[]>,
    }

    // List files in each bucket
    for (const bucket of targetBuckets) {
      const allFiles: any[] = []
      
      async function listRecursive(path: string) {
        const { data: items, error } = await adminClient.storage
          .from(bucket.id)
          .list(path, { limit: 1000 })
        
        if (error) {
          console.error(`Error listing ${bucket.id}/${path}:`, error.message)
          return
        }

        for (const item of items || []) {
          const fullPath = path ? `${path}/${item.name}` : item.name
          if (item.id) {
            // It's a file
            const { data: urlData } = adminClient.storage.from(bucket.id).getPublicUrl(fullPath)
            
            // For private buckets, generate signed URL
            let downloadUrl = urlData?.publicUrl || null
            if (!bucket.public) {
              const { data: signedData } = await adminClient.storage
                .from(bucket.id)
                .createSignedUrl(fullPath, 86400) // 24h
              downloadUrl = signedData?.signedUrl || null
            }

            allFiles.push({
              id: item.id,
              name: item.name,
              path: fullPath,
              bucket_id: bucket.id,
              size: item.metadata?.size || null,
              mimetype: item.metadata?.mimetype || null,
              created_at: item.created_at,
              updated_at: item.updated_at,
              download_url: downloadUrl,
            })
          } else {
            // It's a folder, recurse
            await listRecursive(fullPath)
          }
        }
      }

      await listRecursive('')

      // For company admin, filter files by tenant ID in path
      if (companyTenantIds) {
        // Files are often stored as tenant_id/filename
        const filtered = allFiles.filter(f => {
          const pathParts = f.path.split('/')
          return companyTenantIds!.some(tid => pathParts.includes(tid))
        })
        result.files[bucket.id] = filtered
      } else {
        result.files[bucket.id] = allFiles
      }
    }

    // Add summary
    let totalFiles = 0
    const bucketSummary: Record<string, number> = {}
    for (const [bucketId, files] of Object.entries(result.files as Record<string, any[]>)) {
      bucketSummary[bucketId] = files.length
      totalFiles += files.length
    }
    result._metadata.total_files = totalFiles
    result._metadata.bucket_summary = bucketSummary

    // If not list_only, include base64 data for small files (< 1MB)
    if (!listOnly) {
      for (const [bucketId, files] of Object.entries(result.files as Record<string, any[]>)) {
        for (const file of files) {
          if (file.size && file.size < 1024 * 1024) { // < 1MB
            try {
              const { data: fileData, error: dlError } = await adminClient.storage
                .from(bucketId)
                .download(file.path)
              if (!dlError && fileData) {
                const arrayBuffer = await fileData.arrayBuffer()
                const bytes = new Uint8Array(arrayBuffer)
                // Convert to base64
                let binary = ''
                for (let i = 0; i < bytes.length; i++) {
                  binary += String.fromCharCode(bytes[i])
                }
                file.base64_data = btoa(binary)
              }
            } catch (e) {
              // Skip files that can't be downloaded
            }
          }
        }
      }
    }

    return new Response(JSON.stringify(result), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="storage_export_${new Date().toISOString().slice(0, 10)}.json"`,
      },
    })
  } catch (error) {
    console.error('Storage export error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
