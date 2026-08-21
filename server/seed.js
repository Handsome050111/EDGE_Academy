const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const Track = require('./models/Track');
const Module = require('./models/Module');
const ModulePrerequisite = require('./models/ModulePrerequisite');
const User = require('./models/User');
const Question = require('./models/Question');
const QuizAttempt = require('./models/QuizAttempt');
const AttemptResponse = require('./models/AttemptResponse');
const Assignment = require('./models/Assignment');
const Certificate = require('./models/Certificate');
const VideoProgress = require('./models/VideoProgress');
const ConceptScore = require('./models/ConceptScore');
const AuditLog = require('./models/AuditLog');
const Team = require('./models/Team');
const connectDB = require('./config/db');

dotenv.config();

const seedData = async () => {
  try {
    await connectDB();

    console.log('🔄 Cleaning all existing database collections...');
    await Track.deleteMany({});
    await Module.deleteMany({});
    await ModulePrerequisite.deleteMany({});
    await Question.deleteMany({});
    await QuizAttempt.deleteMany({});
    await AttemptResponse.deleteMany({});
    await Assignment.deleteMany({});
    await Certificate.deleteMany({});
    await VideoProgress.deleteMany({});
    await ConceptScore.deleteMany({});
    await AuditLog.deleteMany({});
    await User.deleteMany({});
    await Team.deleteMany({});

    console.log('✅ Collections cleaned successfully.');

    // Ensure all schema indexes (including compound unique constraints) are built
    await Promise.all([
      ModulePrerequisite.syncIndexes(),
      Certificate.syncIndexes(),
      VideoProgress.syncIndexes(),
      ConceptScore.syncIndexes(),
      User.syncIndexes(),
      Track.syncIndexes(),
      Module.syncIndexes(),
      Question.syncIndexes(),
      Assignment.syncIndexes(),
      QuizAttempt.syncIndexes(),
      AttemptResponse.syncIndexes(),
      AuditLog.syncIndexes(),
    ]);
    console.log('✅ Schema indexes synchronized with database.');


    // 1. Seed Official Accounts & Teams
    const demoTeam = await Team.create({
      name: 'Technonex EMEA Field Operations',
      region: 'EMEA',
    });

    // Enforce bcrypt with cost factor 12 as per Spec Section 10.1
    const BCRYPT_COST_FACTOR = 12;
    console.log(`🔐 Generating demo passwords with bcrypt cost factor ${BCRYPT_COST_FACTOR}...`);
    const demoPasswordHash = await bcrypt.hash('Password123!', BCRYPT_COST_FACTOR);

    const demoUsers = [
      {
        full_name: 'Ali Sultan',
        email: 'ali.sultan@technonex.de',
        password_hash: demoPasswordHash,
        role: 'engineer',
        team_id: demoTeam._id,
        locale: 'en',
        is_active: true,
        status: 'active',
        deleted_at: null,
      },
      {
        full_name: 'Team Lead',
        email: 'lead@technonex.de',
        password_hash: demoPasswordHash,
        role: 'team_lead',
        team_id: demoTeam._id,
        locale: 'en',
        is_active: true,
        status: 'active',
        deleted_at: null,
      },
      {
        full_name: 'Admin User',
        email: 'admin@technonex.de',
        password_hash: demoPasswordHash,
        role: 'admin',
        locale: 'en',
        is_active: true,
        status: 'active',
        deleted_at: null,
      },
    ];

    const createdUsers = await User.create(demoUsers);
    const adminUser = createdUsers.find((u) => u.role === 'admin') || createdUsers[0];

    // Assign team lead to demoTeam
    const teamLeadUser = createdUsers.find((u) => u.role === 'team_lead');
    if (teamLeadUser) {
      demoTeam.lead_user_id = teamLeadUser._id;
      await demoTeam.save();
    }

    // 2. Seed Track 1: EDGE L1 — Certified Technician
    const trackL1 = await Track.create({
      name: 'EDGE L1 — Certified Technician',
      slug: 'EDGE-L1',
      description: 'An engineer completing EDGE L1 is deployment-ready. Identifies, documents, and executes standard field activities under supervision.',
      icon: 'shield-check',
      is_published: true,
      display_order: 1,
    });

    // 3. Seed Track 2: CORE L2 — Certified Engineer
    const trackL2 = await Track.create({
      name: 'CORE L2 — Certified Engineer',
      slug: 'CORE-L2',
      description: 'A CORE L2 engineer is a technical leader on site. Leads teams, validates surveys, makes technical decisions, and mentors junior engineers.',
      icon: 'award',
      is_published: true,
      display_order: 2,
    });

    // 4. EDGE L1 Modules Data (16 Modules)
    const edgeL1ModulesData = [
      { title: 'M1: Cable Types & Connectors', description: 'LAN cables CAT5e, CAT6, CAT6A, CAT7. RJ45 connector identification, cable jacket markings, patch leads vs structured cabling.', tier: 'L1_CORE' },
      { title: 'M2: Fiber Cables & SFPs', description: 'Single Mode vs Multi Mode, OS1/OS2, OM1-OM4. LC, SC, ST connectors. SFP, SFP+, QSFP module matching.', tier: 'L1_CORE' },
      { title: 'M3: Rack & Cabinet Fundamentals', description: 'RU counting, cabinet types (42U, 24U, 12U), cable dressing to Siemens visual standard, bend radius, velcro vs cable ties.', tier: 'L1_CORE' },
      { title: 'M4: Cage Nuts & Mounting Hardware', description: 'Cage nut sizes M5, M6, 10-32, 12-24 identification, screw selection, damage-free installation technique.', tier: 'L1_CORE' },
      { title: 'M5: Inside the Rack', description: 'Equipment positioning, airflow management (hot/cold aisle), PDU C13/C14 vs C15/C16, reading rack elevation diagrams.', tier: 'L1_CORE' },
      { title: 'M6: Switches — Fundamentals', description: 'Managed vs unmanaged switches, 24 vs 48-port, PoE for APs and phones, port LED state interpretation.', tier: 'L1_CORE' },
      { title: 'M7: Switches — Cisco, Aruba, Juniper', description: 'Brand physical identification, hostname/serial location, label photography for Infosys CMDB validation.', tier: 'L1_CORE' },
      { title: 'M8: Routers, Firewalls & Access Points', description: 'Physical differences between routers, switches, and firewalls. Ceiling vs wall mount APs.', tier: 'L1_CORE' },
      { title: 'M9: Safety SOPs & DGUV V3 Basics', description: 'German safety legal requirements (DGUV V3), safe electrical working distances, PPE selection, site emergency procedures.', tier: 'L1_CORE' },
      { title: 'M10: Tool Kit & Correct Usage', description: 'Field tool list, cordless drill technique per surface, cable tester, PoE tester, torque screwdriver.', tier: 'L1_CORE' },
      { title: 'M11: Reporting & Photo Documentation', description: 'Mandatory before/during/after photo stages, photo naming conventions, completing Technonex survey form.', tier: 'L1_CORE' },
      { title: 'M12: Client Communication & Professional Behaviour', description: 'Siemens POC greeting, issue escalation protocols, professional language, problem handling on site.', tier: 'L1_CORE' },
      { title: 'M13: German Work Culture & Site Etiquette', description: 'German punctuality standards, production environment conduct, dress code, commercial impact.', tier: 'L1_CORE' },
      { title: 'M14: Reading Technical Documents', description: 'Cable matrix reading, AP floor plan positioning, Bill of Materials verification, CMO vs FMO.', tier: 'L1_CORE' },
      { title: 'M15: Basic Networking Concepts', description: 'IP addresses, VLANs, DHCP vs static IP, subnets, accurate problem escalation terminology.', tier: 'L1_CORE' },
      { title: 'M16: Personal Brand as a Technonex Engineer', description: 'Field presentation, company representation, clean site handover, Technonex core values.', tier: 'L1_CORE' },
    ];

    const createdL1Modules = [];
    for (const mod of edgeL1ModulesData) {
      const slug = mod.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const createdMod = await Module.create({
        track_id: trackL1._id,
        title: mod.title,
        slug,
        description: mod.description,
        tier: mod.tier,
        video_provider_id: `cf_stream_${slug}`,
        video_duration_sec: 300,
        pass_threshold: 80,
        quiz_question_count: 6,
        status: 'published',
        created_by: adminUser._id,
        published_at: new Date(),
        deleted_at: null,
      });
      createdL1Modules.push(createdMod);

      // Seed 5 MCQs per module
      for (let i = 1; i <= 5; i++) {
        await Question.create({
          module_id: createdMod._id,
          question_text: `[${mod.title}] Question ${i}: What is the standard procedure for ${mod.title}?`,
          option_a: 'Execute according to official Siemens and Technonex SOP guidelines',
          option_b: 'Bypass safety checks and proceed without documentation',
          option_c: 'Use unverified third-party tools without signoff',
          option_d: 'Skip mandatory photo documentation',
          correct_option: 'A',
          explanation: `Always follow official Technonex SOP guidelines for ${mod.title}.`,
          difficulty: i % 2 === 0 ? 'medium' : 'easy',
          concept_tag: `${slug.replace(/-/g, '_')}_concept_${i}`,
          version: 1,
          is_active: true,
          created_by: adminUser._id,
          deleted_at: null,
        });
      }
    }

    trackL1.modules = createdL1Modules.map((m) => m._id);
    await trackL1.save();

    // 5. CORE L2 Modules Data (15 Modules)
    const coreL2ModulesData = [
      { title: 'C1: Infrastructure Awareness — CCNA Concepts', description: 'Deep VLANs, trunking, show interfaces, show VLAN, CDP neighbours, IP routing basics.', tier: 'L2_ADVANCED' },
      { title: 'C2: WLAN Fundamentals — Ekahau Concepts', description: 'Ekahau heatmaps, RSSI signal values, AP coverage vs capacity, passive vs active surveys.', tier: 'L2_ADVANCED' },
      { title: 'C3: Site Survey', description: 'All 14 sections of Infosys survey, Must vs Good To Have fields, Technonex dual validation model.', tier: 'L2_ADVANCED' },
      { title: 'C4: AP Mounting — Full SOP', description: '15-step mounting process, false ceiling/tray/wall/concrete fixing, 5-stage photo checklist.', tier: 'L2_ADVANCED' },
      { title: 'C5: Advanced Switch Reading — CLI Basics', description: 'Read-only CLI show commands, port state analysis, CDP neighbour mapping, log output sharing.', tier: 'L2_ADVANCED' },
      { title: 'C6: Fiber Cabling Advanced — OTDR & Fault Finding', description: 'OTDR traces, loss readings, fiber connector inspection, cleaning procedures, fault isolation.', tier: 'L2_ADVANCED' },
      { title: 'C7: Network Troubleshooting — Field Level', description: 'Systematic elimination, cable vs switch vs config vs PoE fault isolation.', tier: 'L2_ADVANCED' },
      { title: 'C8: Problem Solving on Site', description: 'On-site decision trees, material mismatch handling, proactive Regional Lead escalation.', tier: 'L2_ADVANCED' },
      { title: 'C9: Post-Activity Handover', description: 'Quality reports within 24h, ticket closure notes, BAU briefing, POC relationship log.', tier: 'L2_ADVANCED' },
      { title: 'C10: Project Coordination — LAN Transformation', description: 'CMO, FMO, IMO phases, CMDB accuracy, cutover plan execution.', tier: 'L2_ADVANCED' },
      { title: 'C11: Quality Assurance & Siemens Standards', description: 'Siemens visual benchmark, punch lists, self-assessment, defect identification.', tier: 'L2_ADVANCED' },
      { title: 'C12: Mentoring & Team Leadership on Site', description: 'Pre-activity briefings, capability-based task assignment, constructive feedback on site.', tier: 'L2_ADVANCED' },
      { title: 'C13: Cybersecurity Basics', description: 'Device policy, no personal devices on client network, GDPR field requirements.', tier: 'L2_ADVANCED' },
      { title: 'C14: Commercial Awareness', description: 'Day rates (€155 / €170), cost of project delays, material waste, profitability impact.', tier: 'L2_ADVANCED' },
      { title: 'C15: Health & Safety Advanced — Platform Licenses', description: 'Working at height in Germany, scissor/boom lift operation, risk assessments, permit to work.', tier: 'L2_ADVANCED' },
    ];

    const createdL2Modules = [];
    for (let idx = 0; idx < coreL2ModulesData.length; idx++) {
      const mod = coreL2ModulesData[idx];
      const slug = mod.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const createdMod = await Module.create({
        track_id: trackL2._id,
        title: mod.title,
        slug,
        description: mod.description,
        tier: mod.tier,
        video_provider_id: `cf_stream_${slug}`,
        video_duration_sec: 300,
        pass_threshold: 80,
        quiz_question_count: 6,
        status: 'published',
        created_by: adminUser._id,
        published_at: new Date(),
        deleted_at: null,
      });
      createdL2Modules.push(createdMod);

      // 6. Seed ModulePrerequisites as per Spec Section 4.6 & 5.5
      // (L2 modules generally have their L1 counterparts as prerequisites)
      const correspondingL1Module = createdL1Modules[idx % createdL1Modules.length];
      if (correspondingL1Module) {
        await ModulePrerequisite.create({
          module_id: createdMod._id,
          prerequisite_module_id: correspondingL1Module._id,
        });
      }

      // Seed 5 MCQs per module
      for (let i = 1; i <= 5; i++) {
        await Question.create({
          module_id: createdMod._id,
          question_text: `[${mod.title}] Question ${i}: What is the primary decision standard for ${mod.title}?`,
          option_a: 'Execute according to official Siemens and Technonex CORE L2 standards',
          option_b: 'Rely on informal verbal instructions without logging',
          option_c: 'Skip quality assurance check to save time on site',
          option_d: 'Decline mandatory photo documentation',
          correct_option: 'A',
          explanation: `Always follow official CORE L2 procedures for ${mod.title}.`,
          difficulty: i % 2 === 0 ? 'hard' : 'medium',
          concept_tag: `${slug.replace(/-/g, '_')}_concept_${i}`,
          version: 1,
          is_active: true,
          created_by: adminUser._id,
          deleted_at: null,
        });
      }
    }

    trackL2.modules = createdL2Modules.map((m) => m._id);
    await trackL2.save();

    const prerequisiteCount = await ModulePrerequisite.countDocuments();

    console.log('--------------------------------------------------');
    console.log('🎉 EDGE ACADEMY DATABASE SEEDED SUCCESSFULLY!');
    console.log('--------------------------------------------------');
    console.log(`Created 2 Tracks:`);
    console.log(` - ${trackL1.name} (${edgeL1ModulesData.length} Modules)`);
    console.log(` - ${trackL2.name} (${coreL2ModulesData.length} Modules)`);
    console.log(` - ${prerequisiteCount} ModulePrerequisites configured.`);
    console.log(` - Password hash generated with bcrypt cost factor ${BCRYPT_COST_FACTOR}.`);
    console.log('\nDemo Accounts:');
    demoUsers.forEach((user) => {
      console.log(`- ${user.email} | Role: ${user.role} | Password: Password123!`);
    });
    console.log('--------------------------------------------------');

    process.exit(0);
  } catch (error) {
    console.error(`❌ Error Seeding Data: ${error.message}`);
    process.exit(1);
  }
};

seedData();