import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ERPNextService {
  private readonly logger = new Logger(ERPNextService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve active ERPNext connection configuration from Database
   */
  async getEffectiveConfig() {
    try {
      const config = await this.prisma.eRPNextConfig.findFirst({
        where: { isActive: true },
        orderBy: { updatedAt: 'desc' },
      });
      if (config) {
        return {
          id: config.id,
          baseUrl: config.baseUrl.replace(/\/+$/, ''),
          apiKey: config.apiKey,
          apiSecret: config.apiSecret,
          company: config.company || 'Techo digital',
          isActive: config.isActive,
          source: 'DATABASE',
        };
      }
    } catch (e: any) {
      this.logger.warn(`Could not read ERPNextConfig from DB: ${e.message}`);
    }

    // Fallback to environment variables
    const baseUrl = (process.env.ERPNEXT_BASE_URL || 'https://development.techoerp.in').replace(/\/+$/, '');
    const apiKey = process.env.ERPNEXT_API_KEY || 'eb2d85e4a5edc3b';
    const apiSecret = process.env.ERPNEXT_API_SECRET || 'dcd27fb299514f3';
    const company = process.env.ERPNEXT_COMPANY || 'Techo digital';

    return {
      id: 'default',
      baseUrl,
      apiKey,
      apiSecret,
      company,
      isActive: true,
      source: 'ENV_FALLBACK',
    };
  }

  /**
   * Save or update dynamic ERPNext configuration in Database
   */
  async saveConfig(dto: {
    baseUrl: string;
    apiKey: string;
    apiSecret: string;
    company?: string;
    isActive?: boolean;
  }) {
    const cleanUrl = dto.baseUrl.trim().replace(/\/+$/, '');
    const existing = await this.prisma.eRPNextConfig.findFirst();

    if (existing) {
      return await this.prisma.eRPNextConfig.update({
        where: { id: existing.id },
        data: {
          baseUrl: cleanUrl,
          apiKey: dto.apiKey.trim(),
          apiSecret: dto.apiSecret.trim(),
          company: dto.company?.trim() || 'Techo digital',
          isActive: dto.isActive !== undefined ? dto.isActive : true,
          updatedAt: new Date(),
        },
      });
    }

    return await this.prisma.eRPNextConfig.create({
      data: {
        baseUrl: cleanUrl,
        apiKey: dto.apiKey.trim(),
        apiSecret: dto.apiSecret.trim(),
        company: dto.company?.trim() || 'Techo digital',
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });
  }

  /**
   * Test live ERPNext API connection
   */
  async testConnection(configOverride?: { baseUrl: string; apiKey: string; apiSecret: string }) {
    const config = configOverride || (await this.getEffectiveConfig());
    const cleanUrl = config.baseUrl.replace(/\/+$/, '');
    const startTime = Date.now();

    try {
      const testUrl = `${cleanUrl}/api/method/frappe.auth.get_logged_user`;
      const res = await fetch(testUrl, {
        headers: {
          Authorization: `token ${config.apiKey}:${config.apiSecret}`,
          Accept: 'application/json',
        },
      });

      const latencyMs = Date.now() - startTime;
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }

      const json = await res.json();
      return {
        success: true,
        message: `Successfully connected to ERPNext (${json.message || 'Authenticated'})`,
        loggedUser: json.message,
        latencyMs,
        baseUrl: cleanUrl,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Connection failed: ${err.message}`,
        latencyMs: Date.now() - startTime,
        baseUrl: cleanUrl,
      };
    }
  }


  /**
   * Log sync operation for telemetry and developer audit
   */
  async logSync(
    docType: string,
    direction: 'INBOUND' | 'OUTBOUND',
    operation: string,
    status: 'SUCCESS' | 'FAILED' | 'RETRY',
    recordId?: string,
    erpnextDocName?: string,
    requestPayload?: any,
    responsePayload?: any,
    errorDetails?: string,
    durationMs?: number,
  ) {
    try {
      await this.prisma.syncLog.create({
        data: {
          docType,
          direction,
          operation,
          status,
          recordId: recordId || null,
          erpnextDocName: erpnextDocName || null,
          requestPayload: requestPayload || null,
          responsePayload: responsePayload || null,
          errorDetails: errorDetails || null,
          durationMs: durationMs || null,
        },
      });
    } catch (e: any) {
      this.logger.warn(`Failed to write to SyncLog: ${e.message}`);
    }
  }

  private getAuthHeaders(config: any) {
    return {
      Authorization: `token ${config.apiKey}:${config.apiSecret}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  // ===========================================================================
  // 1. SUPPLIER MASTER & PROFILES
  // ===========================================================================

  /**
   * Fetch suppliers from ERPNext DocType `Supplier`
   */
  async syncSuppliersFromERPNext() {
    const config = await this.getEffectiveConfig();
    if (!config || !config.isActive) return [];

    const headers = this.getAuthHeaders(config);
    try {
      const fields = encodeURIComponent(
        JSON.stringify([
          'name',
          'supplier_name',
          'supplier_group',
          'supplier_type',
          'country',
          'pan',
          'gstin',
          'email_id',
          'mobile_no',
          'website',
          'is_transporter',
          'disabled',
        ])
      );
      const url = `${config.baseUrl}/api/resource/Supplier?fields=${fields}&limit_page_length=500`;
      const res = await fetch(url, { headers });
      if (!res.ok) {
        throw new Error(`Failed to fetch suppliers from ERPNext (${res.status}): ${await res.text()}`);
      }
      const json = await res.json();
      const erpSuppliers = json.data || [];

      for (const s of erpSuppliers) {
        if (!s.name) continue;
        await this.prisma.supplier.upsert({
          where: { id: s.name },
          update: {
            supplierName: s.supplier_name || s.name,
            supplierGroup: s.supplier_group || 'All Supplier Groups',
            supplierType: s.supplier_type || 'Company',
            country: s.country || 'India',
            pan: s.pan || null,
            gstin: s.gstin || null,
            email: s.email_id || null,
            phone: s.mobile_no || null,
            website: s.website || null,
            lastSyncedAt: new Date(),
            syncStatus: 'SYNCED',
          },
          create: {
            id: s.name,
            supplierName: s.supplier_name || s.name,
            supplierGroup: s.supplier_group || 'All Supplier Groups',
            supplierType: s.supplier_type || 'Company',
            country: s.country || 'India',
            pan: s.pan || null,
            gstin: s.gstin || null,
            email: s.email_id || null,
            phone: s.mobile_no || null,
            website: s.website || null,
            lastSyncedAt: new Date(),
            syncStatus: 'SYNCED',
          },
        });
      }

      this.logger.log(`[ERPNext Supplier Sync] Synced ${erpSuppliers.length} suppliers into local database`);
      return erpSuppliers;
    } catch (err: any) {
      this.logger.error(`Error syncing suppliers from ERPNext: ${err.message}`);
      return [];
    }
  }

  // ===========================================================================
  // 2. RFQ (REQUEST FOR QUOTATION)
  // ===========================================================================

  /**
   * Fetch active RFQs for a specific supplier
   * Strict Isolation: Only RFQs where this supplier is listed in `suppliers` child table
   */
  async getSupplierRFQs(supplierId: string, query: any = {}) {
    const config = await this.getEffectiveConfig();
    if (!config || !config.isActive) return [];

    const headers = this.getAuthHeaders(config);
    const startTime = Date.now();

    try {
      // 1. Fetch Request for Quotation Supplier child table records for this supplier
      const puFields = encodeURIComponent(JSON.stringify(['parent', 'supplier', 'email_id', 'quote_status']));
      const filters = encodeURIComponent(JSON.stringify([['supplier', '=', supplierId]]));
      const childUrl = `${config.baseUrl}/api/resource/Request%20for%20Quotation%20Supplier?filters=${filters}&fields=${puFields}&limit_page_length=500`;
      
      const childRes = await fetch(childUrl, { headers });
      const childJson = await childRes.json();
      const parentRfqNames: string[] = (childJson.data || []).map((r: any) => r.parent).filter(Boolean);

      if (parentRfqNames.length === 0) {
        return [];
      }

      // 2. Fetch full RFQ details for these parents
      const rfqFields = encodeURIComponent(
        JSON.stringify([
          'name',
          'company',
          'transaction_date',
          'status',
          'message_for_supplier',
          'terms',
          'creation',
          'modified',
        ])
      );
      const rfqFilters = encodeURIComponent(JSON.stringify([['name', 'in', parentRfqNames]]));
      const rfqUrl = `${config.baseUrl}/api/resource/Request%20for%20Quotation?filters=${rfqFilters}&fields=${rfqFields}&order_by=transaction_date%20desc&limit_page_length=500`;

      const rfqRes = await fetch(rfqUrl, { headers });
      const rfqJson = await rfqRes.json();
      const rfqs = rfqJson.data || [];

      await this.logSync('Request for Quotation', 'INBOUND', 'FETCH', 'SUCCESS', supplierId, undefined, query, { count: rfqs.length }, undefined, Date.now() - startTime);
      return rfqs;
    } catch (err: any) {
      this.logger.error(`Error fetching RFQs for supplier ${supplierId}: ${err.message}`);
      await this.logSync('Request for Quotation', 'INBOUND', 'FETCH', 'FAILED', supplierId, undefined, query, undefined, err.message, Date.now() - startTime);
      return [];
    }
  }

  /**
   * Get single RFQ details with line items and specifications
   */
  async getRFQDetails(rfqId: string, supplierId?: string) {
    const config = await this.getEffectiveConfig();
    const headers = this.getAuthHeaders(config);

    try {
      const url = `${config.baseUrl}/api/resource/Request%20for%20Quotation/${encodeURIComponent(rfqId)}`;
      const res = await fetch(url, { headers });
      if (!res.ok) {
        throw new NotFoundException(`RFQ ${rfqId} not found in ERPNext`);
      }
      const json = await res.json();
      const rfq = json.data;

      // Verification: If supplierId is provided, verify this supplier is in the suppliers child table
      if (supplierId) {
        const suppliersList = rfq.suppliers || [];
        const isTarget = suppliersList.some((s: any) => String(s.supplier || '').toLowerCase() === supplierId.toLowerCase());
        if (!isTarget) {
          throw new NotFoundException(`RFQ ${rfqId} not accessible for this supplier.`);
        }
      }

      return rfq;
    } catch (err: any) {
      this.logger.error(`Error getting RFQ details: ${err.message}`);
      throw new NotFoundException(`Could not retrieve RFQ: ${err.message}`);
    }
  }

  // ===========================================================================
  // 3. SUPPLIER QUOTATIONS
  // ===========================================================================

  /**
   * Create Supplier Quotation in ERPNext DocType `Supplier Quotation`
   */
  async submitSupplierQuotation(supplierId: string, data: any) {
    const config = await this.getEffectiveConfig();
    const headers = this.getAuthHeaders(config);
    const startTime = Date.now();

    const transactionDateStr = data.transactionDate
      ? new Date(data.transactionDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    const validTillStr = data.validTill
      ? new Date(data.validTill).toISOString().split('T')[0]
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const items = (data.items || []).map((it: any) => ({
      item_code: it.itemCode || it.item_code || '01',
      item_name: it.itemName || it.item_name || it.itemCode || 'Item',
      qty: Number(it.qty || 1),
      rate: Number(it.rate || it.unitPrice || 0),
      uom: it.uom || 'Nos',
      ...(it.leadTimeDays ? { lead_time_days: Number(it.leadTimeDays) } : {}),
      ...(it.description ? { description: it.description } : {}),
      ...(it.rfqItemId ? { request_for_quotation_item: it.rfqItemId } : {}),
    }));

    const payload: any = {
      supplier: supplierId,
      company: data.company || config.company,
      transaction_date: transactionDateStr,
      valid_till: validTillStr,
      ...(data.rfqId ? { request_for_quotation: data.rfqId } : {}),
      ...(data.terms ? { terms: data.terms } : {}),
      ...(data.currency ? { currency: data.currency } : { currency: 'INR' }),
      items,
    };

    try {
      const url = `${config.baseUrl}/api/resource/Supplier%20Quotation`;
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        const errorMsg = json._server_messages || json.message || JSON.stringify(json);
        throw new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
      }

      await this.logSync('Supplier Quotation', 'OUTBOUND', 'CREATE', 'SUCCESS', supplierId, json.data?.name, payload, json.data, undefined, Date.now() - startTime);
      return json.data;
    } catch (err: any) {
      this.logger.error(`Failed to submit supplier quotation: ${err.message}`);
      await this.logSync('Supplier Quotation', 'OUTBOUND', 'CREATE', 'FAILED', supplierId, undefined, payload, undefined, err.message, Date.now() - startTime);
      throw new BadRequestException(`Could not submit quotation in ERP: ${err.message}`);
    }
  }

  /**
   * Fetch submitted quotations for a supplier
   */
  async getSupplierQuotations(supplierId: string, query: any = {}) {
    const config = await this.getEffectiveConfig();
    const headers = this.getAuthHeaders(config);

    try {
      const fields = encodeURIComponent(
        JSON.stringify([
          'name',
          'supplier',
          'transaction_date',
          'valid_till',
          'status',
          'request_for_quotation',
          'grand_total',
          'currency',
          'creation',
          'modified',
        ])
      );
      const filters = encodeURIComponent(JSON.stringify([['supplier', '=', supplierId]]));
      const url = `${config.baseUrl}/api/resource/Supplier%20Quotation?filters=${filters}&fields=${fields}&order_by=transaction_date%20desc&limit_page_length=500`;

      const res = await fetch(url, { headers });
      const json = await res.json();
      return json.data || [];
    } catch (err: any) {
      this.logger.error(`Error fetching quotations for ${supplierId}: ${err.message}`);
      return [];
    }
  }

  // ===========================================================================
  // 4. PURCHASE ORDERS (PO)
  // ===========================================================================

  /**
   * Fetch purchase orders issued to a supplier
   */
  async getSupplierPurchaseOrders(supplierId: string, query: any = {}) {
    const config = await this.getEffectiveConfig();
    const headers = this.getAuthHeaders(config);

    try {
      const fields = encodeURIComponent(
        JSON.stringify([
          'name',
          'supplier',
          'transaction_date',
          'schedule_date',
          'status',
          'grand_total',
          'currency',
          'per_received',
          'per_billed',
          'company',
          'creation',
        ])
      );
      const filters = encodeURIComponent(JSON.stringify([['supplier', '=', supplierId]]));
      const url = `${config.baseUrl}/api/resource/Purchase%20Order?filters=${filters}&fields=${fields}&order_by=transaction_date%20desc&limit_page_length=500`;

      const res = await fetch(url, { headers });
      const json = await res.json();
      return json.data || [];
    } catch (err: any) {
      this.logger.error(`Error fetching POs for ${supplierId}: ${err.message}`);
      return [];
    }
  }

  /**
   * Get single Purchase Order details
   */
  async getPurchaseOrderDetails(poId: string, supplierId?: string) {
    const config = await this.getEffectiveConfig();
    const headers = this.getAuthHeaders(config);

    try {
      const url = `${config.baseUrl}/api/resource/Purchase%20Order/${encodeURIComponent(poId)}`;
      const res = await fetch(url, { headers });
      if (!res.ok) {
        throw new NotFoundException(`Purchase Order ${poId} not found`);
      }
      const json = await res.json();
      const po = json.data;

      if (supplierId && String(po.supplier || '').toLowerCase() !== supplierId.toLowerCase()) {
        throw new NotFoundException(`Purchase Order not accessible`);
      }

      return po;
    } catch (err: any) {
      this.logger.error(`Error getting PO details: ${err.message}`);
      throw new NotFoundException(`Could not retrieve Purchase Order: ${err.message}`);
    }
  }

  // ===========================================================================
  // 5. PURCHASE INVOICES (PI) & STATEMENT OF ACCOUNT
  // ===========================================================================

  /**
   * Fetch purchase invoices for supplier
   */
  async getSupplierPurchaseInvoices(supplierId: string, query: any = {}) {
    const config = await this.getEffectiveConfig();
    const headers = this.getAuthHeaders(config);

    try {
      const fields = encodeURIComponent(
        JSON.stringify([
          'name',
          'supplier',
          'posting_date',
          'due_date',
          'status',
          'grand_total',
          'outstanding_amount',
          'currency',
          'bill_no',
          'bill_date',
          'company',
        ])
      );
      const filters = encodeURIComponent(JSON.stringify([['supplier', '=', supplierId]]));
      const url = `${config.baseUrl}/api/resource/Purchase%20Invoice?filters=${filters}&fields=${fields}&order_by=posting_date%20desc&limit_page_length=500`;

      const res = await fetch(url, { headers });
      const json = await res.json();
      return json.data || [];
    } catch (err: any) {
      this.logger.error(`Error fetching purchase invoices for ${supplierId}: ${err.message}`);
      return [];
    }
  }

  /**
   * Fetch statement of account & outstanding balance for supplier
   */
  async getSupplierStatementOfAccount(supplierId: string, fromDate?: string, toDate?: string) {
    const config = await this.getEffectiveConfig();
    const headers = this.getAuthHeaders(config);

    try {
      // 1. Fetch invoices and outstanding totals
      const invoices = await this.getSupplierPurchaseInvoices(supplierId);

      let totalBilled = 0;
      let totalOutstanding = 0;

      for (const inv of invoices) {
        totalBilled += Number(inv.grand_total || 0);
        totalOutstanding += Number(inv.outstanding_amount || 0);
      }

      const totalPaid = totalBilled - totalOutstanding;

      // 2. Fetch recent payment entries
      const peFields = encodeURIComponent(JSON.stringify(['name', 'posting_date', 'party_name', 'paid_amount', 'reference_no', 'reference_date', 'mode_of_payment', 'status']));
      const peFilters = encodeURIComponent(JSON.stringify([['party_name', '=', supplierId], ['payment_type', '=', 'Pay']]));
      const peUrl = `${config.baseUrl}/api/resource/Payment%20Entry?filters=${peFilters}&fields=${peFields}&order_by=posting_date%20desc&limit_page_length=100`;

      let paymentEntries: any[] = [];
      try {
        const peRes = await fetch(peUrl, { headers });
        if (peRes.ok) {
          const peJson = await peRes.json();
          paymentEntries = peJson.data || [];
        }
      } catch (e) {}

      return {
        supplierId,
        currency: 'INR',
        summary: {
          totalBilled: Math.round(totalBilled * 100) / 100,
          totalPaid: Math.round(totalPaid * 100) / 100,
          totalOutstanding: Math.round(totalOutstanding * 100) / 100,
        },
        invoices,
        paymentEntries,
      };
    } catch (err: any) {
      this.logger.error(`Error generating statement of account for ${supplierId}: ${err.message}`);
      return {
        supplierId,
        currency: 'INR',
        summary: { totalBilled: 0, totalPaid: 0, totalOutstanding: 0 },
        invoices: [],
        paymentEntries: [],
      };
    }
  }
}
