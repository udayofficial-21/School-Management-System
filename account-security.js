import { isSupabaseConfigured, supabase } from './supabase-client.js';

window.addEventListener('DOMContentLoaded', () => {
    initializeAccountSecurity().catch((error) => {
        console.error('Could not initialize account security.', error);
        showNotice('We could not verify this account. Return to the sign-in page and try again.', 'danger');
    });
});

async function initializeAccountSecurity() {
    const form = document.getElementById('securityForm');
    const signOutButton = document.getElementById('securitySignOut');
    if (!isSupabaseConfigured) {
        showNotice('Connect the Supabase project before managing account security.', 'warning');
        return;
    }

    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) {
        showNotice('Sign in first, then return here to create or change your password.', 'warning');
        signOutButton.hidden = true;
        return;
    }

    const user = data.session.user;
    const destination = await getUserDestination(user.id);
    if (!destination) {
        await supabase.auth.signOut();
        showNotice('This account does not have an active student or staff role. Contact the school administrator.', 'danger');
        return;
    }

    document.getElementById('securityAccount').textContent = user.email || '';
    document.getElementById('backToPortal').href = destination;
    form.hidden = false;
    signOutButton.hidden = false;

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const password = document.getElementById('newPassword').value;
        const confirmation = document.getElementById('confirmNewPassword').value;
        if (password.length < 8) {
            showNotice('Use a password with at least 8 characters.', 'warning');
            return;
        }
        if (password !== confirmation) {
            showNotice('The two passwords do not match. Check them and try again.', 'warning');
            document.getElementById('confirmNewPassword').focus();
            return;
        }

        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        const original = button.innerHTML;
        button.textContent = 'Saving password…';
        clearNotice();
        try {
            const { error: updateError } = await supabase.auth.updateUser({ password });
            if (updateError) {
                showNotice('We could not save the password. Try again, or use “Forgot password?” on the sign-in page.', 'danger');
                return;
            }
            form.reset();
            showNotice('Your password is saved. You can now sign in with your email and password or request an email code.', 'success');
        } catch (updateError) {
            console.error('Could not save account password.', updateError);
            showNotice('We could not save the password. Check your connection and try again.', 'danger');
        } finally {
            button.disabled = false;
            button.innerHTML = original;
        }
    });

    signOutButton.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.assign('index.html');
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

function showNotice(message, type) {
    const notice = document.getElementById('securityNotice');
    notice.textContent = message;
    notice.className = `alert alert-${type}`;
}

function clearNotice() {
    const notice = document.getElementById('securityNotice');
    notice.textContent = '';
    notice.className = 'alert d-none';
}
