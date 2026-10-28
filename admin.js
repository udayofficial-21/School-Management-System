import { isSupabaseConfigured, supabase } from './supabase-client.js';

const ROLE_LABELS = {
    super_admin: 'Super Admin',
    chairman: 'Chairman',
    principal: 'Principal',
    vice_principal: 'Vice Principal',
    registrar: 'Registrar / College Admin',
    hod: 'Head of Department',
    faculty: 'Faculty'
};

const CAN_MANAGE_STUDENTS = new Set([
    'super_admin', 'principal', 'vice_principal', 'registrar', 'hod'
]);

let activeRole = null;
let activeUser = null;
let activeBranchCode = null;
let canManageStaffRoles = false;
let studentRecords = [];
let schoolSettings = null;
let studentSearchTimer = null;
let rollSearchTimer = null;

document.addEventListener('DOMContentLoaded', () => {
    initializeAdmin().catch((error) => {
        console.error('The administration portal could not start.', error);
        showNotice('The administration portal could not start. Refresh the page or contact the Super Admin.', 'danger');
    });
});

async function initializeAdmin() {
    if (!isSupabaseConfigured) {
        showNotice('Add the Supabase Project URL and publishable key before using the administration portal.', 'warning');
        return;
    }

    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) {
        window.location.replace('index.html');
        return;
    }

    activeUser = data.session.user;
    const { data: roleRow, error: roleError } = await supabase
        .from('user_roles')
        .select('role_name, branch_code, can_manage_staff')
        .eq('user_id', activeUser.id)
        .maybeSingle();

    if (roleError) {
        console.error('Could not read staff role.', roleError);
        showNotice('The staff role tables are not ready. Run the latest supabase/schema.sql in your Supabase SQL Editor.', 'warning');
        return;
    }
    if (!roleRow) {
        window.location.replace('dashboard.html');
        return;
    }

    activeRole = roleRow.role_name;
    activeBranchCode = roleRow.branch_code;
    document.getElementById('staffEmail')?.replaceChildren(document.createTextNode(activeUser.email || 'Staff account'));
    const roleLabel = ROLE_LABELS[activeRole] || 'School staff';
    const roleScope = ['hod', 'faculty'].includes(activeRole) && roleRow.branch_code ? ` · ${roleRow.branch_code}` : '';
    const roleElement = document.getElementById('staffRole');
    if (roleElement) roleElement.textContent = `${roleLabel}${roleScope}`;

    const isSuperAdmin = activeRole === 'super_admin';
    const canManage = CAN_MANAGE_STUDENTS.has(activeRole);
    canManageStaffRoles = isSuperAdmin || activeRole === 'principal'
        || (activeRole === 'vice_principal' && roleRow.can_manage_staff === true);
    document.querySelectorAll('[data-super-admin-only]').forEach((element) => {
        element.hidden = !isSuperAdmin;
    });
    document.querySelectorAll('[data-can-manage]').forEach((element) => {
        element.hidden = !canManage;
    });
    document.querySelectorAll('[data-can-manage-staff]').forEach((element) => {
        element.hidden = !canManageStaffRoles;
    });
    document.querySelectorAll('[data-student-nav]').forEach((element) => {
        element.hidden = activeRole === 'chairman';
    });
    document.querySelectorAll('[data-roll-nav]').forEach((element) => {
        element.hidden = !canManage;
    });
    document.querySelectorAll('[data-faculty-only]').forEach((element) => {
        element.hidden = activeRole !== 'faculty';
    });
    document.querySelectorAll('[data-chairman-only]').forEach((element) => {
        element.hidden = activeRole !== 'chairman';
    });
    initializeLogout();

    const page = document.body.dataset.adminPage;
    if (page === 'roles' && !canManageStaffRoles) {
        window.location.replace('admin.html');
        return;
    }
    if (page === 'students' && activeRole === 'chairman') {
        window.location.replace('admin.html');
        return;
    }
    if (page === 'rolls' && !canManage) {
        window.location.replace('admin.html');
        return;
    }

    if (page === 'dashboard') await initializeDashboard(activeRole, isSuperAdmin);
    if (page === 'students') initializeStudentRecords(canManage);
    if (page === 'rolls') await initializeRollAllocation(canManage);
    if (page === 'roles') initializeStaffRoles();
}

