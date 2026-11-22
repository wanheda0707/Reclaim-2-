import { createServer } from "node:http"
import { randomBytes, randomInt, scrypt as scryptCallback, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import custodyDesks from "../shared/custodyDesks.json" with { type: "json" }

const scrypt = promisify(scryptCallback)
const root = path.dirname(fileURLToPath(import.meta.url))
try {
  const envFile = await readFile(path.join(root, "..", ".env"), "utf8")
  for (const line of envFile.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2")
  }
} catch (error) {
  if (error.code !== "ENOENT") throw error
}
const dataDir = process.env.RECLAIM_DATA_DIR || path.join(root, "data")
const dataFile = path.join(dataDir, "reclaim.json")
const port = Number(process.env.API_PORT || process.env.PORT || 3001)
const host = process.env.API_HOST || "127.0.0.1"
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://sqicephynnalidwgbxof.supabase.co"
const supabasePublicKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const maxBodyBytes = 6 * 1024 * 1024
const sessions = new Map()
const challenges = new Map()
const preverifiedEmails = new Map()
const resetVerifiedEmails = new Map()
const answerAttempts = new Map()
let graphToken
let graphTokenExpires = 0
const emptyDb = {
  users: [], items: [], claims: [], conversations: [], notifications: [], matches: [],
  desks: custodyDesks,
}
const seedItems = [
  { id: 1, name: "Black leather wallet", category: "Accessories", status: "Found", date: "May 18, 2025", createdAt: "2025-05-18T09:00:00.000Z", location: "University Library, 2nd floor", description: "A slim black leather wallet was found beside the north reading area. Contents are secured and will be used only for ownership verification.", image: "https://images.unsplash.com/photo-1579014134953-1580d7f123f3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080", reporter: "Mika Reyes", reporterRole: "PLM Student", ownerId: "seed-mika", question: "What small symbol is embossed inside the wallet?", answer: "star" },
  { id: 2, name: "Silver laptop with clear case", category: "Electronics", status: "Lost", date: "May 17, 2025", createdAt: "2025-05-17T15:30:00.000Z", location: "Gusaling Villegas, Room 307", description: "13-inch silver laptop in a clear shell with two small stickers near the trackpad. Last seen after an afternoon lecture.", image: "https://images.unsplash.com/photo-1589979034086-5885b60c8f59?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080", reporter: "Paolo Santos", reporterRole: "PLM Student", ownerId: "seed-paolo", rewardType: "money", rewardAmount: "500" },
  { id: 3, name: "PLM student ID", category: "IDs and Cards", status: "Found", date: "May 17, 2025", createdAt: "2025-05-17T14:00:00.000Z", location: "University Activity Center", description: "Student identification card found near the west entrance. The name and number are hidden for the owner’s privacy.", image: "https://images.unsplash.com/photo-1606761568499-6d2451b23c66?auto=format&fit=crop&w=1200&q=80", reporter: "Elena Cruz", reporterRole: "PLM Staff", ownerId: "seed-elena", question: "What is the last digit of your student number?", answer: "7" },
  { id: 4, name: "White wireless earbuds", category: "Electronics", status: "Pending Claim", date: "May 16, 2025", createdAt: "2025-05-16T13:00:00.000Z", location: "Tanghalang Bayan", description: "Wireless earbuds in a white charging case, found under a seat after a student assembly.", image: "https://images.unsplash.com/photo-1498049794561-7780e7231661?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080", reporter: "Mika Reyes", reporterRole: "PLM Student", ownerId: "seed-mika", question: "What word is written under the case?", answer: "north" },
  { id: 5, name: "Scientific calculator", category: "Electronics", status: "Found", date: "May 15, 2025", createdAt: "2025-05-15T12:00:00.000Z", location: "College of Engineering lobby", description: "Dark scientific calculator with a protective cover and a faded label on the back.", image: "https://images.unsplash.com/photo-1516201580490-33550d32de5c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080", reporter: "Nathan Lim", reporterRole: "PLM Student", ownerId: "seed-nathan", question: "What are the initials on the back label?", answer: "ncl" },
  { id: 6, name: "Constitutional Law notes", category: "Books and Notes", status: "Lost", date: "May 15, 2025", createdAt: "2025-05-15T10:00:00.000Z", location: "Justo Albert Auditorium", description: "Blue binder containing handwritten Constitutional Law notes and highlighted reading materials.", image: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=1200&q=80", reporter: "Alyssa Mendoza", reporterRole: "PLM Student", ownerId: "seed-alyssa", rewardType: "other", rewardDescription: "Coffee and a meal voucher" },
  { id: 7, name: "Keyring with blue tag", category: "Accessories", status: "Returned", date: "May 14, 2025", createdAt: "2025-05-14T16:00:00.000Z", location: "PLM Chapel walkway", description: "Three keys on a silver ring with a small blue acrylic tag. Successfully returned to its owner.", image: "https://images.unsplash.com/photo-1582139329536-e7284fece509?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080", reporter: "Mika Reyes", reporterRole: "PLM Student", ownerId: "seed-mika" },
  { id: 8, name: "Android smartphone", category: "Electronics", status: "Found", date: "May 14, 2025", createdAt: "2025-05-14T14:00:00.000Z", location: "Intramuros Gate entrance", description: "Dark Android phone in a textured case. Screen is locked and the device is being kept safely.", image: "https://images.unsplash.com/photo-1542351967-d5ae722fed71?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080", reporter: "Carlos Villanueva", reporterRole: "External User", ownerId: "seed-carlos", question: "What color is the lock-screen wallpaper?", answer: "green" },
  { id: 9, name: "Cream folding umbrella", category: "Others", status: "Lost", date: "May 13, 2025", createdAt: "2025-05-13T11:00:00.000Z", location: "Pamantasan Gymnasium", description: "Compact cream umbrella with a wooden handle and a tan wrist strap.", image: "https://images.unsplash.com/photo-1551492625-0ad059e5f5e5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080", reporter: "Bea Navarro", reporterRole: "PLM Student", ownerId: "seed-bea", rewardType: "none" },
]
let writeQueue = Promise.resolve()
function persist() {
  const snapshot = JSON.stringify(db, null, 2)
  writeQueue = writeQueue.catch(() => {}).then(async () => {
    await writeFile(`${dataFile}.tmp`, snapshot)
    await rename(`${dataFile}.tmp`, dataFile)
  })
  return writeQueue
}

await mkdir(dataDir, { recursive: true })
let db
try {
  db = { ...emptyDb, ...JSON.parse(await readFile(dataFile, "utf8")) }
} catch (error) {
  if (error.code !== "ENOENT") throw error
  db = structuredClone(emptyDb)
  await persist()
}

if (!Array.isArray(db.items) || db.items.length === 0) {
  db.items = structuredClone(seedItems)
  await persist()
}

const previousDesks = new Map((db.desks ?? []).map((desk) => [desk.id, desk]))
const deskAliases = new Map([["vault", "osds"], ["library-security", "library"], ["main-gate", "gate"]])
const currentDeskIds = new Set(custodyDesks.map((desk) => desk.id))
const updatedDesks = custodyDesks.map((desk) => {
  const existing = previousDesks.get(desk.id) ??
    [...previousDesks.values()].find((entry) => deskAliases.get(entry.id) === desk.id)
  return { ...desk, active: existing?.active ?? desk.active }
})
let custodyChanged = JSON.stringify(db.desks) !== JSON.stringify(updatedDesks)
db.desks = updatedDesks
for (const item of db.items) {
  const deskId = item.custodyDeskId
  if (!deskId || currentDeskIds.has(deskId)) continue
  const replacement = deskAliases.get(deskId)
  if (replacement) {
    item.custodyDeskId = replacement
  } else {
    item.previousCustodyDesk = previousDesks.get(deskId)?.name || item.previousCustodyDesk || "Former custody desk"
    delete item.custodyDeskId
  }
  custodyChanged = true
}
if (custodyChanged) await persist()

const send = (res, status, body) => {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  })
  res.end(JSON.stringify(body))
}

