// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Convert number to Vietnamese words
function numberToVietnameseWords(num: number): string {
  const ones = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  const tens = ['', 'mười', 'hai mươi', 'ba mươi', 'bốn mươi', 'năm mươi', 'sáu mươi', 'bảy mươi', 'tám mươi', 'chín mươi'];
  
  if (num === 0) return 'không đồng';
  
  let words = '';
  
  if (num >= 1000000000) {
    words += ones[Math.floor(num / 1000000000)] + ' tỷ ';
    num %= 1000000000;
  }
  
  if (num >= 1000000) {
    const millions = Math.floor(num / 1000000);
    if (millions >= 100) {
      words += ones[Math.floor(millions / 100)] + ' trăm ';
      const remainder = millions % 100;
      if (remainder >= 10) {
        words += tens[Math.floor(remainder / 10)] + ' ';
        if (remainder % 10 > 0) words += ones[remainder % 10] + ' ';
      } else if (remainder > 0) {
        words += 'lẻ ' + ones[remainder] + ' ';
      }
    } else if (millions >= 10) {
      words += tens[Math.floor(millions / 10)] + ' ';
      if (millions % 10 > 0) words += ones[millions % 10] + ' ';
    } else {
      words += ones[millions] + ' ';
    }
    words += 'triệu ';
    num %= 1000000;
  }
  
  if (num >= 1000) {
    const thousands = Math.floor(num / 1000);
    if (thousands >= 100) {
      words += ones[Math.floor(thousands / 100)] + ' trăm ';
      const remainder = thousands % 100;
      if (remainder >= 10) {
        words += tens[Math.floor(remainder / 10)] + ' ';
        if (remainder % 10 > 0) words += ones[remainder % 10] + ' ';
      } else if (remainder > 0) {
        words += 'lẻ ' + ones[remainder] + ' ';
      }
    } else if (thousands >= 10) {
      words += tens[Math.floor(thousands / 10)] + ' ';
      if (thousands % 10 > 0) words += ones[thousands % 10] + ' ';
    } else {
      words += ones[thousands] + ' ';
    }
    words += 'nghìn ';
    num %= 1000;
  }
  
  if (num >= 100) {
    words += ones[Math.floor(num / 100)] + ' trăm ';
    num %= 100;
    if (num > 0 && num < 10) words += 'lẻ ';
  }
  
  if (num >= 10) {
    words += tens[Math.floor(num / 10)] + ' ';
    num %= 10;
  }
  
  if (num > 0) {
    words += ones[num] + ' ';
  }
  
  return words.trim().replace(/\s+/g, ' ') + ' đồng';
}

