// ==========================================================
//  ADMIN MODULE — Master Data Layer
//  All enterprise mock data for the Super Admin module.
//  Loaded before admin scripts. Persisted sections use localStorage.
// ==========================================================

// ── Extended Roles ──────────────────────────────────────────
const adminRoles = [
  { key:"SA",   label:"Super Admin",       description:"Full system access including user and role management." },
  { key:"PMO",  label:"PMO",               description:"Manages project portfolio tracking, budgets, and compliance." },
  { key:"PM",   label:"Project Manager",   description:"Manages project execution, assigns deliverables and owners." },
  { key:"EH",   label:"Engineering Head",  description:"Oversees engineering deliverables and technical reviews." },
  { key:"QH",   label:"Quality Head",      description:"Manages quality gates, checklists, and PPAP readiness." },
  { key:"PH",   label:"Plant Head",        description:"Oversees manufacturing readiness and plant trials." },
  { key:"FIN",  label:"Finance",           description:"Budget approvals, cost tracking, and financial sign-offs." },
  { key:"FH",   label:"Functional Head",   description:"Department head with approval authority over deliverables." },
  { key:"REV",  label:"Reviewer",          description:"Reviews deliverables and provides technical comments." },
  { key:"APR",  label:"Approver",          description:"Final approval authority for gate submissions." },
  { key:"VWR",  label:"Viewer",            description:"Read-only access to project data and dashboards." },
];

// ── Departments ─────────────────────────────────────────────
const adminDepartments = [
  "Product Engineering","Quality Assurance","Manufacturing","Supply Chain",
  "Testing & Validation","Homologation","Program Management","Purchase",
  "Finance","IT","HR","Safety & Compliance",
];

// ── Business Units ───────────────────────────────────────────
const adminBusinessUnits = [
  "Tractor Division","Farm Equipment","Commercial Vehicles","Two-Wheelers","Corporate",
];

// ── Locations ────────────────────────────────────────────────
const adminLocations = [
  "Chandigarh","Pune","Mumbai","Chennai","Hyderabad","Bengaluru","Delhi NCR","Nagpur",
];

// ── 30 Users ─────────────────────────────────────────────────
const adminMockUsers = [
  { id:1,  empId:"EMP001", name:"Rajesh Sharma",     email:"rajesh.sharma@swaraj.mahindra.com",     designation:"VP Product Engineering",   department:"Product Engineering", phone:"9876543201", status:"Active",   role:"SA",  businessUnit:"Tractor Division",    location:"Chandigarh", assignedProjects:["Tractor 1","Tractor 5"], assignedGates:["G1","G2","G3","G4","G5","G6"], approvalRole:"Final Approver",  lastLogin:"09 Jul 2026, 09:12" },
  { id:2,  empId:"EMP002", name:"Priya Nair",         email:"priya.nair@swaraj.mahindra.com",         designation:"PMO Manager",               department:"Program Management",  phone:"9876543202", status:"Active",   role:"PMO", businessUnit:"Tractor Division",    location:"Pune",       assignedProjects:["Tractor 2","Tractor 6"], assignedGates:["G1","G2","G3"],    approvalRole:"Reviewer",        lastLogin:"09 Jul 2026, 08:45" },
  { id:3,  empId:"EMP003", name:"Arjun Mehta",        email:"arjun.mehta@swaraj.mahindra.com",        designation:"R&D Head",                  department:"Product Engineering", phone:"9876543203", status:"Active",   role:"EH",  businessUnit:"Tractor Division",    location:"Pune",       assignedProjects:["Tractor 3","Tractor 7"], assignedGates:["G2","G3","G4"],    approvalRole:"Technical Approver", lastLogin:"08 Jul 2026, 17:30" },
  { id:4,  empId:"EMP004", name:"Sunita Iyer",        email:"sunita.iyer@swaraj.mahindra.com",        designation:"Quality Manager",           department:"Quality Assurance",   phone:"9876543204", status:"Active",   role:"QH",  businessUnit:"Tractor Division",    location:"Chandigarh", assignedProjects:["Tractor 1","Tractor 4"], assignedGates:["G3","G4","G5"],    approvalRole:"Quality Approver", lastLogin:"09 Jul 2026, 10:05" },
  { id:5,  empId:"EMP005", name:"Karan Verma",        email:"karan.verma@swaraj.mahindra.com",        designation:"Project Manager",           department:"Program Management",  phone:"9876543205", status:"Inactive", role:"PM",  businessUnit:"Tractor Division",    location:"Chandigarh", assignedProjects:["Tractor 8"],            assignedGates:["G1","G2"],         approvalRole:"—",               lastLogin:"22 Jun 2026, 14:00" },
  { id:6,  empId:"EMP006", name:"Neha Kapoor",        email:"neha.kapoor@swaraj.mahindra.com",        designation:"Senior Engineer",           department:"Product Engineering", phone:"9876543206", status:"Active",   role:"REV", businessUnit:"Tractor Division",    location:"Pune",       assignedProjects:["Tractor 9","Tractor 10"], assignedGates:["G2","G3"],       approvalRole:"Reviewer",        lastLogin:"07 Jul 2026, 11:20" },
  { id:7,  empId:"EMP007", name:"Vikram Rao",         email:"vikram.rao@swaraj.mahindra.com",         designation:"Plant Head",                department:"Manufacturing",        phone:"9876543207", status:"Active",   role:"PH",  businessUnit:"Tractor Division",    location:"Chandigarh", assignedProjects:["Tractor 11","Tractor 12"], assignedGates:["G5","G6"],     approvalRole:"Plant Approver",  lastLogin:"08 Jul 2026, 09:00" },
  { id:8,  empId:"EMP008", name:"Deepa Krishnan",     email:"deepa.krishnan@swaraj.mahindra.com",     designation:"Finance Controller",        department:"Finance",             phone:"9876543208", status:"Active",   role:"FIN", businessUnit:"Corporate",           location:"Mumbai",     assignedProjects:["Tractor 13"],           assignedGates:["G4"],              approvalRole:"Budget Approver", lastLogin:"06 Jul 2026, 16:45" },
  { id:9,  empId:"EMP009", name:"Sanjay Gupta",       email:"sanjay.gupta@swaraj.mahindra.com",       designation:"Testing Lead",              department:"Testing & Validation", phone:"9876543209", status:"Active",  role:"REV", businessUnit:"Tractor Division",    location:"Pune",       assignedProjects:["Tractor 14","Tractor 15"], assignedGates:["G3","G4","G5"], approvalRole:"Reviewer",        lastLogin:"09 Jul 2026, 07:55" },
  { id:10, empId:"EMP010", name:"Anita Deshmukh",     email:"anita.deshmukh@swaraj.mahindra.com",     designation:"Homologation Manager",      department:"Homologation",        phone:"9876543210", status:"Active",   role:"FH",  businessUnit:"Tractor Division",    location:"Chandigarh", assignedProjects:["Tractor 2","Tractor 5"], assignedGates:["G5","G6"],       approvalRole:"Homologation Approver", lastLogin:"08 Jul 2026, 14:30" },
  { id:11, empId:"EMP011", name:"Rohit Patil",        email:"rohit.patil@swaraj.mahindra.com",        designation:"Supply Chain Head",         department:"Supply Chain",        phone:"9876543211", status:"Active",   role:"FH",  businessUnit:"Tractor Division",    location:"Pune",       assignedProjects:["Tractor 6","Tractor 7"], assignedGates:["G3","G4"],       approvalRole:"SCM Approver",    lastLogin:"07 Jul 2026, 12:10" },
  { id:12, empId:"EMP012", name:"Meera Subramanian",  email:"meera.sub@swaraj.mahindra.com",          designation:"Purchase Manager",          department:"Purchase",            phone:"9876543212", status:"Active",   role:"APR", businessUnit:"Tractor Division",    location:"Chennai",    assignedProjects:["Tractor 3","Tractor 8"], assignedGates:["G3","G4","G5"],  approvalRole:"Purchase Approver", lastLogin:"05 Jul 2026, 10:00" },
  { id:13, empId:"EMP013", name:"Aditya Kulkarni",    email:"aditya.kulkarni@swaraj.mahindra.com",    designation:"Design Engineer",           department:"Product Engineering", phone:"9876543213", status:"Active",   role:"REV", businessUnit:"Tractor Division",    location:"Pune",       assignedProjects:["Tractor 1"],            assignedGates:["G1","G2","G3"],    approvalRole:"Reviewer",        lastLogin:"09 Jul 2026, 08:20" },
  { id:14, empId:"EMP014", name:"Pooja Sharma",       email:"pooja.sharma@swaraj.mahindra.com",       designation:"IT Manager",                department:"IT",                  phone:"9876543214", status:"Active",   role:"VWR", businessUnit:"Corporate",           location:"Mumbai",     assignedProjects:[],                       assignedGates:[],                  approvalRole:"—",               lastLogin:"01 Jul 2026, 09:00" },
  { id:15, empId:"EMP015", name:"Harish Bhatt",       email:"harish.bhatt@swaraj.mahindra.com",       designation:"CAE Engineer",              department:"Product Engineering", phone:"9876543215", status:"Active",   role:"REV", businessUnit:"Tractor Division",    location:"Pune",       assignedProjects:["Tractor 9","Tractor 10"], assignedGates:["G2","G3"],      approvalRole:"Reviewer",        lastLogin:"08 Jul 2026, 11:00" },
  { id:16, empId:"EMP016", name:"Kavitha Menon",      email:"kavitha.menon@swaraj.mahindra.com",      designation:"Safety Engineer",           department:"Safety & Compliance", phone:"9876543216", status:"Active",   role:"APR", businessUnit:"Tractor Division",    location:"Chandigarh", assignedProjects:["Tractor 4","Tractor 11"], assignedGates:["G4","G5","G6"],  approvalRole:"Safety Approver", lastLogin:"07 Jul 2026, 15:30" },
  { id:17, empId:"EMP017", name:"Suresh Naidu",       email:"suresh.naidu@swaraj.mahindra.com",       designation:"Project Manager",           department:"Program Management",  phone:"9876543217", status:"Active",   role:"PM",  businessUnit:"Tractor Division",    location:"Chandigarh", assignedProjects:["Tractor 12","Tractor 13"], assignedGates:["G1","G2","G3"], approvalRole:"—",               lastLogin:"09 Jul 2026, 10:45" },
  { id:18, empId:"EMP018", name:"Lakshmi Reddy",      email:"lakshmi.reddy@swaraj.mahindra.com",      designation:"Validation Engineer",       department:"Testing & Validation", phone:"9876543218", status:"Active",  role:"REV", businessUnit:"Tractor Division",    location:"Hyderabad",  assignedProjects:["Tractor 14"],           assignedGates:["G3","G4","G5"],    approvalRole:"Reviewer",        lastLogin:"06 Jul 2026, 08:30" },
  { id:19, empId:"EMP019", name:"Manoj Singh",        email:"manoj.singh@swaraj.mahindra.com",        designation:"Manufacturing Engineer",    department:"Manufacturing",        phone:"9876543219", status:"Inactive", role:"REV", businessUnit:"Tractor Division",   location:"Chandigarh", assignedProjects:["Tractor 15"],           assignedGates:["G5","G6"],         approvalRole:"—",               lastLogin:"15 Jun 2026, 17:00" },
  { id:20, empId:"EMP020", name:"Ritu Agarwal",       email:"ritu.agarwal@swaraj.mahindra.com",       designation:"HR Business Partner",       department:"HR",                  phone:"9876543220", status:"Active",   role:"VWR", businessUnit:"Corporate",           location:"Delhi NCR",  assignedProjects:[],                       assignedGates:[],                  approvalRole:"—",               lastLogin:"03 Jul 2026, 14:00" },
  { id:21, empId:"EMP021", name:"Ganesh Pillai",      email:"ganesh.pillai@swaraj.mahindra.com",      designation:"Program Director",          department:"Program Management",  phone:"9876543221", status:"Active",   role:"APR", businessUnit:"Tractor Division",    location:"Pune",       assignedProjects:["Tractor 1","Tractor 2","Tractor 3"], assignedGates:["G4","G5","G6"], approvalRole:"Program Approver", lastLogin:"09 Jul 2026, 09:30" },
  { id:22, empId:"EMP022", name:"Swati Joshi",        email:"swati.joshi@swaraj.mahindra.com",        designation:"DFMEA Specialist",          department:"Quality Assurance",   phone:"9876543222", status:"Active",   role:"REV", businessUnit:"Tractor Division",    location:"Pune",       assignedProjects:["Tractor 5","Tractor 6"], assignedGates:["G2","G3"],       approvalRole:"Reviewer",        lastLogin:"08 Jul 2026, 16:00" },
  { id:23, empId:"EMP023", name:"Nitin Bhosale",      email:"nitin.bhosale@swaraj.mahindra.com",      designation:"Tooling Engineer",          department:"Manufacturing",        phone:"9876543223", status:"Active",   role:"REV", businessUnit:"Tractor Division",    location:"Chandigarh", assignedProjects:["Tractor 7","Tractor 8"], assignedGates:["G4","G5"],       approvalRole:"Reviewer",        lastLogin:"07 Jul 2026, 13:20" },
  { id:24, empId:"EMP024", name:"Tanuja Wagh",        email:"tanuja.wagh@swaraj.mahindra.com",        designation:"Finance Analyst",           department:"Finance",             phone:"9876543224", status:"Active",   role:"FIN", businessUnit:"Corporate",           location:"Mumbai",     assignedProjects:["Tractor 9","Tractor 10"], assignedGates:["G4"],            approvalRole:"Budget Reviewer", lastLogin:"06 Jul 2026, 11:45" },
  { id:25, empId:"EMP025", name:"Prasad Hegde",       email:"prasad.hegde@swaraj.mahindra.com",       designation:"Electrical Engineer",       department:"Product Engineering", phone:"9876543225", status:"Active",   role:"REV", businessUnit:"Tractor Division",    location:"Bengaluru",  assignedProjects:["Tractor 11","Tractor 12"], assignedGates:["G2","G3","G4"], approvalRole:"Reviewer",        lastLogin:"05 Jul 2026, 10:15" },
  { id:26, empId:"EMP026", name:"Divya Nambiar",      email:"divya.nambiar@swaraj.mahindra.com",      designation:"Compliance Officer",        department:"Safety & Compliance", phone:"9876543226", status:"Active",   role:"APR", businessUnit:"Corporate",           location:"Chennai",    assignedProjects:["Tractor 13","Tractor 14"], assignedGates:["G5","G6"],     approvalRole:"Compliance Approver", lastLogin:"04 Jul 2026, 09:00" },
  { id:27, empId:"EMP027", name:"Anil Rathore",       email:"anil.rathore@swaraj.mahindra.com",       designation:"Test Engineer",             department:"Testing & Validation", phone:"9876543227", status:"Active",  role:"REV", businessUnit:"Tractor Division",    location:"Pune",       assignedProjects:["Tractor 15"],           assignedGates:["G3","G4"],         approvalRole:"Reviewer",        lastLogin:"03 Jul 2026, 15:50" },
  { id:28, empId:"EMP028", name:"Shilpa Tiwari",      email:"shilpa.tiwari@swaraj.mahindra.com",      designation:"SCM Analyst",               department:"Supply Chain",        phone:"9876543228", status:"Inactive", role:"VWR", businessUnit:"Tractor Division",    location:"Delhi NCR",  assignedProjects:[],                       assignedGates:[],                  approvalRole:"—",               lastLogin:"20 Jun 2026, 12:30" },
  { id:29, empId:"EMP029", name:"Chetan Philip",      email:"chetan.philip@swaraj.mahindra.com",      designation:"Systems Engineer",          department:"Product Engineering", phone:"9876543229", status:"Active",   role:"REV", businessUnit:"Tractor Division",    location:"Pune",       assignedProjects:["Tractor 1","Tractor 2"], assignedGates:["G1","G2","G3"],  approvalRole:"Reviewer",        lastLogin:"09 Jul 2026, 07:30" },
  { id:30, empId:"EMP030", name:"Fatima Khan",        email:"fatima.khan@swaraj.mahindra.com",        designation:"Project Coordinator",       department:"Program Management",  phone:"9876543230", status:"Active",   role:"PM",  businessUnit:"Tractor Division",    location:"Chandigarh", assignedProjects:["Tractor 3","Tractor 4"], assignedGates:["G1","G2"],       approvalRole:"—",               lastLogin:"08 Jul 2026, 14:00" },
];

