import { requireAdmin } from '@/lib/auth/admin';
import AdminShell from '@/components/Admin/AdminShell';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Enforces server-side authentication & database admin role verification
  const { user } = await requireAdmin();

  return <AdminShell adminEmail={user.email}>{children}</AdminShell>;
}
