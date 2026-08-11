# Hotel Operations Platforms — Blueprint

Two fully independent systems, one per department. No shared login, database, or hosting. Each is built, deployed, and maintained on its own.

| | **Resident Officer Platform** | **Security Platform** |
|---|---|---|
| Working name | Duty Desk | Gatehouse |
| Owns | Duty management, guest/resident issues, facility problems | Incidents, access control, patrols, emergencies |
| Primary user | Resident Officer / Duty Manager | Security Officer |
| Also used by | Front Desk, Housekeeping, Engineering, GM (oversight) | Security Supervisor, Management (oversight) |
| Data | Own database, own hosting | Own database, own hosting |

---

## 1. Resident Officer Platform — "Duty Desk"

### 1.1 Purpose
The operational hub for whoever is on duty. Covers everything that isn't a security matter: guest and resident issues, room/facility problems, cross-department tasks, and the shift-to-shift record of what happened on property.

### 1.2 User roles
| Role | Access |
|---|---|
| Resident Officer / Duty Manager | Full access — log, assign, resolve, close out shift |
| Front Desk | Raise complaints/requests, view status |
| Housekeeping | View & update assigned tasks |
| Engineering / Maintenance | View & update assigned facility tickets |
| General Manager | Read-only oversight, reports |

### 1.3 Core modules

**0. Apartment Readiness Checklist** *(flagship module — replaces the current paper form)*

This is the digital version of the existing "Destination Apartment Checklist" — the 73-item inspection every Resident Officer is supposed to complete before front desk checks a guest in, covering furniture/room condition, kitchen equipment, bathroom & toiletries, electronics/remotes, and utilities (MiFi, gas, water).

It directly solves the two problems you raised:
- **No documentation happening** → the checklist can't be skipped: front desk can't mark a unit "ready for check-in" until the officer has submitted it in-system. No paper form to forget or misplace.
- **No accountability when something goes wrong** → every checklist is timestamped and signed to the officer who completed it, per apartment, per date. If an incident is later traced to Apartment 12B on a given day, the system shows exactly who inspected it, when, and what condition every item was in.

How it works:
- Officer selects apartment + checklist type (**Check-in prep** or **Check-out inspection**), items are grouped the same way the paper form does (room, kitchen, bathroom, electronics, toiletries/utilities).
- Each item gets: quantity (where relevant), condition status (Good / Damaged / Missing / N/A).
- Any item marked Damaged or Missing automatically opens a linked **Maintenance Ticket** (see below) instead of being written down and forgotten.
- On submit, the checklist is locked, timestamped, and attributed to the officer — this becomes the permanent record for that apartment on that date.
- Front desk sees a simple **Ready / Not Ready** status per apartment, pulled straight from the latest submitted checklist — check-in is **hard-blocked** for any unit marked Not Ready. No manual override; the unit only unlocks once a Resident Officer resubmits the checklist as Ready.
- Full history per apartment: every past checklist, searchable by date, apartment, or officer — this is what answers "who was in charge" after the fact.

1. **Shift Handover & Duty Log** — free-text and structured log per shift; each incoming officer sees a summary of the outgoing shift before starting.
2. **Guest / Resident Complaints & Requests** — log a complaint or request, assign to a department, track to resolution.
3. **Room & Facility Issue Reporting / Maintenance Tickets** — standalone tickets (e.g. "AC not working, Room 214") and tickets auto-created from a failed checklist item — both route to Engineering or Housekeeping, tracked as a ticket with priority and status.
4. **Resident Records** — for longer-stay residents: room, stay dates, preferences, notes, contact info.
5. **Task Assignment** — ad hoc cross-department tasks with owner and due time.
6. **Daily Duty Report** — auto-compiled end-of-shift summary: open items, resolved items, handover notes, for GM review.

### 1.4 Data model (entities)
- `ApartmentChecklist` — apartment/unit, type (check-in prep / check-out), prepared by, date, status (In Progress / Submitted / Locked), overall ready flag
- `ChecklistItem` — belongs to a checklist; item name, category (room / kitchen / bathroom / electronics / toiletries-utilities), quantity placed, condition (Good / Damaged / Missing / N/A), linked maintenance ticket (if flagged)
- `DutyLogEntry` — officer, shift date/time, notes, handover flag
- `Complaint` — guest/resident name, room, category, description, priority, assigned dept, status, resolution notes, timestamps
- `MaintenanceTicket` — area/room, issue type, reported by, assigned to, priority, status (Reported → In Progress → Resolved), photos (optional), source (manual / auto from checklist)
- `ResidentProfile` — name, room, stay dates, preferences, notes
- `Task` — description, assigned to, due time, status
- `DailyReport` — auto-generated rollup per shift

### 1.5 Typical workflows

**Pre check-in (the core daily flow):** Officer opens the Apartment Readiness Checklist for the unit → works through all 73 items → an AC unit is marked Damaged → this auto-creates a Maintenance Ticket assigned to Engineering → officer submits the checklist as "Not Ready" until it's fixed → Engineering resolves and updates the ticket → officer re-checks that item → resubmits as "Ready" → front desk now sees the unit as Ready and proceeds with check-in. Every step is timestamped and attributed.