// ── 6 Gate Templates + 200 Checklist Items ───────────────────
const adminGateTemplates = ["G1 Pre-KO","G2 CVPA","G3 VV","G4 PC","G5 PR","G6 PPO"];

const adminChecklistItems = (function() {
  const gates = ["G1 Pre-KO","G2 CVPA","G3 VV","G4 PC","G5 PR","G6 PPO"];
  const depts = ["Product Engineering","Quality Assurance","Manufacturing","Supply Chain","Testing & Validation","Homologation","Program Management","Purchase"];
  const owners = ["A. Kulkarni","R. Deshmukh","S. Pawar","P. Menon","J. Thomas","F. Khan","V. Rao","D. Krishnan","S. Gupta","A. Deshmukh"];
  const forms = ["DFMEA Form","DVP Matrix","Concept Approval Form","Supplier Qualification Form","PPAP Form","BOM Review Form","Gate Review Form","Cost Estimation Form","Risk Assessment Form","Homologation Checklist"];
  const deliverables = adminDeliverablesSeed();

  const templates = {
    "G1 Pre-KO": [
      { name:"Product Requirement Freeze Review",   desc:"Verify all product requirements are baselined and signed-off.", mandatory:true,  dept:"Product Engineering",  owner:"A. Kulkarni", docRequired:true,  form:"Gate Review Form",           approvalReq:true  },
      { name:"Technical Feasibility Confirmation",  desc:"Confirm technical feasibility study is complete and approved.",  mandatory:true,  dept:"Product Engineering",  owner:"R. Deshmukh", docRequired:true,  form:"Risk Assessment Form",       approvalReq:true  },
      { name:"Business Case Approval",              desc:"Business case reviewed by Finance and Program Director.",         mandatory:true,  dept:"Program Management",   owner:"S. Pawar",    docRequired:true,  form:"Cost Estimation Form",       approvalReq:true  },
      { name:"Target Cost Sign-off",                desc:"Target cost approved against benchmark data.",                    mandatory:true,  dept:"Finance",              owner:"D. Krishnan", docRequired:true,  form:"Cost Estimation Form",       approvalReq:true  },
      { name:"QA & CC Inputs Verification",         desc:"Quality & cost competitiveness inputs validated.",                mandatory:true,  dept:"Quality Assurance",    owner:"S. Gupta",    docRequired:false, form:"BOM Review Form",            approvalReq:false },
      { name:"Regulatory Compliance Check",         desc:"Regulatory requirements mapped to deliverables.",                 mandatory:true,  dept:"Safety & Compliance",  owner:"K. Menon",    docRequired:true,  form:"Risk Assessment Form",       approvalReq:true  },
      { name:"IP & Patent Review",                  desc:"IP landscape reviewed; no blocking patents identified.",          mandatory:false, dept:"Product Engineering",  owner:"A. Kulkarni", docRequired:false, form:null,                         approvalReq:false },
      { name:"Supplier Landscape Assessment",       desc:"Supplier capabilities assessed for critical components.",         mandatory:false, dept:"Supply Chain",         owner:"R. Patil",    docRequired:false, form:"Supplier Qualification Form",approvalReq:false },
      { name:"Project Charter Sign-off",            desc:"Project charter approved by program director.",                   mandatory:true,  dept:"Program Management",   owner:"G. Pillai",   docRequired:true,  form:"Gate Review Form",           approvalReq:true  },
      { name:"Benchmark Study Report",              desc:"Competitive benchmark study completed and presented.",            mandatory:false, dept:"Product Engineering",  owner:"P. Menon",    docRequired:true,  form:null,                         approvalReq:false },
      { name:"Platform Strategy Alignment",         desc:"New product aligned with platform roadmap.",                      mandatory:true,  dept:"Program Management",   owner:"S. Pawar",    docRequired:false, form:null,                         approvalReq:false },
      { name:"Voice of Customer (VOC) Summary",     desc:"Customer insights summarised and validated.",                     mandatory:false, dept:"Product Engineering",  owner:"A. Deshmukh", docRequired:false, form:null,                         approvalReq:false },
    ],
    "G2 CVPA": [
      { name:"DR0 Design Review Completion",        desc:"Design Review-0 conducted with all stakeholders.",                mandatory:true,  dept:"Product Engineering",  owner:"R. Deshmukh", docRequired:true,  form:"Gate Review Form",           approvalReq:true  },
      { name:"DFMEA — First Issue",                 desc:"Design FMEA first issue completed and reviewed.",                 mandatory:true,  dept:"Quality Assurance",    owner:"S. Gupta",    docRequired:true,  form:"DFMEA Form",                 approvalReq:true  },
      { name:"DVP Matrix — First Issue",            desc:"Design Validation Plan first issue prepared.",                    mandatory:true,  dept:"Testing & Validation", owner:"A. Rathore",  docRequired:true,  form:"DVP Matrix",                 approvalReq:true  },
      { name:"Styling Theme Freeze",                desc:"Styling direction finalised and frozen.",                         mandatory:true,  dept:"Product Engineering",  owner:"H. Bhatt",    docRequired:false, form:null,                         approvalReq:false },
      { name:"Concept Validation Report",           desc:"Concept validation completed; results signed-off.",               mandatory:true,  dept:"Product Engineering",  owner:"A. Kulkarni", docRequired:true,  form:"Concept Approval Form",      approvalReq:true  },
      { name:"BOM — First Draft",                   desc:"First-cut BOM available and reviewed.",                           mandatory:true,  dept:"Product Engineering",  owner:"R. Deshmukh", docRequired:true,  form:"BOM Review Form",            approvalReq:false },
      { name:"Make-vs-Buy Decision",                desc:"Make vs buy strategy confirmed for key assemblies.",              mandatory:false, dept:"Supply Chain",         owner:"R. Patil",    docRequired:false, form:null,                         approvalReq:false },
      { name:"CAE Simulation — Phase 1",            desc:"Initial structural CAE results reviewed.",                        mandatory:true,  dept:"Product Engineering",  owner:"H. Bhatt",    docRequired:true,  form:null,                         approvalReq:false },
      { name:"Supplier RFQ Initiation",             desc:"RFQ sent to shortlisted suppliers for critical parts.",           mandatory:false, dept:"Purchase",             owner:"M. Sub",      docRequired:false, form:"Supplier Qualification Form", approvalReq:false },
      { name:"PFMEA — Preliminary",                 desc:"Process FMEA preliminary issue prepared.",                        mandatory:false, dept:"Quality Assurance",    owner:"S. Gupta",    docRequired:false, form:"DFMEA Form",                  approvalReq:false },
      { name:"Cost Tracking vs Target",             desc:"Actual BOM cost tracked against target.",                         mandatory:true,  dept:"Finance",              owner:"T. Wagh",     docRequired:true,  form:"Cost Estimation Form",       approvalReq:false },
      { name:"Programme Risk Register — Update",    desc:"Risk register updated with CVPA phase risks.",                    mandatory:true,  dept:"Program Management",   owner:"S. Pawar",    docRequired:false, form:"Risk Assessment Form",       approvalReq:false },
    ],
    "G3 VV": [
      { name:"Virtual Validation Report — Final",   desc:"All virtual validation (CAE/CFD) completed and signed-off.",     mandatory:true,  dept:"Product Engineering",  owner:"H. Bhatt",    docRequired:true,  form:"Gate Review Form",           approvalReq:true  },
      { name:"DFMEA — Updated Issue",               desc:"DFMEA updated to reflect design changes after DR0.",             mandatory:true,  dept:"Quality Assurance",    owner:"S. Gupta",    docRequired:true,  form:"DFMEA Form",                 approvalReq:true  },
      { name:"DVP Matrix — Updated",                desc:"DVP matrix updated; test responsibilities assigned.",            mandatory:true,  dept:"Testing & Validation", owner:"S. Gupta",    docRequired:true,  form:"DVP Matrix",                 approvalReq:true  },
      { name:"Design Verification Plan Sign-off",   desc:"Design verification plan approved by Engineering Head.",          mandatory:true,  dept:"Product Engineering",  owner:"A. Mehta",    docRequired:true,  form:null,                         approvalReq:true  },
      { name:"PFMEA — Updated Issue",               desc:"Process FMEA updated for manufacturing feasibility.",            mandatory:true,  dept:"Quality Assurance",    owner:"S. Gupta",    docRequired:true,  form:"DFMEA Form",                 approvalReq:false },
      { name:"CAE Sign-off — All Modules",          desc:"CAE results for all structural modules signed off.",              mandatory:true,  dept:"Product Engineering",  owner:"H. Bhatt",    docRequired:true,  form:null,                         approvalReq:true  },
      { name:"Supplier Quote — Comparison Sheet",   desc:"Comparative quote analysis for shortlisted suppliers.",          mandatory:true,  dept:"Purchase",             owner:"M. Sub",      docRequired:true,  form:"Supplier Qualification Form",approvalReq:false },
      { name:"Homologation Plan Preparation",       desc:"Homologation strategy finalised and submitted.",                 mandatory:true,  dept:"Homologation",         owner:"A. Deshmukh", docRequired:true,  form:"Homologation Checklist",     approvalReq:true  },
      { name:"Ergonomics & Operator Safety Review", desc:"Ergonomics assessment completed as per ISO standards.",           mandatory:false, dept:"Safety & Compliance",  owner:"K. Menon",    docRequired:false, form:null,                         approvalReq:false },
      { name:"Prototype Build Plan",                desc:"Prototype build plan prepared with BOM and schedule.",           mandatory:true,  dept:"Manufacturing",        owner:"V. Rao",      docRequired:false, form:null,                         approvalReq:false },
      { name:"Cost Re-baseline",                    desc:"Cost re-baselined based on final design direction.",             mandatory:true,  dept:"Finance",              owner:"D. Krishnan", docRequired:true,  form:"Cost Estimation Form",       approvalReq:true  },
      { name:"Programme Schedule Update",           desc:"Master programme schedule updated for VV phase.",                mandatory:true,  dept:"Program Management",   owner:"G. Pillai",   docRequired:false, form:null,                         approvalReq:false },
    ],
    "G4 PC": [
      { name:"L2 Drawing Release",                  desc:"All L2 drawings released for prototype manufacturing.",           mandatory:true,  dept:"Product Engineering",  owner:"A. Kulkarni", docRequired:true,  form:"Gate Review Form",           approvalReq:true  },
      { name:"Vendor Onboarding Confirmation",      desc:"All key vendors onboarded and POs issued.",                      mandatory:true,  dept:"Purchase",             owner:"M. Sub",      docRequired:true,  form:"Supplier Qualification Form",approvalReq:true  },
      { name:"VP Part Receipt — 100%",              desc:"All VP parts received at plant with inspection OK.",             mandatory:true,  dept:"Manufacturing",        owner:"V. Rao",      docRequired:true,  form:"Gate Review Form",           approvalReq:true  },
      { name:"VP Build Completion",                 desc:"Validation prototype build completed per plan.",                  mandatory:true,  dept:"Manufacturing",        owner:"V. Rao",      docRequired:true,  form:null,                         approvalReq:true  },
      { name:"Prototype Assembly Report",           desc:"Assembly report including NCRs and resolutions documented.",      mandatory:true,  dept:"Manufacturing",        owner:"N. Bhosale",  docRequired:true,  form:null,                         approvalReq:false },
      { name:"DVP Test Start — Confirmation",       desc:"DVP testing commenced as per DVP plan.",                         mandatory:true,  dept:"Testing & Validation", owner:"A. Rathore",  docRequired:false, form:"DVP Matrix",                 approvalReq:false },
      { name:"PPAP Readiness Assessment",           desc:"PPAP readiness assessed for production-intent suppliers.",       mandatory:true,  dept:"Quality Assurance",    owner:"S. Gupta",    docRequired:true,  form:"PPAP Form",                  approvalReq:false },
      { name:"Tooling Progress — 80% Complete",     desc:"Tooling at 80% completion milestone validated.",                 mandatory:true,  dept:"Manufacturing",        owner:"N. Bhosale",  docRequired:false, form:null,                         approvalReq:false },
      { name:"Field Trial Plan — Approval",         desc:"Field trial plan approved by Validation Head.",                  mandatory:false, dept:"Testing & Validation", owner:"S. Naidu",    docRequired:true,  form:null,                         approvalReq:true  },
      { name:"Budget Burn Review — PC Gate",        desc:"Actuals reviewed against approved budget at PC gate.",           mandatory:true,  dept:"Finance",              owner:"T. Wagh",     docRequired:true,  form:"Cost Estimation Form",       approvalReq:true  },
      { name:"Quality Plan — First Issue",          desc:"Product quality plan prepared for PP and SOP phases.",           mandatory:true,  dept:"Quality Assurance",    owner:"S. Iyer",     docRequired:true,  form:null,                         approvalReq:false },
      { name:"Risk Register — Critical Closures",   desc:"All critical risks from G3 reviewed for closure.",              mandatory:true,  dept:"Program Management",   owner:"S. Pawar",    docRequired:false, form:"Risk Assessment Form",       approvalReq:false },
    ],
    "G5 PR": [
      { name:"VP Validation Report — Complete",     desc:"Full VP validation report with all test results completed.",     mandatory:true,  dept:"Testing & Validation", owner:"S. Gupta",    docRequired:true,  form:"Gate Review Form",           approvalReq:true  },
      { name:"PPAP — Full Submission",              desc:"PPAP package submitted and approved for all key suppliers.",     mandatory:true,  dept:"Quality Assurance",    owner:"S. Iyer",     docRequired:true,  form:"PPAP Form",                  approvalReq:true  },
      { name:"Homologation Build Completion",       desc:"Homologation build complete; type-approval dossier submitted.",  mandatory:true,  dept:"Homologation",         owner:"A. Deshmukh", docRequired:true,  form:"Homologation Checklist",     approvalReq:true  },
      { name:"Field Trial Report — Sign-off",       desc:"Field trial results documented and signed off.",                 mandatory:true,  dept:"Testing & Validation", owner:"L. Reddy",    docRequired:true,  form:null,                         approvalReq:true  },
      { name:"Tool Release — 100%",                 desc:"All production tooling released and at supplier.",               mandatory:true,  dept:"Manufacturing",        owner:"V. Rao",      docRequired:true,  form:null,                         approvalReq:true  },
      { name:"DVP Closure Report",                  desc:"All DVP test items closed or with approved deviation.",          mandatory:true,  dept:"Testing & Validation", owner:"A. Rathore",  docRequired:true,  form:"DVP Matrix",                 approvalReq:true  },
      { name:"Emission Certification",              desc:"TREM/CPCB emission certification obtained.",                     mandatory:true,  dept:"Homologation",         owner:"A. Deshmukh", docRequired:true,  form:"Homologation Checklist",     approvalReq:true  },
      { name:"Production BOM — Final Release",      desc:"Production BOM released and ERP-loaded.",                       mandatory:true,  dept:"Product Engineering",  owner:"R. Deshmukh", docRequired:true,  form:"BOM Review Form",            approvalReq:true  },
      { name:"After-Sales Training Material",       desc:"Service manuals and training content prepared.",                 mandatory:false, dept:"Program Management",   owner:"F. Khan",     docRequired:false, form:null,                         approvalReq:false },
      { name:"Pricing Approval — Launch Price",     desc:"Launch price approved by business leadership.",                  mandatory:true,  dept:"Finance",              owner:"D. Krishnan", docRequired:true,  form:"Cost Estimation Form",       approvalReq:true  },
      { name:"Dealer & Channel Readiness",          desc:"Dealer network briefed and order-taking system live.",           mandatory:false, dept:"Program Management",   owner:"G. Pillai",   docRequired:false, form:null,                         approvalReq:false },
      { name:"DFMEA & PFMEA — Final Closure",       desc:"DFMEA and PFMEA all RPNs below threshold and closed.",          mandatory:true,  dept:"Quality Assurance",    owner:"S. Gupta",    docRequired:true,  form:"DFMEA Form",                 approvalReq:true  },
    ],
    "G6 PPO": [
      { name:"ER-SOVP Sign-off",                    desc:"Engineering Release for Start of VP Production approved.",       mandatory:true,  dept:"Product Engineering",  owner:"A. Kulkarni", docRequired:true,  form:"Gate Review Form",           approvalReq:true  },
      { name:"PP Batch Build Report",               desc:"Pre-production batch completed; results reviewed.",              mandatory:true,  dept:"Manufacturing",        owner:"V. Rao",      docRequired:true,  form:null,                         approvalReq:true  },
      { name:"Production Readiness Review",         desc:"Production line qualified; all checks passed.",                  mandatory:true,  dept:"Manufacturing",        owner:"V. Rao",      docRequired:true,  form:"Gate Review Form",           approvalReq:true  },
      { name:"Line Trial Report",                   desc:"Production line trial completed with acceptance criteria met.",  mandatory:true,  dept:"Manufacturing",        owner:"N. Bhosale",  docRequired:true,  form:null,                         approvalReq:true  },
      { name:"MSA Study — Production Gauges",       desc:"Measurement system analysis completed for all gauges.",          mandatory:true,  dept:"Quality Assurance",    owner:"S. Iyer",     docRequired:true,  form:null,                         approvalReq:false },
      { name:"SOP Announcement — Internal",         desc:"SOP date communicated to all functions.",                        mandatory:true,  dept:"Program Management",   owner:"G. Pillai",   docRequired:false, form:null,                         approvalReq:false },
      { name:"Launch Budget Confirmation",          desc:"Final SOP budget confirmed and approved.",                       mandatory:true,  dept:"Finance",              owner:"D. Krishnan", docRequired:true,  form:"Cost Estimation Form",       approvalReq:true  },
      { name:"Warranty Policy Finalisation",        desc:"Warranty terms approved and system-loaded.",                     mandatory:false, dept:"Program Management",   owner:"S. Pawar",    docRequired:false, form:null,                         approvalReq:false },
      { name:"Spare Parts Availability Confirmation",desc:"Spare parts available at dealers for day-1 of SOP.",           mandatory:true,  dept:"Supply Chain",         owner:"R. Patil",    docRequired:false, form:null,                         approvalReq:false },
      { name:"IT & ERP Readiness — SOP",            desc:"All ERP configurations live for SOP production orders.",        mandatory:true,  dept:"IT",                   owner:"P. Sharma",   docRequired:false, form:null,                         approvalReq:false },
      { name:"Customer Communication — Launch",     desc:"Launch communication material approved and ready.",              mandatory:false, dept:"Program Management",   owner:"F. Khan",     docRequired:false, form:null,                         approvalReq:false },
      { name:"Post-Launch Review Plan",             desc:"30/60/90 day post-launch review plan prepared.",                 mandatory:false, dept:"Program Management",   owner:"G. Pillai",   docRequired:false, form:null,                         approvalReq:false },
    ],
  };

  let id = 1;
  const items = [];
  gates.forEach(gate => {
    (templates[gate] || []).forEach((t, idx) => {
      items.push({
        id: id++, gate, seq: idx + 1,
        name: t.name, description: t.desc,
        mandatory: t.mandatory, department: t.dept, owner: t.owner,
        docRequired: t.docRequired, linkedForm: t.form,
        linkedDeliverable: null, approvalRequired: t.approvalReq,
        status: "Active",
      });
    });
    // Fill to ~34 per gate for 200 total
    const extras = Math.max(0, 34 - (templates[gate] || []).length);
    for (let e = 0; e < extras; e++) {
      items.push({
        id: id++, gate, seq: (templates[gate]||[]).length + e + 1,
        name: gate + " Supplementary Check " + (e + 1),
        description: "Supplementary compliance check for " + gate + " gate.",
        mandatory: false, department: depts[e % depts.length], owner: owners[e % owners.length],
        docRequired: false, linkedForm: null, linkedDeliverable: null,
        approvalRequired: false, status: "Active",
      });
    }
  });
  return items;
});

