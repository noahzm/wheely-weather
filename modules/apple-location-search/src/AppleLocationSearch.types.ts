/**
 * A city suggestion from MKLocalSearchCompleter. Completions carry no
 * coordinates, so `id` is handed back to `resolve` once the user picks one.
 */
export interface LocationSuggestion {
  id: string;
  label: string;
  displayName: string;
}

export interface ResolvedCoordinates {
  lat: number;
  lon: number;
}
