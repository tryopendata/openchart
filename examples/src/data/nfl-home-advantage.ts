/**
 * NFL regular-season home win rate and points per game, 1999-2025 (27 rows).
 *
 * VERIFIED 2026-11-22 against the OpenData dataset `nflverse/games` (view `all`),
 * reduced with: SELECT season, COUNT(*) AS games, ROUND(AVG(home_score +
 * away_score), 2) AS avg_total_points, ROUND(100 * AVG(CASE WHEN home_score >
 * away_score THEN 1.0 WHEN home_score = away_score THEN 0.5 ELSE 0 END), 1) AS
 * home_win_pct FROM data WHERE game_type = 'REG' AND home_score IS NOT NULL AND
 * season <= 2025 GROUP BY season. Ties count as half a win. The partial 2026
 * season is excluded. Home teams won 59.7% in 1999 and 49.8% in 2020, the
 * season played mostly without fans, the first below 50% in the file.
 */
export const nflHomeAdvantage = {
  source: 'Source: nflverse, NFL game results and schedules (regular seasons)',
  url: 'https://github.com/nflverse/nflverse-data/releases/tag/schedules',
  data: [
    { season: 1999, games: 248, avg_total_points: 41.63, home_win_pct: 59.7 },
    { season: 2000, games: 248, avg_total_points: 41.35, home_win_pct: 55.6 },
    { season: 2001, games: 248, avg_total_points: 40.42, home_win_pct: 54.8 },
    { season: 2002, games: 256, avg_total_points: 43.35, home_win_pct: 58.0 },
    { season: 2003, games: 256, avg_total_points: 41.66, home_win_pct: 61.3 },
    { season: 2004, games: 256, avg_total_points: 42.97, home_win_pct: 56.6 },
    { season: 2005, games: 256, avg_total_points: 41.23, home_win_pct: 59.0 },
    { season: 2006, games: 256, avg_total_points: 41.32, home_win_pct: 53.1 },
    { season: 2007, games: 256, avg_total_points: 43.38, home_win_pct: 57.4 },
    { season: 2008, games: 256, avg_total_points: 44.06, home_win_pct: 57.2 },
    { season: 2009, games: 256, avg_total_points: 42.93, home_win_pct: 57.0 },
    { season: 2010, games: 256, avg_total_points: 44.07, home_win_pct: 55.9 },
    { season: 2011, games: 256, avg_total_points: 44.36, home_win_pct: 56.6 },
    { season: 2012, games: 256, avg_total_points: 45.51, home_win_pct: 57.2 },
    { season: 2013, games: 256, avg_total_points: 46.82, home_win_pct: 60.0 },
    { season: 2014, games: 256, avg_total_points: 45.18, home_win_pct: 56.8 },
    { season: 2015, games: 256, avg_total_points: 45.63, home_win_pct: 53.9 },
    { season: 2016, games: 256, avg_total_points: 45.55, home_win_pct: 57.8 },
    { season: 2017, games: 256, avg_total_points: 43.44, home_win_pct: 56.6 },
    { season: 2018, games: 256, avg_total_points: 46.69, home_win_pct: 60.2 },
    { season: 2019, games: 256, avg_total_points: 45.63, home_win_pct: 51.8 },
    { season: 2020, games: 256, avg_total_points: 49.58, home_win_pct: 49.8 },
    { season: 2021, games: 272, avg_total_points: 45.96, home_win_pct: 51.7 },
    { season: 2022, games: 271, avg_total_points: 43.76, home_win_pct: 56.1 },
    { season: 2023, games: 272, avg_total_points: 43.54, home_win_pct: 55.5 },
    { season: 2024, games: 272, avg_total_points: 45.82, home_win_pct: 53.3 },
    { season: 2025, games: 272, avg_total_points: 46.03, home_win_pct: 53.9 },
  ],
};
