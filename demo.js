const demoStudentSeed = [
    { name: 'Aarav Sample', id: '2024CSE042', roll: '24A05CSE0042', branch: 'CSE', access: 'Linked' },
    { name: 'Mira Example', id: '2024CSE043', roll: '24A05CSE0043', branch: 'CSE', access: 'Linked' },
    { name: 'Rohan Demo', id: '2024ECE018', roll: '24A05ECE0018', branch: 'ECE', access: 'Awaiting' },
    { name: 'Nila Sample', id: '2023CSE116', roll: '23A05CSE0116', branch: 'CSE', access: 'Linked' },
    { name: 'Dev Example', id: '2023ME042', roll: '23A05ME0042', branch: 'ME', access: 'Linked' },
    { name: 'Leah Example', id: '2026CSE044', roll: '', branch: 'CSE', access: 'Awaiting', demoSeedPending: true }
];
let demoStudents = demoStudentSeed.map((student) => ({ ...student }));

const demoAccounts = [
    { email: 'student.demo@example.com', password: 'StudentDemo2026!', name: 'Student', workspace: 'student' },
    { email: 'principal.demo@example.com', password: 'AdminDemo2026!', name: 'Principal / Admin', workspace: 'admin' }
];

const adminRoleProfiles = {
    super_admin: {
        name: 'Super Admin',
        title: 'System overview',
        description: 'Manage platform setup, college access, and school operations.',
        explanation: 'Full system access, including settings and every staff role.',
        scope: 'All-college access',
        staffAccess: true,
        managesStudents: true,
        rolls: true,
        chairman: false,
        branch: null,
        counts: ['1,248', '1,186', '62', '18']
    },
    chairman: {
        name: 'Chairman',
        title: 'Chairman overview',
        description: 'College-wide enrollment and student-access reports at a glance.',
        explanation: 'Read-only summary view. Student records and staff controls are not available.',
        scope: 'Summary reports only',
        staffAccess: false,
        managesStudents: false,
        rolls: false,
        chairman: true,
        branch: null,
        counts: ['1,248', '1,186', '62', '18']
    },
    principal: {
        name: 'Principal',
        title: 'Principal overview',
        description: 'Coordinate student operations and approved staff access across the college.',
        explanation: 'Manage college-wide student records and assign Vice Principal, Registrar, HOD, and Faculty roles.',
        scope: 'All-college access',
        staffAccess: true,
        managesStudents: true,
        rolls: true,
        chairman: false,
        branch: null,
        counts: ['1,248', '1,186', '62', '18']
    },
    vice_principal: {
        name: 'Vice Principal',
        title: 'Vice Principal overview',
        description: 'Coordinate daily student operations and delegated staff work.',
        explanation: 'Manage college-wide student records. Staff-role access appears only when the Principal or Super Admin delegates it.',
        scope: 'All-college access',
        staffAccess: false,
        managesStudents: true,
        rolls: true,
        chairman: false,
        branch: null,
        counts: ['1,248', '1,186', '62', '18']
    },
    registrar: {
        name: 'Registrar / College Admin',
        title: 'Registrar workspace',
        description: 'Manage admissions, student profiles, registration IDs, and roll allocation.',
        explanation: 'School-wide student administration. Staff-role assignment and system settings are not available.',
        scope: 'Admissions and records',
        staffAccess: false,
        managesStudents: true,
        rolls: true,
        chairman: false,
        branch: null,
        counts: ['1,248', '1,186', '62', '18']
    },
    hod: {
        name: 'Head of Department · CSE',
        title: 'Department overview',
        description: 'Manage students and rolls for the assigned department.',
        explanation: 'Manage student records within Computer Science (CSE). Other departments are outside this view.',
        scope: 'CSE branch only',
        staffAccess: false,
        managesStudents: true,
        rolls: true,
        chairman: false,
        branch: 'CSE',
        counts: ['184', '176', '8', '3']
    },
    faculty: {
        name: 'Faculty · CSE',
        title: 'Faculty overview',
        description: 'Review the student roster for your assigned department.',
        explanation: 'Read-only access to the CSE branch. Student email, phone, and date of birth are hidden.',
        scope: 'CSE · Read only',
        staffAccess: false,
        managesStudents: false,
        rolls: false,
        chairman: false,
        branch: 'CSE',
        counts: ['184', '176', '8', '3']
    }
};

