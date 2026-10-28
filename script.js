import { isSupabaseConfigured, supabase } from './supabase-client.js';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const ASSESSMENT_TYPES = [
    { key: 'midterm', label: 'Mid-Term' },
    { key: 'assignment', label: 'Assignment' },
    { key: 'final_exam', label: 'Final Exam' }
];

window.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-current-year]').forEach((element) => {
        element.textContent = String(new Date().getFullYear());
    });
    startApplication().catch((error) => {
        console.error('The portal could not start.', error);
        showPageAlert('The portal could not load. Refresh the page or contact the school administrator.', 'danger');
    });
});

async function startApplication() {
    const loginForm = document.getElementById('loginForm');
    const registrationForm = document.getElementById('registrationForm');
    const protectedPage = Boolean(document.getElementById('welcomeMessage'));

    if (!isSupabaseConfigured) {
        showConfigurationNotice(loginForm, registrationForm, protectedPage);
        return;
    }

    if (loginForm) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
            const destination = await getUserDestination(data.session.user.id);
            if (destination) {
                window.location.replace(destination);
                return;
            }
            await supabase.auth.signOut();
        }
        initializeLogin(loginForm);
        initializeAuthMethodSwitch();
        initializeEmailCodeSignIn();
        initializePasswordReset();
        return;
    }

    if (registrationForm) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
            const destination = await getUserDestination(data.session.user.id);
            if (destination) {
                window.location.replace(destination);
                return;
            }
            await supabase.auth.signOut();
        }
        initializeRegistration(registrationForm);
        return;
    }

    if (protectedPage) await initializePortalPage();
}

function showConfigurationNotice(loginForm, registrationForm, protectedPage) {
    const message = 'Connect your Supabase project first. Add its Project URL and publishable key in supabase-config.js.';
    const notice = document.getElementById('supabaseSetupNotice');
    if (notice) {
        notice.textContent = message;
        notice.classList.remove('d-none');
    } else if (loginForm || registrationForm) {
        const form = loginForm || registrationForm;
        showFormMessage(form.querySelector('[data-form-message]'), message, 'warning');
    } else if (protectedPage) {
        showPageAlert(message, 'warning');
    }

    document.querySelectorAll('form button[type="submit"]').forEach((button) => {
        button.disabled = true;
    });
}

function initializeLogin(form) {
    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('password');
    const feedback = document.getElementById('loginError');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        clearFormMessage(feedback);
        if (!emailInput.reportValidity()) return;
        setSubmitState(form, true, 'Signing in…');
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: emailInput.value.trim(),
                password: passwordInput.value
            });
            if (error) {
                showFormMessage(feedback, 'We could not sign you in. Check your school email and password, then try again.', 'danger');
                return;
            }
            const destination = await getUserDestination(data.user.id);
            if (!destination) {
                await supabase.auth.signOut();
                showFormMessage(feedback, 'This account is not linked to an enrolled student or staff role. Contact your school administrator.', 'danger');
                return;
            }
            window.location.assign(destination);
        } catch (error) {
            console.error('Could not check account access.', error);
            showFormMessage(feedback, 'We could not verify your school account. Ask the administrator to finish the database setup, then try again.', 'danger');
        } finally {
            setSubmitState(form, false);
        }
    });
}

function initializeAuthMethodSwitch() {
    const emailInput = document.getElementById('loginEmail');
    const panels = {
        password: document.getElementById('passwordPanel'),
        email: document.getElementById('emailPanel')
    };
    document.querySelectorAll('[data-auth-method]').forEach((button) => {
        button.addEventListener('click', () => {
            const selectedMethod = button.dataset.authMethod;
            Object.entries(panels).forEach(([method, panel]) => {
                if (panel) panel.hidden = method !== selectedMethod;
            });
            if (emailInput) emailInput.readOnly = selectedMethod === 'email' && !document.getElementById('emailCodeVerifyStage')?.hidden;
            document.querySelectorAll('[data-auth-method]').forEach((tab) => {
                const selected = tab.dataset.authMethod === selectedMethod;
                tab.classList.toggle('active', selected);
                tab.setAttribute('aria-selected', String(selected));
            });
        });
    });
}