**Facility issue reported outside a checklist:** Guest reports a broken AC to front desk → Front Desk logs a **Room/Facility Issue** in Duty Desk → ticket auto-routes to Engineering with priority → Duty Officer tracks status → ticket resolved and logged → appears in end-of-shift Daily Report.

---

## 2. Security Platform — "Gatehouse"

*(This is the platform already prototyped — the working app built earlier.)*

### 2.1 Purpose
Everything security-specific: incidents, physical access, patrols, and emergency alerts. Separate department, separate concerns from Duty Desk.

### 2.2 User roles
| Role | Access |
|---|---|
| Security Officer | Log incidents, run patrols, issue/return keys, raise alerts |
| Security Supervisor | All officer access + oversight, reassign, close out |
| Management | Read-only oversight, reports |

### 2.3 Core modules
1. **Incident Logging** — category, severity, location, status, resolution.
2. **Vehicle Access Log** — every car entering is issued a numbered physical card at the gate; the plate number is recorded against that card number at entry. The card is returned and logged when the car exits. Any card not returned (car still on property, or card lost) is visible at a glance — this is the vehicle equivalent of the key issue/return system, but tracks cars instead of keys.
3. **Items Book** — company property or equipment taken off the premises (tools, devices, packages) is logged out with who authorized it and who's carrying it, and logged back in on return. Same accountability pattern as keys and vehicles.
4. **Staff Attendance** — on-duty security staff sign in and out at shift start/end, replacing the paper attendance register.
5. **Off-Duty Staff Attendance** — a separate log for staff visiting the property while off duty (not on shift), so their presence is recorded distinctly from on-duty attendance.
6. **Patrol & Shift Tracking** — route, officer, start/end, findings.
7. **Access Control / Key Management** — issue/return/lost tracking for keys and secure areas.
8. **Alerts & Emergency Response** — property-wide alerts (fire, medical, breach, lockdown), acknowledgment tracking.
9. **Reporting & Dashboards** — incident trends, patrol coverage, key turnaround time.

### 2.4 Data model (entities)
- `Incident` — title, category, severity, location, reported by, status, resolution
- `VehicleLog` — card number, plate number, driver name (optional), entry time, exit time, status (In / Returned / Card Not Returned), logged by
- `ItemLog` — item description, carried by, authorized by, time out, time in, status (Out / Returned)
- `AttendanceLog` — staff name, role, time in, time out, status (Signed In / Signed Out)
- `OffDutyLog` — staff name, department, reason for visit, time in, time out, status
- `Patrol` — officer, route, start/end time, notes, status
- `KeyRecord` — key type, area, issued to, issued by, issued/returned time, status
- `Alert` — type, severity, message, location, raised by, acknowledgment

### 2.5 Deployment note: single desktop, single gate
The company has approved one desktop for the Security department, and the property has a single main gate. This makes checkpoint-based logging (vehicles, items, attendance) workable from one terminal, since all of these activities naturally converge at the gate rather than happening in scattered locations. If a second gate is ever added, this assumption should be revisited — a single desktop cannot cover two physical entry points in real time.

### 2.6 Typical workflow
Officer starts patrol → notices unlocked storage door → logs an **Incident** on the spot → raises an **Alert** if urgent → supervisor acknowledges and reassigns → incident closed with resolution notes → appears in weekly incident report.

---

## 3. Where the line sits between the two

| Situation | Goes to |
|---|---|
| Guest complains room AC is broken | Duty Desk (facility issue) |
| Guest reports a theft from their room | Gatehouse (incident) |
| Contractor needs building access | Gatehouse (access log + key) |
| Noise complaint from a resident | Duty Desk (complaint) |
| Fire alarm triggers | Gatehouse (alert) — Duty Desk gets notified informally via handover, not through system integration since platforms are independent |
| Front desk needs a task done by housekeeping | Duty Desk (task) |

Because the platforms are fully independent, there's no automatic handoff between them — if a Duty Desk issue turns out to be a security matter (or vice versa), staff re-log it manually on the other platform. Worth revisiting later if that manual step becomes a pain point.

---

## 4. Staff Accounts & Login

Both platforms get their own independent login system — same pattern, applied separately, no shared accounts between departments (consistent with "fully independent" from Section 3).

This also closes a gap in the current prototype: right now anyone can type any name to act as. With real accounts, every checklist, incident, or ticket is tied to a login the person actually authenticated with — nobody can log an entry under someone else's name.

### 4.0 Confirmed headcount
- **Duty Desk: 16 Resident Officer accounts**
- **Gatehouse: 5 Security accounts**
- **21 staff accounts total**, plus one **Super Admin account per platform** held by IT (Philip Isaac Atabo) — 23 accounts in total across both systems.
- At this scale, manual admin-created accounts (below) are entirely practical — there's no need for bulk-import tooling, self-service sign-up, or any account-management complexity beyond a single admin creating each login individually. This confirms the account approach chosen in 4.1 is right-sized rather than under-built.