function initializeLogout() {
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        const button = document.getElementById('logoutBtn');
        button.disabled = true;
        const { error } = await supabase.auth.signOut();
        if (error) {
            button.disabled = false;
            showNotice('We could not sign you out. Please try again.', 'danger');
            return;
        }
        window.location.assign('index.html');
    });
}

async function initializeDashboard(role, isSuperAdmin) {
    const dashboardCopy = {
        super_admin: ['System overview', 'Manage platform setup, school access, and enrollment operations.', 'You have full system access. Use staff access carefully and keep at least two trusted Super Admins.'],
        chairman: ['Chairman overview', 'College-wide enrollment and student-access reports at a glance.', 'This view contains summary information only. Contact the Principal for student record changes.'],
        principal: ['Principal overview', 'Coordinate student operations and staff access across the college.', 'You can manage college-wide student records and assign approved lower-level staff roles.'],
        vice_principal: ['Vice Principal overview', 'Coordinate daily student operations and delegated staff work.', canManageStaffRoles ? 'You have delegated permission to manage Registrar, HOD, and Faculty access.' : 'You can manage college-wide student records. Staff access is managed by the Principal.'],
        registrar: ['Registrar workspace', 'Manage admissions, student profiles, registration IDs, and roll allocation.', 'Student record changes are protected by the role and school-wide access rules.'],
        hod: ['Department overview', 'Manage enrollment and roll allocation for your assigned department.', 'Your student access is limited to the assigned branch.'],
        faculty: ['Faculty overview', 'Review the student roster for your assigned department.', 'Your access is read-only and limited to the assigned branch.']
    }[role] || ['School overview', 'View current school enrollment summaries.', 'Your access is limited to the permissions assigned to your role.'];
    setText('dashboardTitle', dashboardCopy[0]);
    setText('dashboardSubtitle', dashboardCopy[1]);
    setText('permissionNoteText', dashboardCopy[2]);

    const { data, error } = await supabase.rpc('admin_dashboard_summary');
    if (error) {
        showNotice(friendlyError(error), 'danger');
    } else {
        const summary = Array.isArray(data) ? data[0] : data;
        setText('totalStudentsCount', formatCount(summary?.total_students));
        setText('linkedAccountsCount', formatCount(summary?.linked_accounts));
        setText('pendingRollCount', formatCount(summary?.pending_rolls));
        setText('pendingRegistrationCount', formatCount(summary?.pending_registrations));
    }

    if (isSuperAdmin) {
        await loadSchoolSettings(true);
        initializeSchoolSettingsForm();
    }
}

async function loadSchoolSettings(showMessage = false) {
    const { data, error } = await supabase.rpc('admin_get_settings');
    if (error) {
        if (showMessage) showNotice(friendlyError(error), 'danger');
        return null;
    }
    schoolSettings = Array.isArray(data) ? (data[0] || null) : data;
    return schoolSettings;
}

function initializeSchoolSettingsForm() {
    const form = document.getElementById('schoolSettingsForm');
    if (!form) return;
    const name = document.getElementById('schoolName');
    const collegeCode = document.getElementById('collegeCode');
    const format = document.getElementById('rollNumberFormat');
    if (name) name.value = schoolSettings?.school_name || 'School Management System';
    if (collegeCode) collegeCode.value = schoolSettings?.college_code || '';
    if (format) format.value = schoolSettings?.roll_number_format || '{YY}{COLLEGE}{BRANCH}{NUMBER}';

    form.addEventListener('input', updateRollPreview);
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = document.getElementById('saveSchoolSettings');
        setButtonBusy(button, true, 'Saving…');
        const { error } = await supabase.rpc('admin_save_settings', {
            p_school_name: name.value.trim(),
            p_college_code: collegeCode.value.trim().toUpperCase(),
            p_roll_number_format: format.value.trim().toUpperCase()
        });
        setButtonBusy(button, false);
        if (error) {
            showNotice(friendlyError(error), 'danger');
            return;
        }
        schoolSettings = {
            school_name: name.value.trim(),
            college_code: collegeCode.value.trim().toUpperCase(),
            roll_number_format: format.value.trim().toUpperCase()
        };
        showNotice('School and roll-number settings saved.', 'success');
        updateRollPreview();
    });
    updateRollPreview();
}