function initializeEmailCodeSignIn() {
    const emailInput = document.getElementById('loginEmail');
    const sendButton = document.getElementById('sendEmailCodeBtn');
    const resendButton = document.getElementById('resendEmailCodeBtn');
    const verifyButton = document.getElementById('verifyEmailCodeBtn');
    const changeEmailButton = document.getElementById('changeEmailBtn');
    const requestStage = document.getElementById('emailCodeRequestStage');
    const verifyStage = document.getElementById('emailCodeVerifyStage');
    const codeInput = document.getElementById('emailCode');
    const codeHelp = document.getElementById('emailCodeHelp');
    const feedback = document.getElementById('emailCodeMessage');
    if (!sendButton || !verifyButton || !emailInput || !codeInput) return;
    let requestedEmail = '';

    const sendCode = async (button = sendButton) => {
        clearFormMessage(feedback);
        if (!emailInput.reportValidity()) return;
        setActionBusy(button, true, 'Sending code…');
        try {
            requestedEmail = emailInput.value.trim().toLowerCase();
            const { error } = await supabase.auth.signInWithOtp({
                email: requestedEmail,
                options: {
                    shouldCreateUser: false,
                    emailRedirectTo: new URL('index.html', window.location.href).toString()
                }
            });
            if (error) {
                showFormMessage(feedback, 'We could not send a sign-in email. Check the address and SMTP settings, or wait a minute before requesting another email.', 'danger');
                return;
            }
            requestStage.hidden = true;
            verifyStage.hidden = false;
            emailInput.readOnly = true;
            codeInput.disabled = false;
            codeHelp.textContent = `We sent a sign-in email to ${requestedEmail}. Enter its code below, or open its sign-in link if the email contains one.`;
            codeInput.focus();
            showFormMessage(feedback, 'If this email belongs to an active school account, a sign-in email is on its way. Enter its code here, or open its sign-in link if the email contains a link.', 'success');
        } catch (error) {
            console.error('Could not send a passwordless sign-in email.', error);
            showFormMessage(feedback, 'We could not send a sign-in email. Check your connection and try again.', 'danger');
        } finally {
            setActionBusy(button, false);
        }
    };

    sendButton.addEventListener('click', () => sendCode(sendButton));
    resendButton?.addEventListener('click', () => sendCode(resendButton));
    verifyButton.addEventListener('click', async () => {
        clearFormMessage(feedback);
        const email = requestedEmail;
        const token = codeInput.value.trim().replace(/\s+/g, '');
        if (!email || !emailInput.reportValidity()) return;
        if (!/^\d{6,8}$/.test(token)) {
            showFormMessage(feedback, 'Enter the one-time code from your email.', 'warning');
            codeInput.focus();
            return;
        }

        setActionBusy(verifyButton, true, 'Verifying…');
        try {
            const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
            if (error || !data.user) {
                showFormMessage(feedback, 'That code could not be verified. Check it and try again, or request a new code.', 'danger');
                return;
            }
            await routeSignedInUser(data.user.id, feedback);
        } catch (error) {
            console.error('Could not verify the email sign-in code.', error);
            showFormMessage(feedback, 'We could not verify the code. Check your connection and try again.', 'danger');
        } finally {
            setActionBusy(verifyButton, false);
        }
    });

    changeEmailButton?.addEventListener('click', () => {
        codeInput.value = '';
        codeInput.disabled = true;
        verifyStage.hidden = true;
        requestStage.hidden = false;
        emailInput.readOnly = false;
        clearFormMessage(feedback);
        emailInput.focus();
    });
}

