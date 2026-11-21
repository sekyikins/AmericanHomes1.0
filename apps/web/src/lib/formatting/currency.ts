export function formatGHS(pesewas: number): string {
  return (
    'GHS ' +
    (pesewas / 100).toLocaleString('en-GH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}
