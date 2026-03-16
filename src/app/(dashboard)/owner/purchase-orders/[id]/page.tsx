export default function OwnerPODetail({ params }: { params: { id: string } }) {
  return (
    <div>
      <h1 className="text-2xl font-bold">Detail PO: {params.id}</h1>
      <p className="text-muted-foreground mt-1">Detail PO + price comparison + approval actions. (Phase 3)</p>
    </div>
  );
}