function initializePasswordReset() {
    const button = document.getElementById('forgotPasswordBtn');
    const emailInput = document.getElementById('loginEmail');
    const feedback = document.getElementById('passwordResetMessage');
    if (!button || !emailInput) return;

    button.addEventListener('click', async () => {
        clearFormMessage(feedback);
        if (!emailInput.reportValidity()) return;
        setActionBusy(button, true, 'Sending…');
        try {
            const redirectTo = new URL('account-security.html', window.location.href).toString();
            const { error } = await supabase.auth.resetPasswordForEmail(emailInput.value.trim().toLowerCase(), { redirectTo });
            if (error) {
                showFormMessage(feedback, 'We could not send a password reset email. Check the address or ask the school administrator to check Supabase email settings.', 'danger');
                return;
            }
            showFormMessage(feedback, 'If this email has a school account, password reset instructions will arrive shortly.', 'success');
        } catch (error) {
            console.error('Could not request a password reset.', error);
            showFormMessage(feedback, 'We could not send a reset email. Check your connection and try again.', 'danger');
        } finally {
            setActionBusy(button, false);
        }
    });
}

async function getUserDestination(userId) {
    const { data: role, error: roleError } = await supabase
        .from('user_roles')
        .select('role_name')
        .eq('user_id', userId)
        .maybeSingle();
    if (roleError) throw roleError;
    if (role) return 'admin.html';

    const { data: profile, error: profileError } = await supabase
        .from('student_profiles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
    if (profileError) throw profileError;
    return profile ? 'dashboard.html' : null;
}

async function routeSignedInUser(userId, feedback) {
    try {
        const destination = await getUserDestination(userId);
        if (!destination) {
            await supabase.auth.signOut();
            showFormMessage(feedback, 'Your account is not linked to an enrolled student or staff role. Contact your school administrator.', 'danger');
            return;
        }
        window.location.assign(destination);
    } catch (error) {
        console.error('Could not check account access.', error);
        showFormMessage(feedback, 'Your account was created, but the school database setup is incomplete. Contact your school administrator.', 'warning');
    }
}

function initializeRegistration(form) {
    const passwordInput = document.getElementById('regPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const feedback = document.getElementById('registrationFeedback');
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        clearFormMessage(feedback);
        const studentId = document.getElementById('regStudentId').value.trim();
        const email = document.getElementById('schoolEmail').value.trim().toLowerCase();
        const password = passwordInput.value;

        if (password !== confirmPasswordInput.value) {
            showFormMessage(feedback, 'The passwords do not match.', 'danger');
            confirmPasswordInput.focus();
            return;
        }

        setSubmitState(form, true, 'Creating account…');
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { student_id: studentId },
                    emailRedirectTo: new URL('index.html', window.location.href).toString()
                }
            });

            if (error) {
                const errorMessage = error.message?.toLowerCase() || '';
                const rosterMessage = errorMessage.includes('roster entry') || errorMessage.includes('student id and school email');
                showFormMessage(
                    feedback,
                    rosterMessage
                        ? 'We could not match that Student ID and school email to the school roster. Contact the school administrator.'
                        : 'We could not create the account. Check your details or contact the school administrator.',
                    'danger'
                );
                return;
            }

            form.reset();
            if (data.session) {
                showFormMessage(feedback, 'Your account is ready. Opening your student portal…', 'success');
                await routeSignedInUser(data.user.id, feedback);
            } else {
                showFormMessage(feedback, 'Check your school email for a confirmation link, then sign in.', 'success');
            }
        } catch (error) {
            showFormMessage(feedback, 'We could not reach the sign-up service. Check your connection and try again.', 'danger');
        } finally {
            setSubmitState(form, false);
        }
    });
}
async function initializePortalPage() {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) {
        window.location.replace('index.html');
        return;
    }

    const userId = data.session.user.id;
    const destination = await getUserDestination(userId);
    if (destination === 'admin.html') {
        window.location.replace(destination);
        return;
    }
    if (!destination) {
        await supabase.auth.signOut();
        window.location.replace('index.html');
        return;
    }

    let portalData;
    try {
        portalData = await loadPortalData(userId);
    } catch (loadError) {
        console.error('Could not load student records.', loadError);
        showPageAlert('Your school records could not be loaded. Check the Supabase setup or contact the school administrator.', 'danger');
        initializeLogout();
        return;
    }

    populateSharedProfile(portalData.profile);
    populateAttendance(portalData.attendance);
    populateMarks(portalData.results);
    populateTimetable(portalData.timetable);
    populateDashboardUpdates(portalData.announcements, portalData.events);
    initializeSettings(portalData.profile, userId, data.session.user.email || '');
    initializeLogout();
    setActiveNavigation();
}

