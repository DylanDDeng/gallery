import AdminAccessGate from "@/components/AdminAccessGate";
import AdminDashboard from "@/components/AdminDashboard";
import { isAdminEmail } from "@/lib/admin";
import { createClient } from "@/lib/supabase-server";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <AdminAccessGate mode="signin" />;
  }

  if (!isAdminEmail(user.email)) {
    return <AdminAccessGate mode="forbidden" email={user.email} />;
  }

  return <AdminDashboard email={user.email} />;
}
