// Focus music stations — direct audio streams played through a plain HTML
// <audio> element. No YouTube embeds, no Spotify, no sign-in.
// Every URL below was verified live with curl (HTTP 200, audio/mpeg bytes)
// on 2026-11-17. Do NOT use https://stream.zeno.fm/75819890538uv — it
// returns 404.

export type StationGenre = 'lofi' | 'classical'

export interface Station {
  id: string
  name: string
  genre: StationGenre
  url: string
  blurb: string
}

export const STATIONS: Station[] = [
  {
    id: 'lofi-chill',
    name: 'Lofi Chill Beats',
    genre: 'lofi',
    url: 'https://stream.zeno.fm/f3wvbbqmdg8uv',
    blurb: 'Live lo-fi stream',
  },
  {
    id: 'ambient',
    name: 'Ambient Deep Focus',
    genre: 'lofi',
    url: 'https://stream.zeno.fm/0r0xa792kwzuv',
    blurb: 'Live ambient stream',
  },
  {
    id: 'chillhop',
    name: 'Chillhop Radio',
    genre: 'lofi',
    url: 'https://streams.ilovemusic.de/iloveradio17.mp3',
    blurb: 'Chillhop, 24/7',
  },
  {
    id: 'swiss-classic',
    name: 'Radio Swiss Classic',
    genre: 'classical',
    url: 'https://stream.srg-ssr.ch/srgssr/rsc_de/mp3/128',
    blurb: 'Classical, no ads',
  },
  {
    id: 'france-musique',
    name: 'France Musique',
    genre: 'classical',
    url: 'https://icecast.radiofrance.fr/francemusique-midfi.mp3',
    blurb: 'Classical from Radio France',
  },
  {
    id: 'classical24',
    name: 'Classical 24',
    genre: 'classical',
    url: 'https://cms.stream.publicradio.org/cms.mp3',
    blurb: 'Classical 24/7',
  },
]

export const SILENCE_ID = 'silence'

export function stationById(id: string): Station | undefined {
  return STATIONS.find((s) => s.id === id)
}
