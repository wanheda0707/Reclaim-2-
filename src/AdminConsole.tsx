import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react"
import { BarChart3, Bell, ChevronRight, LayoutDashboard, LogOut, MessageCircle, Package, PackageCheck, Plus, RefreshCw, Search, Settings, ShieldAlert, ShieldCheck, X } from "lucide-react"
import { adminDemo, combineAdminRecords } from "./lib/adminDemo"
import { AccountAvatar } from "./AccountAvatar"
import {
  adminLinkMatch, adminLogWalkIn, adminMessageClaimant, adminModerate, adminOverview,
  adminSetCustody, adminSetDesk, adminUpdateClaim, adminUpdateItemStatus, setNotificationRead,
  type AdminOverview, type ApiClaim, type ApiItem, type ApiUser,
} from "./lib/api"

const views = [
  ["dashboard", "Dashboard", LayoutDashboard],
  ["claims", "Claims Queue", ShieldCheck],
  ["inventory", "Master Inventory", Package],
  ["matches", "Match Suggestions", MessageCircle],
  ["custody", "Custody & Handovers", PackageCheck],
  ["moderation", "Moderation & Disputes", ShieldAlert],
  ["analytics", "Campus Analytics", BarChart3],
  ["settings", "System Settings", Settings],
] as const
type View = (typeof views)[number][0]
type Selection = { type: "walk-in" | "notifications" } | { type: "item" | "claim"; id: number }
const ticket = (id: number) => "#RCL-" + String(id).padStart(3, "0")
const displayStatus = (status: ApiItem["status"]) => status === "Returned" ? "Reunited" : status
const categories = ["Electronics", "Accessories", "IDs and Cards", "Books and Notes", "Clothing", "Others"]
const field = (data: FormData, name: string) => String(data.get(name) || "")
const messageFor = (error: unknown) => error instanceof Error ? error.message : "The request could not be completed."
const matchKey = ({ lostId, foundId }: AdminOverview["matches"][number]) => `${lostId}:${foundId}`

function AdminDialog({ title, children, onClose, hideHeader = false }: { title: string; children: ReactNode; onClose: () => void; hideHeader?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { dialog.current?.showModal() }, [])
  return <dialog ref={dialog} className="admin-dialog admin-drawer" aria-labelledby="admin-dialog-title" onClose={onClose}>
    {!hideHeader && <header><h2 id="admin-dialog-title">{title}</h2><button type="button" aria-label="Close" onClick={onClose}><X size={20} /></button></header>}
    {children}
  </dialog>
}

function submit(action: (data: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    action(new FormData(event.currentTarget))
  }
}

type AdminConsoleProps = { user: ApiUser; brand: ReactNode } & (
  { preview: AdminOverview; onSignOut?: never } | { preview?: never; onSignOut: () => Promise<void> }
)