function adminDeliverablesSeed() { return []; } // placeholder for circular ref — real data below

// ── 50 Master Deliverables ────────────────────────────────────
const adminDeliverables = [
  // G1 Pre-KO (8 deliverables)
  { id:"DLV001", name:"Product Requirement Freeze",       desc:"Baseline all product requirements signed-off by stakeholders.",         projectType:"All",   gate:"G1",  dept:"Product Engineering",  owner:"A. Kulkarni", priority:"High",   estDuration:10, linkedForm:"Gate Review Form",     mandatoryDocs:["PRD Document","Stakeholder Sign-off"], approvalReq:true,  status:"Active" },
  { id:"DLV002", name:"Technical Feasibility Study",      desc:"Confirm technical feasibility for product concept.",                    projectType:"BB",    gate:"G1",  dept:"Product Engineering",  owner:"R. Deshmukh", priority:"High",   estDuration:15, linkedForm:"Risk Assessment Form",  mandatoryDocs:["Feasibility Report"], approvalReq:true,  status:"Active" },
  { id:"DLV003", name:"Business Case Approval",           desc:"Business case reviewed and approved by program director and finance.",  projectType:"All",   gate:"G1",  dept:"Program Management",   owner:"G. Pillai",   priority:"High",   estDuration:7,  linkedForm:"Cost Estimation Form",  mandatoryDocs:["Business Case","Finance Sign-off"], approvalReq:true,  status:"Active" },
  { id:"DLV004", name:"Target Cost Sign-off",             desc:"Target cost approved and baselined.",                                   projectType:"All",   gate:"G1",  dept:"Finance",              owner:"D. Krishnan", priority:"High",   estDuration:5,  linkedForm:"Cost Estimation Form",  mandatoryDocs:["Cost Tracker"], approvalReq:true,  status:"Active" },
  { id:"DLV005", name:"QA & CC Inputs",                   desc:"Quality and cost-competitiveness inputs captured.",                     projectType:"All",   gate:"G1",  dept:"Quality Assurance",    owner:"S. Iyer",     priority:"Medium", estDuration:5,  linkedForm:"BOM Review Form",       mandatoryDocs:[], approvalReq:false, status:"Active" },
  { id:"DLV006", name:"Benchmark Study Report",           desc:"Competitive benchmarking study completed.",                             projectType:"N-BB",  gate:"G1",  dept:"Product Engineering",  owner:"P. Menon",    priority:"Medium", estDuration:14, linkedForm:null,                    mandatoryDocs:["Benchmark Report"], approvalReq:false, status:"Active" },
  { id:"DLV007", name:"Regulatory Compliance Mapping",    desc:"All regulatory requirements mapped to design.",                         projectType:"All",   gate:"G1",  dept:"Safety & Compliance",  owner:"K. Menon",    priority:"High",   estDuration:7,  linkedForm:"Risk Assessment Form",  mandatoryDocs:["Compliance Matrix"], approvalReq:true,  status:"Active" },
  { id:"DLV008", name:"Project Charter",                  desc:"Project charter prepared and signed off by sponsor.",                   projectType:"All",   gate:"G1",  dept:"Program Management",   owner:"S. Pawar",    priority:"High",   estDuration:3,  linkedForm:"Gate Review Form",      mandatoryDocs:["Project Charter"], approvalReq:true,  status:"Active" },
  // G2 CVPA (9 deliverables)
  { id:"DLV009", name:"DR0 Design Review",                desc:"Design Review Zero conducted with all key stakeholders.",               projectType:"All",   gate:"G2",  dept:"Product Engineering",  owner:"A. Kulkarni", priority:"High",   estDuration:2,  linkedForm:"Gate Review Form",      mandatoryDocs:["DR0 Minutes","Action Log"], approvalReq:true,  status:"Active" },
  { id:"DLV010", name:"DFMEA — First Issue",              desc:"Design FMEA first issue completed and reviewed.",                       projectType:"All",   gate:"G2",  dept:"Quality Assurance",    owner:"S. Gupta",    priority:"High",   estDuration:21, linkedForm:"DFMEA Form",            mandatoryDocs:["DFMEA Sheet"], approvalReq:true,  status:"Active" },
  { id:"DLV011", name:"DVP Matrix — First Issue",         desc:"Design Validation Plan created with test owner assignments.",           projectType:"All",   gate:"G2",  dept:"Testing & Validation", owner:"A. Rathore",  priority:"High",   estDuration:14, linkedForm:"DVP Matrix",            mandatoryDocs:["DVP Plan"], approvalReq:true,  status:"Active" },
  { id:"DLV012", name:"Concept Validation Report",        desc:"Concept validated through virtual and physical means.",                 projectType:"BB",    gate:"G2",  dept:"Product Engineering",  owner:"H. Bhatt",    priority:"High",   estDuration:30, linkedForm:"Concept Approval Form", mandatoryDocs:["Concept Report"], approvalReq:true,  status:"Active" },
  { id:"DLV013", name:"BOM — First Draft",                desc:"First-cut bill of materials available.",                               projectType:"All",   gate:"G2",  dept:"Product Engineering",  owner:"R. Deshmukh", priority:"Medium", estDuration:14, linkedForm:"BOM Review Form",       mandatoryDocs:["BOM Excel"], approvalReq:false, status:"Active" },
  { id:"DLV014", name:"CAE Simulation Phase 1",           desc:"Structural CAE simulations completed for major assemblies.",            projectType:"BB",    gate:"G2",  dept:"Product Engineering",  owner:"H. Bhatt",    priority:"Medium", estDuration:21, linkedForm:null,                    mandatoryDocs:["CAE Report"], approvalReq:false, status:"Active" },
  { id:"DLV015", name:"Supplier RFQ Initiation",          desc:"Request for quotations sent to shortlisted vendors.",                   projectType:"All",   gate:"G2",  dept:"Purchase",             owner:"M. Sub",      priority:"Low",    estDuration:7,  linkedForm:"Supplier Qualification Form", mandatoryDocs:[], approvalReq:false, status:"Active" },
  { id:"DLV016", name:"Styling Theme Freeze",             desc:"Final styling direction frozen and approved.",                          projectType:"All",   gate:"G2",  dept:"Product Engineering",  owner:"A. Kulkarni", priority:"Medium", estDuration:5,  linkedForm:null,                    mandatoryDocs:["Style Sign-off"], approvalReq:false, status:"Active" },
  { id:"DLV017", name:"PFMEA — Preliminary",              desc:"Process FMEA preliminary version prepared.",                           projectType:"All",   gate:"G2",  dept:"Quality Assurance",    owner:"S. Iyer",     priority:"Medium", estDuration:14, linkedForm:"DFMEA Form",            mandatoryDocs:[], approvalReq:false, status:"Active" },
  // G3 VV (8 deliverables)
  { id:"DLV018", name:"Virtual Validation Report",        desc:"All CAE/CFD virtual validation completed and signed off.",              projectType:"BB",    gate:"G3",  dept:"Product Engineering",  owner:"H. Bhatt",    priority:"High",   estDuration:30, linkedForm:"Gate Review Form",      mandatoryDocs:["VV Report"], approvalReq:true,  status:"Active" },
  { id:"DLV019", name:"DFMEA — Updated Issue",            desc:"DFMEA updated post DR0 changes.",                                       projectType:"All",   gate:"G3",  dept:"Quality Assurance",    owner:"S. Gupta",    priority:"High",   estDuration:14, linkedForm:"DFMEA Form",            mandatoryDocs:["DFMEA Rev 2"], approvalReq:true,  status:"Active" },
  { id:"DLV020", name:"Homologation Plan",                desc:"Homologation strategy submitted for type-approval.",                    projectType:"All",   gate:"G3",  dept:"Homologation",         owner:"A. Deshmukh", priority:"High",   estDuration:14, linkedForm:"Homologation Checklist",mandatoryDocs:["Hom Plan"], approvalReq:true,  status:"Active" },
  { id:"DLV021", name:"Prototype Build Plan",             desc:"Prototype build plan with BOM and schedule finalised.",                 projectType:"All",   gate:"G3",  dept:"Manufacturing",        owner:"V. Rao",      priority:"High",   estDuration:7,  linkedForm:null,                    mandatoryDocs:["Build Plan"], approvalReq:false, status:"Active" },
  { id:"DLV022", name:"DVP Matrix — Updated",             desc:"DVP updated for G3 design changes; responsibilities confirmed.",        projectType:"All",   gate:"G3",  dept:"Testing & Validation", owner:"A. Rathore",  priority:"High",   estDuration:7,  linkedForm:"DVP Matrix",            mandatoryDocs:["DVP Rev 2"], approvalReq:true,  status:"Active" },
  { id:"DLV023", name:"Cost Re-baseline",                 desc:"BOM cost re-baselined against final design direction.",                 projectType:"All",   gate:"G3",  dept:"Finance",              owner:"T. Wagh",     priority:"High",   estDuration:5,  linkedForm:"Cost Estimation Form",  mandatoryDocs:["Cost Rebaseline Sheet"], approvalReq:true,  status:"Active" },
  { id:"DLV024", name:"Supplier Quote Comparison",        desc:"Comparative quotation analysis completed for all critical parts.",      projectType:"All",   gate:"G3",  dept:"Purchase",             owner:"M. Sub",      priority:"Medium", estDuration:14, linkedForm:"Supplier Qualification Form",mandatoryDocs:["Quote Sheet"], approvalReq:false, status:"Active" },
  { id:"DLV025", name:"CAE Sign-off — All Modules",       desc:"CAE completed and signed off for all structural modules.",              projectType:"BB",    gate:"G3",  dept:"Product Engineering",  owner:"H. Bhatt",    priority:"High",   estDuration:21, linkedForm:null,                    mandatoryDocs:["CAE Closure Report"], approvalReq:true,  status:"Active" },
  // G4 PC (8 deliverables)
  { id:"DLV026", name:"L2 Drawing Release",               desc:"All L2 production drawings released.",                                  projectType:"All",   gate:"G4",  dept:"Product Engineering",  owner:"A. Kulkarni", priority:"High",   estDuration:21, linkedForm:"Gate Review Form",      mandatoryDocs:["Drawing Package"], approvalReq:true,  status:"Active" },
  { id:"DLV027", name:"Vendor Onboarding",                desc:"Critical suppliers onboarded; POs issued.",                             projectType:"All",   gate:"G4",  dept:"Purchase",             owner:"M. Sub",      priority:"High",   estDuration:30, linkedForm:"Supplier Qualification Form",mandatoryDocs:["PO Copies","NDA"], approvalReq:true,  status:"Active" },
  { id:"DLV028", name:"VP Part Receipt",                  desc:"All VP parts received and inspected at plant.",                         projectType:"All",   gate:"G4",  dept:"Manufacturing",        owner:"V. Rao",      priority:"High",   estDuration:14, linkedForm:null,                    mandatoryDocs:["Inspection Report"], approvalReq:true,  status:"Active" },
  { id:"DLV029", name:"VP Build Report",                  desc:"Validation prototype build completed and reported.",                    projectType:"All",   gate:"G4",  dept:"Manufacturing",        owner:"N. Bhosale",  priority:"High",   estDuration:21, linkedForm:null,                    mandatoryDocs:["Build Report","NCR Log"], approvalReq:true,  status:"Active" },
  { id:"DLV030", name:"Prototype Validation",             desc:"Prototype validation against DVP plan initiated.",                      projectType:"All",   gate:"G4",  dept:"Testing & Validation", owner:"S. Naidu",    priority:"High",   estDuration:45, linkedForm:"DVP Matrix",            mandatoryDocs:["Validation Log"], approvalReq:false, status:"Active" },
  { id:"DLV031", name:"PPAP Readiness Assessment",        desc:"PPAP readiness checked for production-intent suppliers.",               projectType:"All",   gate:"G4",  dept:"Quality Assurance",    owner:"S. Iyer",     priority:"High",   estDuration:14, linkedForm:"PPAP Form",             mandatoryDocs:["PPAP Checklist"], approvalReq:false, status:"Active" },
  { id:"DLV032", name:"Tooling Progress — 80%",           desc:"Production tooling confirmed at 80% completion.",                       projectType:"All",   gate:"G4",  dept:"Manufacturing",        owner:"N. Bhosale",  priority:"Medium", estDuration:60, linkedForm:null,                    mandatoryDocs:["Tooling Tracker"], approvalReq:false, status:"Active" },
  { id:"DLV033", name:"Quality Plan — First Issue",       desc:"Product quality plan for PP and SOP phases.",                           projectType:"All",   gate:"G4",  dept:"Quality Assurance",    owner:"S. Gupta",    priority:"Medium", estDuration:7,  linkedForm:null,                    mandatoryDocs:["Quality Plan"], approvalReq:false, status:"Active" },
  // G5 PR (9 deliverables)
  { id:"DLV034", name:"VP Validation Report",             desc:"Complete VP validation results documented and signed off.",             projectType:"All",   gate:"G5",  dept:"Testing & Validation", owner:"A. Rathore",  priority:"High",   estDuration:60, linkedForm:"Gate Review Form",      mandatoryDocs:["VP Report"], approvalReq:true,  status:"Active" },
  { id:"DLV035", name:"PPAP",                             desc:"Full PPAP submission and approval for all key suppliers.",              projectType:"All",   gate:"G5",  dept:"Quality Assurance",    owner:"S. Iyer",     priority:"High",   estDuration:30, linkedForm:"PPAP Form",             mandatoryDocs:["PPAP Package"], approvalReq:true,  status:"Active" },
  { id:"DLV036", name:"Homologation Builds",              desc:"Homologation builds completed; type-approval dossier submitted.",       projectType:"All",   gate:"G5",  dept:"Homologation",         owner:"A. Deshmukh", priority:"High",   estDuration:45, linkedForm:"Homologation Checklist",mandatoryDocs:["Type Approval"], approvalReq:true,  status:"Active" },
  { id:"DLV037", name:"Pilot Build",                      desc:"Pilot production batch completed and evaluated.",                       projectType:"All",   gate:"G5",  dept:"Manufacturing",        owner:"V. Rao",      priority:"High",   estDuration:21, linkedForm:null,                    mandatoryDocs:["Pilot Report"], approvalReq:true,  status:"Active" },
  { id:"DLV038", name:"Field Trial Report",               desc:"Field trial results documented and signed off.",                        projectType:"All",   gate:"G5",  dept:"Testing & Validation", owner:"L. Reddy",    priority:"High",   estDuration:60, linkedForm:null,                    mandatoryDocs:["Field Trial Report"], approvalReq:true,  status:"Active" },
  { id:"DLV039", name:"Emission Certification",           desc:"TREM/CPCB emission certification obtained.",                           projectType:"All",   gate:"G5",  dept:"Homologation",         owner:"A. Deshmukh", priority:"High",   estDuration:90, linkedForm:"Homologation Checklist",mandatoryDocs:["Emission Certificate"], approvalReq:true,  status:"Active" },
  { id:"DLV040", name:"Production BOM — Final",           desc:"Final production BOM released and ERP-loaded.",                        projectType:"All",   gate:"G5",  dept:"Product Engineering",  owner:"R. Deshmukh", priority:"High",   estDuration:14, linkedForm:"BOM Review Form",       mandatoryDocs:["Final BOM"], approvalReq:true,  status:"Active" },
  { id:"DLV041", name:"DVP Closure Report",               desc:"All DVP items closed or with approved deviations.",                    projectType:"All",   gate:"G5",  dept:"Testing & Validation", owner:"S. Gupta",    priority:"High",   estDuration:21, linkedForm:"DVP Matrix",            mandatoryDocs:["DVP Closure"], approvalReq:true,  status:"Active" },
  { id:"DLV042", name:"Supplier Approval",                desc:"All production-intent suppliers approved and PPAP-certified.",         projectType:"All",   gate:"G5",  dept:"Purchase",             owner:"R. Patil",    priority:"High",   estDuration:30, linkedForm:"Supplier Qualification Form",mandatoryDocs:["Supplier Approval Sheet"], approvalReq:true, status:"Active" },
  // G6 PPO (8 deliverables)
  { id:"DLV043", name:"ER-SOVP Sign-off",                 desc:"Engineering Release for Start of VP Production signed off.",           projectType:"All",   gate:"G6",  dept:"Product Engineering",  owner:"A. Kulkarni", priority:"High",   estDuration:3,  linkedForm:"Gate Review Form",      mandatoryDocs:["ER-SOVP Form"], approvalReq:true,  status:"Active" },
  { id:"DLV044", name:"PP Batch Build",                   desc:"Pre-production batch build completed and results reviewed.",           projectType:"All",   gate:"G6",  dept:"Manufacturing",        owner:"V. Rao",      priority:"High",   estDuration:14, linkedForm:null,                    mandatoryDocs:["PP Build Report"], approvalReq:true,  status:"Active" },
  { id:"DLV045", name:"SOP Readiness",                    desc:"Full SOP readiness checklist completed and confirmed.",                projectType:"All",   gate:"G6",  dept:"Manufacturing",        owner:"V. Rao",      priority:"High",   estDuration:7,  linkedForm:"Gate Review Form",      mandatoryDocs:["SOP Checklist"], approvalReq:true,  status:"Active" },
  { id:"DLV046", name:"Production Readiness Review",      desc:"Production line qualified; all pre-SOP checks passed.",               projectType:"All",   gate:"G6",  dept:"Manufacturing",        owner:"N. Bhosale",  priority:"High",   estDuration:7,  linkedForm:null,                    mandatoryDocs:["PRR Report"], approvalReq:true,  status:"Active" },
  { id:"DLV047", name:"MSA Study",                        desc:"Measurement system analysis for all production gauges.",               projectType:"All",   gate:"G6",  dept:"Quality Assurance",    owner:"S. Iyer",     priority:"Medium", estDuration:14, linkedForm:null,                    mandatoryDocs:["MSA Report"], approvalReq:false, status:"Active" },
  { id:"DLV048", name:"Warranty Policy Finalisation",     desc:"Warranty terms approved and system-loaded.",                           projectType:"All",   gate:"G6",  dept:"Program Management",   owner:"G. Pillai",   priority:"Medium", estDuration:5,  linkedForm:null,                    mandatoryDocs:["Warranty Document"], approvalReq:false, status:"Active" },
  { id:"DLV049", name:"Launch Budget Confirmation",       desc:"Final SOP and launch budget confirmed by finance.",                    projectType:"All",   gate:"G6",  dept:"Finance",              owner:"D. Krishnan", priority:"High",   estDuration:3,  linkedForm:"Cost Estimation Form",  mandatoryDocs:["Budget Approval"], approvalReq:true,  status:"Active" },
  { id:"DLV050", name:"Post-Launch Review Plan",          desc:"30/60/90 day post-launch review plan prepared and approved.",          projectType:"All",   gate:"G6",  dept:"Program Management",   owner:"F. Khan",     priority:"Low",    estDuration:5,  linkedForm:null,                    mandatoryDocs:[], approvalReq:false, status:"Active" },
];

