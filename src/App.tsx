import { AdminConsole } from "./AdminConsole"
import { AccountAvatar } from "./AccountAvatar"
import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import {
  ApiClaim,
  ApiConversation,
  ApiItem,
  ApiNotification,
  ApiUser,
  bootstrap,
  changePassword,
  clearSession,
  createClaim,
  createItem,
  login,
  logout,
  markConversationRead,
  markReturned,
  register,
  resendVerification,
  requestPasswordReset,
  resetPassword,
  saveProfile,
  sendMessage,
  startConversation,
  setNotificationRead,
  undoReturned,
  startRegistration,
  updateClaim,
  verifyRegistrationEmail,
  verifyPasswordReset,
  verifyAnswer,
} from "./lib/api"
import {
  Bell,
  BarChart3,
  BookOpen,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Eye,
  EyeOff,
  FileCheck2,
  Filter,
  HelpCircle,
  IdCard,
  Inbox,
  KeyRound,
  Laptop,
  LockKeyhole,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  PackageCheck,
  Package,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  Send,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Upload,
  UserRound,
  Users,
  WalletCards,
  X,
  XCircle,
} from "lucide-react"

type Page = "browse" | "report" | "activity" | "chat" | "notifications" | "profile" | "admin"
type ItemStatus = "Lost" | "Found" | "Pending Claim" | "Claimed" | "Returned"
type ClaimStatus = "Pending" | "Approved" | "Rejected" | "Returned to another claimant"
type RewardType = "none" | "money" | "other"
type AuthView = "home" | "about" | "login" | "signup" | "forgot" | "verify"

type DemoUser = {
  id: string
  name: string
  initials: string
  accountType: "PLM Resident" | "PLM Student" | "PLM Staff" | "External User"
  email: string
  studentNumber?: string
  staffId?: string
  yearLevel?: string
  course?: string
  college?: string
  school?: string
  phone?: string
  photo?: string
  role: string
}

function displayAccountType(accountType: string) {
  if (accountType === "PLM" || accountType === "PLM Student" || accountType === "PLM Resident") return "PLM Resident"
  return accountType
}

function verifiedAccountLabel(accountType: string) {
  if (accountType === "PLM" || accountType === "PLM Student" || accountType === "PLM Resident") return "Verified PLM Resident"
  if (accountType === "PLM Staff") return "Verified PLM Staff"
  return `Verified ${accountType}`
}

type Item = {
  id: number
  name: string
  category: string
  status: ItemStatus
  date: string
  location: string
  description: string
  image: string
  reporter: string
  reporterRole: string
  question?: string
  answer?: string
  mine?: boolean
  ownerId?: string
  rewardType?: RewardType
  rewardAmount?: string
  rewardDescription?: string
}

type Claim = {
  id: number
  itemId: number
  claimant: string
  accountType: string
  status: ClaimStatus
  requested: string
  verified: boolean
  explanation: string
  proof?: string
  claimantId?: string
}

type Message = {
  id: number
  mine: boolean
  text: string
  time: string
  read?: boolean
}

type Conversation = {
  id: number
  itemId: number
  user: string
  avatar: string
  unread: number
  messages: Message[]
}

type ItemCardProps = {
  item: Item
  onClick: () => void
}

const demoUsers: DemoUser[] = [
  {
    id: "student",
    name: "Ana Dela Cruz",
    initials: "AD",
    accountType: "PLM Student",
    email: "ana.delacruz@plm.edu.ph",
    studentNumber: "2023-10427",
    yearLevel: "2nd Year",
    course: "BS Computer Science",
    college: "College of Engineering and Technology",
    phone: "+63 917 100 0427",
    role: "General student testing account",
  },
  {
    id: "staff",
    name: "Roberto Santos",
    initials: "RS",
    accountType: "PLM Staff",
    email: "roberto.santos@plm.edu.ph",
    staffId: "PLM-STAFF-084",
    phone: "+63 917 200 0084",
    role: "University staff testing account",
  },
  {
    id: "external",
    name: "Carlos Villanueva",
    initials: "CV",
    accountType: "External User",
    email: "carlos.villanueva@gmail.com",
    school: "Mapúa University",
    phone: "+63 917 300 1182",
    role: "Verified external visitor",
  },
  {
    id: "finder",
    name: "Mika Reyes",
    initials: "MR",
    accountType: "PLM Student",
    email: "mika.reyes@plm.edu.ph",
    studentNumber: "2022-10482",
    yearLevel: "3rd Year",
    course: "BS Information Technology",
    college: "College of Engineering and Technology",
    phone: "+63 917 482 1048",
    role: "Finder with incoming claim requests",
  },
  {
    id: "claimant",
    name: "Joaquin Flores",
    initials: "JF",
    accountType: "PLM Student",
    email: "joaquin.flores@plm.edu.ph",
    studentNumber: "2023-11876",
    yearLevel: "2nd Year",
    course: "BS Business Administration",
    college: "PLM Business School",
    phone: "+63 917 520 1876",
    role: "Claimant with active ownership requests",
  },
]

const yearLevels = [
  "1st Year",
  "2nd Year",
  "3rd Year",
  "4th Year",
  "5th Year",
  "6th Year",
  "7th Year",
]

const plmColleges = [
  "College of Accountancy (CA)",
  "College of Architecture and Sustainable Built Environments (CASBE)",
  "College of Business Administration (CBA)",
  "College of Education (CED)",
  "College of Engineering (CE)",
  "College of Humanities, Arts and Social Sciences (CHASS)",
  "College of Information Systems and Technology Management (CISTM)",
  "College of Medicine (CM)",
  "College of Nursing (CN)",
  "College of Physical Therapy (CPT)",
  "College of Public Administration (CPA)",
  "College of Science (CS)",
  "College of Tourism and Hospitality Management (CTHM)",
  "College of Law (CL)",
]

const photos = {
  wallet: "/items/wallet.svg",
  tech: "/items/phone.svg",
  laptop: "/items/laptop.svg",
  phone: "/items/phone.svg",
  calculator: "/items/calculator.svg",
  books: "/items/document.svg",
  keys: "/items/wallet.svg",
  id: "/items/student-id.svg",
  umbrella: "/items/flask.svg",
}

function itemImageSource(source: string) {
  const illustration = /^\/items\/(calculator|card|document|flask|laptop|pencil-case|phone|student-id|wallet)\.svg$/.exec(source)
  return illustration ? `${import.meta.env.BASE_URL}items/${illustration[1]}.jpg` : source
}

function replaceBrokenItemImage(image: HTMLImageElement, item: ApiItem) {
  const source = itemImageSource(/\bcalculator\b/i.test(item.name) ? photos.calculator : photos.books)
  if (image.getAttribute("src") !== source) image.src = source
}

const initialItems: Item[] = [
  {
    id: 1,
    name: "Black leather wallet",
    category: "Accessories",
    status: "Found",
    date: "May 18, 2025",
    location: "University Library, 2nd floor",
    description:
      "A slim black leather wallet was found beside the north reading area. Contents are secured and will be used only for ownership verification.",
    image: photos.wallet,
    reporter: "Mika Reyes",
    reporterRole: "PLM Student",
    ownerId: "finder",
    question: "What small symbol is embossed inside the wallet?",
    answer: "star",
    mine: true,
  },
  {
    id: 2,
    name: "Silver laptop with clear case",
    category: "Electronics",
    status: "Lost",
    date: "May 17, 2025",
    location: "Gusaling Villegas, Room 307",
    description:
      "13-inch silver laptop in a clear shell with two small stickers near the trackpad. Last seen after an afternoon lecture.",
    image: photos.laptop,
    reporter: "Paolo Santos",
    reporterRole: "PLM Student",
    rewardType: "money",
    rewardAmount: "500",
  },
  {
    id: 3,
    name: "PLM student ID",
    category: "IDs and Cards",
    status: "Found",
    date: "May 17, 2025",
    location: "University Activity Center",
    description:
      "Student identification card found near the west entrance. The name and number are hidden for the owner’s privacy.",
    image: photos.id,
    reporter: "Elena Cruz",
    reporterRole: "PLM Staff",
    ownerId: "staff",
    question: "What is the last digit of your student number?",
    answer: "7",
  },
  {
    id: 4,
    name: "White wireless earbuds",
    category: "Electronics",
    status: "Pending Claim",
    date: "May 16, 2025",
    location: "Tanghalang Bayan",
    description:
      "Wireless earbuds in a white charging case, found under a seat after a student assembly.",
    image: photos.tech,
    reporter: "Mika Reyes",
    reporterRole: "PLM Student",
    ownerId: "finder",
    question: "What word is written under the case?",
    answer: "north",
    mine: true,
  },
  {
    id: 5,
    name: "Scientific calculator",
    category: "Electronics",
    status: "Found",
    date: "May 15, 2025",
    location: "College of Engineering lobby",
    description:
      "Dark scientific calculator with a protective cover and a faded label on the back.",
    image: photos.calculator,
    reporter: "Nathan Lim",
    reporterRole: "PLM Student",
    question: "What are the initials on the back label?",
    answer: "ncl",
  },
  {
    id: 6,
    name: "Constitutional Law notes",
    category: "Books and Notes",
    status: "Lost",
    date: "May 15, 2025",
    location: "Justo Albert Auditorium",
    description:
      "Blue binder containing handwritten Constitutional Law notes and highlighted reading materials.",
    image: photos.books,
    reporter: "Alyssa Mendoza",
    reporterRole: "PLM Student",
    rewardType: "other",
    rewardDescription: "Coffee and a meal voucher",
  },
  {
    id: 7,
    name: "Keyring with blue tag",
    category: "Accessories",
    status: "Returned",
    date: "May 14, 2025",
    location: "PLM Chapel walkway",
    description:
      "Three keys on a silver ring with a small blue acrylic tag. Successfully returned to its owner.",
    image: photos.keys,
    reporter: "Mika Reyes",
    reporterRole: "PLM Student",
    ownerId: "finder",
    mine: true,
  },
  {
    id: 8,
    name: "Android smartphone",
    category: "Electronics",
    status: "Found",
    date: "May 14, 2025",
    location: "Intramuros Gate entrance",
    description:
      "Dark Android phone in a textured case. Screen is locked and the device is being kept safely.",
    image: photos.phone,
    reporter: "Carlos Villanueva",
    reporterRole: "External User",
    ownerId: "external",
    question: "What color is the lock-screen wallpaper?",
    answer: "green",
  },
  {
    id: 9,
    name: "Cream folding umbrella",
    category: "Others",
    status: "Lost",
    date: "May 13, 2025",
    location: "Pamantasan Gymnasium",
    description:
      "Compact cream umbrella with a wooden handle and a tan wrist strap.",
    image: photos.umbrella,
    reporter: "Bea Navarro",
    reporterRole: "PLM Student",
    rewardType: "none",
  },
]

const initialClaims: Claim[] = [
  {
    id: 1,
    itemId: 4,
    claimant: "Joaquin Flores",
    claimantId: "claimant",
    accountType: "PLM Student",
    status: "Pending",
    requested: "Today, 9:42 AM",
    verified: true,
    explanation:
      "I can also confirm the serial number in person. I last used these during the student assembly.",
  },
  {
    id: 2,
    itemId: 7,
    claimant: "Sofia Ramos",
    claimantId: "staff",
    accountType: "PLM Staff",
    status: "Approved",
    requested: "May 14, 2025",
    verified: true,
    explanation: "The keys include my faculty office key and desk key.",
  },
  {
    id: 3,
    itemId: 5,
    claimant: "Joaquin Flores",
    claimantId: "claimant",
    accountType: "PLM Student",
    status: "Rejected",
    requested: "May 16, 2025",
    verified: true,
    explanation:
      "It looked similar to the calculator I misplaced before an exam.",
  },
]