// Provider API call functions (simplified for now)
async function callProviderAPI(config: any, action: string, payload: any): Promise<any> {
  const provider = config.provider;
  const apiUrl = config.api_url;
  const apiKey = config.api_key_encrypted;
  
  // Provider-specific headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  switch (provider) {
    case 'vnpt':
      headers['Authorization'] = `Bearer ${apiKey}`;
      headers['X-Tax-Code'] = config.tax_code;
      break;
    case 'viettel':
      headers['Username'] = config.username || '';
      headers['Password'] = apiKey;
      break;
    case 'fpt':
    case 'misa':
      headers['Authorization'] = `Bearer ${apiKey}`;
      break;
  }
  
  try {
    const response = await fetch(`${apiUrl}/${action}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    return await response.json();
  } catch (err: any) {
    return { error: err.message };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;
    const { action, data } = await req.json();

    // Get user's tenant
    const { data: platformUser } = await supabase
      .from('platform_users')
      .select('tenant_id')
      .eq('user_id', userId)
      .maybeSingle();

    const { data: userRole } = await supabase
      .from('user_roles')
      .select('tenant_id')
      .eq('user_id', userId)
      .maybeSingle();

    const tenantId = platformUser?.tenant_id || userRole?.tenant_id;
    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'Không tìm thấy thông tin cửa hàng' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get active e-invoice config
    const { data: config } = await supabase
      .from('einvoice_configs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .maybeSingle();

    // Handle test-connection action first
    if (action === 'test-connection') {
      if (!config) {
        return new Response(
          JSON.stringify({ error: 'Chưa cấu hình nhà cung cấp hoá đơn điện tử', needsConfig: true }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        const testResult = await fetch(config.api_url, { method: 'GET' });
        return new Response(
          JSON.stringify({ 
            success: testResult.ok,
            message: testResult.ok ? 'Kết nối thành công' : 'Không thể kết nối đến API',
            status: testResult.status
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (e: any) {
        return new Response(
          JSON.stringify({ success: false, message: 'Lỗi kết nối: ' + (e?.message || 'Unknown error') }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Other actions require config
    if (!config) {
      return new Response(
        JSON.stringify({ error: 'Chưa cấu hình nhà cung cấp hoá đơn điện tử' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log helper
    const logAction = async (einvoiceId: string | null, responseData: any, statusCode: number, errorMsg?: string) => {
      await supabase.from('einvoice_logs').insert({
        tenant_id: tenantId,
        einvoice_id: einvoiceId,
        action,
        request_data: data,
        response_data: responseData,
        status_code: statusCode,
        error_message: errorMsg,
      });
    };

    switch (action) {
      case 'create': {
        const { exportReceiptId, items, customer } = data || {};
        
        if (!items || !customer) {
          return new Response(
            JSON.stringify({ error: 'Thiếu thông tin hoá đơn' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Calculate amounts
        const subtotal = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0);
        const vatRate = data?.vatRate || 10;
        const vatAmount = Math.round(subtotal * vatRate / 100);
        const totalAmount = subtotal + vatAmount;
        const amountInWords = numberToVietnameseWords(totalAmount);

        // Create invoice record in database first (as pending)
        const { data: einvoice, error: einvoiceError } = await supabase
          .from('einvoices')
          .insert({
            tenant_id: tenantId,
            export_receipt_id: exportReceiptId || null,
            config_id: config.id,
            customer_name: customer.name,
            customer_tax_code: customer.taxCode || null,
            customer_address: customer.address || null,
            customer_email: customer.email || null,
            customer_phone: customer.phone || null,
            subtotal,
            vat_rate: vatRate,
            vat_amount: vatAmount,
            total_amount: totalAmount,
            amount_in_words: amountInWords,
            status: 'pending',
            created_by: userId,
          })
          .select()
          .single();

        if (einvoiceError) {
          return new Response(
            JSON.stringify({ error: 'Không thể tạo hoá đơn: ' + einvoiceError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Insert invoice items
        const invoiceItems = items.map((item: any, index: number) => ({
          einvoice_id: einvoice.id,
          line_number: index + 1,
          product_name: item.productName,
          product_code: item.sku || null,
          unit: item.unit || 'Cái',
          quantity: item.quantity,
          unit_price: item.unitPrice,
          amount: item.quantity * item.unitPrice,
          vat_rate: vatRate,
          vat_amount: Math.round(item.quantity * item.unitPrice * vatRate / 100),
          total_amount: item.quantity * item.unitPrice + Math.round(item.quantity * item.unitPrice * vatRate / 100),
        }));

        await supabase.from('einvoice_items').insert(invoiceItems);

        // Call provider API if not in sandbox mode
        let providerResponse = null;
        let finalStatus: 'issued' | 'error' = 'issued';
        let errorMessage = null;

        if (!config.sandbox_mode) {
          try {
            providerResponse = await callProviderAPI(config, 'create', {
              customer,
              items,
              subtotal,
              vat_amount: vatAmount,
              total_amount: totalAmount,
              amount_in_words: amountInWords,
            });
            
            if (providerResponse?.error) {
              finalStatus = 'error';
              errorMessage = providerResponse.error;
            }
          } catch (e: any) {
            finalStatus = 'error';
            errorMessage = e?.message || 'Lỗi gọi API';
          }
        }

        // Update invoice with result
        const updateData: any = {
          status: finalStatus,
          provider_response: providerResponse,
          error_message: errorMessage,
        };

        if (finalStatus === 'issued') {
          if (config.sandbox_mode) {
            updateData.invoice_number = `HD${Date.now().toString().slice(-8)}`;
            updateData.invoice_series = config.invoice_series || '1C24T';
            updateData.lookup_code = `SANDBOX-${updateData.invoice_number}`;
          } else if (providerResponse) {
            updateData.provider_invoice_id = providerResponse.invoiceId || providerResponse.InvoiceID;
            updateData.invoice_number = providerResponse.invoiceNo || providerResponse.InvoiceNo;
            updateData.invoice_series = providerResponse.invoiceSeries || config.invoice_series;
            updateData.lookup_code = providerResponse.lookupCode || providerResponse.LookupCode;
          }
        }

        await supabase.from('einvoices').update(updateData).eq('id', einvoice.id);
        await logAction(einvoice.id, providerResponse, finalStatus === 'issued' ? 200 : 400, errorMessage);

        return new Response(
          JSON.stringify({ 
            success: finalStatus === 'issued', 
            einvoiceId: einvoice.id,
            sandbox: config.sandbox_mode,
            message: finalStatus === 'issued' 
              ? (config.sandbox_mode ? 'Hoá đơn đã được tạo (Chế độ thử nghiệm)' : 'Hoá đơn đã được phát hành')
              : errorMessage
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'cancel': {
        const { einvoiceId, reason } = data || {};
        
        if (!einvoiceId || !reason) {
          return new Response(
            JSON.stringify({ error: 'Thiếu thông tin huỷ hoá đơn' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const { data: invoice } = await supabase
          .from('einvoices')
          .select('*')
          .eq('id', einvoiceId)
          .single();

        if (!invoice) {
          return new Response(
            JSON.stringify({ error: 'Không tìm thấy hoá đơn' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        let providerResponse = null;
        if (!config.sandbox_mode && invoice.provider_invoice_id) {
          providerResponse = await callProviderAPI(config, 'cancel', {
            invoiceId: invoice.provider_invoice_id,
            reason,
          });
        }

        await supabase
          .from('einvoices')
          .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
            cancelled_by: userId,
            adjustment_reason: reason,
          })
          .eq('id', einvoiceId);

        await logAction(einvoiceId, providerResponse, 200);

        return new Response(
          JSON.stringify({ success: true, message: 'Hoá đơn đã được huỷ' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'lookup': {
        const { lookupCode } = data || {};
        
        if (!lookupCode) {
          return new Response(
            JSON.stringify({ error: 'Thiếu mã tra cứu' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        let result;
        if (config.sandbox_mode) {
          const { data: invoice } = await supabase
            .from('einvoices')
            .select('*, einvoice_items(*)')
            .eq('lookup_code', lookupCode)
            .single();
          result = invoice;
        } else {
          result = await callProviderAPI(config, 'lookup', { lookupCode });
        }

        await logAction(null, result, 200);

        return new Response(
          JSON.stringify({ success: true, data: result }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'adjust': {
        const { originalInvoiceId, items, reason, customer } = data || {};
        
        if (!originalInvoiceId || !items || !customer) {
          return new Response(
            JSON.stringify({ error: 'Thiếu thông tin điều chỉnh hoá đơn' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const subtotal = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0);
        const vatRate = data?.vatRate || 10;
        const vatAmount = Math.round(subtotal * vatRate / 100);
        const totalAmount = subtotal + vatAmount;

        const { data: adjustedInvoice, error } = await supabase
          .from('einvoices')
          .insert({
            tenant_id: tenantId,
            config_id: config.id,
            original_invoice_id: originalInvoiceId,
            adjustment_reason: reason,
            customer_name: customer.name,
            customer_tax_code: customer.taxCode || null,
            customer_address: customer.address || null,
            customer_email: customer.email || null,
            customer_phone: customer.phone || null,
            subtotal,
            vat_rate: vatRate,
            vat_amount: vatAmount,
            total_amount: totalAmount,
            amount_in_words: numberToVietnameseWords(totalAmount),
            status: 'adjusted',
            created_by: userId,
          })
          .select()
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ error: 'Không thể tạo hoá đơn điều chỉnh: ' + error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await logAction(adjustedInvoice.id, null, 200);

        return new Response(
          JSON.stringify({ 
            success: true, 
            einvoiceId: adjustedInvoice.id,
            message: 'Hoá đơn điều chỉnh đã được tạo'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Hành động không được hỗ trợ' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error: any) {
    console.error('E-Invoice API error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Lỗi hệ thống' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