// ── 80 Forms ─────────────────────────────────────────────────
const adminForms = [
  // Gate Review Forms
  { id:"FRM001", name:"G1 Gate Review Checklist",        category:"Gate Review",   description:"Comprehensive checklist for G1 Pre-KO gate review.", status:"Active", createdBy:"SA", createdOn:"01 Jan 2026", fields:[] },
  { id:"FRM002", name:"G2 CVPA Gate Review Checklist",   category:"Gate Review",   description:"Gate review checklist for CVPA stage.",               status:"Active", createdBy:"SA", createdOn:"01 Jan 2026", fields:[] },
  { id:"FRM003", name:"G3 VV Gate Review Checklist",     category:"Gate Review",   description:"Gate review checklist for Virtual Validation stage.",  status:"Active", createdBy:"SA", createdOn:"01 Jan 2026", fields:[] },
  { id:"FRM004", name:"G4 PC Gate Review Checklist",     category:"Gate Review",   description:"Gate review checklist for Prototype Creation stage.",  status:"Active", createdBy:"SA", createdOn:"01 Jan 2026", fields:[] },
  { id:"FRM005", name:"G5 PR Gate Review Checklist",     category:"Gate Review",   description:"Gate review checklist for Prototype Release stage.",   status:"Active", createdBy:"SA", createdOn:"01 Jan 2026", fields:[] },
  { id:"FRM006", name:"G6 PPO Gate Review Checklist",    category:"Gate Review",   description:"Gate review checklist for Pre-Production Operations.", status:"Active", createdBy:"SA", createdOn:"01 Jan 2026", fields:[] },
  // Quality Forms
  { id:"FRM007", name:"DFMEA Form",                      category:"Quality",       description:"Design Failure Mode and Effects Analysis form.",       status:"Active", createdBy:"SA", createdOn:"10 Jan 2026", fields:[] },
  { id:"FRM008", name:"PFMEA Form",                      category:"Quality",       description:"Process Failure Mode and Effects Analysis form.",      status:"Active", createdBy:"SA", createdOn:"10 Jan 2026", fields:[] },
  { id:"FRM009", name:"DVP Matrix",                      category:"Validation",    description:"Design Validation Plan and test matrix.",              status:"Active", createdBy:"SA", createdOn:"10 Jan 2026", fields:[] },
  { id:"FRM010", name:"PPAP Form",                       category:"Quality",       description:"Production Part Approval Process submission form.",    status:"Active", createdBy:"SA", createdOn:"10 Jan 2026", fields:[] },
  { id:"FRM011", name:"Control Plan",                    category:"Quality",       description:"Manufacturing control plan for SOP.",                  status:"Active", createdBy:"SA", createdOn:"12 Jan 2026", fields:[] },
  { id:"FRM012", name:"Inspection Report Form",          category:"Quality",       description:"Incoming part inspection report.",                     status:"Active", createdBy:"SA", createdOn:"12 Jan 2026", fields:[] },
  { id:"FRM013", name:"MSA Study Form",                  category:"Quality",       description:"Measurement System Analysis study form.",              status:"Active", createdBy:"SA", createdOn:"15 Jan 2026", fields:[] },
  { id:"FRM014", name:"NCR Form",                        category:"Quality",       description:"Non-Conformance Report form.",                         status:"Active", createdBy:"SA", createdOn:"15 Jan 2026", fields:[] },
  // Engineering Forms
  { id:"FRM015", name:"Concept Approval Form",           category:"Engineering",   description:"Concept design approval and sign-off form.",           status:"Active", createdBy:"SA", createdOn:"20 Jan 2026", fields:[] },
  { id:"FRM016", name:"Design Review Sign-off",          category:"Engineering",   description:"Design review minutes and action sign-off form.",      status:"Active", createdBy:"SA", createdOn:"20 Jan 2026", fields:[] },
  { id:"FRM017", name:"CAE Analysis Report",             category:"Engineering",   description:"CAE simulation results and sign-off form.",            status:"Active", createdBy:"SA", createdOn:"22 Jan 2026", fields:[] },
  { id:"FRM018", name:"Drawing Release Form",            category:"Engineering",   description:"Engineering drawing release and approval form.",       status:"Active", createdBy:"SA", createdOn:"22 Jan 2026", fields:[] },
  { id:"FRM019", name:"BOM Review Form",                 category:"Engineering",   description:"Bill of Materials review and approval form.",          status:"Active", createdBy:"SA", createdOn:"25 Jan 2026", fields:[] },
  { id:"FRM020", name:"Engineering Change Request",      category:"Engineering",   description:"Engineering change request and impact assessment.",    status:"Active", createdBy:"SA", createdOn:"25 Jan 2026", fields:[] },
  { id:"FRM021", name:"Prototype Build Report",          category:"Engineering",   description:"Prototype build completion and results form.",         status:"Active", createdBy:"SA", createdOn:"28 Jan 2026", fields:[] },
  { id:"FRM022", name:"Technical Feasibility Report",    category:"Engineering",   description:"Technical feasibility assessment and approval form.",  status:"Active", createdBy:"SA", createdOn:"28 Jan 2026", fields:[] },
  // Validation & Testing
  { id:"FRM023", name:"VP Validation Report Form",       category:"Validation",    description:"Validation Prototype test results and sign-off.",      status:"Active", createdBy:"SA", createdOn:"01 Feb 2026", fields:[] },
  { id:"FRM024", name:"Field Trial Report Form",         category:"Validation",    description:"Field trial test results and finding log.",            status:"Active", createdBy:"SA", createdOn:"01 Feb 2026", fields:[] },
  { id:"FRM025", name:"Endurance Test Report",           category:"Validation",    description:"Engine and component endurance test results.",         status:"Active", createdBy:"SA", createdOn:"05 Feb 2026", fields:[] },
  { id:"FRM026", name:"NVH Evaluation Form",             category:"Validation",    description:"Noise, Vibration and Harshness evaluation form.",      status:"Active", createdBy:"SA", createdOn:"05 Feb 2026", fields:[] },
  { id:"FRM027", name:"Emission Test Report",            category:"Validation",    description:"Engine emission test results as per CPCB/TREM norms.", status:"Active", createdBy:"SA", createdOn:"08 Feb 2026", fields:[] },
  { id:"FRM028", name:"Ergonomics Assessment Form",      category:"Validation",    description:"Operator ergonomics assessment per ISO 15005.",        status:"Active", createdBy:"SA", createdOn:"08 Feb 2026", fields:[] },
  // Supply Chain & Procurement
  { id:"FRM029", name:"Supplier Qualification Form",     category:"Supply Chain",  description:"Supplier capability assessment and qualification.",    status:"Active", createdBy:"SA", createdOn:"10 Feb 2026", fields:[] },
  { id:"FRM030", name:"RFQ Template",                    category:"Supply Chain",  description:"Request for Quotation template for new sourcing.",     status:"Active", createdBy:"SA", createdOn:"10 Feb 2026", fields:[] },
  { id:"FRM031", name:"Purchase Order Requisition",      category:"Supply Chain",  description:"Internal purchase order requisition form.",            status:"Active", createdBy:"SA", createdOn:"12 Feb 2026", fields:[] },
  { id:"FRM032", name:"Incoming Quality Check",          category:"Supply Chain",  description:"Supplier part incoming quality inspection form.",      status:"Active", createdBy:"SA", createdOn:"12 Feb 2026", fields:[] },
  { id:"FRM033", name:"Vendor Performance Review",       category:"Supply Chain",  description:"Periodic vendor performance scorecard form.",          status:"Active", createdBy:"SA", createdOn:"15 Feb 2026", fields:[] },
  // Finance & Cost
  { id:"FRM034", name:"Cost Estimation Form",            category:"Finance",       description:"Product cost estimation and target tracking form.",    status:"Active", createdBy:"SA", createdOn:"15 Feb 2026", fields:[] },
  { id:"FRM035", name:"Budget Variance Report",          category:"Finance",       description:"Budget vs actuals variance analysis form.",            status:"Active", createdBy:"SA", createdOn:"18 Feb 2026", fields:[] },
  { id:"FRM036", name:"Capital Expenditure Request",     category:"Finance",       description:"Capex approval request and justification form.",       status:"Active", createdBy:"SA", createdOn:"18 Feb 2026", fields:[] },
  { id:"FRM037", name:"Cost Rebaseline Form",            category:"Finance",       description:"BOM cost rebaseline request and approval form.",       status:"Active", createdBy:"SA", createdOn:"20 Feb 2026", fields:[] },
  { id:"FRM038", name:"Launch Budget Approval Form",     category:"Finance",       description:"SOP and launch phase budget approval form.",           status:"Active", createdBy:"SA", createdOn:"20 Feb 2026", fields:[] },
  // Homologation
  { id:"FRM039", name:"Homologation Checklist",          category:"Homologation",  description:"Homologation requirements and status tracking form.",  status:"Active", createdBy:"SA", createdOn:"22 Feb 2026", fields:[] },
  { id:"FRM040", name:"Type Approval Application",       category:"Homologation",  description:"Type approval dossier submission form.",               status:"Active", createdBy:"SA", createdOn:"22 Feb 2026", fields:[] },
  { id:"FRM041", name:"ARAI Submission Form",            category:"Homologation",  description:"ARAI test and certification submission form.",         status:"Active", createdBy:"SA", createdOn:"25 Feb 2026", fields:[] },
  { id:"FRM042", name:"Emission Certification Form",     category:"Homologation",  description:"CPCB/TREM emission certificate tracking form.",        status:"Active", createdBy:"SA", createdOn:"25 Feb 2026", fields:[] },
  // Risk & Compliance
  { id:"FRM043", name:"Risk Assessment Form",            category:"Risk",          description:"Project risk identification and mitigation form.",     status:"Active", createdBy:"SA", createdOn:"01 Mar 2026", fields:[] },
  { id:"FRM044", name:"Change Impact Assessment",        category:"Risk",          description:"Design change impact and risk assessment form.",       status:"Active", createdBy:"SA", createdOn:"01 Mar 2026", fields:[] },
  { id:"FRM045", name:"Corrective Action Report",        category:"Risk",          description:"Corrective action plan and tracking form.",            status:"Active", createdBy:"SA", createdOn:"05 Mar 2026", fields:[] },
  { id:"FRM046", name:"Safety Compliance Checklist",     category:"Risk",          description:"Safety compliance verification checklist.",            status:"Active", createdBy:"SA", createdOn:"05 Mar 2026", fields:[] },
  // Manufacturing
  { id:"FRM047", name:"Process Plan Form",               category:"Manufacturing", description:"Manufacturing process plan and routings.",             status:"Active", createdBy:"SA", createdOn:"10 Mar 2026", fields:[] },
  { id:"FRM048", name:"Line Balancing Study",            category:"Manufacturing", description:"Production line balancing and cycle time study.",      status:"Active", createdBy:"SA", createdOn:"10 Mar 2026", fields:[] },
  { id:"FRM049", name:"SOP Readiness Checklist",         category:"Manufacturing", description:"SOP pre-launch readiness checklist.",                  status:"Active", createdBy:"SA", createdOn:"12 Mar 2026", fields:[] },
  { id:"FRM050", name:"Production Readiness Review",     category:"Manufacturing", description:"Production readiness review sign-off form.",           status:"Active", createdBy:"SA", createdOn:"12 Mar 2026", fields:[] },
  { id:"FRM051", name:"Tooling Qualification Form",      category:"Manufacturing", description:"Production tooling qualification and approval.",       status:"Active", createdBy:"SA", createdOn:"15 Mar 2026", fields:[] },
  { id:"FRM052", name:"PP Batch Build Report",           category:"Manufacturing", description:"Pre-production batch build results report.",           status:"Active", createdBy:"SA", createdOn:"15 Mar 2026", fields:[] },
  // Program Management
  { id:"FRM053", name:"Programme Risk Register",         category:"Program Mgmt",  description:"Programme-level risk register and tracking.",          status:"Active", createdBy:"SA", createdOn:"20 Mar 2026", fields:[] },
  { id:"FRM054", name:"Gate Readiness Assessment",       category:"Program Mgmt",  description:"Gate readiness self-assessment by project team.",      status:"Active", createdBy:"SA", createdOn:"20 Mar 2026", fields:[] },
  { id:"FRM055", name:"Milestone Tracker Form",          category:"Program Mgmt",  description:"Programme milestone tracking and status form.",        status:"Active", createdBy:"SA", createdOn:"22 Mar 2026", fields:[] },
  { id:"FRM056", name:"Action Item Log",                 category:"Program Mgmt",  description:"Action items from design reviews and gate meetings.",  status:"Active", createdBy:"SA", createdOn:"22 Mar 2026", fields:[] },
  { id:"FRM057", name:"Stakeholder Communication Form",  category:"Program Mgmt",  description:"Stakeholder communication and escalation form.",       status:"Active", createdBy:"SA", createdOn:"25 Mar 2026", fields:[] },
  { id:"FRM058", name:"Project Closure Report",          category:"Program Mgmt",  description:"End-of-project closure report and lessons learned.",   status:"Active", createdBy:"SA", createdOn:"25 Mar 2026", fields:[] },
  // Archived/Legacy
  { id:"FRM059", name:"Legacy DFMEA (Archived)",         category:"Quality",       description:"Previous version of DFMEA form — archived.",           status:"Archived",createdBy:"SA", createdOn:"01 Oct 2025", fields:[] },
  { id:"FRM060", name:"Legacy DVP (Archived)",           category:"Validation",    description:"Previous version of DVP matrix — archived.",           status:"Archived",createdBy:"SA", createdOn:"01 Oct 2025", fields:[] },
  // Additional forms to reach 80
  { id:"FRM061", name:"Customer Requirement Spec",       category:"Engineering",   description:"Customer specification input and sign-off form.",      status:"Active", createdBy:"SA", createdOn:"01 Apr 2026", fields:[] },
  { id:"FRM062", name:"Reliability Target Form",         category:"Engineering",   description:"Product reliability targets and verification plan.",   status:"Active", createdBy:"SA", createdOn:"01 Apr 2026", fields:[] },
  { id:"FRM063", name:"Material Specification Form",     category:"Engineering",   description:"Material specification and approval form.",            status:"Active", createdBy:"SA", createdOn:"05 Apr 2026", fields:[] },
  { id:"FRM064", name:"Ergonomics Sign-off",             category:"Validation",    description:"Operator ergonomics sign-off and approval.",          status:"Active", createdBy:"SA", createdOn:"05 Apr 2026", fields:[] },
  { id:"FRM065", name:"Prototype Inspection Checklist",  category:"Quality",       description:"Prototype part dimensional inspection checklist.",     status:"Active", createdBy:"SA", createdOn:"08 Apr 2026", fields:[] },
  { id:"FRM066", name:"Design Sign-off Form",            category:"Engineering",   description:"Final design release and stakeholder sign-off.",       status:"Active", createdBy:"SA", createdOn:"08 Apr 2026", fields:[] },
  { id:"FRM067", name:"Spare Parts List Form",           category:"Supply Chain",  description:"SOP spare parts list and availability form.",         status:"Active", createdBy:"SA", createdOn:"10 Apr 2026", fields:[] },
  { id:"FRM068", name:"Dealer Readiness Checklist",      category:"Program Mgmt",  description:"Dealer network SOP readiness checklist.",             status:"Active", createdBy:"SA", createdOn:"10 Apr 2026", fields:[] },
  { id:"FRM069", name:"Warranty Claim Form",             category:"Program Mgmt",  description:"Post-launch warranty claim recording form.",           status:"Active", createdBy:"SA", createdOn:"15 Apr 2026", fields:[] },
  { id:"FRM070", name:"SOP Announcement Form",           category:"Program Mgmt",  description:"SOP date and readiness announcement form.",            status:"Active", createdBy:"SA", createdOn:"15 Apr 2026", fields:[] },
  { id:"FRM071", name:"Field Feedback Form",             category:"Validation",    description:"Post-SOP field feedback collection form.",            status:"Active", createdBy:"SA", createdOn:"20 Apr 2026", fields:[] },
  { id:"FRM072", name:"Operator Feedback Form",          category:"Validation",    description:"Operator trial and feedback collection form.",         status:"Active", createdBy:"SA", createdOn:"20 Apr 2026", fields:[] },
  { id:"FRM073", name:"IT System Readiness Form",        category:"Program Mgmt",  description:"IT and ERP system readiness for SOP checklist.",       status:"Active", createdBy:"SA", createdOn:"25 Apr 2026", fields:[] },
  { id:"FRM074", name:"HR Manpower Plan",                category:"Program Mgmt",  description:"SOP manpower planning and readiness form.",            status:"Active", createdBy:"SA", createdOn:"25 Apr 2026", fields:[] },
  { id:"FRM075", name:"APQP Status Tracker",             category:"Quality",       description:"Advanced Product Quality Planning status tracker.",    status:"Active", createdBy:"SA", createdOn:"01 May 2026", fields:[] },
  { id:"FRM076", name:"Calibration Record Form",         category:"Quality",       description:"Equipment calibration record and tracking form.",      status:"Active", createdBy:"SA", createdOn:"01 May 2026", fields:[] },
  { id:"FRM077", name:"Training Record Form",            category:"Program Mgmt",  description:"Employee training completion record.",                 status:"Active", createdBy:"SA", createdOn:"05 May 2026", fields:[] },
  { id:"FRM078", name:"Test Track Booking Form",         category:"Validation",    description:"Test track and proving ground booking request.",       status:"Active", createdBy:"SA", createdOn:"05 May 2026", fields:[] },
  { id:"FRM079", name:"Component Approval Form",         category:"Engineering",   description:"Individual component approval and sign-off form.",     status:"Active", createdBy:"SA", createdOn:"10 May 2026", fields:[] },
  { id:"FRM080", name:"Post-Launch Review Form",         category:"Program Mgmt",  description:"30/60/90 day post-launch review and findings form.",   status:"Active", createdBy:"SA", createdOn:"10 May 2026", fields:[] },
];