### 4.1 How accounts get created
- **No self sign-up.** Staff can't create their own accounts — this prevents random/duplicate/fake accounts.
- **Credentials: username + usercode, not email + password.** Many Resident Officers and Security staff may not have a company email address, so login is based on a **username** (assigned by the admin, e.g. based on name or staff ID) and a **usercode** (an admin-generated code, e.g. a 6-digit PIN) — no email required to create or use an account.
- **Separate per platform.** Even for the Super Admin, who holds an account on both, the username and usercode on Duty Desk are independent of the username and usercode on Gatehouse — consistent with the platforms having no shared login system (Section 3).
- **Super Admin (IT)** sits above both platforms. This role sets up the very first account on each platform, can create or reissue *any* account's username/usercode — including the department admin's own — and exists as a fallback if a department admin is ever locked out, leaves, or needs technical help. Held by IT (Philip Isaac Atabo). This does not break platform independence: it's the same person holding a separate admin account on each platform, not a shared login or shared database between them.
- Day-to-day account creation for regular staff is still handled by the **department admin**:
  - Duty Desk: the **General Manager** role.
  - Gatehouse: the **Security Supervisor** role.
- New staff log in with the username and usercode their admin gives them. Whether the usercode can be changed by the staff member afterward (vs. staying admin-assigned) is a small decision to make during the build — either is workable at this scale.
- Any admin (Super Admin or department admin) can **disable** an account instantly (e.g. staff member leaves) — disabled accounts can't log in, but their historical entries stay intact and attributed to them for the audit trail.

### 4.2 Login & usercode reset
- Login is **username + usercode** — no email address involved anywhere in the login flow.
- **Usercode reset:** if a staff member forgets their usercode or it's compromised, their department admin (or Super Admin, if it's the department admin's own account) issues a new one directly. Since there's no email step at all, this is simpler than a typical password-reset flow — no email server needed at any point, not even later as an upgrade.
- **Session timeout:** shared devices (e.g. the front desk PC, the one security desktop) auto-log-out after a period of inactivity (suggest 15–30 min). Personal phones can stay logged in longer, since they're not shared.

### 4.3 Roles & permissions

**Duty Desk**
| Role | Can view | Can create/edit | Admin (accounts) |
|---|---|---|---|
| Resident Officer | Everything | Checklists, complaints, tickets, duty log, tasks | No |
| Front Desk | Checklists (ready/not ready), complaints | Complaints | No |
| Housekeeping | Assigned tickets/tasks | Update assigned items only | No |
| Engineering | Assigned tickets | Update assigned items only | No |
| General Manager | Everything | Everything | Yes (staff accounts) |
| **Super Admin (IT)** | Everything | Everything | **Yes — including resetting the General Manager's own account** |

**Gatehouse**
| Role | Can view | Can create/edit | Admin (accounts) |
|---|---|---|---|
| Security Officer | Everything | Incidents, patrols, keys, alerts, vehicle/items/attendance logs | No |
| Security Supervisor | Everything | Everything, reassign/close | Yes (staff accounts) |
| Management | Everything | Read-only | No |
| **Super Admin (IT)** | Everything | Everything | **Yes — including resetting the Security Supervisor's own account** |

### 4.4 Security basics for the production build
- Usercodes stored hashed (never in plain text), same as passwords would be.
- **Failed-login lockout is especially important here** — a short usercode (e.g. a 6-digit PIN) is easier to guess than a long password, so strict lockout after a handful of wrong attempts matters more than it would with email + password. Worth considering a longer or alphanumeric usercode (not just digits) for this reason.
- Every login/logout event logged — extends the accountability trail beyond just checklist/incident entries.

### 4.5 Entry point / Homepage

Staff arrive through one shared landing page — **"The Destination Operations Portal"** — a purely static signpost with no data, no login, and no shared backend of its own. It just shows two branded tiles, one per department, each linking out to that platform's own login screen.

This is a deliberate, narrow exception to "no shared infrastructure": the page holds no accounts, no database, and no session state, so it doesn't compromise the independence of either platform underneath it. It exists purely for staff convenience — one URL to bookmark instead of two.



## 5. Suggested build order

| Phase | Deliverable |
|---|---|
| **Phase 1** ✅ | Blueprint |
| **Phase 2** ✅ | UI design — clickable prototype, both platforms |
| **Phase 3** | Production build (Claude Code): real database, hosting, accounts/login system from Section 4 |
| **Phase 4** | Internal testing with real duty/security staff on both |
| **Phase 5** | Deployment — each platform hosted and rolled out independently |

---

## 6. Open questions before Phase 3

- Should Duty Desk support photo attachments on maintenance tickets (e.g. photo of the broken fixture)?
- Does the General Manager need a single view across *both* platforms eventually, even if the platforms themselves stay independent (e.g. a separate read-only summary export)?
- Any existing property management system (PMS) that room numbers / resident data should match up with?
