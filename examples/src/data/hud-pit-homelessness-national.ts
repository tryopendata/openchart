/**
 * People counted as homeless on a single night in January, by year, 2007-2024, split
 * into sheltered and unsheltered.
 *
 * Rows come from the OpenData dataset `hud/pit-homelessness` (view `all`), verified
 * 2026-11-22: the 50 states and DC summed, with territories and the table's own total
 * row excluded.
 *
 * The 2021 unsheltered count (54,391, against 222,061 in 2020) is not comparable with
 * other years: many communities skipped the unsheltered count that year.
 */
export const hudPitHomelessnessNational = {
  source:
    'Source: US Department of Housing and Urban Development, Annual Homeless Assessment Report (point-in-time counts)',
  url: 'https://www.huduser.gov/portal/datasets/ahar.html',
  data: [
    { year: 2007, total_homeless: 641665.0, sheltered: 389858.0, unsheltered: 251807.0 },
    { year: 2008, total_homeless: 635445.0, sheltered: 385333.0, unsheltered: 250112.0 },
    { year: 2009, total_homeless: 624598.0, sheltered: 401725.0, unsheltered: 222873.0 },
    { year: 2010, total_homeless: 630806.0, sheltered: 401865.0, unsheltered: 228941.0 },
    { year: 2011, total_homeless: 618611.0, sheltered: 390924.0, unsheltered: 227687.0 },
    { year: 2012, total_homeless: 616556.0, sheltered: 388516.0, unsheltered: 228040.0 },
    { year: 2013, total_homeless: 584483.0, sheltered: 393049.0, unsheltered: 191434.0 },
    { year: 2014, total_homeless: 570514.0, sheltered: 399434.0, unsheltered: 171080.0 },
    { year: 2015, total_homeless: 558573.0, sheltered: 389847.0, unsheltered: 168726.0 },
    { year: 2016, total_homeless: 544084.0, sheltered: 372049.0, unsheltered: 172035.0 },
    { year: 2017, total_homeless: 545566.0, sheltered: 359669.0, unsheltered: 185897.0 },
    { year: 2018, total_homeless: 547264.0, sheltered: 357365.0, unsheltered: 189899.0 },
    { year: 2019, total_homeless: 562184.0, sheltered: 355574.0, unsheltered: 206610.0 },
    { year: 2020, total_homeless: 575714.0, sheltered: 353653.0, unsheltered: 222061.0 },
    { year: 2021, total_homeless: 379813.0, sheltered: 325422.0, unsheltered: 54391.0 },
    { year: 2022, total_homeless: 577778.0, sheltered: 347872.0, unsheltered: 229906.0 },
    { year: 2023, total_homeless: 649535.0, sheltered: 395801.0, unsheltered: 253734.0 },
    { year: 2024, total_homeless: 767856.0, sheltered: 496506.0, unsheltered: 271350.0 },
  ],
};