async function body(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > maxBodyBytes) throw Object.assign(new Error("Request is too large."), { status: 413 })
    chunks.push(chunk)
  }
  if (!size) return {}
  try {
    const input = JSON.parse(Buffer.concat(chunks).toString("utf8"))
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error()
    return input
  }
  catch { throw Object.assign(new Error("Request body must be valid JSON."), { status: 400 }) }
}

const clean = (value, max = 500) => String(value ?? "").trim().slice(0, max)
const required = (value, label, max = 500) => {
  const result = clean(value, max)
  if (!result) throw Object.assign(new Error(`${label} is required.`), { status: 400 })
  return result
}
const id = (prefix = "") => `${prefix}${randomBytes(12).toString("hex")}`
const dateNow = () => new Date().toISOString()
const displayDate = () => new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date())
const publicUser = (user) => {
  const { passwordHash, ...safe } = user
  if (safe.accountType === "PLM" || safe.accountType === "PLM Student") {
    safe.accountType = "PLM Resident"
  }
  if (safe.role === "PLM" || safe.role === "PLM Student") {
    safe.role = "PLM Resident"
  }
  return safe
}
const userById = (userId) => db.users.find((entry) => entry.id === userId)
const itemById = (itemId) => db.items.find((entry) => entry.id === itemId)

function currentSession(req) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "")
  return token ? sessions.get(token) : undefined
}
function currentUser(req) {
  return userById(currentSession(req)?.userId)
}
function requireUser(req) {
  const user = currentUser(req)
  if (!user) throw Object.assign(new Error("Sign in to continue."), { status: 401 })
  return user
}
async function supabaseRequest(path, options = {}) {
  if (!supabaseUrl || !supabaseServiceRoleKey) throw Object.assign(new Error("Supabase admin storage is not configured."), { status: 503, code: "SUPABASE_NOT_CONFIGURED" })
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: { apikey: supabaseServiceRoleKey, Authorization: `Bearer ${supabaseServiceRoleKey}`, "Content-Type": "application/json", ...(options.headers || {}) },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new Error(payload.message || payload.error || "Supabase request failed."), { status: 502 })
  return payload
}
async function supabaseProfile(authId) {
  const [profile] = await supabaseRequest(`profiles?select=full_name,is_admin&id=eq.${encodeURIComponent(authId)}&limit=1`)
  return profile
}
async function isAdmin(req) {
  const authId = currentSession(req)?.authId
  return Boolean(authId && (await supabaseProfile(authId))?.is_admin === true)
}
async function requireAdmin(req) {
  const user = requireUser(req)
  if (!(await isAdmin(req))) throw Object.assign(new Error("Administrator access is required."), { status: 403, code: "ADMIN_REQUIRED" })
  return user
}
function makeSession(user, authId) {
  const token = randomBytes(32).toString("hex")
  sessions.set(token, { userId: user.id, authId })
  return { token, user: publicUser(user) }
}
async function passwordHash(password, salt = randomBytes(16).toString("hex")) {
  const derived = await scrypt(password, salt, 64)
  return `${salt}:${derived.toString("hex")}`
}
async function passwordMatches(password, stored) {
  if (!stored) return false
  const [salt, value] = stored.split(":")
  const derived = await scrypt(password, salt, 64)
  const expected = Buffer.from(value, "hex")
  return expected.length === derived.length && timingSafeEqual(expected, derived)
}
function makeCode(email, purpose) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0")
  challenges.set(`${purpose}:${email}`, { code, expiresAt: Date.now() + 15 * 60_000, attempts: 0 })
  return code
}
function verifyCode(email, purpose, code) {
  const key = `${purpose}:${email}`
  const challenge = challenges.get(key)
  if (!challenge || challenge.expiresAt < Date.now() || challenge.attempts >= 5) {
    challenges.delete(key)
    throw Object.assign(new Error("That code is expired. Request a new one."), { status: 400 })
  }
  challenge.attempts += 1
  if (challenge.code !== clean(code, 6)) throw Object.assign(new Error("The verification code is incorrect."), { status: 400 })
  challenges.delete(key)
}
function addNotification(userId, type, title, text, target) {
  db.notifications.unshift({ id: id("n_"), userId, type, title, text, time: "Just now", unread: true, target })
}
function notifyPrototypeCode(purpose, email, code) {
  return sendVerificationEmail(purpose, email, code).then(() => {
    if (!process.env.MS_GRAPH_CLIENT_ID && process.env.NODE_ENV !== "production") {
      console.info(`[ReClaim demo] ${purpose} code for ${email}: ${code}`)
      return { demoCode: code }
    }
    return {}
  })
}