async function loadPortalData(userId) {
    const [profileResult, attendanceResult, resultsResult, timetableResult, announcementsResult, eventsResult] = await Promise.all([
        supabase.from('student_profiles')
            .select('user_id, student_id, school_email, full_name, college, date_of_birth, phone, branch, study_year')
            .eq('user_id', userId)
            .single(),
        supabase.from('attendance_records')
            .select('subject, class_date, status')
            .eq('user_id', userId)
            .order('class_date', { ascending: false })
            .limit(1000),
        supabase.from('assessment_results')
            .select('subject, term, assessment_type, score, max_score, grade, graded_at')
            .eq('user_id', userId)
            .eq('published', true)
            .order('graded_at', { ascending: false })
            .limit(1000),
        supabase.from('student_timetable')
            .select('day_of_week, start_time, end_time, subject, room')
            .eq('user_id', userId)
            .order('day_of_week')
            .order('start_time'),
        supabase.from('school_announcements')
            .select('title, body, published_at')
            .eq('published', true)
            .order('published_at', { ascending: false })
            .limit(5),
        supabase.from('school_events')
            .select('title, description, event_date, location')
            .eq('published', true)
            .gte('event_date', new Date().toISOString())
            .order('event_date')
            .limit(5)
    ]);

    const results = [profileResult, attendanceResult, resultsResult, timetableResult, announcementsResult, eventsResult];
    const failed = results.find((result) => result.error);
    if (failed) throw failed.error;

    return {
        profile: profileResult.data,
        attendance: attendanceResult.data || [],
        results: resultsResult.data || [],
        timetable: timetableResult.data || [],
        announcements: announcementsResult.data || [],
        events: eventsResult.data || []
    };
}

function populateSharedProfile(profile) {
    setText('welcomeMessage', `Welcome, ${profile.full_name || 'Student'}`);
    setText('dashboardStudentId', profile.student_id);

    const values = {
        profileName: profile.full_name,
        profileBranch: profile.branch,
        profileCollege: profile.college,
        profileDob: profile.date_of_birth ? formatDate(profile.date_of_birth) : 'Not provided',
        profilePhone: profile.phone,
        profileYear: profile.study_year ? getYearText(profile.study_year) : 'Not provided',
        settingsProfileName: profile.full_name,
        settingsStudentId: profile.student_id
    };
    Object.entries(values).forEach(([id, value]) => setText(id, value));
}