function updateRollPreview() {
    const collegeCode = document.getElementById('collegeCode')?.value.trim().toUpperCase() || 'A05';
    const template = document.getElementById('rollNumberFormat')?.value.trim().toUpperCase() || '{YY}{COLLEGE}{BRANCH}{NUMBER}';
    setText('rollFormatPreview', renderRollFormat(template, 2023, collegeCode, 'CSE', 1));
}

function renderRollFormat(template, year, collegeCode, branchCode, sequence) {
    return String(template || '')
        .replaceAll('{YEAR}', String(year))
        .replaceAll('{YY}', String(year).slice(-2))
        .replaceAll('{COLLEGE}', String(collegeCode || 'A05').toUpperCase())
        .replaceAll('{BRANCH}', String(branchCode || 'CSE').toUpperCase())
        .replaceAll('{NUMBER}', String(sequence).padStart(4, '0'));
}

function initializeStudentRecords(canManage) {
    const form = document.getElementById('studentForm');
    const search = document.getElementById('studentSearch');
    const rows = document.getElementById('studentRows');
    if (activeRole === 'faculty') {
        setText('studentsPageTitle', 'Department student roster');
        setText('studentsPageSubtitle', 'Review registration and roll status for students in your assigned branch.');
        const branch = document.getElementById('facultyRosterNote');
        if (branch) branch.textContent = `Read-only branch roster${activeBranchCode ? ` · ${activeBranchCode}` : ''}. Personal contact details are hidden.`;
        if (search) search.placeholder = 'Search name, registration ID, or roll';
    } else if (activeRole === 'hod') {
        setText('studentsPageTitle', 'Department student records');
        setText('studentsPageSubtitle', 'Enroll and maintain student records within your assigned branch.');
    } else if (activeRole === 'registrar') {
        setText('studentsPageTitle', 'Admissions and student records');
        setText('studentsPageSubtitle', 'Maintain the approved student roster for the college.');
    }
    if (canManage) {
        setValue('admissionYear', new Date().getFullYear());
        updateRegistrationPreview();
        form?.addEventListener('submit', submitStudentForm);
        document.getElementById('cancelStudentEdit')?.addEventListener('click', resetStudentForm);
    }
    document.getElementById('refreshStudents')?.addEventListener('click', () => loadStudents());
    search?.addEventListener('input', () => {
        clearTimeout(studentSearchTimer);
        studentSearchTimer = setTimeout(() => loadStudents(search.value.trim()), 250);
    });
    rows?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-edit-student]');
        if (button && canManage) startStudentEdit(button.dataset.editStudent);
    });
    ['admissionYear', 'branchCode'].forEach((id) => {
        document.getElementById(id)?.addEventListener('input', updateRegistrationPreview);
    });
    loadStudents();
}

