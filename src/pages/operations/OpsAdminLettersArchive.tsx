import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, Plus, RefreshCw } from 'lucide-react';
import OperationsPageShell from '../../components/operations/OperationsPageShell';
import { Button } from '../../components/ui/button';
import LetterStatsCards from '../../components/operations/adminLetters/LetterStatsCards';
import LetterFiltersBar from '../../components/operations/adminLetters/LetterFiltersBar';
import LetterListTable from '../../components/operations/adminLetters/LetterListTable';
import LetterFormModal from '../../components/operations/adminLetters/LetterFormModal';
import LetterDetailDrawer from '../../components/operations/adminLetters/LetterDetailDrawer';
import LetterExportButton from '../../components/operations/adminLetters/LetterExportButton';
import {
  operationsAdminLettersRepository,
  type AdminLetter,
  type AdminLetterFilters,
  type AdminLetterStats,
} from '../../data/repositories/operationsAdminLettersRepository';

interface OpsAdminLettersArchiveProps {
  userId?: string;
}

export default function OpsAdminLettersArchive({ userId }: OpsAdminLettersArchiveProps) {
  const [letters, setLetters] = useState<AdminLetter[]>([]);
  const [stats, setStats] = useState<AdminLetterStats | null>(null);
  const [filters, setFilters] = useState<AdminLetterFilters>({ letterType: 'all', archiveStatus: 'all', signed: 'all' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editLetter, setEditLetter] = useState<AdminLetter | null>(null);
  const [selectedLetter, setSelectedLetter] = useState<AdminLetter | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, archiveStats] = await Promise.all([
        operationsAdminLettersRepository.listLetters(filters),
        operationsAdminLettersRepository.getArchiveStats(),
      ]);
      setLetters(list);
      setStats(archiveStats);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر تحميل الأرشيف');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  const relatedLetterMap = useMemo(() => {
    const map = new Map<number, AdminLetter>();
    letters.forEach((l) => map.set(l.id, l));
    return map;
  }, [letters]);

  function openCreate() {
    setEditLetter(null);
    setFormOpen(true);
  }

  function openEdit(letter: AdminLetter) {
    setEditLetter(letter);
    setDetailOpen(false);
    setFormOpen(true);
  }

  function openDetail(letter: AdminLetter) {
    setSelectedLetter(letter);
    setDetailOpen(true);
  }

  async function handleToggleSigned(letter: AdminLetter) {
    const signed = !letter.is_signed;
    const signedBy = signed ? prompt('اسم الموقّع:', 'المدير') || 'المدير' : undefined;
    await operationsAdminLettersRepository.toggleSigned(letter.id, signed, signedBy, userId);
    await load();
    if (selectedLetter?.id === letter.id) {
      const updated = await operationsAdminLettersRepository.getLetterById(letter.id);
      if (updated) setSelectedLetter(updated);
    }
  }

  async function handleArchive(letter: AdminLetter) {
    if (!confirm('نقل هذا الكتاب إلى الأرشيف؟')) return;
    await operationsAdminLettersRepository.setArchiveStatus(letter.id, 'archived', userId);
    await load();
    setDetailOpen(false);
  }

  async function handleRestore(letter: AdminLetter) {
    await operationsAdminLettersRepository.setArchiveStatus(letter.id, 'active', userId);
    await load();
    setDetailOpen(false);
  }

  async function handleDelete(letter: AdminLetter) {
    if (!confirm(`حذف الكتاب ${letter.letter_number} نهائياً؟`)) return;
    await operationsAdminLettersRepository.deleteLetter(letter.id, userId);
    await load();
    setDetailOpen(false);
  }

  return (
    <OperationsPageShell
      title="أرشيف الكتب الإدارية"
      subtitle="إدارة وأرشفة الكتب الصادرة والواردة والداخلية مع متابعة التوقيع والمرفقات"
      icon={Archive}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            تحديث
          </Button>
          <LetterExportButton filters={filters} />
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            كتاب جديد
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <LetterStatsCards stats={stats} loading={loading} />

        {error ? (
          <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            {error}
            <p className="mt-2 text-xs font-normal">
              تأكد من تشغيل migration Supabase: operations_admin_letters_archive
            </p>
          </div>
        ) : null}

        <LetterFiltersBar filters={filters} onChange={setFilters} />

        <LetterListTable
          letters={letters}
          loading={loading}
          onView={openDetail}
          onToggleSigned={(l) => void handleToggleSigned(l)}
          onArchive={(l) => void handleArchive(l)}
          onRestore={(l) => void handleRestore(l)}
        />
      </div>

      <LetterFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => void load()}
        userId={userId}
        editLetter={editLetter}
        relatedLetters={letters}
      />

      <LetterDetailDrawer
        letter={selectedLetter}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onEdit={openEdit}
        onToggleSigned={(l) => void handleToggleSigned(l)}
        onArchive={(l) => void handleArchive(l)}
        onRestore={(l) => void handleRestore(l)}
        onDelete={(l) => void handleDelete(l)}
        relatedLetter={
          selectedLetter?.related_letter_id
            ? relatedLetterMap.get(selectedLetter.related_letter_id) ?? null
            : null
        }
      />
    </OperationsPageShell>
  );
}