function populateAttendance(records) {
    const subjectNames = getSubjectNames(records);
    const attendanceMetrics = subjectNames.map((subjectName) => {
        const subjectRows = records.filter((record) => normalizeSubject(record.subject) === normalizeSubject(subjectName));
        const eligible = subjectRows.filter((record) => record.status !== 'excused');
        const attended = eligible.filter((record) => record.status === 'present' || record.status === 'late').length;
        return {
            label: subjectName,
            value: eligible.length ? Math.round((attended / eligible.length) * 100) : null
        };
    });
    renderMetricCards('attendanceSubjectCards', attendanceMetrics, 'Attendance has not been published yet.');

    const head = document.getElementById('attendanceDetailHead');
    const tbody = document.getElementById('attendanceDetailRows');
    if (!tbody) return;
    if (head) {
        const headerRow = document.createElement('tr');
        ['Month', ...subjectNames, 'Overall'].forEach((label) => {
            const cell = document.createElement('th');
            cell.scope = 'col';
            cell.textContent = label;
            headerRow.append(cell);
        });
        head.replaceChildren(headerRow);
    }

    const months = groupBy(records, (record) => String(record.class_date).slice(0, 7));
    if (!months.size) {
        showTableEmpty(tbody, subjectNames.length + 2, 'No monthly attendance has been published yet.');
        return;
    }

    const rows = [...months.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([monthKey, monthRecords]) => {
        const subjectRates = subjectNames.map((subjectName) => {
            const subjectRecords = monthRecords.filter((record) => normalizeSubject(record.subject) === normalizeSubject(subjectName));
            const eligible = subjectRecords.filter((record) => record.status !== 'excused');
            const attended = eligible.filter((record) => record.status === 'present' || record.status === 'late').length;
            return eligible.length ? Math.round((attended / eligible.length) * 100) : null;
        });
        const eligibleAll = monthRecords.filter((record) => record.status !== 'excused');
        const attendedAll = eligibleAll.filter((record) => record.status === 'present' || record.status === 'late').length;
        const overall = eligibleAll.length ? Math.round((attendedAll / eligibleAll.length) * 100) : null;
        return [formatMonth(monthKey), ...subjectRates, overall];
    });
    renderTableRows(tbody, rows, true);
}
function populateMarks(records) {
    const summaryBySubject = new Map();
    records.forEach((record) => {
        const key = normalizeSubject(record.subject);
        const current = summaryBySubject.get(key) || { label: record.subject, score: 0, max: 0 };
        current.score += Number(record.score) || 0;
        current.max += Number(record.max_score) || 0;
        summaryBySubject.set(key, current);
    });

    const summaries = [...summaryBySubject.values()]
        .sort((a, b) => a.label.localeCompare(b.label))
        .map((subject) => ({
            label: subject.label,
            value: subject.max > 0 ? Math.round((subject.score / subject.max) * 100) : null
        }));
    renderMetricCards('marksSubjectCards', summaries, 'No published marks yet.');
    renderSemesterResults(records, 'semester_1', 'semester1Rows');
    renderSemesterResults(records, 'semester_2', 'semester2Rows');

    const canvas = document.getElementById('marksChart');
    if (!canvas) return;
    if (!summaries.some((item) => item.value !== null)) {
        canvas.hidden = true;
        addEmptyState(canvas, 'Marks will appear here after your school publishes results.');
        return;
    }
    if (typeof Chart === 'undefined') return;

    const colors = ['rgba(59, 130, 246, .72)', 'rgba(245, 158, 11, .72)', 'rgba(16, 185, 129, .72)', 'rgba(139, 92, 246, .72)', 'rgba(236, 72, 153, .72)'];
    new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: summaries.map((item) => item.label),
            datasets: [{
                label: 'Average score (%)',
                data: summaries.map((item) => item.value),
                backgroundColor: summaries.map((_, index) => colors[index % colors.length]),
                borderRadius: 8,
                maxBarThickness: 58
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, max: 100, ticks: { stepSize: 20 } } },
            plugins: { legend: { display: false }, title: { display: true, text: 'Published results by subject' } }
        }
    });
}
function getSubjectNames(records) {
    const subjects = new Map();
    records.forEach((record) => {
        const label = String(record.subject || '').trim();
        if (label && !subjects.has(normalizeSubject(label))) subjects.set(normalizeSubject(label), label);
    });
    return [...subjects.values()].sort((a, b) => a.localeCompare(b));
}