// ── Audit Log Seed ────────────────────────────────────────────
const adminAuditLogs = [
  { id:1, action:"USER_CREATED",       module:"User Management",        entity:"Ritu Agarwal (EMP020)",                        performedBy:"Sunita Iyer",  role:"SA",  timestamp:"09 Jul 2026, 10:22", ip:"10.0.1.45",  prevValue:null,         newValue:"Active / Viewer" },
  { id:2, action:"ROLE_CHANGED",       module:"User Management",        entity:"Karan Verma (EMP005)",                         performedBy:"Sunita Iyer",  role:"SA",  timestamp:"09 Jul 2026, 10:18", ip:"10.0.1.45",  prevValue:"PMO",        newValue:"PM" },
  { id:3, action:"USER_DEACTIVATED",   module:"User Management",        entity:"Karan Verma (EMP005)",                         performedBy:"Sunita Iyer",  role:"SA",  timestamp:"08 Jul 2026, 17:05", ip:"10.0.1.45",  prevValue:"Active",     newValue:"Inactive" },
  { id:4, action:"DELIVERABLE_CREATED",module:"Deliverable Management", entity:"DLV050 — Post-Launch Review Plan",             performedBy:"Rajesh Sharma",role:"SA",  timestamp:"08 Jul 2026, 14:30", ip:"10.0.1.12",  prevValue:null,         newValue:"Active" },
  { id:5, action:"FORM_CREATED",       module:"Forms Library",          entity:"FRM080 — Post-Launch Review Form",             performedBy:"Rajesh Sharma",role:"SA",  timestamp:"08 Jul 2026, 14:15", ip:"10.0.1.12",  prevValue:null,         newValue:"Active" },
  { id:6, action:"CHECKLIST_UPDATED",  module:"Gate Checklist",         entity:"G5 PR — DVP Closure Report",                  performedBy:"Priya Nair",   role:"PMO", timestamp:"08 Jul 2026, 11:00", ip:"10.0.2.33",  prevValue:"Mandatory: N",newValue:"Mandatory: Y" },
  { id:7, action:"FORM_ARCHIVED",      module:"Forms Library",          entity:"FRM059 — Legacy DFMEA",                       performedBy:"Rajesh Sharma",role:"SA",  timestamp:"07 Jul 2026, 16:45", ip:"10.0.1.12",  prevValue:"Active",     newValue:"Archived" },
  { id:8, action:"USER_PASSWORD_RESET",module:"User Management",        entity:"Arjun Mehta (EMP003)",                        performedBy:"Sunita Iyer",  role:"SA",  timestamp:"07 Jul 2026, 15:30", ip:"10.0.1.45",  prevValue:"—",          newValue:"Temp password sent" },
  { id:9, action:"DELIVERABLE_EDITED", module:"Deliverable Management", entity:"DLV035 — PPAP",                               performedBy:"Rajesh Sharma",role:"SA",  timestamp:"07 Jul 2026, 13:20", ip:"10.0.1.12",  prevValue:"Priority: Medium", newValue:"Priority: High" },
  { id:10,action:"CHECKLIST_CREATED",  module:"Gate Checklist",         entity:"G6 PPO — Post-Launch Review Plan",            performedBy:"Rajesh Sharma",role:"SA",  timestamp:"07 Jul 2026, 11:00", ip:"10.0.1.12",  prevValue:null,         newValue:"Active" },
  { id:11,action:"FORM_CLONED",        module:"Forms Library",          entity:"FRM007 — DFMEA Form → FRM007-Copy",           performedBy:"Priya Nair",   role:"PMO", timestamp:"06 Jul 2026, 14:00", ip:"10.0.2.33",  prevValue:null,         newValue:"Draft" },
  { id:12,action:"USER_CREATED",       module:"User Management",        entity:"Chetan Philip (EMP029)",                      performedBy:"Sunita Iyer",  role:"SA",  timestamp:"05 Jul 2026, 10:05", ip:"10.0.1.45",  prevValue:null,         newValue:"Active / Reviewer" },
  { id:13,action:"DELIVERABLE_ARCHIVED",module:"Deliverable Management","entity":"DLV006 — Benchmark Study Report (Archived)",performedBy:"Rajesh Sharma",role:"SA",  timestamp:"04 Jul 2026, 16:00", ip:"10.0.1.12",  prevValue:"Active",     newValue:"Archived" },
  { id:14,action:"WORKFLOW_UPDATED",   module:"Workflow Configuration", entity:"Gate G5 PR — Approval Sequence",              performedBy:"Rajesh Sharma",role:"SA",  timestamp:"03 Jul 2026, 11:30", ip:"10.0.1.12",  prevValue:"2-step",     newValue:"3-step" },
  { id:15,action:"NOTIFICATION_CONFIGURED",module:"Notification Config","entity":"Deliverable Due Date Reminder — 3 days",   performedBy:"Sunita Iyer",  role:"SA",  timestamp:"02 Jul 2026, 09:15", ip:"10.0.1.45",  prevValue:"Off",        newValue:"On" },
  { id:16,action:"ROLE_CHANGED",       module:"User Management",        entity:"Manoj Singh (EMP019)",                        performedBy:"Sunita Iyer",  role:"SA",  timestamp:"01 Jul 2026, 14:45", ip:"10.0.1.45",  prevValue:"PM",         newValue:"REV" },
  { id:17,action:"FORM_UPDATED",       module:"Forms Library",          entity:"FRM010 — PPAP Form",                          performedBy:"Priya Nair",   role:"PMO", timestamp:"30 Jun 2026, 11:20", ip:"10.0.2.33",  prevValue:"Ver 1.0",    newValue:"Ver 2.0" },
  { id:18,action:"DELIVERABLE_CREATED",module:"Deliverable Management", entity:"DLV049 — Launch Budget Confirmation",         performedBy:"Rajesh Sharma",role:"SA",  timestamp:"28 Jun 2026, 10:00", ip:"10.0.1.12",  prevValue:null,         newValue:"Active" },
  { id:19,action:"USER_DEACTIVATED",   module:"User Management",        entity:"Shilpa Tiwari (EMP028)",                      performedBy:"Sunita Iyer",  role:"SA",  timestamp:"26 Jun 2026, 16:00", ip:"10.0.1.45",  prevValue:"Active",     newValue:"Inactive" },
  { id:20,action:"CHECKLIST_REORDERED",module:"Gate Checklist",         entity:"G4 PC — Sequence reorder (items 3↔5)",        performedBy:"Rajesh Sharma",role:"SA",  timestamp:"24 Jun 2026, 13:00", ip:"10.0.1.12",  prevValue:"Seq: 3,4,5", newValue:"Seq: 5,4,3" },
  { id:21,action:"MASTER_DATA_UPDATED",module:"Master Data",            entity:"Department added: Safety & Compliance",       performedBy:"Sunita Iyer",  role:"SA",  timestamp:"20 Jun 2026, 09:30", ip:"10.0.1.45",  prevValue:"11 depts",   newValue:"12 depts" },
  { id:22,action:"FORM_CREATED",       module:"Forms Library",          entity:"FRM079 — Component Approval Form",            performedBy:"Rajesh Sharma",role:"SA",  timestamp:"18 Jun 2026, 14:30", ip:"10.0.1.12",  prevValue:null,         newValue:"Active" },
  { id:23,action:"PROJECT_CONFIG_SAVED",module:"Project Configuration", entity:"Tractor 5 — G4 deliverables assigned",        performedBy:"Karan Verma",  role:"PM",  timestamp:"15 Jun 2026, 11:00", ip:"10.0.3.21",  prevValue:"3 deliverables",newValue:"8 deliverables" },
  { id:24,action:"GATE_SUBMITTED",     module:"Project Execution",      entity:"Tractor 3 — G3 VV submitted for approval",    performedBy:"Arjun Mehta",  role:"EH",  timestamp:"12 Jun 2026, 16:20", ip:"10.0.4.88",  prevValue:"In Progress",newValue:"Submitted" },
  { id:25,action:"GATE_APPROVED",      module:"Project Execution",      entity:"Tractor 3 — G3 VV approved",                  performedBy:"Ganesh Pillai",role:"APR", timestamp:"14 Jun 2026, 10:05", ip:"10.0.5.12",  prevValue:"Submitted",  newValue:"Approved" },
];