let currentDemoRole = 'principal';
let currentDemoUser = null;
let toastTimer = null;

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-demo-account]').forEach((button) => {
        button.addEventListener('click', () => {
            const account = demoAccounts.find((item) => item.workspace === button.dataset.demoAccount);
            if (!account) return;
            document.getElementById('demoEmail').value = account.email;
            document.getElementById('demoPassword').value = account.password;
            document.getElementById('demoLoginMessage').hidden = true;
            document.getElementById('demoPassword').focus();
        });
    });

    document.getElementById('demoLoginForm')?.addEventListener('submit', signInToDemo);
    document.getElementById('demoSignOut')?.addEventListener('click', signOutOfDemo);
    document.getElementById('demoEnrollForm')?.addEventListener('submit', addDemoStudent);
    document.querySelectorAll('[data-close-demo-dialog]').forEach((button) => {
        button.addEventListener('click', () => document.getElementById('demoEnrollDialog').close());
    });
    ['demoStudentYear', 'demoStudentBranch', 'demoStudentNumber'].forEach((id) => {
        document.getElementById(id)?.addEventListener('input', updateRegistrationPreview);
        document.getElementById(id)?.addEventListener('change', updateRegistrationPreview);
    });

    document.querySelectorAll('[data-demo-tab]').forEach((button) => {
        button.addEventListener('click', () => setDemoView(button.dataset.demoTab));
    });

    const roleSelect = document.getElementById('demoRoleSelect');
    roleSelect?.addEventListener('change', () => {
        currentDemoRole = roleSelect.value;
        renderAdminDemo();
    });

    document.getElementById('demoDelegation')?.addEventListener('change', renderAdminDemo);
    document.getElementById('demoRosterSearch')?.addEventListener('input', renderDemoRoster);
    document.querySelectorAll('[data-admin-action]').forEach((button) => {
        button.addEventListener('click', (event) => {
            event.preventDefault();
            if (button.dataset.adminAction === 'enroll') openDemoEnrollDialog();
            if (button.dataset.adminAction === 'allocate') allocateDemoRolls();
        });
    });
    document.querySelectorAll('.demo-side-nav a[href^="#"]').forEach((link) => {
        link.addEventListener('click', (event) => {
            if (link.hasAttribute('data-admin-link') && !canSeeDemoLink(link.dataset.adminLink)) {
                event.preventDefault();
                showDemoToast('That section is outside the selected role’s permissions.');
                return;
            }
            if (link.dataset.adminLink === 'rolls') {
                event.preventDefault();
                allocateDemoRolls();
                return;
            }
            if (link.dataset.adminLink === 'staff') {
                event.preventDefault();
                document.getElementById('demoStaffAccess')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }
            if (link.closest('[aria-label="Student demo navigation"]')) {
                event.preventDefault();
                link.closest('nav').querySelectorAll('a').forEach((item) => item.classList.toggle('active', item === link));
                document.querySelector(link.getAttribute('href'))?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
    });

    renderDemoRoster();
    renderAdminDemo();
});

function signInToDemo(event) {
    event.preventDefault();
    const email = document.getElementById('demoEmail').value.trim().toLowerCase();
    const password = document.getElementById('demoPassword').value;
    const account = demoAccounts.find((item) => item.email === email && item.password === password);
    const message = document.getElementById('demoLoginMessage');

    if (!account) {
        message.textContent = 'Those demo credentials did not match. Choose a sample account above and try again.';
        message.hidden = false;
        return;
    }

    currentDemoUser = account;
    document.getElementById('demoLoginScreen').hidden = true;
    document.getElementById('demoExperience').hidden = false;
    document.getElementById('demoViewSwitch').hidden = true;
    document.getElementById('demoSignOut').hidden = false;
    const badge = document.getElementById('demoSessionBadge');
    badge.textContent = `${account.name} demo session`;
    badge.hidden = false;
    setText('demoWorkspaceIntro', account.workspace === 'admin'
        ? 'Use the role selector to preview how permissions change. Sign out to try the Student demo account.'
        : 'Explore fictional attendance, results, and classes. Sign out to try the Principal / Admin demo account.');

    document.querySelectorAll('[data-demo-tab]').forEach((button) => {
        button.hidden = button.dataset.demoTab !== account.workspace;
    });
    setDemoView(account.workspace);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function signOutOfDemo() {
    currentDemoUser = null;
    document.getElementById('demoExperience').hidden = true;
    document.getElementById('demoLoginScreen').hidden = false;
    document.getElementById('demoViewSwitch').hidden = false;
    document.getElementById('demoSignOut').hidden = true;
    document.getElementById('demoSessionBadge').hidden = true;
    document.getElementById('demoLoginForm').reset();
    document.getElementById('demoLoginMessage').hidden = true;
    document.getElementById('demoRosterSearch').value = '';
    document.getElementById('demoDelegation').checked = false;
    document.getElementById('demoRoleSelect').value = 'principal';
    currentDemoRole = 'principal';
    demoStudents = demoStudentSeed.map((student) => ({ ...student }));
    renderAdminDemo();
    document.querySelectorAll('[data-demo-tab]').forEach((button) => { button.hidden = false; });
    setDemoView('student');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setDemoView(view) {
    if (currentDemoUser && currentDemoUser.workspace !== view) return;
    document.querySelectorAll('[data-demo-tab]').forEach((button) => {
        const active = button.dataset.demoTab === view;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('[data-demo-panel]').forEach((panel) => {
        panel.hidden = panel.dataset.demoPanel !== view;
    });
    const route = view === 'student' ? 'student.portal / overview' : 'admin.portal / overview';
    setText('demoBrowserTitle', route);
}

function renderAdminDemo() {
    const profile = adminRoleProfiles[currentDemoRole] || adminRoleProfiles.principal;
    const delegated = currentDemoRole === 'vice_principal' && document.getElementById('demoDelegation')?.checked;
    const canManageStaff = profile.staffAccess || delegated;

    setText('demoAdminRoleName', profile.name);
    setText('adminDemoTitle', profile.title);
    setText('adminDemoDescription', profile.description);
    setText('demoRoleExplainer', profile.explanation);
    setText('demoRosterScope', profile.scope);
    setText('demoRosterTitle', profile.chairman ? 'Institutional snapshot' : profile.managesStudents ? 'Student records' : 'Student roster');
    document.getElementById('demoDelegationControl').hidden = currentDemoRole !== 'vice_principal';
    document.getElementById('demoStaffAccess').hidden = !canManageStaff;
    document.getElementById('chairmanReportOnly').hidden = !profile.chairman;
    document.getElementById('demoRosterDetail').hidden = profile.chairman;

    const addedStudents = demoStudents.filter((student) => student.demoAdded && (!profile.branch || student.branch === profile.branch));
    const allocatedSeedRolls = demoStudents.filter((student) => student.demoSeedPending && student.roll && (!profile.branch || student.branch === profile.branch)).length;
    const countValues = [
        Number(profile.counts[0].replaceAll(',', '')) + addedStudents.length,
        Number(profile.counts[1].replaceAll(',', '')),
        Math.max(0, Number(profile.counts[2].replaceAll(',', '')) - allocatedSeedRolls) + addedStudents.filter((student) => !student.roll).length,
        Number(profile.counts[3].replaceAll(',', '')) + addedStudents.filter((student) => student.access === 'Awaiting').length
    ].map((count) => count.toLocaleString('en-US'));

    document.querySelectorAll('[data-demo-count]').forEach((element) => {
        const index = { students: 0, linked: 1, rolls: 2, pending: 3 }[element.dataset.demoCount];
        element.textContent = countValues[index] || '—';
    });

    document.querySelectorAll('[data-admin-link="staff"]').forEach((element) => {
        element.hidden = !canManageStaff;
    });
    document.querySelectorAll('[data-admin-link="rolls"]').forEach((element) => {
        element.hidden = !profile.rolls;
    });
    document.querySelectorAll('[data-admin-action="enroll"], [data-admin-action="allocate"]').forEach((element) => {
        const allowed = element.dataset.adminAction === 'enroll' ? profile.managesStudents : profile.rolls;
        element.hidden = !allowed;
    });
    document.getElementById('demoStaffFooter').textContent = currentDemoRole === 'vice_principal' && delegated
        ? 'Delegated: may assign Registrar, HOD, and Faculty.'
        : 'Only approved staff roles are shown.';
    renderDemoRoster();
}

function renderDemoRoster() {
    const tbody = document.getElementById('demoRosterRows');
    if (!tbody) return;
    const search = document.getElementById('demoRosterSearch')?.value.trim().toLowerCase() || '';
    const profile = adminRoleProfiles[currentDemoRole] || adminRoleProfiles.principal;
    const rows = demoStudents.filter((student) => {
        const matchesBranch = !profile.branch || student.branch === profile.branch;
        const matchesSearch = !search || `${student.name} ${student.id} ${student.roll} ${student.branch}`.toLowerCase().includes(search);
        return matchesBranch && matchesSearch;
    });
    tbody.replaceChildren();
    if (!rows.length) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 5;
        cell.className = 'demo-empty-cell';
        cell.textContent = 'No fictional student rows match your search.';
        row.append(cell);
        tbody.append(row);
        return;
    }
    rows.forEach((student) => {
        const row = document.createElement('tr');
        const name = createCell(student.name, 'student-name-cell');
        const id = createCell(student.id, 'demo-code-cell');
        const roll = createCell(student.roll || 'Not allocated', student.roll ? 'demo-code-cell' : 'demo-pending-cell');
        const branch = createCell(student.branch);
        const access = createCell(student.access);
        if (student.access === 'Linked') access.classList.add('demo-access-linked');
        else access.classList.add('demo-access-pending');
        row.append(name, id, roll, branch, access);
        tbody.append(row);
    });
}

function openDemoEnrollDialog() {
    const profile = adminRoleProfiles[currentDemoRole] || adminRoleProfiles.principal;
    if (!profile.managesStudents) {
        showDemoToast('This demo role cannot enroll students.');
        return;
    }
    const form = document.getElementById('demoEnrollForm');
    form.reset();
    document.getElementById('demoEnrollError').hidden = true;
    const branchSelect = document.getElementById('demoStudentBranch');
    Array.from(branchSelect.options).forEach((option) => {
        option.disabled = Boolean(profile.branch && option.value !== profile.branch);
    });
    branchSelect.value = profile.branch || 'CSE';
    updateRegistrationPreview();
    document.getElementById('demoEnrollDialog').showModal();
    document.getElementById('demoStudentName').focus();
}

function updateRegistrationPreview() {
    const year = document.getElementById('demoStudentYear')?.value || '2026';
    const branch = document.getElementById('demoStudentBranch')?.value || 'CSE';
    const number = Number(document.getElementById('demoStudentNumber')?.value || 0);
    setText('demoRegistrationPreview', `${year}${branch}${String(number).padStart(3, '0')}`);
}

function addDemoStudent(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const name = document.getElementById('demoStudentName').value.trim();
    const year = document.getElementById('demoStudentYear').value;
    const branch = document.getElementById('demoStudentBranch').value;
    const number = Number(document.getElementById('demoStudentNumber').value);
    const id = `${year}${branch}${String(number).padStart(3, '0')}`;
    const profile = adminRoleProfiles[currentDemoRole] || adminRoleProfiles.principal;
    const error = document.getElementById('demoEnrollError');

    if (profile.branch && branch !== profile.branch) {
        error.textContent = `This role can add students to ${profile.branch} only.`;
        error.hidden = false;
        return;
    }
    if (demoStudents.some((student) => student.id === id)) {
        error.textContent = `${id} is already in the fictional roster. Choose another student number.`;
        error.hidden = false;
        return;
    }

    demoStudents.unshift({ name, id, roll: '', branch, access: 'Awaiting', demoAdded: true });
    document.getElementById('demoRosterSearch').value = '';
    document.getElementById('demoEnrollDialog').close();
    renderAdminDemo();
    showDemoToast(`${name} was added to this temporary demo roster.`);
}

function allocateDemoRolls() {
    const profile = adminRoleProfiles[currentDemoRole] || adminRoleProfiles.principal;
    if (!profile.rolls) {
        showDemoToast('This demo role cannot allocate rolls.');
        return;
    }
    const waiting = demoStudents.filter((student) => !student.roll && (!profile.branch || student.branch === profile.branch));
    if (!waiting.length) {
        showDemoToast('All visible sample students already have a roll number.');
        return;
    }
    waiting.forEach((student) => { student.roll = makeDemoRoll(student.id); });
    renderAdminDemo();
    showDemoToast(`${waiting.length} sample roll number${waiting.length === 1 ? '' : 's'} allocated. Sign out to reset the demo.`);
}

function makeDemoRoll(registrationId) {
    const match = registrationId.match(/^(\d{4})([A-Z]+)(\d{1,3})$/);
    if (!match) return `26A05DEMO${String(demoStudents.length).padStart(4, '0')}`;
    const [, year, branch, number] = match;
    return `${year.slice(-2)}A05${branch}${number.padStart(4, '0')}`;
}

function canSeeDemoLink(section) {
    const profile = adminRoleProfiles[currentDemoRole] || adminRoleProfiles.principal;
    if (section === 'staff') return profile.staffAccess || (currentDemoRole === 'vice_principal' && document.getElementById('demoDelegation')?.checked);
    if (section === 'rolls') return profile.rolls;
    return true;
}

function createCell(value, className = '') {
    const cell = document.createElement('td');
    cell.textContent = value;
    if (className) cell.className = className;
    return cell;
}

function showDemoToast(message) {
    const toast = document.getElementById('demoToast');
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { toast.hidden = true; }, 3000);
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = String(value ?? '');
}