const initialConversations: Conversation[] = [
  {
    id: 1,
    itemId: 4,
    user: "Joaquin Flores",
    avatar: "JF",
    unread: 2,
    messages: [
      {
        id: 1,
        mine: false,
        text: "Hi Mika, I believe the white earbuds you found are mine.",
        time: "9:41 AM",
      },
      {
        id: 2,
        mine: true,
        text: "Thanks for reaching out. I received your claim and verification.",
        time: "9:43 AM",
      },
      {
        id: 3,
        mine: false,
        text: "I can share the serial number or meet at the library desk to verify them.",
        time: "9:46 AM",
      },
    ],
  },
  {
    id: 2,
    itemId: 7,
    user: "Sofia Ramos",
    avatar: "SR",
    unread: 0,
    messages: [
      {
        id: 1,
        mine: true,
        text: "Your claim has been approved. When can you pick up the keys?",
        time: "Yesterday",
      },
      {
        id: 2,
        mine: false,
        text: "Thank you! I can meet you by the library entrance at 3 PM.",
        time: "Yesterday",
      },
      {
        id: 3,
        mine: true,
        text: "The keys have been safely returned. Glad we found you.",
        time: "Yesterday",
      },
    ],
  },
  {
    id: 3,
    itemId: 8,
    user: "Gabriel Tan",
    avatar: "GT",
    unread: 0,
    messages: [
      {
        id: 1,
        mine: false,
        text: "Could I ask where exactly in the library the wallet was found?",
        time: "Mon",
      },
      {
        id: 2,
        mine: true,
        text: "It was beside the north reading area, close to the windows.",
        time: "Mon",
      },
    ],
  },
]

const initialNotifications = [
  {
    id: 1,
    type: "claim",
    title: "New claim request",
    text: "Joaquin Flores submitted a claim for White wireless earbuds.",
    time: "12 minutes ago",
    unread: true,
    target: "activity" as Page,
  },
  {
    id: 2,
    type: "message",
    title: "New message from Joaquin",
    text: "I can share the serial number or meet at the library desk.",
    time: "18 minutes ago",
    unread: true,
    target: "chat" as Page,
  },
  {
    id: 3,
    type: "approved",
    title: "Claim approved",
    text: "Your claim for the Blue keyring has been approved.",
    time: "Yesterday",
    unread: false,
    target: "activity" as Page,
  },
  {
    id: 4,
    type: "return",
    title: "Item successfully returned",
    text: "Blue keyring was marked as returned. Thank you for helping.",
    time: "Yesterday",
    unread: false,
    target: "activity" as Page,
  },
]

const verificationStorageKey = "reclaim_verification_attempts"

function readVerificationAttempts() {
  try {
    const value = JSON.parse(
      window.localStorage.getItem(verificationStorageKey) || "[]",
    )
    return Array.isArray(value) ? value as string[] : []
  } catch {
    return []
  }
}

function rewardText(item: Item) {
  if (item.rewardType === "money" && item.rewardAmount) {
    const amount = Number(item.rewardAmount)
    return `₱${
      Number.isFinite(amount)
        ? amount.toLocaleString("en-PH")
        : item.rewardAmount
    }`
  }
  if (item.rewardType === "other" && item.rewardDescription) {
    return item.rewardDescription
  }
  return "No Reward"
}

const navItems = [
  { id: "browse" as Page, label: "Browse items", icon: Search },
  { id: "report" as Page, label: "Report item", icon: Plus },
  { id: "activity" as Page, label: "My reports & claims", icon: FileCheck2 },
  { id: "chat" as Page, label: "Chat inbox", icon: MessageCircle },
  { id: "notifications" as Page, label: "Notifications", icon: Bell },
]

function Logo({ light = false }: { light?: boolean }) {
  return (
    <div>
      <div className={`brand ${light ? "text-white" : "text-navy"}`}>
        Re<span>Claim</span>
      </div>
      <p
        className={`text-[9px] font-semibold tracking-[0.14em] uppercase ${
          light ? "text-white/55" : "text-[#70817f]"
        }`}
      >
        PLM lost & found
      </p>
    </div>
  )
}

function PublicNav({
  view,
  onNavigate,
}: {
  view: AuthView
  onNavigate: (view: AuthView) => void
}) {
  const [open, setOpen] = useState(false)
  const navigate = (nextView: AuthView) => {
    onNavigate(nextView)
    setOpen(false)
  }

  return (
    <header className="public-header">
      <button
        className="public-logo"
        onClick={() => navigate("home")}
        aria-label="ReClaim home"
      >
        <Logo />
      </button>
      <button
        className="public-menu"
        onClick={() => setOpen((value) => !value)}
        aria-label="Toggle navigation"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      <nav className={`public-nav ${open ? "open" : ""}`}>
        <button
          className={view === "home" ? "active" : ""}
          onClick={() => navigate("home")}
        >
          Home
        </button>
        <button
          className={view === "about" ? "active" : ""}
          onClick={() => navigate("about")}
        >
          About
        </button>
        <span className="public-nav-divider" />
        <button className="login-link" onClick={() => navigate("login")}>
          Log In
        </button>
        <button className="signup-link" onClick={() => navigate("signup")}>
          Create Account
        </button>
      </nav>
    </header>
  )
}

function LostFoundIllustration({ compact = false }: { compact?: boolean }) {
  return (
    <svg
      className={compact ? "lost-found-art compact" : "lost-found-art"}
      viewBox="0 0 720 410"
      role="img"
      aria-label="Two people using ReClaim to return a lost wallet"
    >
      <path
        className="art-soft"
        d="M75 338c76-49 154-31 222-13 92 25 172 21 346-16v73H75z"
      />
      <path
        className="art-butter"
        d="M278 68h183a20 20 0 0 1 20 20v206H258V88a20 20 0 0 1 20-20z"
      />
      <rect
        className="art-paper"
        x="287"
        y="96"
        width="165"
        height="155"
        rx="8"
      />
      <path className="art-line" d="M315 130h109M315 153h82M315 176h96" />
      <path className="art-line thick" d="M351 215h38m-19 0v36" />
      <path className="art-line" d="M327 294h84M308 311h122" />

      <circle className="art-paper" cx="158" cy="163" r="39" />
      <path
        className="art-fill"
        d="M121 157c4-49 70-56 77-5-18-5-33-18-41-34-4 20-17 34-36 39z"
      />
      <path className="art-line" d="M138 165c7 6 18 6 26 0m12-3h3" />
      <path
        className="art-oyster"
        d="M107 222c6-37 30-55 57-55 31 0 56 24 61 64l13 112H85z"
      />
      <path
        className="art-line"
        d="M108 223c-11 32-23 70-29 112m143-112c15 37 24 76 25 116M137 204c12 12 27 12 39 0"
      />
      <path className="art-line" d="M221 242c49-7 79-8 112-3" />
      <path className="art-paper" d="M302 224h54v38h-54a19 19 0 0 1 0-38z" />
      <circle className="art-fill" cx="337" cy="243" r="3" />

      <circle className="art-paper" cx="574" cy="161" r="39" />
      <path
        className="art-fill"
        d="M536 159c0-47 62-61 78-19 5 14 5 36-3 51-3-34-24-48-48-59-4 15-13 23-27 27z"
      />
      <path
        className="art-line"
        d="M567 166c8 6 18 6 25 0m-16 15c7 4 14 4 21 0"
      />
      <path
        className="art-oyster"
        d="M510 225c6-39 31-58 62-58 29 0 55 22 61 63l20 113H487z"
      />
      <path
        className="art-line"
        d="M512 224c-14 29-24 68-28 111m146-110c12 34 21 72 25 111M549 205c11 11 27 11 39 0"
      />
      <path className="art-line" d="M516 241c-47-3-80-2-119 3" />
      <rect
        className="art-fill"
        x="356"
        y="225"
        width="44"
        height="36"
        rx="5"
      />
      <path className="art-paper" d="M353 235h7m32 0h7" />

      <path
        className="art-line"
        d="M94 347h559M74 84c18-18 37-18 55 0s37 18 55 0M545 69c14-14 29-14 43 0s29 14 43 0"
      />
      <path className="art-line" d="M200 72v24m-12-12h24M503 112v19m-10-9h20" />
      <circle className="art-butter" cx="81" cy="191" r="12" />
      <circle className="art-oyster" cx="656" cy="184" r="15" />
      <path className="art-line" d="M67 191h28M656 169v30" />
      <path className="art-line" d="M136 347v35m68-35v35m330-35v35m67-35v35" />
    </svg>
  )
}

function LandingPage({ onNavigate }: { onNavigate: (view: AuthView) => void }) {
  return (
    <div className="public-site">
      <PublicNav view="home" onNavigate={onNavigate} />
      <main>
        <section className="landing-hero">
          <div className="landing-copy">
            <span className="landing-kicker">
              <span />
              Community-powered lost & found
            </span>
            <h1>
              Lost something?
              <br />
              <em>Let’s bring it back.</em>
            </h1>
            <div className="landing-purpose">
              <ShieldCheck size={17} />
              <span>
                Report with care. Verify with confidence. Return with kindness.
              </span>
            </div>
          </div>
          <div className="landing-art-wrap">
            <span className="art-label label-found">
              <CheckCircle2 size={14} /> Item found
            </span>
            <span className="art-label label-secure">
              <ShieldCheck size={14} /> Verified return
            </span>
            <LostFoundIllustration />
          </div>
        </section>
      </main>
    </div>
  )
}

function AboutPage({ onNavigate }: { onNavigate: (view: AuthView) => void }) {
  return (
    <div className="public-site about-page">
      <PublicNav view="about" onNavigate={onNavigate} />
      <main className="about-main">
        <section className="about-intro">
          <p className="landing-kicker">
            <span />
            Our purpose
          </p>
          <h1>About ReClaim</h1>
          <p>
            ReClaim is a centralized lost-and-found platform for PLM students,
            faculty, staff, and visitors. It brings reporting, discovery,
            ownership verification, and secure communication into one trusted
            space—helping missing belongings find their way back to the right
            people.
          </p>
        </section>
        <section className="about-quote">
          <span aria-hidden="true">“</span>
          <blockquote>
            Every lost item has a story, and every found item is a chance to
            make someone’s day. Let’s make finding what matters easier.
          </blockquote>
        </section>
        <section className="about-contact">
          <h2>Contact Us</h2>
          <p>
            Have questions, concerns, or suggestions about ReClaim? Feel free to
            reach out to us through our email.
          </p>
          <a href="mailto:reclaim@plm.edu.ph">reclaim@plm.edu.ph</a>
        </section>
      </main>
    </div>
  )
}

