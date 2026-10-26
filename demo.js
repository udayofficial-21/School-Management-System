const demoStudents = [
    { name: 'Aarav Sample', id: '2024CSE042', roll: '24A05CSE0042', branch: 'CSE', access: 'Linked' },
    { name: 'Mira Example', id: '2024CSE043', roll: '24A05CSE0043', branch: 'CSE', access: 'Linked' },
    { name: 'Rohan Demo', id: '2024ECE018', roll: '24A05ECE0018', branch: 'ECE', access: 'Awaiting' },
    { name: 'Nila Sample', id: '2023CSE116', roll: '23A05CSE0116', branch: 'CSE', access: 'Linked' },
    { name: 'Dev Example', id: '2023ME042', roll: '23A05ME0042', branch: 'ME', access: 'Linked' }
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
let toastTimer = null;

document.addEventListener('DOMContentLoaded', () => {
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
    document.querySelectorAll('[data-admin-action], [data-demo-action]').forEach((button) => {
        button.addEventListener('click', (event) => {
            event.preventDefault();
            showDemoToast('Demo preview only — no real student or staff data was changed.');
        });
    });
    document.querySelectorAll('.demo-side-nav a[href^="#"]').forEach((link) => {
        link.addEventListener('click', (event) => {
            if (link.hasAttribute('data-admin-link') && !canSeeDemoLink(link.dataset.adminLink)) {
                event.preventDefault();
                showDemoToast('That section is outside the selected role’s permissions.');
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

function setDemoView(view) {
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

    document.querySelectorAll('[data-demo-count]').forEach((element) => {
        const index = { students: 0, linked: 1, rolls: 2, pending: 3 }[element.dataset.demoCount];
        element.textContent = profile.counts[index] || '—';
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
        const roll = createCell(student.roll, 'demo-code-cell');
        const branch = createCell(student.branch);
        const access = createCell(student.access);
        if (student.access === 'Linked') access.classList.add('demo-access-linked');
        else access.classList.add('demo-access-pending');
        row.append(name, id, roll, branch, access);
        tbody.append(row);
    });
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
