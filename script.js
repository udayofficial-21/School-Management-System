// DOM Elements
document.addEventListener('DOMContentLoaded', function() {
    // Check which page we're on
    const isLoginPage = document.getElementById('loginForm');
    const isRegistrationPage = document.getElementById('registrationForm');
    const isDashboardPage = document.getElementById('profile');

    // Initialize page-specific features
    if (isLoginPage) {
        initLoginPage();
    } else if (isRegistrationPage) {
        initRegistrationPage();
    } else if (isDashboardPage) {
        initDashboardPage();
    }
});

// Initialize the login page
function initLoginPage() {
    const loginForm = document.getElementById('loginForm');
    const studentIdInput = document.getElementById('studentId');
    const passwordInput = document.getElementById('password');
    const loginError = document.getElementById('loginError');
    const togglePassword = document.getElementById('togglePassword');

    // Handle password visibility toggle
    togglePassword.addEventListener('click', function() {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        this.querySelector('i').classList.toggle('bi-eye');
        this.querySelector('i').classList.toggle('bi-eye-slash');
    });

    // Handle login form submission
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const studentId = studentIdInput.value.trim();
        const password = passwordInput.value.trim();
        
        // Check default credentials (as per requirements)
        if (studentId === '23471A05D3' && password === '23471A05D3') {
            // Store logged-in status
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('studentId', studentId);
            
            // Use default student data if no custom data exists
            if (!localStorage.getItem('studentData')) {
                const defaultStudentData = {
                    name: 'John Doe',
                    college: 'ABC Engineering College',
                    dob: '2000-01-15',
                    phone: '9876543210',
                    branch: 'Computer Science',
                    year: '3',
                    attendance: {
                        english: 85,
                        maths: 73,
                        science: 90
                    },
                    marks: {
                        english: 82,
                        maths: 75,
                        science: 91
                    }
                };
                localStorage.setItem('studentData', JSON.stringify(defaultStudentData));
            }
            
            // Redirect to dashboard
            window.location.href = 'dashboard.html';
        } else {
            // Check if registered user exists
            const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers')) || [];
            const user = registeredUsers.find(u => u.studentId === studentId && u.password === password);
            
            if (user) {
                // Store logged-in status and user data
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('studentId', studentId);
                
                // Create student data if it doesn't exist
                if (!localStorage.getItem(`studentData_${studentId}`)) {
                    const studentData = {
                        name: user.name,
                        college: user.college,
                        dob: user.dob,
                        phone: user.phone,
                        branch: user.branch,
                        year: user.year,
                        attendance: {
                            english: getRandomNumber(70, 95),
                            maths: getRandomNumber(70, 95),
                            science: getRandomNumber(70, 95)
                        },
                        marks: {
                            english: getRandomNumber(60, 95),
                            maths: getRandomNumber(60, 95),
                            science: getRandomNumber(60, 95)
                        }
                    };
                    localStorage.setItem(`studentData_${studentId}`, JSON.stringify(studentData));
                }
                
                // Redirect to dashboard
                window.location.href = 'dashboard.html';
            } else {
                // Show error message
                loginError.classList.remove('d-none');
                setTimeout(() => {
                    loginError.classList.add('d-none');
                }, 3000);
            }
        }
    });
}

// Initialize the registration page
function initRegistrationPage() {
    const registrationForm = document.getElementById('registrationForm');
    const toggleRegPassword = document.getElementById('toggleRegPassword');
    const regPasswordInput = document.getElementById('regPassword');
    
    // Handle password visibility toggle
    toggleRegPassword.addEventListener('click', function() {
        const type = regPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        regPasswordInput.setAttribute('type', type);
        this.querySelector('i').classList.toggle('bi-eye');
        this.querySelector('i').classList.toggle('bi-eye-slash');
    });
    
    // Handle registration form submission
    registrationForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Get form values
        const name = document.getElementById('studentName').value.trim();
        const college = document.getElementById('college').value.trim();
        const dob = document.getElementById('dob').value;
        const phone = document.getElementById('phoneNumber').value.trim();
        const branch = document.getElementById('branch').value;
        const year = document.getElementById('year').value;
        const studentId = document.getElementById('regStudentId').value.trim();
        const password = document.getElementById('regPassword').value.trim();
        
        // Get existing registered users or initialize an empty array
        const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers')) || [];
        
        // Check if user already exists
        if (registeredUsers.some(user => user.studentId === studentId)) {
            alert('A user with this Student ID already exists. Please use a different ID.');
            return;
        }
        
        // Add new user
        registeredUsers.push({
            name,
            college,
            dob,
            phone,
            branch,
            year,
            studentId,
            password
        });
        
        // Save to localStorage
        localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));
        
        // Generate random attendance and marks
        const studentData = {
            name,
            college,
            dob,
            phone,
            branch,
            year,
            attendance: {
                english: getRandomNumber(70, 95),
                maths: getRandomNumber(70, 95),
                science: getRandomNumber(70, 95)
            },
            marks: {
                english: getRandomNumber(60, 95),
                maths: getRandomNumber(60, 95),
                science: getRandomNumber(60, 95)
            }
        };
        
        // Save student data
        localStorage.setItem(`studentData_${studentId}`, JSON.stringify(studentData));
        
        // Show success message and redirect
        alert('Registration successful! Please login with your credentials.');
        window.location.href = 'index.html';
    });
}

