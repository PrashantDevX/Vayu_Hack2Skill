export const SOURCE_METADATA = {
  OPEN_METEO_MODEL: {
    name: 'Open-Meteo CAMS model',
    description: 'Modelled air-quality concentrations and forecasts; not a station observation.',
    url: 'https://open-meteo.com/en/docs/air-quality-api',
    type: 'model data',
    attribution: 'Attribution to Open-Meteo and the cited CAMS model data is required when redistributing provider data.',
  },
  CPCB_AQI_METHODOLOGY: {
    name: 'CPCB National AQI methodology',
    description: 'Indian National AQI pollutant breakpoints and calculation method.',
    url: 'https://airquality.cpcb.gov.in/ccr_docs/About_AQI.pdf',
    type: 'methodology',
    attribution: 'Cite CPCB as the methodology publisher; this is not an endorsement of a model-derived index.',
  },
  DATA_GOV_IN_STATION_DATA: {
    name: 'data.gov.in CPCB station data',
    description: 'Published station observations as supplied by the official data resource.',
    url: 'https://data.gov.in/',
    type: 'official observations',
    attribution: 'Attribute station observations to the data.gov.in resource and CPCB as the originating publisher when specified.',
  },
  WHO_AIR_QUALITY_GUIDELINES: {
    name: 'WHO air quality guidelines',
    description: 'WHO health guidance for air quality; not individualized medical advice.',
    url: 'https://www.who.int/publications/i/item/9789240034228',
    type: 'health guidance',
    attribution: 'Attribute guideline material to the World Health Organization; do not imply individualized medical advice.',
  },
  VAYU_TRANSPORT_FACTOR_METHODOLOGY: {
    name: 'Vayu transport factor methodology',
    description: 'Versioned planning factors used for deterministic transport comparisons.',
    url: '/docs/DATA_METHODOLOGY.md#transport-impact-factors',
    type: 'calculation methodology',
    attribution: "Identify this as Vayu's planning methodology, not a provider observation.",
  },
} as const

export type SourceId = keyof typeof SOURCE_METADATA
