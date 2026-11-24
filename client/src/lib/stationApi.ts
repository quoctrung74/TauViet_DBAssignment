import { api, type ApiStation } from "./api";
import { setStationCatalogue } from "./data";
let pending: Promise<void> | null = null;
export function refreshStations(): Promise<void> {
  if (pending) return pending;
  pending = api<{ stations: ApiStation[] }>("/stations")
    .then((result) => {
      setStationCatalogue(
        result.stations.map((row) => ({
          id: row.id,
          name: row.name,
          region: row.region,
          status: row.status,
        })),
      );
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}