// ── Deliverable-Form Mappings ──────────────────────────────────
const adminDeliverableFormMappings = [
  { deliverableId:"DLV001", formId:"FRM001" },
  { deliverableId:"DLV001", formId:"FRM043" },
  { deliverableId:"DLV002", formId:"FRM022" },
  { deliverableId:"DLV002", formId:"FRM043" },
  { deliverableId:"DLV003", formId:"FRM034" },
  { deliverableId:"DLV004", formId:"FRM034" },
  { deliverableId:"DLV005", formId:"FRM019" },
  { deliverableId:"DLV007", formId:"FRM046" },
  { deliverableId:"DLV008", formId:"FRM001" },
  { deliverableId:"DLV009", formId:"FRM016" },
  { deliverableId:"DLV010", formId:"FRM007" },
  { deliverableId:"DLV011", formId:"FRM009" },
  { deliverableId:"DLV012", formId:"FRM015" },
  { deliverableId:"DLV013", formId:"FRM019" },
  { deliverableId:"DLV014", formId:"FRM017" },
  { deliverableId:"DLV015", formId:"FRM030" },
  { deliverableId:"DLV018", formId:"FRM003" },
  { deliverableId:"DLV018", formId:"FRM017" },
  { deliverableId:"DLV019", formId:"FRM007" },
  { deliverableId:"DLV020", formId:"FRM039" },
  { deliverableId:"DLV022", formId:"FRM009" },
  { deliverableId:"DLV023", formId:"FRM037" },
  { deliverableId:"DLV024", formId:"FRM029" },
  { deliverableId:"DLV025", formId:"FRM017" },
  { deliverableId:"DLV026", formId:"FRM018" },
  { deliverableId:"DLV027", formId:"FRM029" },
  { deliverableId:"DLV028", formId:"FRM012" },
  { deliverableId:"DLV030", formId:"FRM009" },
  { deliverableId:"DLV031", formId:"FRM010" },
  { deliverableId:"DLV034", formId:"FRM023" },
  { deliverableId:"DLV034", formId:"FRM005" },
  { deliverableId:"DLV035", formId:"FRM010" },
  { deliverableId:"DLV036", formId:"FRM039" },
  { deliverableId:"DLV039", formId:"FRM042" },
  { deliverableId:"DLV040", formId:"FRM019" },
  { deliverableId:"DLV041", formId:"FRM009" },
  { deliverableId:"DLV042", formId:"FRM029" },
  { deliverableId:"DLV043", formId:"FRM006" },
  { deliverableId:"DLV047", formId:"FRM013" },
  { deliverableId:"DLV049", formId:"FRM038" },
];