function Auth({ onLogin }: { onLogin: () => Promise<void> }) {
  const [view, setView] = useState<AuthView>("home")
  const [showPassword, setShowPassword] = useState(false)
  const [accountKind, setAccountKind] = useState<"plm" | "external" | null>(null)
  const [role, setRole] = useState<"student" | "staff">("student")
  const [step, setStep] = useState(1)
  const [error, setError] = useState("")
  const [verificationEmail, setVerificationEmail] = useState("")
  const [verificationCode, setVerificationCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [successMessage, setSuccessMessage] = useState("")

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get("email") || "").trim()
    const password = String(form.get("password") || "")
    const remember = form.get("remember") === "on"
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter the email address you used to register.")
      return
    }
    setBusy(true)
    setError("")
    try {
      await login(email, password, remember)
      await onLogin()
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Sign in failed.") }
    finally { setBusy(false) }
  }

  async function submitSignupEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const email = verificationEmail.trim().toLowerCase()
    if (!/^[^\s@]+@plm\.edu\.ph$/.test(email)) {
      setError("Use your official @plm.edu.ph email address.")
      return
    }
    setBusy(true)
    setError("")
    try {
      const result = await startRegistration(email)
      setVerificationEmail(email)
      setVerificationCode("")
      setView("verify")
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not send the verification code.") }
    finally { setBusy(false) }
  }

  async function submitRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const values = Object.fromEntries([...form.entries()].map(([key, value]) => [key, String(value)]))
    if (values.password !== values.confirm) { setError("Passwords do not match."); return }
    if (!values.privacy) { setError("Agree to the privacy policy to continue."); return }
    setBusy(true)
    setError("")
    try {
      await register({
        ...values,
        accountType: "plm",
        role,
        idNumber: values.id || "",
        phone: values.contact || "",
      })
      setVerificationEmail(values.email.trim().toLowerCase())
      setError("")
      setView("login")
      window.alert("Your PLM resident account is ready. Sign in with your PLM resident email and password.")
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Account creation failed.") }
    finally { setBusy(false) }
  }

  async function submitVerification() {
    setBusy(true)
    setError("")
    try {
      await verifyRegistrationEmail(verificationEmail, verificationCode)
      setStep(2)
      setView("signup")
      setError("")
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Verification failed.") }
    finally { setBusy(false) }
  }

  if (view === "signup") return <SignupFlow onDone={async (email) => {
    if (!email) { setSuccessMessage(""); setView("login"); return }
    await onLogin()
  }} />

  if (view === "home") {
    return <LandingPage onNavigate={setView} />
  }

  if (view === "about") {
    return <AboutPage onNavigate={setView} />
  }

  if (view === "forgot") {
    return (
      <ForgotPassword onBack={() => setView("login")} onNavigate={setView} />
    )
  }

  if (view === "verify") {
    return (
      <div className="auth-page">
        <PublicNav view={view} onNavigate={setView} />
        <main className="auth-stage">
          <AuthDecor />
          <div className="auth-card auth-card-surface max-w-[470px] text-center">
            <div className="mx-auto mb-6 grid size-16 place-items-center rounded-2xl bg-sage text-teal">
              <ShieldCheck size={31} />
            </div>
            <p className="eyebrow">One last step</p>
            <h1 className="font-display text-3xl font-bold text-navy mt-2">
              Verify your email
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted">
              Enter the 6-digit code sent to {verificationEmail}.
            </p>
            <div className="mt-7 flex justify-center gap-2">
              {[0, 1, 2, 3, 4, 5].map((number) => (
                <input
                  key={number}
                  maxLength={1}
                  className="code-input"
                  value={verificationCode[number] || ""}
                  onChange={(event) => {
                    const digit = event.target.value.replace(/\D/g, "").slice(-1)
                    setVerificationCode((current) => {
                      const next = current.padEnd(6, " ").split("")
                      next[number] = digit || " "
                      return next.join("").trimEnd()
                    })
                  }}
                  aria-label={`Digit ${number + 1}`}
                />
              ))}
            </div>
            {error && <div className="form-error mt-4">{error}</div>}
            <button
              className="btn-primary mt-7 w-full"
              disabled={busy || verificationCode.length !== 6}
              onClick={submitVerification}
            >
              Verify and continue <ChevronRight size={17} />
            </button>
            <button
              className="text-button mt-4"
              disabled={busy}
              onClick={async () => {
                setError("")
                try {
                  await resendVerification(verificationEmail)
                } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not resend code.") }
              }}
            >
              Resend verification code
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <PublicNav view={view} onNavigate={setView} />
      <main className="auth-stage">
        <AuthDecor />
        <div
          className="auth-card auth-card-surface max-w-[470px]"
        >
          {view === "login" ? (
            <>
              <p className="eyebrow text-center">Good to see you again</p>
              <h1 className="auth-title text-center">Welcome Back!</h1>
              <p className="auth-copy">
                Sign in with your PLM Resident or External User account.
              </p>
              {successMessage && (
                <div className="form-error mt-4 !border-emerald-200 !bg-emerald-50 !text-emerald-800">
                  <CheckCircle2 size={16} />
                  {successMessage}
                </div>
              )}
              <form className="mt-8 space-y-5" onSubmit={submitLogin}>
                <Field
                  label="Email address"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  icon={<UserRound size={17} />}
                />
                <div>
                  <label className="field-label" htmlFor="password">
                    Password
                  </label>
                  <div className="field-wrap">
                    <LockKeyhole size={17} />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                    />
                    <button
                      type="button"
                      className="field-action"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>
                {error && (
                  <div className="form-error">
                    <XCircle size={16} />
                    {error}
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 text-[#546866]">
                    <input name="remember" type="checkbox" className="accent-[#4B2E1F]" />{" "}
                    Remember me
                  </label>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setView("forgot")}
                  >
                    Forgot password?
                  </button>
                </div>
                <button className="btn-primary w-full" type="submit">
                  {busy ? "Signing in…" : "Sign in"} <ChevronRight size={17} />
                </button>
              </form>
              <p className="mt-7 text-center text-sm text-muted">
                Don’t have an account?{" "}
                <button
                  className="text-button font-semibold"
                  onClick={() => setView("signup")}
                >
                  Sign Up
                </button>
              </p>
            </>
          ) : (
            <>
              <button
                className="back-link"
                onClick={() => {
                  setView("login")
                  setAccountKind(null)
                  setStep(1)
                }}
              >
                <ChevronLeft size={16} /> Back to sign in
              </button>
              <div className="mt-5 flex items-start justify-between gap-5">
                <div>
                  <p className="eyebrow">Create your account</p>
                  <h1 className="font-display text-[32px] leading-tight font-bold text-navy mt-2">
                    Join the recovery network.
                  </h1>
                </div>
                <span className="step-chip">Step {step} of 2</span>
              </div>
              {!accountKind ? (
                <>
                  <div className="mt-8 grid gap-4 sm:grid-cols-2">
                    <AccountCard
                      icon={<IdCard />}
                      title="PLM Resident / Staff"
                      text="Use your verified university credentials."
                      onClick={() => setAccountKind("plm")}
                    />
                    <AccountCard
                      icon={<UserRound />}
                      title="External User"
                      text="For visitors and members of other schools."
                      onClick={() => setAccountKind("external")}
                    />
                  </div>
                  <p className="mt-7 text-center text-sm text-muted">
                    Already have an account?{" "}
                    <button
                      className="text-button font-semibold"
                      onClick={() => setView("login")}
                    >
                      Log In
                    </button>
                  </p>
                </>
              ) : (
                <form className="mt-7" onSubmit={submitRegistration}>
                  <button
                    type="button"
                    className="text-button mb-5 flex items-center gap-1"
                    onClick={() => setAccountKind(null)}
                  >
                    <ChevronLeft size={15} /> Change account type
                  </button>
                  {accountKind === "plm" && (
                    <div className="segmented mb-5">
                      <button
                        type="button"
                        className={role === "student" ? "active" : ""}
                        onClick={() => setRole("student")}
                      >
                        Student
                      </button>
                      <button
                        type="button"
                        className={role === "staff" ? "active" : ""}
                        onClick={() => setRole("staff")}
                      >
                        Staff
                      </button>
                    </div>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Full name"
                      name="name"
                      placeholder="Your complete name"
                    />
                    {accountKind === "external" && (
                      <Field
                        label="Age"
                        name="age"
                        type="number"
                        placeholder="18"
                      />
                    )}
                    <Field
                      label={
                        accountKind === "plm"
                          ? "Official PLM resident email"
                          : "Gmail address"
                      }
                      name="email"
                      placeholder="Email Address"
                    />
                    {accountKind === "external" ? (
                      <>
                        <Field
                          label="Contact number"
                          name="contact"
                          placeholder="+63 9XX XXX XXXX"
                        />
                        <Field
                          label="School / University (optional)"
                          name="school"
                          placeholder="Current school"
                        />
                      </>
                    ) : (
                      <>
                        <Field
                          label={
                            role === "student"
                              ? "Student number"
                              : "Staff ID number"
                          }
                          name="id"
                          placeholder={
                            role === "student" ? "2022-12345" : "PLM-STAFF-001"
                          }
                        />
                        <Field
                          label="Contact number"
                          name="contact"
                          placeholder="Enter your contact number"
                          inputMode="tel"
                          pattern="^[0-9+() -]{7,20}$"
                          title="Enter a valid contact number using 7 to 20 digits or common phone symbols."
                        />
                        {role === "student" && (
                          <>
                            <SelectField
                              label="Year Level"
                              name="year"
                              placeholder="Select Year Level"
                              options={yearLevels}
                            />
                            <Field
                              label="Course / Program"
                              name="course"
                              placeholder="BS Information Technology"
                            />
                            <SelectField
                              label="College"
                              name="college"
                              placeholder="Select College"
                              options={plmColleges}
                            />
                          </>
                        )}
                      </>
                    )}
                    <Field
                      label="Password"
                      name="password"
                      type="password"
                      placeholder="At least 8 characters"
                    />
                    <Field
                      label="Confirm password"
                      name="confirm"
                      type="password"
                      placeholder="Repeat password"
                    />
                  </div>
                  <label className="mt-5 flex items-start gap-2 text-xs leading-5 text-muted">
                    <input
                      required
                      type="checkbox"
                      className="mt-1 accent-[#4B2E1F]"
                      name="privacy"
                      value="yes"
                    />
                    I agree to ReClaim’s privacy and responsible use policy.
                    Your account will be created after email verification.
                  </label>
                  {error && <div className="form-error mt-4">{error}</div>}
                  <button className="btn-primary mt-6 w-full" type="submit">
                    {busy ? "Creating account…" : "Create account"} <ChevronRight size={17} />
                  </button>
                  <p className="mt-6 text-center text-sm text-muted">
                    Already have an account?{" "}
                    <button
                      type="button"
                      className="text-button font-semibold"
                      onClick={() => setView("login")}
                    >
                      Log In
                    </button>
                  </p>
                </form>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

function SignupFlow({ onDone }: { onDone: (email: string) => void | Promise<void> }) {
  const [stage, setStage] = useState<"choose" | "email" | "otp" | "details">("choose")
  const [accountKind, setAccountKind] = useState<"plm" | "external">("plm")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [role, setRole] = useState<"student" | "staff">("student")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [details, setDetails] = useState({ name: "", studentNumber: "", phone: "", school: "", password: "", confirm: "" })
  const passwordRule = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/
  const external = accountKind === "external"

  async function sendCode(event: FormEvent) {
    event.preventDefault()
    const normalized = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) { setError("Enter a valid email address."); return }
    if (!external && !/^[^\s@]+@plm\.edu\.ph$/.test(normalized)) { setError("Use your official @plm.edu.ph email."); return }
    setBusy(true); setError("")
    try {
      await startRegistration(normalized, external ? "External User" : "PLM")
      setEmail(normalized); setCode(""); setStage("otp")
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not send the code.") }
    finally { setBusy(false) }
  }

  async function checkCode(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("")
    try { await verifyRegistrationEmail(email, code); setStage("details") }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Code verification failed.") }
    finally { setBusy(false) }
  }

  async function createAccount(event: FormEvent) {
    event.preventDefault(); setError("")
    if (!passwordRule.test(details.password)) { setError("Password needs 8+ characters, an uppercase letter, a number, and a special character."); return }
    if (details.password !== details.confirm) { setError("Passwords do not match."); return }
    setBusy(true)
    try {
      await register({ ...details, email, accountType: external ? "External User" : "PLM", role, idNumber: details.studentNumber, phone: details.phone })
      await onDone(email)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create your account.") }
    finally { setBusy(false) }
  }

  function goBack() {
    setError("")
    if (stage === "choose") onDone("")
    else if (stage === "email") setStage("choose")
    else if (stage === "otp") setStage("email")
    else setStage("otp")
  }

  return <div className="auth-page"><PublicNav view="signup" onNavigate={() => {}} /><main className="auth-stage"><AuthDecor /><div className="auth-card auth-card-surface max-w-[600px]">
    <button className="back-link" onClick={goBack}><ChevronLeft size={16} /> Back</button>
    {stage === "choose" && <><p className="eyebrow mt-5">Create your account</p><h1 className="font-display text-3xl font-bold text-navy mt-2">Join the recovery network.</h1><div className="mt-6 grid gap-4 sm:grid-cols-2"><AccountCard icon={<IdCard />} title="PLM Resident / Staff" text="Use your verified university credentials." onClick={() => { setAccountKind("plm"); setStage("email") }} /><AccountCard icon={<UserRound />} title="External User" text="For visitors and members of other schools." onClick={() => { setAccountKind("external"); setStage("email") }} /></div></>}
    {stage === "email" && <><p className="eyebrow mt-5">{external ? "External account registration" : "PLM resident account registration"}</p><h1 className="font-display text-3xl font-bold text-navy mt-2">Verify your email first.</h1><form className="mt-6 space-y-5" onSubmit={sendCode}><p className="auth-copy">We'll send a one-time code to your {external ? "email inbox" : "PLM Outlook inbox"}.</p><label className="field-label" htmlFor="signup-email">{external ? "Email address" : "Official PLM resident email"}</label><input className="plain-input w-full" id="signup-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder={external ? "you@example.com" : "name@plm.edu.ph"} />{error && <div className="form-error">{error}</div>}<button className="btn-primary w-full" disabled={busy}>{busy ? "Sending code…" : "Send OTP"}<ChevronRight size={16} /></button></form></>}
    {stage === "otp" && <><p className="eyebrow mt-5">Email verification</p><h1 className="font-display text-3xl font-bold text-navy mt-2">Check your inbox.</h1><form className="mt-6 space-y-5" onSubmit={checkCode}><p className="auth-copy">Enter the six-digit code sent to <b>{email}</b>.</p><label className="field-label" htmlFor="signup-otp">One-time password</label><input className="plain-input w-full text-center tracking-[0.35em]" id="signup-otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" />{error && <div className="form-error">{error}</div>}<button className="btn-primary w-full" disabled={busy || code.length !== 6}>{busy ? "Verifying…" : "Verify email"}<ChevronRight size={16} /></button><button type="button" className="text-button" disabled={busy} onClick={async () => { setError(""); try { await resendVerification(email); setCode("") } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not resend code.") } }}>Resend code</button></form></>}
    {stage === "details" && <><p className="eyebrow mt-5">{external ? "External account" : "PLM resident account"}</p><h1 className="font-display text-3xl font-bold text-navy mt-2">Complete your account.</h1><form className="mt-6 space-y-4" onSubmit={createAccount}><p className="auth-copy">Verified email: <b>{email}</b></p>{!external && <div className="segmented"><button type="button" className={role === "student" ? "active" : ""} onClick={() => setRole("student")}>Student</button><button type="button" className={role === "staff" ? "active" : ""} onClick={() => setRole("staff")}>Staff</button></div>}<label className="field-label" htmlFor="signup-name">Full name</label><input className="plain-input w-full" id="signup-name" required value={details.name} onChange={(event) => setDetails({ ...details, name: event.target.value })} />{external ? <><label className="field-label" htmlFor="signup-school">School / University (optional)</label><input className="plain-input w-full" id="signup-school" value={details.school} onChange={(event) => setDetails({ ...details, school: event.target.value })} /><label className="field-label" htmlFor="signup-phone">Contact number</label><input className="plain-input w-full" id="signup-phone" type="tel" required value={details.phone} onChange={(event) => setDetails({ ...details, phone: event.target.value })} /></> : <><label className="field-label" htmlFor="signup-id">{role === "student" ? "Student number" : "Staff ID"}</label><input className="plain-input w-full" id="signup-id" required value={details.studentNumber} onChange={(event) => setDetails({ ...details, studentNumber: event.target.value })} /><label className="field-label" htmlFor="signup-phone">Contact number</label><input className="plain-input w-full" id="signup-phone" type="tel" required value={details.phone} onChange={(event) => setDetails({ ...details, phone: event.target.value })} /></>}<label className="field-label" htmlFor="signup-password">Password</label><div className="field-wrap"><input id="signup-password" className="w-full" type={showPassword ? "text" : "password"} required value={details.password} onChange={(event) => setDetails({ ...details, password: event.target.value })} /><button type="button" className="field-action" onClick={() => setShowPassword(!showPassword)} aria-label="Toggle password visibility">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div><small className="text-muted">At least 8 characters, with uppercase, number, and special character.</small><label className="field-label" htmlFor="signup-confirm">Confirm password</label><div className="field-wrap"><input id="signup-confirm" className="w-full" type={showPassword ? "text" : "password"} required value={details.confirm} onChange={(event) => setDetails({ ...details, confirm: event.target.value })} /><button type="button" className="field-action" onClick={() => setShowPassword(!showPassword)} aria-label="Toggle password visibility">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div><label className="flex items-start gap-2 text-xs text-muted"><input type="checkbox" required />I agree to ReClaim's privacy and responsible use policy.</label>{error && <div className="form-error">{error}</div>}<button className="btn-primary w-full" disabled={busy}>{busy ? "Creating account…" : "Create account"}<ChevronRight size={16} /></button></form></>}
  </div></main></div>
}
function AuthDecor() {
  return (
    <div className="auth-decor" aria-hidden="true">
      <div className="auth-art">
        <LostFoundIllustration compact />
      </div>
      <span className="decor-loop loop-one" />
      <span className="decor-loop loop-two" />
      <span className="decor-block block-one" />
      <span className="decor-block block-two" />
    </div>
  )
}

function ForgotPassword({
  onBack,
  onNavigate,
}: {
  onBack: () => void
  onNavigate: (view: AuthView) => void
}) {
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  return (
    <div className="auth-page">
      <PublicNav view="forgot" onNavigate={onNavigate} />
      <main className="auth-stage">
        <AuthDecor />
        <div className="auth-card auth-card-surface max-w-[470px]">
          <button className="back-link" onClick={onBack}>
            <ChevronLeft size={16} /> Back to login
          </button>
          <div className="mt-7 grid size-13 place-items-center rounded-2xl bg-sage text-teal">
            <KeyRound />
          </div>
          <p className="eyebrow mt-6">Account recovery</p>
          <h1 className="auth-title">
            {step === 1 ? "Reset your password." : step === 2 ? "Verify the code." : step === 3 ? "Choose a new password." : "Password updated."}
          </h1>
          {step === 1 && (
            <>
              <p className="auth-copy">
                Enter the email address linked to your account. We'll send a reset code to its inbox.
              </p>
              <label className="field-label mt-7 block" htmlFor="reset-email">Account email address</label>
              <input id="reset-email" className="plain-input mt-2 w-full" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
              {error && <div className="form-error mt-4">{error}</div>}
              <button
                className="btn-primary mt-6 w-full"
                disabled={busy || !email.trim()}
                onClick={async () => {
                  setBusy(true); setError("")
                  try {
                    await requestPasswordReset(email)
                    setCode("")
                    setStep(2)
                  } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not request a reset code.") }
                  finally { setBusy(false) }
                }}
              >
                {busy ? "Sending…" : "Send reset code"} <Send size={16} />
              </button>
            </>
          )}
          {step === 2 && (
            <>
              <p className="auth-copy">Enter the six-digit code sent to {email}. You’ll set a new password after verification.</p>
              <div className="mt-7 space-y-4">
                <label className="field-label block" htmlFor="reset-code">Verification code</label>
                <input id="reset-code" className="plain-input w-full text-center tracking-[0.35em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit code" />
              </div>
              {error && <div className="form-error mt-4">{error}</div>}
              <button
                className="btn-primary mt-6 w-full"
                disabled={busy || code.length !== 6}
                onClick={async () => {
                  setBusy(true); setError("")
                  try { await verifyPasswordReset(email, code); setStep(3) }
                  catch (cause) { setError(cause instanceof Error ? cause.message : "Code verification failed.") }
                  finally { setBusy(false) }
                }}
              >
                {busy ? "Verifying…" : "Verify code"} <Check size={16} />
              </button>
            </>
          )}
          {step === 3 && (
            <>
              <p className="auth-copy">Your code is verified. Create a strong new password.</p>
              <label className="field-label mt-5 block" htmlFor="new-password">New password</label>
              <div className="field-wrap"><input id="new-password" className="w-full" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8+ chars, uppercase, number, symbol" /><button type="button" className="field-action" onClick={() => setShowPassword(!showPassword)} aria-label="Toggle password visibility">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
              <label className="field-label mt-4 block" htmlFor="confirm-password">Confirm new password</label>
              <div className="field-wrap"><input id="confirm-password" className="w-full" type={showPassword ? "text" : "password"} value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder="Repeat new password" /><button type="button" className="field-action" onClick={() => setShowPassword(!showPassword)} aria-label="Toggle password visibility">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
              {error && <div className="form-error mt-4">{error}</div>}
              <button className="btn-primary mt-6 w-full" disabled={busy || !password || !confirm} onClick={async () => { if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password)) { setError("Password needs 8+ characters, uppercase, a number, and a special character."); return } if (password !== confirm) { setError("Passwords do not match."); return } setBusy(true); setError(""); try { await resetPassword(email, code, password); setStep(4) } catch (cause) { setError(cause instanceof Error ? cause.message : "Password reset failed.") } finally { setBusy(false) } }}>{busy ? "Updating…" : "Change password"}<Check size={16} /></button>
            </>
          )}
          {step === 4 && (
            <>
              <p className="auth-copy">Your password has been reset successfully. You can now sign in with your new credentials.</p>
              <button className="btn-primary mt-7 w-full" onClick={onBack}>Return to login <ChevronRight size={16} /></button>
            </>
          )}        </div>
      </main>
    </div>
  )
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  icon,
  inputMode,
  pattern,
  title,
}: {
  label: string
  name: string
  type?: string
  placeholder: string
  icon?: React.ReactNode
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]
  pattern?: string
  title?: string
}) {
  return (
    <div>
      <label className="field-label" htmlFor={name}>
        {label}
      </label>
      <div className="field-wrap">
        {icon}
        <input
          id={name}
          name={name}
          type={type}
          placeholder={placeholder}
          inputMode={inputMode}
          pattern={pattern}
          title={title}
          required={!label.includes("optional")}
        />
      </div>
    </div>
  )
}

function SelectField({
  label,
  name,
  placeholder,
  options,
}: {
  label: string
  name: string
  placeholder: string
  options: string[]
}) {
  return (
    <div>
      <label className="field-label" htmlFor={name}>
        {label}
      </label>
      <select
        id={name}
        name={name}
        className="select-field"
        defaultValue=""
        required
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  )
}

function AccountCard({
  icon,
  title,
  text,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  text: string
  onClick: () => void
}) {
  return (
    <button className="account-card" onClick={onClick}>
      <span className="account-icon">{icon}</span>
      <span className="font-display text-lg font-semibold text-navy">
        {title}
      </span>
      <span className="mt-1 text-sm leading-5 text-muted">{text}</span>
      <span className="mt-5 flex items-center gap-1 text-sm font-semibold text-teal">
        Select <ChevronRight size={15} />
      </span>
    </button>
  )
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<DemoUser | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [restoringSession, setRestoringSession] = useState(true)
  const [page, setPage] = useState<Page>("browse")
  const [items, setItems] = useState<ApiItem[]>([])
  const [claims, setClaims] = useState<ApiClaim[]>([])
  const [conversations, setConversations] = useState<ApiConversation[]>([])
  const [notifications, setNotifications] = useState<ApiNotification[]>([])
  const [selectedItem, setSelectedItem] = useState<ApiItem | null>(null)
  const [mobileNav, setMobileNav] = useState(false)
  const [toast, setToast] = useState("")
  const accountMenu = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    function dismissAccountMenu(event: PointerEvent) {
      const menu = accountMenu.current
      if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) menu.open = false
    }
    document.addEventListener("pointerdown", dismissAccountMenu)
    return () => document.removeEventListener("pointerdown", dismissAccountMenu)
  }, [])

  function mapUser(user: ApiUser): DemoUser {
    return {
      ...user,
      initials: user.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
    }
  }

  function applyWorkspace(data: Awaited<ReturnType<typeof bootstrap>>, routeToHome = false) {
    setCurrentUser(mapUser(data.user))
    setIsAdmin(data.isAdmin)
    if (routeToHome || window.location.pathname === "/admin") {
      const path = data.isAdmin ? "/admin" : "/"
      if (window.location.pathname !== path) window.history.replaceState(null, "", path)
      setPage(data.isAdmin ? "admin" : "browse")
    }
    setItems(data.items.map((item) => ({ ...item, mine: item.ownerId === data.user.id })))
    setClaims(data.claims)
    setConversations(data.conversations)
    setNotifications(data.notifications)
  }

  async function refreshWorkspace(routeToHome = false) {
    const data = await bootstrap()
    applyWorkspace(data, routeToHome)
    return data
  }

  useEffect(() => {
    let active = true
    void bootstrap().then((data) => {
      if (active) applyWorkspace(data, true)
    }).catch(() => {
      if (active) clearSession()
    }).finally(() => {
      if (active) setRestoringSession(false)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!currentUser) return
    function syncRoute() {
      const adminRoute = window.location.pathname === "/admin"
      if (adminRoute && !isAdmin) window.history.replaceState(null, "", "/")
      setPage(adminRoute && isAdmin ? "admin" : "browse")
    }
    window.addEventListener("popstate", syncRoute)
    return () => window.removeEventListener("popstate", syncRoute)
  }, [currentUser, isAdmin])
  function notify(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(""), 2800)
  }

  function goTo(nextPage: Page) {
    if (nextPage === "admin" && !isAdmin) return
    if (nextPage === "admin" && window.location.pathname !== "/admin") window.history.pushState(null, "", "/admin")
    setPage(nextPage)
    setMobileNav(false)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function closeAccountMenu() {
    if (accountMenu.current) accountMenu.current.open = false
  }

  async function signOut() {
    closeAccountMenu()
    await logout().catch(() => {})
    setCurrentUser(null)
    setItems([])
    setClaims([])
    setConversations([])
    setNotifications([])
    setSelectedItem(null)
    goTo("browse")
  }

  if (restoringSession) return <p role="status" className="p-6">Checking your session…</p>

  if (!currentUser)
    return (
      <Auth
        onLogin={async () => { await refreshWorkspace(true) }}
      />
    )

  const userItems = items.map((item) => ({
    ...item,
    mine: item.ownerId === currentUser.id,
  }))
  const unread = notifications.filter(
    (notification) => notification.unread,
  ).length

  if (isAdmin && page === "admin") {
    return <AdminConsole user={currentUser} brand={<Logo light />} onSignOut={async () => {
      await logout()
      window.history.replaceState(null, "", "/")
      setCurrentUser(null)
      setIsAdmin(false)
      setPage("browse")
    }} />
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="px-6 pt-7 pb-8">
          <Logo light />
        </div>
        <nav className="flex-1 px-3">
          <p className="nav-label">Workspace</p>
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${page === id ? "active" : ""}`}
              onClick={() => goTo(id)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {id === "chat" && conversations.some((entry) => entry.unread > 0) && <span className="nav-count">{conversations.reduce((sum, entry) => sum + entry.unread, 0)}</span>}
              {id === "notifications" && unread > 0 && (
                <span className="nav-count gold">{unread}</span>
              )}
            </button>
          ))}
          {isAdmin && <><p className="nav-label mt-8">Administration</p><button className={`nav-item ${page === "admin" ? "active" : ""}`} onClick={() => goTo("admin")}><BarChart3 size={18} /><span>Admin console</span></button></>}
          <p className="nav-label mt-8">Account</p>
          <button
            className={`nav-item ${page === "profile" ? "active" : ""}`}
            onClick={() => goTo("profile")}
          >
            <Settings size={18} />
            <span>Profile & settings</span>
          </button>
        </nav>
        <div className="sidebar-user">
          <button className="sidebar-profile" onClick={() => goTo("profile")}>
            <AccountAvatar className="avatar" user={currentUser} />
            <span className="min-w-0 text-left">
              <b>{currentUser.name}</b>
              <small>{displayAccountType(currentUser.accountType)}</small>
            </span>
          </button>
          <button
            className="logout-button"
            onClick={signOut}
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>
      {mobileNav && (
        <button
          className="mobile-scrim"
          onClick={() => setMobileNav(false)}
          aria-label="Close menu"
        />
      )}
      <div className="main-column">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMobileNav(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div className="topbar-context">
            <span>ReClaim workspace</span>
            <ChevronRight size={13} />
            <b>
              {navItems.find((item) => item.id === page)?.label || (page === "admin" ? "Admin console" : "Profile & settings")}
            </b>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              className="top-action hidden sm:flex"
              onClick={() => goTo("report")}
            >
              <Plus size={16} /> Report item
            </button>
            <button
              className="icon-button relative"
              onClick={() => goTo("notifications")}
              aria-label="Notifications"
            >
              <Bell size={19} />
              {unread > 0 && <span className="notification-dot">{unread}</span>}
            </button>
            <details className="top-profile-menu" ref={accountMenu} onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) closeAccountMenu()
            }} onKeyDown={(event) => {
              if (event.key === "Escape" && event.currentTarget.open) {
                event.preventDefault()
                closeAccountMenu()
                event.currentTarget.querySelector("summary")?.focus()
              }
            }}>
              <summary className="top-profile" aria-label="Account menu">
                <AccountAvatar className="avatar small" user={currentUser} />
                <ChevronDown size={15} aria-hidden="true" />
              </summary>
              <div className="top-profile-options">
                <button type="button" onClick={() => {
                  closeAccountMenu()
                  goTo("profile")
                }}><Settings size={16} /> Profile &amp; settings</button>
                <button type="button" onClick={signOut}><LogOut size={16} /> Sign out</button>
              </div>
            </details>
          </div>
        </header>
        <main className="content">
          {page === "browse" && (
            <Browse
              items={userItems.filter((item) => item.privacy !== "Held")}
              onSelect={setSelectedItem}
              onReport={() => goTo("report")}
            />
          )}
          {page === "report" && (
            <ReportForm
              onCancel={() => goTo("browse")}
              user={currentUser}
              onSubmit={async (item) => {
                const result = await createItem(item)
                await refreshWorkspace()
                goTo(result.privacy === "Held" ? "activity" : "browse")
                notify(result.privacy === "Held" ? "Your report is awaiting a privacy review." : "Your report is now live in Browse Items.")
              }}
            />
          )}
          {page === "activity" && (
            <Activity
              items={userItems}
              claims={claims}
              currentUserId={currentUser.id}
              onSelect={setSelectedItem}
              onUpdateClaim={async (claimId, status) => {
                try {
                  await updateClaim(claimId, status)
                  await refreshWorkspace()
                  notify(`Claim ${status.toLowerCase()} and claimant notified.`)
                } catch (cause) { notify(cause instanceof Error ? cause.message : "Could not update claim.") }
              }}
              onReturned={async (itemId) => {
                try {
                  await markReturned(itemId)
                  await refreshWorkspace()
                  notify("Item marked as returned. Recovery complete.")
                } catch (cause) { notify(cause instanceof Error ? cause.message : "Could not update item.") }
              }}
              onUndoReturned={async (itemId) => {
                try { await undoReturned(itemId); await refreshWorkspace(); notify("Return undone. Claims are open again.") }
                catch (cause) { notify(cause instanceof Error ? cause.message : "Could not undo return.") }
              }}
            />
          )}
          {page === "chat" && (
            <Chat
              conversations={conversations}
              items={items}
              setConversations={setConversations}
              onRefresh={refreshWorkspace}
            />
          )}
          {page === "notifications" && (
            <Notifications
              notifications={notifications}
              setNotifications={setNotifications}
              goTo={goTo}
              onRead={async (notification, unread) => {
                try { await setNotificationRead(String(notification.id), unread) }
                catch (cause) { notify(cause instanceof Error ? cause.message : "Could not update notification.") }
              }}
            />
          )}
          {page === "profile" && (
            <Profile
              user={currentUser}
              notify={notify}
              onLogout={signOut}
              onSave={async (photo) => {
                const user = await saveProfile({ photo })
                setCurrentUser(mapUser(user))
              }}
              reportCount={items.filter((item) => item.ownerId === currentUser.id).length}
              returnCount={items.filter((item) => item.ownerId === currentUser.id && item.status === "Returned").length}
            />
          )}
        </main>
      </div>
      {selectedItem && (
        <ItemModal
          item={selectedItem}
          verificationAlreadySubmitted={claims.some((claim) => claim.itemId === selectedItem.id && claim.claimantId === currentUser.id)}
          onClose={() => setSelectedItem(null)}
          onMessage={async () => {
            try {
              const conversation = await startConversation(selectedItem.id)
              setConversations((all) => all.some((entry) => entry.id === conversation.id) ? all : [conversation, ...all])
              setSelectedItem(null)
              goTo("chat")
            } catch (cause) { notify(cause instanceof Error ? cause.message : "Could not start a conversation.") }
          }}
          onClaim={async (answer, proof, explanation) => {
            await createClaim({ itemId: selectedItem.id, answer, proof, explanation })
            await refreshWorkspace()
            setSelectedItem(null)
            notify("Claim submitted. A secure conversation is now available.")
            return true
          }}
          onUndoReturn={async () => {
            try { await undoReturned(selectedItem.id); await refreshWorkspace(); setSelectedItem(null); notify("Return undone. Claims are open again.") }
            catch (cause) { notify(cause instanceof Error ? cause.message : "Could not undo return.") }
          }}
        />
      )}
      {toast && (
        <div className="toast">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
    </div>
  )
}

function Browse({
  items,
  onSelect,
  onReport,
}: {
  items: Item[]
  onSelect: (item: Item) => void
  onReport: () => void
}) {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("All")
  const [category, setCategory] = useState("All")
  const categories = [
    "All",
    "Electronics",
    "IDs and Cards",
    "Books and Notes",
    "Accessories",
    "Others",
  ]
  const visibleItems = useMemo(
    () =>
      items.filter((item) => {
        const haystack =
          `${item.name} ${item.description} ${item.location}`.toLowerCase()
        return (
          haystack.includes(search.toLowerCase()) &&
          (status === "All" || item.status === status) &&
          (category === "All" || item.category === category)
        )
      }),
    [items, search, status, category],
  )

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="hero-kicker">
            <ShieldCheck size={15} /> Trusted PLM community network
          </span>
          <h1>
            Helping lost things
            <br />
            <span>find their way home.</span>
          </h1>
          <p>
            Search verified campus reports or tell the community what you’ve
            lost or found.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button className="btn-cream" onClick={onReport}>
              <Plus size={17} /> Report an item
            </button>
            <button className="btn-ghost" onClick={() => setStatus("Found")}>
              Browse found items <ChevronRight size={17} />
            </button>
          </div>
        </div>
        <div className="hero-stats">
          <div>
            <b>142</b>
            <span>items reunited</span>
          </div>
          <div>
            <b>38</b>
            <span>active reports</span>
          </div>
          <div>
            <b>92%</b>
            <span>verified returns</span>
          </div>
        </div>
      </section>

      <section className="search-panel">
        <div className="search-main">
          <Search size={20} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by item, description, or campus location..."
          />
          {search && (
            <button onClick={() => setSearch("")} aria-label="Clear search">
              <X size={17} />
            </button>
          )}
        </div>
        <div className="status-toggle">
          {["All", "Lost", "Found", "Returned"].map((value) => (
            <button
              key={value}
              className={status === value ? "active" : ""}
              onClick={() => setStatus(value)}
            >
              {value === "Lost" ? "Lost items" : value === "Found" ? "Found items" : value}
            </button>
          ))}
        </div>
      </section>
      <div className="category-row">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
          <SlidersHorizontal size={15} /> Filter
        </span>
        {categories.map((value) => (
          <button
            key={value}
            className={category === value ? "active" : ""}
            onClick={() => setCategory(value)}
          >
            {value}
          </button>
        ))}
      </div>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Campus feed</p>
          <h2>Recently reported items</h2>
        </div>
        <span>
          {visibleItems.length}{" "}
          {visibleItems.length === 1 ? "result" : "results"}
        </span>
      </div>
      {visibleItems.length ? (
        <div className="item-grid">
          {visibleItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onClick={() => onSelect(item)}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div>
            <Search size={28} />
          </div>
          <h3>No matching items found</h3>
          <p>Try a broader search or change one of your filters.</p>
          <button
            className="btn-secondary"
            onClick={() => {
              setSearch("")
              setStatus("All")
              setCategory("All")
            }}
          >
            Clear all filters
          </button>
        </div>
      )}
    </>
  )
}

function ItemCard({ item, onClick }: ItemCardProps) {
  return (
    <article className="item-card" onClick={onClick}>
      <div className="item-image">
        <img src={itemImageSource(item.image)} alt={item.name} onError={(event) => replaceBrokenItemImage(event.currentTarget, item)} />
        <StatusBadge status={item.status} />
      </div>
      <div className="item-content">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="item-category">{item.category}</p>
            <h3>{item.name}</h3>
            {(item.status === "Lost" || item.status === "Found") && <small className="block text-blue-700">{item.status === "Lost" ? "Owner is looking for this" : "Finder is looking for the owner"}</small>}
          </div>
          <button className="card-arrow" aria-label={`View ${item.name}`}>
            <ChevronRight size={18} />
          </button>
        </div>
        <p className="item-description">{item.description}</p>
        {item.status === "Lost" && (
          <div
            className={`reward-card-label ${
              item.rewardType && item.rewardType !== "none" ? "offered" : ""
            }`}
          >
            <WalletCards size={13} />
            <span>
              {item.rewardType && item.rewardType !== "none"
                ? `Reward Offered · ${rewardText(item)}`
                : "No Reward"}
            </span>
          </div>
        )}
        <div className="item-meta">
          <span>
            <MapPin size={14} />
            {item.location}
          </span>
          <span>
            <Clock3 size={14} />
            {item.date}
          </span>
        </div>
      </div>
    </article>
  )
}

function StatusBadge({ status }: { status: ItemStatus | ClaimStatus }) {
  const label = status === "Lost" ? "LOST ITEM" : status === "Found" ? "FOUND ITEM" : status === "Returned" ? "RETURNED TO OWNER" : status === "Pending Claim" ? "CLAIM PENDING" : status
  return (
    <span
      className={`status-badge status-${status.toLowerCase().replace(" ", "-")}`}
    >
      {label}
    </span>
  )
}

function ReportForm({
  onCancel,
  onSubmit,
  user,
}: {
  onCancel: () => void
  onSubmit: (item: Item) => Promise<void>
  user: DemoUser
}) {
  const [kind, setKind] = useState<"Lost" | "Found">("Lost")
  const [rewardType, setRewardType] = useState<RewardType>("none")
  const [preview, setPreview] = useState("")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setSaving(true)
    setSaveError("")
    try { await onSubmit({
      id: Date.now(),
      name: String(form.get("name")),
      category: String(form.get("category")),
      status: kind,
      date: String(form.get("date") || ""),
      location: String(form.get("location")),
      description: String(form.get("description")),
      image: preview || (kind === "Lost" ? photos.books : photos.tech),
      reporter: user.name,
      reporterRole: user.accountType,
      ownerId: user.id,
      question: kind === "Found" ? String(form.get("question")) : undefined,
      answer:
        kind === "Found" ? String(form.get("answer")).toLowerCase() : undefined,
      rewardType: kind === "Lost" ? rewardType : undefined,
      rewardAmount:
        kind === "Lost" && rewardType === "money"
          ? String(form.get("rewardAmount"))
          : undefined,
      rewardDescription:
        kind === "Lost" && rewardType === "other"
          ? String(form.get("rewardDescription"))
          : undefined,
      mine: true,
    }) } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "Could not save this report.")
    } finally { setSaving(false) }
  }
  return (
    <div className="page-narrow">
      <PageTitle
        eyebrow="New campus report"
        title="What happened?"
        text="Share clear details to help the right person recognize and recover the item."
      />
      <form onSubmit={submit} className="form-card">
        <div className="report-choice">
          <button
            type="button"
            className={kind === "Lost" ? "active lost" : ""}
            onClick={() => setKind("Lost")}
          >
            <Search />
            <span>
              <b>I lost something</b>
              <small>Ask the community for help</small>
            </span>
            <CheckCircle2 />
          </button>
          <button
            type="button"
            className={kind === "Found" ? "active found" : ""}
            onClick={() => setKind("Found")}
          >
            <PackageCheck />
            <span>
              <b>I found something</b>
              <small>Help return it safely</small>
            </span>
            <CheckCircle2 />
          </button>
        </div>
        <div className="form-section">
          <h3>Item details</h3>
          <p>
            Give people enough information to identify the item, without
            revealing private proof.
          </p>
          <div className="form-grid">
            <Field
              label="Item name"
              name="name"
              placeholder="e.g. Black leather wallet"
            />
            <div>
              <label className="field-label" htmlFor="category">
                Category
              </label>
              <select id="category" name="category" className="select-field">
                <option>Electronics</option>
                <option>IDs and Cards</option>
                <option>Books and Notes</option>
                <option>Accessories</option>
                <option>Others</option>
              </select>
            </div>
            <Field
              label={`Date ${kind.toLowerCase()}`}
              name="date"
              type="date"
              placeholder=""
            />
            <Field
              label="Campus location"
              name="location"
              placeholder="Building, floor, or nearby landmark"
            />
            <div className="sm:col-span-2">
              <label className="field-label" htmlFor="description">
                ITEM DESCRIPTION
              </label>
              <textarea
                id="description"
                name="description"
                rows={4}
                required
                placeholder="Describe color, condition, unique marks, and relevant context..."
              />
            </div>
          </div>
        </div>
        {kind === "Found" && (
          <div className="security-box">
            <div className="security-icon">
              <ShieldCheck />
            </div>
            <div className="flex-1">
              <h3>Private ownership verification</h3>
              <p>
                This answer is encrypted in a production system and is never
                shown publicly.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field
                  label="Security question"
                  name="question"
                  placeholder="What unique mark is on the item?"
                />
                <Field
                  label="Expected correct answer"
                  name="answer"
                  type="text"
                  placeholder="Private answer"
                />
              </div>
            </div>
          </div>
        )}
        {kind === "Lost" && (
          <div className="form-section reward-section">
            <h3>Offer a Reward (Optional)</h3>
            <p>
              Would you like to offer a reward to someone who finds your missing
              item? You may offer money or another item as a token of
              appreciation. This is completely optional.
            </p>
            <div className="mt-4">
              <label className="field-label" htmlFor="rewardType">
                Reward option
              </label>
              <select
                id="rewardType"
                name="rewardType"
                className="select-field"
                value={rewardType}
                onChange={(event) =>
                  setRewardType(event.target.value as RewardType)
                }
              >
                <option value="none">No Reward Offered</option>
                <option value="money">Money</option>
                <option value="other">Item / Other Reward</option>
              </select>
            </div>
            {rewardType === "money" && (
              <div className="mt-4">
                <label className="field-label" htmlFor="rewardAmount">
                  Reward amount
                </label>
                <div className="currency-field">
                  <span>₱</span>
                  <input
                    id="rewardAmount"
                    name="rewardAmount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="Enter amount"
                    required
                  />
                </div>
              </div>
            )}
            {rewardType === "other" && (
              <div className="mt-4">
                <Field
                  label="Reward description"
                  name="rewardDescription"
                  placeholder="Describe the item or other reward"
                />
              </div>
            )}
          </div>
        )}
        <div className="form-section border-0">
          <h3>Item photo</h3>
          <p>A clear photo can make an item much easier to recognize.</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (!file) return
              if (file.size > 2 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
                event.target.value = ""
                return
              }
              const reader = new FileReader()
              reader.onload = () => setPreview(String(reader.result || ""))
              reader.readAsDataURL(file)
            }}
          />
          <button
            type="button"
            className={`upload-area ${preview ? "has-preview" : ""}`}
            onClick={() => fileRef.current?.click()}
          >
            {preview ? (
              <img src={preview} alt="Item preview" />
            ) : (
              <>
                <span>
                  <Camera size={24} />
                </span>
                <b>Upload a clear item photo</b>
                <small>PNG or JPG, up to 2 MB</small>
              </>
            )}
          </button>
        </div>
        <div className="form-actions">
          <button type="button" className="btn-tertiary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-primary" type="submit" disabled={saving}>
            <Send size={16} /> {saving ? "Saving report…" : "Submit report"}
          </button>
        </div>
        {saveError && <div className="form-error mt-4">{saveError}</div>}
      </form>
    </div>
  )
}

function PageTitle({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string
  title: string
  text: string
}) {
  return (
    <div className="page-title">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{text}</p>
    </div>
  )
}

function ItemModal({
  item,
  verificationAlreadySubmitted,
  onClose,
  onMessage,
  onClaim,
  onUndoReturn,
}: {
  item: Item
  verificationAlreadySubmitted: boolean
  onClose: () => void
  onMessage: () => void | Promise<void>
  onClaim: (answer: string, proof: string, explanation: string) => Promise<boolean>
  onUndoReturn: () => void | Promise<void>
}) {
  const [claimStep, setClaimStep] = useState<"detail" | "verify" | "proof">(
    "detail",
  )
  const [answer, setAnswer] = useState("")
  const [proof, setProof] = useState("")
  const [proofError, setProofError] = useState("")
  const [explanation, setExplanation] = useState("")
  const [duplicateDialog, setDuplicateDialog] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [claimError, setClaimError] = useState("")
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="item-modal">
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
        <div className="modal-image">
          <img src={itemImageSource(item.image)} alt={item.name} onError={(event) => replaceBrokenItemImage(event.currentTarget, item)} />
          <StatusBadge status={item.status} />
        </div>
        <div className="modal-body">
          {claimStep === "detail" && (
            <>
              <p className="item-category">{item.category}</p>
              <h2>{item.name}</h2>
              {(item.status === "Lost" || item.status === "Found") && <small className="block text-blue-700">{item.status === "Lost" ? "Owner is looking for this" : "Finder is looking for the owner"}</small>}
              <div className="modal-meta">
                <span>
                  <MapPin />
                  {item.location}
                </span>
                <span>
                  <Clock3 />
                  {item.date}
                </span>
              </div>
              <section className="item-description-block">
                <span>Full description & identifying details</span>
                <p>{item.description}</p>
              </section>
              {item.status === "Lost" && (
                <section
                  className={`reward-detail ${
                    item.rewardType && item.rewardType !== "none"
                      ? "offered"
                      : ""
                  }`}
                >
                  <span>
                    {item.rewardType && item.rewardType !== "none"
                      ? "Reward Offered"
                      : "No Reward Offered"}
                  </span>
                  <b>{rewardText(item)}</b>
                </section>
              )}
              <div className="reporter-box">
                <span className="avatar">
                  {item.reporter
                    .split(" ")
                    .map((part) => part[0])
                    .join("")}
                </span>
                <div>
                  <small>Reported by</small>
                  <b>{item.reporter}</b>
                  <span>
                    <ShieldCheck size={13} /> {item.reporterRole} · Verified
                  </span>
                </div>
              </div>
              <div className="privacy-note">
                <LockKeyhole size={16} />
                <span>
                  Personal contact details stay private. Use ReClaim chat to
                  communicate safely.
                </span>
              </div>
              <div className="modal-actions">
                {!item.mine && <button className="btn-secondary" onClick={onMessage}>
                  <MessageCircle size={16} /> {item.status === "Returned" ? "Think this is yours? Message the finder" : "Message reporter"}
                </button>}
                {item.mine && item.status === "Returned" && <button className="btn-primary" onClick={onUndoReturn}>Undo return</button>}
                {(item.status === "Found" ||
                  item.status === "Pending Claim") && (
                  <button
                    className="btn-primary"
                    onClick={() => {
                      if (verificationAlreadySubmitted) {
                        setDuplicateDialog(true)
                      } else {
                        setClaimStep("verify")
                      }
                    }}
                  >
                    <ShieldCheck size={16} /> Request to claim
                  </button>
                )}
              </div>
            </>
          )}
          {claimStep === "verify" && (
            <>
              <button
                className="back-link"
                onClick={() => setClaimStep("detail")}
              >
                <ChevronLeft size={16} /> Item details
              </button>
              <div className="step-icon">
                <ShieldCheck />
              </div>
              <p className="eyebrow">Step 1 of 2</p>
              <h2>Verify ownership</h2>
              <p className="modal-description">
                Answer the finder's private question to continue. Your answer is
                checked privately and does not approve the claim automatically.
              </p>
              <div className="question-card">
                <HelpCircle size={18} />
                <div>
                  <small>Security question</small>
                  <b>{item.question}</b>
                </div>
              </div>
              <label className="field-label mt-5" htmlFor="claim-answer">
                Your answer
              </label>
              <input
                id="claim-answer"
                className="plain-input"
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder="Enter your answer"
              />
              <button
                className="btn-primary mt-5 w-full"
                disabled={submitting || !answer.trim()}
                onClick={async () => {
                  setSubmitting(true)
                  setClaimError("")
                  try {
                    await verifyAnswer(item.id, answer)
                    setClaimStep("proof")
                  } catch (cause) {
                    setClaimError(cause instanceof Error ? cause.message : "Could not verify that answer.")
                  } finally { setSubmitting(false) }
                }}
              >
                {submitting ? "Checking…" : "Verify and continue"} <ChevronRight size={16} />
              </button>
              {claimError && <div className="form-error mt-3">{claimError}</div>}
            </>
          )}
          {claimStep === "proof" && (
            <>
              <button
                className="back-link"
                onClick={() => setClaimStep("verify")}
              >
                <ChevronLeft size={16} /> Verification
              </button>
              <div className="step-icon">
                <FileCheck2 />
              </div>
              <p className="eyebrow">Step 2 of 2</p>
              <h2>Support your claim</h2>
              <p className="modal-description">
                Add an optional photo or explanation as private supporting
                evidence. Only you and the finder can see this.
              </p>
              <label className="proof-upload">
                <input
                  type="file"
                  accept=".jpg,.jpeg,image/jpeg"
                  className="hidden"
                  onChange={async (event) => {
                    const input = event.currentTarget
                    const file = event.target.files?.[0]
                    if (!file) return
                    setProofError("")
                    const maxSize = 2 * 1024 * 1024
                    if (file.size > maxSize) {
                      setProof("")
                      setProofError(
                        "The photo must be 2 MB or smaller.",
                      )
                      input.value = ""
                      return
                    }
                    const extensionIsValid = /\.(jpe?g)$/i.test(file.name)
                    const signature = new Uint8Array(
                      await file.slice(0, 3).arrayBuffer(),
                    )
                    const hasJpegSignature =
                      signature[0] === 0xff &&
                      signature[1] === 0xd8 &&
                      signature[2] === 0xff
                    if (
                      file.type !== "image/jpeg" ||
                      !extensionIsValid ||
                      !hasJpegSignature
                    ) {
                      setProof("")
                      setProofError(
                        "Invalid file format. Please upload a JPG or JPEG image only.",
                      )
                      input.value = ""
                      return
                    }
                    const reader = new FileReader()
                    reader.onload = () => setProof(String(reader.result || ""))
                    reader.onerror = () => setProofError("Could not read that photo.")
                    reader.readAsDataURL(file)
                  }}
                />
                {proof ? (
                  <img src={proof} alt="Claim proof preview" />
                ) : (
                  <>
                    <Upload size={21} />
                    <span>
                      <b>Upload private proof photo</b>
                      <small>Choose a JPG or JPEG file</small>
                    </span>
                  </>
                )}
              </label>
              <p className="proof-helper">
                Upload a photo of yourself with the item as additional proof of
                ownership. Accepted formats: JPG and JPEG. Maximum file size: 2 MB.
              </p>
              {proofError && (
                <div className="form-error mt-3">
                  <XCircle size={16} />
                  {proofError}
                </div>
              )}
              <label className="field-label mt-5" htmlFor="explanation">
                Additional explanation (optional)
              </label>
              <textarea
                id="explanation"
                rows={3}
                value={explanation}
                onChange={(event) => setExplanation(event.target.value)}
                placeholder="Share any serial number, memory, or detail that could help..."
              />
              <button
                className="btn-primary mt-5 w-full"
                disabled={submitting}
                onClick={async () => {
                  if (submitting) return
                  setSubmitting(true)
                  setClaimError("")
                  try {
                    const accepted = await onClaim(answer, proof, explanation)
                    if (!accepted) {
                    setClaimStep("detail")
                    setDuplicateDialog(true)
                    }
                  } catch (cause) {
                    setClaimError(cause instanceof Error ? cause.message : "Could not submit the claim.")
                  } finally {
                    setSubmitting(false)
                  }
                }}
              >
                {submitting ? "Submitting…" : "Submit claim request"} <Send size={16} />
              </button>
              {claimError && <div className="form-error mt-3">{claimError}</div>}
            </>
          )}
        </div>
        {duplicateDialog && (
          <div className="verification-dialog-layer">
            <div
              className="verification-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="verification-dialog-title"
            >
              <div className="verification-dialog-icon">
                <ShieldCheck size={22} />
              </div>
              <h3 id="verification-dialog-title">
                Verification Already Submitted
              </h3>
              <p>
                You have already submitted your verification answers for this
                item. You are only allowed to answer the verification questions
                once per Found item. Please wait for the finder to review your
                claim request and respond.
              </p>
              <button
                className="btn-primary"
                onClick={() => {
                  setDuplicateDialog(false)
                  setClaimStep("detail")
                }}
              >
                OK
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Activity({
  items,
  claims,
  currentUserId,
  onSelect,
  onUpdateClaim,
  onReturned,
  onUndoReturned,
}: {
  items: Item[]
  claims: Claim[]
  currentUserId: string
  onSelect: (item: Item) => void
  onUpdateClaim: (id: number, status: "Approved" | "Rejected") => void
  onReturned: (id: number) => void
  onUndoReturned: (id: number) => void
}) {
  const [tab, setTab] = useState<"reported" | "claims" | "found">("reported")
  const myItems = items.filter((item) => item.mine)
  const myClaims = claims.filter((claim) => claim.claimantId === currentUserId)
  const incoming = claims.filter(
    (claim) =>
      items.find((item) => item.id === claim.itemId)?.mine &&
      claim.claimantId !== currentUserId,
  )
  return (
    <>
      <PageTitle
        eyebrow="Your activity"
        title="Reports and claims"
        text="Track every report, review incoming claims, and follow each recovery through return."
      />
      <div className="tabs">
        <button
          className={tab === "reported" ? "active" : ""}
          onClick={() => setTab("reported")}
        >
          Items reported <span>{myItems.length}</span>
        </button>
        <button
          className={tab === "claims" ? "active" : ""}
          onClick={() => setTab("claims")}
        >
          My claims <span>{myClaims.length}</span>
        </button>
        <button
          className={tab === "found" ? "active" : ""}
          onClick={() => setTab("found")}
        >
          Items I found <span>{incoming.length}</span>
        </button>
      </div>
      {tab === "reported" && (
        <div className="list-card">
          {myItems.map((item) => (
            <ActivityRow
              key={item.id}
              item={item}
              onSelect={onSelect}
              extra={
                item.status === "Claimed" ? (
                  <button
                    className="btn-small"
                    onClick={(event) => {
                      event.stopPropagation()
                      onReturned(item.id)
                    }}
                  >
                    Mark as returned
                  </button>
                ) : item.status === "Returned" ? (
                  <button className="btn-small" onClick={(event) => { event.stopPropagation(); onUndoReturned(item.id) }}>Undo return</button>
                ) : (
                  <button className="icon-button">
                    <Pencil size={16} />
                  </button>
                )
              }
            />
          ))}
        </div>
      )}
      {tab === "claims" && (
        <div className="list-card">
          {myClaims.map((claim) => {
            const item = items.find((entry) => entry.id === claim.itemId)!
            return (
              <ActivityRow
                key={claim.id}
                item={item}
                onSelect={onSelect}
                extra={
                  <div className="text-right">
                    <StatusBadge status={claim.status} />
                    <small className="mt-2 block text-muted">
                      {claim.requested}
                    </small>
                  </div>
                }
              />
            )
          })}
        </div>
      )}
      {tab === "found" && (
        <div className="space-y-4">
          {[...new Set(incoming.map((claim) => claim.itemId))].map((itemId) => {
            const item = items.find((entry) => entry.id === itemId)!
            const itemClaims = incoming.filter((claim) => claim.itemId === itemId)
            const pendingClaims = itemClaims.filter((claim) => claim.status === "Pending")
            return (
              <article key={itemId} className="claim-review">
                <div className="claim-header">
                  <img src={itemImageSource(item.image)} alt="" onError={(event) => replaceBrokenItemImage(event.currentTarget, item)} />
                  <div>
                    <p className="item-category">{item.name}</p>
                    <h3>{item.description}</h3>
                    <span>Reported by {item.reporter}</span>
                  </div>
                </div>
                <div className="claim-details"><div><small>Pending ownership claim by</small><p>{pendingClaims.map((claim) => claim.claimant).join(", ") || "No pending claimants"}</p></div></div>
                {pendingClaims.map((claim) => (
                  <div key={claim.id} className="claim-actions">
                    <span>{claim.claimant}</span>
                    <button className="btn-reject" onClick={() => onUpdateClaim(claim.id, "Rejected")}><XCircle size={16} /> Reject</button>
                    <button className="btn-primary" onClick={() => onUpdateClaim(claim.id, "Approved")}><CheckCircle2 size={16} /> Approve</button>
                  </div>
                ))}
                {itemClaims.some((claim) => claim.status === "Approved") && item.status !== "Returned" && (
                  <div className="claim-actions"><button className="btn-primary" onClick={() => onReturned(item.id)}><PackageCheck size={16} /> Mark as returned</button></div>
                )}
                {item.status === "Returned" && <div className="claim-actions"><button className="btn-small" onClick={() => onUndoReturned(item.id)}>Undo return</button></div>}
              </article>
            )
          })}
        </div>
      )}
    </>
  )
}

function ActivityRow({
  item,
  onSelect,
  extra,
}: {
  item: Item
  onSelect: (item: Item) => void
  extra: React.ReactNode
}) {
  return (
    <button className="activity-row" onClick={() => onSelect(item)}>
      <img src={itemImageSource(item.image)} alt="" onError={(event) => replaceBrokenItemImage(event.currentTarget, item)} />
      <div className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2">
          <h3>{item.name}</h3>
          <StatusBadge status={item.status} />
        </div>
        <p>
          <MapPin size={13} />
          {item.location}
          <span>·</span>
          {item.date}
        </p>
        {item.status === "Lost" && (
          <small className="activity-reward">
            <WalletCards size={12} />
            {item.rewardType && item.rewardType !== "none"
              ? `Reward: ${rewardText(item)}`
              : "No Reward"}
          </small>
        )}
      </div>
      {extra}
    </button>
  )
}

function Chat({
  conversations,
  items,
  setConversations,
  onRefresh,
}: {
  conversations: Conversation[]
  items: Item[]
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>
  onRefresh: () => Promise<unknown>
}) {
  const [selected, setSelected] = useState(conversations[0]?.id)
  const [message, setMessage] = useState("")
  const [search, setSearch] = useState("")
  const [error, setError] = useState("")
  const conversation =
    conversations.find((entry) => entry.id === selected) || conversations[0]
  const item = items.find((entry) => entry.id === conversation?.itemId)
  const conversationName = conversation?.user
  async function send() {
    if (!message.trim() || !conversation) return
    setError("")
    try {
      await sendMessage(conversation.id, message.trim())
      setMessage("")
      await onRefresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not send message.") }
  }
  return (
    <>
      <PageTitle
        eyebrow="Secure messaging"
        title="Chat inbox"
        text="Every conversation stays connected to a specific report or claim."
      />
      <div className="chat-shell">
        <aside
          className={`conversation-list ${conversation ? "has-selection" : ""}`}
        >
          <div className="conversation-head">
            <h3>Messages</h3>
            <button className="icon-button">
              <Pencil size={16} />
            </button>
          </div>
          <div className="conversation-search">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search conversations"
            />
          </div>
          <div className="conversation-scroll">
            {conversations
              .filter((entry) => {
                return entry.user.toLowerCase().includes(search.toLowerCase())
              })
              .map((entry) => {
                const related = items.find(
                  (candidate) => candidate.id === entry.itemId,
                )
                const displayName = entry.user
                const displayAvatar = displayName
                  ?.split(" ")
                  .map((part) => part[0])
                  .join("")
                const last = entry.messages[entry.messages.length - 1]
                return (
                  <button
                    key={entry.id}
                    className={`conversation ${
                      selected === entry.id ? "active" : ""
                    }`}
                    onClick={() => {
                      setSelected(entry.id)
                      setConversations((all) =>
                        all.map((item) =>
                          item.id === entry.id ? { ...item, unread: 0 } : item,
                        ),
                      )
                      void markConversationRead(entry.id).then(() => onRefresh())
                    }}
                  >
                    <span className="avatar">{displayAvatar}</span>
                    <span className="conversation-copy">
                      <span>
                        <b>{displayName}</b>
                      <small>{last?.time || "No messages yet"}</small>
                      </span>
                      <em>{related?.name}</em>
                      <p className={entry.unread > 0 ? "font-bold" : ""}>{last?.text || "Start the conversation"}</p>
                    </span>
                    {entry.unread > 0 && <i>{entry.unread}</i>}
                  </button>
                )
              })}
          </div>
        </aside>
        {conversation && item && (
          <section className="message-pane">
            <header className="message-head">
              <span className="avatar">
                {conversationName
                  ?.split(" ")
                  .map((part) => part[0])
                  .join("")}
              </span>
              <div>
                <b>{conversationName}</b>
                <small>Active now</small>
              </div>
              <button className="related-item">
                <img src={itemImageSource(item.image)} alt="" onError={(event) => replaceBrokenItemImage(event.currentTarget, item)} />
                <span>
                  <small>Related item</small>
                  <b>{item.name}</b>
                </span>
                <ChevronRight size={16} />
              </button>
            </header>
            <div className="secure-strip">
              <LockKeyhole size={14} /> Messages are private to claim
              participants
            </div>
            <div className="messages">
              <div className="message-date">Today</div>
              {conversation.messages.map((entry) => (
                <div
                  key={entry.id}
                  className={`message-wrap ${entry.mine ? "mine" : ""}`}
                >
                  <div className={`message ${!entry.mine && !entry.read ? "font-bold" : ""}`}>{entry.text}</div>
                  <span>{entry.time}{entry.mine && <small className="ml-2">{entry.read ? "Seen" : "Sent"}</small>}</span>
                </div>
              ))}
            </div>
            {error && <div className="form-error mx-5">{error}</div>}
            <div className="message-compose">
              <button className="icon-button">
                <Plus size={18} />
              </button>
              <input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") send()
                }}
                placeholder="Write a message..."
              />
              <button
                className="send-button"
                onClick={send}
                aria-label="Send message"
              >
                <Send size={17} />
              </button>
            </div>
          </section>
        )}
      </div>
    </>
  )
}

function Notifications({
  notifications,
  setNotifications,
  goTo,
  onRead,
}: {
  notifications: ApiNotification[]
  setNotifications: React.Dispatch<React.SetStateAction<ApiNotification[]>>
  goTo: (page: Page) => void
  onRead: (notification: ApiNotification, unread: boolean) => void
}) {
  return (
    <>
      <div className="flex items-end justify-between gap-4">
        <PageTitle
          eyebrow="Stay up to date"
          title="Notifications"
          text="Claim updates, new messages, and return milestones in one place."
        />
        <button
          className="text-button mb-7 whitespace-nowrap"
          onClick={() =>
            {
              setNotifications((all) => all.map((entry) => ({ ...entry, unread: false })))
              notifications.filter((entry) => entry.unread).forEach((entry) => onRead(entry, false))
            }
          }
        >
          <Check size={15} /> Mark all as read
        </button>
      </div>
      <div className="notification-list">
        {notifications.map((notification) => {
          const Icon =
            notification.type === "message"
              ? MessageCircle
              : notification.type === "claim"
                ? FileCheck2
                : notification.type === "return"
                  ? PackageCheck
                  : CheckCircle2
          return (
            <button
              key={notification.id}
              className={`notification ${notification.unread ? "unread" : ""}`}
              onClick={() => {
                setNotifications((all) =>
                  all.map((entry) =>
                    entry.id === notification.id
                      ? { ...entry, unread: false }
                      : entry,
                  ),
                )
                onRead(notification, false)
                goTo(notification.target as Page)
              }}
            >
              <span className="notification-icon">
                <Icon size={19} />
              </span>
              <span className="flex-1 text-left">
                <span>
                  <b>{notification.title}</b>
                  <small>{notification.time}</small>
                </span>
                <p>{notification.text}</p>
              </span>
              {notification.unread && <i />}
            </button>
          )
        })}
      </div>
    </>
  )
}

function Profile({
  user,
  notify,
  onLogout,
  onSave,
  reportCount,
  returnCount,
}: {
  user: DemoUser
  notify: (message: string) => void
  onLogout: () => void | Promise<void>
  onSave: (photo: string) => Promise<void>
  reportCount: number
  returnCount: number
}) {
  const [photo, setPhoto] = useState(user.photo || "")
  const [photoError, setPhotoError] = useState("")
  const photoRef = useRef<HTMLInputElement>(null)
  const [phone] = useState(user.phone || "")
  const [securityOpen, setSecurityOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [securityError, setSecurityError] = useState("")
  return (
    <>
      <PageTitle
        eyebrow="Account management"
        title="Profile & settings"
        text="Review your verified identity and manage the details other users can see."
      />
      <div className="profile-grid">
        <aside className="profile-card">
          <div className="profile-photo">
            {photo ? <img src={photo} alt="Profile" /> : user.initials}
            <input ref={photoRef} className="hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 2 * 1024 * 1024) { setPhotoError("Profile photo must be 2 MB or smaller."); event.target.value = ""; return } const reader = new FileReader(); reader.onload = async () => { const next = String(reader.result || ""); try { await onSave(next); setPhoto(next); setPhotoError(""); notify("Profile photo updated.") } catch (cause) { setPhotoError(cause instanceof Error ? cause.message : "Could not save photo.") } }; reader.readAsDataURL(file) }} />
            <button type="button" onClick={() => photoRef.current?.click()} aria-label="Edit profile photo">
              <Camera size={15} />
            </button>
          </div>
          {photoError && <small className="form-error">{photoError}</small>}
          <h2>{user.name}</h2>
          <p>{user.email}</p>
          <span className="verified-chip">
            <ShieldCheck size={14} /> {verifiedAccountLabel(user.accountType)}
          </span>
          <div className="profile-stats">
            <div>
              <b>{reportCount}</b>
              <span>Reports</span>
            </div>
            <div>
              <b>{returnCount}</b>
              <span>Returns</span>
            </div>
          </div>
          <button className="btn-tertiary w-full mt-6" onClick={onLogout}>
            <LogOut size={16} /> Sign out
          </button>
        </aside>
        <section className="settings-card">
          <div className="settings-head"><div><h3>{user.accountType === "External User" ? "External account details" : "PLM resident account details"}</h3><p>These verified details can't be edited here.</p></div></div>
          <div className="settings-fields">
            <ProfileField label="Full name" value={user.name} />
            <ProfileField label={user.accountType === "External User" ? "Account email" : "Official PLM resident email"} value={user.email} />
            {user.accountType === "External User" ? (
              <ProfileField label="School / University" value={user.school || "Not provided"} />
            ) : (
              <ProfileField label={user.staffId ? "Staff ID" : "Student number"} value={user.staffId || user.studentNumber || "Not provided"} />
            )}
            <ProfileField label="Contact number" value={phone} placeholder="Not provided" />
          </div>
          <div className="settings-divider" />
          <div className="settings-head">
            <div>
              <h3>Password & security</h3>
              <p>Use a strong, unique password to protect your claims.</p>
            </div>
            <button
              className="btn-tertiary"
              onClick={() => { setSecurityError(""); setSecurityOpen((open) => !open) }}
            >
              <KeyRound size={16} /> {securityOpen ? "Cancel password change" : "Change password"}
            </button>
          </div>
          {securityOpen && (
            <div className="settings-fields mt-5">
              <label className="field-label" htmlFor="current-password">Current password</label>
              <input id="current-password" className="plain-input" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
              <label className="field-label" htmlFor="profile-new-password">New password</label>
              <input id="profile-new-password" className="plain-input" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
              <label className="field-label" htmlFor="profile-confirm-password">Confirm new password</label>
              <input id="profile-confirm-password" className="plain-input" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
              {securityError && <div className="form-error">{securityError}</div>}
              <button className="btn-primary" onClick={async () => {
                if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(newPassword)) { setSecurityError("Password needs 8+ characters, uppercase, a number, and a special character."); return }
                if (newPassword !== confirmPassword) { setSecurityError("Passwords do not match."); return }
                try {
                  await changePassword(currentPassword, newPassword)
                  setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); setSecurityError(""); setSecurityOpen(false)
                  notify("Password updated.")
                } catch (cause) { setSecurityError(cause instanceof Error ? cause.message : "Could not update password.") }
              }}>Update password</button>
            </div>
          )}
          <div className="security-status">
            <ShieldCheck size={20} />
            <div>
              <b>Email verification active</b>
              <p>Your account email has been verified.</p>
            </div>
            <CheckCircle2 size={18} />
          </div>
        </section>
      </div>
    </>
  )
}

function ProfileField({
  label,
  value,
  editable = false,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  editable?: boolean
  onChange?: (value: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label>
        {label}
        {!editable && <LockKeyhole size={11} />}
      </label>
        <input value={value} placeholder={placeholder} disabled={!editable} onChange={(event) => onChange?.(event.target.value)} />
    </div>
  )
}