function renderMetricCards(containerId, metrics, emptyMessage) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.replaceChildren();
    if (!metrics.length) {
        const empty = document.createElement('p');
        empty.className = 'empty-state text-muted text-center col-12 py-4 mb-0';
        empty.textContent = emptyMessage;
        container.append(empty);
        return;
    }

    const accents = ['bg-primary', 'bg-info', 'bg-success', 'bg-warning', 'bg-danger'];
    metrics.forEach((metric, index) => {
        const column = document.createElement('div');
        column.className = 'col-sm-6 col-xl-4';
        const card = document.createElement('article');
        card.className = 'card h-100 border-0 shadow-sm subject-metric-card';
        const body = document.createElement('div');
        body.className = 'card-body';
        const heading = document.createElement('h5');
        heading.className = 'card-title mb-3';
        heading.textContent = metric.label;
        const valueRow = document.createElement('div');
        valueRow.className = 'd-flex justify-content-between align-items-baseline mb-2';
        const caption = document.createElement('span');
        caption.className = 'small text-muted';
        caption.textContent = 'Published';
        const value = document.createElement('strong');
        value.className = 'subject-metric-value';
        value.textContent = metric.value === null ? 'No records' : `${metric.value}%`;
        valueRow.append(caption, value);
        const progress = document.createElement('div');
        progress.className = 'progress';
        progress.setAttribute('role', 'progressbar');
        progress.setAttribute('aria-valuemin', '0');
        progress.setAttribute('aria-valuemax', '100');
        const bar = document.createElement('div');
        bar.className = `progress-bar ${accents[index % accents.length]}`;
        const numericValue = metric.value === null ? 0 : Math.min(100, Math.max(0, metric.value));
        bar.style.width = `${numericValue}%`;
        progress.setAttribute('aria-valuenow', String(numericValue));
        progress.setAttribute('aria-valuetext', metric.value === null ? 'No records published' : `${metric.value} percent`);
        progress.append(bar);
        body.append(heading, valueRow, progress);
        card.append(body);
        column.append(card);
        container.append(column);
    });
}
function renderSemesterResults(records, term, tbodyId) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    const semesterRecords = records.filter((record) => record.term === term);
    if (!semesterRecords.length) {
        showTableEmpty(tbody, 6, 'No results have been published for this semester yet.');
        return;
    }

    const subjects = new Map();
    semesterRecords.forEach((record) => {
        const key = normalizeSubject(record.subject);
        const subject = subjects.get(key) || {
            label: String(record.subject || 'Subject').trim(),
            assessments: {},
            totalScore: 0,
            totalMaximum: 0,
            grades: {}
        };
        const score = Number(record.score);
        const maximum = Number(record.max_score);
        if (Number.isFinite(score) && Number.isFinite(maximum)) {
            subject.assessments[record.assessment_type] = `${formatMark(score)} / ${formatMark(maximum)}`;
            subject.totalScore += score;
            subject.totalMaximum += maximum;
        }
        if (record.grade) subject.grades[record.assessment_type] = record.grade;
        subjects.set(key, subject);
    });

    const rows = [...subjects.values()]
        .sort((left, right) => left.label.localeCompare(right.label))
        .map((subject) => [
            subject.label,
            subject.assessments.midterm || '—',
            subject.assessments.assignment || '—',
            subject.assessments.final_exam || '—',
            subject.totalMaximum > 0
                ? `${formatMark(subject.totalScore)} / ${formatMark(subject.totalMaximum)}`
                : '—',
            subject.grades.final_exam || subject.grades.assignment || subject.grades.midterm || '—'
        ]);
    renderTableRows(tbody, rows, false);
}