// ── Notification Config ───────────────────────────────────────
const adminNotificationConfig = [
  { id:"N01", event:"Deliverable Assigned",  channel:"Email",         recipients:["Owner","Reviewer"],       active:true,  triggerOffset:0, offsetUnit:"Immediately" },
  { id:"N02", event:"Due Date Reminder",     channel:"Email + Bell",  recipients:["Owner"],                  active:true,  triggerOffset:3, offsetUnit:"Days Before" },
  { id:"N03", event:"Due Date Reminder",     channel:"Email",         recipients:["Owner","Project Manager"],active:true,  triggerOffset:1, offsetUnit:"Days Before" },
  { id:"N04", event:"Document Uploaded",     channel:"Bell",          recipients:["Reviewer","Approver"],    active:true,  triggerOffset:0, offsetUnit:"Immediately" },
  { id:"N05", event:"Gate Submitted",        channel:"Email + Bell",  recipients:["Approver","PMO"],         active:true,  triggerOffset:0, offsetUnit:"Immediately" },
  { id:"N06", event:"Approval Pending",      channel:"Email + Bell",  recipients:["Approver"],               active:true,  triggerOffset:0, offsetUnit:"Immediately" },
  { id:"N07", event:"Approval Rejected",     channel:"Email + Bell",  recipients:["Owner","Project Manager"],active:true,  triggerOffset:0, offsetUnit:"Immediately" },
  { id:"N08", event:"Approval Approved",     channel:"Email + Bell",  recipients:["Owner","Project Manager","PMO"],active:true, triggerOffset:0, offsetUnit:"Immediately" },
  { id:"N09", event:"Overdue Deliverable",   channel:"Email",         recipients:["Owner","Project Manager","PMO"],active:true, triggerOffset:1, offsetUnit:"Days After" },
  { id:"N10", event:"New User Created",      channel:"Email",         recipients:["New User"],               active:true,  triggerOffset:0, offsetUnit:"Immediately" },
];