async function loadStudents(searchTerm = '') {
    const tbody = document.getElementById('studentRows');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-5">Loading student records…</td></tr>';
    const { data, error } = await supabase.rpc('admin_list_students', {
        p_pending_roll_only: false,
        p_search: searchTerm || null
    });
    if (error) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-5">Student records could not be loaded.</td></tr>';
        showNotice(friendlyError(error), 'danger');
        return;
    }
    studentRecords = data || [];
    if (!studentRecords.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-5">No student records match this search.</td></tr>';
        return;
    }

    const canManage = CAN_MANAGE_STUDENTS.has(activeRole);
    tbody.innerHTML = studentRecords.map((student) => {
        const isLinked = student.account_linked ?? Boolean(student.user_id);
        const access = isLinked
            ? '<span class="status-badge status-ok"><i class="bi bi-check-circle-fill"></i>Linked</span>'
            : '<span class="status-badge status-pending"><i class="bi bi-envelope"></i>Awaiting registration</span>';
        const roll = student.roll_number
            ? `<span class="code-badge">${escapeHtml(student.roll_number)}</span>`
            : '<span class="status-badge status-muted">Not allocated</span>';
        const action = canManage
            ? `<td><button type="button" class="btn btn-light" data-edit-student="${escapeHtml(student.id)}"><i class="bi bi-pencil-square me-1"></i>Edit</button></td>`
            : '';
        const email = student.school_email || (activeRole === 'faculty' ? 'Private to school leadership' : '—');
        const branch = [student.branch_code, student.branch].filter(Boolean).map(escapeHtml).join(' · ') || 'Needs details';
        return `<tr>
            <td class="student-cell"><strong>${escapeHtml(student.full_name || 'Student')}</strong><small>${escapeHtml(email)}</small></td>
            <td><span class="code-badge">${escapeHtml(student.student_id || '—')}</span></td>
            <td>${roll}</td>
            <td>${escapeHtml(student.admission_year || '—')}<small class="d-block text-muted">Study year ${escapeHtml(student.study_year || '—')}</small></td>
            <td>${branch}</td><td>${access}</td>${action}
        </tr>`;
    }).join('');
}

async function submitStudentForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const profileId = document.getElementById('studentProfileId').value;
    const values = getStudentFormValues();
    const button = document.getElementById('saveStudentButton');
    setButtonBusy(button, true, profileId ? 'Saving…' : 'Adding…');

    const { data, error } = profileId
        ? await supabase.rpc('admin_update_student', { p_student_profile_id: profileId, ...values })
        : await supabase.rpc('admin_create_student', values);

    setButtonBusy(button, false);
    if (error) {
        showNotice(friendlyError(error), 'danger');
        return;
    }

    const generatedId = profileId ? data : (Array.isArray(data) ? data[0]?.student_id : data?.student_id);
    showNotice(profileId
        ? `Student details saved. Registration ID: ${generatedId || 'unchanged'}.`
        : `Student added to the approved roster. Registration ID: ${generatedId || 'created'}.`, 'success');
    resetStudentForm();
    await loadStudents(document.getElementById('studentSearch')?.value.trim() || '');
}

function getStudentFormValues() {
    const numberOrNull = (id) => document.getElementById(id)?.value ? Number(document.getElementById(id).value) : null;
    return {
        p_full_name: document.getElementById('studentFullName').value.trim(),
        p_school_email: document.getElementById('studentEmail').value.trim().toLowerCase(),
        p_admission_year: numberOrNull('admissionYear'),
        p_study_year: numberOrNull('studyYear'),
        p_branch: document.getElementById('branchName').value.trim(),
        p_branch_code: document.getElementById('branchCode').value.trim().toUpperCase(),
        p_college: document.getElementById('studentCollege').value.trim() || null,
        p_date_of_birth: document.getElementById('studentDob').value || null,
        p_phone: document.getElementById('studentPhone').value.trim() || null
    };
}

