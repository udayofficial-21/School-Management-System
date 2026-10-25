document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-password-toggle]').forEach((button) => {
        const input = document.getElementById(button.getAttribute('aria-controls'));
        if (!input) {
            button.disabled = true;
            return;
        }

        button.addEventListener('click', () => {
            const showPassword = input.type === 'password';
            input.type = showPassword ? 'text' : 'password';
            button.setAttribute('aria-label', showPassword ? 'Hide password' : 'Show password');
            button.setAttribute('aria-pressed', String(showPassword));

            const icon = button.querySelector('i');
            icon?.classList.toggle('bi-eye-slash', showPassword);
            icon?.classList.toggle('bi-eye', !showPassword);
            input.focus();
        });
    });
});