async function sendVerificationEmail(purpose, email, code) {
  const { MS_GRAPH_TENANT_ID: tenant, MS_GRAPH_CLIENT_ID: clientId, MS_GRAPH_CLIENT_SECRET: clientSecret, MS_GRAPH_SENDER: sender } = process.env
  if (!(tenant && clientId && clientSecret && sender)) {
    if (process.env.NODE_ENV === "production") throw Object.assign(new Error("Email delivery is not configured. Contact the ReClaim administrator."), { status: 503 })
    console.info(`[ReClaim demo] ${purpose} code for ${email}: ${code}`)
    return
  }
  if (!graphToken || graphTokenExpires < Date.now() + 60_000) {
    const tokenResponse = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" }),
    })
    const tokenData = await tokenResponse.json()
    if (!tokenResponse.ok) throw Object.assign(new Error("Microsoft email service could not authorize ReClaim."), { status: 502 })
    graphToken = tokenData.access_token
    graphTokenExpires = Date.now() + Number(tokenData.expires_in || 3600) * 1000
  }
  const reset = purpose.toLowerCase().includes("reset")
  const subject = reset ? "ReClaim password reset code" : "Verify your email for ReClaim"
  const message = reset
    ? `Your ReClaim password reset code is ${code}. It expires in 15 minutes. If you did not request this, ignore this email.`
    : `Your ReClaim verification code is ${code}. It expires in 15 minutes. Enter it in ReClaim to continue creating your account.`
  const response = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`, {
    method: "POST", headers: { authorization: `Bearer ${graphToken}`, "content-type": "application/json" },
    body: JSON.stringify({ message: { subject, body: { contentType: "Text", content: message }, toRecipients: [{ emailAddress: { address: email } }] }, saveToSentItems: true }),
  })
  if (!response.ok) throw Object.assign(new Error("Could not deliver the verification email."), { status: 502 })
}

const validPlmEmail = (email) => /^[^\s@]+@plm\.edu\.ph$/i.test(email)
const validPassword = (password) => /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password)

function fail(status, message) {
  throw Object.assign(new Error(message), { status })
}

function normalizeItemImage(item) {
  if (!item?.image || item.image.startsWith("/items/")) return item
  if (!item.image.startsWith("http")) return item
  const name = item.name.toLowerCase()
  let image = "/items/document.svg"
  if (name.includes("wallet")) image = "/items/wallet.svg"
  else if (name.includes("laptop")) image = "/items/laptop.svg"
  else if (name.includes("student id")) image = "/items/student-id.svg"
  else if (name.includes("flask") || name.includes("bottle")) image = "/items/flask.svg"
  else if (name.includes("calculator")) image = "/items/calculator.svg"
  else if (name.includes("pencil")) image = "/items/pencil-case.svg"
  else if (name.includes("phone") || name.includes("earbud")) image = "/items/phone.svg"
  else if (item.category === "IDs and Cards") image = "/items/card.svg"
  return { ...item, image }
}

function itemForUser(item, user) {
  if (!item || (item.privacy === "Held" && item.ownerId !== user.id)) return null
  const normalized = normalizeItemImage(item)
  if (normalized.ownerId === user.id) return normalized
  const { answer, privateNotes, originalContent, ...visible } = normalized
  return visible
}

function reviewClaim(claim, item, status) {
  if (!["Approved", "Rejected"].includes(status)) fail(400, "Choose Approved or Rejected.")
  if (claim.status === status) return
  if (claim.status !== "Pending" || !["Found", "Pending Claim", "Claimed"].includes(item.status)) fail(409, "This claim is no longer open for review.")
  if (status === "Approved" && item.status === "Claimed") fail(409, "Another claim has already been approved.")
  claim.status = status
  if (status === "Approved") {
    item.approvedClaimantId = claim.claimantId
    item.status = "Claimed"
  } else if (item.status !== "Claimed") {
    item.status = db.claims.some((entry) => entry.itemId === item.id && entry.status === "Pending") ? "Pending Claim" : "Found"
  }
  addNotification(claim.claimantId, "claim", `Claim ${status.toLowerCase()}`, `Your claim for ${item.name} was ${status.toLowerCase()}.`, "activity")
}

function completeReturn(item) {
  if (item.status === "Returned") return
  if (item.status !== "Claimed" || !item.approvedClaimantId) fail(409, "Approve an ownership claim before recording the handover.")
  item.returnClaimSnapshot = Object.fromEntries(db.claims.filter((entry) => entry.itemId === item.id).map((entry) => [entry.id, entry.status]))
  item.status = "Returned"
  addNotification(item.ownerId, "return", "Item successfully returned", `${item.name} was marked as returned.`, "activity")
  addNotification(item.approvedClaimantId, "return", "Handover completed", `${item.name} was marked as returned to you.`, "activity")
  for (const claim of db.claims.filter((entry) => entry.itemId === item.id && entry.claimantId !== item.approvedClaimantId && entry.status !== "Rejected")) {
    claim.status = "Returned to another claimant"
    addNotification(claim.claimantId, "return", "Item returned to another claimant", "This item was returned to another claimant.", "activity")
  }
}

const nextItemId = () => db.items.reduce((next, item) => Math.max(next, item.id + 1), Date.now())
const nextConversationId = () => db.conversations.reduce((next, thread) => Math.max(next, thread.id + 1), Date.now())
const nextMessageId = (thread) => Math.max(Date.now(), (thread.messages.at(-1)?.id || 0) + 1)
const isSensitive = (category) => category === "IDs and Cards"
const openFound = (item) => ["Found", "Pending Claim"].includes(item?.status) && item.privacy !== "Held"

function matchesFor(lost, found) {
  return lost?.status === "Lost" && lost.privacy !== "Held" && openFound(found) &&
    lost.category === found.category && lost.ownerId !== found.ownerId && Boolean(userById(lost.ownerId))
}

async function handleAdmin(req, res, route, method, user) {
  if (method === "GET" && route === "/api/admin/overview") {
    const users = db.users.filter((entry) => entry.emailVerified).map((entry) => ({
      id: entry.id, name: entry.name, email: entry.email, studentNumber: entry.studentNumber, staffId: entry.staffId,
      role: entry.id === user.id ? "Admin" : entry.accountType,
    }))
    const lostItems = db.items.filter((item) => item.status === "Lost")
    const foundItems = db.items.filter(openFound)
    const linked = new Set(db.matches.map((entry) => `${entry.lostId}:${entry.foundId}`))
    const matches = [
      ...lostItems.flatMap((lost) => foundItems.filter((found) => matchesFor(lost, found) && !linked.has(`${lost.id}:${found.id}`)).map((found) => ({
        lostId: lost.id, foundId: found.id, linked: false,
      }))),
      ...db.matches.map(({ lostId, foundId }) => ({ lostId, foundId, linked: true })),
    ]
    return send(res, 200, {
      users, items: db.items.map(normalizeItemImage), claims: db.claims, desks: db.desks, matches,
      notifications: db.notifications.filter((entry) => entry.userId === user.id),
      claimThreads: db.conversations.filter((entry) => entry.adminClaimId && entry.participantIds.includes(user.id)).map((entry) => ({
        claimId: entry.adminClaimId,
        messages: entry.messages.map((message) => ({
          id: message.id, text: message.text, time: message.time, mine: message.senderId === user.id,
        })),
      })),
      stats: {
        items: db.items.length,
        pendingClaims: db.claims.filter((claim) => claim.status === "Pending").length,
        returnedItems: db.presentationSeed ? 142 : db.items.filter((item) => item.status === "Returned").length,
        inCustody: db.presentationSeed ? 14 : db.items.filter((item) => (item.custodyDeskId || item.previousCustodyDesk) && item.status !== "Returned").length,
        activeReports: db.presentationSeed ? 38 : db.items.filter((item) => item.status !== "Returned" && item.privacy !== "Held").length,
        returnRate: db.presentationSeed ? 92 : 0,
        analytics: db.presentationSeed ? [
          { location: "University Library", reports: 48, returned: 45 },
          { location: "Gusaling Villegas (GV)", reports: 39, returned: 35 },
          { location: "University Activity Center", reports: 31, returned: 29 },
          { location: "Gusaling Katipunan (GK)", reports: 24, returned: 21 },
          { location: "Gusaling Lacson (GL)", reports: 19, returned: 17 },
        ] : [],
      },
    })
  }

  if (method === "POST" && route === "/api/admin/items") {
    const input = await body(req)
    const desk = db.desks.find((entry) => entry.id === input.deskId && entry.active)
    if (!desk) fail(400, "Select an active custody desk.")
    const category = required(input.category, "Category", 50)
    const item = {
      id: nextItemId(), name: required(input.name, "Item name", 120), category,
      location: required(input.location, "Found location", 160), status: "Found",
      description: required(input.description, "Public description", 1500), image: "",
      question: required(input.question, "Ownership question", 200),
      answer: required(input.answer, "Ownership answer", 200).toLowerCase(),
      privateNotes: clean(input.privateNotes, 1500), shelfTag: clean(input.shelfTag, 120),
      custodyDeskId: desk.id, privacy: isSensitive(category) ? "Held" : undefined,
      reporter: user.name, reporterRole: user.accountType, ownerId: user.id, date: displayDate(), createdAt: dateNow(),
    }
    db.items.unshift(item)
    await persist()
    return send(res, 201, { item })
  }

  const claimRoute = route.match(/^\/api\/admin\/claims\/(\d+)(\/messages)?$/)
  if (claimRoute && method === (claimRoute[2] ? "POST" : "PATCH")) {
    const input = await body(req)
    const claim = db.claims.find((entry) => entry.id === Number(claimRoute[1]))
    const item = claim && itemById(claim.itemId)
    if (!item) fail(404, "Claim not found.")
    if (claimRoute[2]) {
      const text = required(input.text, "Message", 2000)
      if (!userById(claim.claimantId) || claim.claimantId === user.id) fail(409, "The claimant cannot receive messages.")
      let thread = db.conversations.find((entry) => entry.adminClaimId === claim.id && entry.participantIds.includes(user.id))
      if (!thread) {
        thread = { id: nextConversationId(), itemId: item.id, adminClaimId: claim.id, participantIds: [user.id, claim.claimantId], messages: [] }
        db.conversations.unshift(thread)
      }
      thread.messages.push({ id: nextMessageId(thread), senderId: user.id, text, time: "Just now", readBy: [user.id] })
      addNotification(claim.claimantId, "message", "Message from the OSDS desk", `The OSDS desk sent you a message about ${item.name}.`, "chat")
    } else {
      reviewClaim(claim, item, input.status)
    }
    await persist()
    return send(res, 200, { claim, item })
  }

  const itemRoute = route.match(/^\/api\/admin\/items\/(\d+)\/(status|custody|privacy)$/)
  if (method === "PATCH" && itemRoute) {
    const input = await body(req)
    const item = itemById(Number(itemRoute[1]))
    if (!item) fail(404, "Item not found.")
    if (itemRoute[2] === "status") {
      if (input.status !== "Returned") fail(400, "Choose Returned to record a handover.")
      completeReturn(item)
    } else if (itemRoute[2] === "custody") {
      if (item.status === "Returned" || item.status === "Lost") fail(409, "Only recovered items awaiting release can change custody.")
      const desk = db.desks.find((entry) => entry.id === input.deskId && entry.active)
      if (input.deskId !== null && !desk) fail(400, "Select an active desk or With Finder.")
      item.custodyDeskId = desk?.id
      item.shelfTag = desk ? clean(input.shelfTag, 120) : undefined
      delete item.previousCustodyDesk
    } else if (input.action === "hold") {
      item.privacy = "Held"
    } else if (input.action === "publish") {
      if (item.privacy !== "Held") fail(409, "Only held reports can be published from privacy review.")
      const name = required(input.name, "Redacted title", 120)
      const description = required(input.description, "Redacted description", 1500)
      const question = item.question ? required(input.question, "Public ownership question", 200) : undefined
      item.originalContent ||= { name: item.name, description: item.description, image: item.image, question: item.question }
      Object.assign(item, { name, description, question, image: "", privacy: "Published" })
    } else {
      fail(400, "Choose hold or publish.")
    }
    await persist()
    return send(res, 200, { item })
  }

  if (method === "POST" && route === "/api/admin/matches") {
    const { lostId, foundId } = await body(req)
    const lost = itemById(Number(lostId))
    const found = itemById(Number(foundId))
    if (!db.matches.some((entry) => entry.lostId === Number(lostId) && entry.foundId === Number(foundId))) {
      if (!matchesFor(lost, found)) fail(409, "These reports are no longer eligible for a match.")
      db.matches.push({ lostId: lost.id, foundId: found.id, linkedAt: dateNow(), linkedBy: user.id })
      addNotification(lost.ownerId, "match", "Possible match found", `The OSDS desk identified ${found.name} in Browse as a possible match for ${lost.name}.`, "browse")
      await persist()
    }
    return send(res, 200, { ok: true })
  }

  const deskRoute = route.match(/^\/api\/admin\/desks\/([a-z-]+)$/)
  if (method === "PATCH" && deskRoute) {
    const input = await body(req)
    const desk = db.desks.find((entry) => entry.id === deskRoute[1])
    if (!desk) fail(404, "Custody desk not found.")
    if (typeof input.active !== "boolean") fail(400, "Supply an active or paused state.")
    desk.active = input.active
    await persist()
    return send(res, 200, { desk })
  }
  return send(res, 404, { error: "Admin endpoint not found." })
}

async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`)
  const route = url.pathname.replace(/\/+$/, "") || "/"
  const method = req.method || "GET"
  try {
    if (method === "GET" && route === "/api/health") return send(res, 200, { ok: true, service: "reclaim-api", custodyDeskCount: db.desks.length })

    if (method === "POST" && route === "/api/auth/register") {
      const input = await body(req)
      const email = required(input.email, "Email", 254).toLowerCase()
      const password = required(input.password, "Password", 200)
      const external = input.accountType === "External User"
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error("Enter a valid email address."), { status: 400 })
      if (!external && !validPlmEmail(email)) throw Object.assign(new Error("Use your official @plm.edu.ph email address for a PLM account."), { status: 400 })
      if (!validPassword(password)) throw Object.assign(new Error("Password must be 8+ characters and include an uppercase letter, a number, and a special character."), { status: 400 })
      if (db.users.some((user) => user.email === email)) throw Object.assign(new Error("An account with this email already exists."), { status: 409 })
      if (!preverifiedEmails.has(email) || preverifiedEmails.get(email) < Date.now()) throw Object.assign(new Error("Verify your email before submitting your details."), { status: 403 })
      const accountType = external ? "External User" : input.role === "staff" ? "PLM Staff" : "PLM Resident"
      const user = {
        id: id("u_"), name: required(input.name, "Full name", 100), email,
        accountType, role: accountType, phone: clean(input.phone, 30),
        passwordHash: await passwordHash(password), emailVerified: true,
        createdAt: dateNow(),
        ...(external ? { school: clean(input.school, 120) } : accountType === "PLM Student" ? { studentNumber: required(input.idNumber, "Student number", 40) } : { staffId: required(input.idNumber, "Staff ID", 40) }),
      }
      db.users.push(user)
      preverifiedEmails.delete(email)
      await persist()
      return send(res, 201, { message: "Account created. You can now sign in." })
    }

    if (method === "POST" && route === "/api/auth/start-registration") {
      const input = await body(req)
      const email = required(input.email, "Email", 254).toLowerCase()
      const external = input.accountType === "External User"
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error("Enter a valid email address."), { status: 400 })
      if (!external && !validPlmEmail(email)) throw Object.assign(new Error("Use your official @plm.edu.ph email address for a PLM account."), { status: 400 })
      if (db.users.some((entry) => entry.email === email)) throw Object.assign(new Error("An account with this email already exists."), { status: 409 })
      const code = makeCode(email, "verify")
      const delivery = await notifyPrototypeCode("Email verification", email, code)
      return send(res, 200, { message: "A verification code was sent to your email inbox.", ...delivery })
    }

    if (method === "POST" && route === "/api/auth/verify-registration-email") {
      const input = await body(req)
      const email = required(input.email, "Email", 254).toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error("Enter a valid email address."), { status: 400 })
      if (db.users.some((entry) => entry.email === email)) throw Object.assign(new Error("An account with this email already exists."), { status: 409 })
      verifyCode(email, "verify", input.code)
      preverifiedEmails.set(email, Date.now() + 30 * 60_000)
      return send(res, 200, { verified: true })
    }

    if (method === "POST" && route === "/api/auth/verify") {
      const input = await body(req)
      const email = required(input.email, "Email", 254).toLowerCase()
      if (!validPlmEmail(email)) throw Object.assign(new Error("Use your official @plm.edu.ph email address."), { status: 400 })
      const user = db.users.find((entry) => entry.email === email)
      if (!user) throw Object.assign(new Error("Account not found."), { status: 404 })
      verifyCode(email, "verify", input.code)
      user.emailVerified = true
      await persist()
      return send(res, 200, makeSession(user))
    }

    if (method === "POST" && route === "/api/auth/resend-verification") {
      const input = await body(req)
      const email = required(input.email, "Email", 254).toLowerCase()
      if (!validPlmEmail(email)) throw Object.assign(new Error("Use your official @plm.edu.ph email address."), { status: 400 })
      const user = db.users.find((entry) => entry.email === email)
      if (!user) return send(res, 200, { message: "If the account exists, a new code was generated." })
      if (user.emailVerified) throw Object.assign(new Error("This email is already verified."), { status: 409 })
      const code = makeCode(email, "verify")
      const delivery = await notifyPrototypeCode("Email verification", email, code)
      return send(res, 200, { message: "A new verification code was sent.", ...delivery })
    }

    if (method === "POST" && route === "/api/auth/supabase-session") {
      const input = await body(req)
      if (!supabasePublicKey || !supabaseServiceRoleKey) fail(503, "Supabase sign-in is not configured on the backend.")
      const accessToken = required(input.accessToken, "Supabase access token", 16_000)
      const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
        headers: { apikey: supabasePublicKey, Authorization: `Bearer ${accessToken}` },
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      }).catch(() => fail(502, "Could not reach Supabase Auth."))
      if (response.status === 401 || response.status === 403) fail(401, "Supabase could not verify this sign-in.")
      if (!response.ok) fail(502, "Supabase Auth could not verify the session.")
      const identity = await response.json()
      const email = identity.email?.toLowerCase()
      if (!identity.id || !email || !identity.email_confirmed_at) fail(403, "Confirm your Supabase email before signing in.")
      const profile = await supabaseProfile(identity.id)
      let user = db.users.find((entry) => entry.supabaseAuthId === identity.id)
      if (!user) {
        user = db.users.find((entry) => entry.email === email)
        if (user?.supabaseAuthId && user.supabaseAuthId !== identity.id) {
          fail(409, "This email is assigned to a different Supabase account. Delete that Auth user and try again.")
        }
        if (!user) {
          const name = clean(profile?.full_name, 100) || clean(identity.user_metadata?.full_name, 100) || email.split("@")[0]
          const accountType = validPlmEmail(email) ? "PLM Resident" : "External User"
          user = { id: id("u_"), name, email, accountType, role: accountType, emailVerified: true, createdAt: dateNow() }
          db.users.push(user)
        }
        if (identity.user_metadata?.full_name) user.name = clean(identity.user_metadata.full_name, 100)
        if (identity.user_metadata?.student_number) user.studentNumber = clean(identity.user_metadata.student_number, 40)
        if (identity.user_metadata?.phone) user.phone = clean(identity.user_metadata.phone, 30)
        if (identity.user_metadata?.account_type) {
          const accountType = clean(identity.user_metadata.account_type, 40)
          user.accountType = accountType === "PLM" || accountType === "PLM Student"
            ? "PLM Resident"
            : accountType
        }
        user.supabaseAuthId = identity.id
        await persist()
      }
      const session = makeSession(user, identity.id)
      session.user.role = profile?.is_admin === true ? "Admin" : user.accountType
      return send(res, 200, session)
    }

    if (method === "POST" && route === "/api/auth/login") {
      const input = await body(req)
      const email = required(input.email, "Email", 254).toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error("Enter the email address you used to register."), { status: 400 })
      const user = db.users.find((entry) => entry.email === email)
      if (!user || !(await passwordMatches(String(input.password || ""), user.passwordHash))) throw Object.assign(new Error("Email or password is incorrect."), { status: 401 })
      if (!user.emailVerified) throw Object.assign(new Error("Verify your email before signing in."), { status: 403, code: "EMAIL_NOT_VERIFIED" })
      return send(res, 200, makeSession(user))
    }

    if (method === "POST" && route === "/api/auth/forgot-password") {
      const input = await body(req)
      const email = required(input.email, "Email", 254).toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error("Enter a valid email address."), { status: 400 })
      const user = db.users.find((entry) => entry.email === email)
      if (!user) return send(res, 200, { message: "If the account exists, a reset code was generated." })
      const code = makeCode(email, "reset")
      const delivery = await notifyPrototypeCode("Password reset", email, code)
      return send(res, 200, { message: "A reset code was sent to your account email.", ...delivery })
    }

    if (method === "POST" && route === "/api/auth/reset-password") {
      const input = await body(req)
      const email = required(input.email, "Email", 254).toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error("Enter a valid email address."), { status: 400 })
      const password = required(input.password, "New password", 200)
      if (!validPassword(password)) throw Object.assign(new Error("Password must be 8+ characters and include an uppercase letter, a number, and a special character."), { status: 400 })
      const user = db.users.find((entry) => entry.email === email)
      if (!user) throw Object.assign(new Error("Account not found."), { status: 404 })
      if (!resetVerifiedEmails.has(email) || resetVerifiedEmails.get(email) < Date.now()) throw Object.assign(new Error("Verify the reset code before choosing a new password."), { status: 403 })
      user.passwordHash = await passwordHash(password)
      resetVerifiedEmails.delete(email)
      for (const [token, session] of sessions) if (session.userId === user.id) sessions.delete(token)
      await persist()
      return send(res, 200, { message: "Password updated." })
    }

    if (method === "POST" && route === "/api/auth/verify-password-reset") {
      const input = await body(req)
      const email = required(input.email, "Email", 254).toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error("Enter a valid email address."), { status: 400 })
      if (!db.users.some((entry) => entry.email === email)) throw Object.assign(new Error("If the account exists, a reset code was sent."), { status: 404 })
      verifyCode(email, "reset", input.code)
      resetVerifiedEmails.set(email, Date.now() + 15 * 60_000)
      return send(res, 200, { verified: true })
    }
    if (method === "POST" && route === "/api/auth/logout") {
      const token = req.headers.authorization?.replace(/^Bearer\s+/i, "")
      if (token) sessions.delete(token)
      return send(res, 200, { ok: true })
    }

    if (method === "GET" && route === "/api/auth/me") return send(res, 200, { user: publicUser(requireUser(req)) })

    if (method === "GET" && route === "/api/bootstrap") {
      const user = requireUser(req)
      const admin = await isAdmin(req)
      return send(res, 200, {
        isAdmin: admin,
        user: { ...publicUser(user), role: admin ? "Admin" : user.accountType },
        items: [...db.items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((item) => itemForUser(item, user)).filter(Boolean),
        claims: db.claims.filter((claim) => claim.claimantId === user.id || itemById(claim.itemId)?.ownerId === user.id),
        conversations: db.conversations.filter((conversation) => conversation.participantIds.includes(user.id)).map((conversation) => ({
          id: conversation.id, itemId: conversation.itemId,
          user: conversation.participantIds.find((participant) => participant !== user.id) ? userById(conversation.participantIds.find((participant) => participant !== user.id))?.name || "ReClaim user" : "ReClaim user",
          avatar: "RC", unread: conversation.messages.filter((message) => message.senderId !== user.id && !message.readBy?.includes(user.id)).length,
          messages: conversation.messages.map((message) => { const mine = message.senderId === user.id; const otherUserId = conversation.participantIds.find((participant) => participant !== user.id); return { id: message.id, mine, text: message.text, time: message.time, read: (message.readBy || []).includes(mine ? otherUserId : user.id) } }),
        })),
        notifications: db.notifications.filter((notification) => notification.userId === user.id),
      })
    }

    const user = currentUser(req)
    if (!user) throw Object.assign(new Error("Sign in to continue."), { status: 401 })

    if (route.startsWith("/api/admin/")) {
      await requireAdmin(req)
      return await handleAdmin(req, res, route, method, user)
    }

    if (method === "GET" && route === "/api/items") return send(res, 200, {
      items: db.items.map((item) => itemForUser(item, user)).filter(Boolean),
    })

    if (method === "POST" && route === "/api/items") {
      const input = await body(req)
      const status = input.status === "Found" ? "Found" : "Lost"
      const image = clean(input.image, maxBodyBytes)
      if (image && !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(image) && !/^https:\/\/images\.unsplash\.com\//.test(image)) throw Object.assign(new Error("Upload a PNG, JPEG, WebP, or GIF image."), { status: 400 })
      const item = {
        id: nextItemId(), name: required(input.name, "Item name", 120), category: required(input.category, "Category", 50),
        status, date: clean(input.date, 20) || displayDate(), createdAt: dateNow(), location: required(input.location, "Location", 160),
        description: required(input.description, "Description", 1500), image,
        reporter: user.name, reporterRole: user.accountType, ownerId: user.id, mine: true,
        question: status === "Found" ? required(input.question, "Private ownership question", 200) : undefined,
        answer: status === "Found" ? required(input.answer, "Private answer", 200).toLowerCase() : undefined,
        rewardType: status === "Lost" ? ["none", "money", "other"].includes(input.rewardType) ? input.rewardType : "none" : undefined,
        rewardAmount: status === "Lost" ? clean(input.rewardAmount, 40) : undefined,
        rewardDescription: status === "Lost" ? clean(input.rewardDescription, 200) : undefined,
      }
      if (isSensitive(item.category)) item.privacy = "Held"
      db.items.unshift(item)
      await persist()
      return send(res, 201, { item })
    }

    const questionMatch = route.match(/^\/api\/items\/(\d+)\/verify-answer$/)
    if (method === "POST" && questionMatch) {
      const input = await body(req)
      const item = itemById(Number(questionMatch[1]))
      if (!openFound(item)) throw Object.assign(new Error("This found item is no longer available to claim."), { status: 404 })
      if (item.ownerId === user.id) throw Object.assign(new Error("You cannot claim your own report."), { status: 400 })
      const key = `${user.id}:${item.id}`
      const attempts = answerAttempts.get(key) || 0
      if (attempts >= 5) throw Object.assign(new Error("Too many attempts. Contact the reporter for help."), { status: 429 })
      answerAttempts.set(key, attempts + 1)
      if (clean(input.answer, 200).toLowerCase() !== (item.answer || "")) throw Object.assign(new Error("That answer does not match. Check the item details you remember and try again."), { status: 403 })
      return send(res, 200, { verified: true })
    }

    if (method === "POST" && route === "/api/conversations") {
      const input = await body(req)
      const item = itemById(Number(input.itemId))
      if (!itemForUser(item, user)) fail(404, "Item not found.")
      if (item.ownerId === user.id) throw Object.assign(new Error("You cannot message yourself."), { status: 400 })
      const existing = db.conversations.find((entry) => !entry.adminClaimId && entry.itemId === item.id && entry.participantIds.includes(user.id))
      const conversation = existing || { id: nextConversationId(), itemId: item.id, participantIds: [item.ownerId, user.id], messages: [] }
      if (!existing) db.conversations.unshift(conversation)
      await persist()
      return send(res, 201, { conversation: {
        id: conversation.id, itemId: conversation.itemId,
        user: userById(conversation.participantIds.find((participant) => participant !== user.id))?.name || item.reporter,
        avatar: "RC", unread: 0, messages: conversation.messages.map((message) => { const mine = message.senderId === user.id; const otherUserId = conversation.participantIds.find((participant) => participant !== user.id); return { id: message.id, mine, text: message.text, time: message.time, read: (message.readBy || []).includes(mine ? otherUserId : user.id) } }),
      } })
    }

    if (method === "POST" && route === "/api/claims") {
      const input = await body(req)
      const item = itemById(Number(input.itemId))
      if (!openFound(item)) throw Object.assign(new Error("This found item is no longer available to claim."), { status: 404 })
      if (item.ownerId === user.id) throw Object.assign(new Error("You cannot claim your own report."), { status: 400 })
      if (db.claims.some((claim) => claim.itemId === item.id && claim.claimantId === user.id && claim.status === "Pending")) throw Object.assign(new Error("You already have a pending claim for this item."), { status: 409 })
      const answer = clean(input.answer, 200).toLowerCase()
      if (!item.answer || answer !== item.answer) throw Object.assign(new Error("The ownership answer does not match."), { status: 403 })
      const claim = {
        id: Math.max(Date.now(), (db.claims[0]?.id || 0) + 1), itemId: item.id, claimant: user.name, claimantId: user.id, accountType: user.accountType,
        status: "Pending", requested: "Just now", createdAt: dateNow(), verified: true,
        explanation: required(input.explanation, "Ownership details", 1200), proof: clean(input.proof, maxBodyBytes),
      }
      db.claims.unshift(claim)
      item.status = "Pending Claim"
      let conversation = db.conversations.find((entry) => !entry.adminClaimId && entry.itemId === item.id && entry.participantIds.includes(user.id))
      if (!conversation) {
        conversation = { id: nextConversationId(), itemId: item.id, participantIds: [item.ownerId, user.id], messages: [] }
        db.conversations.unshift(conversation)
      }
      addNotification(item.ownerId, "claim", "New claim request", `${user.name} submitted a claim for ${item.name}.`, "activity")
      await persist()
      return send(res, 201, { claim })
    }

    const claimMatch = route.match(/^\/api\/claims\/(\d+)$/)
    if (method === "PATCH" && claimMatch) {
      const input = await body(req)
      const claim = db.claims.find((entry) => entry.id === Number(claimMatch[1]))
      const item = claim && itemById(claim.itemId)
      if (!claim || !item) throw Object.assign(new Error("Claim not found."), { status: 404 })
      if (item.ownerId !== user.id) throw Object.assign(new Error("Only the item reporter can review this claim."), { status: 403 })
      reviewClaim(claim, item, input.status)
      await persist()
      return send(res, 200, { claim, item })
    }

    const returnedMatch = route.match(/^\/api\/items\/(\d+)\/returned$/)
    if (method === "PATCH" && returnedMatch) {
      const item = itemById(Number(returnedMatch[1]))
      if (!item) throw Object.assign(new Error("Item not found."), { status: 404 })
      if (item.ownerId !== user.id || item.status !== "Claimed") throw Object.assign(new Error("Only the reporter can mark an approved claim as returned."), { status: 403 })
      completeReturn(item)
      await persist()
      return send(res, 200, { item })
    }

    const undoReturnedMatch = route.match(/^\/api\/items\/(\d+)\/undo-return$/)
    if (method === "PATCH" && undoReturnedMatch) {
      const item = itemById(Number(undoReturnedMatch[1]))
      if (!item || item.ownerId !== user.id || item.status !== "Returned") throw Object.assign(new Error("Only the finder can undo a return for their returned item."), { status: 403 })
      for (const claim of db.claims.filter((entry) => entry.itemId === item.id)) {
        const previous = item.returnClaimSnapshot?.[claim.id]
        if (previous) claim.status = previous === "Approved" ? "Pending" : previous
      }
      delete item.returnClaimSnapshot
      delete item.approvedClaimantId
      item.status = db.claims.some((entry) => entry.itemId === item.id && entry.status === "Pending") ? "Pending Claim" : "Found"
      addNotification(item.ownerId, "return", "Return undone", `${item.name} is open for claims again.`, "activity")
      await persist()
      return send(res, 200, { item })
    }

    if (method === "GET" && route === "/api/notifications") return send(res, 200, { notifications: db.notifications.filter((entry) => entry.userId === user.id) })

    const notificationMatch = route.match(/^\/api\/notifications\/([^/]+)$/)
    if (method === "PATCH" && notificationMatch) {
      const notification = db.notifications.find((entry) => entry.id === notificationMatch[1] && entry.userId === user.id)
      if (!notification) throw Object.assign(new Error("Notification not found."), { status: 404 })
      notification.unread = Boolean((await body(req)).unread)
      await persist()
      return send(res, 200, { notification })
    }

    const messageMatch = route.match(/^\/api\/conversations\/(\d+)\/messages$/)
    if (method === "POST" && messageMatch) {
      const input = await body(req)
      const conversation = db.conversations.find((entry) => entry.id === Number(messageMatch[1]) && entry.participantIds.includes(user.id))
      if (!conversation) throw Object.assign(new Error("Conversation not found."), { status: 404 })
      const text = required(input.text, "Message", 2000)
      const message = { id: nextMessageId(conversation), senderId: user.id, text, time: "Just now", readBy: [user.id] }
      conversation.messages.push(message)
      const recipientId = conversation.participantIds.find((participant) => participant !== user.id)
      if (recipientId) addNotification(recipientId, "message", "New message", `${user.name} sent you a message.`, "chat")
      await persist()
      return send(res, 201, { message: { id: message.id, mine: true, text: message.text, time: message.time } })
    }

    const readMatch = route.match(/^\/api\/conversations\/(\d+)\/read$/)
    if (method === "PATCH" && readMatch) {
      const conversation = db.conversations.find((entry) => entry.id === Number(readMatch[1]) && entry.participantIds.includes(user.id))
      if (!conversation) throw Object.assign(new Error("Conversation not found."), { status: 404 })
      for (const message of conversation.messages) {
        message.readBy ||= []
        if (!message.readBy.includes(user.id)) message.readBy.push(user.id)
      }
      await persist()
      return send(res, 200, { ok: true })
    }

    if (method === "PATCH" && route === "/api/profile") {
      const input = await body(req)
      if (input.photo !== undefined) {
        const photo = clean(input.photo, 3 * 1024 * 1024)
        if (photo && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(photo)) throw Object.assign(new Error("Upload a PNG, JPEG, or WebP profile photo."), { status: 400 })
        user.photo = photo
      }
      await persist()
      return send(res, 200, { user: publicUser(user) })
    }

    if (method === "PUT" && route === "/api/profile/password") {
      const input = await body(req)
      if (!(await passwordMatches(String(input.currentPassword || ""), user.passwordHash))) throw Object.assign(new Error("Current password is incorrect."), { status: 403 })
      const nextPassword = required(input.newPassword, "New password", 200)
      if (!validPassword(nextPassword)) throw Object.assign(new Error("Password must be 8+ characters and include an uppercase letter, a number, and a special character."), { status: 400 })
      if (nextPassword === input.currentPassword) throw Object.assign(new Error("Choose a password you have not used before."), { status: 400 })
      user.passwordHash = await passwordHash(nextPassword)
      const token = req.headers.authorization?.replace(/^Bearer\s+/i, "")
      for (const [sessionToken, session] of sessions) if (session.userId === user.id && sessionToken !== token) sessions.delete(sessionToken)
      await persist()
      return send(res, 200, { message: "Password updated." })
    }

    return send(res, 404, { error: "Endpoint not found." })
  } catch (error) {
    return send(res, error.status || 500, { error: error.message || "Unexpected server error.", ...(error.code ? { code: error.code } : {}) })
  }
}

createServer(handler).listen(port, host, () => {
  console.log(`ReClaim API listening at http://${host}:${port}`)
})



