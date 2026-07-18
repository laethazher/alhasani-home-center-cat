import { supabase } from '../../lib/supabaseClient';

export const ADMIN_LETTERS_BUCKET = 'operations-admin-letters';

export type AdminLetterType = 'outgoing' | 'incoming' | 'internal' | 'decision' | 'circular' | 'memo';
export type AdminLetterArchiveStatus = 'active' | 'archived' | 'expired';

export interface AdminLetter {
  id: number;
  letter_number: string;
  letter_type: AdminLetterType;
  subject: string;
  content_summary: string | null;
  correspondent_entity: string | null;
  letter_date: string;
  reference_number: string | null;
  archive_status: AdminLetterArchiveStatus;
  is_signed: boolean;
  signed_at: string | null;
  signed_by: string | null;
  requires_response: boolean;
  response_due_date: string | null;
  related_letter_id: number | null;
  file_path: string | null;
  file_name: string | null;
  file_mime: string | null;
  tags: string[];
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminLetterActivity {
  id: number;
  letter_id: number;
  action: string;
  details: string | null;
  performed_by: string | null;
  created_at: string;
}

export interface AdminLetterFilters {
  search?: string;
  letterType?: AdminLetterType | 'all';
  archiveStatus?: AdminLetterArchiveStatus | 'all';
  signed?: 'all' | 'signed' | 'unsigned';
  dateFrom?: string;
  dateTo?: string;
  requiresResponse?: boolean;
}

export interface AdminLetterStats {
  total: number;
  outgoing: number;
  incoming: number;
  unsigned: number;
  archived: number;
  pendingResponse: number;
}

export interface CreateAdminLetterPayload {
  letter_type: AdminLetterType;
  subject: string;
  content_summary?: string | null;
  correspondent_entity?: string | null;
  letter_date?: string;
  reference_number?: string | null;
  letter_number?: string | null;
  requires_response?: boolean;
  response_due_date?: string | null;
  related_letter_id?: number | null;
  tags?: string[];
  notes?: string | null;
  created_by?: string | null;
}

export type UpdateAdminLetterPayload = Partial<
  Omit<CreateAdminLetterPayload, 'letter_type'> & { letter_type: AdminLetterType; archive_status: AdminLetterArchiveStatus }
>;

export const LETTER_TYPE_LABELS: Record<AdminLetterType, string> = {
  outgoing: 'صادر',
  incoming: 'وارد',
  internal: 'داخلي',
  decision: 'قرار',
  circular: 'تعميم',
  memo: 'مذكرة',
};

export const ARCHIVE_STATUS_LABELS: Record<AdminLetterArchiveStatus, string> = {
  active: 'نشط',
  archived: 'مؤرشف',
  expired: 'منتهي',
};

/** Supabase Storage keys must be ASCII-only (no Arabic/spaces/special chars). */
function sanitizeStorageSegment(value: string): string {
  return value
    .replace(/\//g, '-')
    .replace(/[^\w.\-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 120);
}

function getFileExtension(fileName: string): string {
  const parts = fileName.split('.');
  if (parts.length < 2) return 'bin';
  const ext = parts.pop()?.toLowerCase().replace(/[^\w]/g, '') || 'bin';
  return ext || 'bin';
}

function buildLetterFileStoragePath(letter: AdminLetter, file: File): string {
  const year = letter.letter_date?.slice(0, 4) || String(new Date().getFullYear());
  const letterSegment = sanitizeStorageSegment(letter.letter_number) || `letter-${letter.id}`;
  const ext = getFileExtension(file.name);
  const storageFileName = `${Date.now()}_${letter.id}.${ext}`;
  return `${year}/${letterSegment}/${storageFileName}`;
}

class OperationsAdminLettersRepository {
  async generateOutgoingNumber(prefix = 'OPS'): Promise<string> {
    const { data, error } = await supabase.rpc('generate_operations_outgoing_letter_number', {
      p_prefix: prefix,
    });
    if (error) throw error;
    return data as string;
  }

  async listLetters(filters: AdminLetterFilters = {}): Promise<AdminLetter[]> {
    let query = supabase.from('operations_admin_letters').select('*').order('letter_date', { ascending: false });

    if (filters.letterType && filters.letterType !== 'all') {
      query = query.eq('letter_type', filters.letterType);
    }
    if (filters.archiveStatus && filters.archiveStatus !== 'all') {
      query = query.eq('archive_status', filters.archiveStatus);
    }
    if (filters.signed === 'signed') {
      query = query.eq('is_signed', true);
    } else if (filters.signed === 'unsigned') {
      query = query.eq('is_signed', false);
    }
    if (filters.dateFrom) {
      query = query.gte('letter_date', filters.dateFrom);
    }
    if (filters.dateTo) {
      query = query.lte('letter_date', filters.dateTo);
    }
    if (filters.requiresResponse) {
      query = query.eq('requires_response', true);
    }
    if (filters.search?.trim()) {
      const term = filters.search.trim();
      query = query.or(
        `subject.ilike.%${term}%,letter_number.ilike.%${term}%,correspondent_entity.ilike.%${term}%,reference_number.ilike.%${term}%,content_summary.ilike.%${term}%`
      );
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as AdminLetter[];
  }

  async getLetterById(id: number): Promise<AdminLetter | null> {
    const { data, error } = await supabase.from('operations_admin_letters').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return (data as AdminLetter | null) ?? null;
  }

  async checkReferenceDuplicate(referenceNumber: string, excludeId?: number): Promise<boolean> {
    if (!referenceNumber.trim()) return false;
    let query = supabase
      .from('operations_admin_letters')
      .select('id', { count: 'exact', head: true })
      .eq('reference_number', referenceNumber.trim());
    if (excludeId) query = query.neq('id', excludeId);
    const { count, error } = await query;
    if (error) throw error;
    return (count ?? 0) > 0;
  }

  async createLetter(payload: CreateAdminLetterPayload): Promise<AdminLetter> {
    let letterNumber = payload.letter_number?.trim() || '';

    if (payload.letter_type === 'outgoing') {
      letterNumber = await this.generateOutgoingNumber();
    } else if (!letterNumber) {
      const prefixMap: Record<AdminLetterType, string> = {
        outgoing: 'OPS',
        incoming: 'IN',
        internal: 'INT',
        decision: 'DEC',
        circular: 'CIR',
        memo: 'MEM',
      };
      const year = new Date().getFullYear();
      const random = Math.floor(Math.random() * 900 + 100);
      letterNumber = `${prefixMap[payload.letter_type]}/${year}/${random}`;
    }

    if (payload.reference_number) {
      const duplicate = await this.checkReferenceDuplicate(payload.reference_number);
      if (duplicate) {
        throw new Error('رقم المرجع موجود مسبقاً في الأرشيف');
      }
    }

    const insertPayload = {
      letter_number: letterNumber,
      letter_type: payload.letter_type,
      subject: payload.subject.trim(),
      content_summary: payload.content_summary?.trim() || null,
      correspondent_entity: payload.correspondent_entity?.trim() || null,
      letter_date: payload.letter_date || new Date().toISOString().slice(0, 10),
      reference_number: payload.reference_number?.trim() || null,
      requires_response: payload.requires_response ?? false,
      response_due_date: payload.response_due_date || null,
      related_letter_id: payload.related_letter_id ?? null,
      tags: payload.tags ?? [],
      notes: payload.notes?.trim() || null,
      created_by: payload.created_by ?? null,
    };

    const { data, error } = await supabase.from('operations_admin_letters').insert(insertPayload).select('*').single();
    if (error) throw error;

    const letter = data as AdminLetter;
    await this.logActivity(letter.id, 'create', `تم إنشاء كتاب ${letter.letter_number}`, payload.created_by ?? null);
    return letter;
  }

  async updateLetter(id: number, payload: UpdateAdminLetterPayload, userId?: string | null): Promise<AdminLetter> {
    if (payload.reference_number) {
      const duplicate = await this.checkReferenceDuplicate(payload.reference_number, id);
      if (duplicate) {
        throw new Error('رقم المرجع موجود مسبقاً في الأرشيف');
      }
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (payload.subject !== undefined) patch.subject = payload.subject.trim();
    if (payload.content_summary !== undefined) patch.content_summary = payload.content_summary?.trim() || null;
    if (payload.correspondent_entity !== undefined) patch.correspondent_entity = payload.correspondent_entity?.trim() || null;
    if (payload.letter_date !== undefined) patch.letter_date = payload.letter_date;
    if (payload.reference_number !== undefined) patch.reference_number = payload.reference_number?.trim() || null;
    if (payload.letter_type !== undefined) patch.letter_type = payload.letter_type;
    if (payload.archive_status !== undefined) patch.archive_status = payload.archive_status;
    if (payload.requires_response !== undefined) patch.requires_response = payload.requires_response;
    if (payload.response_due_date !== undefined) patch.response_due_date = payload.response_due_date || null;
    if (payload.related_letter_id !== undefined) patch.related_letter_id = payload.related_letter_id;
    if (payload.tags !== undefined) patch.tags = payload.tags;
    if (payload.notes !== undefined) patch.notes = payload.notes?.trim() || null;

    const { data, error } = await supabase.from('operations_admin_letters').update(patch).eq('id', id).select('*').single();
    if (error) throw error;

    await this.logActivity(id, 'update', 'تم تحديث بيانات الكتاب', userId ?? null);
    return data as AdminLetter;
  }

  async toggleSigned(id: number, signed: boolean, signedBy?: string, userId?: string | null): Promise<AdminLetter> {
    const patch = signed
      ? {
          is_signed: true,
          signed_at: new Date().toISOString(),
          signed_by: signedBy?.trim() || 'المدير',
          updated_at: new Date().toISOString(),
        }
      : {
          is_signed: false,
          signed_at: null,
          signed_by: null,
          updated_at: new Date().toISOString(),
        };

    const { data, error } = await supabase.from('operations_admin_letters').update(patch).eq('id', id).select('*').single();
    if (error) throw error;

    await this.logActivity(
      id,
      signed ? 'signed' : 'unsigned',
      signed ? `تم التوقيع بواسطة ${patch.signed_by}` : 'تم إلغاء التوقيع',
      userId ?? null
    );
    return data as AdminLetter;
  }

  async setArchiveStatus(id: number, status: AdminLetterArchiveStatus, userId?: string | null): Promise<AdminLetter> {
    const { data, error } = await supabase
      .from('operations_admin_letters')
      .update({ archive_status: status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;

    await this.logActivity(id, 'archive', `تم تغيير الحالة إلى ${ARCHIVE_STATUS_LABELS[status]}`, userId ?? null);
    return data as AdminLetter;
  }

  async uploadLetterFile(letter: AdminLetter, file: File, userId?: string | null): Promise<AdminLetter> {
    const path = buildLetterFileStoragePath(letter, file);

    if (letter.file_path) {
      await supabase.storage.from(ADMIN_LETTERS_BUCKET).remove([letter.file_path]);
    }

    const { error: uploadError } = await supabase.storage.from(ADMIN_LETTERS_BUCKET).upload(path, file, {
      upsert: false,
      contentType: file.type || undefined,
    });
    if (uploadError) throw uploadError;

    const { data, error } = await supabase
      .from('operations_admin_letters')
      .update({
        file_path: path,
        file_name: file.name,
        file_mime: file.type || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', letter.id)
      .select('*')
      .single();
    if (error) throw error;

    await this.logActivity(letter.id, 'upload', `تم رفع الملف: ${file.name}`, userId ?? null);
    return data as AdminLetter;
  }

  async getLetterFileUrl(filePath: string, expiresIn = 3600): Promise<string | null> {
    const { data, error } = await supabase.storage.from(ADMIN_LETTERS_BUCKET).createSignedUrl(filePath, expiresIn);
    if (error) throw error;
    return data?.signedUrl ?? null;
  }

  async deleteLetter(id: number, userId?: string | null): Promise<void> {
    const letter = await this.getLetterById(id);
    if (!letter) return;

    if (letter.file_path) {
      await supabase.storage.from(ADMIN_LETTERS_BUCKET).remove([letter.file_path]);
    }

    const { error } = await supabase.from('operations_admin_letters').delete().eq('id', id);
    if (error) throw error;

    await this.logActivity(id, 'delete', `تم حذف الكتاب ${letter.letter_number}`, userId ?? null);
  }

  async listActivity(letterId: number): Promise<AdminLetterActivity[]> {
    const { data, error } = await supabase
      .from('operations_admin_letter_activity')
      .select('*')
      .eq('letter_id', letterId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as AdminLetterActivity[];
  }

  async logActivity(letterId: number, action: string, details?: string | null, performedBy?: string | null): Promise<void> {
    const { error } = await supabase.from('operations_admin_letter_activity').insert({
      letter_id: letterId,
      action,
      details: details ?? null,
      performed_by: performedBy ?? null,
    });
    if (error) console.warn('Failed to log letter activity:', error.message);
  }

  async getArchiveStats(): Promise<AdminLetterStats> {
    const { data, error } = await supabase.from('operations_admin_letters').select('letter_type, archive_status, is_signed, requires_response, response_due_date');
    if (error) throw error;

    const rows = (data ?? []) as Pick<AdminLetter, 'letter_type' | 'archive_status' | 'is_signed' | 'requires_response' | 'response_due_date'>[];
    const today = new Date().toISOString().slice(0, 10);

    return {
      total: rows.length,
      outgoing: rows.filter((r) => r.letter_type === 'outgoing').length,
      incoming: rows.filter((r) => r.letter_type === 'incoming').length,
      unsigned: rows.filter((r) => !r.is_signed && r.archive_status === 'active').length,
      archived: rows.filter((r) => r.archive_status === 'archived').length,
      pendingResponse: rows.filter(
        (r) => r.requires_response && r.archive_status === 'active' && r.response_due_date && r.response_due_date >= today
      ).length,
    };
  }

  async exportLettersData(filters: AdminLetterFilters = {}): Promise<AdminLetter[]> {
    return this.listLetters(filters);
  }
}

export const operationsAdminLettersRepository = new OperationsAdminLettersRepository();