export function AdminConsole({ user, brand, onSignOut, preview }: AdminConsoleProps) {
  const [view, setView] = useState<View>("dashboard")
  const [liveData, setLiveData] = useState<AdminOverview>()
  const [busy, setBusy] = useState(!preview)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState("All")
  const [selection, setSelection] = useState<Selection>()
  const [showOriginal, setShowOriginal] = useState(false)
  const [publishedSamples, setPublishedSamples] = useState<Record<number, Pick<ApiItem, "name" | "description" | "question">>>({})
  const [sampleCustody, setSampleCustody] = useState<Record<number, Pick<ApiItem, "custodyDeskId" | "shelfTag">>>({})
  const [linkedSampleMatches, setLinkedSampleMatches] = useState<Set<string>>(() => new Set())
  const combined = liveData && combineAdminRecords(liveData)
  const data = preview ?? combined?.data
  const isSampleItem = (id: number) => combined?.itemIds.has(id) === true
  const selectedIsSample = selection?.type === "item" ? isSampleItem(selection.id)
    : selection?.type === "claim" && combined?.claimIds.has(selection.id) === true

  useEffect(() => {
    if (preview) return
    let active = true
    void adminOverview().then((overview) => { if (active) setLiveData(overview) })
      .catch((failure) => { if (active) setError(messageFor(failure)) })
      .finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [preview])

  async function run(action?: () => Promise<unknown>, success?: string, close = false) {
    if (action && (preview || selectedIsSample)) return
    setBusy(true)
    setError("")
    setNotice("")
    try {
      if (action) await action()
      if (close) setSelection(undefined)
      if (success) setNotice(success)
      setLiveData(await adminOverview())
    } catch (failure) {
      setError(messageFor(failure))
    } finally {
      setBusy(false)
    }
  }
  const writeDisabled = busy || Boolean(preview)
  const recordWriteDisabled = writeDisabled || selectedIsSample

  function navigate(next: View) {
    setView(next)
    setFilter("All")
    setQuery("")
  }

  function inspect(next: Selection) {
    setError("")
    setShowOriginal(false)
    setSelection(next)
  }

  const items = (data?.items ?? []).map((item): ApiItem => {
    if (!isSampleItem(item.id)) return item
    const edits = publishedSamples[item.id]
    return {
      ...item,
      ...sampleCustody[item.id],
      ...(edits && { ...edits, image: "", privacy: "Published" as const }),
    }
  })
  const claims = data?.claims ?? []
  const desks = data?.desks ?? []
  const itemById = new Map(items.map((item) => [item.id, item]))
  const userById = new Map(data?.users.map((entry) => [entry.id, entry]))
  const claimText = (claim: ApiClaim) => {
    const claimant = claim.claimantId ? userById.get(claim.claimantId) : undefined
    return [claim.claimant, claimant?.studentNumber, claimant?.staffId, claimant?.email].join(" ")
  }
  const needle = query.trim().toLowerCase()
  const visibleItems = items.filter((item) => !needle || [
    ticket(item.id), item.name, item.category, item.location, item.reporter,
    ...claims.filter((claim) => claim.itemId === item.id).map(claimText),
  ].join(" ").toLowerCase().includes(needle))
  const visibleIds = new Set(visibleItems.map((item) => item.id))
  const custody = (item: ApiItem) => item.status === "Returned" ? "Released to owner"
    : item.status === "Lost" ? "Not recovered"
    : desks.find((desk) => desk.id === item.custodyDeskId)?.name ||
      item.previousCustodyDesk || liveData?.desks.find((desk) => desk.id === item.custodyDeskId)?.name || "With finder"
  const held = items.filter((item) => item.privacy === "Held")
  const matches = (data?.matches ?? []).map((match) => {
    const sample = isSampleItem(match.lostId) || isSampleItem(match.foundId)
    return { ...match, sample, linked: match.linked || (sample && linkedSampleMatches.has(matchKey(match))) }
  })
  const pendingMatches = matches.filter((match) => !match.linked).length
  const inCustody = data?.stats.inCustody ?? items.filter((item) => item.custodyDeskId && item.status !== "Returned").length
  const activeReports = data?.stats.activeReports ?? items.filter((item) => item.status !== "Returned" && item.privacy !== "Held").length
  const notifications = data?.notifications ?? []
  const unread = notifications.filter((notification) => notification.unread).length
  const selectedClaim = selection?.type === "claim" ? claims.find((claim) => claim.id === selection.id) : undefined
  const proofPhoto = selectedClaim?.proof
  const hasProofPhoto = proofPhoto?.startsWith("data:image/") ||
    (selectedIsSample && proofPhoto?.startsWith("/items/"))
  const claimant = selectedClaim?.claimantId ? userById.get(selectedClaim.claimantId) : undefined
  const selectedItem = selectedClaim ? itemById.get(selectedClaim.itemId) : selection?.type === "item" ? itemById.get(selection.id) : undefined
  const selectedMessages = data?.claimThreads.find((thread) => thread.claimId === selectedClaim?.id)?.messages ?? []
  const selectedDesks = desks.filter((desk) => selectedIsSample || combined?.liveDeskIds.has(desk.id) || desk.id === selectedItem?.custodyDeskId)

  function linkMatch(match: (typeof matches)[number]) {
    if (match.linked) return
    if (match.sample) {
      setLinkedSampleMatches((previous) => new Set(previous).add(matchKey(match)))
      setError("")
      setNotice("Sample match linked. No real notification was sent.")
      return
    }
    void run(() => adminLinkMatch(match.lostId, match.foundId), "Match linked and reporter notified.")
  }
  const canChangeCustody = selectedItem && selectedItem.status !== "Lost" && selectedItem.status !== "Returned"

  function changeCustody(item: ApiItem, deskId: string | null, shelfTag: string) {
    if (isSampleItem(item.id)) {
      setSampleCustody((previous) => ({
        ...previous,
        [item.id]: { custodyDeskId: deskId ?? undefined, shelfTag: deskId ? shelfTag.trim() : undefined },
      }))
      setError("")
      setNotice("Sample custody updated for this walkthrough.")
      return
    }
    void run(() => adminSetCustody(item.id, deskId, shelfTag), "Custody updated.")
  }

  function publishRedactedReport(item: ApiItem, form: FormData) {
    const edits = {
      name: field(form, "name").trim(),
      description: field(form, "description").trim(),
      question: item.question ? field(form, "question").trim() : undefined,
    }
    if (!edits.name || !edits.description || (item.question && !edits.question)) {
      setError("Enter the redacted title, description, and any required ownership question.")
      return
    }
    if (isSampleItem(item.id)) {
      setPublishedSamples((previous) => ({ ...previous, [item.id]: edits }))
      setSelection(undefined)
      setError("")
      setNotice("Sample published for this walkthrough. The public feed was not changed.")
      return
    }
    void run(() => adminModerate(item.id, { action: "publish", ...edits }), "Redacted report published.", true)
  }
  const original = selectedItem && showOriginal ? selectedItem.originalContent ?? selectedItem : undefined

  const analytics = new Map<string, { reports: number; returned: number }>()
  for (const item of liveData?.items ?? preview?.items ?? []) {
    const stats = analytics.get(item.location) ?? { reports: 0, returned: 0 }
    stats.reports++
    if (item.status === "Returned") stats.returned++
    analytics.set(item.location, stats)
  }
  const presentationLocations = data?.stats.analytics.length ? data.stats.analytics : adminDemo.stats.analytics
  const locations = [
    ...presentationLocations.map(({ location, reports, returned }) => ({ location, reports, returned, sample: true })),
    ...[...analytics].sort(([left], [right]) => left.localeCompare(right))
      .map(([location, stats]) => ({ location, ...stats, sample: false })),
  ]
  const liveReturned = [...analytics.values()].reduce((total, entry) => total + entry.returned, 0)
  const liveReturnRate = liveData?.items.length ? Math.round(100 * liveReturned / liveData.items.length) : 0

  function exportAnalytics() {
    const quote = (value: string) => '"' + (/^[\s]*[=+\-@]/.test(value) ? "'" : "") + value.replace(/"/g, '""') + '"'
    const csv = ["Location,Reports,Reunited,Source",
      ...[...analytics].map(([location, stats]) => [quote(location), stats.reports, stats.returned, "Live"].join(",")),
      ...presentationLocations.map((entry) => [quote(entry.location), entry.reports, entry.returned, "Sample"].join(",")),
    ].join("\r\n")
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = "PLM_ReClaim_Analytics.csv"
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function filterButtons(values: string[]) {
    return <div className="admin-filter-pills" aria-label="Filters">{values.map((value) =>
      <button key={value} className={filter === value ? "active" : ""} aria-pressed={filter === value} onClick={() => setFilter(value)}>
        {value === "Returned" ? "Reunited" : value}
      </button>
    )}</div>
  }

  function claimTable(dashboard: boolean) {
    const rows = claims.filter((claim) => {
      if (!visibleIds.has(claim.itemId)) return false
      if (dashboard && claim.status !== "Pending") return false
      if (filter === "All") return true
      if (!dashboard) return claim.status === filter
      const item = itemById.get(claim.itemId)
      return filter === "High Value / Reward" ? Boolean(item?.rewardAmount || item?.rewardDescription || item?.category === "Electronics") : item?.category === filter
    })
    return <div className="inventory-table-wrap"><table className="inventory-table">
      <thead><tr><th>Ticket &amp; item</th><th>Category</th><th>Location</th><th>Custody</th><th>Claimant</th><th>Submitted</th><th>Status</th><th>Action</th></tr></thead>
      <tbody>{rows.map((claim) => {
        const item = itemById.get(claim.itemId)
        return <tr key={claim.id}>
        <td className="inventory-item"><b>{item?.name}</b><small>{ticket(claim.itemId)}{combined?.claimIds.has(claim.id) && " · Sample"}</small></td>
          <td>{item?.category}</td><td>{item?.location}</td><td>{item && custody(item)}</td>
          <td>{claim.claimant}</td><td>{claim.requested}</td><td>{claim.status}</td>
          <td><button className="inspect-button" onClick={() => inspect({ type: "claim", id: claim.id })}>Review</button></td>
        </tr>
      })}</tbody>
    </table>{!rows.length && <p className="admin-muted inventory-no-results">No claims match this view.</p>}</div>
  }

  function inventoryTable(rows: ApiItem[]) {
    return <div className="inventory-table-wrap"><table className="inventory-table">
      <thead><tr><th>Ticket</th><th>Item &amp; category</th><th>Campus location</th><th>Custody</th><th>Status</th><th>Action</th></tr></thead>
      <tbody>{rows.map((item) => <tr key={item.id}>
        <td><b>{ticket(item.id)}</b></td><td className="inventory-item"><b>{item.name}</b><small>{item.category} · {item.date}{isSampleItem(item.id) && item.date !== "Sample record" && " · Sample"}</small></td>
        <td>{item.location}</td><td>{custody(item)}{item.shelfTag && (item.custodyDeskId || item.previousCustodyDesk) && item.status !== "Returned" && <small className="block">{item.shelfTag}</small>}</td>
        <td><span className={"inventory-status " + item.status.toLowerCase().replace(/ /g, "-")}>{displayStatus(item.status)}</span>{item.privacy === "Held" && <small className="block">Held for privacy</small>}{item.privacy === "Published" && <small className="block">{isSampleItem(item.id) ? "Sample published" : "Privacy review complete"}</small>}</td>
        <td><button className="inspect-button" onClick={() => inspect({ type: "item", id: item.id })}>Inspect</button></td>
      </tr>)}</tbody>
    </table>{!rows.length && <p className="admin-muted inventory-no-results">No items match this view.</p>}</div>
  }

  return <div className="admin-app-shell">
    <aside className="admin-sidebar">
      <div className="admin-sidebar-brand">{brand}<span className="admin-console-chip">ADMIN<br />CONSOLE</span></div>
      <div className="admin-sidebar-rule" />
      <nav className="admin-sidebar-nav" aria-label="Admin console">
        <p>Operations</p>
        {views.slice(0, 4).map(([id, title, Icon]) => <button key={id} className={view === id ? "active" : ""} aria-current={view === id ? "page" : undefined} onClick={() => navigate(id)}>
          <Icon size={18} />{title}
          {id === "claims" && <b>{data?.stats.pendingClaims ?? 0}</b>}
          {id === "matches" && <b>{pendingMatches}</b>}
        </button>)}
        <p>Campus &amp; Moderation</p>
        {views.slice(4).map(([id, title, Icon]) => <button key={id} className={view === id ? "active" : ""} aria-current={view === id ? "page" : undefined} onClick={() => navigate(id)}>
          <Icon size={18} />{title}
          {id === "moderation" && <b>{held.length}</b>}
        </button>)}
      </nav>
      <div className="admin-sidebar-user"><AccountAvatar className="admin-user-avatar" user={user} /><b>{user.name}</b><small>PLM Intramuros Campus</small>
        {onSignOut && <button onClick={() => { void onSignOut().catch((failure) => setError(messageFor(failure))) }}><LogOut size={14} /> Sign out</button>}
      </div>
    </aside>
    <main className="admin-main">
      <div className="admin-console-topline">
        <div><span className="admin-breadcrumb-muted">ReClaim Admin</span><ChevronRight size={13} /><b>{views.find(([id]) => id === view)?.[1]}</b></div>
        <div className="admin-console-actions">
          {(["dashboard", "inventory", "custody", "claims", "moderation", "matches"] as View[]).includes(view) && <label className="admin-search"><Search size={15} /><input aria-label="Search records" placeholder="Ticket, item, student no., location" value={query} onChange={(event) => setQuery(event.target.value)} /></label>}
          <button className="admin-icon-action" aria-label={unread + " unread notifications"} onClick={() => inspect({ type: "notifications" })}><Bell size={17} />{unread > 0 && <sup>{unread}</sup>}</button>
          {!preview && <button className="admin-refresh" disabled={busy} onClick={() => void run()}><RefreshCw size={14} /> Refresh</button>}
          <button className="admin-walkin" disabled={!data || writeDisabled} onClick={() => inspect({ type: "walk-in" })}><Plus size={15} /> Log Walk-in Item</button>
        </div>
      </div>
      {preview && <p className="admin-feedback"><strong>Read-only preview</strong> · Sample records · <a className="underline" href="/admin">Sign in to manage live records</a></p>}
      {error && !selection && <p className="admin-feedback error" role="alert">{error}</p>}
      {notice && !selection && <p className="admin-feedback" role="status">{notice}</p>}
      {!data && busy && <p role="status" className="admin-empty">Loading admin records…</p>}
      {data && <>
        {view === "dashboard" ? <>
          <section className="admin-hero">
            <div><span className="admin-hero-pill">OSDS DESK · INTRAMUROS</span><h1>Campus Custody &amp; Claim Verification</h1><p>Review ownership claims, log recovered items at campus desks, and redact sensitive reports before publication.</p></div>
            <div className="admin-hero-illustration" aria-hidden="true"><PackageCheck size={46} /><ShieldCheck size={35} /><Package size={49} /></div>
          </section>
          <section className="admin-dashboard-metrics">
            <button onClick={() => navigate("claims")}><div><span>Pending Claims</span><ShieldCheck size={18} /></div><strong><b>{data.stats.pendingClaims}</b><em>Action Required</em></strong></button>
            <button onClick={() => navigate("custody")}><div><span>In Physical Custody</span><PackageCheck size={18} /></div><strong><b>{adminDemo.stats.inCustody}</b><em>Sample · {inCustody} live</em></strong></button>
            <button onClick={() => navigate("inventory")}><div><span>Active Reports</span><Package size={18} /></div><strong><b>{adminDemo.stats.activeReports}</b><em>Sample · {activeReports} live</em></strong></button>
            <button onClick={() => navigate("analytics")}><div><span>Items Reunited</span><ShieldCheck size={18} /></div><strong><b>{adminDemo.stats.returnedItems}</b><em>Sample · {liveReturned} live</em></strong></button>
          </section>
          <div className="admin-heading admin-dashboard-heading"><h2>Claims to Verify</h2><div className="admin-record-actions">
            <button className="admin-refresh" onClick={() => navigate("moderation")}>Needs Privacy Review ({held.length})</button>
            <button className="admin-refresh" onClick={() => navigate("matches")}>Potential Matches ({pendingMatches})</button>
          </div></div>
          {filterButtons(["All", "High Value / Reward", "IDs and Cards", "Electronics", "Accessories"])}
          {claimTable(true)}
        </> : <div className="admin-heading">
          <div>
            <h1>{views.find(([id]) => id === view)?.[1]}</h1>
            {view === "claims" && <p>Verify student ownership proof against confidential OSDS vault records.</p>}
            {view === "inventory" && <p>All lost, found, pending claim, and reunited items across PLM Intramuros.</p>}
            {view === "custody" && <p>Track physical items held at campus custody desks and coordinate handovers.</p>}
            {view === "moderation" && <p>Mask sensitive student ID numbers, bank cards, and enrollment records before public release.</p>}
            {view === "matches" && <p>Pair student lost reports with newly logged found items for manual verification.</p>}
            {view === "analytics" && <p>Semester report on recovery rates, turnaround times, and campus hotspots.</p>}
            {view === "settings" && <p>Manage PLM campus surrender checkpoints and OSDS administrative roles.</p>}
          </div>
          {view === "custody" && <button className="admin-walkin" onClick={() => inspect({ type: "walk-in" })}><Plus size={15} /> Log Walk-in Item</button>}
          {view === "analytics" && <button className="admin-walkin" onClick={exportAnalytics}>Export Semester Report</button>}
        </div>}
        {view === "claims" && <div className="admin-view-card">{filterButtons(["All", "Pending", "Approved", "Rejected", "Returned to another claimant"])}{claimTable(false)}</div>}
        {view === "inventory" && <div className="admin-view-card">{filterButtons(["All", "Lost", "Found", "Pending Claim", "Claimed", "Returned"])}{inventoryTable(visibleItems.filter((item) => filter === "All" || item.status === filter))}</div>}
        {view === "custody" && <div className="admin-view-card">{inventoryTable(visibleItems.filter((item) => item.custodyDeskId || item.previousCustodyDesk || ["Claimed", "Returned"].includes(item.status)))}</div>}
        {view === "moderation" && <div className="admin-moderation-grid">
          {held.filter((item) => !needle || [ticket(item.id), item.name, item.location, item.category].join(" ").toLowerCase().includes(needle)).map((item) => <article className="admin-moderation-card" key={item.id}>
            <header><div><span>{ticket(item.id)}</span><b>Privacy review</b></div><small>{item.date}</small></header>
            <h2>{item.name}</h2><p>{item.location} · Submitted by {item.reporter}</p>
            <div className="admin-privacy-preview"><span>Public feed preview</span><b>{item.category === "IDs and Cards" ? "Student ID / card details" : "Sensitive campus record"}</b><small>{item.description}</small></div>
            <footer><span>Requires redaction before publishing</span><button className="admin-primary" onClick={() => inspect({ type: "item", id: item.id })}>{isSampleItem(item.id) ? "Review sample" : "Review & publish"}</button></footer>
          </article>)}
          {!held.length && <div className="admin-empty-card"><ShieldCheck size={28} /><h2>No reports require privacy review</h2><p>All public reports are currently cleared for release.</p></div>}
        </div>}
        {view === "matches" && <div className="admin-match-list">
          {matches.filter((match) => visibleIds.has(match.lostId) || visibleIds.has(match.foundId)).map((match) => {
            const lost = itemById.get(match.lostId)
            const found = itemById.get(match.foundId)
            return <article className="admin-match-card" key={matchKey(match)}>
              <header><div><span>Potential match</span><p>{found?.category} · {match.sample ? "Sample match" : "Matching item details"}</p></div>
                <button className="admin-primary" disabled={writeDisabled || match.linked} onClick={() => linkMatch(match)}>
                  {match.linked ? (match.sample ? "Sample linked" : "Owner notified") : "Notify owner & link"}
                </button></header>
              <div className="admin-match-columns">
                <section><div><span>Lost</span><b>{ticket(match.lostId)}</b></div><h3>{lost?.name}</h3><p>{lost?.location}</p><small>Reporter: {lost?.reporter}</small></section>
                <section><div><span>Found</span><b>{ticket(match.foundId)}</b></div><h3>{found?.name}</h3><p>{found?.location}</p><small>Custody: {found ? custody(found) : "Unknown"}</small></section>
              </div>
            </article>
          })}
          {!matches.some((match) => visibleIds.has(match.lostId) || visibleIds.has(match.foundId)) && <div className="admin-empty-card"><MessageCircle size={28} /><h2>No match suggestions</h2><p>New lost and found matches will appear here.</p></div>}
        </div>}
        {view === "analytics" && <div className="admin-analytics-grid">
          <section className="admin-chart-card"><header><div><h2>Reports &amp; Verified Returns by Building</h2><p>Comparing total logged items with verified student reunions</p></div><div className="admin-chart-legend"><span><i />Total logged</span><span><i />Reunited</span></div></header>
            <div className="admin-chart">{locations.map(({ location, reports, returned, sample }) => <div className="admin-chart-row" key={location + (sample ? "-sample" : "-live")}>
              <div><b>{location}{sample && " · Sample"}</b><span>{returned} / {reports} reunited</span></div>
              <div className="admin-chart-track"><span style={{ width: reports ? `${returned / reports * 100}%` : "0%" }} /></div>
            </div>)}</div>
            {!locations.length && <p className="admin-muted">No locations have reports yet.</p>}
          </section>
          <aside className="admin-summary-card"><span>Campus Summary</span><h2>Verification Performance</h2><div><small>Live return rate</small><strong>{liveReturnRate}%</strong></div><div><small>Sample return rate</small><strong>{adminDemo.stats.returnRate}%</strong></div><footer><span>Live items reunited</span><b>{liveReturned}</b></footer></aside>
        </div>}
        {view === "settings" && <div className="admin-settings">
          <section className="admin-card admin-record-list"><h2>Custody Desks</h2>
            {desks.map((desk) => <article key={desk.id}><b>{desk.name}</b>
              <button className="admin-refresh" disabled={writeDisabled || !combined?.liveDeskIds.has(desk.id)} onClick={() => void run(() => adminSetDesk(desk.id, !desk.active), desk.active ? "Desk paused." : "Desk activated.")}>{desk.active ? "Pause desk" : "Activate desk"}</button>
            </article>)}
          </section>
          <section className="admin-card admin-record-list"><h2>OSDS &amp; Security Admin Roles</h2>
            <article><div><b>{user.name}</b><p>{user.email}</p></div><span className="admin-role-badge">Signed-in admin</span></article>
            {[
              ["OSDS Admin Office", "Super Admin • Claim Verification & Release", "osds.reclaim@plm.edu.ph"],
              ["Sgt. R. Dela Cruz", "Campus Security • Walk-in Custody Intake", "security.desk@plm.edu.ph"],
              ["M. L. Dimaculangan", "Student Affairs Coordinator • Privacy Review", "mldimaculangan@plm.edu.ph"],
            ].map(([name, role, email]) => <article key={email}><div><b>{name}</b><p>{role}</p></div><span className="admin-role-badge">Sample role</span></article>)}
          </section>
        </div>}
      </>}
      {selection && <AdminDialog key={selection.type + ("id" in selection ? selection.id : "")}
        title={selection.type === "walk-in" ? "Log Walk-in Item" : selection.type === "notifications" ? "Notifications" : selectedClaim ? "Review Ownership Claim" : "Inspect Item"}
        hideHeader={Boolean(selectedClaim)}
        onClose={() => { setSelection(undefined); setError("") }}>
        {error && <p className="admin-feedback error" role="alert">{error}</p>}
        {notice && <p className="admin-feedback" role="status">{notice}</p>}
        {selection.type === "notifications" && <div className="admin-record-list">
          {notifications.map((entry) => <article key={entry.id}><div><b>{entry.title}</b><p>{entry.text}</p></div>
            {entry.unread && <button className="admin-refresh" disabled={writeDisabled} onClick={() => void run(() => setNotificationRead(entry.id, false))}>Mark read</button>}
          </article>)}
          {!notifications.length && <p>No notifications yet.</p>}
        </div>}
        {selection.type === "walk-in" && <form className="admin-form" onSubmit={submit((form) => void run(() => adminLogWalkIn({
          name: field(form, "name"), category: field(form, "category"), location: field(form, "location"),
          deskId: field(form, "deskId"), shelfTag: field(form, "shelfTag"), description: field(form, "description"),
          question: field(form, "question"), answer: field(form, "answer"), privateNotes: field(form, "privateNotes"),
        }), "Walk-in item logged.", true))}>
          <label>Item name<input name="name" required maxLength={120} /></label>
          <label>Category<select name="category" required>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
          <label>Found location<input name="location" required maxLength={160} /></label>
          <label>Custody desk<select name="deskId" required><option value="">Select a desk</option>{desks.filter((desk) => desk.active && combined?.liveDeskIds.has(desk.id)).map((desk) => <option key={desk.id} value={desk.id}>{desk.name}</option>)}</select></label>
          <label>Shelf tag<input name="shelfTag" maxLength={120} /></label>
          <label>Public description<textarea name="description" required maxLength={1500} /></label>
          <label>Ownership question shown to claimants<input name="question" required maxLength={200} /></label>
          <label>Private answer<input name="answer" required maxLength={200} /></label>
          <label>Private notes<textarea name="privateNotes" maxLength={1500} /></label>
          <button className="btn-primary" disabled={writeDisabled || !desks.some((desk) => desk.active && combined?.liveDeskIds.has(desk.id))}>Save item</button>
        </form>}
        {selectedItem && <>
          {selectedClaim ? <div className="claim-drawer">
            <header className="claim-drawer-header">
              <div>
                <div className="claim-drawer-badges"><b>{ticket(selectedItem.id)}</b><span>{displayStatus(selectedItem.status)}</span>{selectedIsSample && <span>Sample claim</span>}</div>
                <h2>{selectedItem.name}</h2>
                <p>{selectedItem.location} · {selectedItem.category}</p>
              </div>
              <div className="claim-drawer-tools">
                <label><span>Custody status</span><select disabled={writeDisabled || !canChangeCustody} value={selectedItem.custodyDeskId || ""} onChange={(event) => changeCustody(selectedItem, event.target.value || null, selectedItem.shelfTag || "")}>
                  <option value="">With Finder</option>
                  {selectedDesks.map((desk) => <option key={desk.id} value={desk.id} disabled={!desk.active}>{desk.name}</option>)}
                </select></label>
                <button type="button" aria-label="Close drawer" onClick={() => setSelection(undefined)}><X size={17} /></button>
              </div>
            </header>
            <div className="claim-drawer-body">
              <div className="claim-drawer-grid">
                <section className="claim-hidden-panel">
                  <div className="claim-panel-heading"><b>Admin-only hidden truth</b><button type="button" onClick={() => setShowOriginal(!showOriginal)}>{showOriginal ? "Preview public blur" : "Show unredacted"}</button></div>
                  <div className={"claim-line-art " + (showOriginal ? "unredacted" : "")}>
                    <span>{selectedItem.category === "Electronics" ? "Laptop" : selectedItem.category === "IDs and Cards" ? "Student ID" : "Wallet"}</span>
                    {showOriginal && <b>Admin view</b>}
                  </div>
                  <div className={"claim-hidden-note " + (!showOriginal ? "blurred" : "")}><small>Confidential verification notes</small><p>{selectedItem.privateNotes || selectedItem.answer || "No private verification notes recorded."}</p></div>
                  <footer><b>Vault storage:</b> {selectedItem.shelfTag || custody(selectedItem)}</footer>
                </section>
                <section className="claim-proof-panel">
                  <div className="claim-panel-heading"><b>Claimant submitted proof</b><span>{selectedClaim.verified ? "Verified" : "Unverified"}</span></div>
                  <div className="claimant-card"><div>{selectedClaim.claimant.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div><span><b>{selectedClaim.claimant}{claimant?.studentNumber ? ` (${claimant.studentNumber})` : ""}</b><small>{["PLM", "PLM Student"].includes(selectedClaim.accountType) ? "PLM Resident" : selectedClaim.accountType}</small></span></div>
                  <div className="claim-answer">
                    <small>Ownership verification</small><p>"{selectedClaim.explanation}"</p>
                    {hasProofPhoto ? <details className="claim-proof-photo" key={selectedClaim.id}>
                      <summary>Click to see Photo of Proof</summary>
                      <img src={proofPhoto} alt={selectedIsSample ? "Sample ownership evidence" : "Ownership evidence submitted by the claimant"} loading="lazy" />
                    </details> : <p className="claim-proof-missing">No photo attached</p>}
                  </div>
                </section>
              </div>
              <section className="claim-chat-panel">
                <header><b>Direct chat with {selectedClaim.claimant}</b><span>Synced with Student Inbox</span></header>
                <div className="claim-chat-thread">
                  {selectedMessages.map((entry) => <div key={entry.id} className={entry.mine ? "mine" : "theirs"}><p>{entry.text}</p><small>{entry.mine ? "OSDS Admin Office" : selectedClaim.claimant}</small></div>)}
                  {!selectedMessages.length && <p>{selectedIsSample ? "Messages are disabled for sample claims." : "No messages yet."}</p>}
                </div>
                {claimant && claimant.id !== user.id && <form onSubmit={(event) => {
                  event.preventDefault()
                  const form = event.currentTarget
                  const text = field(new FormData(form), "text")
                  void run(async () => { await adminMessageClaimant(selectedClaim.id, text); form.reset() }, "Message sent.")
                }}><input name="text" required maxLength={2000} placeholder={`Type a message or pickup instruction to ${selectedClaim.claimant}...`} /><button disabled={recordWriteDisabled}>Send</button></form>}
              </section>
            </div>
            <footer className="claim-drawer-footer">
              {selectedClaim.status === "Pending" ? <>
                <button type="button" className="claim-reject" disabled={recordWriteDisabled} onClick={() => void run(() => adminUpdateClaim(selectedClaim.id, "Rejected"), "Claim rejected.", true)}>Reject Claim</button>
                <button type="button" className="claim-approve" disabled={recordWriteDisabled || selectedItem.status === "Claimed"} onClick={() => void run(() => adminUpdateClaim(selectedClaim.id, "Approved"), "Claim approved. Confirm handover after release.")}><ShieldCheck size={16} /> Approve &amp; Confirm Handover</button>
              </> : <>
                {selectedClaim.status === "Approved" && selectedItem.status === "Claimed" ? <button type="button" className="claim-approve" disabled={recordWriteDisabled} onClick={() => void run(() => adminUpdateItemStatus(selectedItem.id, "Returned"), "Handover confirmed.", true)}>Confirm Handover</button> : <button type="button" className="claim-approve" onClick={() => setSelection(undefined)}>Done</button>}
              </>}
            </footer>
          </div> : <>
            <section className="admin-inspection">
              <span>{ticket(selectedItem.id)} · {displayStatus(selectedItem.status)}{selectedIsSample && " · Sample record"}</span>
              <h3>{selectedItem.name}</h3>
              <p>{selectedItem.category} · {selectedItem.location} · {selectedItem.date}</p>
              <p>{selectedItem.description}</p>
              {selectedItem.image && <img src={selectedItem.image} alt={selectedItem.name} />}
              <p><b>Custody</b> {custody(selectedItem)}{selectedItem.shelfTag && ` · ${selectedItem.shelfTag}`}</p>
              <p><b>Reported by</b> {selectedItem.reporter} · {selectedItem.reporterRole}</p>
              {selectedItem.privateNotes && <p><b>Private notes</b> {selectedItem.privateNotes}</p>}
            </section>
            {canChangeCustody && <form className="admin-form" onSubmit={submit((form) =>
              changeCustody(selectedItem, field(form, "deskId") || null, field(form, "shelfTag")))}>
              <label>Custody desk<select name="deskId" defaultValue={selectedItem.custodyDeskId || ""}><option value="">With finder</option>
                {selectedDesks.filter((desk) => desk.active || selectedItem.custodyDeskId === desk.id).map((desk) => <option key={desk.id} value={desk.id} disabled={!desk.active}>{desk.name}{desk.active ? "" : " (paused)"}</option>)}
              </select></label>
              <label>Shelf tag<input name="shelfTag" defaultValue={selectedItem.shelfTag} maxLength={120} /></label>
              <button className="admin-refresh" disabled={writeDisabled}>Save custody</button>
            </form>}
            {selectedItem.privacy === "Held" ? <form className="admin-form" onSubmit={submit((form) => publishRedactedReport(selectedItem, form))}>
              <h3>Privacy Review</h3>
              <p>{selectedIsSample ? "Practice redacting the public text. Sample publishing stays in this walkthrough." : "Remove sensitive details from the public text. Publishing removes the original photo from the feed."}</p>
              <label>Redacted title<input name="name" defaultValue={selectedItem.name} required maxLength={120} /></label>
              <label>Redacted description<textarea name="description" defaultValue={selectedItem.description} required maxLength={1500} /></label>
              {selectedItem.question && <label>Public ownership question<input name="question" defaultValue={selectedItem.question} required maxLength={200} /></label>}
              <button className="btn-primary" disabled={writeDisabled}>{selectedIsSample ? "Publish redacted sample" : "Publish redacted report"}</button>
            </form> : !selectedIsSample && <button className="admin-refresh" disabled={writeDisabled} onClick={() => void run(() => adminModerate(selectedItem.id, { action: "hold" }), "Report held for privacy review.")}>Hold for privacy review</button>}
            <div className="admin-record-list">{claims.filter((claim) => claim.itemId === selectedItem.id).map((claim) => <article key={claim.id}><b>{claim.claimant} · {claim.status}</b>
              <button className="inspect-button" onClick={() => inspect({ type: "claim", id: claim.id })}>Review claim</button>
            </article>)}</div>
          </>}
        </>}
      </AdminDialog>}
    </main>
  </div>
}