function startStudentEdit(profileId) {
    const student = studentRecords.find((item) => item.id === profileId);
    if (!student) return;
    setValue('studentProfileId', student.id);
    setValue('studentFullName', student.full_name);
    setValue('studentEmail', student.school_email);
    setValue('admissionYear', student.admission_year);
    setValue('studyYear', student.study_year);
    setValue('branchName', student.branch);
    setValue('branchCode', student.branch_code);
    setValue('studentCollege', student.college);
    setValue('studentDob', student.date_of_birth);
    setValue('studentPhone', student.phone);
    const identityLocked = Boolean((student.account_linked ?? student.user_id) || student.roll_number);
    ['admissionYear', 'studyYear', 'branchName', 'branchCode'].forEach((id) => {
        const element = document.getElementById(id);
        if (element) element.disabled = identityLocked;
    });
    const email = document.getElementById('studentEmail');
    if (email) email.disabled = Boolean(student.user_id);
    setText('studentFormEyebrow', 'ROSTER UPDATE');
    setText('studentFormTitle', 'Edit student details');
    const button = document.getElementById('saveStudentButton');
    if (button) button.innerHTML = '<i class="bi bi-check2-circle me-2"></i>Save student details';
    const cancel = document.getElementById('cancelStudentEdit');
    if (cancel) cancel.hidden = false;
    updateRegistrationPreview(student.student_id);
    document.getElementById('studentFormPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetStudentForm() {
    const form = document.getElementById('studentForm');
    if (!form) return;
    form.reset();
    setValue('studentProfileId', '');
    const year = document.getElementById('admissionYear');
    if (year) { year.disabled = false; year.value = String(new Date().getFullYear()); }
    ['studyYear', 'branchName', 'branchCode'].forEach((id) => {
        const element = document.getElementById(id);
        if (element) element.disabled = false;
    });
    const email = document.getElementById('studentEmail');
    if (email) email.disabled = false;
    setText('studentFormEyebrow', 'NEW ROSTER ENTRY');
    setText('studentFormTitle', 'Enroll a student');
    const button = document.getElementById('saveStudentButton');
    if (button) button.innerHTML = '<i class="bi bi-person-plus me-2"></i>Add to approved roster';
    const cancel = document.getElementById('cancelStudentEdit');
    if (cancel) cancel.hidden = true;
    updateRegistrationPreview();
}

function updateRegistrationPreview(existingId) {
    const year = document.getElementById('admissionYear')?.value || String(new Date().getFullYear());
    const branch = document.getElementById('branchCode')?.value.trim().toUpperCase() || 'BRANCH';
    setText('registrationIdPreview', existingId || `${year}${branch}###`);
}

async function initializeRollAllocation(canManage) {
    schoolSettings = await loadSchoolSettings(true);
    setText('rollCollegeCode', schoolSettings?.college_code || 'Set by Super Admin');
    setText('rollFormat', schoolSettings?.roll_number_format || '{YY}{COLLEGE}{BRANCH}{NUMBER}');
    const search = document.getElementById('rollSearch');
    search?.addEventListener('input', () => {
        clearTimeout(rollSearchTimer);
        rollSearchTimer = setTimeout(() => loadPendingRolls(search.value.trim(), canManage), 250);
    });
    document.getElementById('refreshRolls')?.addEventListener('click', () => loadPendingRolls('', canManage));
    document.getElementById('selectAllRolls')?.addEventListener('change', (event) => {
        document.querySelectorAll('[data-roll-student]:not(:disabled)').forEach((checkbox) => {
            checkbox.checked = event.currentTarget.checked;
        });
    });
    document.getElementById('rollRows')?.addEventListener('change', (event) => {
        if (event.target.matches('[data-roll-student]')) updateSelectAllState();
    });
    document.getElementById('allocateSelected')?.addEventListener('click', () => allocateSelectedRolls(canManage));
    await loadPendingRolls('', canManage);
}

async function loadPendingRolls(searchTerm = '', canManage) {
    const tbody = document.getElementById('rollRows');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-5">Loading unallocated students…</td></tr>';
    const { data, error } = await supabase.rpc('admin_list_students', {
        p_pending_roll_only: true,
        p_search: searchTerm || null
    });
    if (error) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-5">Roll list could not be loaded.</td></tr>';
        showNotice(friendlyError(error), 'danger');
        return;
    }
    const students = data || [];
    if (!students.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-5">All visible students have a roll number.</td></tr>';
        updateSelectAllState();
        return;
    }
    tbody.innerHTML = students.map((student) => {
        const eligible = Boolean(student.admission_year && student.branch_code);
        const checkbox = canManage
            ? `<td><input class="form-check-input" type="checkbox" data-roll-student="${escapeHtml(student.id)}" aria-label="Select ${escapeHtml(student.full_name)}" ${eligible ? '' : 'disabled'}></td>`
            : '';
        const branch = [student.branch_code, student.branch].filter(Boolean).map(escapeHtml).join(' · ') || 'Branch code needed';
        const status = eligible
            ? '<span class="status-badge status-pending"><i class="bi bi-hourglass-split"></i>Ready to allocate</span>'
            : '<span class="status-badge status-muted">Year or branch needed</span>';
        return `<tr>${checkbox}<td class="student-cell"><strong>${escapeHtml(student.full_name || 'Student')}</strong><small>${escapeHtml(student.school_email || '')}</small></td><td><span class="code-badge">${escapeHtml(student.student_id || '—')}</span></td><td>${escapeHtml(student.admission_year || '—')}</td><td>${branch}</td><td>${status}</td></tr>`;
    }).join('');
    updateSelectAllState();
}

