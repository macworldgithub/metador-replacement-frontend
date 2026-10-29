import { PortalScreen } from "@/components/portal-screen";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PortalScreen page="conversations" prospectId={id} />;
}