// ── Workflow Config ───────────────────────────────────────────
const adminWorkflowConfig = [
  { id:"WF01", gate:"G1 Pre-KO", steps:[{seq:1,role:"Project Manager",action:"Submit"},{seq:2,role:"Engineering Head",action:"Review"},{seq:3,role:"PMO",action:"Approve"}], active:true },
  { id:"WF02", gate:"G2 CVPA",   steps:[{seq:1,role:"Project Manager",action:"Submit"},{seq:2,role:"Engineering Head",action:"Review"},{seq:3,role:"Quality Head",action:"Review"},{seq:4,role:"PMO",action:"Approve"}], active:true },
  { id:"WF03", gate:"G3 VV",     steps:[{seq:1,role:"Project Manager",action:"Submit"},{seq:2,role:"Engineering Head",action:"Review"},{seq:3,role:"Quality Head",action:"Review"},{seq:4,role:"Approver",action:"Approve"}], active:true },
  { id:"WF04", gate:"G4 PC",     steps:[{seq:1,role:"Project Manager",action:"Submit"},{seq:2,role:"Engineering Head",action:"Review"},{seq:3,role:"Quality Head",action:"Review"},{seq:4,role:"Plant Head",action:"Review"},{seq:5,role:"Approver",action:"Approve"}], active:true },
  { id:"WF05", gate:"G5 PR",     steps:[{seq:1,role:"Project Manager",action:"Submit"},{seq:2,role:"Engineering Head",action:"Review"},{seq:3,role:"Quality Head",action:"Review"},{seq:4,role:"Homologation",action:"Review"},{seq:5,role:"Finance",action:"Approve"},{seq:6,role:"Approver",action:"Final Approve"}], active:true },
  { id:"WF06", gate:"G6 PPO",    steps:[{seq:1,role:"Project Manager",action:"Submit"},{seq:2,role:"Plant Head",action:"Review"},{seq:3,role:"Quality Head",action:"Review"},{seq:4,role:"Finance",action:"Review"},{seq:5,role:"PMO",action:"Approve"},{seq:6,role:"Approver",action:"Final Approve"}], active:true },
];

// ── Project Configuration (PM assigns deliverables) ───────────
const adminProjectConfigs = {};
