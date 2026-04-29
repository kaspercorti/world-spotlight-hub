export type Severity = "low" | "tension" | "active" | "war";
export type ConflictType =
  | "war"
  | "protest"
  | "terror"
  | "civil"
  | "cyber"
  | "explosion"
  | "shooting"
  | "robbery"
  | "arson"
  | "kidnapping"
  | "airstrike";
export type Verification = "unverified" | "partial" | "verified";

export interface Incident {
  id: string;
  timestamp: string; // ISO
  title: string;
  summary: string;
  type: ConflictType;
  verification: Verification;
  source: string;
}

export interface Conflict {
  id: string;
  name: string;
  region: string;
  country: string;
  lat: number;
  lng: number;
  severity: Severity;
  type: ConflictType;
  summary: string;
  actors: string[];
  incidents24h: number;
  riskLevel: number; // 1-10
  startedAt: string;
  sources: string[];
  recent: Incident[];
}

const now = Date.now();
const hoursAgo = (h: number) => new Date(now - h * 3600 * 1000).toISOString();

export const conflicts: Conflict[] = [
  {
    id: "ukr-ru",
    name: "War in Ukraine",
    region: "Eastern Europe",
    country: "Ukraine",
    lat: 48.3794, lng: 31.1656,
    severity: "war",
    type: "war",
    summary: "Ongoing full-scale war between Russia and Ukraine with active front lines in the east and south. Drone and missile strikes continue across multiple oblasts.",
    actors: ["Ukraine", "Russia", "Wagner Group"],
    incidents24h: 142,
    riskLevel: 10,
    startedAt: "2022-02-24",
    sources: ["ACLED", "ISW", "Reuters"],
    recent: [
      { id: "u1", timestamp: hoursAgo(2), title: "Drone strike on Kharkiv district", summary: "Multiple Shahed drones intercepted; residential damage reported.", type: "war", verification: "verified", source: "Reuters" },
      { id: "u2", timestamp: hoursAgo(6), title: "Artillery exchange near Avdiivka", summary: "Heavy shelling reported along the eastern front.", type: "war", verification: "verified", source: "ACLED" },
      { id: "u3", timestamp: hoursAgo(14), title: "Missile alert across 8 oblasts", summary: "Air raid sirens triggered nationwide overnight.", type: "war", verification: "partial", source: "OSINT" },
    ],
  },
  {
    id: "isr-gaza",
    name: "Israel–Gaza Conflict",
    region: "Middle East",
    country: "Israel / Palestine",
    lat: 31.5, lng: 34.47,
    severity: "war",
    type: "war",
    summary: "High-intensity military operations in Gaza alongside cross-border exchanges. Severe humanitarian crisis ongoing.",
    actors: ["IDF", "Hamas", "PIJ"],
    incidents24h: 88,
    riskLevel: 10,
    startedAt: "2023-10-07",
    sources: ["ACLED", "OCHA", "AP"],
    recent: [
      { id: "g1", timestamp: hoursAgo(1), title: "Airstrikes in northern Gaza", summary: "Multiple buildings reported struck.", type: "war", verification: "verified", source: "AP" },
      { id: "g2", timestamp: hoursAgo(8), title: "Rocket fire toward southern Israel", summary: "Iron Dome interceptions reported.", type: "war", verification: "verified", source: "Reuters" },
    ],
  },
  {
    id: "sudan",
    name: "Sudan Civil War",
    region: "Northeast Africa",
    country: "Sudan",
    lat: 15.5007, lng: 32.5599,
    severity: "war",
    type: "war",
    summary: "Conflict between the Sudanese Armed Forces and the Rapid Support Forces continues across Khartoum and Darfur.",
    actors: ["SAF", "RSF"],
    incidents24h: 54,
    riskLevel: 9,
    startedAt: "2023-04-15",
    sources: ["ACLED", "UN OCHA"],
    recent: [
      { id: "s1", timestamp: hoursAgo(3), title: "Clashes in Omdurman", summary: "Heavy gunfire reported in residential districts.", type: "war", verification: "verified", source: "ACLED" },
      { id: "s2", timestamp: hoursAgo(11), title: "Aid convoy blocked in Darfur", summary: "Humanitarian access severely restricted.", type: "civil", verification: "partial", source: "UN OCHA" },
    ],
  },
  {
    id: "myanmar",
    name: "Myanmar Civil War",
    region: "Southeast Asia",
    country: "Myanmar",
    lat: 21.9162, lng: 95.956,
    severity: "active",
    type: "war",
    summary: "Junta forces face coordinated offensives from ethnic armed organizations and the People's Defence Force.",
    actors: ["Tatmadaw", "PDF", "EAOs"],
    incidents24h: 31,
    riskLevel: 8,
    startedAt: "2021-02-01",
    sources: ["ACLED"],
    recent: [
      { id: "m1", timestamp: hoursAgo(5), title: "Resistance gains in Shan State", summary: "Multiple junta outposts reportedly overrun.", type: "war", verification: "partial", source: "OSINT" },
    ],
  },
  {
    id: "haiti",
    name: "Haiti Gang Crisis",
    region: "Caribbean",
    country: "Haiti",
    lat: 18.5944, lng: -72.3074,
    severity: "active",
    type: "civil",
    summary: "Armed gangs control large parts of Port-au-Prince. Mass displacement and breakdown of public services.",
    actors: ["G9 Coalition", "G-Pèp", "Haitian Police"],
    incidents24h: 22,
    riskLevel: 8,
    startedAt: "2024-03-01",
    sources: ["ACLED", "BBC"],
    recent: [
      { id: "h1", timestamp: hoursAgo(4), title: "Gang clashes near port", summary: "Civilians fleeing affected neighborhoods.", type: "civil", verification: "verified", source: "BBC" },
    ],
  },
  {
    id: "sahel",
    name: "Sahel Insurgency",
    region: "West Africa",
    country: "Mali / Burkina Faso / Niger",
    lat: 14.5, lng: -1.5,
    severity: "active",
    type: "terror",
    summary: "Jihadist insurgencies spread across the Sahel with frequent attacks on military and civilian targets.",
    actors: ["JNIM", "ISGS", "National armies"],
    incidents24h: 19,
    riskLevel: 8,
    startedAt: "2012-01-01",
    sources: ["ACLED"],
    recent: [
      { id: "sa1", timestamp: hoursAgo(7), title: "Convoy ambushed in Burkina Faso", summary: "Security forces engaged armed group.", type: "terror", verification: "partial", source: "ACLED" },
    ],
  },
  {
    id: "yemen",
    name: "Yemen Conflict",
    region: "Arabian Peninsula",
    country: "Yemen",
    lat: 15.5527, lng: 48.5164,
    severity: "active",
    type: "war",
    summary: "Houthi forces continue maritime strikes in the Red Sea while internal hostilities persist.",
    actors: ["Houthis", "Yemeni Government", "Coalition"],
    incidents24h: 12,
    riskLevel: 7,
    startedAt: "2014-09-21",
    sources: ["ACLED", "Reuters"],
    recent: [
      { id: "y1", timestamp: hoursAgo(9), title: "Drone attack on Red Sea vessel", summary: "Commercial shipping rerouted.", type: "war", verification: "verified", source: "Reuters" },
    ],
  },
  {
    id: "drc",
    name: "Eastern DRC Conflict",
    region: "Central Africa",
    country: "DR Congo",
    lat: -1.6835, lng: 29.2336,
    severity: "active",
    type: "war",
    summary: "M23 rebels and other armed groups clash with FARDC across North Kivu.",
    actors: ["M23", "FARDC", "ADF"],
    incidents24h: 17,
    riskLevel: 8,
    startedAt: "2022-03-01",
    sources: ["ACLED", "MONUSCO"],
    recent: [
      { id: "d1", timestamp: hoursAgo(6), title: "Displacement near Goma", summary: "Tens of thousands flee renewed clashes.", type: "civil", verification: "verified", source: "MONUSCO" },
    ],
  },
  {
    id: "syria",
    name: "Syria Residual Conflict",
    region: "Levant",
    country: "Syria",
    lat: 35.0, lng: 38.0,
    severity: "tension",
    type: "war",
    summary: "Localized clashes, drone strikes, and ongoing instability across multiple zones of control.",
    actors: ["SDF", "HTS", "Government", "Foreign forces"],
    incidents24h: 9,
    riskLevel: 6,
    startedAt: "2011-03-15",
    sources: ["ACLED"],
    recent: [
      { id: "sy1", timestamp: hoursAgo(10), title: "Strike near Deir ez-Zor", summary: "Reports of casualties at military site.", type: "war", verification: "partial", source: "OSINT" },
    ],
  },
  {
    id: "tw-strait",
    name: "Taiwan Strait Tensions",
    region: "East Asia",
    country: "Taiwan",
    lat: 23.6978, lng: 120.9605,
    severity: "tension",
    type: "war",
    summary: "Increased PLA air and naval activity around Taiwan; no kinetic engagement.",
    actors: ["PRC", "Taiwan", "USA"],
    incidents24h: 6,
    riskLevel: 5,
    startedAt: "2022-08-01",
    sources: ["MND Taiwan"],
    recent: [
      { id: "t1", timestamp: hoursAgo(12), title: "PLA aircraft cross median line", summary: "Multiple incursions reported overnight.", type: "war", verification: "verified", source: "MND" },
    ],
  },
  {
    id: "fr-protest",
    name: "France Protests",
    region: "Western Europe",
    country: "France",
    lat: 46.2276, lng: 2.2137,
    severity: "tension",
    type: "protest",
    summary: "Ongoing demonstrations across major cities. Largely peaceful with isolated clashes.",
    actors: ["Unions", "Students", "Police"],
    incidents24h: 8,
    riskLevel: 4,
    startedAt: "2025-09-01",
    sources: ["AFP"],
    recent: [
      { id: "f1", timestamp: hoursAgo(3), title: "Rally in Paris", summary: "Tens of thousands march in central Paris.", type: "protest", verification: "verified", source: "AFP" },
    ],
  },
  {
    id: "cyber-eu",
    name: "Cyberattacks on EU Infrastructure",
    region: "Europe",
    country: "Multiple",
    lat: 50.8503, lng: 4.3517,
    severity: "tension",
    type: "cyber",
    summary: "Distributed attacks targeting government and energy services attributed to state-aligned groups.",
    actors: ["State-aligned APTs"],
    incidents24h: 14,
    riskLevel: 5,
    startedAt: "2024-01-01",
    sources: ["ENISA"],
    recent: [
      { id: "c1", timestamp: hoursAgo(5), title: "DDoS on ministry portal", summary: "Service degraded for several hours.", type: "cyber", verification: "verified", source: "ENISA" },
    ],
  },
  {
    id: "kashmir",
    name: "Kashmir Tensions",
    region: "South Asia",
    country: "India / Pakistan",
    lat: 34.0837, lng: 74.7973,
    severity: "tension",
    type: "war",
    summary: "Sporadic LoC exchanges and security operations continue.",
    actors: ["India", "Pakistan", "Militant groups"],
    incidents24h: 4,
    riskLevel: 5,
    startedAt: "1989-01-01",
    sources: ["ACLED"],
    recent: [],
  },
  {
    id: "balkans",
    name: "Western Balkans",
    region: "Southeast Europe",
    country: "Kosovo / Serbia",
    lat: 42.6026, lng: 20.903,
    severity: "low",
    type: "protest",
    summary: "Periodic political tensions; situation calm but monitored.",
    actors: ["Kosovo", "Serbia", "KFOR"],
    incidents24h: 1,
    riskLevel: 3,
    startedAt: "2023-05-01",
    sources: ["KFOR"],
    recent: [],
  },
  {
    id: "venezuela",
    name: "Venezuela–Guyana Dispute",
    region: "South America",
    country: "Venezuela / Guyana",
    lat: 6.4238, lng: -66.5897,
    severity: "tension",
    type: "war",
    summary: "Territorial dispute over Essequibo region with elevated military posturing.",
    actors: ["Venezuela", "Guyana"],
    incidents24h: 2,
    riskLevel: 4,
    startedAt: "2023-12-01",
    sources: ["Reuters"],
    recent: [],
  },
];

// Flat list of recent incidents across all conflicts
export const allIncidents = conflicts
  .flatMap((c) =>
    c.recent.map((i) => ({ ...i, conflictId: c.id, conflictName: c.name, lat: c.lat, lng: c.lng, severity: c.severity }))
  )
  .sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));
