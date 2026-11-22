import custodyDesks from "../../shared/custodyDesks.json"
import type { AdminOverview, ApiItem } from "./api"

const samples = [
  { id: 108, name: "Black leather wallet", category: "Accessories", location: "University Library, 2nd Floor", custodyDeskId: "osds", shelfTag: "Shelf B2", claimant: "M. Lomboy", requested: "18m ago", description: "A black wallet found near the library reading area." },
  { id: 105, name: "Silver laptop with clear case", category: "Electronics", location: "Gusaling Villegas, Room 302", custodyDeskId: "osds", shelfTag: "OSDS High-Value Locker — Bay 01", claimant: "C. Marquez", requested: "1h ago", description: "A silver laptop in a clear case, turned in after class." },
  { id: 102, name: "PLM student ID", category: "IDs and Cards", location: "University Activity Center", custodyDeskId: "gate", shelfTag: "Peer handover scheduled at OSDS Desk", claimant: "J. Aringo", requested: "3h ago", description: "A student ID recovered near the entrance. Identifying details are withheld." },
]

const sampleVerificationNotes: Record<number, string> = {
  108: "₱640 in cash (three ₱200 bills and two ₱20 bills), a Beep card, and a 2×2 ID photo in the inner flap.",
  105: "MacBook Air M1 in a clear case. The lock screen shows Mayon Volcano. The case has a PLM Haribon crest sticker and a small coffee cup sticker.",
  102: "PLM student ID belonging to J. Aringo, BS Architecture. Verify the printed student number against the claimant’s details.",
}

const sampleClaimantProof: Record<number, string> = {
  108: "My BPI Beep card and a 2×2 ID photo are inside the inner clear flap. I also remember three ₱200 bills and two ₱20 bills.",
  105: "The left sticker is the PLM Haribon crest and the right sticker is a coffee cup. My MacBook’s lock screen shows Mayon Volcano.",
  102: "The ID is on a dark green woven PLM lanyard. I can confirm my student number with the campus desk.",
}

const found: ApiItem[] = samples.map(({ id, name, category, location, custodyDeskId, shelfTag, description }) => ({
  id, name, category, location, custodyDeskId, description, status: "Pending Claim",
  date: "Sample record", image: `/items/${id === 108 ? "wallet" : id === 105 ? "laptop" : "student-id"}.jpg`,
  shelfTag, privateNotes: sampleVerificationNotes[id], reporter: "Campus desk", reporterRole: "PLM Staff",
}))

const otherReports: ApiItem[] = [
  {
    id: 109, name: "Matte Black Insulated Flask 32oz", category: "Accessories", status: "Found",
    location: "Gusaling Katipunan, 2nd Floor", custodyDeskId: "uac", shelfTag: "Rack 03",
    date: "Sample record", description: "A matte black insulated flask recovered from the second-floor corridor.",
    image: "/items/flask.jpg", reporter: "University Activity Center", reporterRole: "PLM Staff",
  },
  {
    id: 107, name: "Casio Scientific Calculator (fx-991EX)", category: "Electronics", status: "Found",
    location: "Gusaling Villegas, Room 204", custodyDeskId: "osds", shelfTag: "Shelf A-09",
    date: "Sample record", description: "A black scientific calculator turned in after class.",
    image: "/items/calculator.jpg", reporter: "Campus desk", reporterRole: "PLM Staff",
  },
  {
    id: 99, name: "Black AquaFlask 32oz w/ Sticker", category: "Accessories", status: "Lost",
    location: "Gusaling Katipunan, 2nd Floor", date: "Sample record", description: "A black insulated flask with a sticker was left after class.",
    image: "/items/flask.jpg", reporter: "A. Mendoza", reporterRole: "PLM Student",
  },
  {
    id: 94, name: "Casio ClassWiz fx-991EX Calculator", category: "Electronics", status: "Lost",
    location: "Gusaling Villegas, Room 204", date: "Sample record", description: "A scientific calculator was left in Room 204.",
    image: "/items/calculator.jpg", reporter: "R. Santos", reporterRole: "PLM Student",
  },
  {
    id: 88, name: "Blue Canvas Pencil Case & Gel Pens", category: "Books and Notes", status: "Returned",
    location: "University Library, 1st Floor", date: "Sample record", description: "A canvas pencil pouch with gel pens was returned to its owner.",
    image: "/items/pencil-case.jpg", reporter: "Campus desk", reporterRole: "PLM Staff",
  },
  {
    id: 111, name: "BPI Debit Card & PLM Student ID", category: "IDs and Cards", status: "Found", privacy: "Held",
    location: "Gusaling Lacson, Ground Floor", custodyDeskId: "back-gate", shelfTag: "Privacy intake shelf",
    date: "Sample record", description: "A debit card and student ID are held for review. Card digits and identifying details require redaction.",
    image: "/items/card.jpg", reporter: "A. Torres", reporterRole: "PLM Student",
  },
  {
    id: 112, name: "Printed Student Enrollment Record (SER)", category: "Books and Notes", status: "Found", privacy: "Held",
    location: "University Library, 2nd Floor", custodyDeskId: "library", shelfTag: "Privacy intake shelf",
    date: "Sample record", description: "A printed enrollment record is held for privacy review before public release.",
    image: "/items/document.jpg", reporter: "P. Reyes", reporterRole: "PLM Student",
  },
]