async function allocateSelectedRolls(canManage) {
    if (!canManage) return;
    if (!schoolSettings?.college_code) {
        showNotice('The Super Admin must set the college code and roll format on the Administration overview first.', 'warning');
        return;
    }
    const ids = [...document.querySelectorAll('[data-roll-student]:checked')].map((checkbox) => checkbox.dataset.rollStudent);
    if (!ids.length) {
        showNotice('Select at least one eligible student.', 'warning');
        return;
    }

    const button = document.getElementById('allocateSelected');
    setButtonBusy(button, true, 'Allocating…');
    let allocated = 0;
    const errors = [];
    for (const id of ids) {
        const { error } = await supabase.rpc('admin_allocate_student_roll', { p_student_profile_id: id });
        if (error) errors.push(friendlyError(error));
        else allocated += 1;
    }
    setButtonBusy(button, false);
    if (errors.length) {
        showNotice(`${allocated} roll number(s) allocated. ${errors[0]}`, allocated ? 'warning' : 'danger');
    } else {
        showNotice(`${allocated} unique roll number(s) allocated successfully.`, 'success');
    }
    await loadPendingRolls(document.getElementById('rollSearch')?.value.trim() || '', canManage);
}

function updateSelectAllState() {
    const selectAll = document.getElementById('selectAllRolls');
    if (!selectAll) return;
    const boxes = [...document.querySelectorAll('[data-roll-student]:not(:disabled)')];
    selectAll.checked = boxes.length > 0 && boxes.every((checkbox) => checkbox.checked);
    selectAll.indeterminate = boxes.some((checkbox) => checkbox.checked) && !selectAll.checked;
}

function initializeStaffRoles() {
    const form = document.getElementById('staffRoleForm');
    const roleSelect = document.getElementById('staffRoleSelect');
    const branchField = document.getElementById('staffBranchField');
    const branchInput = document.getElementById('staffBranchCode');
    const delegationField = document.getElementById('vicePrincipalDelegation');
    const canDelegateStaffAccess = activeRole === 'super_admin' || activeRole === 'principal';

    setText('staffAccessTitle', activeRole === 'super_admin' ? 'System staff access' : 'Manage staff access');
    setText('staffAccessDescription', activeRole === 'super_admin'
        ? 'Assign school leadership and staff roles. Keep system ownership limited to trusted Super Admins.'
        : activeRole === 'principal'
            ? 'Manage Vice Principal, Registrar, HOD, and Faculty roles. Super Admin access remains protected.'
            : 'Manage Registrar, HOD, and Faculty roles within the authority delegated by the Principal.');

    roleSelect?.querySelectorAll('option[data-assignable-by]').forEach((option) => {
        option.hidden = !option.dataset.assignableBy.split(',').includes(activeRole);
    });
    const updateRoleFields = () => {
        const branchRequired = ['hod', 'faculty'].includes(roleSelect?.value);
        if (branchField) branchField.hidden = !branchRequired;
        if (branchInput) branchInput.required = branchRequired;
        if (delegationField) delegationField.hidden = !(canDelegateStaffAccess && roleSelect?.value === 'vice_principal');
    };
    roleSelect?.addEventListener('change', updateRoleFields);
    updateRoleFields();
    form?.addEventListener('submit', submitStaffRole);
    document.getElementById('staffRows')?.addEventListener('click', removeStaffRole);
    document.getElementById('pendingStaffRows')?.addEventListener('click', cancelStaffInvite);
    loadStaffRoles();
}

