export default function ManagerPODetail({ params }: { params: { id: string } }) {
  return (
    <div>
      <h1 className="text-2xl font-bold">Detail PO: {params.id}</h1>
      <p className="text-muted-foreground mt-1">Detail PO Anda. (Phase 2)</p>
    </div>
  );
}