// Initialize the dashboard page
function initDashboardPage() {
    // Check if user is logged in
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    const studentId = localStorage.getItem('studentId');
    
    if (!isLoggedIn || !studentId) {
        // Redirect to login if not logged in
        window.location.href = 'index.html';
        return;
    }
    
    // Load student data
    let studentData;
    if (studentId === '23471A05D3') {
        // Default user
        studentData = JSON.parse(localStorage.getItem('studentData'));
    } else {
        // Registered user
        studentData = JSON.parse(localStorage.getItem(`studentData_${studentId}`));
    }
    
    // Populate dashboard with student data
    populateDashboard(studentData, studentId);
    
    // Initialize settings
    initSettings(studentData, studentId);
    
    // Initialize charts
    initMarksChart(studentData.marks);
    
    // Handle logout
    document.getElementById('logoutBtn').addEventListener('click', function() {
        localStorage.removeItem('isLoggedIn');
        window.location.href = 'index.html';
    });
}

// Populate dashboard with student data
function populateDashboard(studentData, studentId) {
    // Welcome message
    document.getElementById('welcomeMessage').textContent = `Welcome, ${studentData.name}`;
    document.getElementById('dashboardStudentId').textContent = studentId;
    
    // Profile section
    document.getElementById('profileName').textContent = studentData.name;
    document.getElementById('profileBranch').textContent = studentData.branch;
    document.getElementById('profileCollege').textContent = studentData.college;
    document.getElementById('profileDob').textContent = formatDate(studentData.dob);
    document.getElementById('profilePhone').textContent = studentData.phone;
    document.getElementById('profileYear').textContent = getYearText(studentData.year);
    
    // Attendance section
    document.getElementById('englishAttendance').textContent = `${studentData.attendance.english}%`;
    document.getElementById('englishProgress').style.width = `${studentData.attendance.english}%`;
    document.getElementById('englishProgress').setAttribute('aria-valuenow', studentData.attendance.english);
    
    document.getElementById('mathsAttendance').textContent = `${studentData.attendance.maths}%`;
    document.getElementById('mathsProgress').style.width = `${studentData.attendance.maths}%`;
    document.getElementById('mathsProgress').setAttribute('aria-valuenow', studentData.attendance.maths);
    
    document.getElementById('scienceAttendance').textContent = `${studentData.attendance.science}%`;
    document.getElementById('scienceProgress').style.width = `${studentData.attendance.science}%`;
    document.getElementById('scienceProgress').setAttribute('aria-valuenow', studentData.attendance.science);
    
    // Marks section
    document.getElementById('englishMarks').textContent = studentData.marks.english;
    document.getElementById('englishMarksProgress').style.width = `${studentData.marks.english}%`;
    document.getElementById('englishMarksProgress').setAttribute('aria-valuenow', studentData.marks.english);
    
    document.getElementById('mathsMarks').textContent = studentData.marks.maths;
    document.getElementById('mathsMarksProgress').style.width = `${studentData.marks.maths}%`;
    document.getElementById('mathsMarksProgress').setAttribute('aria-valuenow', studentData.marks.maths);
    
    document.getElementById('scienceMarks').textContent = studentData.marks.science;
    document.getElementById('scienceMarksProgress').style.width = `${studentData.marks.science}%`;
    document.getElementById('scienceMarksProgress').setAttribute('aria-valuenow', studentData.marks.science);
}

// Initialize settings modal
function initSettings(studentData, studentId) {
    const settingsForm = document.getElementById('settingsForm');
    const nameInput = document.getElementById('editName');
    const phoneInput = document.getElementById('editPhone');
    
    // Populate form with current data
    nameInput.value = studentData.name;
    phoneInput.value = studentData.phone;
    
    // Handle settings form submission
    settingsForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Update student data
        studentData.name = nameInput.value.trim();
        studentData.phone = phoneInput.value.trim();
        
        // Update password if provided
        const newPassword = document.getElementById('editPassword').value.trim();
        if (newPassword) {
            // Update password in registered users
            if (studentId !== '23471A05D3') {
                const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers')) || [];
                const userIndex = registeredUsers.findIndex(u => u.studentId === studentId);
                if (userIndex !== -1) {
                    registeredUsers[userIndex].password = newPassword;
                    localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));
                }
            } else {
                // For default user, we just store the updated password
                localStorage.setItem('defaultPassword', newPassword);
            }
        }
        
        // Save updated student data
        if (studentId === '23471A05D3') {
            localStorage.setItem('studentData', JSON.stringify(studentData));
        } else {
            localStorage.setItem(`studentData_${studentId}`, JSON.stringify(studentData));
        }
        
        // Update UI
        document.getElementById('welcomeMessage').textContent = `Welcome, ${studentData.name}`;
        document.getElementById('profileName').textContent = studentData.name;
        document.getElementById('profilePhone').textContent = studentData.phone;
        
        // Close modal and show success message
        const modal = bootstrap.Modal.getInstance(document.getElementById('settingsModal'));
        modal.hide();
        
        alert('Profile updated successfully!');
    });
}

// Initialize marks chart
function initMarksChart(marks) {
    const ctx = document.getElementById('marksChart').getContext('2d');
    
    const chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['English', 'Mathematics', 'Science'],
            datasets: [{
                label: 'Marks',
                data: [marks.english, marks.maths, marks.science],
                backgroundColor: [
                    'rgba(13, 202, 240, 0.6)',
                    'rgba(255, 193, 7, 0.6)',
                    'rgba(25, 135, 84, 0.6)'
                ],
                borderColor: [
                    'rgba(13, 202, 240, 1)',
                    'rgba(255, 193, 7, 1)',
                    'rgba(25, 135, 84, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'Performance Overview'
                }
            }
        }
    });
}

// Helper function to format date
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

// Helper function to get year text
function getYearText(year) {
    const yearMap = {
        '1': '1st Year',
        '2': '2nd Year',
        '3': '3rd Year',
        '4': '4th Year'
    };
    return yearMap[year] || `${year} Year`;
}

// Helper function to generate random number
function getRandomNumber(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
} 