async function loadStaffRoles() {
    const activeBody = document.getElementById('staffRows');
    const pendingBody = document.getElementById('pendingStaffRows');
    const [activeResult, pendingResult] = await Promise.all([
        supabase.rpc('admin_list_staff'),
        supabase.rpc('admin_list_pending_staff_invites')
    ]);
    if (activeResult.error || pendingResult.error) {
        showNotice(friendlyError(activeResult.error || pendingResult.error), 'danger');
        if (activeBody) activeBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-5">Staff roles could not be loaded.</td></tr>';
        return;
    }
    const staff = activeResult.data || [];
    const pending = pendingResult.data || [];
    if (activeBody) {
        activeBody.innerHTML = staff.length ? staff.map((member) => `
            <tr><td class="student-cell"><strong>${escapeHtml(member.display_name || member.email)}</strong><small>${escapeHtml(member.email)}</small></td>
            <td><span class="role-pill ${roleClass(member.role_name)}">${escapeHtml(ROLE_LABELS[member.role_name] || member.role_name)}</span>${member.can_manage_staff ? '<small class="d-block text-muted mt-1">Staff access delegated</small>' : ''}</td>
            <td>${escapeHtml(member.branch_code || 'All school')}</td>
            <td>${escapeHtml(formatDate(member.assigned_at))}</td>
            <td><button type="button" class="btn btn-outline-danger" data-remove-role="${escapeHtml(member.user_id)}" data-member-name="${escapeHtml(member.display_name || member.email)}"><i class="bi bi-person-dash me-1"></i>Remove role</button></td></tr>`).join('')
            : '<tr><td colspan="5" class="text-center text-muted py-5">No staff roles are assigned yet.</td></tr>';
    }
    if (pendingBody) {
        pendingBody.innerHTML = pending.length ? pending.map((invite) => `
            <tr><td>${escapeHtml(invite.email)}</td><td><span class="role-pill ${roleClass(invite.role_name)}">${escapeHtml(ROLE_LABELS[invite.role_name] || invite.role_name)}</span>${invite.can_manage_staff ? '<small class="d-block text-muted mt-1">Staff access delegated</small>' : ''}</td>
            <td>${escapeHtml(invite.branch_code || 'All school')}</td><td>${escapeHtml(formatDate(invite.created_at))}</td>
            <td><button type="button" class="btn btn-light" data-cancel-invite="${escapeHtml(invite.email)}"><i class="bi bi-x-circle me-1"></i>Cancel</button></td></tr>`).join('')
            : '<tr><td colspan="5" class="text-center text-muted py-4">No pending invitations.</td></tr>';
    }
}