function formatMark(value) {
    return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function populateTimetable(records) {
    const tbody = document.getElementById('timetableRows');
    if (!tbody) return;
    if (!records.length) {
        showTableEmpty(tbody, 4, 'Your school timetable has not been published yet.');
        return;
    }
    const rows = records.map((record) => [
        DAYS[Number(record.day_of_week) - 1] || '—',
        `${formatTime(record.start_time)}–${formatTime(record.end_time)}`,
        record.subject,
        record.room || '—'
    ]);
    renderTableRows(tbody, rows, false);
}

function populateDashboardUpdates(announcements, events) {
    const announcementList = document.getElementById('announcementList');
    if (announcementList) {
        announcementList.replaceChildren();
        if (!announcements.length) {
            addEmptyState(announcementList, 'School announcements will appear here.');
        } else {
            announcements.forEach((item) => {
                const article = document.createElement('article');
                article.className = 'update-item';
                const heading = document.createElement('h6');
                heading.textContent = item.title;
                const body = document.createElement('p');
                body.className = 'small text-muted mb-1';
                body.textContent = item.body;
                const date = document.createElement('small');
                date.className = 'text-muted';
                date.textContent = item.published_at ? formatDateTime(item.published_at) : '';
                article.append(heading, body, date);
                announcementList.append(article);
            });
        }
    }

    const eventList = document.getElementById('upcomingEventsList');
    if (eventList) {
        eventList.replaceChildren();
        if (!events.length) {
            addEmptyState(eventList, 'No upcoming events have been published.');
        } else {
            events.forEach((item) => {
                const article = document.createElement('article');
                article.className = 'update-item';
                const heading = document.createElement('h6');
                heading.textContent = item.title;
                const description = document.createElement('p');
                description.className = 'small text-muted mb-1';
                description.textContent = [item.description, item.location].filter(Boolean).join(' · ');
                const date = document.createElement('small');
                date.className = 'text-muted';
                date.textContent = formatDateTime(item.event_date);
                article.append(heading, description, date);
                eventList.append(article);
            });
        }
    }
}

function initializeSettings(profile, userId, authEmail) {
    const form = document.getElementById('settingsForm');
    if (!form) return;

    const nameInput = document.getElementById('editName');
    const phoneInput = document.getElementById('editPhone');
    const emailInput = document.getElementById('editEmail');
    nameInput.value = profile.full_name || '';
    phoneInput.value = profile.phone || '';
    emailInput.value = authEmail || profile.school_email || '';
    emailInput.readOnly = true;
    setValue('editCollege', profile.college || '');
    setValue('editBranch', profile.branch || '');
    setValue('editYear', profile.study_year ? getYearText(profile.study_year) : '');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const feedback = document.getElementById('settingsSuccess');
        clearFormMessage(feedback);
        const newPassword = document.getElementById('editPassword').value;
        if (newPassword && newPassword.length < 8) {
            showFormMessage(feedback, 'Use a password with at least 8 characters.', 'danger');
            return;
        }

        setSubmitState(form, true, 'Saving…');
        const { data: updatedProfile, error: profileError } = await supabase
            .from('student_profiles')
            .update({
                full_name: nameInput.value.trim(),
                phone: phoneInput.value.trim() || null
            })
            .eq('user_id', userId)
            .select('full_name, phone')
            .single();

        if (profileError) {
            setSubmitState(form, false);
            showFormMessage(feedback, 'Your profile changes could not be saved. Please try again.', 'danger');
            return;
        }

        if (newPassword) {
            const { error: passwordError } = await supabase.auth.updateUser({ password: newPassword });
            if (passwordError) {
                setSubmitState(form, false);
                setText('welcomeMessage', `Welcome, ${updatedProfile.full_name}`);
                showFormMessage(feedback, 'Your profile was saved, but your password could not be changed. Please try again.', 'danger');
                return;
            }
            document.getElementById('editPassword').value = '';
        }

        profile.full_name = updatedProfile.full_name;
        profile.phone = updatedProfile.phone;
        setText('welcomeMessage', `Welcome, ${profile.full_name}`);
        setText('profileName', profile.full_name);
        setText('profilePhone', profile.phone);
        setText('settingsProfileName', profile.full_name);
        setSubmitState(form, false);
        showFormMessage(feedback, 'Your profile changes have been saved.', 'success');
    });
}

function initializeLogout() {
    document.querySelectorAll('#logoutBtn').forEach((button) => {
        button.addEventListener('click', async (event) => {
            event.preventDefault();
            await supabase.auth.signOut();
            window.location.assign('index.html');
        });
    });
}

function setActiveNavigation() {
    const currentPage = window.location.pathname.split('/').pop().toLowerCase() || 'index.html';
    document.querySelectorAll('.navbar-nav .nav-link[href]').forEach((link) => {
        const targetPage = new URL(link.href, window.location.href).pathname.split('/').pop().toLowerCase();
        if (targetPage === currentPage) {
            link.classList.add('active');
            link.setAttribute('aria-current', 'page');
            link.closest('.dropdown')?.querySelector('.dropdown-toggle')?.classList.add('active');
        } else {
            link.classList.remove('active');
            link.removeAttribute('aria-current');
        }
    });
}

