/**
 * Earthquakes of magnitude 2.5 and above, counted per 0.1 magnitude bin (1,603 quakes).
 *
 * Rows are the OpenData dataset `usgs/earthquakes` (view `default`), queried on
 * 2026-11-22 with:
 * SELECT ROUND(FLOOR(mag*10)/10,1) AS magnitude_bin, COUNT(*) AS quakes FROM data
 * WHERE type='earthquake' AND mag IS NOT NULL GROUP BY 1 ORDER BY 1
 *
 * The table is a frozen snapshot of January 2026, although the dataset description says
 * "past 30 days". Metadata lists the data as public domain. The counts fall from 119 at
 * 2.5 to 8 at 3.9 and rise again to 94 at 4.5; the metadata does not explain that shape.
 */
export const earthquakeMagnitudes = {
  source: 'Source: USGS Earthquake Catalog, magnitude 2.5+, January 2026 snapshot',
  url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/csv.php',
  data: [
    { magnitude_bin: 2.4, quakes: 19 },
    { magnitude_bin: 2.5, quakes: 119 },
    { magnitude_bin: 2.6, quakes: 96 },
    { magnitude_bin: 2.7, quakes: 111 },
    { magnitude_bin: 2.8, quakes: 85 },
    { magnitude_bin: 2.9, quakes: 63 },
    { magnitude_bin: 3.0, quakes: 71 },
    { magnitude_bin: 3.1, quakes: 65 },
    { magnitude_bin: 3.2, quakes: 43 },
    { magnitude_bin: 3.3, quakes: 40 },
    { magnitude_bin: 3.4, quakes: 41 },
    { magnitude_bin: 3.5, quakes: 29 },
    { magnitude_bin: 3.6, quakes: 17 },
    { magnitude_bin: 3.7, quakes: 22 },
    { magnitude_bin: 3.8, quakes: 15 },
    { magnitude_bin: 3.9, quakes: 8 },
    { magnitude_bin: 4.0, quakes: 27 },
    { magnitude_bin: 4.1, quakes: 42 },
    { magnitude_bin: 4.2, quakes: 56 },
    { magnitude_bin: 4.3, quakes: 64 },
    { magnitude_bin: 4.4, quakes: 86 },
    { magnitude_bin: 4.5, quakes: 94 },
    { magnitude_bin: 4.6, quakes: 67 },
    { magnitude_bin: 4.7, quakes: 54 },
    { magnitude_bin: 4.8, quakes: 31 },
    { magnitude_bin: 4.9, quakes: 66 },
    { magnitude_bin: 5.0, quakes: 45 },
    { magnitude_bin: 5.1, quakes: 38 },
    { magnitude_bin: 5.2, quakes: 30 },
    { magnitude_bin: 5.3, quakes: 16 },
    { magnitude_bin: 5.4, quakes: 10 },
    { magnitude_bin: 5.5, quakes: 7 },
    { magnitude_bin: 5.6, quakes: 8 },
    { magnitude_bin: 5.7, quakes: 4 },
    { magnitude_bin: 5.8, quakes: 1 },
    { magnitude_bin: 5.9, quakes: 4 },
    { magnitude_bin: 6.0, quakes: 3 },
    { magnitude_bin: 6.1, quakes: 1 },
    { magnitude_bin: 6.2, quakes: 2 },
    { magnitude_bin: 6.4, quakes: 2 },
    { magnitude_bin: 6.5, quakes: 1 },
  ],
};