export const adminDemo: AdminOverview = {
  items: [
    ...found,
    ...found.map(({ id, name, category, location, description, date }) => ({
      id: id + 100, name, category, location, description, date, image: "",
      reporter: "Sample reporter", reporterRole: "PLM Student", status: "Lost" as const,
    })),
    ...otherReports,
  ],
  claims: samples.map(({ id, claimant, requested }) => ({
    id, itemId: id, claimant, requested, accountType: "PLM Student", status: "Pending",
    verified: true, explanation: sampleClaimantProof[id],
    ...(id === 108 && { proof: "/items/wallet.jpg" }),
  })),
  desks: custodyDesks,
  matches: [
    { lostId: 99, foundId: 109, linked: false },
    { lostId: 94, foundId: 105, linked: false },
    { lostId: 94, foundId: 107, linked: false },
    { lostId: 99, foundId: 108, linked: true },
  ],
  users: [],
  notifications: [],
  claimThreads: samples.map(({ id, name }) => ({
    claimId: id,
    messages: [
      { id: 1, mine: false, text: `I submitted ownership details for the ${name.toLowerCase()}.`, time: "Sample" },
      { id: 2, mine: true, text: "The campus desk has received the claim and is checking the evidence.", time: "Sample" },
    ],
  })),
  stats: {
    items: found.length * 2 + otherReports.length, pendingClaims: 3, inCustody: 14, activeReports: 38, returnedItems: 142, returnRate: 92,
    analytics: [
      { location: "University Library", reports: 48, returned: 45 },
      { location: "Gusaling Villegas (GV)", reports: 39, returned: 35 },
      { location: "University Activity Center", reports: 31, returned: 29 },
      { location: "Gusaling Katipunan (GK)", reports: 24, returned: 21 },
      { location: "Gusaling Lacson (GL)", reports: 19, returned: 17 },
    ],
  },
}

export function combineAdminRecords(live: AdminOverview) {
  const liveItemIds = new Set(live.items.map((item) => item.id))
  const liveClaimIds = new Set(live.claims.map((claim) => claim.id))
  const liveDeskById = new Map(live.desks.map((desk) => [desk.id, desk]))
  const liveDeskIds = new Set(custodyDesks.filter((desk) => liveDeskById.has(desk.id)).map((desk) => desk.id))
  const desks = custodyDesks.map((desk) => ({ ...desk, active: liveDeskById.get(desk.id)?.active ?? desk.active }))
  const items = adminDemo.items.filter((item) => !liveItemIds.has(item.id))
  const itemIds = new Set(items.map((item) => item.id))
  const claims = adminDemo.claims.filter((claim) => itemIds.has(claim.itemId) && !liveClaimIds.has(claim.id))
  const liveMatchKeys = new Set(live.matches.map(({ lostId, foundId }) => `${lostId}:${foundId}`))
  const matches = adminDemo.matches.filter(({ lostId, foundId }) =>
    itemIds.has(lostId) && itemIds.has(foundId) && !liveMatchKeys.has(`${lostId}:${foundId}`))
  const data: AdminOverview = {
    ...live,
    items: [...items, ...live.items],
    claims: [...claims, ...live.claims],
    desks,
    matches: [...matches, ...live.matches],
    claimThreads: [...live.claimThreads, ...adminDemo.claimThreads.filter((thread) => claims.some((claim) => claim.id === thread.claimId))],
    stats: { ...live.stats, pendingClaims: live.stats.pendingClaims + claims.length },
  }
  return {
    data, itemIds, liveDeskIds,
    claimIds: new Set(claims.map((claim) => claim.id)),
  }
}