async function submitStaffRole(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const email = document.getElementById('staffTargetEmail').value.trim().toLowerCase();
    const role = document.getElementById('staffRoleSelect').value;
    const branch = document.getElementById('staffBranchCode').value.trim().toUpperCase() || null;
    const canManageStaff = role === 'vice_principal' && document.getElementById('canManageStaff').checked;
    const button = document.getElementById('saveStaffRole');
    setButtonBusy(button, true, 'Saving…');
    const { data, error } = await supabase.rpc('admin_manage_staff', {
        p_email: email,
        p_role_name: role,
        p_branch_code: branch,
        p_can_manage_staff: canManageStaff
    });
    setButtonBusy(button, false);
    if (error) {
        showNotice(friendlyError(error), 'danger');
        return;
    }
    const result = Array.isArray(data) ? data[0] : data;
    const delegation = canManageStaff ? ' with delegated staff access' : '';
    if (result === 'invite_pending') {
        showNotice(`Role prepared for ${email}${delegation}. Next, send an invitation from Supabase Authentication → Users using this same email. The staff member confirms the account and sets their own password; never create or share a password for them.`, 'success');
    } else {
        showNotice(`The ${ROLE_LABELS[role]} role${delegation} is active for ${email}.`, 'success');
    }
    form.reset();
    document.getElementById('staffBranchField').hidden = true;
    document.getElementById('staffBranchCode').required = false;
    document.getElementById('vicePrincipalDelegation').hidden = true;
    await loadStaffRoles();
}

async function removeStaffRole(event) {
    const button = event.target.closest('[data-remove-role]');
    if (!button) return;
    const memberName = button.dataset.memberName || 'this staff member';
    if (!window.confirm(`Remove the school role from ${memberName}? Their authentication account will remain unchanged.`)) return;
    setButtonBusy(button, true, 'Removing…');
    const { error } = await supabase.rpc('admin_remove_staff_role', { p_user_id: button.dataset.removeRole });
    if (error) {
        setButtonBusy(button, false);
        showNotice(friendlyError(error), 'danger');
        return;
    }
    showNotice('Staff role removed.', 'success');
    await loadStaffRoles();
}

async function cancelStaffInvite(event) {
    const button = event.target.closest('[data-cancel-invite]');
    if (!button) return;
    if (!window.confirm(`Cancel the prepared role invitation for ${button.dataset.cancelInvite}?`)) return;
    const { error } = await supabase.rpc('admin_cancel_staff_invite', { p_email: button.dataset.cancelInvite });
    if (error) {
        showNotice(friendlyError(error), 'danger');
        return;
    }
    showNotice('Pending role invitation cancelled.', 'success');
    await loadStaffRoles();
}

function roleClass(role) {
    if (role === 'super_admin') return 'role-super';
    if (['chairman', 'principal', 'vice_principal'].includes(role)) return 'role-leadership';
    if (role === 'registrar') return 'role-registrar';
    if (role === 'hod') return 'role-hod';
    return 'role-faculty';
}

function friendlyError(error) {
    const message = String(error?.message || 'Unexpected error.');
    const lower = message.toLowerCase();
    if (lower.includes('schema cache') || lower.includes('could not find the function') || lower.includes('does not exist')) {
        return 'The latest database setup is missing. Run the current supabase/schema.sql in the Supabase SQL Editor, then refresh this page.';
    }
    if (lower.includes('duplicate key') || error?.code === '23505') {
        return 'A student or staff record with this email or ID already exists.';
    }
    if (lower.includes('row-level security') || lower.includes('permission denied')) {
        return 'Your current role does not have permission for this action.';
    }
    return message;
}

function showNotice(message, type = 'info') {
    const notice = document.getElementById('adminNotice');
    if (!notice) return;
    notice.className = `alert alert-${type}`;
    notice.textContent = message;
    notice.hidden = false;
    notice.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function setButtonBusy(button, busy, label) {
    if (!button) return;
    if (busy) {
        button.dataset.originalLabel = button.innerHTML;
        button.disabled = true;
        button.innerHTML = `<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>${escapeHtml(label)}`;
    } else {
        button.disabled = false;
        if (button.dataset.originalLabel) {
            button.innerHTML = button.dataset.originalLabel;
            delete button.dataset.originalLabel;
        }
    }
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = String(value ?? '');
}

function setValue(id, value) {
    const element = document.getElementById(id);
    if (element) element.value = value ?? '';
}

function formatCount(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number.toLocaleString() : '0';
}

function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
}