function groupBy(items, keySelector) {
    return items.reduce((groups, item) => {
        const key = keySelector(item);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(item);
        return groups;
    }, new Map());
}

function normalizeSubject(subject) {
    const value = String(subject || '').trim().toLowerCase();
    if (value === 'math' || value === 'maths' || value === 'mathematics') return 'mathematics';
    return value;
}

function renderTableRows(tbody, rows, addPercent) {
    tbody.replaceChildren(...rows.map((rowData) => {
        const row = document.createElement('tr');
        rowData.forEach((value, index) => {
            const cell = document.createElement('td');
            cell.textContent = value === null || value === undefined
                ? '—'
                : (addPercent && index > 0 && value !== '—' ? `${value}%` : String(value));
            if (index === 0) cell.classList.add('fw-semibold');
            row.append(cell);
        });
        return row;
    }));
}

function showTableEmpty(tbody, columns, message) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = columns;
    cell.className = 'text-center text-muted py-4';
    cell.textContent = message;
    row.append(cell);
    tbody.replaceChildren(row);
}

function addEmptyState(parent, message) {
    const paragraph = document.createElement('p');
    paragraph.className = 'empty-state text-muted text-center py-4 mb-0';
    paragraph.textContent = message;
    parent.append(paragraph);
}

function showFormMessage(element, message, type) {
    if (!element) return;
    element.textContent = message;
    element.classList.remove('d-none', 'alert-success', 'alert-danger', 'alert-warning');
    element.classList.add(`alert-${type}`);
    element.setAttribute('role', type === 'danger' ? 'alert' : 'status');
}

function clearFormMessage(element) {
    if (!element) return;
    element.textContent = '';
    element.classList.add('d-none');
    element.classList.remove('alert-success', 'alert-danger', 'alert-warning');
}

function showPageAlert(message, type) {
    const container = document.querySelector('.container.my-4') || document.querySelector('main') || document.querySelector('.auth-page .card-body');
    if (!container) return;
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} mb-4`;
    alert.setAttribute('role', 'alert');
    alert.textContent = message;
    container.prepend(alert);
}

function setSubmitState(form, isLoading, loadingLabel = 'Please wait…') {
    const button = form.querySelector('button[type="submit"]');
    if (!button) return;
    if (isLoading) {
        button.dataset.originalLabel = button.textContent.trim();
        button.disabled = true;
        button.textContent = loadingLabel;
    } else {
        button.disabled = false;
        button.textContent = button.dataset.originalLabel || 'Submit';
    }
}

function setActionBusy(button, isLoading, loadingLabel = 'Please wait…') {
    if (!button) return;
    if (isLoading) {
        if (!button.dataset.originalHtml) button.dataset.originalHtml = button.innerHTML;
        button.disabled = true;
        button.textContent = loadingLabel;
    } else {
        button.disabled = false;
        if (button.dataset.originalHtml) {
            button.innerHTML = button.dataset.originalHtml;
            delete button.dataset.originalHtml;
        }
    }
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value || 'Not provided';
}

function setValue(id, value) {
    const element = document.getElementById(id);
    if (element) element.value = value || '';
}

function formatDate(dateString) {
    const date = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(date.getTime())) return 'Not provided';
    return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
}

function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function formatMonth(monthKey) {
    const date = new Date(`${monthKey}-01T00:00:00`);
    return Number.isNaN(date.getTime()) ? monthKey : new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(date);
}

function formatTime(value) {
    const date = new Date(`1970-01-01T${value}`);
    return Number.isNaN(date.getTime()) ? String(value).slice(0, 5) : new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
}

function formatScore(value) {
    const numeric = Number(value);
    return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1);
}

function getYearText(year) {
    const yearMap = { 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year' };
    return yearMap[year] || `${year} Year`;
}
